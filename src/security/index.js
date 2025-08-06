import { createCipheriv, createDecipheriv, randomBytes, createHash, pbkdf2Sync } from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Security Manager for BigBaseAlpha
 * Handles encryption, hashing, and security operations
 */
export class SecurityManager {
  constructor(config) {
    this.config = config;
    this.enabled = config.encryption || false;
    this.algorithm = config.encryptionAlgorithm || 'aes-256-gcm';
    this.keyDerivation = config.keyDerivation || 'pbkdf2';
    this.saltRounds = config.saltRounds || 12;
    
    // Logger support for v1.5.1
    this.logger = config.logger || {
      success: (msg) => console.log(`[SUCCESS] [SECURITY] ${msg}`),
      info: (msg) => console.log(`[INFO] [SECURITY] ${msg}`),
      warn: (msg) => console.log(`[WARN] [SECURITY] ${msg}`),
      error: (msg) => console.log(`[ERROR] [SECURITY] ${msg}`),
      process: (msg) => console.log(`[PROCESS] [SECURITY] ${msg}`)
    };
    
    // Internal state
    this.masterKey = null;
    this.encryptionKey = null;
    this.initialized = false;
    this.bcryptAvailable = false;
  }

  async _testBcrypt() {
    try {
      if (bcrypt && bcrypt.hash) {
        // Actually test bcrypt
        const testHash = await bcrypt.hash('test', 10);
        const testVerify = await bcrypt.compare('test', testHash);
        if (testVerify) {
          this.bcryptAvailable = true;
          this.logger.success('bcrypt is working properly');
        } else {
          this.logger.warn('bcrypt verification failed, using fallback');
          this.bcryptAvailable = false;
        }
      } else {
        this.logger.warn('bcrypt not properly loaded, using fallback');
        this.bcryptAvailable = false;
      }
    } catch (error) {
      this.logger.warn('bcrypt error:', error.message, ', using fallback');
      this.bcryptAvailable = false;
    }
  }

  async init() {
    // Test bcrypt first
    await this._testBcrypt();
    
    if (!this.enabled) {
      this.initialized = true;
      return;
    }

    // Generate or load master key
    await this._initializeMasterKey();
    
    // Derive encryption key
    this.encryptionKey = this._deriveKey(this.masterKey, 'encryption');
    
    this.initialized = true;
  }

  /**
   * Encrypt a document
   */
  async encryptDocument(document) {
    if (!this.enabled || !this.initialized) {
      return document;
    }

    const encryptedDoc = { ...document };
    
    // Encrypt sensitive fields
    for (const [key, value] of Object.entries(document)) {
      if (this._isSensitiveField(key, value)) {
        encryptedDoc[key] = await this.encrypt(value);
      }
    }

    // Add encryption metadata
    encryptedDoc._encrypted = true;
    encryptedDoc._encryptionVersion = '1.0';
    
    return encryptedDoc;
  }

  /**
   * Decrypt a document
   */
  async decryptDocument(document) {
    if (!this.enabled || !this.initialized || !document._encrypted) {
      return document;
    }

    const decryptedDoc = { ...document };
    
    // Remove encryption metadata
    delete decryptedDoc._encrypted;
    delete decryptedDoc._encryptionVersion;
    
    // Decrypt sensitive fields
    for (const [key, value] of Object.entries(document)) {
      if (this._isEncryptedField(value)) {
        try {
          decryptedDoc[key] = await this.decrypt(value);
        } catch (error) {
          console.error(`Failed to decrypt field ${key}:`, error.message);
          decryptedDoc[key] = '[DECRYPTION_FAILED]';
        }
      }
    }
    
    return decryptedDoc;
  }

  /**
   * Encrypt data using AES-GCM
   */
  async encrypt(data) {
    if (!this.enabled || !this.initialized) {
      return data;
    }

    try {
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Generate IV for each encryption
      const iv = randomBytes(16);
      
      // Create cipher
      const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag for GCM mode
      const authTag = cipher.getAuthTag ? cipher.getAuthTag() : null;
      
      // Return encrypted object
      return {
        __encrypted: true,
        __algorithm: this.algorithm,
        __iv: iv.toString('hex'),
        __authTag: authTag ? authTag.toString('hex') : null,
        __data: encrypted
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData) {
    if (!this.enabled || !this.initialized || !this._isEncryptedField(encryptedData)) {
      return encryptedData;
    }

    try {
      const { __iv, __authTag, __data, __algorithm } = encryptedData;
      
      // Create decipher
      const decipher = createDecipheriv(__algorithm || this.algorithm, this.encryptionKey, Buffer.from(__iv, 'hex'));
      
      // Set auth tag for GCM mode
      if (__authTag && decipher.setAuthTag) {
        decipher.setAuthTag(Buffer.from(__authTag, 'hex'));
      }
      
      // Decrypt data
      let decrypted = decipher.update(__data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Hash a password or sensitive value using bcrypt or PBKDF2 fallback
   */
  async hash(value) {
    if (typeof value !== 'string') {
      value = JSON.stringify(value);
    }
    
    if (this.bcryptAvailable) {
      try {
        return await bcrypt.hash(value, this.saltRounds);
      } catch (error) {
        console.warn('bcrypt failed, falling back to PBKDF2:', error.message);
      }
    }
    
    // Fallback to PBKDF2
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(value, salt, 100000, 64, 'sha512').toString('hex');
    return `$pbkdf2$${salt}$${hash}`;
  }

  /**
   * Verify a hashed value using bcrypt or PBKDF2 fallback
   */
  async verifyHash(value, hash) {
    if (typeof value !== 'string') {
      value = JSON.stringify(value);
    }

    // Check if it's a bcrypt hash ($2a$, $2b$, $2x$, $2y$)
    if (hash.startsWith('$2a') || hash.startsWith('$2b') || hash.startsWith('$2x') || hash.startsWith('$2y')) {
      if (this.bcryptAvailable) {
        try {
          return await bcrypt.compare(value, hash);
        } catch (error) {
          console.warn('bcrypt verification failed:', error.message);
          return false;
        }
      }
    }

    // Check if it's a PBKDF2 hash
    if (hash.startsWith('$pbkdf2$')) {
      const parts = hash.split('$');
      if (parts.length === 4) {
        const salt = parts[2];
        const originalHash = parts[3];
        const verifyHash = pbkdf2Sync(value, salt, 100000, 64, 'sha512').toString('hex');
        return verifyHash === originalHash;
      }
    }

    throw new Error('Unable to verify hash - no suitable algorithm available');
  }

  /**
   * Generate a secure random key
   */
  generateKey(length = 32) {
    return randomBytes(length);
  }

  /**
   * Generate a secure random string
   */
  generateRandomString(length = 32) {
    return randomBytes(length).toString('hex');
  }

  /**
   * Create a hash of data (for integrity checking)
   */
  createHash(data, algorithm = 'sha256') {
    const input = typeof data === 'string' ? data : JSON.stringify(data);
    return createHash(algorithm).update(input).digest('hex');
  }

  /**
   * Verify data integrity
   */
  verifyDataHash(data, expectedHash, algorithm = 'sha256') {
    const actualHash = this.createHash(data, algorithm);
    return actualHash === expectedHash;
  }

  /**
   * Create a digital signature
   */
  async createSignature(data) {
    const timestamp = Date.now();
    const payload = { data, timestamp };
    const hash = this.createHash(payload);
    
    return {
      hash,
      timestamp,
      signature: await this.encrypt(hash)
    };
  }

  /**
   * Verify a digital signature
   */
  async verifySignature(data, signature) {
    try {
      const decryptedHash = await this.decrypt(signature.signature);
      const expectedHash = this.createHash({ data, timestamp: signature.timestamp });
      
      return decryptedHash === expectedHash;
    } catch {
      return false;
    }
  }

  /**
   * Generate API key
   */
  generateApiKey() {
    const timestamp = Date.now();
    const random = this.generateRandomString(16);
    const payload = `${timestamp}.${random}`;
    const signature = this.createHash(payload);
    
    return `bba_${Buffer.from(payload).toString('base64')}.${signature.substring(0, 16)}`;
  }

  /**
   * Validate API key
   */
  validateApiKey(apiKey) {
    if (!apiKey.startsWith('bba_')) {
      return false;
    }

    try {
      const parts = apiKey.substring(4).split('.');
      if (parts.length !== 2) {
        return false;
      }

      const [payloadB64, providedSig] = parts;
      const payload = Buffer.from(payloadB64, 'base64').toString();
      const expectedSig = this.createHash(payload).substring(0, 16);

      return providedSig === expectedSig;
    } catch {
      return false;
    }
  }

  /**
   * Secure field operations
   */
  async secureField(fieldName, value, options = {}) {
    const operations = [];

    // Hash if specified
    if (options.hash) {
      value = await this.hash(value);
      operations.push('hashed');
    }

    // Encrypt if specified or if field is sensitive
    if (options.encrypt || this._isSensitiveField(fieldName, value)) {
      value = await this.encrypt(value);
      operations.push('encrypted');
    }

    return {
      value,
      operations,
      fieldName,
      timestamp: new Date()
    };
  }

  // Private methods

  async _initializeMasterKey() {
    // In production, this should be loaded from a secure location
    // For now, generate a key and store it (not recommended for production)
    
    const keyFile = '.bigbase.key';
    
    try {
      // Try to load existing key
      const { readFileSync } = await import('fs');
      this.masterKey = readFileSync(keyFile);
    } catch {
      // Generate new key
      this.masterKey = randomBytes(64);
      
      // Store key (in production, use a secure key management system)
      const { writeFileSync } = await import('fs');
      writeFileSync(keyFile, this.masterKey);
      
      this.logger.warn('Generated new master key. In production, use a secure key management system.');
    }
  }

  _deriveKey(masterKey, purpose, length = 32) {
    const salt = Buffer.from(purpose, 'utf8');
    return pbkdf2Sync(masterKey, salt, 100000, length, 'sha512');
  }

  _isSensitiveField(fieldName, value) {
    // List of field names that should be encrypted
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'apiKey',
      'auth',
      'credential',
      'private',
      'confidential',
      'ssn',
      'social',
      'credit',
      'card',
      'bank'
    ];

    const fieldLower = fieldName.toLowerCase();
    
    // Check if field name contains sensitive keywords
    const isSensitiveName = sensitiveFields.some(keyword => 
      fieldLower.includes(keyword)
    );

    // Check if value looks like sensitive data
    const isSensitiveValue = this._isSensitiveValue(value);

    return isSensitiveName || isSensitiveValue;
  }

  _isSensitiveValue(value) {
    if (typeof value !== 'string') {
      return false;
    }

    // Check for patterns that look like sensitive data
    const sensitivePatterns = [
      /^[A-Za-z0-9+/]{40,}={0,2}$/, // Base64 encoded data
      /^[a-f0-9]{32,}$/i,            // Hex encoded data
      /^sk_[a-zA-Z0-9]{20,}$/,       // Stripe-like secret key
      /^pk_[a-zA-Z0-9]{20,}$/,       // Stripe-like public key
      /^[0-9]{13,19}$/,              // Credit card number
      /^[0-9]{3}-[0-9]{2}-[0-9]{4}$/ // SSN pattern
    ];

    return sensitivePatterns.some(pattern => pattern.test(value));
  }

  _isEncryptedField(value) {
    return value && 
           typeof value === 'object' && 
           value.__encrypted === true && 
           value.__data;
  }
}

export default SecurityManager;
