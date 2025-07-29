/**
 * Enhanced Settings Manager for BigBaseAlpha Dashboard
 * Handles advanced configuration and settings management
 */

class EnhancedSettingsManager {
    constructor() {
        this.settings = {};
        this.originalSettings = {};
        this.hasUnsavedChanges = false;
        this.init();
    }

    init() {
        this.loadCurrentSettings();
        this.setupEventListeners();
        this.setupSliders();
        this.setupAdvancedToggle();
        this.setupValidation();
        this.startSystemStatusMonitoring();
    }

    loadCurrentSettings() {
        // Load current settings from API
        fetch('/api/config/detailed')
            .then(response => response.json())
            .then(data => {
                this.settings = data;
                this.originalSettings = JSON.parse(JSON.stringify(data));
                this.populateFormFields();
            })
            .catch(error => {
                console.error('Error loading settings:', error);
                // Use default settings if API fails
                this.settings = {
                    database: {
                        name: "BigBaseAlpha",
                        path: "./bigbase_data",
                        format: "json",
                        autoSync: true
                    },
                    performance: {
                        cacheSize: 128,
                        maxConnections: 100,
                        queryTimeout: 30,
                        enableIndexing: true,
                        enableCompression: true
                    },
                    security: {
                        encryption: false,
                        encryptionKey: "",
                        auditLogging: true,
                        sessionTimeout: 30,
                        twoFactorAuth: false
                    },
                    backup: {
                        autoBackup: true,
                        interval: "daily",
                        retention: 30,
                        location: "./backups"
                    },
                    monitoring: {
                        enabled: true,
                        alertEmail: "",
                        memoryThreshold: 80,
                        diskThreshold: 85,
                        alerts: {
                            performance: true,
                            security: true,
                            backup: true,
                            errors: false
                        }
                    },
                    ui: {
                        theme: "dark",
                        language: "tr",
                        animations: true,
                        soundEffects: false,
                        refreshRate: 2
                    }
                };

                this.originalSettings = JSON.parse(JSON.stringify(this.settings));
                this.populateFormFields();
                this.showNotification('Failed to load settings from server, using defaults', 'warning');
            });
    }

    populateFormFields() {
        // Database settings
        this.setFieldValue('db-name', this.settings.database.name);
        this.setFieldValue('db-path', this.settings.database.path);
        this.setFieldValue('db-format', this.settings.database.format);
        this.setCheckboxValue('auto-sync', this.settings.database.autoSync);

        // Performance settings
        this.setSliderValue('cache-size', this.settings.performance.cacheSize);
        this.setSliderValue('max-connections', this.settings.performance.maxConnections);
        this.setFieldValue('query-timeout', this.settings.performance.queryTimeout);
        this.setCheckboxValue('enable-indexing', this.settings.performance.enableIndexing);
        this.setCheckboxValue('enable-compression', this.settings.performance.enableCompression);

        // Security settings
        this.setCheckboxValue('enable-encryption', this.settings.security.encryption);
        this.setFieldValue('encryption-key', this.settings.security.encryptionKey);
        this.setCheckboxValue('enable-audit', this.settings.security.auditLogging);
        this.setFieldValue('session-timeout', this.settings.security.sessionTimeout);
        this.setCheckboxValue('enable-2fa', this.settings.security.twoFactorAuth);

        // Backup settings
        this.setCheckboxValue('auto-backup', this.settings.backup.autoBackup);
        this.setFieldValue('backup-interval', this.settings.backup.interval);
        this.setFieldValue('backup-retention', this.settings.backup.retention);
        this.setFieldValue('backup-location', this.settings.backup.location);

        // Monitoring settings
        this.setCheckboxValue('enable-monitoring', this.settings.monitoring.enabled);
        this.setFieldValue('alert-email', this.settings.monitoring.alertEmail);
        this.setSliderValue('memory-threshold', this.settings.monitoring.memoryThreshold);
        this.setSliderValue('disk-threshold', this.settings.monitoring.diskThreshold);
        
        // Alert types
        Object.keys(this.settings.monitoring.alerts).forEach(alertType => {
            this.setCheckboxValue(`alert-${alertType}`, this.settings.monitoring.alerts[alertType]);
        });

        // UI settings
        this.setFieldValue('theme-select', this.settings.ui.theme);
        this.setFieldValue('language-select', this.settings.ui.language);
        this.setCheckboxValue('animations', this.settings.ui.animations);
        this.setCheckboxValue('sound-effects', this.settings.ui.soundEffects);
        this.setFieldValue('refresh-rate', this.settings.ui.refreshRate);

        // Update JSON editor
        this.updateConfigJson();
    }

    setFieldValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = value;
        }
    }

    setCheckboxValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.checked = value;
        }
    }

    setSliderValue(fieldId, value) {
        const slider = document.getElementById(fieldId);
        const valueDisplay = slider?.parentElement.querySelector('.slider-value');
        
        if (slider) {
            slider.value = value;
        }
        
        if (valueDisplay) {
            if (fieldId.includes('threshold')) {
                valueDisplay.textContent = `${value}%`;
            } else if (fieldId === 'cache-size') {
                valueDisplay.textContent = `${value} MB`;
            } else {
                valueDisplay.textContent = value;
            }
        }
    }

    setupEventListeners() {
        // Form field change listeners
        const formFields = document.querySelectorAll('.form-input, .form-select, input[type="checkbox"]');
        formFields.forEach(field => {
            field.addEventListener('change', () => {
                this.markAsChanged();
                this.validateField(field);
            });
        });

        // Button listeners
        this.setupButtonListeners();
        
        // Auto-save functionality
        this.setupAutoSave();
    }

    setupButtonListeners() {
        // Generate encryption key
        const generateKeyBtn = document.getElementById('generate-key');
        if (generateKeyBtn) {
            generateKeyBtn.addEventListener('click', () => {
                this.generateEncryptionKey();
            });
        }

        // Save settings
        const saveBtn = document.getElementById('save-all-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveAllSettings();
            });
        }

        // Reset to defaults
        const resetBtn = document.getElementById('reset-to-defaults');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetToDefaults();
            });
        }

        // Discard changes
        const discardBtn = document.getElementById('discard-changes');
        if (discardBtn) {
            discardBtn.addEventListener('click', () => {
                this.discardChanges();
            });
        }

        // Export config
        const exportBtn = document.getElementById('export-config');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportConfiguration();
            });
        }

        // Advanced config validation
        const validateBtn = document.querySelector('.config-actions .btn-warning');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => {
                this.validateJsonConfig();
            });
        }

        // Apply advanced config
        const applyBtn = document.querySelector('.config-actions .btn-primary');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyJsonConfig();
            });
        }
    }

    setupSliders() {
        const sliders = document.querySelectorAll('.slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                const value = e.target.value;
                const valueDisplay = e.target.parentElement.querySelector('.slider-value');
                
                if (valueDisplay) {
                    if (e.target.id.includes('threshold')) {
                        valueDisplay.textContent = `${value}%`;
                    } else if (e.target.id === 'cache-size') {
                        valueDisplay.textContent = `${value} MB`;
                    } else {
                        valueDisplay.textContent = value;
                    }
                }
                
                this.markAsChanged();
            });
        });
    }

    setupAdvancedToggle() {
        const toggleBtn = document.getElementById('toggle-advanced');
        const advancedContent = document.getElementById('advanced-content');
        
        if (toggleBtn && advancedContent) {
            toggleBtn.addEventListener('click', () => {
                const isVisible = advancedContent.style.display !== 'none';
                
                if (isVisible) {
                    advancedContent.style.display = 'none';
                    toggleBtn.textContent = 'Show Advanced';
                } else {
                    advancedContent.style.display = 'block';
                    toggleBtn.textContent = 'Hide Advanced';
                    this.updateConfigJson();
                }
            });
        }
    }

    setupValidation() {
        // Real-time validation for specific fields
        const emailField = document.getElementById('alert-email');
        if (emailField) {
            emailField.addEventListener('blur', () => {
                this.validateEmail(emailField);
            });
        }

        const pathFields = ['db-path', 'backup-location'];
        pathFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => {
                    this.validatePath(field);
                });
            }
        });
    }

    setupAutoSave() {
        // Auto-save every 30 seconds if there are changes
        setInterval(() => {
            if (this.hasUnsavedChanges) {
                this.autoSave();
            }
        }, 30000);
    }

    markAsChanged() {
        this.hasUnsavedChanges = true;
        this.updateSaveStatus('unsaved', 'You have unsaved changes');
        
        // Enable save button
        const saveBtn = document.getElementById('save-all-settings');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.add('btn-success');
        }
    }

    validateField(field) {
        const fieldId = field.id;
        let isValid = true;
        let message = '';

        switch (fieldId) {
            case 'alert-email':
                isValid = this.validateEmail(field);
                break;
            case 'db-path':
            case 'backup-location':
                isValid = this.validatePath(field);
                break;
            case 'query-timeout':
                isValid = this.validateTimeout(field);
                break;
            case 'backup-retention':
                isValid = this.validateRetention(field);
                break;
        }

        this.showFieldValidation(field, isValid, message);
        return isValid;
    }

    validateEmail(field) {
        const email = field.value.trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showFieldError(field, 'Please enter a valid email address');
            return false;
        }
        this.clearFieldError(field);
        return true;
    }

    validatePath(field) {
        const path = field.value.trim();
        if (path && !/^[a-zA-Z0-9._\-\/\\:]+$/.test(path)) {
            this.showFieldError(field, 'Please enter a valid file path');
            return false;
        }
        this.clearFieldError(field);
        return true;
    }

    validateTimeout(field) {
        const timeout = parseInt(field.value);
        if (timeout < 1 || timeout > 300) {
            this.showFieldError(field, 'Timeout must be between 1 and 300 seconds');
            return false;
        }
        this.clearFieldError(field);
        return true;
    }

    validateRetention(field) {
        const retention = parseInt(field.value);
        if (retention < 1 || retention > 365) {
            this.showFieldError(field, 'Retention must be between 1 and 365 days');
            return false;
        }
        this.clearFieldError(field);
        return true;
    }

    showFieldError(field, message) {
        field.style.borderColor = '#ef4444';
        
        // Remove existing error message
        const existingError = field.parentElement.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Add error message
        const errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        errorEl.textContent = message;
        errorEl.style.color = '#ef4444';
        errorEl.style.fontSize = '0.75rem';
        errorEl.style.marginTop = '0.25rem';
        field.parentElement.appendChild(errorEl);
    }

    clearFieldError(field) {
        field.style.borderColor = '';
        const errorEl = field.parentElement.querySelector('.field-error');
        if (errorEl) {
            errorEl.remove();
        }
    }

    generateEncryptionKey() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let key = '';
        for (let i = 0; i < 32; i++) {
            key += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        const keyField = document.getElementById('encryption-key');
        if (keyField) {
            keyField.value = key;
            this.markAsChanged();
            
            // Show success animation
            keyField.style.background = 'rgba(16, 185, 129, 0.1)';
            setTimeout(() => {
                keyField.style.background = '';
            }, 1000);
        }
    }

    async saveAllSettings() {
        try {
            // Collect all current form values
            const currentSettings = this.collectFormData();
            
            // Validate all settings
            if (!this.validateAllSettings(currentSettings)) {
                this.showNotification('Please fix validation errors before saving', 'error');
                return;
            }

            // Show saving state
            this.showSavingState(true);

            // Save to API
            const response = await fetch('/api/config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(currentSettings)
            });

            if (response.ok) {
                this.settings = currentSettings;
                this.originalSettings = JSON.parse(JSON.stringify(currentSettings));
                this.hasUnsavedChanges = false;
                this.updateSaveStatus('saved', 'All settings saved successfully');
                this.showNotification('Settings saved successfully!', 'success');
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Failed to save settings', 'error');
        } finally {
            this.showSavingState(false);
        }
    }

    collectFormData() {
        return {
            database: {
                name: document.getElementById('db-name')?.value || '',
                path: document.getElementById('db-path')?.value || '',
                format: document.getElementById('db-format')?.value || 'json',
                autoSync: document.getElementById('auto-sync')?.checked || false
            },
            performance: {
                cacheSize: parseInt(document.getElementById('cache-size')?.value || '128'),
                maxConnections: parseInt(document.getElementById('max-connections')?.value || '100'),
                queryTimeout: parseInt(document.getElementById('query-timeout')?.value || '30'),
                enableIndexing: document.getElementById('enable-indexing')?.checked || false,
                enableCompression: document.getElementById('enable-compression')?.checked || false
            },
            security: {
                encryption: document.getElementById('enable-encryption')?.checked || false,
                encryptionKey: document.getElementById('encryption-key')?.value || '',
                auditLogging: document.getElementById('enable-audit')?.checked || false,
                sessionTimeout: parseInt(document.getElementById('session-timeout')?.value || '30'),
                twoFactorAuth: document.getElementById('enable-2fa')?.checked || false
            },
            backup: {
                autoBackup: document.getElementById('auto-backup')?.checked || false,
                interval: document.getElementById('backup-interval')?.value || 'daily',
                retention: parseInt(document.getElementById('backup-retention')?.value || '30'),
                location: document.getElementById('backup-location')?.value || './backups'
            },
            monitoring: {
                enabled: document.getElementById('enable-monitoring')?.checked || false,
                alertEmail: document.getElementById('alert-email')?.value || '',
                memoryThreshold: parseInt(document.getElementById('memory-threshold')?.value || '80'),
                diskThreshold: parseInt(document.getElementById('disk-threshold')?.value || '85'),
                alerts: {
                    performance: document.getElementById('alert-performance')?.checked || false,
                    security: document.getElementById('alert-security')?.checked || false,
                    backup: document.getElementById('alert-backup')?.checked || false,
                    errors: document.getElementById('alert-errors')?.checked || false
                }
            },
            ui: {
                theme: document.getElementById('theme-select')?.value || 'dark',
                language: document.getElementById('language-select')?.value || 'tr',
                animations: document.getElementById('animations')?.checked || false,
                soundEffects: document.getElementById('sound-effects')?.checked || false,
                refreshRate: parseInt(document.getElementById('refresh-rate')?.value || '2')
            }
        };
    }

    validateAllSettings(settings) {
        let isValid = true;
        
        // Validate all form fields
        const allFields = document.querySelectorAll('.form-input, .form-select');
        allFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    resetToDefaults() {
        if (confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
            // Reset to default values
            this.settings = {
                database: { name: "BigBaseAlpha", path: "./bigbase_data", format: "json", autoSync: true },
                performance: { cacheSize: 128, maxConnections: 100, queryTimeout: 30, enableIndexing: true, enableCompression: true },
                security: { encryption: false, encryptionKey: "", auditLogging: true, sessionTimeout: 30, twoFactorAuth: false },
                backup: { autoBackup: true, interval: "daily", retention: 30, location: "./backups" },
                monitoring: { enabled: true, alertEmail: "", memoryThreshold: 80, diskThreshold: 85, alerts: { performance: true, security: true, backup: true, errors: false } },
                ui: { theme: "dark", language: "tr", animations: true, soundEffects: false, refreshRate: 2 }
            };
            
            this.populateFormFields();
            this.markAsChanged();
            this.showNotification('Settings reset to defaults', 'info');
        }
    }

    discardChanges() {
        if (confirm('Are you sure you want to discard all unsaved changes?')) {
            this.settings = JSON.parse(JSON.stringify(this.originalSettings));
            this.populateFormFields();
            this.hasUnsavedChanges = false;
            this.updateSaveStatus('saved', 'Changes discarded');
            this.showNotification('Changes discarded', 'info');
        }
    }

    exportConfiguration() {
        const config = this.collectFormData();
        const dataStr = JSON.stringify(config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `bigbase-config-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showNotification('Configuration exported successfully', 'success');
    }

    updateConfigJson() {
        const configTextarea = document.getElementById('config-json');
        if (configTextarea) {
            const currentConfig = this.collectFormData();
            configTextarea.value = JSON.stringify(currentConfig, null, 2);
        }
    }

    validateJsonConfig() {
        const configTextarea = document.getElementById('config-json');
        if (!configTextarea) return;

        try {
            const config = JSON.parse(configTextarea.value);
            this.showNotification('JSON configuration is valid', 'success');
            configTextarea.style.borderColor = '#10b981';
        } catch (error) {
            this.showNotification('Invalid JSON configuration: ' + error.message, 'error');
            configTextarea.style.borderColor = '#ef4444';
        }
    }

    applyJsonConfig() {
        const configTextarea = document.getElementById('config-json');
        if (!configTextarea) return;

        try {
            const config = JSON.parse(configTextarea.value);
            this.settings = config;
            this.populateFormFields();
            this.markAsChanged();
            this.showNotification('Configuration applied from JSON', 'success');
        } catch (error) {
            this.showNotification('Failed to apply JSON configuration: ' + error.message, 'error');
        }
    }

    autoSave() {
        // Implement auto-save logic
        console.log('Auto-saving settings...');
        this.updateSaveStatus('auto-saved', 'Auto-saved');
    }

    showSavingState(saving) {
        const saveBtn = document.getElementById('save-all-settings');
        if (saveBtn) {
            if (saving) {
                saveBtn.disabled = true;
                saveBtn.textContent = '💾 Saving...';
            } else {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Save All Settings';
            }
        }
    }

    updateSaveStatus(status, message) {
        const statusIcon = document.querySelector('.status-icon');
        const statusText = document.querySelector('.status-text');
        const statusTime = document.querySelector('.status-time');

        if (statusIcon && statusText && statusTime) {
            switch (status) {
                case 'saved':
                    statusIcon.textContent = '✅';
                    statusText.textContent = message;
                    statusTime.textContent = `Last saved: ${new Date().toLocaleTimeString()}`;
                    break;
                case 'unsaved':
                    statusIcon.textContent = '⚠️';
                    statusText.textContent = message;
                    statusTime.textContent = '';
                    break;
                case 'auto-saved':
                    statusIcon.textContent = '🔄';
                    statusText.textContent = message;
                    statusTime.textContent = `Auto-saved: ${new Date().toLocaleTimeString()}`;
                    break;
            }
        }
    }

    showNotification(message, type = 'info') {
        // Integration with existing notification system
        if (window.notifications) {
            window.notifications.show(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    startSystemStatusMonitoring() {
        // Update system status immediately
        this.updateSystemStatus();
        
        // Update every 3 seconds (faster updates)
        this.statusInterval = setInterval(() => {
            this.updateSystemStatus();
        }, 3000);
    }

    async updateSystemStatus() {
        try {
            const response = await fetch('/api/system/status');
            if (response.ok) {
                const status = await response.json();
                this.displaySystemStatus(status);
            } else {
                throw new Error('Failed to fetch system status');
            }
        } catch (error) {
            console.error('Error fetching system status:', error);
            this.displaySystemStatusError();
        }
    }

    async displaySystemStatus(status) {
        try {
            // Update status icon and text
            const statusIcon = document.getElementById('status-icon');
            const statusText = document.getElementById('status-text');
            const statusTime = document.getElementById('status-time');
            
            if (statusIcon && statusText && statusTime) {
                // Update icon to success state
                statusIcon.innerHTML = `
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                `;
                statusIcon.className = 'status-icon online';
                statusText.textContent = 'System Online';
                statusTime.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
            }
            
            // Update memory usage
            const memoryFill = document.getElementById('memory-fill');
            const memoryValue = document.getElementById('memory-value');
            
            if (memoryFill && memoryValue) {
                const memoryPercent = parseFloat(status.memory.used) || 0;
                memoryFill.style.width = `${Math.min(memoryPercent, 100)}%`;
                memoryValue.textContent = `${memoryPercent.toFixed(1)}%`;
                
                // Update color based on usage
                memoryFill.className = 'metric-fill';
                if (memoryPercent > 90) {
                    memoryFill.classList.add('danger');
                } else if (memoryPercent > 75) {
                    memoryFill.classList.add('warning');
                }
            }
            
            // Update database status
            const dbStatus = document.getElementById('db-status');
            const dbCollections = document.getElementById('db-collections');
            
            if (dbStatus && dbCollections) {
                const isConnected = status.database && status.database.status === 'connected';
                dbStatus.textContent = isConnected ? 'Connected' : 'Disconnected';
                dbStatus.className = `status-badge ${isConnected ? 'connected' : 'disconnected'}`;
                
                const collectionCount = (status.database && status.database.collections) || 0;
                dbCollections.textContent = `${collectionCount} collections`;
            }
            
            // Update uptime
            const uptimeValue = document.getElementById('uptime-value');
            if (uptimeValue) {
                const uptime = (status.uptime && status.uptime.formatted) || '00:00:00';
                uptimeValue.textContent = uptime;
            }
            
            // Update performance metrics if available
            if (status.performance) {
                // Cache Performance
                const cacheValue = document.getElementById('cache-performance-value');
                if (cacheValue) {
                    cacheValue.textContent = `${status.performance.cacheHitRate}%`;
                }
                
                // Query Latency
                const latencyValue = document.getElementById('query-latency-value');
                if (latencyValue) {
                    latencyValue.textContent = `${status.performance.queryLatency}ms`;
                }
                
                // Throughput
                const throughputValue = document.getElementById('throughput-value');
                if (throughputValue) {
                    throughputValue.textContent = `${status.performance.throughput.toLocaleString()} ops/sec`;
                }
                
                // Active Connections
                const connectionsValue = document.getElementById('connections-value');
                if (connectionsValue) {
                    connectionsValue.textContent = status.performance.connections.toString();
                }
            }
            
            // Update CPU usage if available
            if (status.cpu) {
                const cpuValue = document.getElementById('cpu-usage-value');
                if (cpuValue) {
                    cpuValue.textContent = `${status.cpu.load.toFixed(1)}%`;
                }
            }
            
        } catch (error) {
            console.error('Error displaying system status:', error);
            this.displaySystemStatusError();
        }
    }

    displaySystemStatusError() {
        const statusIcon = document.getElementById('status-icon');
        const statusText = document.getElementById('status-text');
        const statusTime = document.getElementById('status-time');
        
        if (statusIcon && statusText && statusTime) {
            // Update icon to error state
            statusIcon.innerHTML = `
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            `;
            statusIcon.className = 'status-icon error';
            statusText.textContent = 'Connection Error';
            statusTime.textContent = `Last attempt: ${new Date().toLocaleTimeString()}`;
        }
        
        // Set default values for metrics
        const memoryFill = document.getElementById('memory-fill');
        const memoryValue = document.getElementById('memory-value');
        if (memoryFill && memoryValue) {
            memoryFill.style.width = '0%';
            memoryValue.textContent = 'N/A';
        }
        
        const dbStatus = document.getElementById('db-status');
        const dbCollections = document.getElementById('db-collections');
        if (dbStatus && dbCollections) {
            dbStatus.textContent = 'Disconnected';
            dbStatus.className = 'status-badge disconnected';
            dbCollections.textContent = '0 collections';
        }
        
        const uptimeValue = document.getElementById('uptime-value');
        if (uptimeValue) {
            uptimeValue.textContent = '00:00:00';
        }
    }

    destroy() {
        // Clean up intervals when settings page is closed
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
    }
}

// Initialize Enhanced Settings Manager
let enhancedSettingsManager = null;

function initEnhancedSettings() {
    if (!enhancedSettingsManager) {
        enhancedSettingsManager = new EnhancedSettingsManager();
    }
}

function destroyEnhancedSettings() {
    if (enhancedSettingsManager) {
        enhancedSettingsManager.destroy();
        enhancedSettingsManager = null;
    }
}

// Export for use in main dashboard
window.EnhancedSettingsManager = EnhancedSettingsManager;
window.initEnhancedSettings = initEnhancedSettings;
window.destroyEnhancedSettings = destroyEnhancedSettings;
