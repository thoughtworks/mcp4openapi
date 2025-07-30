import * as fs from 'fs';
import * as path from 'path';
import { LLMProviderConfig } from './llm-factory.js';
import { MCPServerConfig } from './types.js';

export interface MCPTestConfig {
  llm: LLMProviderConfig;
  llmProviders: Record<string, {
    description: string;
    config: any;
  }>;
  orchestrator: {
    maxRounds: number;
    enableLogging: boolean;
    timeout?: number;
  };
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * Configuration Manager for MCP Test Client
 */
export class ConfigManager {
  private static config: MCPTestConfig | null = null;

  /**
   * Load configuration from JSON file
   */
  static load(configPath?: string): MCPTestConfig {
    if (this.config) {
      return this.config;
    }

    const defaultConfigPath = path.join(process.cwd(), 'config', 'mcp-test-config.json');
    const finalPath = configPath || defaultConfigPath;

    if (!fs.existsSync(finalPath)) {
      throw new Error(`Configuration file not found: ${finalPath}`);
    }

    try {
      const configContent = fs.readFileSync(finalPath, 'utf8');
      const config = JSON.parse(configContent) as MCPTestConfig;
      
      this.validateConfig(config);
      this.config = config;
      
      return config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Get LLM provider configuration
   */
  static getLLMConfig(): LLMProviderConfig {
    const config = this.load();
    return config.llm;
  }

  /**
   * Get orchestrator configuration
   */
  static getOrchestratorConfig() {
    const config = this.load();
    return config.orchestrator;
  }

  /**
   * Get all available LLM providers with their descriptions
   */
  static getAvailableLLMProviders(): Record<string, { description: string; config: any }> {
    const config = this.load();
    return config.llmProviders;
  }

  /**
   * Get MCP server configuration by name
   */
  static getMCPServerConfig(serverName: string): MCPServerConfig {
    const config = this.load();
    const serverConfig = config.mcpServers[serverName];
    
    if (!serverConfig) {
      throw new Error(`MCP server '${serverName}' not found in configuration`);
    }
    
    return serverConfig;
  }

  /**
   * Override LLM provider configuration
   */
  static setLLMProvider(provider: string, providerConfig?: any) {
    const config = this.load();
    
    if (!config.llmProviders[provider]) {
      throw new Error(`Unknown LLM provider: ${provider}`);
    }

    config.llm = {
      provider: provider as any,
      config: providerConfig || config.llmProviders[provider].config
    };
  }

  /**
   * Get all MCP server configurations
   */
  static getAllMCPServers(): Record<string, MCPServerConfig> {
    const config = this.load();
    return config.mcpServers;
  }

  /**
   * Validate configuration structure
   */
  private static validateConfig(config: any): void {
    if (!config.llm || !config.llm.provider) {
      throw new Error('Configuration must include llm.provider');
    }

    if (!config.llmProviders || typeof config.llmProviders !== 'object') {
      throw new Error('Configuration must include llmProviders object');
    }

    if (!config.orchestrator) {
      throw new Error('Configuration must include orchestrator settings');
    }

    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      throw new Error('Configuration must include mcpServers object');
    }

    // Validate LLM provider exists
    if (!config.llmProviders[config.llm.provider]) {
      throw new Error(`LLM provider '${config.llm.provider}' not found in llmProviders`);
    }

    // Validate orchestrator settings
    const orchestrator = config.orchestrator;
    if (typeof orchestrator.maxRounds !== 'number' || orchestrator.maxRounds < 1) {
      throw new Error('orchestrator.maxRounds must be a positive number');
    }

    if (typeof orchestrator.enableLogging !== 'boolean') {
      throw new Error('orchestrator.enableLogging must be a boolean');
    }
  }

  /**
   * Reset cached configuration (useful for testing)
   */
  static reset(): void {
    this.config = null;
  }
} 