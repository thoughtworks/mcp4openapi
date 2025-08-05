import { describe, test, expect, beforeEach, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('Banking API Examples Tests', () => {
  const examplesDir = path.join(__dirname, '..', 'examples');
  const specsDir = path.join(examplesDir, 'specs');
  const promptsDir = path.join(examplesDir, 'prompts');
  const configFile = path.join(examplesDir, 'mcp-config.json');

  describe('File Structure', () => {
    test('should have examples directory', () => {
      expect(fs.existsSync(examplesDir)).toBe(true);
    });

    test('should have specs directory', () => {
      expect(fs.existsSync(specsDir)).toBe(true);
    });

    test('should have prompts directory', () => {
      expect(fs.existsSync(promptsDir)).toBe(true);
    });

    test('should have config file', () => {
      expect(fs.existsSync(configFile)).toBe(true);
    });
  });

  describe('OpenAPI Specifications', () => {
    test('should have banking-products.yaml', () => {
      const productsSpec = path.join(specsDir, 'banking-products.yaml');
      expect(fs.existsSync(productsSpec)).toBe(true);
      
      const content = fs.readFileSync(productsSpec, 'utf8');
      const spec = yaml.load(content) as any;
      
      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info.title).toBe('Banking Product API');
      expect(spec.paths).toBeDefined();
      expect(spec.paths['/v1/banking/products']).toBeDefined();
      expect(spec.paths['/v1/banking/products/{productId}']).toBeDefined();
    });

    test('should have banking-payments.yaml', () => {
      const paymentsSpec = path.join(specsDir, 'banking-payments.yaml');
      expect(fs.existsSync(paymentsSpec)).toBe(true);
      
      const content = fs.readFileSync(paymentsSpec, 'utf8');
      const spec = yaml.load(content) as any;
      
      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info.title).toBe('Banking Payment API');
      expect(spec.paths).toBeDefined();
      expect(spec.paths['/v1/banking/payments']).toBeDefined();
      expect(spec.paths['/v1/banking/payments/payTo']).toBeDefined();
    });

    test('should have banking-payees.yaml', () => {
      const payeesSpec = path.join(specsDir, 'banking-payees.yaml');
      expect(fs.existsSync(payeesSpec)).toBe(true);
      
      const content = fs.readFileSync(payeesSpec, 'utf8');
      const spec = yaml.load(content) as any;
      
      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info.title).toBe('Banking Payee Management API');
      expect(spec.paths).toBeDefined();
      expect(spec.paths['/v1/banking/payees']).toBeDefined();
      expect(spec.paths['/v1/banking/payees/{payeeId}']).toBeDefined();
    });
  });

  describe('Banking Products API Structure', () => {
    let productsSpec: any;

    beforeAll(() => {
      const productsSpecFile = path.join(specsDir, 'banking-products.yaml');
      const content = fs.readFileSync(productsSpecFile, 'utf8');
      productsSpec = yaml.load(content);
    });

    test('should have correct product endpoints', () => {
      expect(productsSpec.paths['/v1/banking/products'].get).toBeDefined();
      expect(productsSpec.paths['/v1/banking/products/{productId}'].get).toBeDefined();
    });

    test('should have product schema definitions', () => {
      expect(productsSpec.components.schemas.Product).toBeDefined();
      expect(productsSpec.components.schemas.ProductListResponse).toBeDefined();
      expect(productsSpec.components.schemas.ErrorResponse).toBeDefined();
    });

    test('should have proper product properties', () => {
      const productSchema = productsSpec.components.schemas.Product;
      expect(productSchema.required).toContain('productId');
      expect(productSchema.required).toContain('productName');
      expect(productSchema.required).toContain('accountId');
      expect(productSchema.properties.productId).toBeDefined();
      expect(productSchema.properties.creditLimit).toBeDefined();
      expect(productSchema.properties.category.enum).toEqual(['Card', 'Loan', 'Savings', 'Fixed']);
    });
  });

  describe('Banking Payments API Structure', () => {
    let paymentsSpec: any;

    beforeAll(() => {
      const paymentsSpecFile = path.join(specsDir, 'banking-payments.yaml');
      const content = fs.readFileSync(paymentsSpecFile, 'utf8');
      paymentsSpec = yaml.load(content);
    });

    test('should have correct payment endpoints', () => {
      expect(paymentsSpec.paths['/v1/banking/payments'].get).toBeDefined();
      expect(paymentsSpec.paths['/v1/banking/payments/payTo'].post).toBeDefined();
    });

    test('should have payment schema definitions', () => {
      expect(paymentsSpec.components.schemas.PayToRequest).toBeDefined();
      expect(paymentsSpec.components.schemas.PayToResponse).toBeDefined();
      expect(paymentsSpec.components.schemas.PaymentSearchResponse).toBeDefined();
      expect(paymentsSpec.components.schemas.PaymentRecord).toBeDefined();
    });

    test('should have proper payment request properties', () => {
      const payToSchema = paymentsSpec.components.schemas.PayToRequest;
      expect(payToSchema.required).toEqual(['accountNumber', 'productId', 'payeeId', 'amount', 'paymentDate']);
      expect(payToSchema.properties.accountNumber).toBeDefined();
      expect(payToSchema.properties.amount.minimum).toBe(1.01);
      expect(payToSchema.properties.paymentDate.pattern).toBe('^[0-9]{8}$');
    });
  });

  describe('Banking Payees API Structure', () => {
    let payeesSpec: any;

    beforeAll(() => {
      const payeesSpecFile = path.join(specsDir, 'banking-payees.yaml');
      const content = fs.readFileSync(payeesSpecFile, 'utf8');
      payeesSpec = yaml.load(content);
    });

    test('should have correct payee endpoints', () => {
      expect(payeesSpec.paths['/v1/banking/payees']).toBeDefined();
      expect(payeesSpec.paths['/v1/banking/payees/{payeeId}']).toBeDefined();
      // Check specific HTTP methods exist
      expect(payeesSpec.paths['/v1/banking/payees'].post).toBeDefined();
      expect(payeesSpec.paths['/v1/banking/payees/{payeeId}'].get).toBeDefined();
      expect(payeesSpec.paths['/v1/banking/payees/{payeeId}'].put).toBeDefined();
      expect(payeesSpec.paths['/v1/banking/payees/{payeeId}'].delete).toBeDefined();
    });

    test('should have payee schema definitions', () => {
      expect(payeesSpec.components.schemas.CreatePayeeRequest).toBeDefined();
      expect(payeesSpec.components.schemas.PayeeProfile).toBeDefined();
      expect(payeesSpec.components.schemas.PayeeListResponse).toBeDefined();
    });

    test('should have proper payee creation properties', () => {
      const createPayeeSchema = payeesSpec.components.schemas.CreatePayeeRequest;
      expect(createPayeeSchema.required).toEqual(['accountNumber', 'payeeAlias', 'payeeName']);
      expect(createPayeeSchema.properties.payeeAlias.maxLength).toBe(20);
      expect(createPayeeSchema.properties.payId.pattern).toBe('^[0-9]{10}$');
    });
  });

  describe('MCP Configuration', () => {
    let config: any;

    beforeAll(() => {
      const content = fs.readFileSync(configFile, 'utf8');
      config = JSON.parse(content);
    });

    test('should have valid configuration structure', () => {
      expect(config.baseUrl).toBe('http://localhost:3001');
      expect(config.authentication).toBeDefined();
      expect(config.cors).toBeDefined();
      expect(config.overrides).toBeDefined();
    });

    test('should have authentication configuration', () => {
      expect(config.authentication.type).toBe('bearer');
      expect(config.authentication.envVar).toBe('BANKING_API_TOKEN');
    });

    test('should have override configurations', () => {
      expect(Array.isArray(config.overrides)).toBe(true);
      expect(config.overrides.length).toBeGreaterThan(0);
      
      const paymentOverride = config.overrides.find((o: any) => 
        o.specId === 'banking-payments' && o.path === '/v1/banking/payments'
      );
      expect(paymentOverride).toBeDefined();
      expect(paymentOverride.type).toBe('tool');
    });
  });

  describe('MCP Prompts', () => {
    test('should have fraud-analysis.json', () => {
      const fraudAnalysisFile = path.join(promptsDir, 'fraud-analysis.json');
      expect(fs.existsSync(fraudAnalysisFile)).toBe(true);
      
      const content = fs.readFileSync(fraudAnalysisFile, 'utf8');
      const prompt = JSON.parse(content);
      
      expect(prompt.name).toBe('fraud_analysis');
      expect(prompt.description).toContain('fraud');
      expect(Array.isArray(prompt.arguments)).toBe(true);
      expect(prompt.template).toBeDefined();
      expect(prompt.template).toContain('{{transaction}}');
    });

    test('should have loan-recommendation.json', () => {
      const loanRecommendationFile = path.join(promptsDir, 'loan-recommendation.json');
      expect(fs.existsSync(loanRecommendationFile)).toBe(true);
      
      const content = fs.readFileSync(loanRecommendationFile, 'utf8');
      const prompt = JSON.parse(content);
      
      expect(prompt.name).toBe('loan_recommendation');
      expect(prompt.description).toContain('loan');
      expect(Array.isArray(prompt.arguments)).toBe(true);
      expect(prompt.template).toBeDefined();
      expect(prompt.template).toContain('{{customer_profile}}');
    });

    test('fraud analysis prompt should have proper structure', () => {
      const fraudAnalysisFile = path.join(promptsDir, 'fraud-analysis.json');
      const content = fs.readFileSync(fraudAnalysisFile, 'utf8');
      const prompt = JSON.parse(content);
      
      expect(prompt.arguments).toHaveLength(3);
      expect(prompt.arguments[0].name).toBe('transaction');
      expect(prompt.arguments[0].required).toBe(true);
      expect(prompt.arguments[1].name).toBe('account_history');
      expect(prompt.arguments[2].name).toBe('payee_info');
      expect(prompt.arguments[2].required).toBe(false);
    });

    test('loan recommendation prompt should have proper structure', () => {
      const loanRecommendationFile = path.join(promptsDir, 'loan-recommendation.json');
      const content = fs.readFileSync(loanRecommendationFile, 'utf8');
      const prompt = JSON.parse(content);
      
      expect(prompt.arguments).toHaveLength(3);
      expect(prompt.arguments[0].name).toBe('customer_profile');
      expect(prompt.arguments[0].required).toBe(true);
      expect(prompt.arguments[1].name).toBe('financial_goals');
      expect(prompt.arguments[1].required).toBe(true);
      expect(prompt.arguments[2].name).toBe('account_history');
      expect(prompt.arguments[2].required).toBe(false);
    });
  });

  describe('MCP Classification Logic', () => {
    test('should classify HTTP methods for MCP types', () => {
      const methodClassifications = [
        { method: 'GET', expectedDefault: 'resource', reasoning: 'Simple data retrieval' },
        { method: 'POST', expectedDefault: 'tool', reasoning: 'Creates new resources' },
        { method: 'PUT', expectedDefault: 'tool', reasoning: 'Updates existing resources' },
        { method: 'PATCH', expectedDefault: 'tool', reasoning: 'Partial updates' },
        { method: 'DELETE', expectedDefault: 'tool', reasoning: 'Removes resources' }
      ];

      methodClassifications.forEach(({ method, expectedDefault, reasoning }) => {
        if (method === 'GET') {
          expect(expectedDefault).toBe('resource');
        } else {
          expect(expectedDefault).toBe('tool');
        }
      });
    });

    test('should identify complex GET operations that should be tools', () => {
      const complexGetOperations = [
        'Search past payments',
        'Analyze transaction patterns',
        'Generate financial report',
        'Calculate risk score',
        'Process account data'
      ];

      const simpleGetOperations = [
        'Fetch product by productId',
        'Get payee profile',
        'List account products',
        'Retrieve payee details'
      ];

      complexGetOperations.forEach(summary => {
        const hasBusinessLogic = summary.toLowerCase().match(
          /\b(search|analyze|calculate|generate|process|compute)\b/
        );
        expect(hasBusinessLogic).toBeTruthy();
      });

      simpleGetOperations.forEach(summary => {
        const hasBusinessLogic = summary.toLowerCase().match(
          /\b(search|analyze|calculate|generate|process|compute)\b/
        );
        expect(hasBusinessLogic).toBeFalsy();
      });
    });
  });

  describe('Banking Domain Validation', () => {
    test('should validate banking-specific patterns', () => {
      const bankingPatterns = {
        accountNumber: '^[0-9]+$',
        productId: '^[a-zA-Z0-9]+$',
        payeeId: '^payee_[a-zA-Z0-9]+$',
        transactionId: '^txn_pay_[a-zA-Z0-9]+$',
        paymentDate: '^[0-9]{8}$',
        payId: '^[0-9]{10}$',
        bsb: '^[0-9]{6}$'
      };

      // Test account number pattern
      expect('1234567890').toMatch(new RegExp(bankingPatterns.accountNumber));
      expect('abc123').not.toMatch(new RegExp(bankingPatterns.accountNumber));

      // Test product ID pattern
      expect('SAV001ABC').toMatch(new RegExp(bankingPatterns.productId));
      expect('SAV-001-ABC').not.toMatch(new RegExp(bankingPatterns.productId));

      // Test payee ID pattern
      expect('payee_7f8a9b2c1d3e4f5g').toMatch(new RegExp(bankingPatterns.payeeId));
      expect('user_123').not.toMatch(new RegExp(bankingPatterns.payeeId));

      // Test payment date pattern
      expect('20240115').toMatch(new RegExp(bankingPatterns.paymentDate));
      expect('2024-01-15').not.toMatch(new RegExp(bankingPatterns.paymentDate));
    });

    test('should validate banking amount constraints', () => {
      const validAmounts = [1.01, 100.50, 5000.00, 999999.99];
      const invalidAmounts = [0, 0.50, 1.00, 1.001];

      validAmounts.forEach(amount => {
        expect(amount).toBeGreaterThan(1.00);
        // Check that amount has at most 2 decimal places
        const rounded = Math.round(amount * 100) / 100;
        expect(amount).toBe(rounded);
      });

      invalidAmounts.forEach(amount => {
        if (amount <= 1.00) {
          expect(amount).toBeLessThanOrEqual(1.00);
        } else {
          // Check for more than 2 decimal places
          const rounded = Math.round(amount * 100) / 100;
          expect(amount).not.toBe(rounded);
        }
      });
    });
  });
});