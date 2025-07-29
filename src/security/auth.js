import crypto from 'crypto';
import { EventEmitter } from 'events';

/**
 * Authentication Manager
 * Handles user authentication, 2FA, sessions, and access control
 */
export class AuthManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      sessionTimeout: config.sessionTimeout || 1800000, // 30 minutes
      maxLoginAttempts: config.maxLoginAttempts || 5,
      lockoutDuration: config.lockoutDuration || 900000, // 15 minutes
      require2FA: config.require2FA || false,
      jwtSecret: config.jwtSecret || this.generateSecret(),
      ...config
    };

    this.sessions = new Map();
    this.users = new Map();
    this.loginAttempts = new Map();
    this.lockedAccounts = new Map();
    this.totpSecrets = new Map();
    this.isInitialized = false;
    
    // Cleanup expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 300000);
  }

  /**
   * Initialize the authentication system
   */
  async init() {
    try {
      // Create default admin user
      this.createDefaultAdmin();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('✅ Authentication system initialized');
    } catch (error) {
      console.error('❌ Failed to initialize authentication system:', error);
      throw error;
    }
  }

  generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  createDefaultAdmin() {
    const adminUser = {
      id: 'admin',
      username: 'admin',
      email: 'admin@bigbase.local',
      role: 'administrator',
      passwordHash: this.hashPassword('admin123'),
      twoFactorEnabled: false,
      totpSecret: null,
      created: new Date(),
      lastLogin: null,
      active: true,
      permissions: ['*'] // All permissions
    };
    
    this.users.set('admin', adminUser);
  }

  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  async login(username, password, totpCode = null) {
    try {
      // Check if account is locked
      if (this.isAccountLocked(username)) {
        throw new Error('Account is temporarily locked due to too many failed attempts');
      }

      const user = this.users.get(username);
      if (!user || !user.active) {
        this.recordFailedLogin(username);
        throw new Error('Invalid credentials');
      }

      // Verify password
      if (!this.verifyPassword(password, user.passwordHash)) {
        this.recordFailedLogin(username);
        throw new Error('Invalid credentials');
      }

      // Check 2FA if enabled
      if (user.twoFactorEnabled) {
        if (!totpCode) {
          throw new Error('2FA code required');
        }
        
        if (!this.verifyTOTP(user.totpSecret, totpCode)) {
          this.recordFailedLogin(username);
          throw new Error('Invalid 2FA code');
        }
      }

      // Clear failed login attempts
      this.loginAttempts.delete(username);
      
      // Update last login
      user.lastLogin = new Date();
      
      // Create session
      const session = this.createSession(user);
      
      this.emit('userLogin', { user: user.username, sessionId: session.id });
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        },
        session: session,
        requires2FA: user.twoFactorEnabled && !totpCode
      };
      
    } catch (error) {
      this.emit('loginFailed', { username, error: error.message });
      throw error;
    }
  }

  createSession(user) {
    const sessionId = this.generateSecret();
    const session = {
      id: sessionId,
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      created: new Date(),
      lastActivity: new Date(),
      expires: new Date(Date.now() + this.config.sessionTimeout)
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    if (session.expires < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    // Update last activity
    session.lastActivity = new Date();
    session.expires = new Date(Date.now() + this.config.sessionTimeout);
    
    return session;
  }

  logout(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.emit('userLogout', { sessionId, username: session.username });
      return true;
    }
    return false;
  }

  recordFailedLogin(username) {
    const attempts = this.loginAttempts.get(username) || { count: 0, lastAttempt: new Date() };
    attempts.count++;
    attempts.lastAttempt = new Date();
    this.loginAttempts.set(username, attempts);
    
    if (attempts.count >= this.config.maxLoginAttempts) {
      this.lockAccount(username);
    }
  }

  lockAccount(username) {
    const lockUntil = new Date(Date.now() + this.config.lockoutDuration);
    this.lockedAccounts.set(username, lockUntil);
    this.emit('accountLocked', { username, lockUntil });
  }

  isAccountLocked(username) {
    const lockUntil = this.lockedAccounts.get(username);
    if (!lockUntil) return false;
    
    if (lockUntil < new Date()) {
      this.lockedAccounts.delete(username);
      this.loginAttempts.delete(username);
      return false;
    }
    
    return true;
  }

  // Two-Factor Authentication Methods
  generateTOTPSecret() {
    return crypto.randomBytes(20).toString('base32');
  }

  enable2FA(userId) {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    
    const secret = this.generateTOTPSecret();
    user.totpSecret = secret;
    user.twoFactorEnabled = true;
    
    return {
      secret,
      qrCodeData: this.generateQRCodeData(user.username, secret)
    };
  }

  disable2FA(userId) {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    
    user.twoFactorEnabled = false;
    user.totpSecret = null;
    
    return true;
  }

  generateQRCodeData(username, secret) {
    const issuer = 'BigBaseAlpha';
    const label = `${issuer}:${username}`;
    return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  }

  verifyTOTP(secret, token) {
    if (!secret || !token) return false;
    
    const time = Math.floor(Date.now() / 30000);
    
    // Check current time window and adjacent windows for clock skew
    for (let i = -1; i <= 1; i++) {
      if (this.generateTOTP(secret, time + i) === token) {
        return true;
      }
    }
    
    return false;
  }

  generateTOTP(secret, time) {
    const key = Buffer.from(secret, 'base32');
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(Math.floor(time / Math.pow(2, 32)), 0);
    timeBuffer.writeUInt32BE(time & 0xffffffff, 4);
    
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(timeBuffer);
    const digest = hmac.digest();
    
    const offset = digest[digest.length - 1] & 0xf;
    const code = ((digest[offset] & 0x7f) << 24) |
                 ((digest[offset + 1] & 0xff) << 16) |
                 ((digest[offset + 2] & 0xff) << 8) |
                 (digest[offset + 3] & 0xff);
    
    return (code % 1000000).toString().padStart(6, '0');
  }

  // User Management
  createUser(userData) {
    const { username, email, password, role = 'viewer' } = userData;
    
    if (this.users.has(username)) {
      throw new Error('Username already exists');
    }
    
    const user = {
      id: username,
      username,
      email,
      role,
      passwordHash: this.hashPassword(password),
      twoFactorEnabled: false,
      totpSecret: null,
      created: new Date(),
      lastLogin: null,
      active: true,
      permissions: this.getRolePermissions(role)
    };
    
    this.users.set(username, user);
    this.emit('userCreated', { username });
    
    return user;
  }

  updateUser(userId, updates) {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    
    Object.assign(user, updates);
    this.emit('userUpdated', { userId });
    
    return user;
  }

  deleteUser(userId) {
    if (userId === 'admin') {
      throw new Error('Cannot delete admin user');
    }
    
    const deleted = this.users.delete(userId);
    if (deleted) {
      this.emit('userDeleted', { userId });
    }
    
    return deleted;
  }

  getRolePermissions(role) {
    const permissions = {
      'administrator': ['*'],
      'operator': ['read', 'write', 'update', 'backup', 'query'],
      'viewer': ['read', 'query'],
      'guest': ['read']
    };
    
    return permissions[role] || permissions['guest'];
  }

  hasPermission(sessionId, permission) {
    const session = this.validateSession(sessionId);
    if (!session) return false;
    
    return session.permissions.includes('*') || session.permissions.includes(permission);
  }

  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions) {
      if (session.expires < now) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.emit('sessionsCleanup', { cleanedCount });
    }
  }

  // Statistics
  getStats() {
    return {
      totalUsers: this.users.size,
      activeSessions: this.sessions.size,
      lockedAccounts: this.lockedAccounts.size,
      usersWithTwoFactor: Array.from(this.users.values()).filter(u => u.twoFactorEnabled).length
    };
  }

  // Get all users (for admin panel)
  getAllUsers() {
    return Array.from(this.users.values()).map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      created: user.created,
      lastLogin: user.lastLogin,
      active: user.active,
      twoFactorEnabled: user.twoFactorEnabled
    }));
  }

  // Get users (alias for API compatibility)
  async getUsers() {
    return this.getAllUsers();
  }

  // Delete user
  async deleteUser(userId) {
    try {
      if (!this.users.has(userId)) {
        throw new Error('User not found');
      }

      const user = this.users.get(userId);
      
      // Prevent deleting the last admin
      if (user.role === 'admin') {
        const adminCount = Array.from(this.users.values()).filter(u => u.role === 'admin').length;
        if (adminCount <= 1) {
          throw new Error('Cannot delete the last admin user');
        }
      }

      // Remove user
      this.users.delete(userId);
      
      // Remove related data
      this.totpSecrets.delete(userId);
      
      // Remove active sessions
      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.userId === userId) {
          this.sessions.delete(sessionId);
        }
      }

      this.emit('userDeleted', { userId, username: user.username });
      return true;
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  // Enable 2FA for user
  async enable2FA(userId) {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate TOTP secret
      const secret = this.generateTOTPSecret();
      this.totpSecrets.set(userId, secret);

      // Update user
      user.twoFactorEnabled = true;
      this.users.set(userId, user);

      // Generate QR code
      const qrCode = this.generateQRCode(user.username, secret);

      this.emit('2faEnabled', { userId, username: user.username });

      return {
        secret,
        qrCode,
        success: true
      };
    } catch (error) {
      throw new Error(`Failed to enable 2FA: ${error.message}`);
    }
  }

  // Disable 2FA for user
  async disable2FA(userId) {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Remove TOTP secret
      this.totpSecrets.delete(userId);

      // Update user
      user.twoFactorEnabled = false;
      this.users.set(userId, user);

      this.emit('2faDisabled', { userId, username: user.username });

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to disable 2FA: ${error.message}`);
    }
  }

  // Generate QR Code for 2FA setup
  generateQRCode(username, secret) {
    // Generate TOTP URI
    const issuer = 'BigBaseAlpha';
    const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    
    // For a real implementation, you would use a QR code library
    // Here we return a data URL that represents the QR code
    return `data:image/svg+xml;base64,${Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="white"/>
        <text x="100" y="100" text-anchor="middle" fill="black" font-size="12">
          QR Code for: ${username}
          Secret: ${secret}
        </text>
      </svg>
    `).toString('base64')}`;
  }

  // Generate TOTP secret
  generateTOTPSecret() {
    return crypto.randomBytes(20).toString('base32').replace(/=/g, '');
  }

  // Get active sessions (for admin panel)
  getActiveSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      username: session.username,
      role: session.role,
      created: session.created,
      lastActivity: session.lastActivity,
      expires: session.expires
    }));
  }
}

export default AuthManager;
