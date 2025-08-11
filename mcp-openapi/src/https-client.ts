import https from 'https';
import fs from 'fs';
import { HttpsClientConfig, ValidatedHttpsClientConfig, CertificateData } from './types.js';
import { Telemetry } from './telemetry.js';

export class HttpsClientManager {
  private httpsAgent?: https.Agent;
  private validatedConfig: ValidatedHttpsClientConfig;
  private telemetry: Telemetry;
  private enabled: boolean = false;

  constructor(config: HttpsClientConfig, telemetry: Telemetry) {
    this.telemetry = telemetry;
    this.validatedConfig = this.createValidatedConfig(config);
  }

  initialize(): void {
    // If no meaningful HTTPS config provided, don't enable HTTPS client
    if (!this.hasMeaningfulConfig()) {
      this.enabled = false;
      this.telemetry.debug('📡 Using default HTTP client for backend APIs');
      return;
    }

    this.validateHttpsConfig();
    this.setupHttpsAgent();
    this.enabled = true;
    this.telemetry.info('🔒 HTTPS client configured for backend API connections');
  }

  isHttpsEnabled(): boolean {
    return this.enabled;
  }

  getAgent(): https.Agent | undefined {
    return this.httpsAgent;
  }

  applyToFetchOptions(url: string, options: RequestInit): void {
    if (!this.enabled) {
      return;
    }

    // Apply HTTPS agent only for HTTPS URLs
    if (url.startsWith('https://') && this.httpsAgent) {
      (options as any).agent = this.httpsAgent;
    }

    // Apply timeout
    if (this.validatedConfig.timeout) {
      (options as any).signal = AbortSignal.timeout(this.validatedConfig.timeout);
    }
  }

  private createValidatedConfig(config: HttpsClientConfig): ValidatedHttpsClientConfig {
    return {
      ...config,
      timeout: config.timeout || 30000,
      rejectUnauthorized: config.rejectUnauthorized ?? true,
      keepAlive: config.keepAlive ?? true,
      certificateType: this.determineCertificateType(config)
    };
  }

  private determineCertificateType(config: HttpsClientConfig): 'none' | 'cert-key' | 'pfx' {
    if (config.pfxFile) return 'pfx';
    if (config.certFile && config.keyFile) return 'cert-key';
    return 'none';
  }

  private hasMeaningfulConfig(): boolean {
    const config = this.validatedConfig;
    return !!(
      config.certFile || 
      config.keyFile || 
      config.pfxFile || 
      config.caFile ||
      config.rejectUnauthorized !== true || // Non-default value
      config.timeout !== 30000 || // Non-default value
      config.keepAlive !== true // Non-default value
    );
  }

  private validateHttpsConfig(): void {
    const errors: string[] = [];
    const config = this.validatedConfig;

    // Validate certificate configuration groups
    const hasCertKey = config.certFile || config.keyFile;
    const hasPfx = config.pfxFile;

    if (hasCertKey && hasPfx) {
      errors.push('Cannot specify both cert/key files and PFX file simultaneously');
    }

    // GROUP A: Cert/Key validation
    if (config.certFile && !config.keyFile) {
      errors.push('keyFile is required when certFile is specified');
    }
    if (config.keyFile && !config.certFile) {
      errors.push('certFile is required when keyFile is specified');
    }

    // Validate file existence
    const filesToCheck = [
      { path: config.certFile, name: 'certFile' },
      { path: config.keyFile, name: 'keyFile' },
      { path: config.pfxFile, name: 'pfxFile' },
      { path: config.caFile, name: 'caFile' }
    ].filter(f => f.path);

    for (const file of filesToCheck) {
      if (!fs.existsSync(file.path!)) {
        errors.push(`${file.name} not found: ${file.path}`);
      }
    }

    // Check if encrypted files have passphrase
    const certOrPfxFile = config.certFile || config.pfxFile;
    if (certOrPfxFile && this.isEncryptedFile(certOrPfxFile)) {
      if (!config.passphrase) {
        errors.push('passphrase is required for encrypted certificate files');
      }
    }

    // Validate timeout
    if (config.timeout < 1000 || config.timeout > 300000) {
      errors.push('timeout must be between 1000ms and 300000ms');
    }

    // FAIL STARTUP if any validation errors
    if (errors.length > 0) {
      const errorMessage = `❌ HTTPS client configuration errors:\n${errors.map(e => `  • ${e}`).join('\n')}`;
      this.telemetry.error(errorMessage);
      throw new Error(`Invalid HTTPS client configuration: ${errors.join('; ')}`);
    }
  }

  private isEncryptedFile(filePath: string): boolean {
    if (!filePath || !fs.existsSync(filePath)) return false;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return content.includes('ENCRYPTED') || content.includes('Proc-Type: 4,ENCRYPTED');
    } catch {
      return false; // Assume not encrypted if can't read
    }
  }

  private setupHttpsAgent(): void {
    const agentOptions: https.AgentOptions = {
      rejectUnauthorized: this.validatedConfig.rejectUnauthorized,
      keepAlive: this.validatedConfig.keepAlive,
    };

    try {
      const certificates = this.loadCertificates();

      if (certificates.ca) {
        agentOptions.ca = certificates.ca;
        this.telemetry.debug(`📋 Loaded CA certificate from ${this.validatedConfig.caFile}`);
      }

      if (certificates.cert && certificates.key) {
        agentOptions.cert = certificates.cert;
        agentOptions.key = certificates.key;
        if (certificates.passphrase) {
          agentOptions.passphrase = certificates.passphrase;
        }
        this.telemetry.debug(`🔑 Loaded client certificate from ${this.validatedConfig.certFile}`);
      }

      if (certificates.pfx) {
        agentOptions.pfx = certificates.pfx;
        if (certificates.passphrase) {
          agentOptions.passphrase = certificates.passphrase;
        }
        this.telemetry.debug(`📦 Loaded PFX certificate from ${this.validatedConfig.pfxFile}`);
      }

      this.httpsAgent = new https.Agent(agentOptions);

    } catch (error) {
      const errorMessage = `Failed to setup HTTPS client: ${(error as Error).message}`;
      this.telemetry.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  private loadCertificates(): CertificateData {
    const config = this.validatedConfig;
    const certificates: CertificateData = {};

    try {
      // Load CA certificate
      if (config.caFile) {
        certificates.ca = fs.readFileSync(config.caFile);
      }

      // Load client certificates (cert/key pair)
      if (config.certFile && config.keyFile) {
        certificates.cert = fs.readFileSync(config.certFile);
        certificates.key = fs.readFileSync(config.keyFile);
        if (config.passphrase) {
          certificates.passphrase = config.passphrase;
        }
      }

      // Load PFX certificate
      if (config.pfxFile) {
        certificates.pfx = fs.readFileSync(config.pfxFile);
        if (config.passphrase) {
          certificates.passphrase = config.passphrase;
        }
      }

      return certificates;

    } catch (error) {
      throw new Error(`Failed to load certificate files: ${(error as Error).message}`);
    }
  }
}
