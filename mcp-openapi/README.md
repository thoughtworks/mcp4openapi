# MCP OpenAPI Server

A generic, configurable MCP (Model Context Protocol) server that automatically generates tools, resources, and prompts from OpenAPI specifications and hosts a proxy, via the MCP protocol, to those API endpoints.

Given a set of openapi specs, it will create, via sensible defaults, a set of MCP Tools and MCP Resources.  Also given a set of prompts provided as a set of JSON files, it will create MCP prompts for them and will be published together with the MCP Tools and Resources as a complete set of MCP capabilities to be used by any tool enabled LLM.

This app will work with an OpenAPI compliant endpoints and specification.  The sensible defaults are overidable via configuration.

## Features

- 🔧 **Automatic Tool Generation**: Converts REST API endpoints to MCP tools
- 📚 **Resource Management**: Exposes read-only data as MCP resources  
- 💬 **Custom Prompts**: Load domain-specific prompt templates
- ⚙️ **Configurable Mapping**: Override default tool/resource classification
- 🔐 **Authentication Support**: Bearer, API Key, and Basic auth
- 🚀 **Multiple Deployment Modes**: stdio for IDEs, HTTP for standalone deployment
- 📋 **Multi-Spec Support**: Load multiple OpenAPI specifications

## Installation

### Global Installation
```bash
npm install -g mcp-openapi-server
```

### Local Installation
```bash
npm install mcp-openapi-server
```

## Quick Start

### 1. Prepare Your OpenAPI Specs
Create a `specs` directory and add your OpenAPI specification files:

```
specs/
├── banking-products.yaml
├── banking-payments.yaml
└── banking-payees.yaml
```

### 2. Run the Server

**For IDE Integration (stdio mode):**
```bash
mcp-openapi-server
```

**For Standalone Deployment (HTTP mode):**
```bash
mcp-openapi-server --http --port 4000
```

**With Custom Directories:**
```bash
mcp-openapi-server --specs ./my-specs --config ./my-config.json --prompts ./my-prompts --verbose
```

**With Custom Base URL:**
```bash
# Override the backend API base URL (takes precedence over config file)
mcp-openapi-server --base-url https://api.example.com --specs ./specs --verbose

# For different environments
mcp-openapi-server --base-url http://localhost:8080 --specs ./specs    # Development
mcp-openapi-server --base-url https://staging-api.com --specs ./specs  # Staging
mcp-openapi-server --base-url https://api.production.com --specs ./specs  # Production
```

## Development Mode

When developing the MCP OpenAPI server locally in your IDE, you can run it directly from the source code without installing globally:

### Prerequisites
```bash
# Install dependencies first
npm install
```

### Development Commands

**Development Mode with Hot Reload (Recommended):**
```bash
npm run dev
```

**Development with Banking Examples:**
```bash
npm run dev -- --specs ./examples/specs --config ./examples/mcp-config.json --prompts ./examples/prompts --verbose
```

**HTTP Mode for Testing:**
```bash
npm run start:http
```

**Build and Run:**
```bash
npm run build
npm start
```

### Development Environment Setup

**For stdio Mode (IDE Integration):**
```bash
# Set environment variables for authentication
export BANKING_API_TOKEN="your-service-token-here"
export USER_API_TOKEN="your-user-token-here"

# Run with verbose logging
npm run dev -- --verbose
```

**For HTTP Mode (API Testing):**
```bash
# Start HTTP server on port 4000
npm run start:http

# Test health endpoint
curl http://localhost:4000/health

# Test server info
curl http://localhost:4000/info
```

### Expected Output
When running in development mode, you should see:
```
🚀 MCP OpenAPI Server running on port 4000
📊 Health check: http://localhost:4000/health
ℹ️  Server info: http://localhost:4000/info
📋 Loaded 3 specs, 6 tools, 3 resources, 2 prompts
```

### Development Tips

- **Hot Reload**: The `npm run dev` command uses `tsx` for automatic TypeScript compilation and hot reloading
- **Verbose Logging**: Add `--verbose` flag to see detailed debug information
- **Banking Examples**: Use the pre-configured banking examples in `./examples/` for testing
- **Authentication Testing**: Set environment variables for token passthrough testing

## Usage Modes

The MCP OpenAPI Server can be used in two primary ways:

### 1. Standalone Application

Run as an independent server process, perfect for:
- IDE integration (Cursor, Claude Desktop)
- Microservices architecture
- Development and testing

#### CLI Usage
```bash
# Install globally
npm install -g mcp-openapi-server

# Run in stdio mode (for IDE integration)
mcp-openapi-server --specs ./specs --config ./mcp-config.json

# Run in HTTP mode (for web integration)
mcp-openapi-server --http --port 4000 --specs ./specs --config ./mcp-config.json

# Run with custom base URL (overrides config file setting)
mcp-openapi-server --base-url https://api.example.com --specs ./specs --config ./mcp-config.json
```

#### Docker Usage
```bash
# Build Docker image
docker build -t mcp-openapi-server .

# Run container
docker run -p 4000:4000 -v ./specs:/app/specs -v ./config:/app/config mcp-openapi-server --http --port 4000
```

### 2. Library Integration

Import into your existing Node.js applications:

#### Installation
```bash
npm install mcp-openapi-server
```

#### Basic Library Usage
```typescript
import { MCPOpenAPIServer } from 'mcp-openapi-server';

// Create and initialize server
const mcpServer = new MCPOpenAPIServer({
  specsDir: './api-specs',
  configFile: './mcp-config.json',
  promptsDir: './prompts',
  verbose: true
});

await mcpServer.initialize();

// Run in HTTP mode
await mcpServer.runHttp(4000);
```

#### Express.js Integration
```typescript
import express from 'express';
import { MCPOpenAPIServer } from 'mcp-openapi-server';

const app = express();
const mcpServer = new MCPOpenAPIServer({
  specsDir: './specs',
  configFile: './config.json'
});

await mcpServer.initialize();

// Add MCP endpoint to existing Express app
app.post('/mcp', async (req, res) => {
  // Custom MCP request handling
  res.json({ status: 'MCP server integrated' });
});

// Run your existing app with MCP capabilities
app.listen(8080);
```

#### Helper Functions
```typescript
import { createMCPServer, startServer } from 'mcp-openapi-server';

// Quick server creation
const server = createMCPServer({
  specsDir: './specs',
  port: 3000
});

// One-line server start
await startServer({
  specsDir: './specs',
  mode: 'http',
  port: 4000
});
```

#### Advanced Library Usage
```typescript
import { MCPOpenAPIServer, ServerOptions } from 'mcp-openapi-server';

class CustomMCPServer extends MCPOpenAPIServer {
  constructor(options: ServerOptions) {
    super(options);
  }

  // Override or extend functionality
  async customInitialization() {
    await this.initialize();
    // Add custom logic
  }
}

const customServer = new CustomMCPServer({
  specsDir: './specs',
  configFile: './config.json'
});
```

## Configuration

### Basic Configuration (`mcp-config.json`)

```json
{
  "baseUrl": "http://localhost:3000",
  "authentication": {
    "type": "bearer",
    "envVar": "API_TOKEN"
  },
  "cors": {
    "origin": "*",
    "credentials": true
  },
  "overrides": [
    {
      "specId": "banking-payments",
      "path": "/api/payments",
      "method": "get",
      "type": "tool",
      "toolName": "search_payments"
    },
    {
      "specId": "banking-products", 
      "path": "/api/products",
      "method": "get",
      "type": "resource",
      "resourceUri": "banking://products/catalog"
    }
  ]
}
```

#### Base URL Configuration

The base URL for backend APIs can be configured in multiple ways with the following priority order:

1. **CLI `--base-url` option** (highest priority)
2. **Config file `baseUrl` setting**
3. **Default: `http://localhost:3000`** (lowest priority)

**Examples:**
```bash
# CLI option overrides config file
mcp-openapi-server --base-url https://api.production.com --config ./mcp-config.json

# When --verbose is used, you'll see which base URL source is active:
# 🌐 Using base URL: https://api.production.com (from CLI --base-url)
```

### Authentication Options

The MCP server supports **token passthrough** - user tokens take priority over service tokens for better security.

**Bearer Token:**
```json
{
  "authentication": {
    "type": "bearer",
    "envVar": "API_TOKEN"  // Service token fallback
  }
}
```

**API Key:**
```json
{
  "authentication": {
    "type": "apikey",
    "headerName": "X-API-Key",
    "envVar": "API_KEY"  // Service token fallback
  }
}
```

**Basic Auth:**
```json
{
  "authentication": {
    "type": "basic",
    "envVar": "BASIC_AUTH_CREDENTIALS"  // Service token fallback
  }
}
```

#### Token Passthrough Priority

1. **User Token** (highest priority) - forwarded from MCP client
   - stdio mode: `USER_API_TOKEN` or `MCP_USER_TOKEN` environment variable
   - HTTP mode: `Authorization` header from request
2. **Service Token** (fallback) - configured in `mcp-config.json`
   - Used when no user token is available
   - Good for system operations and testing

## Enhanced Error Handling

The MCP server provides authentication-aware error handling with structured responses and security monitoring.

### Authentication Error Responses

**401 Unauthorized:**
```json
{
  "error": "AUTHENTICATION_REQUIRED",
  "message": "Invalid or expired authentication token",
  "suggestion": "Check your API token or re-authenticate",
  "status": 401,
  "tool": "banking-payments_post__banking_payments_payTo"
}
```

**403 Forbidden:**
```json
{
  "error": "INSUFFICIENT_PERMISSIONS", 
  "message": "Access denied for this operation",
  "suggestion": "Contact administrator for required permissions",
  "status": 403,
  "tool": "banking-payments_post__banking_payments_payTo"
}
```

### HTTP Error Responses

**Other HTTP Errors (400, 500, etc.):**
```json
{
  "error": "HTTP_ERROR",
  "message": "HTTP 400: Bad Request", 
  "status": 400,
  "tool": "banking-payments_post__banking_payments_payTo",
  "url": "http://localhost:3000/banking/payments",
  "details": {
    "error": "VALIDATION_ERROR",
    "message": "Invalid payment amount",
    "field": "amount"
  }
}
```

### Security Features

- **Security Event Logging**: 401/403 errors are logged with `[SECURITY]` prefix for monitoring
- **Error Context Preservation**: Backend API error responses are included in `details`
- **Privacy Protection**: Query parameters are stripped from URLs in error messages
- **Structured Responses**: All errors return JSON with consistent format instead of throwing exceptions

## OpenAPI Specification Setup

### Custom Spec IDs
Add `x-spec-id` to avoid naming conflicts:

```yaml
openapi: 3.0.0
info:
  title: Banking Products API
  version: 1.0.0
  x-spec-id: banking-products  # Custom identifier
paths:
  /api/products:
    get:
      summary: Get all products
      # ... rest of spec
```

### Tool vs Resource Classification

**Default Mapping:**
- `GET` requests → **Resources** (unless complex)
- `POST`, `PUT`, `PATCH`, `DELETE` → **Tools**

**Complex GET requests become Tools if they have:**
- Parameters named: `search`, `filter`, `query`, `analyze`
- Summaries containing: `search`, `analyze`, `calculate`, `generate`, `process`, `compute`

## Custom Prompts

Create JSON files in the `prompts` directory:

### `prompts/fraud-analysis.json`
```json
{
  "name": "fraud_analysis",
  "description": "Analyze transaction for fraud indicators",
  "arguments": [
    {
      "name": "transaction",
      "description": "Transaction data to analyze",
      "required": true
    },
    {
      "name": "account_history",
      "description": "Recent account activity", 
      "required": true
    }
  ],
  "template": "You are a banking fraud detection expert. Analyze this transaction:\n\nTRANSACTION:\n{{transaction}}\n\nACCOUNT HISTORY:\n{{account_history}}\n\nProvide:\n1. Risk score (0-100)\n2. Risk factors identified\n3. Recommendation (APPROVE/REVIEW/BLOCK)\n4. Reasoning"
}
```

## IDE Integration

### Cursor IDE
Create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "banking-apis": {
      "command": "mcp-openapi-server",
      "args": ["--specs", "./specs", "--config", "./mcp-config.json", "--verbose"],
      "env": {
        "API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Claude Desktop
Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "banking-apis": {
      "command": "mcp-openapi-server",
      "args": ["--specs", "./specs"]
    }
  }
}
```

## API Reference

For detailed programmatic usage examples, see the [Usage Modes](#usage-modes) section above.

### Available Exports

```typescript
// Main class
export { MCPOpenAPIServer } from './server.js';

// All TypeScript interfaces
export * from './types.js';

// Helper functions
export function createMCPServer(options?: ServerOptions): MCPOpenAPIServer;
export async function startServer(options?: ServerOptions & { mode?: 'stdio' | 'http' }): Promise<void>;
```

### TypeScript Interfaces

```typescript
interface ServerOptions {
  specsDir?: string;        // Directory containing OpenAPI specs
  configFile?: string;      // Path to MCP configuration file
  promptsDir?: string;      // Directory containing prompt templates
  port?: number;           // HTTP server port
  verbose?: boolean;       // Enable verbose logging
  baseUrl?: string;        // Base URL for backend APIs (overrides config file)
}
```

## CLI Options

```
Options:
  -s, --specs <dir>     Directory containing OpenAPI specifications (default: "./specs")
  -c, --config <file>   Configuration file path (default: "./mcp-config.json")  
  -p, --prompts <dir>   Directory containing prompt specifications (default: "./prompts")
  --port <number>       Port for HTTP server mode (default: "4000")
  --base-url <url>      Base URL for backend APIs (overrides config file)
  --http                Run in HTTP server mode instead of stdio
  -v, --verbose         Enable verbose logging
  -h, --help            Display help for command
```

## HTTP Endpoints (HTTP Mode)

When running with `--http`, the server exposes:

- `POST /mcp` - MCP JSON-RPC endpoint
- `GET /health` - Health check and stats
- `GET /info` - Detailed server information

### Health Check Response
```json
{
  "status": "ok",
  "specs": ["banking-products", "banking-payments"],
  "tools": 12,
  "resources": 3,
  "prompts": 2,
  "version": "1.0.0"
}
```

## Examples

The `examples/` directory contains a complete banking API example:

### Banking API Example

**Directory Structure:**
```
examples/
├── specs/
│   ├── banking-products.yaml    # Product management API
│   ├── banking-payments.yaml    # Payment processing API
│   └── banking-payees.yaml      # Payee management API
├── prompts/
│   ├── fraud-analysis.json      # Fraud detection prompt
│   └── loan-recommendation.json # Loan recommendation prompt
└── mcp-config.json              # Configuration with overrides
```

**Generated MCP Items:**
- **Tools**: `banking_payments_post_payTo`, `banking_payees_post`, `banking_payees_put`, `banking_payees_delete`, `search_payments`
- **Resources**: `banking-products://banking/products`, `banking-payees://banking/payees`
- **Prompts**: `fraud_analysis`, `loan_recommendation`

### Running the Banking Example

```bash
# Run with the banking examples
mcp-openapi-server --specs ./examples/specs --config ./examples/mcp-config.json --prompts ./examples/prompts --verbose

# Or for HTTP mode
mcp-openapi-server --http --specs ./examples/specs --config ./examples/mcp-config.json --prompts ./examples/prompts
```

### E-commerce API Example

**OpenAPI Spec (`specs/ecommerce.yaml`):**
```yaml
openapi: 3.0.0
info:
  title: E-commerce API
  x-spec-id: ecommerce
paths:
  /products:
    get:
      summary: List products
  /orders:
    post:
      summary: Create order
  /orders/search:
    get:
      summary: Search orders with filters
      parameters:
        - name: search
          in: query
```

**Generated:**
- **Resource**: `ecommerce://products` (simple GET)
- **Tool**: `ecommerce_post_orders` (POST operation)  
- **Tool**: `ecommerce_get_orders_search` (complex GET with search)

## Troubleshooting

### Common Issues

**1. "Specs directory does not exist"**
```bash
mkdir specs
# Add your OpenAPI files to specs/
```

**2. "Tool execution failed"**
- Check `baseUrl` in config
- Verify API server is running
- Check authentication configuration

**3. "No tools/resources generated"**
- Verify OpenAPI specs are valid
- Check file extensions (.yaml, .yml, .json)
- Enable `--verbose` for detailed logging

### Debug Mode
```bash
mcp-openapi-server --verbose
```

## Testing

The project includes comprehensive unit and integration tests:

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run MSW HTTP mocking tests only
npm run test:msw

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure
- `tests/basic.test.ts` - Unit tests validating the banking examples and core functionality (27 tests)
- `tests/integration.test.ts` - Integration tests validating server functionality end-to-end (21 tests)
- `tests/msw-integration.test.ts` - HTTP mocking tests using MSW (Mock Service Worker) (8 tests)

### Test Coverage
The tests validate:
- **Unit Tests (27/27 passing)**:
  - File structure and example completeness
  - OpenAPI spec structure and content
  - Banking API schema definitions and constraints
  - MCP configuration and overrides
  - Custom prompt structure and templates
  - HTTP method classification logic
  - Banking domain-specific validation patterns
  - Authentication configuration handling

- **Integration Tests (21/21 passing)**:
  - Server initialization with banking examples
  - Tool and resource generation from OpenAPI specs
  - Tool structure validation and URL construction
  - Resource URI validation and parsing
  - Custom prompt loading and template processing
  - Configuration handling and authentication
  - Error handling and validation
  - Non-existent item handling

- **MSW HTTP Mocking Tests (13/13 passing)**:
  - HTTP request mocking with successful responses
  - HTTP error response handling (400, 500, etc.)
  - Resource reading with mocked GET requests
  - **Token Passthrough Validation**:
    - 401 errors when no authentication token provided
    - User token passthrough to backend APIs
    - Service token fallback when no user token available
    - User token priority over service tokens
    - Token passthrough for both tools and resources
  - **Enhanced Error Handling**:
    - Authentication-aware error responses (401/403)
    - Structured error messages with actionable suggestions
    - Security event logging for monitoring
    - Backend error context preservation
    - Network error graceful handling

**Total: 61/61 tests passing (100% success rate)**

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 🐛 [Report Issues](https://github.com/yourusername/mcp-openapi-server/issues)
- 💬 [Discussions](https://github.com/yourusername/mcp-openapi-server/discussions)
- 📖 [Documentation](https://github.com/yourusername/mcp-openapi-server/wiki) 