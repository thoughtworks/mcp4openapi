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

export interface HttpsClientConfig {
  rejectUnauthorized?: boolean;
  timeout?: number;
  keepAlive?: boolean;
  certFile?: string;
  keyFile?: string;
  pfxFile?: string;
  caFile?: string;
  passphrase?: string;
}

export interface ValidatedHttpsClientConfig extends HttpsClientConfig {
  timeout: number;
  rejectUnauthorized: boolean;
  keepAlive: boolean;
  certificateType: 'none' | 'cert-key' | 'pfx';
}

export interface CertificateData {
  ca?: Buffer;
  cert?: Buffer;
  key?: Buffer;
  pfx?: Buffer;
  passphrase?: string;
}

export interface ServerConfig {
  overrides: ConfigOverride[];
  baseUrl?: string;
  authentication?: AuthConfig;
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
  maxResponseSizeMB?: number;
  httpsClient?: HttpsClientConfig;
}

export interface ValidatedServerConfig extends ServerConfig {
  resolvedBaseUrl: string;
  httpsClient?: ValidatedHttpsClientConfig;
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
  maxRequestSize?: string;
  maxResponseSizeMB?: number;
  // HTTPS Client configuration (for backend API connections)
  httpsClientCa?: string;
  httpsClientCert?: string;
  httpsClientKey?: string;
  httpsClientPfx?: string;
  httpsClientPassphrase?: string;
  httpsClientRejectUnauthorized?: boolean;
  httpsClientTimeout?: number;
  // HTTPS Server configuration (for MCP server itself)
  https?: boolean;
  httpsPort?: number;
  keyFile?: string;
  certFile?: string;
  pfxFile?: string;
  passphrase?: string;
} 