import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';

// Types (moved from server.ts)
interface PayeeProfile {
  payeeId: string;
  accountNumber: string;
  payeeAlias: string;
  payeeName: string;
  payId?: string;
  payeeAccountNumber?: string;
  bsb?: string;
  payeeCategories?: string[];
  createdAt: string;
  updatedAt: string;
}

interface CreatePayeeRequest {
  accountNumber: string;
  payeeAlias: string;
  payeeName: string;
  payId?: string;
  payeeAccountNumber?: string;
  bsb?: string;
  payeeCategories?: string[];
}

interface CreatePayeeResponse {
  payeeId: string;
  transactionId: string;
  status: 'created';
  message: string;
}

interface PayeeListResponse {
  payees: PayeeProfile[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface ErrorResponse {
  error: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

// Data storage (shared reference)
let payeesDataRef: {
  payees: PayeeProfile[];
  nextPayeeId: number;
  nextTransactionId: number;
};

// Function to set the data reference from server.ts
export const setPayeesDataReference = (dataRef: any) => {
  payeesDataRef = dataRef;
};

// Save data function (will be passed from server.ts)
let savePayeesDataFn: () => void;

export const setSavePayeesDataFunction = (saveFn: () => void) => {
  savePayeesDataFn = saveFn;
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

// Validation rules
const createPayeeValidation = [
  body('accountNumber')
    .matches(/^[0-9]+$/)
    .withMessage('Account number must contain only digits'),
  body('payeeAlias')
    .isLength({ min: 1, max: 20 })
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Payee alias must be 1-20 alphanumeric characters'),
  body('payeeName')
    .isLength({ min: 1, max: 100 })
    .withMessage('Payee name must be 1-100 characters'),
  body('payId')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Pay ID must be exactly 10 digits'),
  body('payeeAccountNumber')
    .optional()
    .matches(/^[0-9]{6}$/)
    .withMessage('Payee account number must be exactly 6 digits'),
  body('bsb')
    .optional()
    .matches(/^[0-9]{6}$/)
    .withMessage('BSB must be exactly 6 digits'),
  body('payeeCategories')
    .optional()
    .isArray()
    .withMessage('Payee categories must be an array'),
  body('payeeCategories.*')
    .optional()
    .matches(/^[a-zA-Z]+$/)
    .withMessage('Each category must contain only letters'),
  // Custom validation for conditional requirements
  body().custom((value) => {
    const { payId, payeeAccountNumber, bsb } = value;
    if (!payId && (!payeeAccountNumber || !bsb)) {
      throw new Error('Either payId or both payeeAccountNumber and bsb must be provided');
    }
    return true;
  })
];

const updatePayeeValidation = [
  body('payeeAlias')
    .optional()
    .isLength({ min: 1, max: 20 })
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Payee alias must be 1-20 alphanumeric characters'),
  body('payeeName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Payee name must be 1-100 characters'),
  body('payeeCategories')
    .optional()
    .isArray()
    .withMessage('Payee categories must be an array'),
  body('payeeCategories.*')
    .optional()
    .matches(/^[a-zA-Z]+$/)
    .withMessage('Each category must contain only letters')
];

// Helper functions
const generatePayeeId = (): string => {
  return `payee_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
};

const generateTransactionId = (): string => {
  const id = `txn_${payeesDataRef.nextTransactionId}`;
  payeesDataRef.nextTransactionId++;
  return id;
};

// Create Express Router
const router = Router();

// GET /v1/banking/payees - List payee profiles
router.get('/', 
  [
    query('accountNumber')
      .matches(/^[0-9]+$/)
      .withMessage('Account number must contain only digits'),
    query('category')
      .optional()
      .matches(/^[a-zA-Z]+$/)
      .withMessage('Category must contain only letters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be non-negative')
  ],
  handleValidationErrors,
  (req: Request, res: Response) => {
    const { accountNumber, category, limit = 50, offset = 0 } = req.query;
    
    // Filter payees by account number
    let filteredPayees = payeesDataRef.payees.filter(
      payee => payee.accountNumber === accountNumber
    );
    
    // Filter by category if provided
    if (category) {
      filteredPayees = filteredPayees.filter(
        payee => payee.payeeCategories?.includes(category as string)
      );
    }
    
    // Apply pagination
    const startIndex = Number(offset);
    const endIndex = startIndex + Number(limit);
    const paginatedPayees = filteredPayees.slice(startIndex, endIndex);
    
    const response: PayeeListResponse = {
      payees: paginatedPayees,
      pagination: {
        total: filteredPayees.length,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: endIndex < filteredPayees.length
      }
    };
    
    res.json(response);
  }
);

// POST /v1/banking/payees - Create a new payee profile
router.post('/',
  createPayeeValidation,
  handleValidationErrors,
  (req: Request, res: Response) => {
    const payeeData: CreatePayeeRequest = req.body;
    
    // Check for duplicate alias within the same account
    const existingPayee = payeesDataRef.payees.find(
      payee => payee.accountNumber === payeeData.accountNumber && 
               payee.payeeAlias === payeeData.payeeAlias
    );
    
    if (existingPayee) {
      const errorResponse: ErrorResponse = {
        error: 'DUPLICATE_PAYEE_ALIAS',
        message: 'Payee alias already exists for this account'
      };
      return res.status(409).json(errorResponse);
    }
    
    // Create new payee
    const now = new Date().toISOString();
    const newPayee: PayeeProfile = {
      payeeId: generatePayeeId(),
      accountNumber: payeeData.accountNumber,
      payeeAlias: payeeData.payeeAlias,
      payeeName: payeeData.payeeName,
      ...(payeeData.payId && { payId: payeeData.payId }),
      ...(payeeData.payeeAccountNumber && { payeeAccountNumber: payeeData.payeeAccountNumber }),
      ...(payeeData.bsb && { bsb: payeeData.bsb }),
      ...(payeeData.payeeCategories && { payeeCategories: payeeData.payeeCategories }),
      createdAt: now,
      updatedAt: now
    };
    
    // Add to data store
    payeesDataRef.payees.push(newPayee);
    savePayeesDataFn();
    
    // Create response
    const response: CreatePayeeResponse = {
      payeeId: newPayee.payeeId,
      transactionId: generateTransactionId(),
      status: 'created',
      message: 'Payee profile created successfully'
    };
    
    res.status(201).json(response);
  }
);

// GET /v1/banking/payees/:payeeId - Get a specific payee profile
router.get('/:payeeId',
  [
    param('payeeId')
      .matches(/^payee_[a-zA-Z0-9]+$/)
      .withMessage('Invalid payee ID format')
  ],
  handleValidationErrors,
  (req: Request, res: Response) => {
    const { payeeId } = req.params;
    
    const payee = payeesDataRef.payees.find(p => p.payeeId === payeeId);
    
    if (!payee) {
      const errorResponse: ErrorResponse = {
        error: 'PAYEE_NOT_FOUND',
        message: 'Payee not found'
      };
      return res.status(404).json(errorResponse);
    }
    
    res.json(payee);
  }
);

// PUT /v1/banking/payees/:payeeId - Update a payee profile
router.put('/:payeeId',
  [
    param('payeeId')
      .matches(/^payee_[a-zA-Z0-9]+$/)
      .withMessage('Invalid payee ID format')
  ],
  updatePayeeValidation,
  handleValidationErrors,
  (req: Request, res: Response) => {
    const { payeeId } = req.params;
    const updates = req.body;
    
    const payeeIndex = payeesDataRef.payees.findIndex(p => p.payeeId === payeeId);
    
    if (payeeIndex === -1) {
      const errorResponse: ErrorResponse = {
        error: 'PAYEE_NOT_FOUND',
        message: 'Payee not found'
      };
      return res.status(404).json(errorResponse);
    }
    
    // Check for duplicate alias if updating alias
    if (updates.payeeAlias) {
      const existingPayee = payeesDataRef.payees.find(
        (payee, index) => 
          index !== payeeIndex &&
          payee.accountNumber === payeesDataRef.payees[payeeIndex].accountNumber && 
          payee.payeeAlias === updates.payeeAlias
      );
      
      if (existingPayee) {
        const errorResponse: ErrorResponse = {
          error: 'DUPLICATE_PAYEE_ALIAS',
          message: 'Payee alias already exists for this account'
        };
        return res.status(409).json(errorResponse);
      }
    }
    
    // Update payee
    const updatedPayee = {
      ...payeesDataRef.payees[payeeIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    payeesDataRef.payees[payeeIndex] = updatedPayee;
    savePayeesDataFn();
    
    res.json(updatedPayee);
  }
);

// DELETE /v1/banking/payees/:payeeId - Delete a payee profile
router.delete('/:payeeId',
  [
    param('payeeId')
      .matches(/^payee_[a-zA-Z0-9]+$/)
      .withMessage('Invalid payee ID format')
  ],
  handleValidationErrors,
  (req: Request, res: Response) => {
    const { payeeId } = req.params;
    
    const payeeIndex = payeesDataRef.payees.findIndex(p => p.payeeId === payeeId);
    
    if (payeeIndex === -1) {
      const errorResponse: ErrorResponse = {
        error: 'PAYEE_NOT_FOUND',
        message: 'Payee not found'
      };
      return res.status(404).json(errorResponse);
    }
    
    // Remove payee
    payeesDataRef.payees.splice(payeeIndex, 1);
    savePayeesDataFn();
    
    res.status(204).send();
  }
);

export default router; 