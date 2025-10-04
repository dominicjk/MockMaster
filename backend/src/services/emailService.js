import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_APP_PASSWORD;
    if (!user || !pass) {
      // Quietly skip; app can run without email
      return;
    }
    try {
      this.transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: { user, pass }
      });
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
    }
  }

  async sendVerificationEmail(email, code, name = '') {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Math Practice App <noreply@mathapp.com>',
      to: email,
      subject: 'Verify Your Email Address',
      html: this.generateVerificationEmailHTML(code, name),
      text: this.generateVerificationEmailText(code, name)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw error;
    }
  }

  generateVerificationEmailHTML(code, name) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .code-box { 
          background: #f8f9fa; 
          border: 2px solid #e9ecef; 
          padding: 20px; 
          text-align: center; 
          margin: 20px 0;
          border-radius: 8px;
        }
        .code { 
          font-size: 36px; 
          font-weight: bold; 
          color: #495057; 
          letter-spacing: 5px;
          font-family: monospace;
        }
        .footer { 
          margin-top: 30px; 
          padding-top: 20px; 
          border-top: 1px solid #e9ecef; 
          font-size: 14px; 
          color: #6c757d; 
        }
        .warning { 
          background: #fff3cd; 
          border: 1px solid #ffeaa7; 
          padding: 15px; 
          border-radius: 5px; 
          margin: 20px 0;
          color: #856404;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🧮 Math Practice App</h1>
          <h2>Email Verification</h2>
        </div>
        
        <p>Hello${name ? ` ${name}` : ''},</p>
        
        <p>Thank you for signing up! Please use the verification code below to complete your registration:</p>
        
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        
        <div class="warning">
          <strong>⚠️ Important:</strong>
          <ul>
            <li>This code expires in 15 minutes</li>
            <li>Never share this code with anyone</li>
            <li>If you didn't request this, please ignore this email</li>
          </ul>
        </div>
        
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        
        <div class="footer">
          <p><strong>Privacy Notice:</strong> We respect your privacy and comply with GDPR regulations. Your email is encrypted and stored securely. You can request data deletion at any time from your account settings.</p>
          
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  generateVerificationEmailText(code, name) {
    return `
Math Practice App - Email Verification

Hello${name ? ` ${name}` : ''},

Thank you for signing up! Please use the verification code below to complete your registration:

VERIFICATION CODE: ${code}

Important:
- This code expires in 15 minutes
- Never share this code with anyone
- If you didn't request this, please ignore this email

Privacy Notice: We respect your privacy and comply with GDPR regulations. Your email is encrypted and stored securely. You can request data deletion at any time from your account settings.

This is an automated message. Please do not reply to this email.
    `;
  }

  async sendPasswordResetEmail(email, code, name = '') {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Math Practice App <noreply@mathapp.com>',
      to: email,
      subject: 'Reset Your Password',
      html: this.generatePasswordResetHTML(code, name),
      text: this.generatePasswordResetText(code, name)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Password reset email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw error;
    }
  }

  generatePasswordResetHTML(code, name) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .code-box { 
          background: #f8f9fa; 
          border: 2px solid #e9ecef; 
          padding: 20px; 
          text-align: center; 
          margin: 20px 0;
          border-radius: 8px;
        }
        .code { 
          font-size: 36px; 
          font-weight: bold; 
          color: #dc3545; 
          letter-spacing: 5px;
          font-family: monospace;
        }
        .warning { 
          background: #f8d7da; 
          border: 1px solid #f5c6cb; 
          padding: 15px; 
          border-radius: 5px; 
          margin: 20px 0;
          color: #721c24;
        }
        .footer { 
          margin-top: 30px; 
          padding-top: 20px; 
          border-top: 1px solid #e9ecef; 
          font-size: 14px; 
          color: #6c757d; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🧮 Math Practice App</h1>
          <h2>Password Reset</h2>
        </div>
        
        <p>Hello${name ? ` ${name}` : ''},</p>
        
        <p>You requested to reset your password. Please use the verification code below:</p>
        
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        
        <div class="warning">
          <strong>🔒 Security Notice:</strong>
          <ul>
            <li>This code expires in 15 minutes</li>
            <li>Never share this code with anyone</li>
            <li>If you didn't request this, someone may have your email address</li>
            <li>Consider changing your password if you suspect unauthorized access</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  generatePasswordResetText(code, name) {
    return `
Math Practice App - Password Reset

Hello${name ? ` ${name}` : ''},

You requested to reset your password. Please use the verification code below:

VERIFICATION CODE: ${code}

Security Notice:
- This code expires in 15 minutes
- Never share this code with anyone
- If you didn't request this, someone may have your email address
- Consider changing your password if you suspect unauthorized access

This is an automated message. Please do not reply to this email.
    `;
  }

  // Test email configuration
  async testConnection() {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    try {
      await this.transporter.verify();
      console.log('Email service is ready');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      throw error;
    }
  }
}

export default new EmailService();