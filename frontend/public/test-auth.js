// Quick Frontend Test - Test authentication flow
console.log('🧪 Testing Authentication Flow...');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔄 DOM Ready - Starting authentication test...');
  
  try {
    // Test 1: Check if requireAuthentication is available
    if (typeof window.requireAuthentication === 'function') {
      console.log('✅ requireAuthentication function is available');
      
      // Test 2: Check current authentication status
      console.log('🔍 Checking authentication status...');
      const isAuthenticated = await window.requireAuthentication();
      console.log(`🔐 Authentication result: ${isAuthenticated}`);
      
      if (isAuthenticated) {
        console.log('✅ User is authenticated - practice should work');
      } else {
        console.log('❌ User is not authenticated - auth modal should appear');
      }
    } else {
      console.log('❌ requireAuthentication function not found');
    }
    
    // Test 3: Check if AuthClient is available and working
    if (window.AuthClient) {
      console.log('🔧 Testing AuthClient...');
      const authClient = new window.AuthClient();
      const user = await authClient.checkAuthStatus();
      console.log('👤 Current user:', user);
    }
    
  } catch (error) {
    console.error('💥 Authentication test failed:', error);
  }
});

console.log('📋 Test script loaded - waiting for DOM...');
