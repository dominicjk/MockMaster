import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import { fileURLToPath } from 'url';
import { ProgressTree, restoreProgressTree } from '../progress/progressTree.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/database.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'fallback-key-change-this-immediately';

class UserModel {
  constructor() {
    this.initDatabase();
    // In-memory failed attempt tracking (persists only for process lifetime)
    this.failedAttempts = new Map(); // key: codeId -> count
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

  hashCode(code, type) {
    // HMAC using ENCRYPTION_KEY; include type namespace for separation
    return crypto.createHmac('sha256', ENCRYPTION_KEY).update(`${type}:${code}`).digest('hex');
  }

  async readDatabase() {
    const data = await fs.readFile(DATABASE_PATH, 'utf8');
    const parsed = JSON.parse(data);
    // Ensure progress structure exists (migration)
    if (Array.isArray(parsed.users)) {
      let migrated = false;
      parsed.users = parsed.users.map(u => {
        let changed = false;
        // Ensure attempts array exists
        if (!u.progress || !Array.isArray(u.progress.attempts)) {
          u = { ...u, progress: { ...(u.progress||{}), attempts: [] } }; changed = true; migrated = true;
        }
        // Ensure progressTree exists (migrate from attempts if needed)
        if (!u.progress.progressTree) {
          const tree = ProgressTree.fromAttempts(u.progress.attempts || []);
            u.progress.progressTree = tree.toJSON();
            // Optionally keep attempts for backward compatibility
            changed = true; migrated = true;
        }
        return changed ? u : u;
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
    const now = Date.now();
    const expiryMinutes = parseInt(process.env.CODE_EXPIRY_MINUTES || '15');
    const cooldownSeconds = parseInt(process.env.CODE_COOLDOWN_SECONDS || '90');

    // Remove expired codes first
    db.verificationCodes = db.verificationCodes.filter(vc => new Date(vc.expiresAt) > new Date());

    // Check for recent existing code (cooldown reuse)
    const existing = db.verificationCodes.find(vc => vc.email === encryptedEmail && vc.type === type && !vc.used && (now - new Date(vc.createdAt).getTime()) < cooldownSeconds * 1000);
    let finalCode = code;
    let hashed;
    if (existing) {
      // Reuse original code (existing.code might be hashed or raw depending on legacy state)
      // We cannot recover original raw code if hashed; in that rare case we just overwrite with new.
      if (existing.code && existing.code.length === 6) {
        finalCode = existing.code; // raw legacy code stored
      }
    }
    hashed = this.hashCode(finalCode, type);

    // Remove other codes of same email+type
    db.verificationCodes = db.verificationCodes.filter(vc => !(vc.email === encryptedEmail && vc.type === type));

    const verificationEntry = {
      id: this.generateUserId(),
      email: encryptedEmail,
      // Store hashed value; legacy raw codes will no longer be stored after first new issue
      code: hashed,
      type,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(now + expiryMinutes * 60 * 1000).toISOString(),
      used: false,
      attempts: 0,
      maxAttempts: parseInt(process.env.MAX_CODE_ATTEMPTS || '5')
    };

    db.verificationCodes.push(verificationEntry);
    await this.writeDatabase(db);
    return { ...verificationEntry, raw: finalCode }; // return raw code for emailing
  }

  async verifyCode(email, code, type = 'email_verification') {
    const db = await this.readDatabase();
    const encryptedEmail = this.encryptEmail(email);
    const now = new Date();
    const hashedAttempt = this.hashCode(code, type);
    const entry = db.verificationCodes.find(vc => vc.email === encryptedEmail && vc.type === type && !vc.used && new Date(vc.expiresAt) > now);

    if (!entry) return false;

    // Backward compatibility: accept legacy plain code OR new hashed
    const match = (entry.code === hashedAttempt) || (entry.code.length === 6 && entry.code === code);
    if (!match) {
      entry.attempts = (entry.attempts || 0) + 1;
      if (entry.attempts >= (entry.maxAttempts || 5)) {
        entry.used = true; // lock out
      }
      await this.writeDatabase(db);
      return false;
    }
    entry.used = true;
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
    // Ensure tree present
    if (!user.progress.progressTree) {
      const treeBuilt = ProgressTree.fromAttempts(user.progress.attempts || []);
      user.progress.progressTree = treeBuilt.toJSON();
    }
    let tree = restoreProgressTree(user.progress.progressTree);
    const attempts = user.progress.attempts;
    const existing = attempts.find(a => a.questionId === questionId);
    const nowIso = new Date().toISOString();
    if (existing) {
      existing.lastUpdatedAt = nowIso;
      if (timeTakenSeconds != null) existing.timeTakenSeconds = timeTakenSeconds;
      if (notes) existing.notes = notes;
      tree.addAttempt(questionId, { timeTakenSeconds, notes, completedAt: existing.completedAt || existing.lastUpdatedAt });
    } else {
      attempts.push({ questionId, completedAt: nowIso, lastUpdatedAt: nowIso, timeTakenSeconds, notes });
      user.stats.questionsAnswered = (user.stats.questionsAnswered || 0) + 1;
      user.stats.lastPracticeDate = nowIso;
      tree.addAttempt(questionId, { timeTakenSeconds, notes, completedAt: nowIso });
    }
    user.updatedAt = nowIso;
    user.progress.progressTree = tree.toJSON();
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
      const db = await this.readDatabase();
      const user = db.users.find(u => u.id === userId);
      if (!user) return false;
      if (user.progress && user.progress.progressTree) {
        const tree = restoreProgressTree(user.progress.progressTree);
        if (tree.has(questionId)) return true;
      }
      const attempts = (user.progress && user.progress.attempts) ? user.progress.attempts : [];
      return attempts.some(a => a.questionId === questionId); // fallback
    } catch {
      return false;
    }
  }

  async getProgressTree(userId) {
    const db = await this.readDatabase();
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    if (!user.progress) user.progress = { attempts: [] };
    if (!user.progress.progressTree) {
      const tree = ProgressTree.fromAttempts(user.progress.attempts || []);
      user.progress.progressTree = tree.toJSON();
      await this.writeDatabase(db);
      return tree;
    }
    return restoreProgressTree(user.progress.progressTree);
  }
}

export default new UserModel();
