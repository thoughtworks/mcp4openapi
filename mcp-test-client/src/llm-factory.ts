import { RealLLMLMStudio } from './real-llm-lmstudio.js';
import { BaseLLM } from './llm-interface.js';
import { TestData } from './types.js';

export interface LLMProviderConfig {
  provider: 'lmstudio' | 'gemini' | 'anthropic' | 'openai';
  config: LMStudioConfig | any;
}

export interface LMStudioConfig {
  baseUrl: string;
  modelName?: string;
}

export class LLMFactory {
  /**
   * Create an LLM instance based on provider configuration
   */
  static create(providerConfig: LLMProviderConfig): BaseLLM {
    const { provider } = providerConfig;

    if (!this.isProviderSupported(provider)) {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    switch (provider) {
      case 'lmstudio':
        return this.createLMStudio(providerConfig.config as LMStudioConfig);
      
      case 'gemini':
      case 'anthropic': 
      case 'openai':
        throw new Error(`${provider} provider not yet implemented`);
      
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }

  /**
   * Create LM Studio LLM instance
   */
  private static createLMStudio(config: LMStudioConfig): RealLLMLMStudio {
    const baseUrl = config.baseUrl || 'http://localhost:1234';
    return new RealLLMLMStudio(baseUrl);
  }

  /**
   * Get list of supported providers
   */
  static getSupportedProviders(): string[] {
    return ['lmstudio', 'gemini', 'anthropic', 'openai'];
  }

  /**
   * Get provider descriptions
   */
  static getProviderDescriptions(): Record<string, string> {
    return {
      'lmstudio': 'LM Studio with local models',
      'gemini': 'Google Gemini API (not yet implemented)',
      'anthropic': 'Anthropic Claude API (not yet implemented)',
      'openai': 'OpenAI GPT API (not yet implemented)'
    };
  }

  /**
   * Check if provider is supported
   */
  static isProviderSupported(provider: string): boolean {
    return this.getSupportedProviders().includes(provider);
  }
} 