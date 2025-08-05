import { EventEmitter } from 'events';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * BigBaseAlpha JWT Authentication & User Management System
 * Enterprise-grade authentication with role-based access control
 * 
 * @copyright 2025 ByAlphas. All rights reserved.
 */
export class AuthenticationManager extends EventEmitter {
    constructor(database, options = {}) {
        super();
        
        this.database = database;
        this.options = {
            jwtSecret: options.jwtSecret || this._generateSecret(),
            tokenExpiry: options.tokenExpiry || '24h',
            refreshTokenExpiry: options.refreshTokenExpiry || '7d',
            saltRounds: options.saltRounds || 12,
            maxLoginAttempts: options.maxLoginAttempts || 5,
            lockoutTime: options.lockoutTime || 15 * 60 * 1000, // 15 minutes
            requireEmailVerification: options.requireEmailVerification || false,
            ...options
        };
        
        // Session storage
        this.activeSessions = new Map();
        this.refreshTokens = new Map();
        this.loginAttempts = new Map();
        
        // Built-in roles
        this.defaultRoles = {
            admin: {
                name: 'admin',
                permissions: ['*'], // All permissions
                description: 'Full system access'
            },
            user: {
                name: 'user',
                permissions: ['read', 'write:own'],
                description: 'Standard user access'
            },
            readonly: {
                name: 'readonly',
                permissions: ['read'],
                description: 'Read-only access'
            },
            api: {
                name: 'api',
                permissions: ['api:read', 'api:write'],
                description: 'API access only'
            }
        };
        
        this._initializeCollections();
    }
    
    /**
     * Initialize authentication collections
     */
    async _initializeCollections() {
        try {
            // Create users collection
            this.usersCollection = this.database.collection('_auth_users');
            
            // Create indexes with error handling
            try {
                await this.usersCollection.createIndex({ username: 1 }, { unique: true });
            } catch (error) {
                if (!error.message.includes('already exists')) throw error;
            }
            
            try {
                await this.usersCollection.createIndex({ email: 1 }, { unique: true });
            } catch (error) {
                if (!error.message.includes('already exists')) throw error;
            }
            
            // Create roles collection
            this.rolesCollection = this.database.collection('_auth_roles');
            try {
                await this.rolesCollection.createIndex({ name: 1 }, { unique: true });
            } catch (error) {
                if (!error.message.includes('already exists')) throw error;
            }
            
            // Create API keys collection
            this.apiKeysCollection = this.database.collection('_auth_api_keys');
            try {
                await this.apiKeysCollection.createIndex({ key: 1 }, { unique: true });
            } catch (error) {
                if (!error.message.includes('already exists')) throw error;
            }
            
            // Create audit log collection
            this.auditCollection = this.database.collection('_auth_audit');
            try {
                await this.auditCollection.createIndex({ timestamp: -1 });
            } catch (error) {
                if (!error.message.includes('already exists')) throw error;
            }
            
            try {
                await this.auditCollection.createIndex({ userId: 1 });
            } catch (error) {
                if (!error.message.includes('already exists')) throw error;
            }
            
            // Initialize default roles
            await this._initializeDefaultRoles();
            
            console.log('🔒 Authentication system initialized');
            this.emit('authInitialized');
            
        } catch (error) {
            console.error('Failed to initialize authentication:', error);
            throw error;
        }
    }
    
    /**
     * Initialize default roles
     */
    async _initializeDefaultRoles() {
        for (const [roleKey, roleData] of Object.entries(this.defaultRoles)) {
            const existingRole = await this.rolesCollection.findOne({ name: roleData.name });
            if (!existingRole) {
                await this.rolesCollection.insertOne({
                    ...roleData,
                    createdAt: new Date(),
                    system: true
                });
            }
        }
    }
    
    /**
     * Create a new user
     */
    async createUser(userData) {
        const {
            username,
            password,
            email,
            role = 'user',
            profile = {},
            permissions = []
        } = userData;
        
        // Validation
        if (!username || !password) {
            throw new Error('Username and password are required');
        }
        
        if (username.length < 3) {
            throw new Error('Username must be at least 3 characters');
        }
        
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        
        // Check if user exists
        const existingUser = await this.usersCollection.findOne({
            $or: [{ username }, { email }]
        });
        
        if (existingUser) {
            throw new Error('User with this username or email already exists');
        }
        
        // Validate role
        const roleData = await this.rolesCollection.findOne({ name: role });
        if (!roleData) {
            throw new Error(`Role '${role}' does not exist`);
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, this.options.saltRounds);
        
        // Create user
        const user = {
            _id: this._generateUserId(),
            username,
            email,
            password: hashedPassword,
            role,
            permissions: [...roleData.permissions, ...permissions],
            profile: {
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                avatar: profile.avatar || '',
                ...profile
            },
            status: 'active',
            emailVerified: !this.options.requireEmailVerification,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLogin: null,
            loginCount: 0,
            twoFactorEnabled: false,
            metadata: {
                ipAddresses: [],
                userAgents: [],
                devices: []
            }
        };
        
        const result = await this.usersCollection.insertOne(user);
        
        // Log creation
        await this._logAuditEvent('user_created', null, {
            targetUserId: user._id,
            username: user.username,
            role: user.role
        });
        
        // Remove password from response
        const { password: _, ...userResponse } = user;
        
        this.emit('userCreated', { user: userResponse });
        console.log(`👤 User created: ${username} (${role})`);
        
        return { success: true, user: userResponse };
    }
    
    /**
     * Authenticate user and generate tokens
     */
    async login(credentials, metadata = {}) {
        const { username, password, rememberMe = false } = credentials;
        const { ipAddress, userAgent, deviceInfo } = metadata;
        
        // Check login attempts
        const attemptKey = `${username}:${ipAddress || 'unknown'}`;
        const attempts = this.loginAttempts.get(attemptKey) || { count: 0, lockedUntil: null };
        
        if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
            const remainingTime = Math.ceil((attempts.lockedUntil - Date.now()) / 1000 / 60);
            throw new Error(`Account locked. Try again in ${remainingTime} minutes`);
        }
        
        // Find user
        const user = await this.usersCollection.findOne({
            $or: [{ username }, { email: username }]
        });
        
        if (!user) {
            await this._incrementLoginAttempts(attemptKey);
            throw new Error('Invalid credentials');
        }
        
        if (user.status !== 'active') {
            throw new Error('Account is disabled');
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            await this._incrementLoginAttempts(attemptKey);
            await this._logAuditEvent('login_failed', user._id, {
                reason: 'invalid_password',
                ipAddress,
                userAgent
            });
            throw new Error('Invalid credentials');
        }
        
        // Clear login attempts on successful login
        this.loginAttempts.delete(attemptKey);
        
        // Generate tokens
        const sessionId = this._generateSessionId();
        const accessToken = this._generateJWT(user, sessionId, false);
        const refreshToken = rememberMe ? this._generateJWT(user, sessionId, true) : null;
        
        // Create session
        const session = {
            sessionId,
            userId: user._id,
            username: user.username,
            role: user.role,
            permissions: user.permissions,
            accessToken,
            refreshToken,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this._parseTimeToMs(this.options.tokenExpiry)),
            ipAddress,
            userAgent,
            deviceInfo,
            active: true
        };
        
        this.activeSessions.set(sessionId, session);
        if (refreshToken) {
            this.refreshTokens.set(refreshToken, sessionId);
        }
        
        // Update user login info
        await this.usersCollection.updateOne(
            { _id: user._id },
            {
                $set: {
                    lastLogin: new Date(),
                    updatedAt: new Date()
                },
                $inc: { loginCount: 1 },
                $push: {
                    'metadata.ipAddresses': { $each: [ipAddress], $slice: -10 },
                    'metadata.userAgents': { $each: [userAgent], $slice: -5 }
                }
            }
        );
        
        // Log successful login
        await this._logAuditEvent('login_success', user._id, {
            sessionId,
            ipAddress,
            userAgent,
            deviceInfo
        });
        
        // Remove sensitive data
        const { password: _, ...userResponse } = user;
        
        this.emit('userLoggedIn', { user: userResponse, session });
        console.log(`🔑 User logged in: ${user.username}`);
        
        return {
            success: true,
            user: userResponse,
            tokens: {
                accessToken,
                refreshToken,
                expiresAt: session.expiresAt
            },
            session: {
                sessionId,
                createdAt: session.createdAt,
                expiresAt: session.expiresAt
            }
        };
    }
    
    /**
     * Logout user and invalidate session
     */
    async logout(token) {
        try {
            const payload = this._verifyJWT(token);
            const session = this.activeSessions.get(payload.sessionId);
            
            if (session) {
                // Remove session
                this.activeSessions.delete(payload.sessionId);
                
                // Remove refresh token if exists
                if (session.refreshToken) {
                    this.refreshTokens.delete(session.refreshToken);
                }
                
                // Log logout
                await this._logAuditEvent('logout', payload.userId, {
                    sessionId: payload.sessionId
                });
                
                this.emit('userLoggedOut', { userId: payload.userId, sessionId: payload.sessionId });
                console.log(`🚪 User logged out: ${session.username}`);
                
                return { success: true, message: 'Logged out successfully' };
            }
            
            return { success: false, message: 'Session not found' };
            
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
    
    /**
     * Refresh access token
     */
    async refreshToken(refreshToken) {
        try {
            const sessionId = this.refreshTokens.get(refreshToken);
            if (!sessionId) {
                throw new Error('Invalid refresh token');
            }
            
            const session = this.activeSessions.get(sessionId);
            if (!session || !session.active) {
                throw new Error('Session expired or invalid');
            }
            
            // Get current user data
            const user = await this.usersCollection.findOne({ _id: session.userId });
            if (!user || user.status !== 'active') {
                throw new Error('User account is disabled');
            }
            
            // Generate new access token
            const newAccessToken = this._generateJWT(user, sessionId, false);
            
            // Update session
            session.accessToken = newAccessToken;
            session.expiresAt = new Date(Date.now() + this._parseTimeToMs(this.options.tokenExpiry));
            
            this.activeSessions.set(sessionId, session);
            
            return {
                success: true,
                tokens: {
                    accessToken: newAccessToken,
                    refreshToken,
                    expiresAt: session.expiresAt
                }
            };
            
        } catch (error) {
            throw new Error('Token refresh failed: ' + error.message);
        }
    }
    
    /**
     * Verify JWT token and return user info
     */
    async verifyToken(token) {
        try {
            const payload = this._verifyJWT(token);
            const session = this.activeSessions.get(payload.sessionId);
            
            if (!session || !session.active) {
                throw new Error('Session expired or invalid');
            }
            
            if (session.expiresAt < new Date()) {
                this.activeSessions.delete(payload.sessionId);
                throw new Error('Token expired');
            }
            
            // Get current user data
            const user = await this.usersCollection.findOne({ _id: payload.userId });
            if (!user || user.status !== 'active') {
                throw new Error('User account is disabled');
            }
            
            return {
                valid: true,
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    permissions: user.permissions,
                    profile: user.profile
                },
                session: {
                    sessionId: session.sessionId,
                    createdAt: session.createdAt,
                    expiresAt: session.expiresAt
                }
            };
            
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }
    
    /**
     * Generate API key for user
     */
    async generateAPIKey(userId, options = {}) {
        const {
            name = 'Default API Key',
            permissions = [],
            expiresIn = null,
            rateLimitRpm = 1000
        } = options;
        
        const user = await this.usersCollection.findOne({ _id: userId });
        if (!user) {
            throw new Error('User not found');
        }
        
        const apiKey = {
            _id: this._generateAPIKeyId(),
            key: this._generateAPIKeyToken(),
            userId,
            name,
            permissions: permissions.length > 0 ? permissions : user.permissions,
            rateLimitRpm,
            createdAt: new Date(),
            expiresAt: expiresIn ? new Date(Date.now() + this._parseTimeToMs(expiresIn)) : null,
            lastUsed: null,
            usageCount: 0,
            active: true
        };
        
        await this.apiKeysCollection.insertOne(apiKey);
        
        await this._logAuditEvent('api_key_created', userId, {
            apiKeyId: apiKey._id,
            name
        });
        
        console.log(`🔑 API key generated: ${name} for ${user.username}`);
        
        return {
            success: true,
            apiKey: {
                id: apiKey._id,
                key: apiKey.key,
                name: apiKey.name,
                permissions: apiKey.permissions,
                createdAt: apiKey.createdAt,
                expiresAt: apiKey.expiresAt
            }
        };
    }
    
    /**
     * Verify API key
     */
    async verifyAPIKey(keyString) {
        const apiKey = await this.apiKeysCollection.findOne({ key: keyString, active: true });
        
        if (!apiKey) {
            return { valid: false, error: 'Invalid API key' };
        }
        
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            return { valid: false, error: 'API key expired' };
        }
        
        // Update usage
        await this.apiKeysCollection.updateOne(
            { _id: apiKey._id },
            {
                $set: { lastUsed: new Date() },
                $inc: { usageCount: 1 }
            }
        );
        
        const user = await this.usersCollection.findOne({ _id: apiKey.userId });
        
        return {
            valid: true,
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
                permissions: apiKey.permissions
            },
            apiKey: {
                id: apiKey._id,
                name: apiKey.name,
                permissions: apiKey.permissions
            }
        };
    }
    
    /**
     * Check if user has permission
     */
    hasPermission(userPermissions, requiredPermission) {
        if (userPermissions.includes('*')) return true;
        if (userPermissions.includes(requiredPermission)) return true;
        
        // Check wildcard permissions
        for (const permission of userPermissions) {
            if (permission.endsWith('*')) {
                const prefix = permission.slice(0, -1);
                if (requiredPermission.startsWith(prefix)) return true;
            }
        }
        
        return false;
    }
    
    /**
     * Middleware for Express.js authentication
     */
    middleware() {
        return async (req, res, next) => {
            try {
                const authHeader = req.headers.authorization;
                const apiKey = req.headers['x-api-key'];
                
                let authResult = null;
                
                if (apiKey) {
                    // API Key authentication
                    authResult = await this.verifyAPIKey(apiKey);
                    if (authResult.valid) {
                        req.user = authResult.user;
                        req.authType = 'api_key';
                        req.apiKey = authResult.apiKey;
                    }
                } else if (authHeader && authHeader.startsWith('Bearer ')) {
                    // JWT authentication
                    const token = authHeader.substring(7);
                    authResult = await this.verifyToken(token);
                    if (authResult.valid) {
                        req.user = authResult.user;
                        req.authType = 'jwt';
                        req.session = authResult.session;
                    }
                }
                
                if (!authResult || !authResult.valid) {
                    return res.status(401).json({
                        error: 'Authentication required',
                        message: authResult?.error || 'No valid authentication provided'
                    });
                }
                
                next();
                
            } catch (error) {
                res.status(401).json({
                    error: 'Authentication failed',
                    message: error.message
                });
            }
        };
    }
    
    /**
     * Permission check middleware
     */
    requirePermission(permission) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            
            if (!this.hasPermission(req.user.permissions, permission)) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    required: permission,
                    userPermissions: req.user.permissions
                });
            }
            
            next();
        };
    }
    
    // ===== PRIVATE METHODS =====
    
    _generateSecret() {
        return crypto.randomBytes(64).toString('hex');
    }
    
    _generateUserId() {
        return 'user_' + crypto.randomBytes(16).toString('hex');
    }
    
    _generateSessionId() {
        return 'sess_' + crypto.randomBytes(24).toString('hex');
    }
    
    _generateAPIKeyId() {
        return 'key_' + crypto.randomBytes(16).toString('hex');
    }
    
    _generateAPIKeyToken() {
        return 'bb_' + crypto.randomBytes(32).toString('hex');
    }
    
    _generateJWT(user, sessionId, isRefresh = false) {
        const payload = {
            userId: user._id,
            username: user.username,
            role: user.role,
            permissions: user.permissions,
            sessionId,
            type: isRefresh ? 'refresh' : 'access',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor((Date.now() + this._parseTimeToMs(
                isRefresh ? this.options.refreshTokenExpiry : this.options.tokenExpiry
            )) / 1000)
        };
        
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signature = crypto
            .createHmac('sha256', this.options.jwtSecret)
            .update(`${header}.${payloadB64}`)
            .digest('base64url');
            
        return `${header}.${payloadB64}.${signature}`;
    }
    
    _verifyJWT(token) {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid token format');
        }
        
        const [header, payload, signature] = parts;
        const expectedSignature = crypto
            .createHmac('sha256', this.options.jwtSecret)
            .update(`${header}.${payload}`)
            .digest('base64url');
            
        if (signature !== expectedSignature) {
            throw new Error('Invalid token signature');
        }
        
        const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url'));
        
        if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
            throw new Error('Token expired');
        }
        
        return decodedPayload;
    }
    
    _parseTimeToMs(timeString) {
        const units = {
            's': 1000,
            'm': 60 * 1000,
            'h': 60 * 60 * 1000,
            'd': 24 * 60 * 60 * 1000
        };
        
        const match = timeString.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new Error('Invalid time format');
        }
        
        const [, amount, unit] = match;
        return parseInt(amount) * units[unit];
    }
    
    async _incrementLoginAttempts(attemptKey) {
        const attempts = this.loginAttempts.get(attemptKey) || { count: 0, lockedUntil: null };
        attempts.count++;
        
        if (attempts.count >= this.options.maxLoginAttempts) {
            attempts.lockedUntil = Date.now() + this.options.lockoutTime;
        }
        
        this.loginAttempts.set(attemptKey, attempts);
    }
    
    async _logAuditEvent(action, userId, details = {}) {
        try {
            await this.auditCollection.insertOne({
                action,
                userId,
                details,
                timestamp: new Date(),
                ipAddress: details.ipAddress || null,
                userAgent: details.userAgent || null
            });
        } catch (error) {
            console.error('Failed to log audit event:', error);
        }
    }
    
    /**
     * Get user management statistics
     */
    async getAuthStats() {
        const [
            totalUsers,
            activeUsers,
            totalSessions,
            totalApiKeys,
            recentLogins
        ] = await Promise.all([
            this.usersCollection.countDocuments(),
            this.usersCollection.countDocuments({ status: 'active' }),
            this.activeSessions.size,
            this.apiKeysCollection.countDocuments({ active: true }),
            this.auditCollection.countDocuments({
                action: 'login_success',
                timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            })
        ]);
        
        return {
            users: {
                total: totalUsers,
                active: activeUsers,
                inactive: totalUsers - activeUsers
            },
            sessions: {
                active: totalSessions,
                refreshTokens: this.refreshTokens.size
            },
            apiKeys: {
                total: totalApiKeys
            },
            activity: {
                recentLogins
            }
        };
    }
    
    /**
     * Clean up expired sessions and tokens
     */
    async cleanup() {
        const now = new Date();
        let cleaned = 0;
        
        // Clean expired sessions
        for (const [sessionId, session] of this.activeSessions) {
            if (session.expiresAt < now) {
                this.activeSessions.delete(sessionId);
                if (session.refreshToken) {
                    this.refreshTokens.delete(session.refreshToken);
                }
                cleaned++;
            }
        }
        
        // Clean expired API keys
        await this.apiKeysCollection.updateMany(
            { expiresAt: { $lt: now } },
            { $set: { active: false } }
        );
        
        console.log(`🧹 Cleaned ${cleaned} expired sessions`);
        return cleaned;
    }
}

export default AuthenticationManager;
