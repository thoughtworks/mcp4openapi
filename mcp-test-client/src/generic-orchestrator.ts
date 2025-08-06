import { BaseLLM, LLMRequest, LLMResponse } from './llm-interface.js';
import { MCPClient } from './mcp-client.js';
import { MCPServerConfig, Scenario, ExecutionStep, MCPCapabilities } from './types.js';
import chalk from 'chalk';

export interface LLMConfig {
  maxRounds?: number;
  enableLogging?: boolean;
}

/**
 * Generic Orchestrator - works with ANY LLM implementation
 * 
 * Key features:
 * - Multi-round conversation support (built-in)
 * - Circuit breaker to prevent infinite loops
 * - Works with any LLM implementation (LM Studio, Gemini, etc.)
 * - Same input/output for demo and production
 */
export class GenericOrchestrator {
  private llm: BaseLLM;
  private config: LLMConfig;
  private primaryClient: MCPClient | null = null;

  constructor(llm: BaseLLM, config: LLMConfig = {}) {
    this.llm = llm;
    this.config = {
      maxRounds: 10,
      enableLogging: true,
      ...config
    };
  }

  async addMCPServer(name: string, serverConfig: MCPServerConfig): Promise<void> {
    if (this.config.enableLogging) {
      console.log(chalk.blue(`\n🔌 [Orchestrator] Connecting to MCP server: ${name}`));
    }
    
    this.primaryClient = new MCPClient();
    await this.primaryClient.connect(serverConfig);
    
    if (this.config.enableLogging) {
      console.log(chalk.green(`✅ [Orchestrator] Connected to ${name} MCP server`));
    }
  }

  /**
   * Handle a user prompt with multi-round conversation support
   */
  async handleUserPrompt(userPrompt: string): Promise<any> {
    if (!this.primaryClient) {
      throw new Error('No MCP server connected. Call addMCPServer first.');
    }

    if (this.config.enableLogging) {
      console.log(chalk.blue(`\n🎯 [Orchestrator] Starting conversation with user prompt`));
    }

    // Get MCP capabilities
    const capabilities = await this.getCapabilities();
    
    // 🐛 DEBUG: Show what capabilities we're sending to the LLM
    if (this.config.enableLogging) {
      console.log(chalk.cyan(`\n📋 [Orchestrator] Sending capabilities to LLM:`));
      console.log(chalk.gray(`   🔧 Tools: ${capabilities.tools.length} (${capabilities.tools.map((t: any) => t.name).join(', ')})`));
      console.log(chalk.gray(`   📚 Resources: ${capabilities.resources.length} (${capabilities.resources.map((r: any) => r.name).join(', ')})`));
      console.log(chalk.gray(`   💬 Prompts: ${capabilities.prompts.length} (${capabilities.prompts.map((p: any) => p.name).join(', ')})`));
      console.log(chalk.gray(`\n   🧠 Full capabilities object:`));
      console.log(chalk.gray(`      ${JSON.stringify(capabilities, null, 2).substring(0, 500)}...`));
    }

    let round = 0;
    const maxRounds = this.config.maxRounds || 10;
    const steps: ExecutionStep[] = [];

    // Start conversation with LLM
    let llmResponse = await this.llm.processUserPrompt(userPrompt, capabilities);
    
    if (this.config.enableLogging) {
      console.log(chalk.magenta(`\n🤖 [Orchestrator] LLM Initial Response:`));
      console.log(chalk.gray(`   📝 Content: ${llmResponse.content?.substring(0, 100) || 'No content'}...`));
      console.log(chalk.gray(`   🔄 Needs more data: ${llmResponse.needsMoreData}`));
      console.log(chalk.gray(`   📋 Requests: ${llmResponse.requests?.length || 0}`));
      if (llmResponse.requests && llmResponse.requests.length > 0) {
        llmResponse.requests.forEach((req, i) => {
          console.log(chalk.gray(`      ${i+1}. ${req.type}: ${req.name || req.uri} (${req.reasoning})`));
        });
      }
    }

    // Multi-round conversation loop
    while (llmResponse.needsMoreData && round < maxRounds) {
      round++;
      
      if (this.config.enableLogging) {
        console.log(chalk.blue(`\n🔄 [Orchestrator] Round ${round}/${maxRounds}`));
      }

      // Execute LLM's requests
      const results = await this.executeRequests(llmResponse.requests || [], steps);
      
      // Send results back to LLM
      llmResponse = await this.llm.processResults(results);
      
      if (this.config.enableLogging) {
        console.log(chalk.magenta(`\n🤖 [Orchestrator] LLM Round ${round} Response:`));
        console.log(chalk.gray(`   📝 Content: ${llmResponse.content?.substring(0, 100) || 'No content'}...`));
        console.log(chalk.gray(`   🔄 Needs more data: ${llmResponse.needsMoreData}`));
        console.log(chalk.gray(`   📋 Requests: ${llmResponse.requests?.length || 0}`));
      }
    }

    // Circuit breaker check
    const success = round < maxRounds;
    if (!success && this.config.enableLogging) {
      console.log(chalk.red(`⚠️ [Orchestrator] Circuit breaker activated - stopped at ${maxRounds} rounds`));
    }

    return {
      response: llmResponse.content,
      success,
      rounds: round,
      steps
    };
  }

  /**
   * Run a specific scenario
   */
  async runScenario(scenario: Scenario): Promise<any> {
    if (this.config.enableLogging) {
      console.log(chalk.blue(`\n🎬 [Orchestrator] Running scenario: ${scenario.name}`));
    }

    return await this.handleUserPrompt(scenario.userPrompt);
  }

  /**
   * Execute LLM's requests (tools, resources, prompts)
   */
  private async executeRequests(requests: LLMRequest[], steps: ExecutionStep[]): Promise<any[]> {
    const results = [];

    for (const request of requests) {
      if (this.config.enableLogging) {
        console.log(chalk.yellow(`\n🔧 [Orchestrator] Executing ${request.type}: ${request.name || request.uri}`));
        console.log(chalk.gray(`   💭 Reasoning: ${request.reasoning}`));
      }
      
      let result;
      const stepStart = Date.now();

      try {
        switch (request.type) {
          case 'tool':
            result = await this.primaryClient!.executeTool(request.name!, request.parameters || {});
            break;
          case 'resource':
            result = await this.primaryClient!.readResource(request.uri!, request.parameters || {});
            break;
          case 'prompt':
            result = await this.primaryClient!.executePrompt(request.name!, request.parameters || {});
            break;
          default:
            throw new Error(`Unknown request type: ${(request as any).type}`);
        }

        if (this.config.enableLogging) {
          console.log(chalk.green(`   ✅ [Orchestrator] Success: ${JSON.stringify(result).substring(0, 100)}...`));
        }

      } catch (error) {
        result = { error: (error as Error).message };
        if (this.config.enableLogging) {
          console.log(chalk.red(`   ❌ [Orchestrator] Error: ${(error as Error).message}`));
        }
      }

      // Record step
      steps.push({
        type: request.type,
        name: request.name || request.uri || 'unknown',
        parameters: request.parameters || {},
        result,
        duration: Date.now() - stepStart
      });

      results.push(result);
    }

    return results;
  }

  /**
   * Get combined capabilities from all connected MCP servers
   */
  private async getCapabilities(): Promise<MCPCapabilities> {
    if (!this.primaryClient) {
      throw new Error('No MCP client available');
    }

    try {
      const capabilities = await this.primaryClient.getCapabilities();
      
      // 🐛 DEBUG: Log the raw capabilities we got from MCP client
      if (this.config.enableLogging) {
        console.log(chalk.cyan(`\n🔍 [Orchestrator] Raw capabilities from MCP client:`));
        console.log(chalk.gray(`   📊 Type: ${typeof capabilities}`));
        console.log(chalk.gray(`   📋 Keys: ${Object.keys(capabilities || {}).join(', ')}`));
        if (capabilities) {
          console.log(chalk.gray(`   🔧 Tools count: ${capabilities.tools?.length || 0}`));
          console.log(chalk.gray(`   📚 Resources count: ${capabilities.resources?.length || 0}`));
          console.log(chalk.gray(`   💬 Prompts count: ${capabilities.prompts?.length || 0}`));
        }
      }

      return capabilities;
    } catch (error) {
      if (this.config.enableLogging) {
        console.log(chalk.red(`❌ [Orchestrator] Error getting capabilities: ${error}`));
      }
      throw error;
    }
  }
} 