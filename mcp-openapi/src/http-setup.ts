import express from 'express';
import https from 'https';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { MCPTool, MCPResource, PromptSpec, OpenAPISpec, ServerOptions } from './types.js';
import { Telemetry } from './telemetry.js';
import { PACKAGE_VERSION } from './package-info.js';

export interface HttpSetupContext {
  app: express.Application;
  specs: Map<string, OpenAPISpec>;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: Map<string, PromptSpec>;
  telemetry: Telemetry;
  options: ServerOptions;
  executeTool: (toolName: string, args: any, userContext?: { token?: string }) => Promise<any>;
  readResource: (uri: string, userContext?: { token?: string }, resourceParams?: Record<string, any>) => Promise<any>;
  getPrompt: (promptName: string, args: any) => Promise<any>;
  extractUserContext: (request?: any) => { token?: string };
}

// MCP Session interface for future SSE implementation
interface MCPSession {
  sessionId: string;
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities: any;
  createdAt: Date;
  lastActivity: Date;
  userContext: { token?: string };
  // SSE connection will be added here in future
  // sseConnection?: express.Response;
}

export class HttpSetup {
  private context: HttpSetupContext;
  private sessions: Map<string, MCPSession> = new Map();
  private sessionCleanupInterval: NodeJS.Timeout;

  constructor(context: HttpSetupContext) {
    this.context = context;
    
    // Clean up expired sessions every 5 minutes
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  setupRoutes(): void {
    this.setupMcpStreamingRoute();
    this.setupHealthRoute();
    this.setupInfoRoute();
  }

  // Clean up expired sessions (older than 30 minutes)
  private cleanupExpiredSessions(): void {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < thirtyMinutesAgo) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.context.telemetry.debug(`🧹 Cleaned up ${cleanedCount} expired MCP sessions`);
    }
  }

  // Generate a new session ID
  private generateSessionId(): string {
    return randomUUID();
  }

  // Create a new MCP session
  private createSession(clientInfo: any, userContext: { token?: string }): MCPSession {
    const sessionId = this.generateSessionId();
    const session: MCPSession = {
      sessionId,
      clientInfo: clientInfo || { name: 'unknown', version: '1.0.0' },
      capabilities: {},
      createdAt: new Date(),
      lastActivity: new Date(),
      userContext
    };
    
    this.sessions.set(sessionId, session);
    this.context.telemetry.debug(`🆕 Created MCP session: ${sessionId}`);
    return session;
  }

  // Validate and update session activity
  private validateSession(sessionId: string): MCPSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    // Update last activity
    session.lastActivity = new Date();
    return session;
  }

  // Extract session ID from request headers
  private extractSessionId(req: express.Request): string | null {
    return req.headers['mcp-session-id'] as string || null;
  }

  // MCP Streaming HTTP Protocol implementation (without SSE for now)
  private setupMcpStreamingRoute(): void {
    // Handle POST requests (client-to-server messages)
    this.context.app.post('/mcp', async (req, res) => {
      try {
        // Extract user context from request
        const userContext = this.context.extractUserContext(req);
        
        // Handle JSON-RPC 2.0 method calls
        const { method, params, id } = req.body;
        
        this.context.telemetry.debug(`MCP method call: ${method}`);
        
        let result;
        let session: MCPSession | null = null;
        
        // Extract session ID from headers (except for initialize)
        const sessionId = this.extractSessionId(req);
        
        if (method !== 'initialize') {
          if (!sessionId) {
            return res.status(400).json({
              jsonrpc: "2.0",
              error: { code: -32602, message: "Missing Mcp-Session-Id header. Call initialize first." },
              id
            });
          }
          
          session = this.validateSession(sessionId);
          if (!session) {
            return res.status(401).json({
              jsonrpc: "2.0",
              error: { code: -32603, message: "Invalid or expired session. Please reinitialize." },
              id
            });
          }
        }
        
        switch (method) {
          case 'initialize':
            // Create new session for initialize
            const clientInfo = params?.clientInfo || { name: 'unknown', version: '1.0.0' };
            session = this.createSession(clientInfo, userContext);
            
            result = {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: { listChanged: true },
                resources: { listChanged: true, subscribe: false },
                prompts: { listChanged: true }
              },
              serverInfo: {
                name: "mcp-openapi",
                version: PACKAGE_VERSION
              }
            };
            
            // Set session ID in response headers
            res.setHeader('Mcp-Session-Id', session.sessionId);
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
            result = await this.context.executeTool(toolName, toolArgs, session!.userContext);
            break;
            
          case 'resources/read':
            const resourceUri = params?.uri;
            if (!resourceUri) {
              throw new Error('Resource URI is required');
            }
            const resourceParams = params?.parameters || {};
            
            result = await this.context.readResource(resourceUri, session!.userContext, resourceParams);
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

    // Handle GET requests (for future SSE implementation)
    this.context.app.get('/mcp', (req, res) => {
      const sessionId = this.extractSessionId(req);
      
      if (!sessionId) {
        return res.status(400).json({
          error: "Missing Mcp-Session-Id header"
        });
      }
      
      const session = this.validateSession(sessionId);
      if (!session) {
        return res.status(401).json({
          error: "Invalid or expired session"
        });
      }
      
      // TODO: Implement SSE streaming in the future
      // For now, just return a message indicating SSE is not yet implemented
      res.json({
        message: "SSE streaming not yet implemented",
        sessionId: sessionId,
        note: "This endpoint will support Server-Sent Events in a future update"
      });
      
      this.context.telemetry.debug(`📡 SSE stream requested for session ${sessionId} (not implemented yet)`);
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
        sessions: this.sessions.size,
        version: PACKAGE_VERSION,
        protocol: 'MCP Streaming HTTP (SSE placeholder)'
      });
    });
  }

  // Cleanup method to be called when server shuts down
  cleanup(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }
    this.sessions.clear();
    this.context.telemetry.debug('🧹 HttpSetup cleanup completed');
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

  startServer(port?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const { options } = this.context;
      
      // Determine if HTTPS is enabled and which port to use
      const useHttps = options.https;
      const serverPort = useHttps ? 
        (options.httpsPort || 4443) : 
        (port || options.port || 4000);
      
      if (useHttps) {
        // HTTPS server setup
        const httpsOptions = this.createHttpsOptions();
        if (!httpsOptions) {
          reject(new Error('HTTPS enabled but no valid certificate configuration provided'));
          return;
        }
        
        const server = https.createServer(httpsOptions, this.context.app);
        server.listen(serverPort, () => {
          const address = server.address();
          const host = typeof address === 'object' && address ? 
            (address.family === 'IPv6' ? `[${address.address}]` : address.address) : 
            'localhost';
          
          this.context.telemetry.info(`🔒 MCP OpenAPI HTTPS Server running on port ${serverPort}`);
          this.context.telemetry.info(`📊 Health check: https://${host}:${serverPort}/health`);
          this.context.telemetry.info(`ℹ️  Server info: https://${host}:${serverPort}/info`);
          
          this.context.telemetry.debug(`📋 Loaded ${this.context.specs.size} specs, ${this.context.tools.length} tools, ${this.context.resources.length} resources, ${this.context.prompts.size} prompts`);
          
          resolve();
        });
        
        server.on('error', (error) => {
          reject(error);
        });
      } else {
        // HTTP server setup (default)
        const server = this.context.app.listen(serverPort, () => {
          const address = server.address();
          const host = typeof address === 'object' && address ? 
            (address.family === 'IPv6' ? `[${address.address}]` : address.address) : 
            'localhost';
          
          this.context.telemetry.info(`🚀 MCP OpenAPI Server running on port ${serverPort}`);
          this.context.telemetry.info(`📊 Health check: http://${host}:${serverPort}/health`);
          this.context.telemetry.info(`ℹ️  Server info: http://${host}:${serverPort}/info`);
          
          this.context.telemetry.debug(`📋 Loaded ${this.context.specs.size} specs, ${this.context.tools.length} tools, ${this.context.resources.length} resources, ${this.context.prompts.size} prompts`);
          
          resolve();
        });
        
        server.on('error', (error) => {
          reject(error);
        });
      }
    });
  }

  private createHttpsOptions(): https.ServerOptions | null {
    const { options } = this.context;
    
    try {
      // Option 1: PFX/PKCS12 file
      if (options.pfxFile) {
        if (!fs.existsSync(options.pfxFile)) {
          this.context.telemetry.warn(`⚠️  PFX file not found: ${options.pfxFile}`);
          return null;
        }
        
        const pfx = fs.readFileSync(options.pfxFile);
        return {
          pfx,
          ...(options.passphrase && { passphrase: options.passphrase })
        };
      }
      
      // Option 2: Separate key and certificate files
      if (options.keyFile && options.certFile) {
        if (!fs.existsSync(options.keyFile)) {
          this.context.telemetry.warn(`⚠️  Private key file not found: ${options.keyFile}`);
          return null;
        }
        
        if (!fs.existsSync(options.certFile)) {
          this.context.telemetry.warn(`⚠️  Certificate file not found: ${options.certFile}`);
          return null;
        }
        
        const key = fs.readFileSync(options.keyFile);
        const cert = fs.readFileSync(options.certFile);
        
        return {
          key,
          cert,
          ...(options.passphrase && { passphrase: options.passphrase })
        };
      }
      
      this.context.telemetry.warn('⚠️  HTTPS enabled but no certificate files provided. Use --key-file and --cert-file, or --pfx-file');
      return null;
    } catch (error) {
      this.context.telemetry.warn(`⚠️  Error reading HTTPS certificate files: ${(error as Error).message}`);
      return null;
    }
  }
}
