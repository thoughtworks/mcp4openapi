import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';

// Types
interface PaymentRecord {
  transactionId: string;
  accountNumber: string;
  productId: string;
  productName: string;
  payeeId: string;
  payeeName: string;
  amount: number;
  paymentReference?: string;
  paymentDate: string;
  paymentExecutionDate: string;
  status: 'initiated' | 'scheduled' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

interface PaymentsData {
  payments: PaymentRecord[];
}

interface PayToRequest {
  accountNumber: string;
  productId: string;
  payeeId: string;
  amount: number;
  paymentReference?: string;
  paymentDate: string;
}

interface PayToResponse {
  transactionId: string;
  productName: string;
  payeeName: string;
  paymentExecutionDate: string;
  status: string;
  message: string;
}

interface PaymentSearchResponse {
  payments: PaymentRecord[];
  pagination: {
    total: number;
    returned: number;
    maxResult: number;
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

// Data references - will be set by server.ts
let paymentsData: PaymentsData = { payments: [] };
let savePaymentsDataFunction: (() => void) | null = null;
let payeesData: any = { payees: [] };

// Mock product data for validation and response
const mockProducts: Record<string, string> = {
  'SAV001ABC': 'Complete Freedom Savings Account',
  'CHQ002XYZ': 'Business Cheque Account', 
  'SAV003DEF': 'Premium Savings Plus',
  'CHQ004GHI': 'Everyday Cheque Account',
  'SAV005JKL': 'High Interest Savings',
  'SAV006MNO': 'Student Saver Account',
  'CHQ007PQR': 'Premium Cheque Account',
  'SAV008STU': 'Goal Saver Account'
};

// Mock payee data for validation and response  
const mockPayees: Record<string, string> = {
  'payee_7f8a9b2c1d3e4f5g': 'John Doe',
  'payee_a1b2c3d4e5f6g7h8': 'Jane Smith',
  'payee_x1y2z3a4b5c6d7e8': 'ABC Company Pty Ltd',
  'payee_m5n6o7p8q9r0s1t2': 'Sarah Wilson',
  'payee_p9q0r1s2t3u4v5w6': 'Tech Solutions Inc',
  'payee_q1r2s3t4u5v6w7x8': 'Green Energy Co',
  'payee_r2s3t4u5v6w7x8y9': 'City Council',
  'payee_s3t4u5v6w7x8y9z0': 'Mobile Plus Telco'
};

const router = Router();

// Helper functions
const generateTransactionId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'txn_pay_';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const isValidDateFormat = (date: string): boolean => {
  return /^[0-9]{8}$/.test(date);
};

const parseDate = (dateStr: string): Date => {
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
  const day = parseInt(dateStr.substring(6, 8));
  return new Date(year, month, day);
};

const isValidDateRange = (startDate: string, endDate: string): boolean => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return start <= end;
};

const handleValidationErrors = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg
    }));

    const errorResponse: ErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'The request contains invalid data',
      details: errorDetails
    };

    res.status(400).json(errorResponse);
    return true;
  }
  return false;
};

// Validation middleware
const payToValidation = [
  body('accountNumber')
    .matches(/^[0-9]+$/)
    .withMessage('Account number must contain only digits'),
  
  body('productId')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Product ID must be alphanumeric')
    .isLength({ max: 50 })
    .withMessage('Product ID must not exceed 50 characters'),
  
  body('payeeId')
    .matches(/^payee_[a-zA-Z0-9]+$/)
    .withMessage('Payee ID must start with "payee_" followed by alphanumeric characters'),
  
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom((value) => {
      const num = parseFloat(value);
      if (num <= 1.0) {
        throw new Error('Amount must be greater than 1.00');
      }
      // Check if it has more than 2 decimal places
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        throw new Error('Amount cannot have more than 2 decimal places');
      }
      return true;
    }),
  
  body('paymentReference')
    .optional()
    .isLength({ max: 250 })
    .withMessage('Payment reference must not exceed 250 characters'),
  
  body('paymentDate')
    .matches(/^[0-9]{8}$/)
    .withMessage('Payment date must be in YYYYMMDD format')
    .custom((value) => {
      if (!isValidDateFormat(value)) {
        throw new Error('Invalid date format');
      }
      // Check if date is not in the past (for demo, we'll allow any date)
      return true;
    })
];

const searchPaymentsValidation = [
  query('accountId')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Account ID must not exceed 20 characters'),
  
  query('payeeId')
    .optional()
    .matches(/^payee_[a-zA-Z0-9]+$/)
    .withMessage('Payee ID must match format: payee_[alphanumeric]'),
  
  query('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  
  query('payeeName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Payee name must not exceed 100 characters'),
  
  query('productName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Product name must not exceed 100 characters'),
  
  query('startDate')
    .optional()
    .matches(/^[0-9]{8}$/)
    .withMessage('Start date must be in YYYYMMDD format'),
  
  query('endDate')
    .optional()
    .matches(/^[0-9]{8}$/)
    .withMessage('End date must be in YYYYMMDD format')
    .custom((value, { req }) => {
      if (value && req.query && !req.query.startDate) {
        throw new Error('Start date is required when end date is provided');
      }
      if (value && req.query && req.query.startDate && !isValidDateRange(req.query.startDate as string, value)) {
        throw new Error('End date must be after or equal to start date');
      }
      return true;
    }),
  
  query('maxResult')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Max result must be between 1 and 500'),
  
  // Custom validation to ensure at least one search parameter is provided
  query().custom((value, { req }) => {
    if (!req.query) {
      throw new Error('At least one search parameter must be provided (accountId, payeeId, amount, payeeName, productName, or startDate)');
    }
    const { accountId, payeeId, amount, payeeName, productName, startDate } = req.query;
    if (!accountId && !payeeId && !amount && !payeeName && !productName && !startDate) {
      throw new Error('At least one search parameter must be provided (accountId, payeeId, amount, payeeName, productName, or startDate)');
    }
    return true;
  })
];

// Routes

// POST /payTo - Create payment
router.post('/payTo', payToValidation, (req: Request, res: Response) => {
  if (handleValidationErrors(req, res)) return;

  const { accountNumber, productId, payeeId, amount, paymentReference, paymentDate }: PayToRequest = req.body;

  // Validate product exists
  const productName = mockProducts[productId];
  if (!productName) {
    const errorResponse: ErrorResponse = {
      error: 'PRODUCT_NOT_FOUND',
      message: 'The specified product does not exist or is not accessible'
    };
    return res.status(404).json(errorResponse);
  }

  // Validate payee exists - check actual payee data first, then fall back to mock
  let payeeName = '';
  
  // First check actual payee data
  const actualPayee = payeesData.payees?.find((p: any) => p.payeeId === payeeId);
  if (actualPayee) {
    payeeName = actualPayee.payeeName;
  } else {
    // Fall back to mock payees
    payeeName = mockPayees[payeeId];
  }
  
  if (!payeeName) {
    const errorResponse: ErrorResponse = {
      error: 'PAYEE_NOT_FOUND',
      message: 'The specified payee does not exist or is not accessible'
    };
    return res.status(404).json(errorResponse);
  }

  // Create new payment record
  const transactionId = generateTransactionId();
  const currentTime = new Date().toISOString();
  
  const newPayment: PaymentRecord = {
    transactionId,
    accountNumber,
    productId,
    productName,
    payeeId,
    payeeName,
    amount: parseFloat(amount.toFixed(2)), // Ensure 2 decimal places
    paymentReference: paymentReference || '',
    paymentDate,
    paymentExecutionDate: paymentDate, // In real system, this might be different
    status: paymentDate === new Date().toISOString().slice(0, 10).replace(/-/g, '') ? 'initiated' : 'scheduled',
    createdAt: currentTime,
    updatedAt: currentTime
  };

  // Add payment to data
  paymentsData.payments.push(newPayment);

  // Save data
  if (savePaymentsDataFunction) {
    savePaymentsDataFunction();
  }

  // Return success response
  const response: PayToResponse = {
    transactionId,
    productName,
    payeeName,
    paymentExecutionDate: paymentDate,
    status: newPayment.status,
    message: 'Payment has been successfully initiated'
  };

  res.status(201).json(response);
});

// GET / - Search payments
router.get('/', searchPaymentsValidation, (req: Request, res: Response) => {
  if (handleValidationErrors(req, res)) return;

  const { 
    accountId,
    payeeId,
    amount,
    payeeName, 
    productName, 
    startDate, 
    endDate, 
    maxResult = '100' 
  } = req.query as {
    accountId?: string;
    payeeId?: string;
    amount?: string;
    payeeName?: string;
    productName?: string;
    startDate?: string;
    endDate?: string;
    maxResult?: string;
  };

  const maxResults = parseInt(maxResult);

  // Filter payments based on search criteria
  let filteredPayments = paymentsData.payments.filter(payment => {
    // Filter by account ID (exact match)
    if (accountId && payment.accountNumber !== accountId) {
      return false;
    }

    // Filter by payee ID (exact match)
    if (payeeId && payment.payeeId !== payeeId) {
      return false;
    }

    // Filter by exact amount
    if (amount && parseFloat(amount) !== payment.amount) {
      return false;
    }

    // Filter by payee name (partial match, case insensitive)
    if (payeeName && !payment.payeeName.toLowerCase().includes(payeeName.toLowerCase())) {
      return false;
    }

    // Filter by product name (partial match, case insensitive)
    if (productName && !payment.productName.toLowerCase().includes(productName.toLowerCase())) {
      return false;
    }

    // Filter by date range
    if (startDate) {
      const paymentDate = payment.paymentExecutionDate;
      if (paymentDate < startDate) {
        return false;
      }
      if (endDate && paymentDate > endDate) {
        return false;
      }
    }

    return true;
  });

  // Sort by payment execution date (most recent first)
  filteredPayments.sort((a, b) => b.paymentExecutionDate.localeCompare(a.paymentExecutionDate));

  const total = filteredPayments.length;
  const returned = Math.min(total, maxResults);
  const hasMore = total > maxResults;

  // Limit results
  const payments = filteredPayments.slice(0, maxResults);

  const response: PaymentSearchResponse = {
    payments,
    pagination: {
      total,
      returned,
      maxResult: maxResults,
      hasMore
    }
  };

  res.json(response);
});

// Export functions to set data references
export const setPaymentsDataReference = (data: PaymentsData) => {
  paymentsData = data;
};

export const setSavePaymentsDataFunction = (saveFunction: () => void) => {
  savePaymentsDataFunction = saveFunction;
};

export const setPayeesDataReference = (data: any) => {
  payeesData = data;
};

export default router; 