// auth.js - Authentication client-side logic (JavaScript version)

class AuthClient {
  constructor() {
    this.baseURL = 'http://localhost:3001';
    this.currentUser = null;
    this.checkAuthStatus();
  }

  // Check if user is authenticated
  async checkAuthStatus() {
    try {
      const response = await fetch(`${this.baseURL}/auth/me`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.user;
        this.updateUIForAuthenticatedUser(this.currentUser);
        return this.currentUser;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
    
    this.currentUser = null;
    this.updateUIForUnauthenticatedUser();
    return null;
  }

  // Google OAuth login
  initiateGoogleLogin() {
    window.location.href = `${this.baseURL}/auth/google`;
  }

  // Email signup
  async signup(name, email, marketingConsent = false) {
    try {
      const response = await fetch(`${this.baseURL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name, email, marketingConsent })
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  // Email login
  async login(email) {
    try {
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  // Verify email (for signup)
  async verifyEmail(email, code, name, marketingConsent) {
    try {
      const response = await fetch(`${this.baseURL}/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, code, name, marketingConsent })
      });

      const data = await response.json();

      if (response.ok) {
        this.currentUser = data.user;
        this.updateUIForAuthenticatedUser(this.currentUser);
        return { success: true, message: data.message, user: data.user };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  // Verify login code
  async verifyLogin(email, code) {
    try {
      const response = await fetch(`${this.baseURL}/auth/verify-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, code })
      });

      const data = await response.json();

      if (response.ok) {
        this.currentUser = data.user;
        this.updateUIForAuthenticatedUser(this.currentUser);
        return { success: true, message: data.message, user: data.user };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  // Resend verification code
  async resendCode(email, type = 'email_verification') {
    try {
      const response = await fetch(`${this.baseURL}/auth/resend-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, type })
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  // Logout
  async logout() {
    try {
      await fetch(`${this.baseURL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    this.currentUser = null;
    this.updateUIForUnauthenticatedUser();
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Update UI for authenticated user
  updateUIForAuthenticatedUser(user) {
    // Update login/signup buttons
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const userMenu = document.getElementById('user-menu');
    
    if (loginBtn) loginBtn.classList.add('hidden');
    if (signupBtn) signupBtn.classList.add('hidden');
    
    if (userMenu) {
      userMenu.classList.remove('hidden');
      const userName = userMenu.querySelector('#user-name');
      const userAvatar = userMenu.querySelector('#user-avatar');
      
      if (userName) userName.textContent = user.name;
      if (userAvatar && user.avatar) {
        userAvatar.src = user.avatar;
      } else if (userAvatar) {
        // Set default avatar with user initials
        userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3b82f6&color=fff`;
      }
    }
  }

  // Update UI for unauthenticated user
  updateUIForUnauthenticatedUser() {
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const userMenu = document.getElementById('user-menu');
    
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (signupBtn) signupBtn.classList.remove('hidden');
    if (userMenu) userMenu.classList.add('hidden');
  }
}

// Modal UI Controller
class AuthModalController {
  constructor() {
    this.authClient = new AuthClient();
    this.currentEmail = '';
    this.currentName = '';
    this.currentMarketingConsent = false;
    this.isSignup = false;
    this.resendTimer = 0;
    this.resendInterval = null;
    
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.modal = document.getElementById('auth-modal');
    this.loginForm = document.getElementById('login-form');
    this.signupForm = document.getElementById('signup-form');
    this.verificationForm = document.getElementById('verification-form');
    this.loadingElement = document.getElementById('auth-loading');
    this.messageElement = document.getElementById('auth-message');
  }

  setupEventListeners() {
    // Modal controls
    document.getElementById('close-auth-modal')?.addEventListener('click', () => this.closeModal());
    document.getElementById('close-message')?.addEventListener('click', () => this.hideMessage());
    
    // Click outside to close
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });

    // Form switching
    document.getElementById('switch-to-signup')?.addEventListener('click', () => this.showSignupForm());
    document.getElementById('switch-to-login')?.addEventListener('click', () => this.showLoginForm());
    document.getElementById('back-to-form')?.addEventListener('click', () => this.backToForm());

    // Google OAuth buttons
    document.getElementById('google-signin-btn')?.addEventListener('click', () => this.authClient.initiateGoogleLogin());
    document.getElementById('google-signup-btn')?.addEventListener('click', () => this.authClient.initiateGoogleLogin());

    // Form submissions
    document.getElementById('email-login-form')?.addEventListener('submit', (e) => this.handleLoginSubmit(e));
    document.getElementById('email-signup-form')?.addEventListener('submit', (e) => this.handleSignupSubmit(e));
    document.getElementById('verification-code-form')?.addEventListener('submit', (e) => this.handleVerificationSubmit(e));

    // Resend code
    document.getElementById('resend-code-btn')?.addEventListener('click', () => this.resendCode());

    // Login/Signup buttons in header
    document.getElementById('login-btn')?.addEventListener('click', () => this.openModal('login'));
    document.getElementById('signup-btn')?.addEventListener('click', () => this.openModal('signup'));

    // User menu logout
    document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());

    // Auto-format verification code input
    const verificationInput = document.getElementById('verification-code');
    if (verificationInput) {
      verificationInput.addEventListener('input', (e) => {
        const target = e.target;
        target.value = target.value.replace(/\D/g, '').slice(0, 6);
      });
    }
  }

  openModal(type) {
    this.modal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    if (type === 'login') {
      this.showLoginForm();
    } else {
      this.showSignupForm();
    }
  }

  closeModal() {
    this.modal?.classList.add('hidden');
    document.body.style.overflow = 'auto';
    this.hideLoading();
    this.resetForms();
  }

  showLoginForm() {
    this.isSignup = false;
    const title = document.getElementById('auth-modal-title');
    if (title) title.textContent = 'Sign In';
    
    this.loginForm?.classList.remove('hidden');
    this.signupForm?.classList.add('hidden');
    this.verificationForm?.classList.add('hidden');
  }

  showSignupForm() {
    this.isSignup = true;
    const title = document.getElementById('auth-modal-title');
    if (title) title.textContent = 'Create Account';
    
    this.loginForm?.classList.add('hidden');
    this.signupForm?.classList.remove('hidden');
    this.verificationForm?.classList.add('hidden');
  }

  showVerificationForm(email) {
    this.loginForm?.classList.add('hidden');
    this.signupForm?.classList.add('hidden');
    this.verificationForm?.classList.remove('hidden');
    
    const emailElement = document.getElementById('verification-email');
    if (emailElement) emailElement.textContent = email;
    
    this.startResendTimer();
  }

  backToForm() {
    this.verificationForm?.classList.add('hidden');
    if (this.isSignup) {
      this.showSignupForm();
    } else {
      this.showLoginForm();
    }
    this.stopResendTimer();
  }

  showLoading() {
    this.loadingElement?.classList.remove('hidden');
  }

  hideLoading() {
    this.loadingElement?.classList.add('hidden');
  }

  showMessage(message, type) {
    const successIcon = document.getElementById('success-icon');
    const errorIcon = document.getElementById('error-icon');
    const messageText = document.getElementById('message-text');

    if (type === 'success') {
      successIcon?.classList.remove('hidden');
      errorIcon?.classList.add('hidden');
    } else {
      successIcon?.classList.add('hidden');
      errorIcon?.classList.remove('hidden');
    }

    if (messageText) messageText.textContent = message;
    this.messageElement?.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => this.hideMessage(), 5000);
  }

  hideMessage() {
    this.messageElement?.classList.add('hidden');
  }

  resetForms() {
    const forms = ['email-login-form', 'email-signup-form', 'verification-code-form'];
    forms.forEach(formId => {
      const form = document.getElementById(formId);
      if (form) form.reset();
    });
    
    this.currentEmail = '';
    this.currentName = '';
    this.currentMarketingConsent = false;
    this.stopResendTimer();
  }

  startResendTimer() {
    this.resendTimer = 60;
    const button = document.getElementById('resend-code-btn');
    const timer = document.getElementById('resend-timer');
    
    if (button) button.disabled = true;
    timer?.classList.remove('hidden');
    
    this.resendInterval = setInterval(() => {
      this.resendTimer--;
      if (timer) timer.textContent = `(${this.resendTimer}s)`;
      
      if (this.resendTimer <= 0) {
        this.stopResendTimer();
      }
    }, 1000);
  }

  stopResendTimer() {
    if (this.resendInterval) {
      clearInterval(this.resendInterval);
      this.resendInterval = null;
    }
    
    const button = document.getElementById('resend-code-btn');
    const timer = document.getElementById('resend-timer');
    
    if (button) button.disabled = false;
    timer?.classList.add('hidden');
  }

  async handleLoginSubmit(e) {
    e.preventDefault();
    this.showLoading();

    const form = e.target;
    const formData = new FormData(form);
    const email = formData.get('email');

    const result = await this.authClient.login(email);
    this.hideLoading();

    if (result.success) {
      this.currentEmail = email;
      this.showVerificationForm(email);
      this.showMessage(result.message, 'success');
    } else {
      this.showMessage(result.message, 'error');
    }
  }

  async handleSignupSubmit(e) {
    e.preventDefault();
    this.showLoading();

    const form = e.target;
    const formData = new FormData(form);
    
    this.currentName = formData.get('name');
    this.currentEmail = formData.get('email');
    this.currentMarketingConsent = formData.has('marketingConsent');

    const result = await this.authClient.signup(this.currentName, this.currentEmail, this.currentMarketingConsent);
    this.hideLoading();

    if (result.success) {
      this.showVerificationForm(this.currentEmail);
      this.showMessage(result.message, 'success');
    } else {
      this.showMessage(result.message, 'error');
    }
  }

  async handleVerificationSubmit(e) {
    e.preventDefault();
    this.showLoading();

    const form = e.target;
    const formData = new FormData(form);
    const code = formData.get('code');

    let result;
    if (this.isSignup) {
      result = await this.authClient.verifyEmail(this.currentEmail, code, this.currentName, this.currentMarketingConsent);
    } else {
      result = await this.authClient.verifyLogin(this.currentEmail, code);
    }

    this.hideLoading();

    if (result.success) {
      this.showMessage(result.message, 'success');
      this.closeModal();
    } else {
      this.showMessage(result.message, 'error');
    }
  }

  async resendCode() {
    this.showLoading();
    
    const type = this.isSignup ? 'email_verification' : 'login_verification';
    const result = await this.authClient.resendCode(this.currentEmail, type);
    
    this.hideLoading();

    if (result.success) {
      this.showMessage(result.message, 'success');
      this.startResendTimer();
    } else {
      this.showMessage(result.message, 'error');
    }
  }

  async handleLogout() {
    await this.authClient.logout();
    this.showMessage('You have been logged out successfully', 'success');
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AuthModalController();
});

// Handle OAuth success/error redirects
if (typeof window !== 'undefined') {
  const pathname = window.location.pathname;
  
  if (pathname === '/auth/success') {
    // OAuth success - check auth status and redirect
    const authClient = new AuthClient();
    authClient.checkAuthStatus().then(user => {
      if (user) {
        window.history.replaceState({}, '', '/');
        // Show success message
        setTimeout(() => {
          const messageEl = document.getElementById('auth-message');
          if (messageEl) {
            const messageText = document.getElementById('message-text');
            const successIcon = document.getElementById('success-icon');
            const errorIcon = document.getElementById('error-icon');
            
            if (messageText) messageText.textContent = 'Successfully signed in!';
            successIcon?.classList.remove('hidden');
            errorIcon?.classList.add('hidden');
            messageEl.classList.remove('hidden');
            setTimeout(() => messageEl.classList.add('hidden'), 3000);
          }
        }, 100);
      }
    });
  } else if (pathname === '/auth/error') {
    // OAuth error - show error and redirect
    window.history.replaceState({}, '', '/');
    setTimeout(() => {
      const messageEl = document.getElementById('auth-message');
      if (messageEl) {
        const messageText = document.getElementById('message-text');
        const successIcon = document.getElementById('success-icon');
        const errorIcon = document.getElementById('error-icon');
        
        if (messageText) messageText.textContent = 'Authentication failed. Please try again.';
        successIcon?.classList.add('hidden');
        errorIcon?.classList.remove('hidden');
        messageEl.classList.remove('hidden');
        setTimeout(() => messageEl.classList.add('hidden'), 5000);
      }
    }, 100);
  }
}
