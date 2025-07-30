import { ConfigManager } from '../src/config-manager.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock the fs and path modules
jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('ConfigManager', () => {
  const mockConfig = {
    llm: {
      provider: 'lmstudio',
      config: {
        baseUrl: 'http://localhost:1234',
        model: 'test-model'
      }
    },
    llmProviders: {
      lmstudio: {
        description: 'LM Studio with local models',
        config: {
          baseUrl: 'http://localhost:1234',
          model: 'test-model'
        }
      },
      gemini: {
        description: 'Google Gemini API',
        config: {
          apiKey: 'test-key',
          model: 'gemini-pro'
        }
      }
    },
    orchestrator: {
      maxRounds: 10,
      enableLogging: true,
      timeout: 30000
    },
    mcpServers: {
      banking: {
        name: 'banking-apis',
        connection: {
          type: 'http' as const,
          url: 'http://localhost:4000'
        }
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockPath.join.mockImplementation((...paths) => paths.join('/'));
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    
    // Clear any existing configuration
    ConfigManager.reset();
  });

  describe('load', () => {
    it('should load configuration from default file', () => {
      const config = ConfigManager.load();

      expect(mockPath.join).toHaveBeenCalledWith(process.cwd(), 'config', 'mcp-test-config.json');
      expect(mockFs.readFileSync).toHaveBeenCalled();
      expect(config).toEqual(mockConfig);
    });

    it('should load configuration from custom file path', () => {
      const customPath = '/custom/path/config.json';
      const config = ConfigManager.load(customPath);

      expect(mockFs.readFileSync).toHaveBeenCalledWith(customPath, 'utf8');
      expect(config).toEqual(mockConfig);
    });

    it('should throw error when config file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => ConfigManager.load()).toThrow('Configuration file not found');
    });

    it('should throw error when config file has invalid JSON', () => {
      mockFs.readFileSync.mockReturnValue('invalid json');

      expect(() => ConfigManager.load()).toThrow('Failed to load configuration');
    });

    it('should cache configuration after first load', () => {
      const config1 = ConfigManager.load();
      const config2 = ConfigManager.load();

      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
      expect(config1).toBe(config2);
    });
  });

  describe('getLLMConfig', () => {
    it('should return current LLM configuration', () => {
      const llmConfig = ConfigManager.getLLMConfig();

      expect(llmConfig).toEqual({
        provider: 'lmstudio',
        config: mockConfig.llmProviders.lmstudio.config
      });
    });

    it('should load configuration if not already loaded', () => {
      ConfigManager.reset();
      
      const llmConfig = ConfigManager.getLLMConfig();

      expect(llmConfig).toEqual({
        provider: 'lmstudio',
        config: mockConfig.llmProviders.lmstudio.config
      });
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });
  });

  describe('getAvailableLLMProviders', () => {
    it('should return available LLM providers', () => {
      const providers = ConfigManager.getAvailableLLMProviders();

      expect(providers).toEqual(mockConfig.llmProviders);
    });

    it('should load configuration if not already loaded', () => {
      ConfigManager.reset();
      
      const providers = ConfigManager.getAvailableLLMProviders();

      expect(providers).toEqual(mockConfig.llmProviders);
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });
  });

  describe('setLLMProvider', () => {
    it('should update LLM provider', () => {
      ConfigManager.setLLMProvider('gemini');

      const llmConfig = ConfigManager.getLLMConfig();
      expect(llmConfig.provider).toBe('gemini');
      expect(llmConfig.config).toEqual(mockConfig.llmProviders.gemini.config);
    });

    it('should throw error for unknown provider', () => {
      expect(() => ConfigManager.setLLMProvider('unknown')).toThrow('Unknown LLM provider: unknown');
    });

    it('should load configuration if not already loaded', () => {
      ConfigManager.reset();
      
      ConfigManager.setLLMProvider('gemini');

      expect(mockFs.readFileSync).toHaveBeenCalled();
      const llmConfig = ConfigManager.getLLMConfig();
      expect(llmConfig.provider).toBe('gemini');
    });
  });

  describe('getOrchestratorConfig', () => {
    it('should return orchestrator configuration', () => {
      const orchestratorConfig = ConfigManager.getOrchestratorConfig();

      expect(orchestratorConfig).toEqual(mockConfig.orchestrator);
    });

    it('should load configuration if not already loaded', () => {
      ConfigManager.reset();
      
      const orchestratorConfig = ConfigManager.getOrchestratorConfig();

      expect(orchestratorConfig).toEqual(mockConfig.orchestrator);
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });
  });

  describe('getMCPServerConfig', () => {
    it('should return MCP server configuration', () => {
      const serverConfig = ConfigManager.getMCPServerConfig('banking');

      expect(serverConfig).toEqual(mockConfig.mcpServers.banking);
    });

    it('should throw error for unknown server', () => {
      expect(() => ConfigManager.getMCPServerConfig('unknown')).toThrow("MCP server 'unknown' not found in configuration");
    });

    it('should load configuration if not already loaded', () => {
      ConfigManager.reset();
      
      const serverConfig = ConfigManager.getMCPServerConfig('banking');

      expect(serverConfig).toEqual(mockConfig.mcpServers.banking);
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should throw error for empty configuration file', () => {
      mockFs.readFileSync.mockReturnValue('{}');

      expect(() => ConfigManager.load()).toThrow('Failed to load configuration: Configuration must include llm.provider');
    });

    it('should throw error for configuration with missing sections', () => {
      const partialConfig = {
        llm: {
          provider: 'lmstudio'
        }
      };
      
      mockFs.readFileSync.mockReturnValue(JSON.stringify(partialConfig));

      expect(() => ConfigManager.load()).toThrow('Failed to load configuration: Configuration must include llmProviders object');
    });

    it('should handle file system errors gracefully', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      expect(() => ConfigManager.load()).toThrow('Failed to load configuration: File system error');
    });
  });
}); 