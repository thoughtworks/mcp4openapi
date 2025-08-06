#!/usr/bin/env node

import { Command } from 'commander';
import { MCPOpenAPIServer } from './server.js';
import { ServerOptions } from './types.js';
import { PACKAGE_NAME, PACKAGE_VERSION } from './package-info.js';

const program = new Command();

program
  .name(PACKAGE_NAME)
  .description('A generic, configurable MCP server that generates tools, resources, and prompts from OpenAPI specifications')
  .version(PACKAGE_VERSION);

program
  .option('-s, --specs <dir>', 'Directory containing OpenAPI specifications', './examples/specs')
  .option('-c, --config <file>', 'Configuration file path', './examples/mcp-config.json')
  .option('-p, --prompts <dir>', 'Directory containing prompt specifications', './examples/prompts')
  .option('--port <number>', 'Port for HTTP server mode', '4000')
  .option('--base-url <url>', 'Base URL for backend APIs (overrides config file)')
  .option('--max-tool-name-length <number>', 'Maximum length for generated tool names', '48')
  .option('--http', 'Run in HTTP server mode instead of stdio', false)
  .option('-v, --verbose', 'Enable verbose logging', true)
  .action(async (options) => {
    const serverOptions: ServerOptions = {
      specsDir: options.specs,
      configFile: options.config,
      promptsDir: options.prompts,
      port: parseInt(options.port),
      verbose: options.verbose,
      ...(options.baseUrl && { baseUrl: options.baseUrl }),
      ...(options.maxToolNameLength && { maxToolNameLength: parseInt(options.maxToolNameLength) })
    };

    const server = new MCPOpenAPIServer(serverOptions);

    try {
      if (options.http) {
        await server.runHttp();
      } else {
        await server.runStdio();
      }
    } catch (error) {
      console.error('❌ Failed to start server:', (error as Error).message);
      process.exit(1);
    }
  });

program.parse(); 