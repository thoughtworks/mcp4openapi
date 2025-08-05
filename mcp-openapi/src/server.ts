import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  InitializedNotificationSchema
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  OpenAPISpec,
  ServerConfig,
  PromptSpec,
  MCPTool,
  MCPResource,
  ServerOptions
} from './types.js';

export class MCPOpenAPIServer {
  private server: Server;
  private app: express.Application;
  private specs: Map<string, OpenAPISpec> = new Map();
  private specFiles: Map<string, string> = new Map(); // Map specId to original filename
  private config: ServerConfig = { overrides: [] };
  private prompts: Map<string, PromptSpec> = new Map();
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private options: ServerOptions;
  private isStdioMode = false; // Track if running in stdio mode

  // Proper logging using MCP protocol for stdio mode, console for HTTP mode
  private debug(message: string): void {
    if (this.options.verbose) {
      if (this.isStdioMode && this.server) {
        // Send debug messages through MCP logging notification
        this.server.notification({
          method: 'notifications/message',
          params: {
            level: 'debug',
            logger: 'mcp-openapi-server',
            data: message
          }
        }).catch(() => {
          // Fallback to stderr if notification fails
          process.stderr.write(`[DEBUG] ${message}\n`);
        });
      } else if (!this.isStdioMode) {
        // HTTP mode - use console
        console.debug(`[DEBUG] ${message}`);
      }
    }
  }

  private info(message: string): void {
    if (this.options.verbose) {
      if (this.isStdioMode && this.server) {
        // Send info messages through MCP logging notification
        this.server.notification({
          method: 'notifications/message',
          params: {
            level: 'info',
            logger: 'mcp-openapi-server',
            data: message
          }
        }).catch(() => {
          // Fallback to stderr if notification fails
          process.stderr.write(`[INFO] ${message}\n`);
        });
      } else if (!this.isStdioMode) {
        // HTTP mode - use console
        console.info(`[INFO] ${message}`);
      }
    }
  }

  private warn(message: string): void {
    if (this.isStdioMode && this.server) {
      // Send warnings through MCP logging notification
      this.server.notification({
        method: 'notifications/message',
        params: {
          level: 'warning',
          logger: 'mcp-openapi-server',
          data: message
        }
      }).catch(() => {
        // Fallback to stderr if notification fails
        process.stderr.write(`[WARN] ${message}\n`);
      });
    } else if (!this.isStdioMode) {
      // HTTP mode - use console
      console.warn(`[WARN] ${message}`);
    }
  }

  private error(message: string): void {
    if (this.isStdioMode && this.server) {
      // Send errors through MCP logging notification
      this.server.notification({
        method: 'notifications/message',
        params: {
          level: 'error',
          logger: 'mcp-openapi-server',
          data: message
        }
      }).catch(() => {
        // Fallback to stderr if notification fails
        process.stderr.write(`[ERROR] ${message}\n`);
      });
    } else if (!this.isStdioMode) {
      // HTTP mode - use console
      console.error(`[ERROR] ${message}`);
    }
  }

  constructor(options: ServerOptions = {}) {
    this.options = {
      specsDir: './examples/specs',
      configFile: './examples/mcp-config.json',
      promptsDir: './examples/prompts',
      port: 4000,
      verbose: true,
      ...options
    };

    // Convert all paths to absolute paths to ensure they work regardless of cwd
    this.options.specsDir = path.resolve(this.options.specsDir!);
    this.options.configFile = path.resolve(this.options.configFile!);
    this.options.promptsDir = path.resolve(this.options.promptsDir!);

    this.server = new Server(
      { name: "mcp-openapi-server", version: "1.0.0" },
      { 
        capabilities: { 
          tools: {},
          resources: {},
          prompts: {}
        } 
      }
    );
    
    this.app = express();
    this.setupExpress();
  }

  private setupExpress() {
    const corsOptions = this.config.cors || {};
    this.app.use(cors(corsOptions));
    this.app.use(express.json());
  }

  async initialize(): Promise<void> {
    this.debug('🚀 Initializing MCP OpenAPI Server...');

    await this.loadConfig();
    await this.loadOpenAPISpecs();
    await this.loadPrompts();
    await this.generateMCPItems();

    // Log which base URL is being used
    const baseUrl = this.options.baseUrl || this.config.baseUrl || 'http://localhost:3001';
    const source = this.options.baseUrl ? 'CLI --base-url' : 
                   this.config.baseUrl ? 'config file' : 'default';
    this.debug(`🌐 Using base URL: ${baseUrl} (from ${source})`);

    this.debug(`✅ Loaded ${this.specs.size} specs, ${this.tools.length} tools, ${this.resources.length} resources, ${this.prompts.size} prompts`);
  }

  private async loadConfig(): Promise<void> {
    try {
      if (fs.existsSync(this.options.configFile!)) {
        const configContent = fs.readFileSync(this.options.configFile!, 'utf8');
        this.config = { ...this.config, ...JSON.parse(configContent) };
        
        this.debug(`📄 Loaded config from ${this.options.configFile}`);
      }
    } catch (error) {
      this.warn(`⚠️  Could not load config file: ${(error as Error).message}`);
    }
  }

  private async loadOpenAPISpecs(): Promise<void> {
    if (!fs.existsSync(this.options.specsDir!)) {
      this.warn(`⚠️  Specs directory ${this.options.specsDir} does not exist`);
      return;
    }

    const files = fs.readdirSync(this.options.specsDir!);
    
    for (const file of files) {
      if (this.isSpecFile(file)) {
        try {
          const filePath = path.join(this.options.specsDir!, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          const spec: OpenAPISpec = file.endsWith('.json') 
            ? JSON.parse(content)
            : yaml.load(content) as OpenAPISpec;

          const specId = spec.info['x-spec-id'] || path.basename(file, path.extname(file));
          this.specs.set(specId, spec);
          this.specFiles.set(specId, file); // Store original filename
          
          this.debug(`📋 Loaded OpenAPI spec: ${specId} (from ${file})`);
        } catch (error) {
          this.error(`❌ Error loading spec ${file}: ${(error as Error).message}`);
        }
      }
    }
  }

  private async loadPrompts(): Promise<void> {
    if (!fs.existsSync(this.options.promptsDir!)) {
      this.debug(`📁 Prompts directory ${this.options.promptsDir} does not exist, skipping prompts`);
      return;
    }

    const files = fs.readdirSync(this.options.promptsDir!);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(this.options.promptsDir!, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const promptSpec: PromptSpec = JSON.parse(content);
          
          this.prompts.set(promptSpec.name, promptSpec);
          
          this.debug(`💬 Loaded prompt: ${promptSpec.name}`);
        } catch (error) {
          this.error(`❌ Error loading prompt ${file}: ${(error as Error).message}`);
        }
      }
    }
  }

  private async generateMCPItems(): Promise<void> {
    this.tools = [];
    this.resources = [];

    for (const [specId, spec] of this.specs) {
      for (const [pathPattern, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (this.isHttpMethod(method)) {
            const mcpType = this.determineMCPType(specId, pathPattern, method, operation);
            
            if (mcpType === 'tool') {
              this.tools.push(this.createTool(specId, pathPattern, method, operation));
            } else if (mcpType === 'resource') {
              this.resources.push(this.createResource(specId, pathPattern, method, operation));
            }
          }
        }
      }
    }

    // Add server info resource for querying capabilities
    this.addServerInfoResource();

    // DEBUG: Show detailed MCP capabilities generated from OpenAPI specs
    this.printMCPCapabilitiesDebug();
  }

  private addServerInfoResource(): void {
    // Add a special resource for getting server information
    this.resources.push({
      uri: 'mcp-openapi://server/info',
      name: 'MCP OpenAPI Server Information',
      description: 'Detailed information about loaded OpenAPI specs, tools, resources, and prompts',
      mimeType: 'application/json',
      parameters: []
    });
  }

  private async getServerInfo() {
    // Generate the same detailed information that was in the debug logs
    const serverInfo = {
      summary: {
        totalSpecs: this.specs.size,
        totalTools: this.tools.length,
        totalResources: this.resources.length - 1, // Exclude the server info resource itself
        totalPrompts: this.prompts.size,
        overriddenItems: this.config.overrides.length
      },
      specs: [] as any[],
      prompts: Array.from(this.prompts.entries()).map(([name, spec]) => ({
        name,
        description: spec.description,
        arguments: spec.arguments
      }))
    };

    // Build detailed breakdown by spec
    for (const [specId, spec] of this.specs) {
      const specFile = this.getSpecFileName(specId);
      const specInfo = {
        specId,
        specFile,
        title: spec.info.title,
        version: spec.info.version,
        items: [] as any[]
      };

      for (const [pathPattern, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (this.isHttpMethod(method)) {
            const mcpType = this.determineMCPType(specId, pathPattern, method, operation);
            const isOverridden = this.hasOverride(specId, pathPattern, method);
            
            let mcpName: string;
            let description: string;
            
            if (mcpType === 'tool') {
              const tool = this.tools.find(t => t.name === this.getToolName(specId, pathPattern, method, operation));
              mcpName = tool?.name || 'Unknown';
              description = tool?.description || 'No description';
            } else {
              const resource = this.resources.find(r => r.uri === `${specId}://${pathPattern.startsWith('/') ? pathPattern.substring(1) : pathPattern}`);
              mcpName = resource?.name || 'Unknown';
              description = resource?.description || 'No description';
            }

            specInfo.items.push({
              path: pathPattern,
              method: method.toUpperCase(),
              mcpType,
              mcpName,
              description,
              isOverridden
            });
          }
        }
      }

      serverInfo.specs.push(specInfo);
    }

    return {
      contents: [{
        uri: 'mcp-openapi://server/info',
        mimeType: "application/json",
        text: JSON.stringify(serverInfo, null, 2)
      }]
    };
  }

  private printMCPCapabilitiesDebug(): void {
    if (!this.options.verbose) {
      return;
    }

    // Show detailed capability listing for both stdio and HTTP modes
    this.info('\n📋 MCP OpenAPI Server - Loaded Capabilities:');
    this.info('=' .repeat(80));

    // Create a detailed mapping of what was generated
    const generationDetails: Array<{
      specId: string;
      specFile: string;
      path: string;
      method: string;
      mcpType: 'tool' | 'resource' | 'prompt';
      mcpName: string;
      description: string;
      isOverridden: boolean;
    }> = [];

    // Collect tool details
    for (const [specId, spec] of this.specs) {
      const specFile = this.getSpecFileName(specId);
      
      for (const [pathPattern, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (this.isHttpMethod(method)) {
            const mcpType = this.determineMCPType(specId, pathPattern, method, operation);
            
            if (mcpType === 'tool') {
              const tool = this.tools.find(t => t.name === this.getToolName(specId, pathPattern, method, operation));
              if (tool) {
                generationDetails.push({
                  specId,
                  specFile,
                  path: pathPattern,
                  method: method.toUpperCase(),
                  mcpType: 'tool',
                  mcpName: tool.name,
                  description: tool.description,
                  isOverridden: this.hasOverride(specId, pathPattern, method)
                });
              }
            } else if (mcpType === 'resource') {
              const resource = this.resources.find(r => r.uri === `${specId}://${pathPattern.startsWith('/') ? pathPattern.substring(1) : pathPattern}`);
              if (resource) {
                generationDetails.push({
                  specId,
                  specFile,
                  path: pathPattern,
                  method: method.toUpperCase(),
                  mcpType: 'resource',
                  mcpName: resource.name,
                  description: resource.description,
                  isOverridden: this.hasOverride(specId, pathPattern, method)
                });
              }
            }
          }
        }
      }
    }

    // Add prompt details
    for (const [name, spec] of this.prompts) {
      generationDetails.push({
        specId: 'prompts',
        specFile: 'prompt files',
        path: 'N/A',
        method: 'N/A',
        mcpType: 'prompt',
        mcpName: name,
        description: spec.description || 'No description',
        isOverridden: false // Prompts don't have overrides
      });
    }

    // Print summary
    const toolCount = generationDetails.filter(d => d.mcpType === 'tool').length;
    const resourceCount = generationDetails.filter(d => d.mcpType === 'resource').length;
    const promptCount = generationDetails.filter(d => d.mcpType === 'prompt').length;
    const overriddenCount = generationDetails.filter(d => d.isOverridden).length;

    const overrideSummary = overriddenCount > 0 ? ` (${overriddenCount} overridden)` : '';
    this.info(`\n📊 LOADED: ${toolCount} tools, ${resourceCount} resources, ${promptCount} prompts from ${this.specs.size} OpenAPI specs${overrideSummary}\n`);

    // Print detailed breakdown
    this.info('📋 BREAKDOWN BY SPEC:');
    this.info('├─ Spec File & Path                           │ Method │ MCP Type  │ MCP Name');
    this.info('├─────────────────────────────────────────────┼────────┼───────────┼─────────────────────');

    // Group by spec file for better readability
    const groupedDetails = new Map<string, typeof generationDetails>();
    generationDetails.forEach(detail => {
      const key = detail.specFile;
      if (!groupedDetails.has(key)) {
        groupedDetails.set(key, []);
      }
      groupedDetails.get(key)!.push(detail);
    });

    let isFirstGroup = true;
    for (const [specFile, details] of Array.from(groupedDetails.entries()).sort()) {
      // Add spacing between spec file groups (except first)
      if (!isFirstGroup) {
        this.info('├─────────────────────────────────────────────┼────────┼───────────┼─────────────────────');
      }
      isFirstGroup = false;

      // Sort paths within each spec file
      const sortedDetails = details.sort((a, b) => a.path.localeCompare(b.path));
      
      sortedDetails.forEach((detail, index) => {
        const isFirstInGroup = index === 0;
        const mcpTypeIcon = detail.mcpType === 'tool' ? '🔧' : detail.mcpType === 'resource' ? '📚' : '💬';
        
        if (isFirstInGroup) {
          // Show spec file name on first line
          const specDisplay = specFile.length > 42 ? specFile.substring(0, 39) + '...' : specFile;
          this.info(`├─ ${specDisplay.padEnd(42)} │ ${' '.repeat(6)} │           │`);
        }
        
        // Show path indented under spec file
        const pathDisplay = detail.path.length > 38 ? detail.path.substring(0, 35) + '...' : detail.path;
        const pathLine = `   └─ ${pathDisplay}`;
        const overriddenPrefix = detail.isOverridden ? '(Overridden) ' : '';
        const displayName = `${overriddenPrefix}${detail.mcpName}`;
        this.info(`│  ${pathLine.padEnd(42)} │ ${detail.method.padEnd(6)} │ ${mcpTypeIcon} ${detail.mcpType.padEnd(6)} │ ${displayName}`);
        
        // Show description indented further if it's meaningful
        if (detail.description && detail.description !== detail.mcpName && detail.description.length > 10) {
          const descDisplay = detail.description.length > 50 ? detail.description.substring(0, 47) + '...' : detail.description;
          this.info(`│  ${' '.repeat(42)} │        │           │ → ${descDisplay}`);
        }
      });
    }

    this.info('\n' + '=' .repeat(80));
    this.info('✅ MCP OpenAPI Server ready for requests\n');
  }

  private getSpecFileName(specId: string): string {
    // Return the stored original filename, or fallback to specId
    return this.specFiles.get(specId) || specId;
  }

  private getToolName(specId: string, pathPattern: string, method: string, operation: any): string {
    const override = this.config.overrides.find(o => 
      o.specId === specId && o.path === pathPattern && o.method.toLowerCase() === method.toLowerCase()
    );
    
    if (override?.toolName) {
      return override.toolName;
    }
    
    // Generate a shorter, more intelligent tool name
    return this.generateShortToolName(specId, pathPattern, method);
  }

  private generateShortToolName(specId: string, pathPattern: string, method: string): string {
    // Server name is "mcp-openapi" (11 chars), leaving ~49 chars for tool name to stay under 60
    const maxToolNameLength = 48;
    
    // Method abbreviations
    const methodAbbrev: Record<string, string> = {
      'get': 'get',
      'post': 'create', 
      'put': 'update',
      'patch': 'patch',
      'delete': 'delete'
    };
    
    // Remove version prefixes and convert to parts
    const cleanPath = pathPattern.replace(/^\/v\d+/, '').replace(/^\//, '');
    const pathParts = cleanPath.split('/').filter(part => part.length > 0);
    
    // Extract resource name and parameters
    const resourceParts: string[] = [];
    const paramParts: string[] = [];
    
    for (const part of pathParts) {
      if (part.match(/^\{.+\}$/)) {
        // Parameter - extract name and shorten
        const paramName = part.slice(1, -1);
        paramParts.push(paramName.replace(/Id$/, ''));
      } else {
        resourceParts.push(part);
      }
    }
    
    // Build base name: spec + method + main resource
    const mainResource = resourceParts[0] || 'resource';
    const methodName = methodAbbrev[method.toLowerCase()] || method;
    
    // Start with: specId_method_resource
    let toolName = `${specId}_${methodName}_${mainResource}`;
    
    // Add parameters if they fit
    if (paramParts.length > 0 && toolName.length + paramParts.join('_').length + 1 <= maxToolNameLength) {
      toolName += '_' + paramParts.join('_');
    }
    
    // Add sub-resources if they fit and aren't redundant
    const subResources = resourceParts.slice(1).filter(part => !resourceParts[0]?.includes(part));
    if (subResources.length > 0) {
      const subResourceName = subResources.join('_');
      if (toolName.length + subResourceName.length + 1 <= maxToolNameLength) {
        toolName += '_' + subResourceName;
      }
    }
    
    // Final length check - truncate if needed
    if (toolName.length > maxToolNameLength) {
      toolName = toolName.substring(0, maxToolNameLength - 3) + '...';
    }
    
    return toolName;
  }

  private getActualHttpMethod(abbreviatedMethod: string): string {
    // Convert abbreviated method names (from tool names) back to HTTP methods
    const methodMap: Record<string, string> = {
      'get': 'get',
      'create': 'post',
      'update': 'put',
      'patch': 'patch',
      'delete': 'delete'
    };
    return methodMap[abbreviatedMethod] || abbreviatedMethod;
  }

  private hasOverride(specId: string, path: string, method: string): boolean {
    return this.config.overrides.some(o => 
      o.specId === specId && 
      o.path === path && 
      o.method.toLowerCase() === method.toLowerCase()
    );
  }

  private isSpecFile(filename: string): boolean {
    return filename.endsWith('.yaml') || filename.endsWith('.yml') || filename.endsWith('.json');
  }

  private isHttpMethod(method: string): boolean {
    return ['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase());
  }

  private determineMCPType(specId: string, path: string, method: string, operation: any): 'tool' | 'resource' {
    // Check config overrides first
    const override = this.config.overrides.find(o => 
      o.specId === specId && 
      o.path === path && 
      o.method.toLowerCase() === method.toLowerCase()
    );
    
    if (override) {
      return override.type;
    }

    // Default mapping logic
    const methodLower = method.toLowerCase();
    
    // Non-GET methods are always tools (they have side effects)
    if (['post', 'put', 'patch', 'delete'].includes(methodLower)) {
      return 'tool';
    }

    // GET methods - check for complexity indicators
    if (methodLower === 'get') {
      // If it has complex parameters or business logic keywords, make it a tool
      const hasComplexParams = operation.parameters?.some((p: any) => 
        ['search', 'filter', 'query', 'analyze'].some(keyword => 
          p.name.toLowerCase().includes(keyword)
        )
      );
      
      const hasBusinessLogic = operation.summary?.toLowerCase().match(
        /\b(search|analyze|calculate|generate|process|compute)\b/
      );

      if (hasComplexParams || hasBusinessLogic) {
        return 'tool';
      }
      
      // Simple GET operations are resources
      return 'resource';
    }

    return 'tool'; // Default fallback
  }

  private createTool(specId: string, pathPattern: string, method: string, operation: any): MCPTool {
    const override = this.config.overrides.find(o => 
      o.specId === specId && o.path === pathPattern && o.method.toLowerCase() === method.toLowerCase()
    );
    
    // Use the smart naming method instead of old logic
    const toolName = this.getToolName(specId, pathPattern, method, operation);

    const description = override?.description || 
      operation.summary || 
      operation.description || 
      `${method.toUpperCase()} ${pathPattern}`;

    return {
      name: toolName,
      description: description,
      inputSchema: this.buildInputSchema(operation, pathPattern)
    };
  }

  private createResource(specId: string, pathPattern: string, method: string, operation: any): MCPResource {
    const override = this.config.overrides.find(o => 
      o.specId === specId && o.path === pathPattern && o.method.toLowerCase() === method.toLowerCase()
    );
    
    const resourceUri = override?.resourceUri || 
      `${specId}://${pathPattern.startsWith('/') ? pathPattern.substring(1) : pathPattern}`;

    const description = override?.description ||
      operation.description || 
      `Data from ${method.toUpperCase()} ${pathPattern}`;

    // Extract parameters from OpenAPI operation
    const parameters = [];
    if (operation.parameters) {
      for (const param of operation.parameters) {
        // Only include query and path parameters for resources
        if (param.in === 'query' || param.in === 'path') {
          parameters.push({
            name: param.name,
            description: param.description,
            required: param.required || false,
            schema: param.schema || { type: 'string' }
          });
        }
      }
    }



    return {
      uri: resourceUri,
      name: operation.summary || `${specId} ${pathPattern}`,
      description: description,
      mimeType: "application/json",
      parameters: parameters.length > 0 ? parameters : undefined
    };
  }

  private sanitizePath(pathPattern: string): string {
    return pathPattern.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private buildInputSchema(operation: any, pathPattern: string) {
    const properties: any = {};
    const required: string[] = [];

    // Path parameters
    const pathParams = pathPattern.match(/{([^}]+)}/g);
    if (pathParams) {
      for (const param of pathParams) {
        const paramName = param.slice(1, -1);
        properties[paramName] = {
          type: 'string',
          description: `Path parameter: ${paramName}`
        };
        required.push(paramName);
      }
    }

    // Query parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (param.in === 'query') {
          properties[param.name] = {
            type: param.schema?.type || 'string',
            description: param.description
          };
          if (param.required) required.push(param.name);
        }
      }
    }

    // Request body
    if (operation.requestBody) {
      const content = operation.requestBody.content?.['application/json'];
      if (content?.schema?.properties) {
        Object.assign(properties, content.schema.properties);
        if (content.schema.required) {
          required.push(...content.schema.required);
        }
      }
    }

    return {
      type: 'object' as const,
      properties,
      required: [...new Set(required)]
    };
  }

  private setupRequestHandlers(): void {
    // Set up MCP protocol handlers for stdio transport
    this.debug('🔧 Setting up MCP request handlers...');
    
    // Handle initialized notification (required for MCP handshake)
    this.server.setNotificationHandler(InitializedNotificationSchema, async () => {
      this.debug('✅ MCP client initialized successfully');
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const toolsList = this.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));
      
      this.debug(`📋 Returning ${toolsList.length} tools to MCP client`);
      
      return { tools: toolsList };
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resourcesList = this.resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        parameters: resource.parameters
      }));
      
      this.debug(`📚 Returning ${resourcesList.length} resources to MCP client`);
      
      return { resources: resourcesList };
    });

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const promptsList = Array.from(this.prompts.entries()).map(([name, spec]) => ({
        name: name,
        description: spec.description || `${name} prompt template`,
        arguments: spec.arguments || []
      }));
      
      this.debug(`💬 Returning ${promptsList.length} prompts to MCP client`);
      
      return { prompts: promptsList };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name: toolName, arguments: toolArgs } = request.params;
      if (!toolName) {
        throw new Error('Tool name is required');
      }
      const userContext = this.extractUserContext();
      return await this.executeTool(toolName, toolArgs || {}, userContext);
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request: any) => {
      const { uri: resourceUri, parameters: resourceParams } = request.params;
      if (!resourceUri) {
        throw new Error('Resource URI is required');
      }
      const userContext = this.extractUserContext();
      return await this.readResource(resourceUri, userContext, resourceParams || {});
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request: any) => {
      const { name: promptName, arguments: promptArgs } = request.params;
      if (!promptName) {
        throw new Error('Prompt name is required');
      }
      return await this.getPrompt(promptName, promptArgs || {});
    });

    this.debug('✅ MCP request handlers setup complete');
  }

  private async executeTool(toolName: string, args: any, userContext?: { token?: string }) {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    // First check if this tool has an override configuration
    const toolOverride = this.config.overrides.find(o => o.toolName === toolName);
    let pathPattern: string;
    let method: string;
    let specId: string;
    
    if (toolOverride) {
      // Use path and method from override configuration directly
      pathPattern = toolOverride.path;
      method = toolOverride.method;
      specId = toolOverride.specId;
    } else {
      // Parse tool name to get spec, method, and path (fallback for non-override tools)
      const toolParts = toolName.split('_');
      specId = toolParts[0];
      const abbreviatedMethod = toolParts[1];
      
      // Convert abbreviated method back to actual HTTP method
      method = this.getActualHttpMethod(abbreviatedMethod);
      const pathParts = toolParts.slice(2);
      
      // Find the original path pattern
      const spec = this.specs.get(specId);
      if (!spec) {
        throw new Error(`Spec ${specId} not found`);
      }

      const foundPattern = this.findPathPattern(spec, pathParts);
      if (!foundPattern) {
        throw new Error(`Could not determine path pattern for tool ${toolName}`);
      }
      pathPattern = foundPattern;
    }
    
    // Verify spec exists
    const spec = this.specs.get(specId);
    if (!spec) {
      throw new Error(`Spec ${specId} not found`);
    }

    // CLI baseUrl takes precedence over config file baseUrl
    const baseUrl = this.options.baseUrl || this.config.baseUrl || 'http://localhost:3001';
    let actualPath = pathPattern;
    
    // Replace path parameters
    for (const [key, value] of Object.entries(args)) {
      actualPath = actualPath.replace(`{${key}}`, String(value));
    }

    // Build query string for GET requests
    const queryParams = new URLSearchParams();
    if (method.toLowerCase() === 'get') {
      for (const [key, value] of Object.entries(args)) {
        if (!pathPattern.includes(`{${key}}`)) {
          queryParams.append(key, String(value));
        }
      }
    }

    const url = `${baseUrl}${actualPath}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    // Debug logging
    this.debug(`Tool execution URL: ${url}`);
    this.debug(`Method: ${method.toUpperCase()}`);
    
    // Make HTTP request
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(userContext)
      }
    };

    if (['post', 'put', 'patch'].includes(method.toLowerCase())) {
      const bodyArgs = { ...args };
      // Remove path parameters from body
      const pathParams = pathPattern.match(/{([^}]+)}/g);
      if (pathParams) {
        for (const param of pathParams) {
          const paramName = param.slice(1, -1);
          delete bodyArgs[paramName];
        }
      }
      fetchOptions.body = JSON.stringify(bodyArgs);
    }

    try {
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        // Log security events for monitoring
        if (response.status === 401 || response.status === 403) {
          this.warn(`🔒 ${response.status} security error for tool ${toolName} - ${response.statusText}`);
        }
        
        // Handle authentication errors specifically
        if (response.status === 401) {
          const authError = userContext?.token 
            ? 'Invalid or expired authentication token' 
            : 'No authentication token provided';
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: "AUTHENTICATION_REQUIRED",
                message: authError,
                suggestion: "Check your API token or re-authenticate",
                status: 401,
                tool: toolName
              }, null, 2)
            }]
          };
        }
        
        if (response.status === 403) {
          return {
            content: [{
              type: "text", 
              text: JSON.stringify({
                error: "INSUFFICIENT_PERMISSIONS",
                message: "Access denied for this operation",
                suggestion: "Contact administrator for required permissions",
                status: 403,
                tool: toolName
              }, null, 2)
            }]
          };
        }
        
        // Handle other HTTP errors with preserved context
        let errorDetails: any = {
          error: "HTTP_ERROR",
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          tool: toolName,
          url: url.replace(/\?.*$/, '') // Remove query params for privacy
        };
        
        // Try to get error response body
        try {
          const errorBody = await response.json();
          errorDetails.details = errorBody;
        } catch {
          // Response body not JSON or empty
          errorDetails.details = response.statusText;
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(errorDetails, null, 2)
          }]
        };
      }
      
      const result = await response.json();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      // Handle network errors and other exceptions
      this.error(`❌ Tool execution failed for ${toolName}: ${(error as Error).message}`);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "EXECUTION_FAILED",
            message: `Failed to execute tool ${toolName}`,
            details: (error as Error).message,
            tool: toolName
          }, null, 2)
        }]
      };
    }
  }

  private findPathPattern(spec: OpenAPISpec, pathParts: string[]): string | null {
    // This is a simplified approach - in practice, you might want more sophisticated matching
    for (const pathPattern of Object.keys(spec.paths)) {
      const sanitized = this.sanitizePath(pathPattern);
      const reconstructed = pathParts.join('_');
      if (sanitized.includes(reconstructed) || reconstructed.includes(sanitized.replace(/^_+|_+$/g, ''))) {
        return pathPattern;
      }
    }
    return null;
  }

  private async readResource(uri: string, userContext?: { token?: string }, resourceParams?: Record<string, any>) {
    // Handle special server info resource
    if (uri === 'mcp-openapi://server/info') {
      return await this.getServerInfo();
    }
    
    // First, try to find an exact match
    let resource = this.resources.find(r => r.uri === uri);
    
    // If no exact match, try to find a template match
    if (!resource) {
      // Check if this URI matches any resource template
      for (const r of this.resources) {
        if (this.uriMatchesTemplate(uri, r.uri)) {
          resource = r;
          break;
        }
      }
    }
    
    if (!resource) {
      throw new Error(`Resource ${uri} not found`);
    }



    // Parse URI to get spec and path
    const [specId, pathAfterProtocol] = uri.split('://');
    
    // Build the API path from the resource URI
    // The resource URI format is: spec-name://path/segments
    // We need to convert this back to the actual API path as defined in the OpenAPI spec
    let pathPattern = '/' + pathAfterProtocol;
    
    // CLI baseUrl takes precedence over config file baseUrl
    const baseUrl = this.options.baseUrl || this.config.baseUrl || 'http://localhost:3001';
    
    // Separate path parameters from query parameters based on resource schema
    const queryParams = new URLSearchParams();
    const usedParams = new Set<string>();
    
    if (resourceParams && resource.parameters) {
      // First pass: substitute path parameters
      for (const paramDef of resource.parameters) {
        if (paramDef.name in resourceParams) {
          const value = resourceParams[paramDef.name];
          
          // Check if this is a path parameter by looking for {paramName} in path
          const pathParamPattern = `{${paramDef.name}}`;
          if (pathPattern.includes(pathParamPattern)) {
            pathPattern = pathPattern.replace(pathParamPattern, String(value));
            usedParams.add(paramDef.name);
          }
        }
      }
      
      // Second pass: add remaining parameters as query parameters
      for (const paramDef of resource.parameters) {
        if (paramDef.name in resourceParams && !usedParams.has(paramDef.name)) {
          const value = resourceParams[paramDef.name];
          if (value !== undefined && value !== null) {
            queryParams.append(paramDef.name, String(value));
          }
        }
      }
    }
    
    const url = `${baseUrl}${pathPattern}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    // Debug logging
    this.debug(`Resource read URL: ${url}`);
    if (resourceParams && Object.keys(resourceParams).length > 0) {
      this.debug(`Resource parameters: ${JSON.stringify(resourceParams)}`);
    }
    
    try {
      const response = await fetch(url, {
        headers: this.getAuthHeaders(userContext)
      });
      
      if (!response.ok) {
        // Log security events for monitoring
        if (response.status === 401 || response.status === 403) {
          this.warn(`🔒 ${response.status} security error for resource ${uri} - ${response.statusText}`);
        }
        
        // Handle authentication errors specifically
        if (response.status === 401) {
          const authError = userContext?.token 
            ? 'Invalid or expired authentication token' 
            : 'No authentication token provided';
          
          return {
            contents: [{
              uri,
              mimeType: "application/json",
              text: JSON.stringify({
                error: "AUTHENTICATION_REQUIRED",
                message: authError,
                suggestion: "Check your API token or re-authenticate",
                status: 401,
                resource: uri
              }, null, 2)
            }]
          };
        }
        
        if (response.status === 403) {
          return {
            contents: [{
              uri,
              mimeType: "application/json",
              text: JSON.stringify({
                error: "INSUFFICIENT_PERMISSIONS",
                message: "Access denied for this resource",
                suggestion: "Contact administrator for required permissions",
                status: 403,
                resource: uri
              }, null, 2)
            }]
          };
        }
        
        // Handle other HTTP errors with preserved context
        let errorDetails: any = {
          error: "HTTP_ERROR",
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          resource: uri,
          url: url.replace(/\?.*$/, '') // Remove query params for privacy
        };
        
        // Try to get error response body
        try {
          const errorBody = await response.json();
          errorDetails.details = errorBody;
        } catch {
          // Response body not JSON or empty
          errorDetails.details = response.statusText;
        }
        
        return {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify(errorDetails, null, 2)
          }]
        };
      }
      
      const result = await response.json();
      
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      // Handle network errors and other exceptions
      this.error(`❌ Resource read failed for ${uri}: ${(error as Error).message}`);
      
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            error: "READ_FAILED",
            message: `Failed to read resource ${uri}`,
            details: (error as Error).message,
            resource: uri
          }, null, 2)
        }]
      };
    }
  }

  private uriMatchesTemplate(actualUri: string, templateUri: string): boolean {
    // Convert template URI to regex pattern
    // e.g., "banking-payees://banking/payees/{payeeId}" becomes "banking-payees://banking/payees/([^/]+)"
    const regexPattern = templateUri.replace(/\{[^}]+\}/g, '([^/]+)');

    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(actualUri);
  }

  private async getPrompt(promptName: string, args: any) {
    const promptSpec = this.prompts.get(promptName);
    if (!promptSpec) {
      throw new Error(`Prompt ${promptName} not found`);
    }

    // Replace template variables
    let template = promptSpec.template;
    for (const [key, value] of Object.entries(args)) {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return {
      description: promptSpec.description,
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: template
        }
      }]
    };
  }

  private getAuthHeaders(userContext?: { token?: string }): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Priority 1: Use user's token if provided (token passthrough)
    if (userContext?.token) {
      headers['Authorization'] = `Bearer ${userContext.token}`;
      return headers;
    }
    
    // Priority 2: Fall back to service token from config
    if (this.config.authentication) {
      const auth = this.config.authentication;
      const token = process.env[auth.envVar || 'API_TOKEN'];
      
      if (token) {
        switch (auth.type) {
          case 'bearer':
            headers['Authorization'] = `Bearer ${token}`;
            break;
          case 'apikey':
            headers[auth.headerName || 'X-API-Key'] = token;
            break;
          case 'basic':
            headers['Authorization'] = `Basic ${Buffer.from(token).toString('base64')}`;
            break;
        }
      }
    }
    
    return headers;
  }

  private extractUserContext(request?: any): { token?: string } {
    // Method 1: Check for user token in environment (for stdio mode)
    const userToken = process.env.USER_API_TOKEN || process.env.MCP_USER_TOKEN;
    if (userToken) {
      return { token: userToken };
    }
    
    // Method 2: Extract from request headers (for HTTP mode)
    if (request?.headers?.authorization) {
      const authHeader = request.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        return { token: authHeader.substring(7) };
      }
    }
    
    // Method 3: Check for token in request metadata (future MCP enhancement)
    if (request?.meta?.userToken) {
      return { token: request.meta.userToken };
    }
    
    // No user token found
    return {};
  }

  // For IDE usage (stdio)
  async runStdio(): Promise<void> {
    // Set stdio mode flag to suppress debug logging
    this.isStdioMode = true;
    
    this.debug('🚀 Initializing MCP OpenAPI Server for stdio...');
    
    // Step 1: Load all data (tools, resources, prompts)
    await this.initialize();
    
    // Step 2: Create new MCP server with LOADED capabilities 
    this.server = new Server(
      { name: "mcp-openapi-server", version: "1.0.0" },
      { 
        capabilities: { 
          tools: this.tools.reduce((acc, tool) => ({ ...acc, [tool.name]: {} }), {}),
          resources: this.resources.reduce((acc, resource) => ({ ...acc, [resource.uri]: {} }), {}),
          prompts: Array.from(this.prompts.keys()).reduce((acc, name) => ({ ...acc, [name]: {} }), {})
        } 
      }
    );
    
    // Step 3: Set up ALL MCP protocol handlers with loaded data
    this.setupRequestHandlers();
    
    // Step 4: Create transport
    const transport = new StdioServerTransport();
    
    this.debug('🚀 MCP Server ready with capabilities: ' + JSON.stringify({
      tools: this.tools.length,
      resources: this.resources.length, 
      prompts: this.prompts.size
    }));
    
    // Step 5: Connect transport (MCP protocol handshake with proper capabilities)
    await this.server.connect(transport);
    
    this.debug('🔌 MCP OpenAPI Server connected - ready for requests');
  }

  // For standalone deployment (HTTP)
  async runHttp(port?: number): Promise<void> {
    await this.initialize();
    
    const serverPort = port || this.options.port!;
    
    this.app.post('/mcp', async (req, res) => {
      try {
        // Extract user context from request
        const userContext = this.extractUserContext(req);
        
        // Handle JSON-RPC 2.0 method calls
        const { method, params, id } = req.body;
        
        this.debug(`MCP method call: ${method}`);
        
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
              tools: this.tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
              }))
            };
            break;
            
          case 'resources/list':
            result = {
              resources: this.resources.map(resource => ({
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
              prompts: Array.from(this.prompts.entries()).map(([name, spec]) => ({
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
            result = await this.executeTool(toolName, toolArgs, userContext);
            break;
            
          case 'resources/read':
            const resourceUri = params?.uri;
            if (!resourceUri) {
              throw new Error('Resource URI is required');
            }
            const resourceParams = params?.parameters || {};
            

            
            result = await this.readResource(resourceUri, userContext, resourceParams);
            break;
            
          case 'prompts/get':
            const promptName = params?.name;
            const promptArgs = params?.arguments || {};
            if (!promptName) {
              throw new Error('Prompt name is required');
            }
            result = await this.getPrompt(promptName, promptArgs);
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

    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        specs: Array.from(this.specs.keys()),
        tools: this.tools.length,
        resources: this.resources.length,
        prompts: this.prompts.size,
        version: '1.0.0'
      });
    });

    this.app.get('/info', (req, res) => {
      res.json({
        specs: Array.from(this.specs.entries()).map(([id, spec]) => ({
          id,
          title: spec.info.title,
          version: spec.info.version
        })),
        tools: this.tools.map(t => ({ name: t.name, description: t.description })),
        resources: this.resources.map(r => ({ uri: r.uri, name: r.name })),
        prompts: Array.from(this.prompts.keys())
      });
    });

    this.app.listen(serverPort, () => {
      // HTTP server startup - use info level
      this.info(`🚀 MCP OpenAPI Server running on port ${serverPort}`);
      this.info(`📊 Health check: http://localhost:${serverPort}/health`);
      this.info(`ℹ️  Server info: http://localhost:${serverPort}/info`);
      
      this.debug(`📋 Loaded ${this.specs.size} specs, ${this.tools.length} tools, ${this.resources.length} resources, ${this.prompts.size} prompts`);
    });
  }
} 