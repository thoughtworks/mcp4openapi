import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MCPOpenAPIServer } from '../src/server';

// Create MSW server
const server = setupServer();

describe('MSW Integration Test', () => {
  let mcpServer: MCPOpenAPIServer;

  beforeAll(async () => {
    // Start MSW server
    server.listen({
      onUnhandledRequest: 'error'
    });

    // Initialize MCP server
    mcpServer = new MCPOpenAPIServer({
      specsDir: './examples/specs',
      configFile: './examples/mcp-config.json',
      promptsDir: './examples/prompts',
      verbose: false
    });

    await mcpServer.initialize();
  });

  afterAll(() => {
    // Clean up MSW server
    server.close();
  });

  beforeEach(() => {
    // Reset handlers before each test
    server.resetHandlers();
    // Clear environment variables
    delete process.env.BANKING_API_TOKEN;
    delete process.env.USER_API_TOKEN;
  });

  afterEach(() => {
    // Reset handlers after each test
    server.resetHandlers();
  });

  test('should mock HTTP request with MSW and execute payment tool', async () => {
    // Set up MSW mock for the banking API
    server.use(
      http.post('http://localhost:3001/v1/banking/payments/payTo', () => {
        return HttpResponse.json({
          transactionId: 'txn_msw_test_123',
          productName: 'Complete Freedom Savings Account',
          payeeName: 'John Doe',
          paymentExecutionDate: '20240115',
          status: 'initiated',
          message: 'Payment has been successfully initiated via MSW'
        }, { status: 201 })
      })
    );

    // Execute the tool
    const result = await (mcpServer as any).executeTool('banking-payments_create_banking_payments_payTo', {
      accountNumber: '1234567890',
      productId: 'SAV001ABC',
      payeeId: 'payee_test123',
      amount: 150.75,
      paymentDate: '20240115',
      paymentReference: 'MSW integration test payment'
    });

    // Verify the result
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('txn_msw_test_123');
    expect(result.content[0].text).toContain('initiated');
    expect(result.content[0].text).toContain('MSW');
  });

  test('should mock HTTP error response with MSW', async () => {
    // Set up MSW mock for API error
    server.use(
      http.post('http://localhost:3001/v1/banking/payments/payTo', () => {
        return HttpResponse.json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid payment amount'
        }, { status: 400 })
      })
    );

    // Execute the tool and verify structured error response
    const result = await (mcpServer as any).executeTool('banking-payments_create_banking_payments_payTo', {
      accountNumber: '1234567890',
      productId: 'SAV001ABC',
      payeeId: 'payee_test123',
      amount: 0.50, // Invalid amount
      paymentDate: '20240115'
    });

    // Verify structured error response instead of thrown error
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    
    const errorData = JSON.parse(result.content[0].text);
    expect(errorData.error).toBe('HTTP_ERROR');
    expect(errorData.status).toBe(400);
    expect(errorData.message).toBe('HTTP 400: Bad Request');
    expect(errorData.tool).toBe('banking-payments_create_banking_payments_payTo');
    expect(errorData.details).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'Invalid payment amount'
    });
  });

  test('should mock resource reading with MSW', async () => {
    // Set up MSW mock for GET request
    server.use(
      http.get('http://localhost:3001/v1/banking/products', () => {
        return HttpResponse.json({
          products: [
            {
              productId: 'SAV001ABC',
              productName: 'Complete Freedom Savings Account',
              accountId: '1234567890',
              creditLimit: 5000.00,
              currentDrawdown: 1200.50,
              category: 'Savings',
              interestCharged: 2.5
            }
          ]
        }, { status: 200 })
      })
    );

          // Execute resource reading
      const result = await (mcpServer as any).readResource('banking-products://v1/banking/products');

    // Verify the result
    expect(result.contents).toBeDefined();
    expect(result.contents[0].mimeType).toBe('application/json');
    
    const content = JSON.parse(result.contents[0].text);
    expect(content.products).toHaveLength(1);
    expect(content.products[0].productId).toBe('SAV001ABC');
  });

  // NEW TOKEN PASSTHROUGH TESTS
  describe('Token Passthrough Tests', () => {
    test('should fail with 401 when no authentication token is provided', async () => {
      // Set up MSW mock to check for Authorization header and return 401 if missing
      server.use(
        http.post('http://localhost:3001/v1/banking/payments/payTo', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          
          if (!authHeader) {
            return HttpResponse.json({
              error: 'UNAUTHORIZED',
              message: 'Authorization header is required'
            }, { status: 401 });
          }
          
          return HttpResponse.json({
            transactionId: 'txn_should_not_reach_here'
          }, { status: 201 });
        })
      );

      // Execute tool without any authentication
      const result = await (mcpServer as any).executeTool('banking-payments_create_banking_payments_payTo', {
        accountNumber: '1234567890',
        productId: 'SAV001ABC',
        payeeId: 'payee_test123',
        amount: 150.75,
        paymentDate: '20240115'
      });

      // Verify structured error response instead of thrown error
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const errorData = JSON.parse(result.content[0].text);
      expect(errorData.error).toBe('AUTHENTICATION_REQUIRED');
      expect(errorData.status).toBe(401);
      expect(errorData.message).toBe('No authentication token provided');
      expect(errorData.suggestion).toBe('Check your API token or re-authenticate');
      expect(errorData.tool).toBe('banking-payments_create_banking_payments_payTo');
    });

    test('should successfully pass through user token to backend API', async () => {
      const userToken = 'user-jwt-token-12345';
      let receivedAuthHeader: string | null = null;

      // Set up MSW mock to capture and validate the Authorization header
      server.use(
        http.post('http://localhost:3001/v1/banking/payments/payTo', ({ request }) => {
          receivedAuthHeader = request.headers.get('Authorization');
          
          // Validate that we received the expected user token
          if (receivedAuthHeader === `Bearer ${userToken}`) {
            return HttpResponse.json({
              transactionId: 'txn_user_token_success',
              message: 'User token validated successfully',
              userId: 'user-123' // Simulate user-specific response
            }, { status: 201 });
          }
          
          return HttpResponse.json({
            error: 'INVALID_TOKEN',
            message: 'Invalid or missing token'
          }, { status: 401 });
        })
      );

      // Execute tool with user context
      const userContext = { token: userToken };
      const result = await (mcpServer as any).executeTool(
        'banking-payments_create_banking_payments_payTo', 
        {
          accountNumber: '1234567890',
          productId: 'SAV001ABC',
          payeeId: 'payee_test123',
          amount: 150.75,
          paymentDate: '20240115'
        },
        userContext
      );

      // Verify the token was passed through correctly
      expect(receivedAuthHeader).toBe(`Bearer ${userToken}`);
      
      // Verify the response
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.transactionId).toBe('txn_user_token_success');
      expect(responseData.userId).toBe('user-123');
    });

    test('should fall back to service token when no user token provided', async () => {
      const serviceToken = 'service-api-token-67890';
      let receivedAuthHeader: string | null = null;

      // Set service token in environment
      process.env.BANKING_API_TOKEN = serviceToken;

      // Set up MSW mock to capture and validate the Authorization header
      server.use(
        http.post('http://localhost:3001/v1/banking/payments/payTo', ({ request }) => {
          receivedAuthHeader = request.headers.get('Authorization');
          
          // Validate that we received the expected service token
          if (receivedAuthHeader === `Bearer ${serviceToken}`) {
            return HttpResponse.json({
              transactionId: 'txn_service_token_success',
              message: 'Service token validated successfully',
              source: 'service-account'
            }, { status: 201 });
          }
          
          return HttpResponse.json({
            error: 'INVALID_TOKEN',
            message: 'Invalid or missing token'
          }, { status: 401 });
        })
      );

      // Execute tool without user context (should use service token)
      const result = await (mcpServer as any).executeTool('banking-payments_create_banking_payments_payTo', {
        accountNumber: '1234567890',
        productId: 'SAV001ABC',
        payeeId: 'payee_test123',
        amount: 150.75,
        paymentDate: '20240115'
      });

      // Verify the service token was used
      expect(receivedAuthHeader).toBe(`Bearer ${serviceToken}`);
      
      // Verify the response
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.transactionId).toBe('txn_service_token_success');
      expect(responseData.source).toBe('service-account');
    });

    test('should prioritize user token over service token when both are available', async () => {
      const userToken = 'user-priority-token-111';
      const serviceToken = 'service-fallback-token-222';
      let receivedAuthHeader: string | null = null;

      // Set service token in environment
      process.env.BANKING_API_TOKEN = serviceToken;

      // Set up MSW mock to capture the Authorization header
      server.use(
        http.post('http://localhost:3001/v1/banking/payments/payTo', ({ request }) => {
          receivedAuthHeader = request.headers.get('Authorization');
          
          if (receivedAuthHeader === `Bearer ${userToken}`) {
            return HttpResponse.json({
              transactionId: 'txn_user_priority_success',
              message: 'User token took priority',
              tokenType: 'user'
            }, { status: 201 });
          } else if (receivedAuthHeader === `Bearer ${serviceToken}`) {
            return HttpResponse.json({
              transactionId: 'txn_service_fallback',
              message: 'Service token used (should not happen)',
              tokenType: 'service'
            }, { status: 201 });
          }
          
          return HttpResponse.json({
            error: 'INVALID_TOKEN',
            message: 'No valid token provided'
          }, { status: 401 });
        })
      );

      // Execute tool with user context (should prioritize user token)
      const userContext = { token: userToken };
      const result = await (mcpServer as any).executeTool(
        'banking-payments_create_banking_payments_payTo',
        {
          accountNumber: '1234567890',
          productId: 'SAV001ABC',
          payeeId: 'payee_test123',
          amount: 150.75,
          paymentDate: '20240115'
        },
        userContext
      );

      // Verify user token was prioritized over service token
      expect(receivedAuthHeader).toBe(`Bearer ${userToken}`);
      
      // Verify the response indicates user token was used
      expect(result.content).toBeDefined();
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.tokenType).toBe('user');
      expect(responseData.transactionId).toBe('txn_user_priority_success');
    });

    test('should pass through user token for resource reading', async () => {
      const userToken = 'user-resource-token-333';
      let receivedAuthHeader: string | null = null;

      // Set up MSW mock for GET request with token validation
      server.use(
        http.get('http://localhost:3001/v1/banking/products', ({ request }) => {
          receivedAuthHeader = request.headers.get('Authorization');
          
          if (receivedAuthHeader === `Bearer ${userToken}`) {
            return HttpResponse.json({
              products: [
                {
                  productId: 'USER_SAV001',
                  productName: 'User-Specific Savings Account',
                  userId: 'user-123',
                  personalizedOffer: true
                }
              ]
            }, { status: 200 });
          }
          
          return HttpResponse.json({
            error: 'UNAUTHORIZED',
            message: 'Valid user token required'
          }, { status: 401 });
        })
      );

      // Execute resource reading with user context
      const userContext = { token: userToken };
      const result = await (mcpServer as any).readResource(
        'banking-products://v1/banking/products',
        userContext
      );

      // Verify user token was passed through for resource reading
      expect(receivedAuthHeader).toBe(`Bearer ${userToken}`);
      
      // Verify user-specific response
      expect(result.contents).toBeDefined();
      const content = JSON.parse(result.contents[0].text);
      expect(content.products[0].userId).toBe('user-123');
      expect(content.products[0].personalizedOffer).toBe(true);
    });
  });

  // NEW ENHANCED ERROR HANDLING TESTS
  describe('Enhanced Error Handling Tests', () => {
    test('should handle 401 authentication error with user token', async () => {
      const userToken = 'expired-user-token-456';

      server.use(
        http.post('http://localhost:3001/v1/banking/payments/payTo', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          
          if (authHeader === `Bearer ${userToken}`) {
            return HttpResponse.json({
              error: 'TOKEN_EXPIRED',
              message: 'Your authentication token has expired'
            }, { status: 401 });
          }
          
          return HttpResponse.json({ success: true }, { status: 201 });
        })
      );

      const userContext = { token: userToken };
      const result = await (mcpServer as any).executeTool(
        'banking-payments_create_banking_payments_payTo',
        {
          accountNumber: '1234567890',
          productId: 'SAV001ABC',
          payeeId: 'payee_test123',
          amount: 150.75,
          paymentDate: '20240115'
        },
        userContext
      );

      // Verify structured 401 error response
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const errorData = JSON.parse(result.content[0].text);
      expect(errorData.error).toBe('AUTHENTICATION_REQUIRED');
      expect(errorData.status).toBe(401);
      expect(errorData.message).toBe('Invalid or expired authentication token');
      expect(errorData.suggestion).toBe('Check your API token or re-authenticate');
      expect(errorData.tool).toBe('banking-payments_create_banking_payments_payTo');
    });

    test('should handle 403 permission error with structured response', async () => {
      const userToken = 'limited-permissions-token-789';

      server.use(
        http.post('http://localhost:3001/v1/banking/payments/payTo', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          
          if (authHeader === `Bearer ${userToken}`) {
            return HttpResponse.json({
              error: 'INSUFFICIENT_PERMISSIONS',
              message: 'User does not have permission to create payments'
            }, { status: 403 });
          }
          
          return HttpResponse.json({ success: true }, { status: 201 });
        })
      );

      const userContext = { token: userToken };
      const result = await (mcpServer as any).executeTool(
        'banking-payments_create_banking_payments_payTo',
        {
          accountNumber: '1234567890',
          productId: 'SAV001ABC',
          payeeId: 'payee_test123',
          amount: 150.75,
          paymentDate: '20240115'
        },
        userContext
      );

      // Verify structured 403 error response
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const errorData = JSON.parse(result.content[0].text);
      expect(errorData.error).toBe('INSUFFICIENT_PERMISSIONS');
      expect(errorData.status).toBe(403);
      expect(errorData.message).toBe('Access denied for this operation');
      expect(errorData.suggestion).toBe('Contact administrator for required permissions');
      expect(errorData.tool).toBe('banking-payments_create_banking_payments_payTo');
    });

    test('should handle other HTTP errors with preserved context', async () => {
      server.use(
        http.post('http://localhost:3001/v1/banking/payments/payTo', () => {
          return HttpResponse.json({
            error: 'VALIDATION_ERROR',
            message: 'Invalid payment amount',
            field: 'amount'
          }, { status: 400 });
        })
      );

      const result = await (mcpServer as any).executeTool(
        'banking-payments_create_banking_payments_payTo',
        {
          accountNumber: '1234567890',
          productId: 'SAV001ABC',
          payeeId: 'payee_test123',
          amount: -50, // Invalid negative amount
          paymentDate: '20240115'
        }
      );

      // Verify structured HTTP error response
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const errorData = JSON.parse(result.content[0].text);
      expect(errorData.error).toBe('HTTP_ERROR');
      expect(errorData.status).toBe(400);
      expect(errorData.message).toBe('HTTP 400: Bad Request');
      expect(errorData.tool).toBe('banking-payments_create_banking_payments_payTo');
      expect(errorData.details).toEqual({
        error: 'VALIDATION_ERROR',
        message: 'Invalid payment amount',
        field: 'amount'
      });
    });

    test('should handle resource authentication errors', async () => {
      server.use(
        http.get('http://localhost:3001/v1/banking/products', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          
          if (!authHeader) {
            return HttpResponse.json({
              error: 'UNAUTHORIZED',
              message: 'Authentication required'
            }, { status: 401 });
          }
          
          return HttpResponse.json({ products: [] }, { status: 200 });
        })
      );

      // Execute resource reading without authentication
      const result = await (mcpServer as any).readResource('banking-products://v1/banking/products');

      // Verify structured 401 error response for resource
      expect(result.contents).toBeDefined();
      expect(result.contents[0].mimeType).toBe('application/json');
      
      const errorData = JSON.parse(result.contents[0].text);
      expect(errorData.error).toBe('AUTHENTICATION_REQUIRED');
      expect(errorData.status).toBe(401);
      expect(errorData.message).toBe('No authentication token provided');
      expect(errorData.suggestion).toBe('Check your API token or re-authenticate');
      expect(errorData.resource).toBe('banking-products://v1/banking/products');
    });

    test('should handle network errors gracefully', async () => {
      // Configure MSW to allow unhandled requests to pass through
      server.use();
      
      const result = await (mcpServer as any).executeTool(
        'banking-payments_create_banking_payments_payTo',
        {
          accountNumber: '1234567890',
          productId: 'SAV001ABC',
          payeeId: 'payee_test123',
          amount: 150.75,
          paymentDate: '20240115'
        }
      );

      // Verify structured network error response
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const errorData = JSON.parse(result.content[0].text);
      expect(errorData.error).toBe('EXECUTION_FAILED');
      expect(errorData.message).toBe('Failed to execute tool banking-payments_create_banking_payments_payTo');
      expect(errorData.tool).toBe('banking-payments_create_banking_payments_payTo');
      // MSW throws its own error message when no handler is found
      expect(errorData.details).toContain('MSW');
    });
  });
}); 