import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  OpenAPISpec,
  ServerConfig,
  PromptSpec,
  MCPTool,
  MCPResource,
  ServerOptions
} from './types.js';
import { PACKAGE_NAME } from './package-info.js';

export interface TelemetryContext {
  options: ServerOptions;
  isStdioMode: boolean;
  server?: Server;
  specs: Map<string, OpenAPISpec>;
  specFiles: Map<string, string>;
  config: ServerConfig;
  prompts: Map<string, PromptSpec>;
  tools: MCPTool[];
  resources: MCPResource[];
}

export class Telemetry {
  constructor(private context: TelemetryContext) {}

  debug(message: string): void {
    if (this.context.options.verbose) {
      if (this.context.isStdioMode && this.context.server) {
        // Send debug messages through MCP logging notification
        this.context.server.notification({
          method: 'notifications/message',
          params: {
            level: 'debug',
            logger: PACKAGE_NAME,
            data: message
          }
        }).catch(() => {
          // Fallback to stderr if notification fails
          process.stderr.write(`[DEBUG] ${message}\n`);
        });
      } else if (!this.context.isStdioMode) {
        // HTTP mode - use console
        console.debug(`[DEBUG] ${message}`);
      }
    }
  }

  info(message: string): void {
    if (this.context.options.verbose) {
      if (this.context.isStdioMode && this.context.server) {
        // Send info messages through MCP logging notification
        this.context.server.notification({
          method: 'notifications/message',
          params: {
            level: 'info',
            logger: PACKAGE_NAME,
            data: message
          }
        }).catch(() => {
          // Fallback to stderr if notification fails
          process.stderr.write(`[INFO] ${message}\n`);
        });
      } else if (!this.context.isStdioMode) {
        // HTTP mode - use console
        console.info(`[INFO] ${message}`);
      }
    }
  }

  warn(message: string): void {
    if (this.context.isStdioMode && this.context.server) {
      // Send warnings through MCP logging notification
      this.context.server.notification({
        method: 'notifications/message',
        params: {
          level: 'warning',
          logger: PACKAGE_NAME,
          data: message
        }
      }).catch(() => {
        // Fallback to stderr if notification fails
        process.stderr.write(`[WARN] ${message}\n`);
      });
    } else if (!this.context.isStdioMode) {
      // HTTP mode - use console
      console.warn(`[WARN] ${message}`);
    }
  }

  error(message: string): void {
    if (this.context.isStdioMode && this.context.server) {
      // Send errors through MCP logging notification
      this.context.server.notification({
        method: 'notifications/message',
        params: {
          level: 'error',
          logger: PACKAGE_NAME,
          data: message
        }
      }).catch(() => {
        // Fallback to stderr if notification fails
        process.stderr.write(`[ERROR] ${message}\n`);
      });
    } else if (!this.context.isStdioMode) {
      // HTTP mode - use console
      console.error(`[ERROR] ${message}`);
    }
  }

  printMCPCapabilitiesDebug(
    getSpecFileName: (specId: string) => string,
    determineMCPType: (specId: string, path: string, method: string, operation: any) => 'tool' | 'resource',
    getToolName: (specId: string, pathPattern: string, method: string, operation: any) => string,
    hasOverride: (specId: string, path: string, method: string) => boolean,
    isHttpMethod: (method: string) => boolean
  ): void {
    if (!this.context.options.verbose) {
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
    for (const [specId, spec] of this.context.specs) {
      const specFile = getSpecFileName(specId);
      
      for (const [pathPattern, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (isHttpMethod(method)) {
            const mcpType = determineMCPType(specId, pathPattern, method, operation);
            
            if (mcpType === 'tool') {
              const tool = this.context.tools.find(t => t.name === getToolName(specId, pathPattern, method, operation));
              if (tool) {
                generationDetails.push({
                  specId,
                  specFile,
                  path: pathPattern,
                  method: method.toUpperCase(),
                  mcpType: 'tool',
                  mcpName: tool.name,
                  description: tool.description,
                  isOverridden: hasOverride(specId, pathPattern, method)
                });
              }
            } else if (mcpType === 'resource') {
              const resource = this.context.resources.find(r => r.uri === `${specId}://${pathPattern.startsWith('/') ? pathPattern.substring(1) : pathPattern}`);
              if (resource) {
                generationDetails.push({
                  specId,
                  specFile,
                  path: pathPattern,
                  method: method.toUpperCase(),
                  mcpType: 'resource',
                  mcpName: resource.name,
                  description: resource.description,
                  isOverridden: hasOverride(specId, pathPattern, method)
                });
              }
            }
          }
        }
      }
    }

    // Add prompt details
    for (const [name, spec] of this.context.prompts) {
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
    this.info(`\n📊 LOADED: ${toolCount} tools, ${resourceCount} resources, ${promptCount} prompts from ${this.context.specs.size} OpenAPI specs${overrideSummary}\n`);

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
}