# 🏦 Banking Payee API Server (Express.js)

A complete **Express.js backend implementation** of the Banking Payee Management API, built from the OpenAPI specification with **fake JSON data** for testing and development.

## 🚀 What's Included

### ✅ **Complete API Implementation**
- **All CRUD operations** - Create, Read, Update, Delete payees
- **JWT Authentication** - Bearer token security
- **Request validation** - All OpenAPI schema constraints enforced
- **Error handling** - Proper HTTP status codes and error responses
- **Fake data persistence** - JSON file storage for development

### 📊 **API Endpoints**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/auth/generate-token` | Generate JWT token (dev only) | ❌ |
| `GET` | `/health` | Server health check | ❌ |
| `GET` | `/v1/banking/payees` | List payees with filtering/pagination | ✅ |
| `POST` | `/v1/banking/payees` | Create new payee profile | ✅ |
| `GET` | `/v1/banking/payees/:id` | Get specific payee details | ✅ |
| `PUT` | `/v1/banking/payees/:id` | Update payee information | ✅ |
| `DELETE` | `/v1/banking/payees/:id` | Delete payee profile | ✅ |

## 🛠 Quick Start

### 1. **Start the Server**
```bash
# Development mode with auto-restart
npm run server:dev

# Or regular mode
npm run server
```

### 2. **Generate Authentication Token**
```bash
# Using curl
curl -X POST http://localhost:3001/auth/generate-token \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "accountNumber": "1234567890"}'

# Or using npm script
npm run test:curl
```

### 3. **Test All Endpoints**
```bash
# Run comprehensive test suite
npm run test:server
```

## 🎯 Example Usage

### **Generate Token**
```bash
POST /auth/generate-token
Content-Type: application/json

{
  "userId": "test-user",
  "accountNumber": "1234567890"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires": "24h",
  "message": "Development token generated successfully"
}
```

### **Create Payee (Pay ID)**
```bash
POST /v1/banking/payees
Authorization: Bearer {your-token}
Content-Type: application/json

{
  "accountNumber": "1234567890",
  "payeeAlias": "JohnMobile",
  "payeeName": "John Smith",
  "payId": "0412345678",
  "payeeCategories": ["family", "personal"]
}
```

**Response:**
```json
{
  "payeeId": "payee_a1b2c3d4e5f6g7h8",
  "transactionId": "txn_1001",
  "status": "created",
  "message": "Payee profile created successfully"
}
```

### **Create Payee (Account + BSB)**
```bash
POST /v1/banking/payees
Authorization: Bearer {your-token}
Content-Type: application/json

{
  "accountNumber": "1234567890",
  "payeeAlias": "UtilityBill",
  "payeeName": "Power Company Australia",
  "payeeAccountNumber": "555666",
  "bsb": "123456",
  "payeeCategories": ["utilities", "bills"]
}
```

### **List Payees with Filtering**
```bash
GET /v1/banking/payees?accountNumber=1234567890&category=family&limit=10&offset=0
Authorization: Bearer {your-token}
```

**Response:**
```json
{
  "payees": [
    {
      "payeeId": "payee_7f8a9b2c1d3e4f5g",
      "accountNumber": "1234567890",
      "payeeAlias": "JohnDoe123",
      "payeeName": "John Doe",
      "payId": "0412345678",
      "payeeCategories": ["family", "personal"],
      "createdAt": "2023-12-01T10:30:00Z",
      "updatedAt": "2023-12-01T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  }
}
```

### **Update Payee**
```bash
PUT /v1/banking/payees/payee_7f8a9b2c1d3e4f5g
Authorization: Bearer {your-token}
Content-Type: application/json

{
  "payeeAlias": "JohnDoe456",
  "payeeName": "John Doe Updated",
  "payeeCategories": ["family", "updated"]
}
```

### **Delete Payee**
```bash
DELETE /v1/banking/payees/payee_7f8a9b2c1d3e4f5g
Authorization: Bearer {your-token}
```

**Response:** `204 No Content`

## 🔒 Authentication

The server uses **JWT Bearer tokens**:

1. **Generate token:** `POST /auth/generate-token`
2. **Use token:** Add `Authorization: Bearer {token}` header
3. **Token expiry:** 24 hours

## ✅ Validation Rules

### **Create Payee Request**
- `accountNumber`: Numeric only
- `payeeAlias`: 1-20 alphanumeric characters, unique per account
- `payeeName`: 1-100 characters
- `payId`: Exactly 10 digits (if no account+BSB)
- `payeeAccountNumber`: Exactly 6 digits (if no Pay ID)
- `bsb`: Exactly 6 digits (if no Pay ID)
- `payeeCategories`: Array of alphabetic strings (optional)

### **Conditional Requirements**
- **Either** `payId` **OR** both `payeeAccountNumber` and `bsb` must be provided

## 🗂 Data Storage

**Development Mode:**
- Uses `data/payees.json` for persistence
- Automatically loads/saves data
- Pre-populated with 6 sample payees

**Sample Data Includes:**
- Pay ID payees (phone numbers)
- Account+BSB payees (bank accounts)
- Various categories: family, business, utilities, etc.
- Different account numbers for testing

## 🚦 Error Handling

### **HTTP Status Codes**
- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Validation Error
- `401` - Unauthorized
- `404` - Not Found
- `409` - Conflict (duplicate alias)
- `422` - Unprocessable Entity
- `500` - Internal Server Error

### **Error Response Format**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "The request contains invalid data",
  "details": [
    {
      "field": "payeeAlias",
      "message": "Must be alphanumeric and no more than 20 characters"
    }
  ]
}
```

## 📋 Testing

### **Automated Test Suite**
```bash
npm run test:server
```

**Tests Include:**
- ✅ Token generation
- ✅ Health check
- ✅ List payees (with pagination/filtering)
- ✅ Create payee (Pay ID method)
- ✅ Create payee (Account+BSB method)
- ✅ Get payee details
- ✅ Update payee
- ✅ Delete payee
- ✅ Validation errors
- ✅ Authentication required

### **Manual Testing with curl**
```bash
# Generate token
curl -X POST http://localhost:3001/auth/generate-token

# Health check
curl http://localhost:3001/health

# List payees (requires token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:3001/v1/banking/payees?accountNumber=1234567890"
```

## 🔧 Development

### **File Structure**
```
├── server/
│   └── server.ts          # Main Express server
├── data/
│   └── payees.json        # Fake data storage
├── test-server.ts         # Comprehensive test suite
└── package.json           # Scripts and dependencies
```

### **Available Scripts**
```bash
npm run server          # Start server (production)
npm run server:dev      # Start with nodemon (development)
npm run server:build    # Build TypeScript
npm run test:server     # Run test suite
npm run test:curl       # Quick curl test
```

### **Environment Variables**
```bash
PORT=3001                    # Server port (default: 3001)
JWT_SECRET=your-secret-key   # JWT signing secret
NODE_ENV=development         # Environment
```

## 🎯 Production Considerations

### **Security**
- [ ] Use strong JWT secrets (environment variables)
- [ ] Implement rate limiting
- [ ] Add request logging
- [ ] Use HTTPS in production
- [ ] Implement proper CORS policies

### **Database**
- [ ] Replace JSON file with real database (MongoDB, PostgreSQL)
- [ ] Add connection pooling
- [ ] Implement database migrations
- [ ] Add data validation at DB level

### **Monitoring**
- [ ] Add health checks
- [ ] Implement metrics collection
- [ ] Add error tracking (Sentry, etc.)
- [ ] Set up logging infrastructure

## 🔄 Integration with Client

**Use with the generated TypeScript client:**

```typescript
// Update client base URL to point to your server
const bankingApi = new Api<{ token: string }>({
  baseUrl: 'http://localhost:3001/v1',  // Your server URL
  securityWorker: (securityData) => ({
    headers: {
      Authorization: `Bearer ${securityData?.token}`,
    },
  }),
});

// Generate token first
const tokenResponse = await axios.post('http://localhost:3001/auth/generate-token', {
  userId: 'your-user-id',
  accountNumber: 'your-account'
});

// Set token
bankingApi.setSecurityData({ token: tokenResponse.data.token });

// Use the client!
const payees = await bankingApi.banking.listPayeeProfiles({
  accountNumber: '1234567890'
});
```

---

🎉 **Your banking API server is ready for development and testing!**

Start with `npm run server` and test with `npm run test:server`. 