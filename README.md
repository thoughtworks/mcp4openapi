# API2MCP - Model Context Protocol wrapper for OpenAPI compliant endpoints

The main application mcp-openapi provides a generic MCP Server wrapper over any OpenAPI compliant endpoints.  It will, given the OpenAPI specs, generate MCP tools & resources with some sensible defaults and overridable via configuration.  It will also allow definition of additional MCP Prompts, via config.  It will hosts the MCP end points for all these MCP capabilities and integrate with the backend APIs as per the configuration.

This project provides comprehensive set of apps demonstrating how to use the mcp-openapi MCP Server over existing APIs via the sample banking api app.  

The mcp-test-client is an example MCP client taking in some pre-baked prompts containing some common, but manufactured, banking scenarios and connecting & orchestrating between the scenarios, the MCP server fronting the sample banking APIs and an LLM.

The sample-banking-api and mcp-test-client app are not expected to be re-used and is for demo purposes only.

NOTE:  This mcp-openapi app is not a replacement for https://github.com/ReAPI-com/mcp-openapi project that is enabling IDEs like Cursor to connect to open api specs to support api development.

## 🔄 Integration Flow

```
Sample Banking API ←→ MCP OpenAPI Server ←→ Demo/Test Banking MCP Client ←→ LLM/AI Application
```

1. **Sample Banking API** provides some RESTful banking services with authentication
2. **MCP OpenAPI Server** wraps the API as MCP tools and resources
3. **Test/Demo MCP Client** consumes the MCP server for AI integration
4. **LLM/AI Application** uses the tools through the MCP protocol - for the demo/test we have implemented LM Studio integration


## 🏗️ Project Structure

This repository contains three applications:

### 🔌 [`mcp-openapi/`](./mcp-openapi/)
This contain the main application, a **generic, configurable MCP server** that automatically generates MCP tools and resources from OpenAPI specifications:
- Automatic tool/resource generation from OpenAPI specs
- Token passthrough authentication
- Custom prompt templates
- Multiple deployment modes (stdio/HTTP)
- Comprehensive test coverage (61/61 tests passing)

**Quick Start:**
```bash
cd mcp-openapi
npm install
npm run dev -- --specs ./examples/specs --config ./examples/mcp-config.json --verbose
```


### 📊 [`sample-banking-api/`](./sample-banking-api/)
An example **Sample banking API implementation** with:
- RESTful endpoints for payments, payees, and products
- basic JWT authentication and validation
- OpenAPI specifications
- Comprehensive test suite
- Manufactured data, via JSON files, to support the app 
- Purpose of this is to support the demo and usage of the main application

**Quick Start:**
```bash
cd sample-banking-api
npm install
npm run server:dev
```

### 🧪 [`mcp-test-client/`](./mcp-test-client/)
An example **test client application, including an MCP Client** for validating MCP server functionality over the sample banking app.  The sample client app will also integrate with an LLM, LM Studio integration provided, to demo the MCP flow.


## 🚀 Getting Started

### 1. Start the Banking API
```bash
cd sample-banking-api
npm install
npm run server:dev
# Server runs on http://localhost:3001
```

### 2. Start the MCP Server
```bash
cd mcp-openapi
npm install
npm run dev -- --specs ./examples/specs --config ./examples/mcp-config.json --verbose
# MCP server runs on http://localhost:4000 and will connect to banking API to serve requests
```

### 3. Start/Load you LLM in LM Studio
Load and start you LLM in LM Studio.  This project assumes the LM Studio API will be running on http://localhost:1234

If you need to change the URL, update the /examples/mcp-config.json file in the mcp-openapi app and restart it.

### 4. Testing or running the demo
Refer to the mcp-client-test Readme to launch the demo/client.  It is menu driven with a number of pre-build test scenarios using the manufactured data in the sample banking api app.

## 📋 Features

### Banking API Features
- ✅ Complete CRUD operations for payments, payees, products
- ✅ JWT authentication with bearer tokens
- ✅ OpenAPI 3.0 specifications
- ✅ Request validation and error handling
- ✅ Comprehensive test suite

### MCP Server Features
- ✅ Automatic tool/resource generation from OpenAPI
- ✅ Token passthrough authentication
- ✅ Configuration-driven overrides
- ✅ Custom prompt templates
- ✅ Enhanced error handling with security monitoring
- ✅ Multiple transport modes (stdio/HTTP)

## 🔐 Authentication

The project demonstrates **token passthrough authentication**:
- User tokens are forwarded from MCP client → MCP server → Banking API
- Service tokens provide fallback for system operations
- Enhanced error handling for 401/403 scenarios

## 🧪 Testing

Each component has comprehensive test coverage:

```bash
# Test banking API
cd sample-banking-api
npm test

# Test MCP server (61/61 tests passing)
cd mcp-openapi
npm test
```

## 📚 Documentation

- [Banking API Documentation](./sample-banking-api/README.md)
- [MCP OpenAPI Server Documentation](./mcp-openapi/README.md)
- [MCP Test Client Documentation](./mcp-test-client/README.md) (coming soon)

## 🎯 Use Cases

This project demonstrates:
- **API Wrapping**: How to wrap existing REST APIs as MCP servers
- **Authentication Patterns**: Token passthrough for secure API access
- **Error Handling**: Production-ready error handling with security monitoring
- **Testing Strategies**: Comprehensive test coverage for API wrappers
- **Development Workflow**: Local development with hot reloading

## 🤝 Contributing

Each component can be developed independently:
1. Fork the repository
2. Choose a component to work on
3. Follow the component-specific development instructions
4. Submit a pull request

## 📄 License

MIT License - see individual component directories for details. 