/**
 * BigBaseAlpha HSM (Hardware Security Module) - Offline Implementation
 * 100% Offline, Self-Contained Hardware Security Module
 * 
 * @author ByAlphas
 * @version 1.5.0
 * @copyright 2025 ByAlphas. All rights reserved.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';

/**
 * Offline HSM Implementation for BigBaseAlpha
 * Provides hardware-level security simulation with software-based protection
 */
class OfflineHSM extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Logger support for v1.5.1
        this.logger = options.logger || {
            success: (msg) => console.log(`[SUCCESS] [HSM] ${msg}`),
            info: (msg) => console.log(`[INFO] [HSM] ${msg}`),
            warn: (msg) => console.log(`[WARN] [HSM] ${msg}`),
            error: (msg) => console.log(`[ERROR] [HSM] ${msg}`),
            process: (msg) => console.log(`[PROCESS] [HSM] ${msg}`)
        };
        
        this.config = {
            keySize: options.keySize || 256,
            algorithm: options.algorithm || 'aes-256-gcm',
            iterations: options.iterations || 100000,
            saltSize: options.saltSize || 32,
            ivSize: options.ivSize || 16,
            tagSize: options.tagSize || 16,
            secureStorePath: options.secureStorePath || './bigbase_data/hsm',
            tamperDetection: options.tamperDetection !== false,
            autoBackup: options.autoBackup !== false,
            maxKeyAge: options.maxKeyAge || 7776000000, // 90 days in ms
            ...options
        };

        this.keyStore = new Map();
        this.accessLog = [];
        this.tamperFlags = new Set();
        this.isInitialized = false;
        this.lastHealthCheck = null;
        
        this._initializeSecureStorage();
    }

    /**
     * Initialize HSM secure storage
     */
    async _initializeSecureStorage() {
        try {
            // Create secure storage directory
            if (!fs.existsSync(this.config.secureStorePath)) {
                fs.mkdirSync(this.config.secureStorePath, { 
                    recursive: true, 
                    mode: 0o700 // Restricted permissions
                });
            }

            // Initialize tamper detection
            if (this.config.tamperDetection) {
                await this._initializeTamperDetection();
            }

            // Load existing keys
            await this._loadKeyStore();
            
            this.isInitialized = true;
            this.emit('hsm:initialized');
            
            this.logger.success('BigBaseAlpha HSM initialized successfully (Offline Mode)');
        } catch (error) {
            this.emit('hsm:error', error);
            throw new Error(`HSM initialization failed: ${error.message}`);
        }
    }

    /**
     * Initialize tamper detection system
     */
    async _initializeTamperDetection() {
        const tamperFile = path.join(this.config.secureStorePath, '.tamper');
        const systemFingerprint = this._generateSystemFingerprint();
        
        if (fs.existsSync(tamperFile)) {
            const storedFingerprint = fs.readFileSync(tamperFile, 'utf8');
            if (storedFingerprint !== systemFingerprint) {
                this.tamperFlags.add('system_modified');
                this.emit('hsm:tamper_detected', 'System fingerprint mismatch');
            }
        } else {
            fs.writeFileSync(tamperFile, systemFingerprint, { mode: 0o600 });
        }
    }

    /**
     * Generate system fingerprint for tamper detection
     */
    _generateSystemFingerprint() {
        const fingerprint = {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            cpus: os.cpus().length,
            totalmem: os.totalmem(),
            process_pid: process.pid
        };
        
        return crypto.createHash('sha256')
            .update(JSON.stringify(fingerprint))
            .digest('hex');
    }

    /**
     * Generate a new cryptographic key
     */
    async generateKey(keyId, keyType = 'symmetric', keySize = null) {
        this._validateInitialized();
        this._logAccess('generateKey', keyId);

        const actualKeySize = keySize || this.config.keySize;
        let keyData;

        switch (keyType) {
            case 'symmetric':
                keyData = crypto.randomBytes(actualKeySize / 8);
                break;
            case 'asymmetric':
                const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                    modulusLength: actualKeySize * 8,
                    publicKeyEncoding: { type: 'spki', format: 'pem' },
                    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                });
                keyData = { publicKey, privateKey };
                break;
            case 'ecdsa':
                const ecKeyPair = crypto.generateKeyPairSync('ec', {
                    namedCurve: 'secp256k1',
                    publicKeyEncoding: { type: 'spki', format: 'pem' },
                    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                });
                keyData = { publicKey: ecKeyPair.publicKey, privateKey: ecKeyPair.privateKey };
                break;
            default:
                throw new Error(`Unsupported key type: ${keyType}`);
        }

        const keyEntry = {
            id: keyId,
            type: keyType,
            size: actualKeySize,
            data: keyData,
            created: Date.now(),
            lastUsed: Date.now(),
            usageCount: 0,
            metadata: {
                algorithm: this.config.algorithm,
                version: '1.5.0'
            }
        };

        // Encrypt and store key
        await this._storeKey(keyId, keyEntry);
        this.keyStore.set(keyId, keyEntry);

        this.emit('hsm:key_generated', { keyId, keyType, size: actualKeySize });
        return keyId;
    }

    /**
     * Encrypt data using HSM
     */
    async encrypt(data, keyId, algorithm = null) {
        this._validateInitialized();
        this._logAccess('encrypt', keyId);

        const keyEntry = this.keyStore.get(keyId);
        if (!keyEntry) {
            throw new Error(`Key not found: ${keyId}`);
        }

        const useAlgorithm = algorithm || this.config.algorithm;
        const iv = crypto.randomBytes(this.config.ivSize);
        let encrypted;

        if (keyEntry.type === 'symmetric') {
            const cipher = crypto.createCipher(useAlgorithm, keyEntry.data);
            cipher.setAutoPadding(true);
            
            encrypted = Buffer.concat([
                cipher.update(Buffer.isBuffer(data) ? data : Buffer.from(data)),
                cipher.final()
            ]);

            // For GCM mode, include auth tag
            if (useAlgorithm.includes('gcm')) {
                const tag = cipher.getAuthTag();
                encrypted = Buffer.concat([encrypted, tag]);
            }
        } else if (keyEntry.type === 'asymmetric') {
            encrypted = crypto.publicEncrypt(keyEntry.data.publicKey, 
                Buffer.isBuffer(data) ? data : Buffer.from(data));
        } else {
            throw new Error(`Encryption not supported for key type: ${keyEntry.type}`);
        }

        // Update key usage
        keyEntry.lastUsed = Date.now();
        keyEntry.usageCount++;

        this.emit('hsm:data_encrypted', { keyId, size: encrypted.length });
        
        return {
            encrypted: encrypted.toString('base64'),
            iv: iv.toString('base64'),
            algorithm: useAlgorithm,
            keyId: keyId
        };
    }

    /**
     * Decrypt data using HSM
     */
    async decrypt(encryptedData, keyId, algorithm = null) {
        this._validateInitialized();
        this._logAccess('decrypt', keyId);

        const keyEntry = this.keyStore.get(keyId);
        if (!keyEntry) {
            throw new Error(`Key not found: ${keyId}`);
        }

        const useAlgorithm = algorithm || this.config.algorithm;
        const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
        let decrypted;

        if (keyEntry.type === 'symmetric') {
            const decipher = crypto.createDecipher(useAlgorithm, keyEntry.data);
            
            let encryptedBuffer = encrypted;
            
            // For GCM mode, extract auth tag
            if (useAlgorithm.includes('gcm')) {
                const tag = encryptedBuffer.slice(-this.config.tagSize);
                encryptedBuffer = encryptedBuffer.slice(0, -this.config.tagSize);
                decipher.setAuthTag(tag);
            }
            
            decrypted = Buffer.concat([
                decipher.update(encryptedBuffer),
                decipher.final()
            ]);
        } else if (keyEntry.type === 'asymmetric') {
            decrypted = crypto.privateDecrypt(keyEntry.data.privateKey, encrypted);
        } else {
            throw new Error(`Decryption not supported for key type: ${keyEntry.type}`);
        }

        // Update key usage
        keyEntry.lastUsed = Date.now();
        keyEntry.usageCount++;

        this.emit('hsm:data_decrypted', { keyId, size: decrypted.length });
        
        return decrypted;
    }

    /**
     * Sign data using HSM
     */
    async sign(data, keyId, algorithm = 'sha256') {
        this._validateInitialized();
        this._logAccess('sign', keyId);

        const keyEntry = this.keyStore.get(keyId);
        if (!keyEntry) {
            throw new Error(`Key not found: ${keyId}`);
        }

        if (keyEntry.type !== 'asymmetric' && keyEntry.type !== 'ecdsa') {
            throw new Error(`Signing not supported for key type: ${keyEntry.type}`);
        }

        const signature = crypto.sign(algorithm, Buffer.from(data), keyEntry.data.privateKey);
        
        // Update key usage
        keyEntry.lastUsed = Date.now();
        keyEntry.usageCount++;

        this.emit('hsm:data_signed', { keyId, algorithm });
        
        return signature.toString('base64');
    }

    /**
     * Verify signature using HSM
     */
    async verify(data, signature, keyId, algorithm = 'sha256') {
        this._validateInitialized();
        this._logAccess('verify', keyId);

        const keyEntry = this.keyStore.get(keyId);
        if (!keyEntry) {
            throw new Error(`Key not found: ${keyId}`);
        }

        if (keyEntry.type !== 'asymmetric' && keyEntry.type !== 'ecdsa') {
            throw new Error(`Verification not supported for key type: ${keyEntry.type}`);
        }

        const isValid = crypto.verify(
            algorithm, 
            Buffer.from(data), 
            keyEntry.data.publicKey, 
            Buffer.from(signature, 'base64')
        );

        // Update key usage
        keyEntry.lastUsed = Date.now();
        keyEntry.usageCount++;

        this.emit('hsm:signature_verified', { keyId, algorithm, isValid });
        
        return isValid;
    }

    /**
     * Generate secure hash
     */
    async hash(data, algorithm = 'sha256', salt = null) {
        this._validateInitialized();
        this._logAccess('hash', 'system');

        const useSalt = salt || crypto.randomBytes(this.config.saltSize);
        const hash = crypto.createHash(algorithm);
        
        hash.update(useSalt);
        hash.update(Buffer.isBuffer(data) ? data : Buffer.from(data));
        
        const result = hash.digest('hex');
        
        this.emit('hsm:data_hashed', { algorithm, saltLength: useSalt.length });
        
        return {
            hash: result,
            salt: useSalt.toString('hex'),
            algorithm: algorithm
        };
    }

    /**
     * Perform HSM health check
     */
    async healthCheck() {
        const health = {
            initialized: this.isInitialized,
            keysCount: this.keyStore.size,
            tamperFlags: Array.from(this.tamperFlags),
            lastCheck: this.lastHealthCheck,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            systemFingerprint: this._generateSystemFingerprint(),
            status: 'healthy'
        };

        // Check for issues
        if (this.tamperFlags.size > 0) {
            health.status = 'compromised';
        } else if (!this.isInitialized) {
            health.status = 'uninitialized';
        }

        this.lastHealthCheck = Date.now();
        this.emit('hsm:health_check', health);
        
        return health;
    }

    /**
     * Store encrypted key to disk
     */
    async _storeKey(keyId, keyEntry) {
        const keyFile = path.join(this.config.secureStorePath, `${keyId}.hsmkey`);
        const masterKey = this._deriveMasterKey();
        
        // Encrypt key data
        const iv = crypto.randomBytes(this.config.ivSize);
        const cipher = crypto.createCipherGCM(this.config.algorithm, masterKey, iv);
        
        const encrypted = Buffer.concat([
            cipher.update(JSON.stringify(keyEntry)),
            cipher.final()
        ]);
        
        const tag = cipher.getAuthTag();
        
        const keyFileData = {
            iv: iv.toString('base64'),
            tag: tag.toString('base64'),
            encrypted: encrypted.toString('base64'),
            created: Date.now()
        };

        fs.writeFileSync(keyFile, JSON.stringify(keyFileData), { mode: 0o600 });
        
        if (this.config.autoBackup) {
            await this._backupKey(keyId, keyFileData);
        }
    }

    /**
     * Load key store from disk
     */
    async _loadKeyStore() {
        const files = fs.readdirSync(this.config.secureStorePath)
            .filter(file => file.endsWith('.hsmkey'));

        for (const file of files) {
            try {
                const keyId = path.basename(file, '.hsmkey');
                const keyEntry = await this._loadKey(keyId);
                this.keyStore.set(keyId, keyEntry);
            } catch (error) {
                console.warn(`Failed to load key ${file}: ${error.message}`);
            }
        }
    }

    /**
     * Load and decrypt key from disk
     */
    async _loadKey(keyId) {
        const keyFile = path.join(this.config.secureStorePath, `${keyId}.hsmkey`);
        
        if (!fs.existsSync(keyFile)) {
            throw new Error(`Key file not found: ${keyId}`);
        }

        const keyFileData = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
        const masterKey = this._deriveMasterKey();
        
        const iv = Buffer.from(keyFileData.iv, 'base64');
        const tag = Buffer.from(keyFileData.tag, 'base64');
        const encrypted = Buffer.from(keyFileData.encrypted, 'base64');
        
        const decipher = crypto.createDecipherGCM(this.config.algorithm, masterKey, iv);
        decipher.setAuthTag(tag);
        
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);
        
        return JSON.parse(decrypted.toString());
    }

    /**
     * Derive master key for key encryption
     */
    _deriveMasterKey() {
        const keyMaterial = [
            this._generateSystemFingerprint(),
            'BigBaseAlpha-HSM-v1.5.0',
            process.env.BIGBASE_HSM_SEED || 'default-seed-change-in-production'
        ].join('::');
        
        return crypto.pbkdf2Sync(keyMaterial, 'hsm-salt', this.config.iterations, 32, 'sha256');
    }

    /**
     * Backup key to secure location
     */
    async _backupKey(keyId, keyData) {
        const backupDir = path.join(this.config.secureStorePath, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { mode: 0o700 });
        }
        
        const backupFile = path.join(backupDir, `${keyId}_${Date.now()}.backup`);
        fs.writeFileSync(backupFile, JSON.stringify(keyData), { mode: 0o600 });
    }

    /**
     * Log access for audit trail
     */
    _logAccess(operation, keyId) {
        const logEntry = {
            timestamp: Date.now(),
            operation,
            keyId,
            ip: 'localhost', // Offline mode
            userAgent: 'BigBaseAlpha-HSM/1.5.0'
        };
        
        this.accessLog.push(logEntry);
        
        // Keep only last 1000 entries
        if (this.accessLog.length > 1000) {
            this.accessLog = this.accessLog.slice(-1000);
        }

        this.emit('hsm:access_logged', logEntry);
    }

    /**
     * Validate HSM is initialized
     */
    _validateInitialized() {
        if (!this.isInitialized) {
            throw new Error('HSM not initialized');
        }
        
        if (this.tamperFlags.size > 0) {
            throw new Error(`HSM compromised: ${Array.from(this.tamperFlags).join(', ')}`);
        }
    }

    /**
     * Get HSM status and statistics
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            keysCount: this.keyStore.size,
            tamperFlags: Array.from(this.tamperFlags),
            accessLogSize: this.accessLog.length,
            lastHealthCheck: this.lastHealthCheck,
            config: {
                algorithm: this.config.algorithm,
                keySize: this.config.keySize,
                tamperDetection: this.config.tamperDetection
            }
        };
    }

    /**
     * Export audit log
     */
    exportAuditLog() {
        return {
            exportTime: Date.now(),
            entries: [...this.accessLog],
            hsmStatus: this.getStatus()
        };
    }

    /**
     * Shutdown HSM securely
     */
    async shutdown() {
        this.emit('hsm:shutting_down');
        
        // Clear sensitive data from memory
        this.keyStore.clear();
        this.accessLog.length = 0;
        this.tamperFlags.clear();
        
        this.isInitialized = false;
        this.emit('hsm:shutdown_complete');
        
        this.logger.success('BigBaseAlpha HSM shutdown complete');
    }
}

export { OfflineHSM };
