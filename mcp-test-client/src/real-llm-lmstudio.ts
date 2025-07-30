import chalk from 'chalk';
import { BaseLLM, LLMResponse, LLMRequest, MCPCapabilities } from './llm-interface.js';
import fetch from 'node-fetch';

/**
 * Real LLM Implementation for LM Studio
 * Connects to a local LLM running via LM Studio on localhost:1234
 */
export class RealLLMLMStudio extends BaseLLM {
  private baseUrl: string;
  private conversationHistory: any[] = [];
  private availableCapabilities: MCPCapabilities | null = null;
  // Track pending function calls to link with results
  private pendingFunctionCalls: Map<string, {
    toolCallId: string;
    functionName: string;
    arguments: any;
    request: LLMRequest;
  }> = new Map();

  constructor(baseUrl: string = 'http://localhost:1234') {
    super();
    this.baseUrl = baseUrl;
  }

  async processUserPrompt(userPrompt: string, capabilities: MCPCapabilities): Promise<LLMResponse> {
    console.log(chalk.blue(`\n🤖 [Real LLM] Processing: "${userPrompt}"`));
    
    this.availableCapabilities = capabilities;
    
    // Initialize conversation with system prompt
    this.conversationHistory = [
      {
        role: 'system',
        content: this.buildSystemPrompt(capabilities)
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];

    // Get LLM's first response
    return await this.getLLMResponse();
  }

  async processResults(results: any[], conversationHistory?: any[]): Promise<LLMResponse> {
    console.log(chalk.blue(`\n🤖 [Real LLM] Processing ${results.length} results from MCP server...`));
    
    // Convert results to proper 'tool' messages linked to function calls
    if (this.pendingFunctionCalls.size === 0) {
      console.log(chalk.yellow(`   ⚠️  [Real LLM] No pending function calls found for ${results.length} results`));
      console.log(chalk.yellow(`   💡 [Real LLM] This may indicate a conversation flow issue`));
      console.log(chalk.yellow(`   🔍 [Real LLM] This could happen if the LLM made calls in a previous round`));
      console.log(chalk.yellow(`   🔧 [Real LLM] Using fallback: adding results as user message`));
      
      // Fallback: Add as user message with better context
      const resultsText = results.map((result, index) => {
        const resultPreview = JSON.stringify(result).substring(0, 200);
        return `Function Result ${index + 1}:\n${resultPreview}${JSON.stringify(result).length > 200 ? '...' : ''}\n\nFull Result ${index + 1}:\n${JSON.stringify(result, null, 2)}`;
      }).join('\n\n---\n\n');
      
      this.conversationHistory.push({
        role: 'user',
        content: `Here are the results from your previous function calls:\n\n${resultsText}\n\nBased on these results, please analyze the data and provide your final conclusion. Do not make the same function calls again unless you need different parameters.`
      });
    } else {
      // Proper linking: Add tool results for each pending function call
      const pendingCalls = Array.from(this.pendingFunctionCalls.values());
      
      for (let i = 0; i < results.length && i < pendingCalls.length; i++) {
        const result = results[i];
        const pendingCall = pendingCalls[i];
        
        console.log(chalk.cyan(`   🔗 [Real LLM] Linking result ${i + 1} to function call: ${pendingCall.functionName}`));
        console.log(chalk.gray(`   📋 [Real LLM] Tool call ID: ${pendingCall.toolCallId}`));
        console.log(chalk.gray(`   📊 [Real LLM] Result preview: ${JSON.stringify(result).substring(0, 100)}...`));
        
        // Add proper tool result message
        this.conversationHistory.push({
          role: 'tool',
          tool_call_id: pendingCall.toolCallId,
          content: JSON.stringify(result, null, 2)
        });
      }
      
      // Clear pending function calls
      this.pendingFunctionCalls.clear();
      console.log(chalk.green(`   ✅ [Real LLM] Linked ${results.length} results to function calls`));
    }

    // Debug: Show current conversation history
    this.debugConversationHistory();
    
    // Get LLM's next response
    return await this.getLLMResponse();
  }

  private debugConversationHistory(): void {
    console.log(chalk.gray(`   📜 [Real LLM] Conversation history (${this.conversationHistory.length} messages):`));
    
    this.conversationHistory.forEach((msg, index) => {
      const role = msg.role;
      const contentPreview = msg.content ? msg.content.substring(0, 80) + '...' : 'No content';
      const toolCallInfo = msg.tool_calls ? ` [${msg.tool_calls.length} tool calls]` : '';
      const toolCallId = msg.tool_call_id ? ` [tool_call_id: ${msg.tool_call_id}]` : '';
      
      console.log(chalk.gray(`     ${index + 1}. ${role.toUpperCase()}${toolCallInfo}${toolCallId}: ${contentPreview}`));
    });
  }

  private async getLLMResponse(): Promise<LLMResponse> {
    try {
      console.log(chalk.gray(`   🧠 [Real LLM] Thinking... (calling LM Studio)`));
      
      // Debug: Show what we're sending to the LLM
      console.log(chalk.gray(`   📤 [Real LLM] Sending ${this.conversationHistory.length} messages to LLM`));
      
      const functions = this.getMCPFunctionDefinitions();
      console.log(chalk.cyan(`   📋 [Real LLM] Available functions: ${functions.length}`));
      
      // Use LM Studio's tool calling format (not OpenAI's functions format)
      const requestBody = {
        model: 'meta-llama-3.1-8b-instruct', // Use your actual model name
        messages: this.conversationHistory,
        temperature: 0.3,
        max_tokens: 800,
        // LM Studio uses 'tools' parameter, not 'functions'
        tools: functions.length > 0 ? functions : undefined
      };

      console.log(chalk.gray(`   📤 [Real LLM] Request includes ${functions.length} function definitions`));

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(chalk.red(`   ❌ [Real LLM] API Error: ${response.status} ${response.statusText}`));
        console.log(chalk.red(`   📄 Error details: ${errorText}`));
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const data = await response.json() as any;
      console.log(chalk.gray(`   📥 [Real LLM] Received response`));
      
      const message = data.choices?.[0]?.message;
      if (!message) {
        console.log(chalk.red(`   ❌ [Real LLM] No message in response`));
        console.log(chalk.gray(`   🐛 Full response: ${JSON.stringify(data, null, 2)}`));
        throw new Error('No message in LM Studio response');
      }

      // Add LLM response to history
      this.conversationHistory.push(message);

      // Debug: Show what the LLM returned
      console.log(chalk.gray(`   🔍 [Real LLM] Message content: ${message.content?.substring(0, 100)}...`));
      console.log(chalk.gray(`   🔍 [Real LLM] Function call: ${message.function_call ? 'YES' : 'NO'}`));
      console.log(chalk.gray(`   🔍 [Real LLM] Tool calls: ${message.tool_calls ? message.tool_calls.length : 'NO'}`));

      // Check if LLM wants to call tools (LM Studio format)
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(chalk.yellow(`   🔧 [Real LLM] Found ${message.tool_calls.length} tool call(s)`));
        
        // Clear any existing pending calls (shouldn't happen but safety first)
        this.pendingFunctionCalls.clear();
        
        const requests: any[] = [];
        for (const toolCall of message.tool_calls) {
          console.log(chalk.cyan(`   🎯 [Real LLM] Tool call: ${toolCall.function.name} (ID: ${toolCall.id})`));
          console.log(chalk.gray(`   📋 [Real LLM] Arguments: ${toolCall.function.arguments}`));
          
          try {
            const request = this.parseLMStudioToolCall(toolCall);
            console.log(chalk.green(`   ✅ [Real LLM] Parsed tool call: ${request.type} - ${request.name || request.uri}`));
            
            // Store function call for later linking with results
            this.pendingFunctionCalls.set(toolCall.id, {
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              arguments: typeof toolCall.function.arguments === 'string' 
                ? JSON.parse(toolCall.function.arguments) 
                : toolCall.function.arguments,
              request: request
            });
            
            console.log(chalk.gray(`   🔗 [Real LLM] Stored function call for result linking: ${toolCall.id}`));
            requests.push(request);
          } catch (error) {
            console.log(chalk.red(`   ❌ [Real LLM] Error parsing tool call: ${error}`));
            console.log(chalk.gray(`   🐛 Tool call data: ${JSON.stringify(toolCall, null, 2)}`));
          }
        }
        
        if (requests.length > 0) {
          console.log(chalk.green(`   📦 [Real LLM] Stored ${this.pendingFunctionCalls.size} function calls for result linking`));
          return {
            requests: requests,
            needsMoreData: true
          };
        }
      }

      // If no function calls, check if LLM is trying to describe actions instead of calling functions
      const content = message.content || '';
      if (content.includes('fetch') || content.includes('retrieve') || content.includes('call') || content.includes('execute')) {
        console.log(chalk.yellow(`   ⚠️  [Real LLM] LLM is describing actions instead of calling functions!`));
        console.log(chalk.yellow(`   💡 [Real LLM] This suggests the model may not support function calling properly`));
        
        // Try to extract what the LLM wanted to do and suggest a function call
        const suggestedFunction = this.suggestFunctionFromContent(content);
        if (suggestedFunction) {
          console.log(chalk.cyan(`   🔧 [Real LLM] Suggesting function call: ${suggestedFunction.name || suggestedFunction.uri}`));
          return {
            requests: [suggestedFunction],
            needsMoreData: true
          };
        }
      }

      // LLM is done, return final response
      console.log(chalk.green(`\n✨ [Real LLM] Final Response:`));
      console.log(chalk.white(content));
      
      return {
        content: content,
        needsMoreData: false
      };

    } catch (error) {
      console.log(chalk.red(`   ❌ [Real LLM] Error: ${error}`));
      return {
        content: `Sorry, I encountered an error connecting to the LLM: ${error}`,
        needsMoreData: false
      };
    }
  }

  private suggestFunctionFromContent(content: string): LLMRequest | null {
    // Try to extract what the LLM wanted to do from its text
    if (content.includes('product') && (content.includes('SAV001ABC') || content.includes('CHQ002XYZ'))) {
      // LLM wants to fetch product info
      if (content.includes('SAV001ABC')) {
        return {
          type: 'tool',
          name: 'banking-products_get__v1_banking_products_{productId}',
          parameters: { productId: 'SAV001ABC' },
          reasoning: 'Extracted from LLM text response'
        };
      }
    }
    
    if (content.includes('loan_recommendation')) {
      return {
        type: 'prompt',
        name: 'loan_recommendation',
        parameters: { 
          account_number: '1234567890',
          product_ids: ['SAV001ABC', 'CHQ002XYZ']
        },
        reasoning: 'Extracted from LLM text response'
      };
    }

    if (content.includes('all products') || content.includes('product list')) {
      return {
        type: 'resource',
        uri: 'banking-products://v1/banking/products',
        parameters: { accountId: '1234567890' },
        reasoning: 'Extracted from LLM text response'
      };
    }

    return null;
  }

  private buildSystemPrompt(capabilities: MCPCapabilities): string {
    return `You are an AI assistant with access to Model Context Protocol (MCP) capabilities.

CRITICAL: You MUST call functions to get data. Do not describe what you would do - actually call the functions!

AVAILABLE MCP CAPABILITIES:

TOOLS (for actions with side effects):
${capabilities.tools.map((t: any) => `- ${t.name}: ${t.description}`).join('\n')}

RESOURCES (for read-only data):
${capabilities.resources.map((r: any) => `- ${r.name}: ${r.description}`).join('\n')}

PROMPTS (for specialized analysis):
${capabilities.prompts.map((p: any) => `- ${p.name}: ${p.description || 'Analysis prompt'}`).join('\n')}

FUNCTION CALLING INSTRUCTIONS:
1. When you need data, immediately call the appropriate function
2. Do NOT describe what you will do - just call the function
3. Use tools for actions (POST, PUT, DELETE operations)  
4. Use resources for read-only queries (GET operations)
5. Use prompts for specialized analysis after collecting data
6. Call functions one at a time and wait for results
7. ALWAYS provide required parameters as specified in function definitions

SAMPLE DATA AVAILABLE:
- Various identifiers and data points as defined in the API specifications
- Use the available functions to discover and access data

EXAMPLES:
- To get data: Call resource functions with all required parameters as specified
- For analysis: First collect data using resources, then call analysis prompts`;
  }

  private getMCPFunctionDefinitions() {
    if (!this.availableCapabilities) return [];

    const tools = [];
    
    // Convert tools to LM Studio tool format
    for (const tool of this.availableCapabilities.tools) {
      tools.push({
        type: "function",
        function: {
          name: tool.name,
          description: `Execute tool: ${tool.description}`,
          parameters: tool.inputSchema || {
            type: 'object',
            properties: {},
            required: []
          }
        }
      });
    }
    
    // Convert resources to LM Studio tool format  
    for (const resource of this.availableCapabilities.resources) {
      const functionDef: any = {
        type: "function",
        function: {
          name: `resource_${resource.name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
          description: `Read resource: ${resource.description}`,
          parameters: {
            type: 'object',
            properties: {
              uri: { 
                type: 'string', 
                description: `Resource URI (default: ${resource.uri})`,
                default: resource.uri
              }
            },
            required: []
          }
        }
      };

      // Add parameters from resource schema (extracted from OpenAPI spec)
      if ((resource as any).parameters) {
        for (const param of (resource as any).parameters) {
          functionDef.function.parameters.properties[param.name] = {
            ...param.schema,
            description: param.description || `${param.name} parameter`
          };
          if (param.required) {
            functionDef.function.parameters.required.push(param.name);
          }
        }
      }

      tools.push(functionDef);
    }
    
    // Convert prompts to LM Studio tool format
    for (const prompt of this.availableCapabilities.prompts) {
      const functionDef: any = {
        type: "function",
        function: {
          name: `prompt_${prompt.name}`,
          description: `Execute analysis prompt: ${prompt.description || 'Analysis prompt'}`,
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      };

      // Use server-provided arguments (generic for any MCP server)
      if ((prompt as any).arguments && Array.isArray((prompt as any).arguments)) {
        for (const arg of (prompt as any).arguments) {
          functionDef.function.parameters.properties[arg.name] = {
            type: 'string',  // Could be enhanced to use arg.schema if provided
            description: arg.description || `${arg.name} parameter`
          };
          
          if (arg.required) {
            functionDef.function.parameters.required.push(arg.name);
          }
        }
      }

      // Fallback if no arguments provided by server
      if (Object.keys(functionDef.function.parameters.properties).length === 0) {
        functionDef.function.parameters.properties.parameters = {
          type: 'object',
          description: 'Analysis parameters',
          properties: {}
        };
        functionDef.function.parameters.required.push('parameters');
      }

      tools.push(functionDef);
    }
    
    return tools;
  }

  private parseLMStudioToolCall(toolCall: any): LLMRequest {
    const functionName = toolCall.function.name;
    let args: any = {};
    
    try {
      if (typeof toolCall.function.arguments === 'string') {
        args = JSON.parse(toolCall.function.arguments);
      } else {
        args = toolCall.function.arguments || {};
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ [Real LLM] Error parsing tool arguments: ${error}`));
      args = {};
    }

    console.log(chalk.gray(`   🔧 [Real LLM] Parsing tool: ${functionName} with args: ${JSON.stringify(args)}`));

    // Determine the type and create appropriate request
    if (functionName.startsWith('resource_')) {
      // Find the matching resource to get the URI
      const resourceName = functionName.replace('resource_', '').replace(/_/g, ' ');
      const resource = this.availableCapabilities?.resources.find(r => 
        r.name.toLowerCase().includes(resourceName.toLowerCase()) ||
        resourceName.includes(r.name.toLowerCase())
      );
      
      // Extract all parameters from args (both top-level and nested)
      const resourceParameters: Record<string, any> = {};
      
      // Extract all args except 'uri' and 'parameters' as potential resource parameters
      for (const [key, value] of Object.entries(args)) {
        if (key !== 'uri' && key !== 'parameters' && value !== undefined) {
          resourceParameters[key] = value;
        }
      }
      
      // Also include any nested parameters object
      const allParameters = { ...resourceParameters, ...args.parameters };
      
      return {
        type: 'resource',
        uri: args.uri || resource?.uri || '',
        parameters: allParameters,
        reasoning: 'LM Studio tool call'
      };
    } else if (functionName.startsWith('prompt_')) {
      const promptName = functionName.replace('prompt_', '');
      return {
        type: 'prompt', 
        name: args.name || promptName,
        parameters: args.parameters || args,
        reasoning: 'LM Studio tool call'
      };
    } else {
      // Direct tool name match
      return {
        type: 'tool',
        name: functionName,
        parameters: args,
        reasoning: 'LM Studio tool call'
      };
    }
  }
} 