export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    'x-spec-id'?: string;
  };
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
  };
}

export interface ConfigOverride {
  specId: string;
  path: string;
  method: string;
  type: 'tool' | 'resource';
  toolName?: string;
  resourceUri?: string;
  description?: string;
}

export interface AuthConfig {
  type: 'bearer' | 'apikey' | 'basic';
  headerName?: string;
  envVar?: string;
}

export interface ServerConfig {
  overrides: ConfigOverride[];
  baseUrl?: string;
  authentication?: AuthConfig;
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
}

export interface PromptSpec {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
  template: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  // Metadata for tool execution (not exposed in MCP protocol)
  _metadata: {
    specId: string;
    pathPattern: string;
    method: string;
    operation: any;
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  parameters?: Array<{
    name: string;
    description?: string;
    required: boolean;
    schema: any;
  }>;
}

export interface ServerOptions {
  specsDir?: string;
  configFile?: string;
  promptsDir?: string;
  port?: number;
  verbose?: boolean;
  baseUrl?: string;
  maxToolNameLength?: number;
} 