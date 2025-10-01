import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/database.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'fallback-key-change-this-immediately';

class UserModel {
  constructor() {
    this.initDatabase();
  }

  async initDatabase() {
    try {
      await fs.access(DATABASE_PATH);
    } catch (error) {
      // Create database file if it doesn't exist
      const initialData = {
        users: [],
        sessions: [],
        verificationCodes: [],
        metadata: {
          created: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      
      await fs.mkdir(path.dirname(DATABASE_PATH), { recursive: true });
      await fs.writeFile(DATABASE_PATH, JSON.stringify(initialData, null, 2));
    }
  }

  // GDPR compliant email encryption
  encryptEmail(email) {
    return CryptoJS.AES.encrypt(email.toLowerCase(), ENCRYPTION_KEY).toString();
  }

  decryptEmail(encryptedEmail) {
    const bytes = CryptoJS.AES.decrypt(encryptedEmail, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // Generate secure user ID
  generateUserId() {
    return crypto.randomUUID();
  }

  // Generate email verification code
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async readDatabase() {
    const data = await fs.readFile(DATABASE_PATH, 'utf8');
    const parsed = JSON.parse(data);
    // Ensure progress structure exists (migration)
    if (Array.isArray(parsed.users)) {
      let migrated = false;
      parsed.users = parsed.users.map(u => {
        if (!u.progress || !Array.isArray(u.progress.attempts)) {
          migrated = true;
          return { ...u, progress: { attempts: [] } };
        }
        return u;
      });
      if (migrated) {
        await this.writeDatabase(parsed);
      }
    }
    return parsed;
  }

  async writeDatabase(data) {
    await fs.writeFile(DATABASE_PATH, JSON.stringify(data, null, 2));
  }

  async createUser(userData) {
    const db = await this.readDatabase();
    
    const user = {
      id: this.generateUserId(),
      email: this.encryptEmail(userData.email),
      name: userData.name || '',
      avatar: userData.avatar || '',
      provider: userData.provider || 'email', // 'google', 'email'
      providerId: userData.providerId || null,
      emailVerified: userData.emailVerified || false,
      
      // GDPR compliance fields
      consentDate: new Date().toISOString(),
      consentVersion: '1.0',
      dataProcessingConsent: true,
      marketingConsent: userData.marketingConsent || false,
      
      // Timestamps
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: null,
      
      // Profile data
      preferences: {
        theme: 'light',
        notifications: true,
        practiceReminders: false
      },
      
      // Practice statistics (non-identifiable)
      stats: {
        questionsAnswered: 0,
        correctAnswers: 0,
        topicsStudied: [],
        lastPracticeDate: null
      },
      progress: { attempts: [] }
    };

    db.users.push(user);
    await this.writeDatabase(db);
    
    return user;
  }

  async findUserById(userId) {
    const db = await this.readDatabase();
    return db.users.find(user => user.id === userId);
  }

  async findUserByEmail(email) {
    const db = await this.readDatabase();
    const encryptedEmail = this.encryptEmail(email);
    return db.users.find(user => user.email === encryptedEmail);
  }

  async findUserByProviderId(provider, providerId) {
    const db = await this.readDatabase();
    return db.users.find(user => user.provider === provider && user.providerId === providerId);
  }

  async updateUser(userId, updates) {
    const db = await this.readDatabase();
    const userIndex = db.users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    // Update fields
    db.users[userIndex] = {
      ...db.users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.writeDatabase(db);
    return db.users[userIndex];
  }

  async updateLastLogin(userId) {
    return this.updateUser(userId, { lastLoginAt: new Date().toISOString() });
  }

  async verifyEmail(userId) {
    return this.updateUser(userId, { emailVerified: true });
  }

  // Email verification code management
  async storeVerificationCode(email, code, type = 'email_verification') {
    const db = await this.readDatabase();
    const encryptedEmail = this.encryptEmail(email);
    
    // Remove any existing codes for this email
    db.verificationCodes = db.verificationCodes.filter(vc => vc.email !== encryptedEmail);
    
    const verificationEntry = {
      id: this.generateUserId(),
      email: encryptedEmail,
      code: code,
      type: type,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      used: false
    };

    db.verificationCodes.push(verificationEntry);
    await this.writeDatabase(db);
    
    return verificationEntry;
  }

  async verifyCode(email, code, type = 'email_verification') {
    const db = await this.readDatabase();
    const encryptedEmail = this.encryptEmail(email);
    
    const verificationEntry = db.verificationCodes.find(vc => 
      vc.email === encryptedEmail && 
      vc.code === code && 
      vc.type === type &&
      !vc.used &&
      new Date(vc.expiresAt) > new Date()
    );

    if (!verificationEntry) {
      return false;
    }

    // Mark code as used
    verificationEntry.used = true;
    await this.writeDatabase(db);
    
    return true;
  }

  // GDPR compliance methods
  async exportUserData(userId) {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Decrypt sensitive data for export
    const exportData = {
      ...user,
      email: this.decryptEmail(user.email),
      exportDate: new Date().toISOString(),
      dataVersion: '1.0'
    };

    return exportData;
  }

  async deleteUserData(userId) {
    const db = await this.readDatabase();
    
    // Remove user
    db.users = db.users.filter(user => user.id !== userId);
    
    // Remove user sessions
    db.sessions = db.sessions.filter(session => session.userId !== userId);
    
    // Remove verification codes (by user ID if we had that relationship)
    // For now, we'll clean up old codes separately
    
    await this.writeDatabase(db);
    return true;
  }

  async updateConsent(userId, consentData) {
    return this.updateUser(userId, {
      marketingConsent: consentData.marketing,
      consentDate: new Date().toISOString(),
      consentVersion: consentData.version || '1.0'
    });
  }

  // Cleanup expired verification codes
  async cleanupExpiredCodes() {
    const db = await this.readDatabase();
    const now = new Date();
    
    db.verificationCodes = db.verificationCodes.filter(vc => 
      new Date(vc.expiresAt) > now
    );
    
    await this.writeDatabase(db);
  }

  // Get users for data retention cleanup (older than retention period)
  async getUsersForRetention() {
    const db = await this.readDatabase();
    const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 2555; // 7 years default
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    return db.users.filter(user => {
      const lastActivity = user.lastLoginAt || user.createdAt;
      return new Date(lastActivity) < cutoffDate;
    });
  }

  // Progress APIs
  async addOrUpdateAttempt(userId, { questionId, timeTakenSeconds = null, notes = '' }) {
    const db = await this.readDatabase();
    const idx = db.users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    const user = db.users[idx];
    if (!user.progress || !Array.isArray(user.progress.attempts)) {
      user.progress = { attempts: [] };
    }
    const attempts = user.progress.attempts;
    const existing = attempts.find(a => a.questionId === questionId);
    const nowIso = new Date().toISOString();
    if (existing) {
      existing.lastUpdatedAt = nowIso;
      if (timeTakenSeconds != null) existing.timeTakenSeconds = timeTakenSeconds;
      if (notes) existing.notes = notes;
    } else {
      attempts.push({ questionId, completedAt: nowIso, lastUpdatedAt: nowIso, timeTakenSeconds, notes });
      user.stats.questionsAnswered = (user.stats.questionsAnswered || 0) + 1;
      user.stats.lastPracticeDate = nowIso;
    }
    user.updatedAt = nowIso;
    db.users[idx] = user;
    await this.writeDatabase(db);
    return attempts.find(a => a.questionId === questionId);
  }

  async getAttempts(userId) {
    const db = await this.readDatabase();
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    if (!user.progress || !Array.isArray(user.progress.attempts)) return [];
    return user.progress.attempts;
  }

  async hasCompleted(userId, questionId) {
    try {
      const attempts = await this.getAttempts(userId);
      return attempts.some(a => a.questionId === questionId);
    } catch {
      return false;
    }
  }
}

export default new UserModel();
