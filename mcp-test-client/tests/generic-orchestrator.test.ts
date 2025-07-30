import { GenericOrchestrator } from '../src/generic-orchestrator.js';
import { BaseLLM, LLMResponse } from '../src/llm-interface.js';
import { MCPCapabilities, Scenario } from '../src/types.js';

// Mock LLM class for testing
class MockLLM extends BaseLLM {
  private responses: LLMResponse[] = [];
  private responseIndex = 0;

  setResponses(responses: LLMResponse[]) {
    this.responses = responses;
    this.responseIndex = 0;
  }

  async processUserPrompt(userPrompt: string, capabilities: MCPCapabilities): Promise<LLMResponse> {
    return this.getNextResponse();
  }

  async processResults(results: any[], conversationHistory?: any[]): Promise<LLMResponse> {
    return this.getNextResponse();
  }

  private getNextResponse(): LLMResponse {
    if (this.responseIndex < this.responses.length) {
      return this.responses[this.responseIndex++];
    }
    return {
      content: 'Default response',
      needsMoreData: false
    };
  }
}

// Mock MCP Client
const mockMCPClient = {
  connect: jest.fn(),
  getCapabilities: jest.fn(),
  executeTool: jest.fn(),
  readResource: jest.fn(),
  executePrompt: jest.fn(),
  disconnect: jest.fn()
};

// Mock the MCPClient constructor
jest.mock('../src/mcp-client.js', () => {
  return {
    MCPClient: jest.fn().mockImplementation(() => mockMCPClient)
  };
});

describe('GenericOrchestrator', () => {
  let orchestrator: GenericOrchestrator;
  let mockLLM: MockLLM;
  
  const defaultCapabilities: MCPCapabilities = {
    tools: [
      {
        name: 'test-tool',
        description: 'Test tool for unit tests',
        inputSchema: { type: 'object', properties: {} }
      }
    ],
    resources: [
      {
        name: 'test-resource',
        description: 'Test resource for unit tests',
        uri: 'test://resource',
        mimeType: 'application/json'
      }
    ],
    prompts: [
      {
        name: 'test-prompt',
        description: 'Test prompt for unit tests',
        arguments: []
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup fetch mock for health checks
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    } as any);
    
    mockLLM = new MockLLM();
    orchestrator = new GenericOrchestrator(mockLLM, {
      maxRounds: 5,
      enableLogging: false // Disable logging for cleaner test output
    });

    // Setup default mock implementations
    mockMCPClient.connect.mockResolvedValue(undefined);
    mockMCPClient.getCapabilities.mockReturnValue(defaultCapabilities);
    mockMCPClient.executeTool.mockResolvedValue({ success: true, data: 'tool result' });
    mockMCPClient.readResource.mockResolvedValue({ content: 'resource content' });
    mockMCPClient.executePrompt.mockResolvedValue('prompt result');
    
    // Inject the mock client
    (orchestrator as any).primaryClient = mockMCPClient;
  });

  describe('constructor', () => {
    it('should create orchestrator with default config', () => {
      const defaultOrchestrator = new GenericOrchestrator(mockLLM);
      expect(defaultOrchestrator).toBeInstanceOf(GenericOrchestrator);
    });

    it('should create orchestrator with custom config', () => {
      const customOrchestrator = new GenericOrchestrator(mockLLM, {
        maxRounds: 3,
        enableLogging: true
      });
      expect(customOrchestrator).toBeInstanceOf(GenericOrchestrator);
    });
  });

  describe('addMCPServer', () => {
    const serverConfig = {
      name: 'test-server',
      connection: {
        type: 'http' as const,
        url: 'http://localhost:4000'
      }
    };

    it('should add MCP server successfully', async () => {
      await orchestrator.addMCPServer('test', serverConfig);

      expect(mockMCPClient.connect).toHaveBeenCalledWith(serverConfig);
    });

    it('should handle connection failure', async () => {
      mockMCPClient.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(orchestrator.addMCPServer('test', serverConfig)).rejects.toThrow('Connection failed');
    });
  });

  describe('handleUserPrompt', () => {
    it('should handle simple prompt with final response', async () => {
      mockLLM.setResponses([
        {
          content: 'Hello, this is my response',
          needsMoreData: false
        }
      ]);

      const result = await orchestrator.handleUserPrompt('Hello');

      expect(result.success).toBe(true);
      expect(result.response).toBe('Hello, this is my response');
      expect(result.rounds).toBe(0);
      expect(result.steps).toHaveLength(0);
    });

    it('should handle multi-round conversation with tool calls', async () => {
      mockLLM.setResponses([
        {
          needsMoreData: true,
          requests: [
            {
              type: 'tool',
              name: 'test-tool',
              parameters: { param: 'value' },
              reasoning: 'Testing tool call'
            }
          ]
        },
        {
          content: 'Tool executed successfully with result: tool result',
          needsMoreData: false
        }
      ]);

      const result = await orchestrator.handleUserPrompt('Execute a tool');

      expect(result.success).toBe(true);
      expect(result.rounds).toBe(1);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].type).toBe('tool');
      expect(result.steps[0].name).toBe('test-tool');
      expect(mockMCPClient.executeTool).toHaveBeenCalledWith('test-tool', { param: 'value' });
    });

    it('should handle resource requests', async () => {
      mockLLM.setResponses([
        {
          needsMoreData: true,
          requests: [
            {
              type: 'resource',
              uri: 'test://resource',
              parameters: { filter: 'active' },
              reasoning: 'Getting resource data'
            }
          ]
        },
        {
          content: 'Resource data retrieved: resource content',
          needsMoreData: false
        }
      ]);

      const result = await orchestrator.handleUserPrompt('Get resource data');

      expect(result.success).toBe(true);
      expect(result.rounds).toBe(1);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].type).toBe('resource');
      expect(result.steps[0].name).toBe('test://resource');
      expect(mockMCPClient.readResource).toHaveBeenCalledWith('test://resource', { filter: 'active' });
    });

    it('should handle prompt requests', async () => {
      mockLLM.setResponses([
        {
          needsMoreData: true,
          requests: [
            {
              type: 'prompt',
              name: 'test-prompt',
              parameters: { context: 'testing' },
              reasoning: 'Using specialized prompt'
            }
          ]
        },
        {
          content: 'Prompt executed with guidance: prompt result',
          needsMoreData: false
        }
      ]);

      const result = await orchestrator.handleUserPrompt('Use a prompt');

      expect(result.success).toBe(true);
      expect(result.rounds).toBe(1);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].type).toBe('prompt');
      expect(result.steps[0].name).toBe('test-prompt');
      expect(mockMCPClient.executePrompt).toHaveBeenCalledWith('test-prompt', { context: 'testing' });
    });

    it('should handle mixed request types in sequence', async () => {
      mockLLM.setResponses([
        {
          needsMoreData: true,
          requests: [
            {
              type: 'resource',
              uri: 'test://data',
              parameters: {},
              reasoning: 'Get initial data'
            }
          ]
        },
        {
          needsMoreData: true,
          requests: [
            {
              type: 'tool',
              name: 'test-tool',
              parameters: { data: 'processed' },
              reasoning: 'Process the data'
            }
          ]
        },
        {
          content: 'Complete workflow executed successfully',
          needsMoreData: false
        }
      ]);

      const result = await orchestrator.handleUserPrompt('Execute workflow');

      expect(result.success).toBe(true);
      expect(result.rounds).toBe(2);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].type).toBe('resource');
      expect(result.steps[1].type).toBe('tool');
    });

    it('should respect maxRounds limit', async () => {
      // Create orchestrator with very low maxRounds
      const limitedOrchestrator = new GenericOrchestrator(mockLLM, { maxRounds: 2, enableLogging: false });
      (limitedOrchestrator as any).primaryClient = mockMCPClient;

      mockLLM.setResponses([
        { content: 'Round 1', needsMoreData: true, requests: [{ type: 'tool', name: 'test-tool', parameters: {} }] },
        { content: 'Round 2', needsMoreData: true, requests: [{ type: 'tool', name: 'test-tool', parameters: {} }] },
        { content: 'Final response', needsMoreData: true, requests: [{ type: 'tool', name: 'test-tool', parameters: {} }] }
      ]);

      const result = await limitedOrchestrator.handleUserPrompt('Long conversation');

      expect(result.success).toBe(false);
      expect(result.rounds).toBe(2);
      expect(result.response).toBeDefined();
    });

    it('should handle MCP client errors gracefully', async () => {
      mockMCPClient.executeTool.mockRejectedValue(new Error('Tool execution failed'));

      mockLLM.setResponses([
        {
          needsMoreData: true,
          requests: [
            {
              type: 'tool',
              name: 'test-tool',
              parameters: {},
              reasoning: 'This will fail'
            }
          ]
        }
      ]);

      const result = await orchestrator.handleUserPrompt('Execute failing tool');

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].result.error).toContain('Tool execution failed');
    });

    it('should throw error when no MCP server is connected', async () => {
      const disconnectedOrchestrator = new GenericOrchestrator(mockLLM);

      await expect(disconnectedOrchestrator.handleUserPrompt('Test')).rejects.toThrow('No MCP server connected');
    });
  });

  describe('runScenario', () => {
    const testScenario: Scenario = {
      id: 'test-scenario',
      name: 'Test Scenario',
      description: 'A test scenario for unit testing',
      userPrompt: 'Execute test scenario'
    };

    it('should run scenario successfully', async () => {
      mockLLM.setResponses([
        {
          content: 'Scenario executed successfully',
          needsMoreData: false
        }
      ]);

      const result = await orchestrator.runScenario(testScenario);

      expect(result.success).toBe(true);
      expect(result.response).toBe('Scenario executed successfully');
    });

    it('should handle scenario with complex workflow', async () => {
      mockLLM.setResponses([
        {
          needsMoreData: true,
          requests: [
            {
              type: 'resource',
              uri: 'scenario://data',
              parameters: {},
              reasoning: 'Get scenario data'
            }
          ]
        },
        {
          content: 'Scenario completed with data processing',
          needsMoreData: false
        }
      ]);

      const result = await orchestrator.runScenario(testScenario);

      expect(result.success).toBe(true);
      expect(result.rounds).toBe(1);
      expect(result.steps).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty requests array', async () => {
      mockLLM.setResponses([
        {
          needsMoreData: true,
          requests: [] // Empty requests
        },
        {
          content: 'Nothing to do',
          needsMoreData: false
        }
      ]);

      const result = await orchestrator.handleUserPrompt('Empty request');

      expect(result.success).toBe(true);
      expect(result.rounds).toBe(1);
      expect(result.steps).toHaveLength(0);
    });

    it('should handle undefined requests', async () => {
      mockLLM.setResponses([
        {
          needsMoreData: true
          // No requests property
        },
        {
          content: 'No requests provided',
          needsMoreData: false
        }
      ]);

      const result = await orchestrator.handleUserPrompt('Undefined requests');

      expect(result.success).toBe(true);
      expect(result.rounds).toBe(1);
      expect(result.steps).toHaveLength(0);
    });

    it('should handle unknown request types', async () => {
      mockLLM.setResponses([
        {
          needsMoreData: true,
          requests: [
            {
              type: 'unknown' as any,
              name: 'unknown-action',
              parameters: {},
              reasoning: 'This is unknown'
            }
          ]
        }
      ]);

      const result = await orchestrator.handleUserPrompt('Unknown request type');

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].result.error).toContain('Unknown request type');
    });
  });
}); 