# MCP Test Client

A comprehensive test client for demonstrating Model Context Protocol (MCP) workflows with banking APIs. This client simulates real-world scenarios where an AI assistant (mock LLM) requests tools and prompts from MCP servers to complete complex tasks.

## 🔄 **Real MCP Workflow vs Demo**

### **Real MCP Workflow (How Claude/GPT works):**
```
1. 👤 User asks question
2. 🤖 LLM gets capabilities from MCP server
3. 🤖 LLM decides what tools/resources it needs
4. 🤖 LLM requests data via MCP client
5. 📡 MCP client executes requests
6. 🔗 MCP server forwards to backend APIs
7. 📊 Data flows back to LLM
8. 🤖 LLM synthesizes final answer
```

### **Our Demo Workflow (Simplified simulation):**
```
1. 👤 User selects scenario
2. 🤖 Mock LLM pretends to analyze (scripted responses)
3. 📋 Demo shows what real LLM would request
4. 📡 MCP client executes the requests
5. 🔗 MCP server forwards to banking APIs
6. 📊 Data comes back (shown in logs)
7. 🤖 Mock LLM pretends to analyze and respond
```

### **Key Differences:**

| Component | Real MCP | Our Demo |
|-----------|----------|----------|
| **LLM** | Claude/GPT makes real decisions | Mock LLM follows scripts |
| **Orchestrator** | LLM IS the orchestrator | Demo coordinator (not real MCP) |
| **Prompts** | Templates that guide LLM thinking | Incorrectly "executed" for demo |
| **Decision Making** | Dynamic based on context | Pre-scripted scenarios |

## 🎯 **What This Demo Shows**

- ✅ **MCP Client**: Real MCP protocol implementation
- ✅ **Tool/Resource execution**: Actual API calls
- ✅ **Parameter substitution**: Real MCP capabilities
- ✅ **Data flow**: Shows what data moves between components
- ❌ **LLM Intelligence**: Scripted responses (not real AI reasoning)

## Features

- 🔌 **MCP Server Integration**: Connects to MCP servers via MCP Streaming HTTP protocol
- 🤖 **Mock LLM Simulation**: Simulates AI assistant decision-making
- 🎬 **Scenario Testing**: Pre-configured banking scenarios (fraud investigation, loan recommendations, etc.)
- 📊 **Interactive CLI**: Easy-to-use interface for running tests
- 🧪 **Automated Testing**: Run all scenarios automatically for CI/CD
- 📋 **Capability Discovery**: List available tools, resources, and prompts from MCP servers

## Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   MCP Test Client   │    │   MCP OpenAPI       │    │   Banking API       │
│                     │    │     Server          │    │     Server          │
│  ┌───────────────┐  │    │                     │    │                     │
│  │  Mock LLM     │  │    │  ┌───────────────┐  │    │  ┌───────────────┐  │
│  │  - Scenarios  │  │◄──►│  │   Tools       │  │◄──►│  │   REST APIs   │  │
│  │  - Planning   │  │    │  │   Resources   │  │    │  │   - Payments  │  │
│  └───────────────┘  │    │  │   Prompts     │  │    │  │   - Products  │  │
│                     │    │  └───────────────┘  │    │  │   - Payees    │  │
│  ┌───────────────┐  │    │                     │    │  └───────────────┘  │
│  │  MCP Client   │  │    │                     │    │                     │
│  │  - HTTP Conn  │  │    │                     │    │                     │
│  │  - Tool Exec  │  │    │                     │    │                     │
│  └───────────────┘  │    │                     │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## Prerequisites

1. **Banking API Server**: The sample banking API must be running
2. **MCP OpenAPI Server**: The MCP server must be running and configured
3. **Node.js**: Version 18+ required

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## MCP Streaming HTTP Protocol Implementation

The test client implements the MCP Streaming HTTP protocol for communication with MCP servers:

### Protocol Features
- ✅ **Session Initialization**: Establishes session with `initialize` method
- ✅ **Session Management**: Maintains `Mcp-Session-Id` for all requests
- ✅ **JSON-RPC 2.0**: Standard MCP message format
- ✅ **Error Handling**: Proper handling of session validation errors
- 🚧 **SSE Support**: Not yet implemented (request-response pattern only)

### Connection Flow
1. **Health Check**: Verify server availability via `GET /health` endpoint
2. **Initialize Session**: Send `initialize` request to `POST /mcp` to establish session
3. **Extract Session ID**: Get `Mcp-Session-Id` from response headers
4. **Authenticated Requests**: Include session ID in all subsequent requests
5. **Capability Discovery**: Load tools, resources, and prompts

### Current Limitations
- **No SSE Streaming**: Uses synchronous request-response pattern
- **Session-based Only**: All operations require valid session
- **Single Server**: Currently connects to one MCP server at a time

## Configuration

The client uses configuration files in the following locations:

### MCP Servers Configuration (`config/mcp-servers.json`)

```json
{
  "servers": {
    "banking-apis": {
      "name": "Banking APIs MCP Server",
      "description": "OpenAPI-based MCP server for banking operations",
      "connection": {
        "type": "http",
        "url": "http://localhost:4000",
        "healthEndpoint": "/health",
        "infoEndpoint": "/info"
      },
      "enabled": true,
      "timeout": 30000,
      "retries": 3
    }
  },
  "globalConfig": {
    "defaultTimeout": 15000,
    "enableLogging": true,
    "logLevel": "info"
  }
}
```

### Test Scenarios (`test-data/prompts.json`)

Contains realistic banking scenarios like:
- 🕵️ **Fraud Investigation**: Analyze suspicious payments
- 🏠 **Loan Recommendations**: Suggest appropriate loan products  
- 📊 **Payment Analysis**: Review customer payment patterns
- ✅ **Payee Verification**: Verify vendor information

## Usage

### Interactive Mode

Start the interactive CLI to run scenarios manually:

```bash
npm start
# or
npm run dev
```

**Interactive Menu Options:**
- 🎬 Run a specific scenario
- 🎭 Run all scenarios
- 📋 List MCP capabilities  
- 📝 List available scenarios
- 🚪 Exit

### Automated Testing

Run all scenarios automatically (great for CI/CD):

```bash
npm test
```

### Direct Execution

Build and run in one command:

```bash
npm run demo
```

## End-to-End Demo Setup

To run the complete demo with all components:

### 1. Start the Banking API Server

```bash
cd ../sample-banking-api
npm install
npm start
# Server runs on http://localhost:3000
```

### 2. Start the MCP OpenAPI Server

```bash
cd ../mcp-openapi
npm install
npm run build
npm run start:http
# Server runs on http://localhost:4000
```

### 3. Run the MCP Test Client

```bash
cd ../mcp-test-client
npm install
npm run demo
```

## Test Scenarios

### 🕵️ Fraud Investigation

**User Prompt**: "I need to investigate a suspicious payment of $5000 made to payee 'SUSP_VENDOR_001' yesterday. Can you help me analyze this for potential fraud?"

**LLM Actions**:
1. Search for the specific payment
2. Get payee details
3. Run fraud analysis prompt
4. Provide risk assessment and recommendations

### 🏠 Loan Recommendation

**User Prompt**: "I have a customer who wants to buy a house worth $500,000. They have excellent credit and $100,000 for a down payment. What loan products should I recommend?"

**LLM Actions**:
1. Get available loan products
2. Run loan recommendation prompt
3. Provide personalized product suggestions

### 📊 Payment History Analysis

**User Prompt**: "Show me the payment history for account '1234567890' over the last 3 months and analyze the spending patterns."

**LLM Actions**:
1. Search payments by account
2. Analyze patterns and trends
3. Provide insights

### ✅ Payee Verification

**User Prompt**: "I need to verify the details of payee 'UTIL_ELECTRIC_001' and check if there are any compliance issues with this vendor."

**LLM Actions**:
1. Get payee details
2. Check compliance status
3. Provide verification results

## Expected Output

When running a scenario, you'll see:

```
🎬 RUNNING SCENARIO: Fraud Investigation Scenario
👤 User Prompt: "I need to investigate a suspicious payment..."

🤖 [Mock LLM] Processing: "I need to investigate a suspicious payment..."
💭 [Mock LLM] Response: I'll help you investigate this suspicious payment...

🧠 [Mock LLM] Planning Execution...
   Analyzing user request...
   Identifying required data sources...
   Planning tool execution sequence...

📋 [Mock LLM] I need this data to answer your question:
   Tools: 1, Resources: 1, Prompts: 1

🔧 [Demo] Mock LLM requests: banking-payments_get__banking_payments
🔧 [MCP Client] Executing tool: banking-payments_get__banking_payments
   Parameters: {"payeeId": "SUSP_VENDOR_001", "amount": 5000}
     → [MCP Server] Sending tool request...
✅ [MCP Client] Tool executed successfully
   ✅ [Demo] Data received and sent to Mock LLM
   📊 [Data] {"payments":[{"id":"PAY_001","amount":5000,...}]}...

📚 [Demo] Mock LLM requests: banking-payees://banking/payees/{payeeId}
📚 [MCP Client] Reading resource: banking-payees://banking/payees/SUSP_VENDOR_001
     → [MCP Server] Sending resource request...
✅ [MCP Client] Resource read successfully
   ✅ [Demo] Data received and sent to Mock LLM
   📊 [Data] {"payeeId":"SUSP_VENDOR_001","name":"Suspicious Vendor Inc",...}...

🧠 [Mock LLM] Now I have all the data I need. Let me analyze and respond...

✨ [Mock LLM] Final Response:
Based on my analysis, this payment shows several red flags: 
Risk Score: 78/100 (HIGH RISK)...

❓ Follow-up Questions:
   1. Would you like me to check for similar patterns in other accounts?
   2. Should I set up automated monitoring for this type of transaction?

✅ Scenario completed successfully in 2847ms
```

## Architecture Details

### MCP Client (`src/mcp-client.ts`)
- Connects to MCP servers via MCP Streaming HTTP protocol
- Implements session management with `Mcp-Session-Id` headers
- Executes tools and prompts with proper MCP protocol flow
- Handles errors gracefully
- Simulates responses when servers are unavailable
- **Note**: SSE streaming support not yet implemented

### Mock LLM (`src/mock-llm.ts`)
- Simulates AI assistant behavior
- Plans execution based on user prompts
- Processes results and generates responses
- Provides follow-up questions

### Demo Orchestrator (`src/orchestrator.ts`)
- Coordinates MCP client and mock LLM
- Manages scenario execution flow
- Tracks execution steps and timing
- Provides CLI interfaces
- **Note**: In real MCP, the LLM IS the orchestrator

## Development

### Project Structure

```
mcp-test-client/
├── config/
│   └── mcp-servers.json          # MCP server configuration
├── test-data/
│   └── prompts.json              # Test scenarios and mock responses
├── src/
│   ├── types.ts                  # TypeScript interfaces
│   ├── mcp-client.ts             # MCP client implementation
│   ├── mock-llm.ts               # Mock LLM simulation
│   ├── orchestrator.ts           # Main orchestration logic
│   ├── index.ts                  # Interactive CLI entry point
│   └── test-scenarios.ts         # Automated testing entry point
├── dist/                         # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

### Adding New Scenarios

1. Add scenario definition to `test-data/prompts.json`
2. Add mock LLM responses for the scenario
3. Update the interactive CLI options if needed

### Error Handling

The client handles various error conditions:
- MCP server unavailable → Simulated responses
- Tool execution failures → Graceful degradation
- Network timeouts → Retry logic
- Invalid configurations → Clear error messages

## Troubleshooting

### Common Issues

**MCP Server Connection Failed**
```
❌ Failed to connect to Banking APIs MCP Server: Health check failed: 500
```
- Ensure the MCP OpenAPI server is running on port 4000
- Check the banking API server is running on port 3000

**No Capabilities Available**
```
❌ No capabilities available from MCP servers
```
- Verify MCP server configuration
- Check server endpoints are accessible

**Scenario Execution Failed**
```
❌ Scenario failed: Tool not found: banking-payments_get__banking_payments_search
```
- Verify the MCP server has loaded the correct OpenAPI specs
- Check tool names match the expected format

## Contributing

1. Add new test scenarios in `test-data/prompts.json`
2. Extend mock LLM responses for new scenarios
3. Add new MCP server configurations as needed
4. Update documentation for new features

## License

MIT License - see [LICENSE](LICENSE) file for details. 