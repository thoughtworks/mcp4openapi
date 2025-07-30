import { LLMFactory, LLMProviderConfig } from '../src/llm-factory.js';
import { RealLLMLMStudio } from '../src/real-llm-lmstudio.js';

// Mock the RealLLMLMStudio class
jest.mock('../src/real-llm-lmstudio.js', () => {
  const mockConstructor = jest.fn().mockImplementation((baseUrl: string) => ({
    baseUrl,
    processUserPrompt: jest.fn(),
    processResults: jest.fn(),
  }));
  return {
    RealLLMLMStudio: mockConstructor
  };
});

describe('LLMFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create LM Studio LLM with default baseUrl', () => {
      const config: LLMProviderConfig = {
        provider: 'lmstudio',
        config: {
          baseUrl: 'http://localhost:1234'
        }
      };

      const llm = LLMFactory.create(config);

      expect(RealLLMLMStudio).toHaveBeenCalledWith('http://localhost:1234');
      expect(llm).toBeDefined();
    });

    it('should create LM Studio LLM with custom baseUrl', () => {
      const config: LLMProviderConfig = {
        provider: 'lmstudio',
        config: {
          baseUrl: 'http://custom-host:8080'
        }
      };

      const llm = LLMFactory.create(config);

      expect(RealLLMLMStudio).toHaveBeenCalledWith('http://custom-host:8080');
      expect(llm).toBeDefined();
    });

    it('should use default baseUrl when not provided', () => {
      const config: LLMProviderConfig = {
        provider: 'lmstudio',
        config: {}
      };

      const llm = LLMFactory.create(config);

      expect(RealLLMLMStudio).toHaveBeenCalledWith('http://localhost:1234');
      expect(llm).toBeDefined();
    });

    it('should throw error for unsupported provider', () => {
      const config: LLMProviderConfig = {
        provider: 'unsupported' as any,
        config: {}
      };

      expect(() => LLMFactory.create(config)).toThrow('Unsupported LLM provider: unsupported');
    });

    it('should throw error for not yet implemented providers', () => {
      const providers = ['gemini', 'anthropic', 'openai'] as const;
      
      providers.forEach(provider => {
        const config: LLMProviderConfig = {
          provider,
          config: {}
        };

        expect(() => LLMFactory.create(config)).toThrow(`${provider} provider not yet implemented`);
      });
    });
  });

  describe('getSupportedProviders', () => {
    it('should return list of supported providers', () => {
      const providers = LLMFactory.getSupportedProviders();

      expect(providers).toEqual(['lmstudio', 'gemini', 'anthropic', 'openai']);
      expect(providers).toHaveLength(4);
    });
  });

  describe('getProviderDescriptions', () => {
    it('should return descriptions for all providers', () => {
      const descriptions = LLMFactory.getProviderDescriptions();

      expect(descriptions).toEqual({
        'lmstudio': 'LM Studio with local models',
        'gemini': 'Google Gemini API (not yet implemented)',
        'anthropic': 'Anthropic Claude API (not yet implemented)',
        'openai': 'OpenAI GPT API (not yet implemented)'
      });
    });

    it('should have descriptions for all supported providers', () => {
      const providers = LLMFactory.getSupportedProviders();
      const descriptions = LLMFactory.getProviderDescriptions();

      providers.forEach(provider => {
        expect(descriptions[provider]).toBeDefined();
        expect(typeof descriptions[provider]).toBe('string');
        expect(descriptions[provider].length).toBeGreaterThan(0);
      });
    });
  });

  describe('isProviderSupported', () => {
    it('should return true for supported providers', () => {
      const supportedProviders = ['lmstudio', 'gemini', 'anthropic', 'openai'];
      
      supportedProviders.forEach(provider => {
        expect(LLMFactory.isProviderSupported(provider)).toBe(true);
      });
    });

    it('should return false for unsupported providers', () => {
      const unsupportedProviders = ['unknown', 'fake', 'test', ''];
      
      unsupportedProviders.forEach(provider => {
        expect(LLMFactory.isProviderSupported(provider)).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null config gracefully', () => {
      const config: LLMProviderConfig = {
        provider: 'lmstudio',
        config: null as any
      };

      expect(() => LLMFactory.create(config)).toThrow('Cannot read properties of null (reading \'baseUrl\')');
    });

    it('should handle undefined config gracefully', () => {
      const config: LLMProviderConfig = {
        provider: 'lmstudio',
        config: undefined as any
      };

      expect(() => LLMFactory.create(config)).toThrow('Cannot read properties of undefined (reading \'baseUrl\')');
    });
  });
}); 