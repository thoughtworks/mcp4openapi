# Base URL Configuration Example

The `mcp-openapi-server` now supports specifying a base URL for backend APIs via command line option. This allows you to point the MCP server to different backend environments without modifying configuration files.

## Usage

### Command Line Option

```bash
# Use a custom base URL
mcp-openapi-server --base-url https://api.example.com --specs ./specs --verbose

# The base URL overrides any baseUrl setting in the config file
mcp-openapi-server --base-url http://localhost:8080 --config ./mcp-config.json
```

### Priority Order

The base URL is resolved in the following priority order:

1. **CLI `--base-url` option** (highest priority)
2. **Config file `baseUrl` setting**
3. **Default: `http://localhost:3000`** (lowest priority)

### Examples

```bash
# Development environment
mcp-openapi-server --base-url http://localhost:3000 --specs ./specs

# Staging environment  
mcp-openapi-server --base-url https://staging-api.example.com --specs ./specs

# Production environment
mcp-openapi-server --base-url https://api.example.com --specs ./specs

# With verbose logging to see which base URL is being used
mcp-openapi-server --base-url https://api.example.com --specs ./specs --verbose
```

### Verbose Output

When using the `--verbose` flag, the server will show which base URL is being used:

```
🚀 Initializing MCP OpenAPI Server...
📄 Loaded config from ./mcp-config.json
📋 Loaded OpenAPI spec: banking-products
📋 Loaded OpenAPI spec: banking-payments
📋 Loaded OpenAPI spec: banking-payees
💬 Loaded prompt: fraud_analysis
💬 Loaded prompt: loan_recommendation
🌐 Using base URL: https://api.example.com (from CLI --base-url)
✅ Loaded 3 specs, 8 tools, 3 resources, 2 prompts
```

### Configuration File vs CLI Option

If your `mcp-config.json` contains:

```json
{
  "baseUrl": "https://config-api.example.com",
  "overrides": [...]
}
```

But you run:

```bash
mcp-openapi-server --base-url https://cli-api.example.com --config ./mcp-config.json
```

The CLI option takes precedence, and `https://cli-api.example.com` will be used as the base URL. 