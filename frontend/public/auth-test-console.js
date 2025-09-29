// Authentication Flow Integration Test
// Run this in the browser console on the practice page

(async function testAuthenticationFlow() {
  console.log('🧪 AUTHENTICATION FLOW TEST STARTING...');
  console.log('================================================');
  
  const results = [];
  
  function addResult(test, success, message) {
    const result = { test, success, message };
    results.push(result);
    console.log(`${success ? '✅' : '❌'} ${test}: ${message}`);
  }
  
  try {
    // Test 1: Check if authentication functions are available
    console.log('\n1️⃣ Testing Function Availability...');
    
    if (typeof window.requireAuthentication === 'function') {
      addResult('requireAuthentication Function', true, 'Function is available');
    } else {
      addResult('requireAuthentication Function', false, 'Function not found');
      return;
    }
    
    if (typeof window.openAuthModal === 'function') {
      addResult('openAuthModal Function', true, 'Function is available');
    } else {
      addResult('openAuthModal Function', false, 'Function not found');
    }
    
    if (window.AuthClient) {
      addResult('AuthClient Class', true, 'Class is available');
    } else {
      addResult('AuthClient Class', false, 'Class not found');
      return;
    }
    
    // Test 2: Check backend connectivity
    console.log('\n2️⃣ Testing Backend Connectivity...');
    
    try {
      const authClient = new window.AuthClient();
      const healthResponse = await fetch('http://localhost:3008/');
      
      if (healthResponse.ok) {
        addResult('Backend Health', true, 'Backend server is accessible');
        
        // Test authentication status
        const user = await authClient.checkAuthStatus();
        if (user) {
          addResult('Current Auth Status', true, `User authenticated: ${user.username}`);
        } else {
          addResult('Current Auth Status', false, 'No authenticated user');
        }
      } else {
        addResult('Backend Health', false, `Backend responded with status: ${healthResponse.status}`);
      }
    } catch (error) {
      addResult('Backend Connectivity', false, `Backend connection failed: ${error.message}`);
    }
    
    // Test 3: Test the requireAuthentication flow
    console.log('\n3️⃣ Testing requireAuthentication Flow...');
    
    try {
      // This should either return true (if authenticated) or show modal and return false
      const authResult = await window.requireAuthentication();
      
      if (authResult === true) {
        addResult('requireAuthentication Flow', true, 'User is authenticated - can access protected content');
      } else if (authResult === false) {
        addResult('requireAuthentication Flow', true, 'User not authenticated - auth modal should be visible');
      } else {
        addResult('requireAuthentication Flow', false, `Unexpected result: ${authResult}`);
      }
    } catch (error) {
      addResult('requireAuthentication Flow', false, `Flow failed: ${error.message}`);
    }
    
    // Test 4: Test practice page specific logic
    console.log('\n4️⃣ Testing Practice Page Logic...');
    
    try {
      // Simulate the practice page button click logic
      const practiceTestResult = await window.requireAuthentication();
      
      if (practiceTestResult) {
        addResult('Practice Access Test', true, 'Practice page should allow access to questions');
      } else {
        addResult('Practice Access Test', false, 'Practice page should show login modal');
      }
    } catch (error) {
      addResult('Practice Access Test', false, `Practice logic failed: ${error.message}`);
    }
    
    // Summary
    console.log('\n================================================');
    console.log('🏁 TEST SUMMARY');
    console.log('================================================');
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    console.log(`✅ Tests Passed: ${passed}/${total}`);
    
    if (passed === total) {
      console.log('🎉 ALL TESTS PASSED! Authentication system should be working.');
    } else {
      console.log('❌ Some tests failed. Check the individual test results above.');
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    const authStatus = results.find(r => r.test === 'Current Auth Status');
    if (authStatus && !authStatus.success) {
      console.log('1. User is not logged in. Try:');
      console.log('   - Click the Login button');
      console.log('   - Use existing account or create new one');
      console.log('   - After login, refresh page and run test again');
    }
    
    const backendHealth = results.find(r => r.test === 'Backend Health');
    if (backendHealth && !backendHealth.success) {
      console.log('2. Backend server issue. Check:');
      console.log('   - Backend server is running on port 3008');
      console.log('   - CORS configuration is correct');
      console.log('   - No firewall blocking the connection');
    }
    
    return results;
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    addResult('Test Suite', false, `Critical error: ${error.message}`);
    return results;
  }
})();

// Instructions for running the test
console.log('📋 INSTRUCTIONS:');
console.log('1. Open browser dev tools (F12)');
console.log('2. Go to the Console tab');
console.log('3. Copy and paste this entire script');
console.log('4. Press Enter to run');
console.log('5. Check results and follow recommendations');
console.log('');
console.log('Or just call: testAuthenticationFlow()');
