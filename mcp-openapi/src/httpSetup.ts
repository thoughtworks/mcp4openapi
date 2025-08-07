import express from 'express';
import { MCPTool, MCPResource, PromptSpec, OpenAPISpec } from './types.js';
import { Telemetry } from './telemetry.js';
import { PACKAGE_VERSION } from './package-info.js';

export interface HttpSetupContext {
  app: express.Application;
  specs: Map<string, OpenAPISpec>;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: Map<string, PromptSpec>;
  telemetry: Telemetry;
  executeTool: (toolName: string, args: any, userContext?: { token?: string }) => Promise<any>;
  readResource: (uri: string, userContext?: { token?: string }, resourceParams?: Record<string, any>) => Promise<any>;
  getPrompt: (promptName: string, args: any) => Promise<any>;
  extractUserContext: (request?: any) => { token?: string };
}

export class HttpSetup {
  private context: HttpSetupContext;

  constructor(context: HttpSetupContext) {
    this.context = context;
  }

  setupRoutes(): void {
    this.setupMcpRoute();
    this.setupHealthRoute();
    this.setupInfoRoute();
  }

  private setupMcpRoute(): void {
    this.context.app.post('/mcp', async (req, res) => {
      try {
        // Extract user context from request
        const userContext = this.context.extractUserContext(req);
        
        // Handle JSON-RPC 2.0 method calls
        const { method, params, id } = req.body;
        
        this.context.telemetry.debug(`MCP method call: ${method}`);
        
        let result;
        
        switch (method) {
          case 'initialize':
            result = {
              message: "MCP server running",
              authMode: userContext.token ? "user-token" : "service-token",
              capabilities: {
                tools: { listChanged: true },
                resources: { listChanged: true, subscribe: false },
                prompts: { listChanged: true }
              }
            };
            break;
            
          case 'tools/list':
            result = {
              tools: this.context.tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
              }))
            };
            break;
            
          case 'resources/list':
            result = {
              resources: this.context.resources.map(resource => ({
                uri: resource.uri,
                name: resource.name,
                description: resource.description,
                mimeType: resource.mimeType,
                parameters: resource.parameters
              }))
            };
            break;
            
          case 'prompts/list':
            result = {
              prompts: Array.from(this.context.prompts.entries()).map(([name, spec]) => ({
                name: name,
                description: spec.description || `${name} prompt template`,
                arguments: spec.arguments || []
              }))
            };
            break;
            
          case 'tools/call':
            const toolName = params?.name;
            const toolArgs = params?.arguments || {};
            if (!toolName) {
              throw new Error('Tool name is required');
            }
            result = await this.context.executeTool(toolName, toolArgs, userContext);
            break;
            
          case 'resources/read':
            const resourceUri = params?.uri;
            if (!resourceUri) {
              throw new Error('Resource URI is required');
            }
            const resourceParams = params?.parameters || {};
            
            result = await this.context.readResource(resourceUri, userContext, resourceParams);
            break;
            
          case 'prompts/get':
            const promptName = params?.name;
            const promptArgs = params?.arguments || {};
            if (!promptName) {
              throw new Error('Prompt name is required');
            }
            result = await this.context.getPrompt(promptName, promptArgs);
            break;
            
          default:
            throw new Error(`Unknown method: ${method}`);
        }
        
        res.json({ 
          jsonrpc: "2.0", 
          result,
          id
        });
      } catch (error) {
        res.status(500).json({ 
          jsonrpc: "2.0",
          error: { code: -32603, message: (error as Error).message },
          id: req.body.id 
        });
      }
    });
  }

  private setupHealthRoute(): void {
    this.context.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        specs: Array.from(this.context.specs.keys()),
        tools: this.context.tools.length,
        resources: this.context.resources.length,
        prompts: this.context.prompts.size,
        version: PACKAGE_VERSION
      });
    });
  }

  private setupInfoRoute(): void {
    this.context.app.get('/info', (req, res) => {
      res.json({
        specs: Array.from(this.context.specs.entries()).map(([id, spec]) => ({
          id,
          title: spec.info.title,
          version: spec.info.version
        })),
        tools: this.context.tools.map(t => ({ name: t.name, description: t.description })),
        resources: this.context.resources.map(r => ({ uri: r.uri, name: r.name })),
        prompts: Array.from(this.context.prompts.keys())
      });
    });
  }

  startServer(port: number): Promise<void> {
    return new Promise((resolve) => {
      const server = this.context.app.listen(port, () => {
        // HTTP server startup - use info level
        const address = server.address();
        const host = typeof address === 'object' && address ? 
          (address.family === 'IPv6' ? `[${address.address}]` : address.address) : 
          'localhost';
        
        this.context.telemetry.info(`🚀 MCP OpenAPI Server running on port ${port}`);
        this.context.telemetry.info(`📊 Health check: http://${host}:${port}/health`);
        this.context.telemetry.info(`ℹ️  Server info: http://${host}:${port}/info`);
        
        this.context.telemetry.debug(`📋 Loaded ${this.context.specs.size} specs, ${this.context.tools.length} tools, ${this.context.resources.length} resources, ${this.context.prompts.size} prompts`);
        
        resolve();
      });
    });
  }
}
