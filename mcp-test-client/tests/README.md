# MCP Test Client - Unit Tests

This directory contains comprehensive unit tests for the MCP Test Client components.

## Test Framework

- **Jest**: Primary testing framework with TypeScript support
- **Coverage**: Code coverage reporting with thresholds
- **Mocking**: Extensive mocking of external dependencies (file system, network calls, etc.)

## Test Structure

### Test Files

- `llm-factory.test.ts` - Tests for the LLM Factory pattern and provider management
- `config-manager.test.ts` - Tests for configuration loading and management
- `mcp-client.test.ts` - Tests for MCP server communication and protocol handling
- `generic-orchestrator.test.ts` - Tests for orchestration logic and multi-round conversations

### Test Setup

- `setup.ts` - Global test configuration, mocks, and utilities
- `jest.config.js` - Jest configuration with TypeScript and ESM support

## Running Tests

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests for CI (no watch, with coverage)
npm run test:ci
```

### Running Specific Tests

```bash
# Run tests for a specific file
npm test -- llm-factory.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should create LLM"

# Run tests for a specific describe block
npm test -- --testNamePattern="LLMFactory"
```

## Test Coverage

The test suite maintains high coverage standards:

- **Branches**: 70% minimum
- **Functions**: 70% minimum  
- **Lines**: 70% minimum
- **Statements**: 70% minimum

Coverage reports are generated in the `coverage/` directory.

## Mocking Strategy

### Global Mocks

- `fetch`: All network calls are mocked globally
- `fs`: File system operations are mocked
- `console`: Console output is suppressed during tests

### Component-Specific Mocks

- **LLM Factory**: Mocks the RealLLMLMStudio class
- **Config Manager**: Mocks file system reads/writes
- **MCP Client**: Mocks network requests to MCP servers
- **Generic Orchestrator**: Uses a custom MockLLM implementation

## Test Patterns

### 1. Component Testing
Each component is tested in isolation with appropriate mocks.

### 2. Error Handling
Tests verify proper error handling for various failure scenarios.

### 3. Edge Cases
Tests cover edge cases like empty inputs, malformed data, and network failures.

### 4. Integration Points
Tests verify that components interact correctly through their interfaces.

## Adding New Tests

When adding new tests:

1. **Follow naming conventions**: `*.test.ts` files in the `tests/` directory
2. **Use descriptive test names**: Clearly describe what is being tested
3. **Mock external dependencies**: Keep tests isolated and fast
4. **Test both success and failure paths**: Include error scenarios
5. **Maintain coverage**: Ensure new code is covered by tests

### Example Test Structure

```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup mocks and test data
  });

  describe('method name', () => {
    it('should handle normal case', async () => {
      // Test implementation
    });

    it('should handle error case', async () => {
      // Test error handling
    });
  });
});
```

## Debugging Tests

### Enabling Console Output

```typescript
// In individual tests, restore console to see output
beforeEach(() => {
  jest.restoreAllMocks();
});
```

### Running Single Tests

```bash
# Run a single test file with verbose output
npm test -- --verbose llm-factory.test.ts

# Run a specific test case
npm test -- --testNamePattern="should create LLM with default config"
```

### Debugging in VSCode

1. Set breakpoints in test files
2. Use "Jest: Debug Current File" command
3. Or create a debug configuration in `.vscode/launch.json`

## Continuous Integration

Tests are configured to run in CI environments with:

- Non-interactive mode (`--ci` flag)
- Coverage reporting
- Fail-fast behavior for quick feedback
- Proper exit codes for CI systems

The test suite is designed to be fast, reliable, and provide comprehensive coverage of the MCP Test Client functionality. 