import fs from 'fs';
import { ServerConfig, ServerOptions, ValidatedServerConfig, AuthConfig, HttpsClientConfig } from './types.js';
import { Telemetry } from './telemetry.js';

export class ServerConfigManager {
  private rawConfig: ServerConfig = { overrides: [] };
  private validatedConfig!: ValidatedServerConfig;
  private options: ServerOptions;
  private telemetry: Telemetry;

  constructor(options: ServerOptions, telemetry: Telemetry) {
    this.options = options;
    this.telemetry = telemetry;
  }

  async initialize(): Promise<void> {
    await this.loadConfigFile();
    this.mergeCliOptions();
    this.validateConfiguration();
    this.createValidatedConfig();
    
    // Log which base URL is being used
    const source = this.options.baseUrl ? 'CLI --base-url' : 
                   this.rawConfig.baseUrl ? 'config file' : 'default';
    this.telemetry.debug(`🌐 Using base URL: ${this.validatedConfig.resolvedBaseUrl} (from ${source})`);
  }

  getValidatedConfig(): ValidatedServerConfig {
    return this.validatedConfig;
  }

  getBaseUrl(): string {
    return this.validatedConfig.resolvedBaseUrl;
  }

  getAuthConfig(): AuthConfig | undefined {
    return this.rawConfig.authentication;
  }

  getCorsConfig(): any {
    return this.rawConfig.cors || {};
  }

  getMaxResponseSizeMB(): number {
    return this.rawConfig.maxResponseSizeMB || this.options.maxResponseSizeMB || 50;
  }

  private async loadConfigFile(): Promise<void> {
    try {
      if (fs.existsSync(this.options.configFile!)) {
        const configContent = fs.readFileSync(this.options.configFile!, 'utf8');
        this.rawConfig = { ...this.rawConfig, ...JSON.parse(configContent) };
        
        this.telemetry.debug(`📄 Loaded config from ${this.options.configFile}`);
      }
    } catch (error) {
      this.telemetry.warn(`⚠️  Could not load config file: ${(error as Error).message}`);
    }
  }

  private mergeCliOptions(): void {
    // CLI baseUrl takes precedence over config file
    if (this.options.baseUrl) {
      this.rawConfig.baseUrl = this.options.baseUrl;
    }

    // Merge CLI HTTPS client options with config file
    if (this.hasCliHttpsOptions()) {
      const cliHttpsConfig: HttpsClientConfig = {};
      
      if (this.options.httpsClientCa) cliHttpsConfig.caFile = this.options.httpsClientCa;
      if (this.options.httpsClientCert) cliHttpsConfig.certFile = this.options.httpsClientCert;
      if (this.options.httpsClientKey) cliHttpsConfig.keyFile = this.options.httpsClientKey;
      if (this.options.httpsClientPfx) cliHttpsConfig.pfxFile = this.options.httpsClientPfx;
      if (this.options.httpsClientPassphrase) cliHttpsConfig.passphrase = this.options.httpsClientPassphrase;
      if (this.options.httpsClientRejectUnauthorized !== undefined) {
        cliHttpsConfig.rejectUnauthorized = this.options.httpsClientRejectUnauthorized;
      }
      if (this.options.httpsClientTimeout) cliHttpsConfig.timeout = this.options.httpsClientTimeout;

      // Merge CLI options with config file (CLI takes precedence)
      this.rawConfig.httpsClient = {
        ...this.rawConfig.httpsClient,
        ...cliHttpsConfig
      };
    }

    // Merge maxResponseSizeMB
    if (this.options.maxResponseSizeMB) {
      this.rawConfig.maxResponseSizeMB = this.options.maxResponseSizeMB;
    }
  }

  private hasCliHttpsOptions(): boolean {
    return !!(
      this.options.httpsClientCa ||
      this.options.httpsClientCert ||
      this.options.httpsClientKey ||
      this.options.httpsClientPfx ||
      this.options.httpsClientPassphrase ||
      this.options.httpsClientRejectUnauthorized !== undefined ||
      this.options.httpsClientTimeout
    );
  }

  private validateConfiguration(): void {
    this.validateAuthConfig();
    this.validateOverrides();
    this.validateGeneralSettings();
  }

  private validateAuthConfig(): void {
    const auth = this.rawConfig.authentication;
    if (!auth) return;

    const errors: string[] = [];

    if (!['bearer', 'apikey', 'basic'].includes(auth.type)) {
      errors.push(`Invalid authentication type: ${auth.type}. Must be 'bearer', 'apikey', or 'basic'`);
    }

    if (auth.type === 'apikey' && !auth.headerName) {
      errors.push('headerName is required for apikey authentication');
    }

    if (!auth.envVar) {
      errors.push('envVar is required for authentication configuration');
    }

    if (errors.length > 0) {
      throw new Error(`Authentication configuration errors: ${errors.join('; ')}`);
    }
  }

  private validateOverrides(): void {
    const errors: string[] = [];

    for (const override of this.rawConfig.overrides) {
      if (!override.specId) {
        errors.push('Override missing specId');
      }
      if (!override.path) {
        errors.push('Override missing path');
      }
      if (!override.method) {
        errors.push('Override missing method');
      }
      if (!['tool', 'resource'].includes(override.type)) {
        errors.push(`Invalid override type: ${override.type}. Must be 'tool' or 'resource'`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Override configuration errors: ${errors.join('; ')}`);
    }
  }

  private validateGeneralSettings(): void {
    const errors: string[] = [];

    if (this.rawConfig.maxResponseSizeMB !== undefined) {
      if (this.rawConfig.maxResponseSizeMB < 1 || this.rawConfig.maxResponseSizeMB > 1000) {
        errors.push('maxResponseSizeMB must be between 1 and 1000');
      }
    }

    if (errors.length > 0) {
      throw new Error(`General configuration errors: ${errors.join('; ')}`);
    }
  }

  private createValidatedConfig(): void {
    const validatedHttpsClient = this.rawConfig.httpsClient ? {
      ...this.rawConfig.httpsClient,
      timeout: this.rawConfig.httpsClient.timeout || 30000,
      rejectUnauthorized: this.rawConfig.httpsClient.rejectUnauthorized ?? true,
      keepAlive: this.rawConfig.httpsClient.keepAlive ?? true,
      certificateType: this.determineCertificateType(this.rawConfig.httpsClient)
    } : undefined;

    this.validatedConfig = {
      ...this.rawConfig,
      resolvedBaseUrl: this.options.baseUrl || this.rawConfig.baseUrl || 'http://localhost:3001',
      httpsClient: validatedHttpsClient
    };
  }

  private determineCertificateType(config: HttpsClientConfig): 'none' | 'cert-key' | 'pfx' {
    if (config.pfxFile) return 'pfx';
    if (config.certFile && config.keyFile) return 'cert-key';
    return 'none';
  }

  /**
   * Build authentication headers based on config and user context
   */
  buildAuthHeaders(userContext?: { token?: string }): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Priority 1: Use user's token if provided (token passthrough)
    if (userContext?.token) {
      headers['Authorization'] = `Bearer ${userContext.token}`;
      return headers;
    }
    
    // Priority 2: Fall back to service token from config
    const auth = this.rawConfig.authentication;
    if (auth) {
      const token = process.env[auth.envVar || 'API_TOKEN'];
      
      if (token) {
        switch (auth.type) {
          case 'bearer':
            headers['Authorization'] = `Bearer ${token}`;
            break;
          case 'apikey':
            headers[auth.headerName || 'X-API-Key'] = token;
            break;
          case 'basic':
            headers['Authorization'] = `Basic ${Buffer.from(token).toString('base64')}`;
            break;
        }
      }
    }
    
    return headers;
  }

  /**
   * Extract user context from request (for HTTP mode)
   */
  extractUserContext(request?: any): { token?: string } {
    // Method 1: Check for user token in environment (for stdio mode)
    const userToken = process.env.USER_API_TOKEN || process.env.MCP_USER_TOKEN;
    if (userToken) {
      return { token: userToken };
    }
    
    // Method 2: Extract from request headers (for HTTP mode)
    if (request?.headers?.authorization) {
      const authHeader = request.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        return { token: authHeader.substring(7) };
      }
    }
    
    // Method 3: Check for custom token header
    if (request?.headers?.['x-user-token']) {
      return { token: request.headers['x-user-token'] };
    }
    
    return {};
  }
}
