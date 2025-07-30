export { MCPOpenAPIServer } from './server.js';
export * from './types.js';

// Simple programmatic interface
import { MCPOpenAPIServer } from './server.js';
import { ServerOptions } from './types.js';

export function createMCPServer(options?: ServerOptions): MCPOpenAPIServer {
  return new MCPOpenAPIServer(options);
}

export async function startServer(options?: ServerOptions & { mode?: 'stdio' | 'http' }): Promise<void> {
  const server = new MCPOpenAPIServer(options);
  
  if (options?.mode === 'http') {
    await server.runHttp(options.port);
  } else {
    await server.runStdio();
  }
} 