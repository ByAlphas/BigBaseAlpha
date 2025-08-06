import crypto from 'crypto';
import fs from 'fs';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

/**
 * BigBaseAlpha Security & Privacy Suite
 * Advanced security features for data protection and privacy
 */
class SecurityPrivacySuite extends EventEmitter {
    constructor(database, options = {}) {
        super();
        
        this.database = database;
        
        // Logger setup (fallback to default if not provided)
        this.logger = options.logger || {
            info: (...args) => console.log('[INFO] [PRIVACY]', ...args),
            warn: (...args) => console.warn('[WARN] [PRIVACY]', ...args),
            error: (...args) => console.error('[ERROR] [PRIVACY]', ...args),
            success: (...args) => console.log('[SUCCESS] [PRIVACY]', ...args),
            debug: (...args) => console.log('[DEBUG] [PRIVACY]', ...args)
        };
        
        this.options = {
            encryption: 'AES-256-GCM',
            wipeIterations: 3,
            paranoidLogging: true,
            ...options
        };
        
        // State management
        this.selfDestructTimer = null;
        this.deadMansTimer = null;
        this.paranoiaMode = false;
        this.decoyMode = false;
        
        // Security stores
        this.oneTimeKeys = new Set();
        this.executionTriggers = new Map();
        this.paranoiaLogs = [];
        this.lastActivity = Date.now();
        
        // Decoy configuration
        this.decoyConfig = null;
        this.realDatabase = null;
        this.decoyDatabase = null;
    }

    /**
     * Self-Destruct Mode
     * Database destroys itself after timeout with secure PIN protection
     * SAFETY: Requires explicit confirmation and isolated environment
     */
    activateSelfDestruct(config = {}) {
        const {
            timeout = 60000,
            secure = true,
            wipeLevel = 'deep',
            pin = null,
            message = 'Self-destruct sequence activated',
            safetyCheck = false // REQUIRED for activation
        } = config;

        // SAFETY CHECK: Prevent accidental activation
        if (!safetyCheck) {
            throw new Error('Self-destruct requires explicit safety confirmation: { safetyCheck: true }');
        }

        // SAFETY CHECK: Warn if in production-like environment
        const dbPath = this.database.config?.path || './bigbase_data';
        if (dbPath.includes('production') || dbPath.includes('prod') || dbPath === './bigbase_data') {
            this.logger.warn('WARNING: Self-destruct activated on production-like path!');
            this.logger.info('Recommended: Use isolated test directory');
        }

        if (this.selfDestructTimer) {
            clearTimeout(this.selfDestructTimer);
        }

        console.log(`💣 ${message} - ${timeout / 1000}s countdown`);
        console.log(`[TARGET] Target: ${dbPath}`);
        console.log(`[CONFIG] Wipe Level: ${wipeLevel}`);
        this.emit('selfDestructActivated', { timeout, wipeLevel, dbPath });

        this.selfDestructTimer = setTimeout(async () => {
            try {
                console.log('⏰ Self-destruct timer expired - executing destruction');
                await this._executeSelfDestruct(wipeLevel);
            } catch (error) {
                console.error('Self-destruct failed:', error);
                this.emit('selfDestructFailed', error);
            }
        }, timeout);

        this.selfDestructConfig = {
            secure,
            pin: pin || this._generateSecurePin(),
            wipeLevel,
            startTime: Date.now(),
            timeout,
            dbPath
        };

        if (secure) {
            console.log(`[SECURITY] Secure PIN required to abort: ${this.selfDestructConfig.pin}`);
        }

        return {
            pin: this.selfDestructConfig.pin,
            timeRemaining: timeout,
            dbPath: dbPath,
            abort: (inputPin) => this.abortDestruct(inputPin)
        };
    }

    /**
     * Abort self-destruct with PIN
     */
    abortDestruct(pin) {
        if (!this.selfDestructTimer) {
            throw new Error('No active self-destruct sequence');
        }

        if (this.selfDestructConfig.secure && pin !== this.selfDestructConfig.pin) {
            console.log('[ERROR] Invalid PIN - Self-destruct continues');
            this.emit('abortFailed', { reason: 'invalid_pin' });
            return false;
        }

        clearTimeout(this.selfDestructTimer);
        this.selfDestructTimer = null;
        this.selfDestructConfig = null;

        this.logger.success('Self-destruct sequence aborted');
        this.emit('selfDestructAborted');
        return true;
    }

    /**
     * Execute self-destruct with specified wipe level
     */
    async _executeSelfDestruct(wipeLevel) {
        console.log('💥 EXECUTING SELF-DESTRUCT');
        this.emit('selfDestructExecuting', { wipeLevel });

        switch (wipeLevel) {
            case 'shallow':
                await this._shallowWipe();
                break;
            case 'deep':
                await this._deepWipe();
                break;
            case 'overwrite':
                await this._overwriteWipe();
                break;
            default:
                await this._deepWipe();
        }

        console.log('🔥 Database destroyed');
        this.emit('selfDestructCompleted');
        
        // Close database
        if (this.database.close) {
            await this.database.close();
        }
    }

    /**
     * Deep wipe: Overwrite data 3 times with random data
     */
    async _deepWipe() {
        const collections = this.database.collections || new Map();
        
        for (let iteration = 0; iteration < this.options.wipeIterations; iteration++) {
            console.log(`🧹 Deep wipe iteration ${iteration + 1}/${this.options.wipeIterations}`);
            
            for (const [collectionName] of collections) {
                const randomData = this._generateRandomData(1024);
                
                try {
                    // Overwrite collection data
                    const items = await this.database.find(collectionName);
                    for (const item of items) {
                        await this.database.update(collectionName, item._id, {
                            ...Object.fromEntries(
                                Object.keys(item).map(key => [key, randomData])
                            )
                        });
                    }
                } catch (error) {
                    // Continue wiping even if some operations fail
                }
            }
            
            // Small delay between iterations
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Final deletion
        for (const [collectionName] of collections) {
            try {
                await this.database.dropCollection(collectionName);
            } catch (error) {
                // Continue cleanup
            }
        }
    }

    /**
     * Shallow wipe: Simple deletion
     */
    async _shallowWipe() {
        const collections = this.database.collections || new Map();
        
        for (const [collectionName] of collections) {
            try {
                await this.database.dropCollection(collectionName);
            } catch (error) {
                // Continue cleanup
            }
        }
    }

    /**
     * Overwrite wipe: File-level overwriting
     */
    async _overwriteWipe() {
        try {
            const dbPath = this.database.config?.path || './bigbase_data';
            
            if (fs.existsSync(dbPath)) {
                // Overwrite files with random data
                const files = fs.readdirSync(dbPath, { recursive: true });
                
                for (const file of files) {
                    const filePath = `${dbPath}/${file}`;
                    if (fs.statSync(filePath).isFile()) {
                        const randomData = this._generateRandomData(fs.statSync(filePath).size);
                        fs.writeFileSync(filePath, randomData);
                    }
                }
                
                // Remove directory
                fs.rmSync(dbPath, { recursive: true, force: true });
            }
        } catch (error) {
            console.error('Overwrite wipe failed:', error);
        }
    }

    /**
     * Dead Man's Switch
     * Auto-destruct after period of inactivity
     */
    enableDeadMansSwitch(config = {}) {
        const {
            delay = 24 * 60 * 60 * 1000, // 24 hours
            triggerMessage = 'No activity detected, erasing everything...',
            callback = () => console.log('Goodbye...'),
            wipeLevel = 'deep'
        } = config;

        this.deadMansConfig = { delay, triggerMessage, callback, wipeLevel };
        this._resetDeadMansTimer();

        console.log(`🧨 Dead Man's Switch enabled - ${delay / 1000}s inactivity limit`);
        this.emit('deadMansSwitchEnabled', { delay });

        return {
            disable: () => this.disableDeadMansSwitch(),
            reset: () => this._resetDeadMansTimer()
        };
    }

    /**
     * Reset Dead Man's Switch timer
     */
    _resetDeadMansTimer() {
        if (!this.deadMansConfig) return;

        if (this.deadMansTimer) {
            clearTimeout(this.deadMansTimer);
        }

        this.lastActivity = Date.now();
        this.deadMansTimer = setTimeout(async () => {
            console.log(`💀 ${this.deadMansConfig.triggerMessage}`);
            this.deadMansConfig.callback();
            await this._executeSelfDestruct(this.deadMansConfig.wipeLevel);
        }, this.deadMansConfig.delay);
    }

    /**
     * Disable Dead Man's Switch
     */
    disableDeadMansSwitch() {
        if (this.deadMansTimer) {
            clearTimeout(this.deadMansTimer);
            this.deadMansTimer = null;
        }
        this.deadMansConfig = null;
        console.log('[SHIELD] Dead Man\'s Switch disabled');
    }

    /**
     * Paranoia Mode
     * Enhanced logging and tampering protection
     */
    enableParanoia(config = {}) {
        const {
            encryption = 'AES-256-GCM',
            tamperCheck = true,
            logLevel = 'all' // all, critical, minimal
        } = config;

        this.paranoiaMode = true;
        this.paranoiaConfig = { encryption, tamperCheck, logLevel };

        console.log('[MONITOR] Paranoia Mode enabled - All operations will be monitored');
        this.emit('paranoiaModeEnabled');

        // Hook into database operations
        this._hookDatabaseOperations();

        return {
            disable: () => this.disableParanoia(),
            getLogs: () => this.getParanoiaLogs(),
            clearLogs: () => this.clearParanoiaLogs()
        };
    }

    /**
     * Log paranoid activity
     */
    _logParanoidActivity(operation, data) {
        if (!this.paranoiaMode) return;

        const entry = {
            timestamp: Date.now(),
            operation,
            hash: this._hashData(data),
            checksum: this._generateChecksum(operation + JSON.stringify(data))
        };

        // Encrypt log entry
        if (this.paranoiaConfig.encryption) {
            entry.encrypted = this._encryptData(JSON.stringify(entry));
        }

        this.paranoiaLogs.push(entry);

        // Limit log size
        if (this.paranoiaLogs.length > 10000) {
            this.paranoiaLogs = this.paranoiaLogs.slice(-5000);
        }
    }

    /**
     * Hook into database operations for paranoid logging
     */
    _hookDatabaseOperations() {
        const originalMethods = ['get', 'set', 'delete', 'find', 'insert', 'update'];
        
        originalMethods.forEach(method => {
            if (this.database[method]) {
                const original = this.database[method].bind(this.database);
                this.database[method] = (...args) => {
                    this._logParanoidActivity(method, args);
                    this._resetDeadMansTimer(); // Reset dead man's switch
                    return original(...args);
                };
            }
        });
    }

    /**
     * One-Time Access Keys
     * Data that self-destructs after single read
     */
    setOneTime(key, value, options = {}) {
        const oneTimeKey = `once:${key}`;
        this.oneTimeKeys.add(oneTimeKey);
        
        return this.database.set(oneTimeKey, value, {
            ...options,
            _oneTime: true,
            _accessCount: 0
        });
    }

    /**
     * Get one-time data (destroys after read)
     */
    async getOneTime(key) {
        const oneTimeKey = `once:${key}`;
        
        if (!this.oneTimeKeys.has(oneTimeKey)) {
            throw new Error('One-time key not found or already accessed');
        }

        try {
            const data = await this.database.get(oneTimeKey);
            
            // Remove from database and tracking
            await this.database.delete(oneTimeKey);
            this.oneTimeKeys.delete(oneTimeKey);
            
            console.log(`[SECURITY] One-time key '${key}' accessed and destroyed`);
            this.emit('oneTimeAccessed', { key });
            
            return data;
        } catch (error) {
            this.oneTimeKeys.delete(oneTimeKey);
            throw error;
        }
    }

    /**
     * Wipe Command
     * Pattern-based secure data deletion
     * SAFETY: Requires explicit confirmation
     */
    async wipe(pattern, options = {}) {
        const {
            wipeLevel = 'deep',
            confirm = false,
            safetyCheck = false // REQUIRED for activation
        } = options;

        // SAFETY CHECKS
        if (!confirm) {
            throw new Error('Wipe operation requires explicit confirmation: { confirm: true }');
        }

        if (!safetyCheck) {
            throw new Error('Wipe operation requires safety confirmation: { safetyCheck: true }');
        }

        // SAFETY CHECK: Warn about dangerous patterns
        if (pattern === '*' || pattern === '**' || pattern === '*.*') {
            this.logger.warn('WARNING: You are about to wipe ALL data!');
            this.logger.info('Pattern:', pattern);
            this.logger.info('Wipe Level:', wipeLevel);
        }

        this.logger.info(`Wiping data matching pattern: ${pattern}`);
        this.logger.info(`Target database: ${this.database.config?.path || 'default'}`);
        this.emit('wipeStarted', { pattern, wipeLevel });

        const collections = this.database.collections || new Map();
        let wipedCount = 0;

        for (const [collectionName] of collections) {
            try {
                const items = await this.database.find(collectionName);
                
                for (const item of items) {
                    // Check if item matches pattern
                    if (this._matchesPattern(item, pattern)) {
                        if (wipeLevel === 'deep') {
                            // Overwrite with random data first
                            const randomData = this._generateRandomData(256);
                            await this.database.update(collectionName, item._id, {
                                ...Object.fromEntries(
                                    Object.keys(item).map(key => [key, randomData])
                                )
                            });
                        }
                        
                        // Delete the item
                        await this.database.delete(collectionName, item._id);
                        wipedCount++;
                    }
                }
            } catch (error) {
                console.error(`Error wiping collection ${collectionName}:`, error);
            }
        }

        console.log(`[SUCCESS] Wiped ${wipedCount} items matching pattern: ${pattern}`);
        this.emit('wipeCompleted', { pattern, wipedCount });
        
        return wipedCount;
    }

    /**
     * Enable Decoy/Fake Mode
     * Returns fake data when wrong password is used
     */
    enableDecoy(config = {}) {
        const {
            password,
            realDb = 'realData',
            decoyDb = 'decoyData',
            decoyData = this._generateDecoyData()
        } = config;

        if (!password) {
            throw new Error('Decoy mode requires a password');
        }

        this.decoyMode = true;
        this.decoyConfig = {
            password: this._hashData(password),
            realDb,
            decoyDb,
            decoyData,
            authenticated: false
        };

        console.log('🎭 Decoy mode enabled - Database will show fake data until authenticated');
        this.emit('decoyModeEnabled');

        return {
            authenticate: (pwd) => this.authenticateDecoy(pwd),
            disable: () => this.disableDecoy()
        };
    }

    /**
     * Authenticate for decoy mode
     */
    authenticateDecoy(password) {
        if (!this.decoyMode) {
            return true; // No decoy mode active
        }

        const hashedPassword = this._hashData(password);
        
        if (hashedPassword === this.decoyConfig.password) {
            this.decoyConfig.authenticated = true;
            this.logger.success('Decoy authentication successful - Real database access granted');
            this.emit('decoyAuthenticated');
            return true;
        } else {
            this.logger.error('Decoy authentication failed - Showing fake data');
            this.emit('decoyAuthenticationFailed');
            return false;
        }
    }

    /**
     * Check if request should return decoy data
     */
    shouldUseDecoy() {
        return this.decoyMode && !this.decoyConfig.authenticated;
    }

    /**
     * Execution Triggers
     * Data that executes code when accessed
     */
    setTrigger(key, value, trigger = {}) {
        const {
            onRead = null,
            onWrite = null,
            onDelete = null,
            once = false
        } = trigger;

        const triggerKey = `trigger:${key}`;
        this.executionTriggers.set(triggerKey, {
            onRead,
            onWrite,
            onDelete,
            once,
            executed: false
        });

        return this.database.set(triggerKey, value, { _trigger: true });
    }

    /**
     * Execute trigger if exists
     */
    async executeTrigger(key, operation = 'read') {
        const triggerKey = `trigger:${key}`;
        const trigger = this.executionTriggers.get(triggerKey);

        if (!trigger || trigger.executed && trigger.once) {
            return null;
        }

        const handler = trigger[`on${operation.charAt(0).toUpperCase() + operation.slice(1)}`];
        
        if (handler && typeof handler === 'function') {
            console.log(`🧪 Executing trigger for key: ${key} (${operation})`);
            
            try {
                await handler();
                trigger.executed = true;
                this.emit('triggerExecuted', { key, operation });
            } catch (error) {
                console.error(`Trigger execution failed for ${key}:`, error);
                this.emit('triggerFailed', { key, operation, error });
            }
        }

        return trigger;
    }

    /**
     * Utility: Generate secure PIN
     */
    _generateSecurePin() {
        return Math.random().toString(36).substring(2, 15);
    }

    /**
     * Utility: Generate random data
     */
    _generateRandomData(size) {
        return crypto.randomBytes(size).toString('hex');
    }

    /**
     * Utility: Hash data
     */
    _hashData(data) {
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }

    /**
     * Utility: Generate checksum
     */
    _generateChecksum(data) {
        return crypto.createHash('md5').update(data).digest('hex');
    }

    /**
     * Utility: Encrypt data
     */
    _encryptData(data) {
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-gcm', key);
        
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            encrypted,
            key: key.toString('hex'),
            iv: iv.toString('hex')
        };
    }

    /**
     * Utility: Check if data matches pattern
     */
    _matchesPattern(item, pattern) {
        const patternRegex = new RegExp(
            pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
            'i'
        );
        
        const itemString = JSON.stringify(item);
        return patternRegex.test(itemString);
    }

    /**
     * Utility: Generate decoy data
     */
    _generateDecoyData() {
        return {
            users: [
                { id: 1, name: 'Fake User 1', email: 'fake1@decoy.com' },
                { id: 2, name: 'Fake User 2', email: 'fake2@decoy.com' }
            ],
            products: [
                { id: 1, name: 'Decoy Product', price: 9.99 }
            ],
            message: 'This is decoy data. Authenticate to see real data.'
        };
    }

    /**
     * Get paranoia logs
     */
    getParanoiaLogs() {
        return this.paranoiaLogs;
    }

    /**
     * Clear paranoia logs
     */
    clearParanoiaLogs() {
        this.paranoiaLogs = [];
        console.log('🧹 Paranoia logs cleared');
    }

    /**
     * Disable paranoia mode
     */
    disableParanoia() {
        this.paranoiaMode = false;
        this.paranoiaConfig = null;
        console.log('[MONITOR] Paranoia mode disabled');
    }

    /**
     * Disable decoy mode
     */
    disableDecoy() {
        this.decoyMode = false;
        this.decoyConfig = null;
        console.log('🎭 Decoy mode disabled');
    }

    /**
     * Get security status
     */
    getSecurityStatus() {
        return {
            selfDestruct: {
                active: !!this.selfDestructTimer,
                timeRemaining: this.selfDestructTimer ? 
                    this.selfDestructConfig?.startTime + this.selfDestructConfig?.timeout - Date.now() : 0
            },
            deadMansSwitch: {
                enabled: !!this.deadMansConfig,
                lastActivity: this.lastActivity,
                timeUntilTrigger: this.deadMansConfig ? 
                    this.lastActivity + this.deadMansConfig.delay - Date.now() : 0
            },
            paranoia: {
                enabled: this.paranoiaMode,
                logCount: this.paranoiaLogs.length
            },
            decoy: {
                enabled: this.decoyMode,
                authenticated: this.decoyConfig?.authenticated || false
            },
            oneTimeKeys: this.oneTimeKeys.size,
            executionTriggers: this.executionTriggers.size
        };
    }

    /**
     * Emergency shutdown
     * SAFETY: Requires multiple confirmations and safety checks
     */
    async emergencyShutdown(options = {}) {
        const {
            confirm = false,
            safetyCheck = false,
            emergencyCode = null
        } = options;

        // MULTIPLE SAFETY CHECKS
        if (!confirm) {
            throw new Error('Emergency shutdown requires explicit confirmation: { confirm: true }');
        }

        if (!safetyCheck) {
            throw new Error('Emergency shutdown requires safety confirmation: { safetyCheck: true }');
        }

        if (!emergencyCode || emergencyCode !== 'EMERGENCY_DESTROY_ALL_DATA') {
            throw new Error('Emergency shutdown requires emergency code: { emergencyCode: "EMERGENCY_DESTROY_ALL_DATA" }');
        }

        this.logger.error('EMERGENCY SHUTDOWN INITIATED');
        this.logger.warn('THIS WILL DESTROY ALL DATA PERMANENTLY');
        this.logger.info(`Target: ${this.database.config?.path || 'default'}`);
        this.logger.warn('Starting in 3 seconds... Press Ctrl+C to abort');
        
        // Give user time to abort
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Clear all timers
        if (this.selfDestructTimer) clearTimeout(this.selfDestructTimer);
        if (this.deadMansTimer) clearTimeout(this.deadMansTimer);
        
        // Execute deep wipe
        await this._executeSelfDestruct('deep');
        
        this.emit('emergencyShutdown');
    }
}

export default SecurityPrivacySuite;
