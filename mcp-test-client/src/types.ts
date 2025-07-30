// MCP Server Configuration
export interface MCPServerConfig {
  name: string;
  connection: {
    type: 'http' | 'stdio';
    url?: string;
    command?: string;
    args?: string[];
  };
}

// Test Data Structure
export interface TestData {
  scenarios: Scenario[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  userPrompt: string;
}

export interface ToolRequest {
  name: string;
  parameters: Record<string, any>;
}

export interface ResourceRequest {
  uri: string;
  parameters?: Record<string, any>;
}

export interface PromptRequest {
  name: string;
  parameters: Record<string, any>;
}

// Execution tracking
export interface ExecutionStep {
  type: 'tool' | 'resource' | 'prompt';
  name: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
  duration?: number; // Added duration field
}

// LLM Interface
export interface LLMRequest {
  type: 'tool' | 'resource' | 'prompt';
  name?: string;    // for tools and prompts
  uri?: string;     // for resources
  parameters?: Record<string, any>;
  reasoning?: string;
}

// MCP Capabilities (exported for use in other files)
export interface MCPCapabilities {
  tools: Array<{
    name: string;
    description: string;
    inputSchema?: any;
  }>;
  resources: Array<{
    name: string;
    description: string;
    uri: string;
    mimeType?: string;
  }>;
  prompts: Array<{
    name: string;
    description?: string;
    arguments?: Array<{
      name: string;
      description?: string;
      required?: boolean;
    }>;
  }>;
} 