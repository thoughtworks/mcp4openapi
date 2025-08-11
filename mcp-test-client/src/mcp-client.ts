import { MCPServerConfig, MCPCapabilities } from './types.js';
import chalk from 'chalk';
import fetch from 'node-fetch';

export class MCPClient {
  private config: MCPServerConfig | null = null;
  private connected: boolean = false;
  private capabilities: MCPCapabilities | null = null;
  private sessionId: string | null = null;

  async connect(config: MCPServerConfig): Promise<void> {
    this.config = config;
    
    console.log(chalk.blue(`🔗 [MCP Client] Connecting to ${config.name}...`));

    if (config.connection.type === 'http') {
      try {
        // Test the connection
        const testResponse = await fetch(`${config.connection.url}/health`);
        if (testResponse.ok) {
          console.log(chalk.green(`✅ [MCP Client] Connected to ${config.name}`));
          this.connected = true;
          
          // Load capabilities immediately after connecting
          await this.loadCapabilities();
        } else {
          throw new Error(`Health check failed: ${testResponse.status}`);
        }
      } catch (error) {
        console.log(chalk.red(`❌ [MCP Client] Connection failed: ${(error as Error).message}`));
        throw error;
      }
    } else {
      throw new Error('Only HTTP connections are currently supported');
    }
  }

  /**
   * Load capabilities from the MCP server using MCP Streaming HTTP protocol
   */
  private async loadCapabilities(): Promise<void> {
    if (!this.connected || !this.config) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(chalk.cyan(`📋 [MCP Client] Initializing MCP session...`));
      
      // First, initialize the MCP connection with proper protocol
      const initResponse = await fetch(`${this.config.connection.url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'initialize',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              // Client capabilities (none for now)
            },
            clientInfo: {
              name: 'mcp-test-client',
              version: '1.0.0'
            }
          }
        })
      });

      if (!initResponse.ok) {
        throw new Error(`HTTP ${initResponse.status}: ${initResponse.statusText}`);
      }

      // Extract session ID from response headers
      this.sessionId = initResponse.headers.get('mcp-session-id');
      if (!this.sessionId) {
        throw new Error('Server did not provide Mcp-Session-Id header');
      }

      const initData = await initResponse.json() as any;
      console.log(chalk.gray(`   🔗 [MCP Client] Session initialized: ${this.sessionId.substring(0, 8)}...`));
      console.log(chalk.gray(`   📡 [MCP Client] Protocol version: ${initData.result?.protocolVersion || 'unknown'}`));

      // Now get the actual capabilities by calling the specific list endpoints
      console.log(chalk.cyan(`   📋 [MCP Client] Fetching tools, resources, and prompts...`));
      
      const [tools, resources, prompts] = await Promise.all([
        this.listTools(),
        this.listResources(), 
        this.listPrompts()
      ]);

      this.capabilities = {
        tools,
        resources,
        prompts
      };

      console.log(chalk.green(`✅ [MCP Client] Loaded capabilities:`));
      console.log(chalk.gray(`   🔧 Tools: ${this.capabilities.tools.length}`));
      console.log(chalk.gray(`   📚 Resources: ${this.capabilities.resources.length}`));
      console.log(chalk.gray(`   💬 Prompts: ${this.capabilities.prompts.length}`));

    } catch (error) {
      console.log(chalk.red(`❌ [MCP Client] Failed to load capabilities: ${(error as Error).message}`));
      throw error;
    }
  }

  /**
   * Get the loaded capabilities
   */
  getCapabilities(): MCPCapabilities {
    if (!this.capabilities) {
      throw new Error('Capabilities not loaded. Make sure connect() was called successfully.');
    }
    
    console.log(chalk.cyan(`📋 [MCP Client] Returning capabilities to orchestrator:`));
    console.log(chalk.gray(`   🔧 Tools: ${this.capabilities.tools.length} (${this.capabilities.tools.map(t => t.name).join(', ')})`));
    console.log(chalk.gray(`   📚 Resources: ${this.capabilities.resources.length} (${this.capabilities.resources.map(r => r.name).join(', ')})`));
    console.log(chalk.gray(`   💬 Prompts: ${this.capabilities.prompts.length} (${this.capabilities.prompts.map(p => p.name).join(', ')})`));
    
    return this.capabilities;
  }

  private async listTools(): Promise<Array<{name: string, description: string, inputSchema?: any}>> {
    const response = await this.makeRequest('tools/list', {});
    return response.result?.tools || [];
  }

  private async listResources(): Promise<Array<{name: string, description: string, uri: string, mimeType?: string}>> {
    const response = await this.makeRequest('resources/list', {});
    return response.result?.resources || [];
  }

  private async listPrompts(): Promise<Array<{name: string, description?: string, arguments?: Array<{name: string, description?: string, required?: boolean}>}>> {
    const response = await this.makeRequest('prompts/list', {});
    return response.result?.prompts || [];
  }

  private async makeRequest(method: string, params: any): Promise<any> {
    if (!this.connected || !this.config) {
      throw new Error('MCP client not connected');
    }

    if (!this.sessionId && method !== 'initialize') {
      throw new Error('No MCP session established. Session ID is required for all requests except initialize.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Add session ID header for all requests except initialize
    if (this.sessionId && method !== 'initialize') {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const response = await fetch(`${this.config.connection.url}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.capabilities = null;
    this.sessionId = null;
    console.log(chalk.gray(`🔌 [MCP Client] Disconnected and session cleared`));
  }

  async executeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    if (!this.connected || !this.capabilities) {
      throw new Error('MCP client not connected');
    }

    const tool = this.capabilities.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    console.log(chalk.blue(`🔧 [MCP Client] Executing tool: ${toolName}`));
    console.log(chalk.gray(`     📋 Parameters: ${JSON.stringify(parameters)}`));

    try {
      console.log(chalk.gray(`     → [Banking API] Processing ${toolName}...`));
      
      const response = await this.makeRequest('tools/call', {
        name: toolName,
        arguments: parameters
      });

      if (response.error) {
        throw new Error(`Tool execution error: ${response.error.message}`);
      }

      const result = response.result;
      console.log(chalk.green(`✅ [MCP Client] Tool executed successfully`));
      return result;
    } catch (error) {
      console.log(chalk.red(`❌ [MCP Client] Tool execution failed: ${(error as Error).message}`));
      throw error;
    }
  }

  async executePrompt(promptName: string, parameters: Record<string, any>): Promise<any> {
    if (!this.connected || !this.capabilities) {
      throw new Error('MCP client not connected');
    }

    const prompt = this.capabilities.prompts.find(p => p.name === promptName);
    if (!prompt) {
      throw new Error(`Prompt not found: ${promptName}`);
    }

    console.log(chalk.magenta(`💬 [MCP Client] Executing prompt: ${promptName}`));
    console.log(chalk.gray(`     📋 Parameters: ${JSON.stringify(parameters)}`));

    try {
      const response = await this.makeRequest('prompts/get', {
        name: promptName,
        arguments: parameters
      });

      if (response.error) {
        console.log(chalk.yellow(`⚠️  [MCP Client] Simulating prompt response due to error: ${response.error.message}`));
        return this.simulatePromptResponse(promptName, parameters);
      }

      const result = response.result?.messages?.[0]?.content?.text || 'Prompt response received';
      console.log(chalk.green(`✅ [MCP Client] Prompt executed successfully`));
      return result;
    } catch (error) {
      console.log(chalk.yellow(`⚠️  [MCP Client] Simulating prompt response due to error: ${(error as Error).message}`));
      return this.simulatePromptResponse(promptName, parameters);
    }
  }

  async readResource(resourceUri: string, parameters?: Record<string, any>): Promise<any> {
    if (!this.connected || !this.capabilities) {
      throw new Error('MCP client not connected');
    }

    const resource = this.capabilities.resources.find(r => r.uri === resourceUri);
    if (!resource) {
      throw new Error(`Resource not found: ${resourceUri}`);
    }

    // Substitute parameters in resource URI
    let actualUri = resourceUri;
    if (parameters) {
      for (const [key, value] of Object.entries(parameters)) {
        actualUri = actualUri.replace(`{${key}}`, String(value));
      }
    }

    console.log(chalk.cyan(`📚 [MCP Client] Reading resource: ${actualUri}`));

    try {
      console.log(chalk.gray(`     → [MCP Server] Sending resource request...`));
      const response = await this.makeRequest('resources/read', {
        uri: actualUri,
        parameters: parameters
      });

      if (response.error) {
        console.log(chalk.yellow(`⚠️  [MCP Client] Simulating resource response due to error: ${response.error.message}`));
        return this.simulateResourceResponse(resourceUri);
      }

      const result = response.result?.contents?.[0];
      if (result?.text) {
        try {
          const parsedResult = JSON.parse(result.text);
          console.log(chalk.green(`✅ [MCP Client] Resource read successfully`));
          return parsedResult;
        } catch {
          console.log(chalk.green(`✅ [MCP Client] Resource read successfully (text)`));
          return result.text;
        }
      }

      console.log(chalk.green(`✅ [MCP Client] Resource read successfully`));
      return result;
    } catch (error) {
      console.log(chalk.yellow(`⚠️  [MCP Client] Simulating resource response due to error: ${(error as Error).message}`));
      return this.simulateResourceResponse(resourceUri);
    }
  }

  private simulatePromptResponse(promptName: string, parameters: Record<string, any>): string {
    if (promptName === 'fraud_analysis') {
      return 'Based on the payment data provided, this appears to be a legitimate utility payment. The payee "Power Company Australia" is a known utility provider, and the payment amount of $750 is within normal range for utility bills.';
    } else if (promptName === 'loan_recommendation') {
      return 'Based on the account history and current products (Complete Freedom Savings and Business Cheque), I recommend considering our Personal Loan at 6.5% APR for amounts up to $50,000, or our Home Equity Line of Credit at 4.2% APR for larger amounts.';
    }
    return `Analysis complete for ${promptName}. This is a simulated response with parameters: ${JSON.stringify(parameters)}`;
  }

  private simulateResourceResponse(resourceUri: string): any {
    if (resourceUri.includes('products')) {
      return {
        contents: [{
          uri: resourceUri,
          mimeType: 'application/json',
          text: JSON.stringify({
            products: [
              { id: 'SAV_001', name: 'Basic Savings', type: 'savings', rate: 0.5 },
              { id: 'CHK_001', name: 'Premium Checking', type: 'checking', monthlyFee: 15 },
              { id: 'LOAN_001', name: 'Auto Loan', type: 'loan', rate: 4.5 }
            ]
          })
        }]
      };
    }

    return {
      contents: [{
        uri: resourceUri,
        mimeType: 'application/json',
        text: JSON.stringify({ data: `Resource data for ${resourceUri}` })
      }]
    };
  }
} 