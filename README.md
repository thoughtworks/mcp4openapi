# MCP-OpenAPI Model Context Protocol wrapper for OpenAPI compliant endpoints
This is a Proof-of-Concept project implementing a multi-purpose OpenAPI MCP Server that can be used to proxy any OpenAPI compliant API backend with an MCP Server protocol.  It is POC for this article about [enabling AI Economy over APIs](https://www.linkedin.com/pulse/how-evolve-your-api-economy-ai-steven-peh-f9crc/?trackingId=LksZuog5TsSEwgBO0YvkoA%3D%3D)

This implementation showcases that MCP capabilities like tools and resources are a direct 1-to-1 mapping for RESTFUL APIs and can be dynamically generated based on their specifications in OpenAPI.  We do not need to explicitly and specifically code/build MCP servers for RESTFUL APIs.  As an added feature, this implementation allows the addition of MCP Prompts, via configuration files, to enrich the MCP tools & resources generated from the backend APIs.

The project also comes with an example OpenAPI application hosting some sample banking APIs with some manufactured data, a demo MCP Client application that provides an example use-case of an MCP Client interacting with the MCP Server proxying some sample problems between the sample banking APIs and an LLM (hosting via LMStudio).  

Demo/Testing can also be done without the demo MCP application or LM Studio via integrating the MCP server with an MCP enabled tools such as Cursor IDE (tested) or Windsurf (not tested), etc.

All the above are structured under 3 separate folders under this project:

1. **mcp-openapi** is the reference implementation of the OpenAPI MCP proxy
2. **mcp-test-client** is the demo test client with some sample questions based on the manufactured data in the sample banking app
3. **sample-banking-api** is the sample banking application with a number of OpenAPI endpoints and manufactured data

NOTE:  This mcp-openapi app is not a replacement for https://github.com/ReAPI-com/mcp-openapi project that is enabling IDEs like Cursor to connect to open api specs to support api development.

## 🔄 Integration Flow

```
Sample Banking API ←→ MCP OpenAPI Server ←→ Demo/Test Banking MCP Client ←→ LLM via LM Studio
```
or

```
Sample Banking API ←→ MCP OpenAPI Server ←→ Cursor IDE
```


## 🏗️ Project Structure

This repository contains three applications:

### 🔌 [`mcp-openapi/`](./mcp-openapi/)
This contain the main application, a **multi-purpose, configurable MCP server** that automatically generates MCP tools and resources from OpenAPI specifications:
- Automatic tool/resource generation from OpenAPI specs
- Token passthrough authentication
- Addition of custom prompt templates
- Multiple deployment modes (stdio/HTTP)

**Quick Start:**
```bash
cd mcp-openapi
npm install
npm run build
npm run dev
```

The "dev" startup is pre-configured to integrate with the sample banking api app.  Please refer to the README in the app folder for more details.

### 📊 [`sample-banking-api/`](./sample-banking-api/)
An example **Sample banking API implementation** with:
- RESTful endpoints for payments, payees, and products
- basic JWT authentication and validation
- OpenAPI specifications
- Manufactured data, via JSON files, to support the app 
- Purpose of this is to support the demo and usage of the main application

**Quick Start:**
```bash
cd sample-banking-api
npm install
npm start
```

Please refer to the README in the app folder for more details.

### 🧪 [`mcp-test-client/`](./mcp-test-client/)
A **Demo MCP client application** for validating MCP server functionality over the sample banking app.  The sample client app will also integrate with an LLM, via a local LM Studio integration, to demo the MCP flow.

This requires LM Studio to be running locally on default port 1234 (i.e. http://localhost:1234), but configurable if it is running on different port.  LM Studio must be loaded with an LLM that supports tool calling (tested on meta-llama-3.1-8b-instruct model).

**Quick Start:**
```bash
cd mcp-test-client
npm install
npm start
```
This will launch the demo mcp client which is a CLI menu driven app with a few pre-configured test scenarios against the manufactured data in the sample banking app.

Please refer to the README in the app folder for more details.

## 📋 Features

### Sample Banking API Features
- ✅ Sample data with APIs for payments, payees, products
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
- ✅ Multiple transport modes (stdio/MCP Streaming HTTP/HTTPS)
- ✅ MCP Streaming HTTP protocol with session management
- ✅ HTTPS support with TLS encryption for secure deployments
- 🚧 Server-Sent Events (SSE) support (placeholder for future implementation)

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
- **Multi-purpose API Wrapping**: How to wrap existing REST APIs with an MCP server
- **MCP Prompts augmentation**: Adding custom MCP prompts to enable higher order/composite usage of those API via MCP

## 🤝 Contributing

Each component can be developed independently:
1. Fork the repository
2. Choose a component to work on
3. Follow the component-specific development instructions
4. Submit a pull request

## 📄 License

MIT License - see individual component directories for details. 