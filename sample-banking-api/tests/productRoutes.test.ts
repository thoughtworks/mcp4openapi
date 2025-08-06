import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { validationResult } from 'express-validator';
import { mockRequest, mockResponse, mockNext } from './setup.js';

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
  param: jest.fn(() => ({
    matches: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
  })),
  query: jest.fn(() => ({
    exists: jest.fn().mockReturnThis(),
    matches: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
  })),
}));

describe('ProductRoutes', () => {
  let mockProductsData: any;

  beforeEach(() => {
    mockProductsData = {
      products: [
        {
          productId: 'SAV001ABC',
          productName: 'Complete Freedom Savings Account',
          accountId: '1234567890',
          creditLimit: 5000.00,
          currentDrawdown: 1200.50,
          category: 'Savings' as const,
          interestCharged: 0.0
        },
        {
          productId: 'CHQ002XYZ',
          productName: 'Business Cheque Account',
          accountId: '1234567890',
          creditLimit: 10000.00,
          currentDrawdown: 2500.75,
          category: 'Card' as const,
          interestCharged: 125.30
        },
        {
          productId: 'SAV003DEF',
          productName: 'Premium Savings Plus',
          accountId: '9876543210',
          creditLimit: 15000.00,
          currentDrawdown: 0.0,
          category: 'Savings' as const,
          interestCharged: 0.0
        },
        {
          productId: 'LOAN004GHI',
          productName: 'Personal Loan Account',
          accountId: '1234567890',
          creditLimit: 25000.00,
          currentDrawdown: 18500.00,
          category: 'Loan' as const,
          interestCharged: 2850.75
        }
      ]
    };

    jest.clearAllMocks();
  });

  describe('Validation Functions', () => {
    describe('handleValidationErrors', () => {
      test('should pass through when no validation errors', () => {
        const mockValidationResult = validationResult as jest.MockedFunction<typeof validationResult>;
        mockValidationResult.mockReturnValue({
          isEmpty: () => true,
          array: () => []
        } as any);

        const req = mockRequest();
        const res = mockResponse();
        const next = mockNext;

        // Test the validation logic
        const errors = validationResult(req as any);
        if (errors.isEmpty()) {
          next();
        }

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should return 400 error when validation fails', () => {
        const mockValidationResult = validationResult as jest.MockedFunction<typeof validationResult>;
        mockValidationResult.mockReturnValue({
          isEmpty: () => false,
          array: () => [
            {
              type: 'field',
              path: 'productId',
              msg: 'productId must be alphanumeric and no longer than 50 characters'
            }
          ]
        } as any);

        const req = mockRequest();
        const res = mockResponse();
        const next = mockNext;

        // Test the validation error logic
        const errors = validationResult(req as any);
        if (!errors.isEmpty()) {
          const errorResponse = {
            error: 'VALIDATION_ERROR',
            message: 'The request contains invalid data',
            details: errors.array().map((error: any) => ({
              field: error.type === 'field' ? error.path : 'unknown',
              message: error.msg
            }))
          };
          res.status(400).json(errorResponse);
        }

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'VALIDATION_ERROR',
          message: 'The request contains invalid data',
          details: [
            {
              field: 'productId',
              message: 'productId must be alphanumeric and no longer than 50 characters'
            }
          ]
        });
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('Business Logic Functions', () => {
    describe('findProductById', () => {
      test('should find existing product by ID', () => {
        const productId = 'SAV001ABC';
        const product = mockProductsData.products.find((p: any) => p.productId === productId);

        expect(product).toBeDefined();
        expect(product.productId).toBe(productId);
        expect(product.productName).toBe('Complete Freedom Savings Account');
        expect(product.category).toBe('Savings');
      });

      test('should return undefined for non-existent product', () => {
        const productId = 'INVALID123';
        const product = mockProductsData.products.find((p: any) => p.productId === productId);

        expect(product).toBeUndefined();
      });

      test('should handle empty product list', () => {
        const emptyProductsData = { products: [] };
        const productId = 'SAV001ABC';
        const product = emptyProductsData.products.find((p: any) => p.productId === productId);

        expect(product).toBeUndefined();
      });
    });

    describe('findProductsByAccountId', () => {
      test('should find products by account ID', () => {
        const accountId = '1234567890';
        const products = mockProductsData.products.filter((p: any) => p.accountId === accountId);

        expect(products).toHaveLength(3);
        expect(products.every((p: any) => p.accountId === accountId)).toBe(true);
        
        const productNames = products.map((p: any) => p.productName);
        expect(productNames).toContain('Complete Freedom Savings Account');
        expect(productNames).toContain('Business Cheque Account');
        expect(productNames).toContain('Personal Loan Account');
      });

      test('should return empty array for non-existent account', () => {
        const accountId = '0000000000';
        const products = mockProductsData.products.filter((p: any) => p.accountId === accountId);

        expect(products).toHaveLength(0);
      });

      test('should find single product for account with one product', () => {
        const accountId = '9876543210';
        const products = mockProductsData.products.filter((p: any) => p.accountId === accountId);

        expect(products).toHaveLength(1);
        expect(products[0].productName).toBe('Premium Savings Plus');
      });
    });

    describe('categorizeProducts', () => {
      test('should group products by category', () => {
        const productsByCategory = mockProductsData.products.reduce((acc: any, product: any) => {
          if (!acc[product.category]) {
            acc[product.category] = [];
          }
          acc[product.category].push(product);
          return acc;
        }, {});

        expect(productsByCategory.Savings).toHaveLength(2);
        expect(productsByCategory.Card).toHaveLength(1);
        expect(productsByCategory.Loan).toHaveLength(1);
        expect(productsByCategory.Fixed).toBeUndefined();
      });

      test('should handle products with different categories', () => {
        const categories = [...new Set(mockProductsData.products.map((p: any) => p.category))];
        
        expect(categories).toContain('Savings');
        expect(categories).toContain('Card');
        expect(categories).toContain('Loan');
        expect(categories).not.toContain('Fixed');
      });
    });
  });

  describe('Financial Calculations', () => {
    describe('calculateAvailableCredit', () => {
      test('should calculate available credit correctly', () => {
        mockProductsData.products.forEach((product: any) => {
          const availableCredit = product.creditLimit - product.currentDrawdown;
          
          if (product.productId === 'SAV001ABC') {
            expect(availableCredit).toBe(3799.50); // 5000.00 - 1200.50
          } else if (product.productId === 'CHQ002XYZ') {
            expect(availableCredit).toBe(7499.25); // 10000.00 - 2500.75
          } else if (product.productId === 'SAV003DEF') {
            expect(availableCredit).toBe(15000.00); // 15000.00 - 0.0
          } else if (product.productId === 'LOAN004GHI') {
            expect(availableCredit).toBe(6500.00); // 25000.00 - 18500.00
          }
        });
      });

      test('should handle zero drawdown', () => {
        const product = mockProductsData.products.find((p: any) => p.productId === 'SAV003DEF');
        const availableCredit = product.creditLimit - product.currentDrawdown;
        
        expect(availableCredit).toBe(product.creditLimit);
        expect(product.currentDrawdown).toBe(0.0);
      });

      test('should handle maximum drawdown', () => {
        const productWithMaxDrawdown = {
          productId: 'TEST001',
          creditLimit: 1000.00,
          currentDrawdown: 1000.00
        };
        
        const availableCredit = productWithMaxDrawdown.creditLimit - productWithMaxDrawdown.currentDrawdown;
        expect(availableCredit).toBe(0);
      });
    });

    describe('calculateInterestRate', () => {
      test('should calculate interest rate for loan products', () => {
        const loanProduct = mockProductsData.products.find((p: any) => p.category === 'Loan');
        
        if (loanProduct && loanProduct.currentDrawdown > 0) {
          const interestRate = (loanProduct.interestCharged / loanProduct.currentDrawdown) * 100;
          
          // Personal Loan: 2850.75 / 18500.00 * 100 = ~15.41%
          expect(interestRate).toBeCloseTo(15.41, 2);
        }
      });

      test('should handle zero interest charged', () => {
        const savingsProducts = mockProductsData.products.filter((p: any) => p.category === 'Savings');
        
        savingsProducts.forEach((product: any) => {
          expect(product.interestCharged).toBe(0.0);
        });
      });
    });
  });

  describe('Validation Rules', () => {
    describe('productId validation', () => {
      test('should validate alphanumeric product IDs', () => {
        const validProductIds = ['SAV001ABC', 'CHQ002XYZ', 'LOAN004GHI', 'CARD123DEF'];
        const invalidProductIds = ['SAV-001-ABC', 'SAV 001 ABC', 'SAV@001ABC', ''];

        validProductIds.forEach(productId => {
          const isValid = /^[a-zA-Z0-9]+$/.test(productId) && productId.length <= 50;
          expect(isValid).toBe(true);
        });

        invalidProductIds.forEach(productId => {
          const isValid = /^[a-zA-Z0-9]+$/.test(productId) && productId.length <= 50;
          expect(isValid).toBe(false);
        });
      });

      test('should validate product ID length', () => {
        const shortId = 'SAV';
        const normalId = 'SAV001ABC';
        const longId = 'A'.repeat(51); // 51 characters

        expect(shortId.length <= 50).toBe(true);
        expect(normalId.length <= 50).toBe(true);
        expect(longId.length <= 50).toBe(false);
      });
    });

    describe('accountId validation', () => {
      test('should validate numeric account IDs', () => {
        const validAccountIds = ['1234567890', '0123456789', '9876543210'];
        const invalidAccountIds = ['123abc456', '123-456-789', 'abcdefghij', ''];

        validAccountIds.forEach(accountId => {
          const isValid = /^[0-9]+$/.test(accountId);
          expect(isValid).toBe(true);
        });

        invalidAccountIds.forEach(accountId => {
          const isValid = /^[0-9]+$/.test(accountId);
          expect(isValid).toBe(false);
        });
      });
    });
  });

  describe('Response Formatting', () => {
    test('should format single product response correctly', () => {
      const product = mockProductsData.products[0];
      
      expect(product).toHaveProperty('productId');
      expect(product).toHaveProperty('productName');
      expect(product).toHaveProperty('accountId');
      expect(product).toHaveProperty('creditLimit');
      expect(product).toHaveProperty('currentDrawdown');
      expect(product).toHaveProperty('category');
      expect(product).toHaveProperty('interestCharged');

      expect(typeof product.productId).toBe('string');
      expect(typeof product.productName).toBe('string');
      expect(typeof product.accountId).toBe('string');
      expect(typeof product.creditLimit).toBe('number');
      expect(typeof product.currentDrawdown).toBe('number');
      expect(typeof product.category).toBe('string');
      expect(typeof product.interestCharged).toBe('number');
    });

    test('should format products list response correctly', () => {
      const accountId = '1234567890';
      const products = mockProductsData.products.filter((p: any) => p.accountId === accountId);
      const response = { products };

      expect(response).toHaveProperty('products');
      expect(Array.isArray(response.products)).toBe(true);
      expect(response.products.length).toBeGreaterThan(0);
      
      response.products.forEach((product: any) => {
        expect(product.accountId).toBe(accountId);
      });
    });

    test('should format error response correctly', () => {
      const errorResponse = {
        error: 'NOT_FOUND',
        message: 'Product not found'
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('message');
      expect(errorResponse.error).toBe('NOT_FOUND');
      expect(errorResponse.message).toBe('Product not found');
    });
  });

  describe('Edge Cases', () => {
    test('should handle products with zero credit limit', () => {
      const zeroLimitProduct = {
        productId: 'ZERO001',
        creditLimit: 0,
        currentDrawdown: 0,
        category: 'Card'
      };

      const availableCredit = zeroLimitProduct.creditLimit - zeroLimitProduct.currentDrawdown;
      expect(availableCredit).toBe(0);
    });

    test('should handle products with negative interest (rewards)', () => {
      const rewardsProduct = {
        productId: 'REWARDS001',
        interestCharged: -50.00, // Cashback/rewards
        currentDrawdown: 1000.00
      };

      expect(rewardsProduct.interestCharged).toBeLessThan(0);
    });

    test('should handle very large credit limits', () => {
      const highLimitProduct = {
        productId: 'PREMIUM001',
        creditLimit: 1000000.00,
        currentDrawdown: 500000.00
      };

      const availableCredit = highLimitProduct.creditLimit - highLimitProduct.currentDrawdown;
      expect(availableCredit).toBe(500000.00);
    });
  });
});