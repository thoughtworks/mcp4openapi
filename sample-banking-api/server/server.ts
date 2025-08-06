
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import payeeRoutes, { setPayeesDataReference, setSavePayeesDataFunction } from './routes/payeeRoutes.js';
import paymentRoutes, { setPaymentsDataReference, setSavePaymentsDataFunction, setPayeesDataReference as setPayeesDataReferenceForPayments } from './routes/paymentRoutes.js';
import productRoutes, { setProductsDataReference } from './routes/productRoutes.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

// Types for server (non-payee related)
interface ErrorResponse {
  error: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Pre-shared service token (for MCP and other service-to-service authentication)
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'mcp-service-token-demo-123';

// Data storage
let payeesData: {
  payees: any[];
  nextPayeeId: number;
  nextTransactionId: number;
};

let paymentsData: {
  payments: any[];
};

let productsData: {
  products: any[];
};

// Load fake data
function loadPayeesData() {
  try {
    const dataPath = path.join(__dirname, '../data/payees.json');
    const jsonData = fs.readFileSync(dataPath, 'utf8');
    payeesData = JSON.parse(jsonData);
    console.log(`📊 Loaded ${payeesData.payees.length} fake payees from JSON file`);
  } catch (error) {
    console.error('❌ Error loading payees data:', error);
    // Fallback to empty data
    payeesData = {
      payees: [],
      nextPayeeId: 1,
      nextTransactionId: 1001
    };
  }
}

// Save data back to file (for persistence during development)
function savePayeesData() {
  try {
    const dataPath = path.join(__dirname, '../data/payees.json');
    fs.writeFileSync(dataPath, JSON.stringify(payeesData, null, 2));
  } catch (error) {
    console.error('❌ Error saving payees data:', error);
  }
}

// Load payments data
function loadPaymentsData() {
  try {
    const dataPath = path.join(__dirname, '../data/payments.json');
    const jsonData = fs.readFileSync(dataPath, 'utf8');
    paymentsData = JSON.parse(jsonData);
    console.log(`💳 Loaded ${paymentsData.payments.length} fake payments from JSON file`);
  } catch (error) {
    console.error('❌ Error loading payments data:', error);
    // Fallback to empty data
    paymentsData = {
      payments: []
    };
  }
}

// Save payments data to file
function savePaymentsData() {
  try {
    const dataPath = path.join(__dirname, '../data/payments.json');
    const jsonData = JSON.stringify(paymentsData, null, 2);
    fs.writeFileSync(dataPath, jsonData);
  } catch (error) {
    console.error('❌ Error saving payments data:', error);
  }
}

// Load products data
function loadProductsData() {
  try {
    const dataPath = path.join(__dirname, '../data/products.json');
    const jsonData = fs.readFileSync(dataPath, 'utf8');
    productsData = JSON.parse(jsonData);
    console.log(`📦 Loaded ${productsData.products.length} fake products from JSON file`);
  } catch (error) {
    console.error('❌ Error loading products data:', error);
    // Fallback to empty data
    productsData = {
      products: []
    };
  }
}

// Save products data to file
function saveProductsData() {
  try {
    const dataPath = path.join(__dirname, '../data/products.json');
    const jsonData = JSON.stringify(productsData, null, 2);
    fs.writeFileSync(dataPath, jsonData);
  } catch (error) {
    console.error('❌ Error saving products data:', error);
  }
}

// Load OpenAPI specs
const productSpec = YAML.load(path.join(__dirname, '../specs/banking-products.yaml'));
const payeeSpec = YAML.load(path.join(__dirname, '../specs/banking-payees.yaml'));
const paymentSpec = YAML.load(path.join(__dirname, '../specs/banking-payments.yaml'));

// Create Express app
const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Error handling middleware for validation
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
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

// JWT Authentication middleware
const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    const errorResponse: ErrorResponse = {
      error: 'MISSING_TOKEN',
      message: 'Authorization header is required'
    };
    return res.status(401).json(errorResponse);
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>
  
  if (!token) {
    const errorResponse: ErrorResponse = {
      error: 'INVALID_TOKEN_FORMAT',
      message: 'Bearer token is required'
    };
    return res.status(401).json(errorResponse);
  }

  // Check for pre-shared service token first
  if (token === SERVICE_TOKEN) {
    (req as any).user = {
      type: 'service',
      serviceId: 'mcp-openapi',
      userId: 'service-account',
      accountNumber: 'service'
    };
    next();
    return;
  }

  // If not service token, try to verify as JWT
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = { 
      ...(typeof decoded === 'object' ? decoded : {}), 
      type: 'user' 
    };
    next();
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'INVALID_TOKEN',
      message: 'Invalid or expired token'
    };
    return res.status(401).json(errorResponse);
  }
};

// Generate test JWT token endpoint (for development only)
app.post('/auth/generate-token', (req: Request, res: Response) => {
  const { userId = 'test-user', accountNumber = '1234567890' } = req.body;
  
  const token = jwt.sign(
    { userId, accountNumber, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({
    token,
    expires: '24h',
    message: 'Development token generated successfully'
  });
});

// Get service token endpoint (for MCP and service-to-service auth)
app.get('/auth/service-token', (req: Request, res: Response) => {
  res.json({
    token: SERVICE_TOKEN,
    type: 'service',
    expires: 'never',
    message: 'Pre-shared service token for MCP integration',
    usage: 'Set BANKING_API_TOKEN=' + SERVICE_TOKEN + ' in your environment'
  });
});

// No payee validation rules needed here - moved to payeeRoutes.ts

// Routes

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Payee routes will be setup after data is loaded in startServer()

// Global error handler
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Server Error:', error);
  
  const errorResponse: ErrorResponse = {
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred while processing your request'
  };
  
  res.status(500).json(errorResponse);
});

// 404 handler will be registered after routes in startServer()

// Serve raw OpenAPI YAML files
app.use('/openapi/products.yaml', express.static(path.join(__dirname, '../openapi-banking-products.yaml')));
app.use('/openapi/payees.yaml', express.static(path.join(__dirname, '../openapi-banking-payees.yaml')));
app.use('/openapi/payments.yaml', express.static(path.join(__dirname, '../openapi-banking-payments.yaml')));

// Swagger UI (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use(
    '/docs/products',
    swaggerUi.serveFiles(productSpec, {}),
    swaggerUi.setup(productSpec, { customSiteTitle: 'Product API Docs' })
  );
  app.use(
    '/docs/payees',
    swaggerUi.serveFiles(payeeSpec, {}),
    swaggerUi.setup(payeeSpec, { customSiteTitle: 'Payee API Docs' })
  );
  app.use(
    '/docs/payments',
    swaggerUi.serveFiles(paymentSpec, {}),
    swaggerUi.setup(paymentSpec, { customSiteTitle: 'Payment API Docs' })
  );
}

// Start server
const startServer = () => {
  loadPayeesData();
  loadPaymentsData();
  loadProductsData();
  
  // Setup payee routes with data references after data is loaded
  setPayeesDataReference(payeesData);
  setSavePayeesDataFunction(savePayeesData);
  
  // Setup payment routes with data references after data is loaded
  setPaymentsDataReference(paymentsData);
  setSavePaymentsDataFunction(savePaymentsData);
  setPayeesDataReferenceForPayments(payeesData);

  // Setup products routes with data references after data is loaded
  setProductsDataReference(productsData);
  
  // Use routes with authentication middleware
  app.use('/v1/banking/payees', authenticateJWT, payeeRoutes);
  app.use('/v1/banking/payments', authenticateJWT, paymentRoutes);
  app.use('/v1/banking/products', authenticateJWT, productRoutes);
  
  // 404 handler - must be registered AFTER all routes
  app.use('*', (req: Request, res: Response) => {
    const errorResponse: ErrorResponse = {
      error: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    };
    
    res.status(404).json(errorResponse);
  });
  
  app.listen(PORT, () => {
    console.log('🏦 Banking API Server Started!');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Loaded ${payeesData.payees.length} payees`);
    console.log(`💳 Loaded ${paymentsData.payments.length} payments`);
    console.log(`📦 Loaded ${productsData.products.length} products`);
    console.log('');
    console.log('🔐 Authentication Options:');
    console.log(`  Service Token: ${SERVICE_TOKEN}`);
    console.log('  User JWT: Generate via POST /auth/generate-token');
    console.log('');
    console.log('📋 Available endpoints:');
    console.log('  POST /auth/generate-token         - Generate JWT token (dev only)');
    console.log('  GET  /auth/service-token          - Get service token info');
    console.log('  GET  /health                      - Health check');
    console.log('  POST /v1/banking/payees           - Create payee');
    console.log('  GET  /v1/banking/payees           - List payees');
    console.log('  GET  /v1/banking/payees/:id       - Get payee by ID');
    console.log('  PUT  /v1/banking/payees/:id       - Update payee');
    console.log('  DELETE /v1/banking/payees/:id     - Delete payee');
    console.log('  POST /v1/banking/payments/payTo   - Create payment');
    console.log('  GET  /v1/banking/payments         - Search payments');
    console.log('  GET  /v1/banking/products           - List products');
    console.log('  GET  /v1/banking/products/:id      - Get product by ID');
    console.log('  GET  /v1/banking/products?accountId= - List products by accountId');
    console.log('');
    console.log('🔑 Authentication:');
    console.log('  • Service Token (MCP): Use the service token above');
    console.log('  • User JWT: POST /auth/generate-token for user-specific tokens');
    console.log('');
    console.log('🔧 MCP Setup:');
    console.log(`  export BANKING_API_TOKEN="${SERVICE_TOKEN}"`);
  });
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  savePayeesData();
  saveProductsData();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');  
  savePayeesData();
  saveProductsData();
  process.exit(0);
});

// Export for testing
export default app;

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
} 