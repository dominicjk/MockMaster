// auth.ts - Authentication client-side logic

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  emailVerified: boolean;
  preferences?: {
    theme?: string;
    notifications?: boolean;
    practiceReminders?: boolean;
  };
  stats?: {
    questionsAnswered?: number;
    correctAnswers?: number;
    topicsStudied?: string[];
    lastPracticeDate?: string;
  };
}

class AuthClient {
  private baseURL = 'http://localhost:3001';
  private currentUser: User | null = null;
  
  constructor() {
    this.checkAuthStatus();
  }

  // Check if user is authenticated
  async checkAuthStatus(): Promise<User | null> {
    try {
      const response = await fetch(`${this.baseURL}/auth/me`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.user;
        if (this.currentUser) {
          this.updateUIForAuthenticatedUser(this.currentUser);
        }
        return this.currentUser;
      }
    } catch (err) {
      console.error('Auth check failed:', err);
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
  async signup(name: string, email: string, marketingConsent: boolean = false): Promise<{ success: boolean; message: string }> {
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
  async login(email: string): Promise<{ success: boolean; message: string }> {
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
  async verifyEmail(email: string, code: string, name?: string, marketingConsent?: boolean): Promise<{ success: boolean; message: string; user?: User }> {
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
        if (this.currentUser) {
          this.updateUIForAuthenticatedUser(this.currentUser);
        }
        return { success: true, message: data.message, user: data.user };
      } else {
        return { success: false, message: data.error };
      }
    } catch (err) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  // Verify login code
  async verifyLogin(email: string, code: string): Promise<{ success: boolean; message: string; user?: User }> {
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
        if (this.currentUser) {
          this.updateUIForAuthenticatedUser(this.currentUser);
        }
        return { success: true, message: data.message, user: data.user };
      } else {
        return { success: false, message: data.error };
      }
    } catch (err) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  // Resend verification code
  async resendCode(email: string, type: string = 'email_verification'): Promise<{ success: boolean; message: string }> {
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
  async logout(): Promise<void> {
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
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Update UI for authenticated user
  private updateUIForAuthenticatedUser(user: User) {
    // Update login/signup buttons
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const userMenu = document.getElementById('user-menu');
    
    if (loginBtn) loginBtn.classList.add('hidden');
    if (signupBtn) signupBtn.classList.add('hidden');
    
    if (userMenu) {
      userMenu.classList.remove('hidden');
      const userName = userMenu.querySelector('#user-name');
      const userAvatar = userMenu.querySelector('#user-avatar') as HTMLImageElement;
      
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
  private updateUIForUnauthenticatedUser() {
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
  private modal: HTMLElement;
  private loginForm: HTMLElement;
  private signupForm: HTMLElement;
  private verificationForm: HTMLElement;
  private loadingElement: HTMLElement;
  private messageElement: HTMLElement;
  private authClient: AuthClient;
  
  private currentEmail: string = '';
  private currentName: string = '';
  private currentMarketingConsent: boolean = false;
  private isSignup: boolean = false;
  private resendTimer: number = 0;
  private resendInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.authClient = new AuthClient();
    this.initializeElements();
    this.setupEventListeners();
  }

  private initializeElements() {
    this.modal = document.getElementById('auth-modal')!;
    this.loginForm = document.getElementById('login-form')!;
    this.signupForm = document.getElementById('signup-form')!;
    this.verificationForm = document.getElementById('verification-form')!;
    this.loadingElement = document.getElementById('auth-loading')!;
    this.messageElement = document.getElementById('auth-message')!;
  }

  private setupEventListeners() {
    // Modal controls
    document.getElementById('close-auth-modal')?.addEventListener('click', () => this.closeModal());
    document.getElementById('close-message')?.addEventListener('click', () => this.hideMessage());
    
    // Click outside to close
    this.modal.addEventListener('click', (e) => {
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
    const verificationInput = document.getElementById('verification-code') as HTMLInputElement;
    if (verificationInput) {
      verificationInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        target.value = target.value.replace(/\D/g, '').slice(0, 6);
      });
    }
  }

  openModal(type: 'login' | 'signup') {
    this.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    if (type === 'login') {
      this.showLoginForm();
    } else {
      this.showSignupForm();
    }
  }

  closeModal() {
    this.modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
    this.hideLoading();
    this.resetForms();
  }

  private showLoginForm() {
    this.isSignup = false;
    document.getElementById('auth-modal-title')!.textContent = 'Sign In';
    this.loginForm.classList.remove('hidden');
    this.signupForm.classList.add('hidden');
    this.verificationForm.classList.add('hidden');
  }

  private showSignupForm() {
    this.isSignup = true;
    document.getElementById('auth-modal-title')!.textContent = 'Create Account';
    this.loginForm.classList.add('hidden');
    this.signupForm.classList.remove('hidden');
    this.verificationForm.classList.add('hidden');
  }

  private showVerificationForm(email: string) {
    this.loginForm.classList.add('hidden');
    this.signupForm.classList.add('hidden');
    this.verificationForm.classList.remove('hidden');
    
    document.getElementById('verification-email')!.textContent = email;
    this.startResendTimer();
  }

  private backToForm() {
    this.verificationForm.classList.add('hidden');
    if (this.isSignup) {
      this.showSignupForm();
    } else {
      this.showLoginForm();
    }
    this.stopResendTimer();
  }

  private showLoading() {
    this.loadingElement.classList.remove('hidden');
  }

  private hideLoading() {
    this.loadingElement.classList.add('hidden');
  }

  private showMessage(message: string, type: 'success' | 'error') {
    const successIcon = document.getElementById('success-icon')!;
    const errorIcon = document.getElementById('error-icon')!;
    const messageText = document.getElementById('message-text')!;

    if (type === 'success') {
      successIcon.classList.remove('hidden');
      errorIcon.classList.add('hidden');
    } else {
      successIcon.classList.add('hidden');
      errorIcon.classList.remove('hidden');
    }

    messageText.textContent = message;
    this.messageElement.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => this.hideMessage(), 5000);
  }

  private hideMessage() {
    this.messageElement.classList.add('hidden');
  }

  private resetForms() {
    const forms = ['email-login-form', 'email-signup-form', 'verification-code-form'];
    forms.forEach(formId => {
      const form = document.getElementById(formId) as HTMLFormElement;
      if (form) form.reset();
    });
    
    this.currentEmail = '';
    this.currentName = '';
    this.currentMarketingConsent = false;
    this.stopResendTimer();
  }

  private startResendTimer() {
    this.resendTimer = 60;
    const button = document.getElementById('resend-code-btn') as HTMLButtonElement;
    const timer = document.getElementById('resend-timer')!;
    
    button.disabled = true;
    timer.classList.remove('hidden');
    
    this.resendInterval = setInterval(() => {
      this.resendTimer--;
      timer.textContent = `(${this.resendTimer}s)`;
      
      if (this.resendTimer <= 0) {
        this.stopResendTimer();
      }
    }, 1000);
  }

  private stopResendTimer() {
    if (this.resendInterval) {
      clearInterval(this.resendInterval);
      this.resendInterval = null;
    }
    
    const button = document.getElementById('resend-code-btn') as HTMLButtonElement;
    const timer = document.getElementById('resend-timer')!;
    
    if (button) button.disabled = false;
    if (timer) timer.classList.add('hidden');
  }

  private async handleLoginSubmit(e: Event) {
    e.preventDefault();
    this.showLoading();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get('email') as string;

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

  private async handleSignupSubmit(e: Event) {
    e.preventDefault();
    this.showLoading();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    this.currentName = formData.get('name') as string;
    this.currentEmail = formData.get('email') as string;
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

  private async handleVerificationSubmit(e: Event) {
    e.preventDefault();
    this.showLoading();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const code = formData.get('code') as string;

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
      
      // Optionally redirect or refresh page
      // window.location.reload();
    } else {
      this.showMessage(result.message, 'error');
    }
  }

  private async resendCode() {
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

  private async handleLogout() {
    await this.authClient.logout();
    this.showMessage('You have been logged out successfully', 'success');
    
    // Optionally redirect to home page
    // window.location.href = '/';
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
            document.getElementById('message-text')!.textContent = 'Successfully signed in!';
            document.getElementById('success-icon')!.classList.remove('hidden');
            document.getElementById('error-icon')!.classList.add('hidden');
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
        document.getElementById('message-text')!.textContent = 'Authentication failed. Please try again.';
        document.getElementById('success-icon')!.classList.add('hidden');
        document.getElementById('error-icon')!.classList.remove('hidden');
        messageEl.classList.remove('hidden');
        setTimeout(() => messageEl.classList.add('hidden'), 5000);
      }
    }, 100);
  }
}

export { AuthClient, AuthModalController };
