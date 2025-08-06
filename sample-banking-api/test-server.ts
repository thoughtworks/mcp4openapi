import axios, { AxiosError } from 'axios';

// Configuration
const BASE_URL = 'http://localhost:3001';
const API_BASE = `${BASE_URL}/v1`;

// Test the banking API server
async function testBankingServer() {
  console.log('🧪 Testing Banking Payee API Server');
  console.log('=====================================\n');

  let token: string;

  try {
    // Step 1: Generate JWT Token
    console.log('1️⃣ Generating JWT Token...');
    const authResponse = await axios.post(`${BASE_URL}/auth/generate-token`, {
      userId: 'test-user',
      accountNumber: '1234567890'
    });
    
    token = authResponse.data.token;
    console.log('✅ Token generated successfully');
    console.log(`   Token: ${token.substring(0, 20)}...`);
    console.log(`   Expires: ${authResponse.data.expires}\n`);

    // Step 2: Check Health
    console.log('2️⃣ Checking server health...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is healthy');
    console.log(`   Status: ${healthResponse.data.status}`);
    console.log(`   Version: ${healthResponse.data.version}\n`);

    // Step 3: List Existing Payees
    console.log('3️⃣ Listing existing payees for account 1234567890...');
    const listResponse = await axios.get(`${API_BASE}/banking/payees`, {
      params: { accountNumber: '1234567890' },
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Retrieved payees list');
    console.log(`   Total payees: ${listResponse.data.pagination.total}`);
    listResponse.data.payees.forEach((payee: any, index: number) => {
      console.log(`   ${index + 1}. ${payee.payeeAlias} (${payee.payeeName})`);
    });
    console.log('');

    // Step 4: Create New Payee with Pay ID
    console.log('4️⃣ Creating new payee with Pay ID...');
    const newPayeeData = {
      accountNumber: '1234567890',
      payeeAlias: 'TestUser001',
      payeeName: 'Test User Account',
      payId: '0477123456',
      payeeCategories: ['testing', 'personal']
    };

    const createResponse = await axios.post(
      `${API_BASE}/banking/payees`,
      newPayeeData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('✅ Payee created successfully');
    console.log(`   Payee ID: ${createResponse.data.payeeId}`);
    console.log(`   Transaction ID: ${createResponse.data.transactionId}`);
    console.log(`   Message: ${createResponse.data.message}\n`);

    const newPayeeId = createResponse.data.payeeId;

    // Step 5: Get Specific Payee
    console.log('5️⃣ Retrieving the created payee...');
    const getResponse = await axios.get(
      `${API_BASE}/banking/payees/${newPayeeId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('✅ Retrieved payee details');
    console.log(`   Alias: ${getResponse.data.payeeAlias}`);
    console.log(`   Name: ${getResponse.data.payeeName}`);
    console.log(`   Pay ID: ${getResponse.data.payId}`);
    console.log(`   Categories: ${getResponse.data.payeeCategories?.join(', ')}`);
    console.log(`   Created: ${getResponse.data.createdAt}\n`);

    // Step 6: Update Payee
    console.log('6️⃣ Updating payee information...');
    const updateData = {
      payeeAlias: 'TestUser002',
      payeeName: 'Updated Test User',
      payeeCategories: ['testing', 'updated']
    };

    const updateResponse = await axios.put(
      `${API_BASE}/banking/payees/${newPayeeId}`,
      updateData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('✅ Payee updated successfully');
    console.log(`   New alias: ${updateResponse.data.payeeAlias}`);
    console.log(`   New name: ${updateResponse.data.payeeName}`);
    console.log(`   Updated: ${updateResponse.data.updatedAt}\n`);

    // Step 7: Create Payee with Account+BSB
    console.log('7️⃣ Creating payee with Account+BSB...');
    const bsbPayeeData = {
      accountNumber: '1234567890',
      payeeAlias: 'BankTest001',
      payeeName: 'Test Bank Account',
      payeeAccountNumber: '555777',
      bsb: '123456',
      payeeCategories: ['banking', 'transfer']
    };

    const bsbCreateResponse = await axios.post(
      `${API_BASE}/banking/payees`,
      bsbPayeeData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('✅ Bank account payee created');
    console.log(`   Payee ID: ${bsbCreateResponse.data.payeeId}`);
    console.log(`   Transaction ID: ${bsbCreateResponse.data.transactionId}\n`);

    // Step 8: Test Filtering
    console.log('8️⃣ Testing category filtering...');
    const filteredResponse = await axios.get(`${API_BASE}/banking/payees`, {
      params: { 
        accountNumber: '1234567890',
        category: 'testing',
        limit: 5
      },
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Retrieved filtered payees (testing category)');
    console.log(`   Found: ${filteredResponse.data.payees.length} payees`);
    filteredResponse.data.payees.forEach((payee: any) => {
      console.log(`   - ${payee.payeeAlias}: ${payee.payeeName}`);
    });
    console.log('');

    // Step 9: Test Validation Error
    console.log('9️⃣ Testing validation error (invalid data)...');
    try {
      await axios.post(
        `${API_BASE}/banking/payees`,
        {
          accountNumber: '1234567890',
          payeeAlias: 'Invalid@Alias!', // Contains invalid characters
          payeeName: 'Test User',
          payId: '123' // Too short
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        console.log('✅ Validation error handled correctly');
        console.log(`   Error: ${error.response.data.error}`);
        console.log(`   Message: ${error.response.data.message}`);
        if (error.response.data.details) {
          error.response.data.details.forEach((detail: any) => {
            console.log(`   - ${detail.field}: ${detail.message}`);
          });
        }
        console.log('');
      }
    }

    // 🧪 PAYMENT API TESTS (Before cleanup!)
    console.log('9️⃣ Testing Payment APIs...');
    console.log('==========================');

    // Test 9a: Create payment
    console.log('\n📤 Testing create payment (payTo)...');
    const paymentRequest = {
      accountNumber: '1234567890',
      productId: 'SAV001ABC',
      payeeId: createResponse.data.payeeId, // Use created payee
      amount: 150.75,
      paymentReference: 'Test payment from automated tests',
      paymentDate: '20240315'
    };

    const paymentResponse = await axios.post(
      `${API_BASE}/banking/payments/payTo`,
      paymentRequest,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('✅ Payment created successfully');
    console.log(`   Transaction ID: ${paymentResponse.data.transactionId}`);
    console.log(`   Product: ${paymentResponse.data.productName}`);
    console.log(`   Payee: ${paymentResponse.data.payeeName}`);
    console.log(`   Status: ${paymentResponse.data.status}`);

    // Test 9b: Search payments by payee name
    console.log('\n🔍 Testing search payments by payee name...');
    const searchByPayeeName = await axios.get(
      `${API_BASE}/banking/payments?payeeName=John&maxResult=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('✅ Search by payee name successful');
    console.log(`   Found ${searchByPayeeName.data.pagination.total} payments`);
    console.log(`   Returned: ${searchByPayeeName.data.pagination.returned}`);

    // Test 9c: Search payments by product name
    console.log('\n🔍 Testing search payments by product name...');
    const searchByProductName = await axios.get(
      `${API_BASE}/banking/payments?productName=Savings&maxResult=3`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('✅ Search by product name successful');
    console.log(`   Found ${searchByProductName.data.pagination.total} payments`);

    // Test 9d: Search payments by date range
    console.log('\n🔍 Testing search payments by date range...');
    const searchByDateRange = await axios.get(
      `${API_BASE}/banking/payments?startDate=20240101&endDate=20240331&maxResult=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('✅ Search by date range successful');
    console.log(`   Found ${searchByDateRange.data.pagination.total} payments in Q1 2024`);

    // Test 9e: Payment validation errors
    console.log('\n❌ Testing payment validation errors...');
    
    // Test invalid amount
    try {
      await axios.post(
        `${API_BASE}/banking/payments/payTo`,
        {
          ...paymentRequest,
          amount: 0.50 // Invalid: less than 1.00
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        console.log('✅ Amount validation working (amount too small)');
      }
    }

    // Test invalid product
    try {
      await axios.post(
        `${API_BASE}/banking/payments/payTo`,
        {
          ...paymentRequest,
          productId: 'INVALID_PRODUCT'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log('✅ Product validation working (product not found)');
      }
    }

    // Test search without parameters
    try {
      await axios.get(
        `${API_BASE}/banking/payments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        console.log('✅ Search validation working (no search parameters)');
      }
    }

    console.log('\n💳 Payment API tests completed!\n');

    // Step 10: Clean up - Delete test payees
    console.log('🔟 Cleaning up - deleting created payees...');
    
    try {
      await axios.delete(
        `${API_BASE}/banking/payees/${createResponse.data.payeeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ First test payee deleted');

      await axios.delete(
        `${API_BASE}/banking/payees/${bsbCreateResponse.data.payeeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Second test payee deleted\n');
    } catch (error) {
      console.log('⚠️  Some payees might not have been deleted');
    }

    // Step 7: List Products by Account ID
    console.log('7️⃣ Listing products for account 1234567890...');
    const productsListResponse = await axios.get(
      `${API_BASE}/banking/products`,
      {
        params: { accountId: '1234567890' },
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✅ Retrieved products list');
    console.log(`   Total products: ${productsListResponse.data.products.length}`);
    productsListResponse.data.products.forEach((product: any, index: number) => {
      console.log(`   ${index + 1}. ${product.productName} (${product.productId})`);
    });
    console.log('');

    // Step 8: Fetch Product by ID
    console.log('8️⃣ Fetching product by ID (SAV001ABC)...');
    const productByIdResponse = await axios.get(
      `${API_BASE}/banking/products/SAV001ABC`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('✅ Retrieved product by ID');
    console.log(`   Product Name: ${productByIdResponse.data.productName}`);
    console.log(`   Account ID: ${productByIdResponse.data.accountId}`);
    console.log(`   Credit Limit: ${productByIdResponse.data.creditLimit}`);
    console.log('');

    // Step 9: Error case - Fetch product by invalid ID
    console.log('9️⃣ Fetching product by invalid ID (INVALID123)...');
    try {
      await axios.get(
        `${API_BASE}/banking/products/INVALID123`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('❌ Unexpectedly succeeded in fetching invalid product');
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        console.log('✅ Correctly handled not found for invalid product ID');
      } else {
        console.log('❌ Unexpected error for invalid product ID:', err.message);
      }
    }
    console.log('');

    // Step 10: Error case - List products with invalid accountId
    console.log('🔟 Listing products with invalid accountId (abc123)...');
    try {
      await axios.get(
        `${API_BASE}/banking/products`,
        {
          params: { accountId: 'abc123' },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('❌ Unexpectedly succeeded in listing products with invalid accountId');
    } catch (err: any) {
      if (err.response && err.response.status === 400) {
        console.log('✅ Correctly handled validation error for invalid accountId');
      } else {
        console.log('❌ Unexpected error for invalid accountId:', err.message);
      }
    }
    console.log('');

    // Final Summary
    console.log('🎉 All tests completed successfully!');
    console.log('=====================================');
    console.log('✅ Token generation');
    console.log('✅ Health check');
    console.log('✅ List payees');
    console.log('✅ Create payee (Pay ID)');
    console.log('✅ Create payee (Account+BSB)');
    console.log('✅ Get payee details');
    console.log('✅ Update payee');
    console.log('✅ Filter payees');
    console.log('✅ Validation errors');
    console.log('✅ Delete payees');
    console.log('✅ Create payment');
    console.log('✅ Search payments (by payee, product, date)');
    console.log('✅ Payment validation errors');
    console.log('✅ List products');
    console.log('✅ Fetch product by ID');
    console.log('✅ Error handling for invalid product ID');
    console.log('✅ Error handling for invalid account ID');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('   Status:', error.response?.status);
      console.error('   Error:', error.response?.data);
    }
  }
}

// Helper function to test server without authentication
async function testServerWithoutAuth() {
  console.log('\n🔒 Testing endpoints without authentication...');
  
  try {
    await axios.get(`${API_BASE}/banking/payees?accountNumber=1234567890`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.log('✅ Authentication required (as expected)');
      console.log(`   Error: ${error.response.data.error}`);
      console.log(`   Message: ${error.response.data.message}`);
    }
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive API tests...\n');
  
  // Test main functionality
  await testBankingServer();
  
  // Test authentication
  await testServerWithoutAuth();
  
  console.log('\n🏁 All tests completed!');
}

// Export for use
export { testBankingServer, testServerWithoutAuth, runAllTests };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
} 