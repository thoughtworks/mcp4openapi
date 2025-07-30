import { MCPCapabilities } from './types.js';

export { MCPCapabilities };

/**
 * Generic LLM Interface - works with any LLM implementation
 * This keeps the orchestrator clean and swappable
 */

export interface LLMRequest {
  type: 'tool' | 'resource' | 'prompt';
  name?: string;    // for tools and prompts
  uri?: string;     // for resources
  parameters?: Record<string, any>;
  reasoning?: string;
}

export interface LLMResponse {
  content?: string;  // Final response if LLM is done
  requests?: LLMRequest[];  // What the LLM wants to execute next
  needsMoreData: boolean;   // Whether LLM wants to continue the conversation
}

/**
 * Abstract LLM interface that all LLM implementations extend
 */
export abstract class BaseLLM {
  abstract processUserPrompt(userPrompt: string, capabilities: MCPCapabilities): Promise<LLMResponse>;
  abstract processResults(results: any[], conversationHistory?: any[]): Promise<LLMResponse>;
}

/**
 * Configuration for LLM behavior
 */
export interface LLMConfig {
  maxRounds?: number;        // Circuit breaker (default: 10)
  timeout?: number;          // Request timeout (default: 30s)
  enableLogging?: boolean;   // Verbose logging (default: true)
} 