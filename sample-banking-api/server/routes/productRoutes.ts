import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';

// Product type
interface Product {
  productId: string;
  productName: string;
  accountId: string;
  creditLimit: number;
  currentDrawdown: number;
  category: 'Card' | 'Loan' | 'Savings' | 'Fixed';
  interestCharged: number;
}

interface ErrorResponse {
  error: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

let productsDataRef: { products: Product[] };

export const setProductsDataReference = (dataRef: any) => {
  productsDataRef = dataRef;
};

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorResponse: ErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'The request contains invalid data',
      details: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg
      }))
    };
    return res.status(400).json(errorResponse);
  }
  next();
};

const router = Router();

// GET /banking/products/:productId
router.get(
  '/:productId',
  [
    param('productId')
      .matches(/^[a-zA-Z0-9]+$/)
      .isLength({ max: 50 })
      .withMessage('productId must be alphanumeric and no longer than 50 characters')
  ],
  handleValidationErrors,
  (req: Request, res: Response) => {
    const { productId } = req.params;
    const product = productsDataRef.products.find(p => p.productId === productId);
    if (!product) {
      const errorResponse: ErrorResponse = {
        error: 'NOT_FOUND',
        message: 'Product not found'
      };
      return res.status(404).json(errorResponse);
    }
    res.json(product);
  }
);

// GET /banking/products?accountId=...
router.get(
  '/',
  [
    query('accountId')
      .exists()
      .withMessage('accountId is required')
      .matches(/^[0-9]+$/)
      .withMessage('accountId must contain only digits')
  ],
  handleValidationErrors,
  (req: Request, res: Response) => {
    const { accountId } = req.query;
    const products = productsDataRef.products.filter(p => p.accountId === accountId);
    res.json({ products });
  }
);

export default router; 