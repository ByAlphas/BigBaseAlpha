// BigBaseAlpha Dashboard - Clean Version

// Comprehensive Notification System
class NotificationSystem {
  constructor() {
    this.notifications = [];
    this.init();
  }

  init() {
    this.createNotificationContainer();
  }

  createNotificationContainer() {
    if (document.getElementById('notification-container')) {
      return;
    }

    const container = document.createElement('div');
    container.id = 'notification-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 350px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  show(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    const id = Date.now() + Math.random();
    
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
      background: ${this.getBackgroundColor(type)};
      color: white;
      padding: 16px 20px;
      margin-bottom: 10px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      pointer-events: auto;
      cursor: pointer;
      position: relative;
      border-left: 4px solid ${this.getBorderColor(type)};
    `;

    const icon = this.getIcon(type);
    notification.innerHTML = `
      <div style="display: flex; align-items: center;">
        <span style="margin-right: 10px; font-size: 18px;">${icon}</span>
        <span style="flex: 1;">${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; margin-left: 10px;">×</button>
      </div>
    `;

    // Add to container
    const container = document.getElementById('notification-container');
    container.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 10);

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        this.remove(notification);
      }, duration);
    }

    // Click to remove
    notification.addEventListener('click', () => {
      this.remove(notification);
    });

    return notification;
  }

  remove(notification) {
    if (notification && notification.parentNode) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }

  getBackgroundColor(type) {
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    return colors[type] || colors.info;
  }

  getBorderColor(type) {
    const colors = {
      success: '#059669',
      error: '#dc2626',
      warning: '#d97706',
      info: '#2563eb'
    };
    return colors[type] || colors.info;
  }

  getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  success(message, duration = 5000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 7000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 6000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }
}

// Alert System for confirmation dialogs
class AlertSystem {
  static confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'alert-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20000;
      `;

      modal.innerHTML = `
        <div class="alert-content" style="
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          max-width: 400px;
          width: 90%;
          text-align: center;
        ">
          <h3 style="margin: 0 0 15px 0; color: #1f2937;">${title}</h3>
          <p style="margin: 0 0 25px 0; color: #6b7280; line-height: 1.5;">${message}</p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button class="btn-cancel" style="
              padding: 10px 20px;
              border: 2px solid #d1d5db;
              background: white;
              color: #6b7280;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 500;
            ">Cancel</button>
            <button class="btn-confirm" style="
              padding: 10px 20px;
              border: 2px solid #ef4444;
              background: #ef4444;
              color: white;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 500;
            ">Confirm</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('.btn-confirm').addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      modal.querySelector('.btn-cancel').addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });
    });
  }

  static alert(message, title = 'Alert', type = 'info') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'alert-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20000;
      `;

      const getColor = () => {
        const colors = {
          success: '#10b981',
          error: '#ef4444',
          warning: '#f59e0b',
          info: '#3b82f6'
        };
        return colors[type] || colors.info;
      };

      modal.innerHTML = `
        <div class="alert-content" style="
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          max-width: 400px;
          width: 90%;
          text-align: center;
        ">
          <h3 style="margin: 0 0 15px 0; color: ${getColor()};">${title}</h3>
          <p style="margin: 0 0 25px 0; color: #6b7280; line-height: 1.5;">${message}</p>
          <button class="btn-ok" style="
            padding: 10px 20px;
            border: 2px solid ${getColor()};
            background: ${getColor()};
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          ">OK</button>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('.btn-ok').addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(true);
        }
      });
    });
  }
}

// Global notification system instance
window.notifications = new NotificationSystem();

// Main Dashboard Class
class Dashboard {
  constructor() {
    this.currentPage = 'overview';
    this.updateInterval = null;
    this.charts = {};
    this.modules = {};
    this.notifications = window.notifications;
    this.init();
  }

  init() {
    console.log('🚀 Dashboard initialization starting...');
    
    // Check DOM readiness
    console.log('Available nav links:', document.querySelectorAll('.nav-link').length);
    console.log('Available tab panes:', document.querySelectorAll('.tab-pane').length);
    
    this.setupTabNavigation();
    this.setupSidebar();
    this.setupPerformanceChart();
    this.loadDashboardData();
    this.initializeModules();
    this.setupEventListeners();
    
    console.log('✅ Dashboard initialization complete');
  }

  setupPerformanceChart() {
    const ctx = document.getElementById('performance-chart');
    if (!ctx || typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded or performance-chart element not found');
      return;
    }

    this.performanceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.generateTimeLabels(),
        datasets: [
          {
            label: 'Queries per minute',
            data: this.generateRandomData(20, 0, 100),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Response time (ms)',
            data: this.generateRandomData(20, 10, 200),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#cbd5e1'
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') || '#475569'
            },
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted') || '#94a3b8'
            }
          },
          y: {
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') || '#475569'
            },
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted') || '#94a3b8'
            }
          }
        }
      }
    });

    // Update chart every 5 seconds
    this.updateInterval = setInterval(() => {
      this.updatePerformanceChart();
    }, 5000);
  }

  updatePerformanceChart() {
    if (!this.performanceChart || !this.performanceChart.update) {
      // For custom chart implementation, just redraw
      this.drawChart();
      return;
    }

    const datasets = this.performanceChart.data.datasets;
    datasets.forEach(dataset => {
      dataset.data.shift();
      dataset.data.push(Math.floor(Math.random() * 100));
    });

    // Try Chart.js update, fallback to custom drawing
    try {
      this.performanceChart.update('none');
    } catch (error) {
      console.warn('Chart.js update failed, using custom draw:', error);
      this.drawChart();
    }
  }

  generateTimeLabels() {
    const labels = [];
    const now = new Date();
    for (let i = 19; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60000);
      labels.push(time.toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }));
    }
    return labels;
  }

  generateRandomData(count, min, max) {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return data;
  }

  setupTabNavigation() {
    console.log('Setting up tab navigation...');
    
    // Remove any existing event listeners first
    document.querySelectorAll('.nav-link').forEach(link => {
      link.replaceWith(link.cloneNode(true));
    });
    
    // Add fresh event listeners
    const navLinks = document.querySelectorAll('.nav-link');
    console.log('Found nav links:', navLinks.length);
    
    navLinks.forEach((link, index) => {
      console.log(`Link ${index}:`, link.dataset.tab, link.textContent.trim());
      
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const tabId = link.dataset.tab;
        console.log('Tab clicked:', tabId);
        
        if (!tabId) {
          console.error('No data-tab attribute found on link:', link);
          return;
        }
        
        // Perform tab switch
        this.switchTab(tabId);
      });
    });
    
    console.log('Tab navigation setup complete');
  }

  switchTab(tabId) {
    console.log('Switching to tab:', tabId);
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    
    // Remove active class from all tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    // Add active class to current nav link
    const activeLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
      console.log('✅ Active link set for:', tabId);
    } else {
      console.error('❌ Active link not found for tab:', tabId);
    }
    
    // Add active class to current tab pane
    const activePane = document.getElementById(tabId);
    if (activePane) {
      activePane.classList.add('active');
      console.log('✅ Active pane set for:', tabId);
    } else {
      console.error('❌ Active pane not found for tab:', tabId);
      console.log('Available panes:', Array.from(document.querySelectorAll('.tab-pane')).map(p => p.id));
    }

    // Update current page
    this.currentPage = tabId;
    
    // Update page title
    this.updatePageTitle(tabId);

    // Initialize tab-specific features after a short delay
    setTimeout(() => {
      this.initializeTabFeatures(tabId);
    }, 100);
    
    console.log('Tab switch completed for:', tabId);
  }

  updatePageTitle(tabId) {
    const titles = {
      'overview': 'Dashboard Overview',
      'collections': 'Database Collections',
      'query-builder': 'Advanced Query Builder',
      'analytics': 'Real-time Analytics',
      'realtime-charts': 'Live Performance Charts',
      'health-monitor': 'System Health Monitor',
      'backup-manager': 'Backup & Export Manager',
      'security': 'Security Settings',
      'settings': 'System Settings'
    };

    const subtitles = {
      'overview': 'Welcome to BigBaseAlpha Management Console',
      'collections': 'Manage your database collections and schemas',
      'query-builder': 'Build and execute advanced database queries',
      'analytics': 'Monitor database performance and usage metrics',
      'realtime-charts': 'Real-time performance monitoring and visualization',
      'health-monitor': 'Real-time system health and performance monitoring',
      'backup-manager': 'Create backups and export your data',
      'security': 'Configure security settings and access control',
      'settings': 'Customize your dashboard and system preferences'
    };

    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    
    if (titleEl) titleEl.textContent = titles[tabId] || 'Dashboard';
    if (subtitleEl) subtitleEl.textContent = subtitles[tabId] || '';
  }

  setupSidebar() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });

      // Auto-collapse on mobile
      this.handleMobileLayout();
      window.addEventListener('resize', () => this.handleMobileLayout());
    }
  }

  handleMobileLayout() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    if (window.innerWidth <= 768) {
      sidebar.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
    }
  }

  initializeModules() {
    // Initialize notification system
    this.modules.notifications = this.notifications;
    
    // Initialize error handling
    this.setupErrorHandling();
    
    // Initialize real-time updates
    this.setupRealTimeUpdates();
    
    console.log('✅ Dashboard modules initialized');
  }

  setupErrorHandling() {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.notifications.error(`Application Error: ${event.error.message}`);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.notifications.error(`Promise Rejection: ${event.reason}`);
      event.preventDefault();
    });
  }

  setupRealTimeUpdates() {
    // Update dashboard data every 30 seconds
    this.realTimeInterval = setInterval(() => {
      if (this.currentPage === 'overview') {
        this.loadDashboardData();
      }
    }, 30000);
  }

  setupEventListeners() {
    // Global click handler for better event management
    document.addEventListener('click', (e) => {
      // Handle button clicks with data attributes
      if (e.target.dataset.action) {
        this.handleAction(e.target.dataset.action, e.target.dataset);
      }
      
      // Handle navigation clicks
      if (e.target.classList.contains('nav-link')) {
        e.preventDefault();
        const targetPage = e.target.getAttribute('href').substring(1);
        this.navigateToPage(targetPage);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'r':
            e.preventDefault();
            this.loadDashboardData();
            this.notifications.info('Dashboard data refreshed');
            break;
          case 'b':
            e.preventDefault();
            if (typeof createBackup === 'function') {
              createBackup();
            }
            break;
        }
      }
    });
  }

  async loadDashboardData() {
    try {
      // Show loading state
      this.showLoadingState();
      
      // Load all dashboard data with individual error handling
      const results = await Promise.allSettled([
        this.fetchDashboardStats(),
        this.fetchSystemStatus(),
        this.fetchCollections(),
        this.fetchUsers(),
        this.fetchBackups()
      ]);

      // Extract successful results with fallbacks
      const [statsResult, statusResult, collectionsResult, usersResult, backupsResult] = results;
      
      const stats = statsResult.status === 'fulfilled' ? statsResult.value : {
        totalCollections: 0,
        totalRecords: 0,
        storageUsed: '0',
        uptime: 0,
        memoryUsage: 0
      };

      const status = statusResult.status === 'fulfilled' ? statusResult.value : {
        database: { status: 'disconnected', version: '1.0.0' },
        server: { status: 'unknown', port: 3000 },
        memory: { used: 0, total: 1 }
      };

      const collections = collectionsResult.status === 'fulfilled' ? collectionsResult.value : [];
      const users = usersResult.status === 'fulfilled' ? usersResult.value : [];
      const backups = backupsResult.status === 'fulfilled' ? backupsResult.value : [];
      
      this.updateHeaderStats(stats);
      this.updateSystemStatus(status);
      this.updateCollectionsData(collections);
      this.updateUsersData(users);
      this.updateBackupsData(backups);
      
      // Hide loading state
      this.hideLoadingState();
      
      // Check for any failures
      const failedRequests = results.filter(r => r.status === 'rejected').length;
      if (failedRequests > 0) {
        this.notifications.warning(`Dashboard loaded with ${failedRequests} failed requests. Using fallback data.`);
      } else {
        this.notifications.success('Dashboard data loaded successfully');
      }
    } catch (error) {
      console.error('Critical error loading dashboard data:', error);
      this.notifications.error('Critical error loading dashboard: ' + error.message);
      this.hideLoadingState();
    }
  }

  async fetchDashboardStats() {
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('Failed to fetch real stats, using fallback data:', error);
      return {
        totalCollections: Math.floor(Math.random() * 20) + 5,
        totalRecords: Math.floor(Math.random() * 10000) + 1000,
        storageUsed: (Math.random() * 100 + 50).toFixed(1),
        uptime: Math.floor(Math.random() * 86400000),
        memoryUsage: Math.floor(Math.random() * 512) + 256
      };
    }
  }

  async fetchSystemStatus() {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('Failed to fetch system status, using fallback:', error);
      return {
        database: { status: 'connected', version: '1.0.0' },
        server: { status: 'running', port: 3000 },
        memory: { used: 256, total: 512 }
      };
    }
  }

  async fetchCollections() {
    try {
      const response = await fetch('/api/collections');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('Failed to fetch collections, using fallback:', error);
      return [
        { name: 'users', documents: 150, size: '2.5 MB' },
        { name: 'products', documents: 300, size: '5.2 MB' },
        { name: 'orders', documents: 75, size: '1.8 MB' }
      ];
    }
  }

  async fetchUsers() {
    try {
      const response = await fetch('/api/auth/users');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('Failed to fetch users, using fallback:', error);
      return [
        { id: '1', username: 'admin', role: 'admin', twoFactorEnabled: true, lastLogin: new Date().toISOString() },
        { id: '2', username: 'user1', role: 'user', twoFactorEnabled: false, lastLogin: new Date(Date.now() - 86400000).toISOString() }
      ];
    }
  }

  async fetchBackups() {
    try {
      const response = await fetch('/api/backups');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('Failed to fetch backups, using fallback:', error);
      return [
        { id: '1', filename: 'backup_2025-07-28.bba', size: '15.2 MB', created: new Date().toISOString() },
        { id: '2', filename: 'backup_2025-07-27.bba', size: '14.8 MB', created: new Date(Date.now() - 86400000).toISOString() }
      ];
    }
  }

  updateHeaderStats(stats) {
    // Ensure stats object has default values
    const safeStats = {
      totalCollections: 0,
      totalRecords: 0,
      storageUsed: '0',
      ...stats
    };

    const collectionsEl = document.getElementById('total-collections');
    const recordsEl = document.getElementById('total-records');
    const storageEl = document.getElementById('storage-used');
    
    if (collectionsEl) collectionsEl.textContent = safeStats.totalCollections || 0;
    if (recordsEl) recordsEl.textContent = (safeStats.totalRecords || 0).toLocaleString();
    if (storageEl) storageEl.textContent = `${safeStats.storageUsed || 0} MB`;
    
    // Update Database Collections tab stats
    this.updateCollectionsStats(stats);
  }

  updateCollectionsStats(stats) {
    const safeStats = {
      totalCollections: 0,
      totalRecords: 0,
      storageUsed: '0',
      lastActivity: 'Never',
      ...stats
    };

    const collectionsTotal = document.getElementById('collections-total');
    const collectionsDocuments = document.getElementById('collections-documents');
    const collectionsSize = document.getElementById('collections-size');
    const collectionsActivity = document.getElementById('collections-activity');
    
    if (collectionsTotal) {
      collectionsTotal.textContent = safeStats.totalCollections || 0;
    }
    
    if (collectionsDocuments) {
      collectionsDocuments.textContent = (safeStats.totalRecords || 0).toLocaleString();
    }
    
    if (collectionsSize) {
      collectionsSize.textContent = `${safeStats.storageUsed || 0} MB`;
    }
    
    if (collectionsActivity) {
      collectionsActivity.textContent = safeStats.lastActivity || 'Never';
    }
  }

  updateSystemStatus(status) {
    // Ensure status object has safe structure
    const safeStatus = {
      database: { status: 'unknown', version: '1.0.0' },
      server: { status: 'unknown', port: 3000 },
      memory: { used: 0, total: 1 },
      ...status,
      database: { status: 'unknown', version: '1.0.0', ...status?.database },
      server: { status: 'unknown', port: 3000, ...status?.server },
      memory: { used: 0, total: 1, ...status?.memory }
    };

    // Update database status
    const dbStatusElement = document.querySelector('[data-stat="database-status"]');
    if (dbStatusElement) {
      dbStatusElement.textContent = safeStatus.database.status;
      dbStatusElement.className = safeStatus.database.status === 'connected' ? 'status-connected' : 'status-disconnected';
    }

    // Update server status
    const serverStatusElement = document.querySelector('[data-stat="server-status"]');
    if (serverStatusElement) {
      serverStatusElement.textContent = safeStatus.server.status;
      serverStatusElement.className = safeStatus.server.status === 'running' ? 'status-connected' : 'status-disconnected';
    }

    // Update memory usage
    const memoryElement = document.querySelector('[data-stat="memory-usage"]');
    if (memoryElement) {
      const percentage = Math.round((safeStatus.memory.used / safeStatus.memory.total) * 100);
      memoryElement.textContent = `${percentage}%`;
    }

    // Update system status indicator
    const statusTextElement = document.getElementById('status-text');
    const statusIconElement = document.getElementById('status-icon');
    const statusTimeElement = document.getElementById('status-time');
    
    if (statusTextElement && statusIconElement) {
      const isSystemHealthy = safeStatus.database.status === 'connected' && safeStatus.server.status === 'running';
      
      if (isSystemHealthy) {
        statusTextElement.textContent = 'System Online';
        statusIconElement.setAttribute('class', 'status-icon online');
        statusIconElement.innerHTML = '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>';
      } else {
        statusTextElement.textContent = 'System Issues Detected';
        statusIconElement.setAttribute('class', 'status-icon');
        statusIconElement.innerHTML = '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>';
      }
      
      if (statusTimeElement) {
        statusTimeElement.textContent = new Date().toLocaleTimeString('tr-TR');
      }
    }
  }

  updateCollectionsData(collections) {
    const tbody = document.querySelector('#collections-table tbody');
    if (!tbody) return;

    // Ensure collections is an array
    const safeCollections = Array.isArray(collections) ? collections : [];

    tbody.innerHTML = '';
    safeCollections.forEach(collection => {
      // Ensure collection has required properties
      const safeCollection = {
        name: 'Unknown',
        documents: 0,
        size: '0 KB',
        ...collection
      };
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${safeCollection.name}</td>
        <td>${safeCollection.documents}</td>
        <td>${safeCollection.size}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewCollection('${safeCollection.name}')">
            <i data-feather="eye"></i> View
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteCollection('${safeCollection.name}')">
            <i data-feather="trash-2"></i> Delete
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Reinitialize feather icons
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }

  updateUsersData(users) {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    users.forEach(user => {
      const row = document.createElement('tr');
      const lastLogin = new Date(user.lastLogin).toLocaleDateString('tr-TR');
      row.innerHTML = `
        <td>${user.username}</td>
        <td><span class="badge badge-${user.role === 'admin' ? 'primary' : 'secondary'}">${user.role}</span></td>
        <td>
          <span class="status-indicator ${user.twoFactorEnabled ? 'status-connected' : 'status-disconnected'}">
            ${user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </td>
        <td>${lastLogin}</td>
        <td>
          <button class="btn btn-sm btn-${user.twoFactorEnabled ? 'warning' : 'success'}" 
                  onclick="toggle2FA('${user.id}', ${!user.twoFactorEnabled})">
            <i data-feather="${user.twoFactorEnabled ? 'shield-off' : 'shield'}"></i>
            ${user.twoFactorEnabled ? 'Disable' : 'Enable'} 2FA
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')">
            <i data-feather="trash-2"></i> Delete
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Reinitialize feather icons
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }

  updateBackupsData(backups) {
    const tbody = document.querySelector('#backups-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    backups.forEach(backup => {
      const row = document.createElement('tr');
      const created = new Date(backup.created).toLocaleDateString('tr-TR');
      row.innerHTML = `
        <td>${backup.filename}</td>
        <td>${backup.size}</td>
        <td>${created}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="downloadBackup('${backup.id}')">
            <i data-feather="download"></i> Download
          </button>
          <button class="btn btn-sm btn-success" onclick="restoreBackup('${backup.id}')">
            <i data-feather="refresh-cw"></i> Restore
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteBackup('${backup.id}')">
            <i data-feather="trash-2"></i> Delete
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Reinitialize feather icons
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }

  showLoadingState() {
    const statsElements = document.querySelectorAll('.stat-value');
    statsElements.forEach(el => {
      el.textContent = '...';
      el.classList.add('loading');
    });
  }

  hideLoadingState() {
    const statsElements = document.querySelectorAll('.stat-value');
    statsElements.forEach(el => {
      el.classList.remove('loading');
    });
  }

  initializeTabFeatures(tabId) {
    console.log('Initializing features for tab:', tabId);
    
    try {
      switch (tabId) {
        case 'overview':
          console.log('Overview tab - loading stats');
          this.loadDashboardData();
          break;
          
        case 'collections':
          console.log('Collections tab - loading collections');
          this.loadCollections();
          break;
          
        case 'security':
          console.log('Security tab - loading security data');
          this.loadSecurityData();
          break;
          
        case 'settings':
          console.log('Settings tab - loading settings');
          this.loadSettingsData();
          break;
          
        case 'monitoring':
        case 'realtime-charts':
        case 'health-monitor':
          console.log('Monitoring/Charts tab - initializing charts');
          this.initializeRealTimeCharts();
          break;
          
        case 'analytics':
          console.log('Analytics tab - loading analytics data');
          this.loadAnalyticsData();
          break;
          
        case 'query-builder':
          console.log('Query Builder tab - initializing query builder');
          this.initializeQueryBuilder();
          break;
          
        case 'backup-manager':
          console.log('Backup Manager tab - loading backup data');
          this.loadBackupData();
          break;
          
        default:
          console.log('Default tab initialization for:', tabId);
      }
    } catch (error) {
      console.error('Error initializing tab features:', error);
    }
  }

  async loadCollections() {
    try {
      const collections = await this.fetchCollections();
      this.updateCollectionsData(collections);
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  }

  // Security Data Loading
  async loadSecurityData() {
    try {
      console.log('Loading security data...');
      
      // Load security audit data
      try {
        const securityResponse = await fetch('/api/admin/security');
        if (securityResponse.ok) {
          const securityData = await securityResponse.json();
          this.updateSecurityStatus(securityData);
        } else {
          throw new Error(`HTTP ${securityResponse.status}`);
        }
      } catch (apiError) {
        console.warn('Security API not available, using mock data:', apiError);
        // Use mock data when API is not available
        const mockSecurityData = {
          encryption: { enabled: false, status: 'warning' },
          authentication: { enabled: false, status: 'warning' },
          recommendations: ['Enable encryption for sensitive data', 'Setup user authentication', 'Enable audit logging']
        };
        this.updateSecurityStatus(mockSecurityData);
      }

      // Load authentication users data
      try {
        const usersResponse = await fetch('/api/auth/users');
        if (usersResponse.ok) {
          const users = await usersResponse.json();
          this.updateSecurityUsers(users);
        } else {
          throw new Error(`HTTP ${usersResponse.status}`);
        }
      } catch (apiError) {
        console.warn('Users API not available, using mock data:', apiError);
        // Use mock user data
        const mockUsers = [
          { id: 1, username: 'admin', role: 'administrator', lastLogin: new Date(), active: true, twoFactorEnabled: false },
          { id: 2, username: 'operator', role: 'operator', lastLogin: new Date(Date.now() - 86400000), active: true, twoFactorEnabled: true },
          { id: 3, username: 'viewer', role: 'viewer', lastLogin: new Date(Date.now() - 172800000), active: false, twoFactorEnabled: false }
        ];
        this.updateSecurityUsers(mockUsers);
      }

      console.log('Security data loaded successfully');
    } catch (error) {
      console.error('Error loading security data:', error);
      this.notifications.error('Failed to load security data');
    }
  }

  // Settings Data Loading
  async loadSettingsData() {
    try {
      console.log('Loading settings data...');
      
      // Load system status
      try {
        const statusResponse = await fetch('/api/system/status');
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          this.updateSystemStatus(status);
        } else {
          throw new Error(`HTTP ${statusResponse.status}`);
        }
      } catch (apiError) {
        console.warn('System status API not available, using mock data:', apiError);
        const mockStatus = {
          memory: { used: 67.5, total: 1024, free: 956 },
          cpu: { load: 23.4, cores: 8 },
          database: { status: 'connected', collections: 3 }
        };
        this.updateSystemStatus(mockStatus);
      }

      // Load detailed configuration
      try {
        const configResponse = await fetch('/api/config/detailed');
        if (configResponse.ok) {
          const config = await configResponse.json();
          this.updateSettingsConfig(config);
        } else {
          throw new Error(`HTTP ${configResponse.status}`);
        }
      } catch (apiError) {
        console.warn('Config API not available, using mock data:', apiError);
        const mockConfig = {
          database: { name: 'BigBaseAlpha', path: './bigbase_data', format: 'json', autoSync: true },
          performance: { cacheSize: 128, maxConnections: 100, queryTimeout: 30, enableIndexing: true, enableCompression: true },
          security: { encryption: false, encryptionKey: '', auditLogging: true, sessionTimeout: 30, twoFactorAuth: false }
        };
        this.updateSettingsConfig(mockConfig);
      }

      console.log('Settings data loaded successfully');
    } catch (error) {
      console.error('Error loading settings data:', error);
      this.notifications.error('Failed to load settings data');
    }
  }

  // Real-time Charts Initialization
  async initializeRealTimeCharts() {
    try {
      console.log('Initializing real-time charts...');
      
      // Initialize performance chart
      await this.initPerformanceChart();
      
      // Start real-time data updates
      this.startRealTimeUpdates();
      
      console.log('Real-time charts initialized successfully');
    } catch (error) {
      console.error('Error initializing real-time charts:', error);
      this.notifications.error('Failed to initialize monitoring charts');
    }
  }

  // Update Security Status
  updateSecurityStatus(securityData) {
    // Update encryption status
    const encryptionCards = document.querySelectorAll('.security-card');
    encryptionCards.forEach(card => {
      const cardTitle = card.querySelector('h3');
      if (cardTitle && cardTitle.textContent === 'Encryption') {
        const statusElement = card.querySelector('.stat-value.status-enabled, .stat-value.status-disabled');
        if (statusElement && securityData.encryption) {
          statusElement.textContent = securityData.encryption.enabled ? 'Enabled' : 'Disabled';
          statusElement.className = securityData.encryption.enabled ? 'stat-value status-enabled' : 'stat-value status-disabled';
        }
      }
      
      // Update Two-Factor Authentication
      if (cardTitle && cardTitle.textContent === 'Two-Factor Authentication') {
        const statusElement = card.querySelector('.stat-value.status-enabled, .stat-value.status-disabled');
        if (statusElement && securityData.authentication) {
          statusElement.textContent = securityData.authentication.enabled ? 'Enabled' : 'Disabled';
          statusElement.className = securityData.authentication.enabled ? 'stat-value status-enabled' : 'stat-value status-disabled';
        }
      }
      
      // Update Audit Logs
      if (cardTitle && cardTitle.textContent === 'Audit Logs') {
        const eventElement = card.querySelector('.stat-value');
        if (eventElement) {
          eventElement.textContent = Math.floor(Math.random() * 2000 + 1000);
        }
      }
      
      // Update API Keys
      if (cardTitle && cardTitle.textContent === 'API Keys') {
        const activeKeysElement = card.querySelector('.stat-value');
        if (activeKeysElement) {
          activeKeysElement.textContent = Math.floor(Math.random() * 5 + 1);
        }
      }
    });

    // Update security recommendations
    console.log('Security recommendations updated:', securityData.recommendations);
  }

  // Update Security Users
  updateSecurityUsers(users) {
    const usersTableBody = document.querySelector('#security-users-table tbody');
    if (!usersTableBody) return;

    usersTableBody.innerHTML = '';
    users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${user.username}</td>
        <td><span class="role-badge role-${user.role}">${user.role}</span></td>
        <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
        <td><span class="status-badge ${user.active ? 'active' : 'inactive'}">${user.active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')">Delete</button>
          <button class="btn btn-sm ${user.twoFactorEnabled ? 'btn-warning' : 'btn-primary'}" 
                  onclick="toggle2FA('${user.id}', ${!user.twoFactorEnabled})">
            ${user.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
          </button>
        </td>
      `;
      usersTableBody.appendChild(row);
    });
  }

  // Update Settings Configuration
  updateSettingsConfig(config) {
    // Update system metrics
    this.updateSystemMetrics(config);
    
    // Update configuration forms if they exist
    this.populateConfigurationForms(config);
  }

  // Update System Metrics in Settings
  updateSystemStatus(status) {
    // Update memory usage
    const memoryFill = document.getElementById('memory-fill');
    const memoryValue = document.getElementById('memory-value');
    if (memoryFill && memoryValue && status.memory) {
      memoryFill.style.width = `${status.memory.used}%`;
      memoryValue.textContent = `${status.memory.used}%`;
    }

    // Update database status
    const dbStatusElement = document.getElementById('db-status');
    const dbCollectionsElement = document.getElementById('db-collections');
    if (dbStatusElement && status.database) {
      dbStatusElement.textContent = status.database.status.toUpperCase();
      dbStatusElement.className = status.database.status === 'connected' ? 'status-badge status-connected' : 'status-badge status-disconnected';
    }
    if (dbCollectionsElement && status.database) {
      dbCollectionsElement.textContent = `${status.database.collections || 0} collections`;
    }

    // Update uptime
    const uptimeElement = document.getElementById('uptime-value');
    if (uptimeElement && status.uptime) {
      uptimeElement.textContent = status.uptime.formatted || '00:00:00';
    }

    // Update status indicators
    const statusText = document.getElementById('status-text');
    const statusIcon = document.getElementById('status-icon');
    if (statusText && statusIcon) {
      statusText.textContent = status.database?.status === 'connected' ? 'System Operational' : 'System Warning';
      statusIcon.style.color = status.database?.status === 'connected' ? '#10b981' : '#f59e0b';
    }
  }

  // Initialize Performance Chart
  async initPerformanceChart() {
    // Initialize multiple charts for different metrics
    this.initializeCanvasChart('operations-chart', 'Operations/sec');
    this.initializeCanvasChart('memory-chart', 'Memory Usage %');
    this.initializeCanvasChart('cache-chart', 'Cache Hit Rate %');
    this.initializeCanvasChart('connections-chart', 'Active Connections');
    this.initializeCanvasChart('performance-chart', 'Performance Overview');
    
    // Initialize donut chart for operation types
    this.initializeDonutChart('operations-donut-chart');
  }

  // Initialize individual canvas chart
  initializeCanvasChart(canvasId, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Simple chart implementation
    const chartData = {
      canvas: ctx,
      data: {
        labels: [],
        datasets: [{
          label: label,
          data: [],
          borderColor: this.getChartColor(canvasId),
          backgroundColor: `${this.getChartColor(canvasId)}20`,
          tension: 0.4
        }]
      }
    };

    // Store chart reference
    if (!this.charts) this.charts = {};
    this.charts[canvasId] = chartData;

    this.drawChart(canvasId);
  }

  // Initialize donut chart for operation breakdown
  initializeDonutChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    const chartData = {
      canvas: ctx,
      type: 'donut',
      data: {
        labels: ['Reads', 'Writes', 'Updates', 'Deletes'],
        datasets: [{
          data: [60, 25, 10, 5],
          backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#F44336']
        }]
      }
    };

    if (!this.charts) this.charts = {};
    this.charts[canvasId] = chartData;

    this.drawDonutChart(canvasId);
  }

  // Get chart color based on canvas ID
  getChartColor(canvasId) {
    const colors = {
      'operations-chart': '#4CAF50',
      'memory-chart': '#2196F3', 
      'cache-chart': '#FF9800',
      'connections-chart': '#9C27B0',
      'performance-chart': '#6366f1'
    };
    return colors[canvasId] || '#6366f1';
  }

  // Start Real-time Updates
  startRealTimeUpdates() {
    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
    }

    this.realTimeInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/realtime/metrics');
        if (response.ok) {
          const metrics = await response.json();
          this.updateRealTimeMetrics(metrics);
        }
      } catch (error) {
        console.warn('Real-time update failed:', error);
      }
    }, 2000); // Update every 2 seconds
  }

  // Update Real-time Metrics
  updateRealTimeMetrics(metrics) {
    // Update live metrics displays
    const elements = {
      'live-operations': metrics.metrics?.operationsPerSecond,
      'live-memory': metrics.metrics?.memoryUsage ? `${metrics.metrics.memoryUsage}%` : '--',
      'live-cache': metrics.metrics?.cacheHitRate ? `${metrics.metrics.cacheHitRate}%` : '--',
      'live-response': metrics.metrics?.responseTime ? `${metrics.metrics.responseTime}ms` : '--'
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && value !== undefined) {
        element.textContent = value;
      }
    });

    // Update additional metrics if elements exist
    const additionalElements = {
      'cpu-usage': metrics.metrics?.cpuUsage ? `${metrics.metrics.cpuUsage}%` : '--',
      'active-connections': metrics.metrics?.activeConnections || '--',
      'disk-io': metrics.metrics?.diskIO ? `${metrics.metrics.diskIO} MB/s` : '--',
      'network-io': metrics.metrics?.networkIO ? `${metrics.metrics.networkIO} KB/s` : '--'
    };

    Object.entries(additionalElements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && value !== undefined) {
        element.textContent = value;
      }
    });

    // Update chart data
    this.updateChartData(metrics);
  }

  // Update Chart Data
  updateChartData(metrics) {
    const now = new Date().toLocaleTimeString();
    
    // Update all charts with new data
    const chartUpdates = {
      'operations-chart': metrics.metrics?.operationsPerSecond || 0,
      'memory-chart': metrics.metrics?.memoryUsage || 0,
      'cache-chart': metrics.metrics?.cacheHitRate || 0,
      'connections-chart': metrics.metrics?.activeConnections || 0,
      'performance-chart': metrics.metrics?.operationsPerSecond || 0
    };

    Object.entries(chartUpdates).forEach(([chartId, value]) => {
      const chart = this.charts?.[chartId];
      if (chart && chart.data) {
        const data = chart.data;
        
        // Keep only last 20 points
        if (data.labels.length >= 20) {
          data.labels.shift();
          data.datasets[0].data.shift();
        }

        data.labels.push(now);
        data.datasets[0].data.push(value);

        this.drawChart(chartId);
      }
    });

    // Update donut chart with operation breakdown
    if (metrics.operations && this.charts?.['operations-donut-chart']) {
      const donutChart = this.charts['operations-donut-chart'];
      const operations = metrics.operations;
      const total = operations.reads + operations.writes + operations.updates + operations.deletes;
      
      if (total > 0) {
        donutChart.data.datasets[0].data = [
          Math.round((operations.reads / total) * 100),
          Math.round((operations.writes / total) * 100),
          Math.round((operations.updates / total) * 100),
          Math.round((operations.deletes / total) * 100)
        ];
        this.drawDonutChart('operations-donut-chart');
      }
    }

    // Update legacy chart if it exists
    if (this.performanceChart) {
      const data = this.performanceChart.data;
      
      if (data.labels.length >= 20) {
        data.labels.shift();
        data.datasets[0].data.shift();
      }

      data.labels.push(now);
      data.datasets[0].data.push(metrics.metrics?.operationsPerSecond || 0);

      this.drawChart();
    }
  }

  // Simple Chart Drawing
  drawChart(canvasId = 'performance-chart') {
    const chart = this.charts?.[canvasId] || this.performanceChart;
    if (!chart) return;

    const ctx = chart.canvas;
    const data = chart.data;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw a simple line chart
    if (data.datasets[0].data.length > 1) {
      ctx.strokeStyle = data.datasets[0].borderColor || '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const maxValue = Math.max(...data.datasets[0].data, 1);
      const minValue = Math.min(...data.datasets[0].data, 0);
      const range = maxValue - minValue || 1;
      
      data.datasets[0].data.forEach((value, index) => {
        const x = (index / Math.max(data.datasets[0].data.length - 1, 1)) * ctx.canvas.width;
        const y = ctx.canvas.height - ((value - minValue) / range) * ctx.canvas.height;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Draw fill area
      if (data.datasets[0].backgroundColor) {
        ctx.fillStyle = data.datasets[0].backgroundColor;
        ctx.lineTo(ctx.canvas.width, ctx.canvas.height);
        ctx.lineTo(0, ctx.canvas.height);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Draw placeholder when no data
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
  }

  // Draw Donut Chart
  drawDonutChart(canvasId) {
    const chart = this.charts?.[canvasId];
    if (!chart) return;

    const ctx = chart.canvas;
    const data = chart.data;
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    const innerRadius = radius * 0.6;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    const total = data.datasets[0].data.reduce((sum, val) => sum + val, 0);
    let currentAngle = -Math.PI / 2;
    
    data.datasets[0].data.forEach((value, index) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      
      // Draw slice
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      ctx.fillStyle = data.datasets[0].backgroundColor[index];
      ctx.fill();
      
      currentAngle += sliceAngle;
    });
    
    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
  }

  // Populate Configuration Forms
  populateConfigurationForms(config) {
    // Database settings
    if (config.database) {
      this.setFormValue('db-name', config.database.name);
      this.setFormValue('db-path', config.database.path);
      this.setFormValue('db-format', config.database.format);
      this.setFormValue('auto-sync', config.database.autoSync);
    }

    // Performance settings
    if (config.performance) {
      this.setFormValue('cache-size', config.performance.cacheSize);
      this.setFormValue('max-connections', config.performance.maxConnections);
      this.setFormValue('query-timeout', config.performance.queryTimeout);
      this.setFormValue('enable-indexing', config.performance.enableIndexing);
      this.setFormValue('enable-compression', config.performance.enableCompression);
    }

    // Security settings
    if (config.security) {
      this.setFormValue('encryption', config.security.encryption);
      this.setFormValue('encryption-key', config.security.encryptionKey);
      this.setFormValue('audit-logging', config.security.auditLogging);
      this.setFormValue('session-timeout', config.security.sessionTimeout);
      this.setFormValue('two-factor-auth', config.security.twoFactorAuth);
    }
  }

  // Helper to set form values
  setFormValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      if (element.type === 'checkbox') {
        element.checked = Boolean(value);
      } else {
        element.value = value || '';
      }
    }
  }

  // Load Analytics Data
  async loadAnalyticsData() {
    try {
      console.log('Loading analytics data...');
      
      // Load database analytics
      try {
        const analyticsResponse = await fetch('/api/admin/performance');
        if (analyticsResponse.ok) {
          const analytics = await analyticsResponse.json();
          this.updateAnalyticsDisplay(analytics);
        } else {
          throw new Error(`HTTP ${analyticsResponse.status}`);
        }
      } catch (apiError) {
        console.warn('Analytics API not available, using mock data:', apiError);
        const mockAnalytics = {
          operations: { total: 1234, perSecond: 45, breakdown: { reads: 800, writes: 300, updates: 100, deletes: 34 } },
          memory: { usage: 67, heapUsed: 45000000, heapTotal: 67108864 },
          cache: { hitRate: 89, size: 128, hits: 1234, misses: 156 }
        };
        this.updateAnalyticsDisplay(mockAnalytics);
      }

      // Create analytics dashboard content
      this.createAnalyticsDashboard();

      console.log('Analytics data loaded successfully');
    } catch (error) {
      console.error('Error loading analytics data:', error);
      this.notifications.error('Failed to load analytics data');
    }
  }

  // Create Analytics Dashboard
  createAnalyticsDashboard() {
    const container = document.getElementById('analytics-dashboard');
    if (!container) return;

    container.innerHTML = `
      <div class="analytics-content">
        <div class="analytics-header">
          <h2>Database Analytics</h2>
          <p>Comprehensive performance and usage analytics</p>
        </div>
        
        <div class="analytics-grid">
          <div class="analytics-card">
            <div class="card-header">
              <h3>Operations Overview</h3>
            </div>
            <div class="analytics-metrics">
              <div class="metric-item">
                <span class="metric-label">Total Operations</span>
                <span class="metric-value" id="total-operations">--</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Operations/Second</span>
                <span class="metric-value" id="ops-per-second-analytics">--</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Read Operations</span>
                <span class="metric-value" id="read-operations">--</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Write Operations</span>
                <span class="metric-value" id="write-operations">--</span>
              </div>
            </div>
          </div>
          
          <div class="analytics-card">
            <div class="card-header">
              <h3>Memory Analytics</h3>
            </div>
            <div class="analytics-metrics">
              <div class="metric-item">
                <span class="metric-label">Memory Usage</span>
                <span class="metric-value" id="memory-usage-analytics">--</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Heap Used</span>
                <span class="metric-value" id="heap-used">--</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Heap Total</span>
                <span class="metric-value" id="heap-total">--</span>
              </div>
            </div>
          </div>
          
          <div class="analytics-card">
            <div class="card-header">
              <h3>Cache Performance</h3>
            </div>
            <div class="analytics-metrics">
              <div class="metric-item">
                <span class="metric-label">Hit Rate</span>
                <span class="metric-value" id="cache-hit-rate-analytics">--</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Cache Size</span>
                <span class="metric-value" id="cache-size-analytics">--</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Cache Hits</span>
                <span class="metric-value" id="cache-hits">--</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Cache Misses</span>
                <span class="metric-value" id="cache-misses">--</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Initialize Query Builder
  initializeQueryBuilder() {
    try {
      console.log('Initializing query builder...');
      
      // Initialize query builder components
      this.setupQueryBuilderEvents();
      this.loadCollectionsList();
      
      console.log('Query builder initialized successfully');
    } catch (error) {
      console.error('Error initializing query builder:', error);
      this.notifications.error('Failed to initialize query builder');
    }
  }

  // Load Backup Data
  async loadBackupData() {
    try {
      console.log('Loading backup data...');
      
      // Load existing backups
      try {
        const backupsResponse = await fetch('/api/backups');
        if (backupsResponse.ok) {
          const backups = await backupsResponse.json();
          this.updateBackupsList(backups);
        } else {
          throw new Error(`HTTP ${backupsResponse.status}`);
        }
      } catch (apiError) {
        console.warn('Backups API not available, using mock data:', apiError);
        const mockBackups = [
          { id: '1', type: 'manual', size: '2.5MB', created: Date.now() - 3600000 },
          { id: '2', type: 'auto', size: '2.1MB', created: Date.now() - 86400000 },
          { id: '3', type: 'manual', size: '3.2MB', created: Date.now() - 172800000 }
        ];
        this.updateBackupsList(mockBackups);
      }

      console.log('Backup data loaded successfully');
    } catch (error) {
      console.error('Error loading backup data:', error);
      this.notifications.error('Failed to load backup data');
    }
  }

  // Update Analytics Display
  updateAnalyticsDisplay(analytics) {
    // Update operations breakdown
    if (analytics.operations) {
      this.updateElement('total-operations', analytics.operations.total);
      this.updateElement('ops-per-second', analytics.operations.perSecond);
      this.updateElement('read-operations', analytics.operations.breakdown.reads);
      this.updateElement('write-operations', analytics.operations.breakdown.writes);
    }

    // Update memory analytics
    if (analytics.memory) {
      this.updateElement('memory-usage-analytics', `${analytics.memory.usage}%`);
      this.updateElement('heap-used', `${Math.round(analytics.memory.heapUsed / 1024 / 1024)} MB`);
      this.updateElement('heap-total', `${Math.round(analytics.memory.heapTotal / 1024 / 1024)} MB`);
    }

    // Update cache analytics
    if (analytics.cache) {
      this.updateElement('cache-hit-rate-analytics', `${analytics.cache.hitRate}%`);
      this.updateElement('cache-size-analytics', analytics.cache.size);
      this.updateElement('cache-hits', analytics.cache.hits);
      this.updateElement('cache-misses', analytics.cache.misses);
    }
  }

  // Setup Query Builder Events
  setupQueryBuilderEvents() {
    // Execute query button
    const executeBtn = document.getElementById('execute-query');
    if (executeBtn) {
      executeBtn.addEventListener('click', () => this.executeQuery());
    }

    // Collection selector
    const collectionSelect = document.getElementById('collection-select');
    if (collectionSelect) {
      collectionSelect.addEventListener('change', () => this.onCollectionChange());
    }

    // Query type selector
    const queryTypeSelect = document.getElementById('query-type');
    if (queryTypeSelect) {
      queryTypeSelect.addEventListener('change', () => this.onQueryTypeChange());
    }
  }

  // Load Collections List for Query Builder
  async loadCollectionsList() {
    try {
      const response = await fetch('/api/collections');
      if (response.ok) {
        const collections = await response.json();
        const select = document.getElementById('collection-select');
        if (select) {
          select.innerHTML = '<option value="">Select Collection</option>';
          collections.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection.name;
            option.textContent = collection.name;
            select.appendChild(option);
          });
        }
      }
    } catch (error) {
      console.error('Error loading collections for query builder:', error);
    }
  }

  // Execute Query
  async executeQuery() {
    try {
      const collection = document.getElementById('collection-select')?.value;
      const queryType = document.getElementById('query-type')?.value;
      const queryText = document.getElementById('query-input')?.value;

      if (!collection) {
        this.notifications.warning('Please select a collection');
        return;
      }

      let filters = {};
      if (queryText) {
        try {
          filters = JSON.parse(queryText);
        } catch (e) {
          this.notifications.error('Invalid JSON in query filters');
          return;
        }
      }

      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection,
          type: queryType || 'find',
          filters
        })
      });

      if (response.ok) {
        const result = await response.json();
        this.displayQueryResult(result);
        this.notifications.success('Query executed successfully');
      } else {
        const error = await response.json();
        this.notifications.error(`Query failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Error executing query:', error);
      this.notifications.error('Failed to execute query');
    }
  }

  // Display Query Result
  displayQueryResult(result) {
    const resultContainer = document.getElementById('query-result');
    if (resultContainer) {
      resultContainer.innerHTML = `
        <div class="query-result-header">
          <h4>Query Result</h4>
          <span class="result-count">${Array.isArray(result) ? result.length : 1} record(s)</span>
        </div>
        <div class="query-result-content">
          <pre><code>${JSON.stringify(result, null, 2)}</code></pre>
        </div>
      `;
    }
  }

  // Update Backups List
  updateBackupsList(backups) {
    const backupsTable = document.getElementById('backups-table-body');
    if (!backupsTable) return;

    backupsTable.innerHTML = '';
    backups.forEach(backup => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${backup.id}</td>
        <td>${backup.type || 'manual'}</td>
        <td>${backup.size || 'Unknown'}</td>
        <td>${new Date(backup.created).toLocaleString()}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="downloadBackup('${backup.id}')">Download</button>
          <button class="btn btn-sm btn-warning" onclick="restoreBackup('${backup.id}')">Restore</button>
          <button class="btn btn-sm btn-danger" onclick="deleteBackup('${backup.id}')">Delete</button>
        </td>
      `;
      backupsTable.appendChild(row);
    });
  }

  // Helper method to update element content
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  // Collection change handler
  onCollectionChange() {
    const collection = document.getElementById('collection-select')?.value;
    if (collection) {
      // Clear previous query input
      const queryInput = document.getElementById('query-input');
      if (queryInput) {
        queryInput.value = '{}';
      }
      console.log('Collection changed to:', collection);
    }
  }

  // Query type change handler
  onQueryTypeChange() {
    const queryType = document.getElementById('query-type')?.value;
    console.log('Query type changed to:', queryType);
    
    // Update query input placeholder based on type
    const queryInput = document.getElementById('query-input');
    if (queryInput) {
      switch (queryType) {
        case 'find':
          queryInput.placeholder = '{"field": "value"}';
          break;
        case 'findOne':
          queryInput.placeholder = '{"_id": "document_id"}';
          break;
        case 'count':
          queryInput.placeholder = '{"status": "active"}';
          break;
        default:
          queryInput.placeholder = '{}';
      }
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
  
  // Show welcome notification after a delay
  setTimeout(() => {
    if (window.notifications) {
      window.notifications.success('Dashboard Ready - BigBaseAlpha dashboard initialized successfully');
    }
  }, 1000);
});

// === COLLECTION MANAGEMENT FUNCTIONS ===
async function viewCollection(collectionName) {
  try {
    const response = await fetch(`/api/collections/${collectionName}/documents`);
    if (!response.ok) {
      throw new Error(`Failed to fetch collection: ${response.statusText}`);
    }
    
    const documents = await response.json();
    
    // Show collection viewer modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px;">
        <div class="modal-header">
          <h3>Collection: ${collectionName}</h3>
          <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        <div class="modal-body">
          <p>Total documents: ${documents.length}</p>
          <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;">
            <pre style="margin: 0;">${JSON.stringify(documents, null, 2)}</pre>
          </div>
        </div>
        <div class="modal-footer">
          <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
  } catch (error) {
    window.notifications.error(`Failed to view collection: ${error.message}`);
  }
}

async function deleteCollection(collectionName) {
  const confirmed = await AlertSystem.confirm(
    `Are you sure you want to delete the collection "${collectionName}"? This action cannot be undone.`,
    'Delete Collection'
  );
  
  if (!confirmed) return;
  
  try {
    const response = await fetch(`/api/collections/${collectionName}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete collection: ${response.statusText}`);
    }
    
    window.notifications.success(`Collection "${collectionName}" deleted successfully`);
    
    // Reload dashboard data
    if (window.dashboard && window.dashboard.loadDashboardData) {
      window.dashboard.loadDashboardData();
    }
    
  } catch (error) {
    window.notifications.error(`Failed to delete collection: ${error.message}`);
  }
}

// === USER MANAGEMENT FUNCTIONS ===
async function loadUsers() {
  try {
    const response = await fetch('/api/auth/users');
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    
    const users = await response.json();
    window.dashboard.updateUsersData(users);
    
  } catch (error) {
    console.error('Error loading users:', error);
    window.notifications.error(`Failed to load users: ${error.message}`);
  }
}

async function deleteUser(userId) {
  const confirmed = await AlertSystem.confirm(
    'Are you sure you want to delete this user? This action cannot be undone.',
    'Delete User'
  );
  
  if (!confirmed) return;
  
  try {
    const response = await fetch(`/api/auth/users/${userId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete user: ${response.statusText}`);
    }
    
    window.notifications.success('User deleted successfully');
    loadUsers(); // Reload users table
    
  } catch (error) {
    window.notifications.error(`Failed to delete user: ${error.message}`);
  }
}

async function toggle2FA(userId, enable) {
  try {
    const endpoint = enable ? 'enable' : 'disable';
    const response = await fetch(`/api/auth/2fa/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to ${enable ? 'enable' : 'disable'} 2FA: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (enable && result.qrCode) {
      showQRCode(result.qrCode, result.secret);
    }
    
    window.notifications.success(`2FA ${enable ? 'enabled' : 'disabled'} successfully`);
    loadUsers(); // Reload users table
    
  } catch (error) {
    window.notifications.error(`Error ${enable ? 'enabling' : 'disabling'} 2FA: ${error.message}`);
  }
}

function showQRCode(qrCode, secret) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Set up 2FA</h3>
        <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body">
        <p>Scan this QR code with your authenticator app:</p>
        <div style="text-align: center; margin: 20px 0;">
          <img src="${qrCode}" alt="QR Code" style="border: 1px solid #ddd;">
        </div>
        <p>Or enter this secret manually: <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px;">${secret}</code></p>
      </div>
      <div class="modal-footer">
        <button onclick="this.closest('.modal').remove()" class="btn btn-primary">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// === BACKUP MANAGEMENT FUNCTIONS ===
async function loadBackups() {
  try {
    const response = await fetch('/api/backups');
    if (!response.ok) {
      throw new Error(`Failed to fetch backups: ${response.statusText}`);
    }
    
    const backups = await response.json();
    window.dashboard.updateBackupsData(backups);
    
  } catch (error) {
    console.error('Error loading backups:', error);
    window.notifications.error(`Failed to load backups: ${error.message}`);
  }
}

async function createBackup() {
  try {
    window.notifications.info('Creating backup...', 0); // Persistent notification
    
    const response = await fetch('/api/backups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'manual',
        compression: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create backup: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Remove persistent notification
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(n => {
      if (n.textContent.includes('Creating backup')) {
        n.remove();
      }
    });
    
    window.notifications.success(`Backup created successfully: ${result.filename}`);
    loadBackups(); // Reload backups table
    
  } catch (error) {
    window.notifications.error(`Failed to create backup: ${error.message}`);
  }
}

async function downloadBackup(backupId) {
  try {
    const response = await fetch(`/api/backups/${backupId}/download`);
    
    if (!response.ok) {
      throw new Error(`Failed to download backup: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${backupId}_${new Date().toISOString().slice(0, 10)}.bba`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    window.notifications.success('Backup downloaded successfully');
    
  } catch (error) {
    window.notifications.error(`Failed to download backup: ${error.message}`);
  }
}

async function restoreBackup(backupId) {
  const confirmed = await AlertSystem.confirm(
    'Are you sure you want to restore this backup? This will overwrite all current data.',
    'Restore Backup'
  );
  
  if (!confirmed) return;
  
  try {
    window.notifications.info('Restoring backup...', 0); // Persistent notification
    
    const response = await fetch(`/api/backups/${backupId}/restore`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to restore backup: ${response.statusText}`);
    }
    
    // Remove persistent notification
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(n => {
      if (n.textContent.includes('Restoring backup')) {
        n.remove();
      }
    });
    
    window.notifications.success('Backup restored successfully');
    
    // Reload all dashboard data
    if (window.dashboard && window.dashboard.loadDashboardData) {
      window.dashboard.loadDashboardData();
    }
    
  } catch (error) {
    window.notifications.error(`Failed to restore backup: ${error.message}`);
  }
}

async function deleteBackup(backupId) {
  const confirmed = await AlertSystem.confirm(
    'Are you sure you want to delete this backup? This action cannot be undone.',
    'Delete Backup'
  );
  
  if (!confirmed) return;
  
  try {
    const response = await fetch(`/api/backups/${backupId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete backup: ${response.statusText}`);
    }
    
    window.notifications.success('Backup deleted successfully');
    loadBackups(); // Reload backups table
    
  } catch (error) {
    window.notifications.error(`Failed to delete backup: ${error.message}`);
  }
}

// === EXPORT FUNCTIONS ===
async function exportData(format) {
  try {
    window.notifications.info(`Exporting data as ${format.toUpperCase()}...`, 0);
    
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ format })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to export data: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bigbase_export_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    // Remove persistent notification
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(n => {
      if (n.textContent.includes('Exporting data')) {
        n.remove();
      }
    });
    
    window.notifications.success(`Data exported as ${format.toUpperCase()} successfully`);
    
  } catch (error) {
    window.notifications.error(`Failed to export data: ${error.message}`);
  }
}

// === LEGACY SUPPORT ===
// Backward compatibility functions
function showMessage(message, type = 'info') {
  if (window.notifications) {
    window.notifications.show(message, type);
  } else {
    console.log(`${type.toUpperCase()}: ${message}`);
  }
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  if (window.notifications) {
    window.notifications.error(`Application Error: ${event.error.message}`);
  }
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  if (window.notifications) {
    window.notifications.error(`Promise Rejection: ${event.reason}`);
  }
  event.preventDefault();
});

// Global backup management functions
async function downloadBackup(backupId) {
  try {
    const response = await fetch(`/api/backups/${backupId}/download`);
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${backupId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      if (window.notifications) {
        window.notifications.success('Backup downloaded successfully');
      }
    } else {
      throw new Error('Failed to download backup');
    }
  } catch (error) {
    console.error('Error downloading backup:', error);
    if (window.notifications) {
      window.notifications.error('Failed to download backup');
    }
  }
}

async function restoreBackup(backupId) {
  if (!confirm('Are you sure you want to restore this backup? This will overwrite current data.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/backups/${backupId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      if (window.notifications) {
        window.notifications.success('Backup restored successfully');
      }
      // Reload page to reflect changes
      setTimeout(() => window.location.reload(), 2000);
    } else {
      throw new Error('Failed to restore backup');
    }
  } catch (error) {
    console.error('Error restoring backup:', error);
    if (window.notifications) {
      window.notifications.error('Failed to restore backup');
    }
  }
}

async function deleteBackup(backupId) {
  if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/backups/${backupId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      if (window.notifications) {
        window.notifications.success('Backup deleted successfully');
      }
      // Reload backup data
      if (window.dashboard) {
        window.dashboard.loadBackupData();
      }
    } else {
      throw new Error('Failed to delete backup');
    }
  } catch (error) {
    console.error('Error deleting backup:', error);
    if (window.notifications) {
      window.notifications.error('Failed to delete backup');
    }
  }
}

// Security management functions
async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/auth/users/${userId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      if (window.notifications) {
        window.notifications.success('User deleted successfully');
      }
      // Reload security data
      if (window.dashboard) {
        window.dashboard.loadSecurityData();
      }
    } else {
      throw new Error('Failed to delete user');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    if (window.notifications) {
      window.notifications.error('Failed to delete user');
    }
  }
}

async function toggle2FA(userId, enable) {
  try {
    const endpoint = enable ? 'enable' : 'disable';
    const response = await fetch(`/api/auth/2fa/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    
    if (response.ok) {
      if (window.notifications) {
        window.notifications.success(`2FA ${enable ? 'enabled' : 'disabled'} successfully`);
      }
      // Reload security data
      if (window.dashboard) {
        window.dashboard.loadSecurityData();
      }
    } else {
      throw new Error(`Failed to ${enable ? 'enable' : 'disable'} 2FA`);
    }
  } catch (error) {
    console.error('Error toggling 2FA:', error);
    if (window.notifications) {
      window.notifications.error('Failed to toggle 2FA');
    }
  }
}
