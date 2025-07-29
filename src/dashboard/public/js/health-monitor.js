// System Health Monitor
class SystemHealthMonitor {
  constructor() {
    this.metrics = {
      cpu: 0,
      memory: 0,
      storage: 0,
      uptime: 0,
      activeConnections: 0,
      requestsPerSecond: 0
    };
    
    this.charts = {};
    this.isRunning = false;
    this.updateInterval = null;
  }

  init() {
    this.createHealthDashboard();
    this.setupCharts();
    this.start();
  }

  createHealthDashboard() {
    const container = document.getElementById('health-monitor');
    if (!container) return;

    container.innerHTML = `
      <div class="health-dashboard">
        <div class="health-header">
          <h3 class="health-title">System Health Monitor</h3>
          <div class="health-controls">
            <button class="btn btn-outline health-toggle" onclick="healthMonitor.toggle()">
              <span class="toggle-text">Stop</span>
            </button>
            <div class="health-status active">
              <span class="status-dot"></span>
              <span class="status-text">Monitoring</span>
            </div>
          </div>
        </div>

        <div class="health-metrics">
          <div class="metric-card">
            <div class="metric-header">
              <h4>CPU Usage</h4>
              <span class="metric-value" id="cpu-value">0%</span>
            </div>
            <div class="metric-chart">
              <canvas id="cpu-chart" width="300" height="100"></canvas>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <h4>Memory Usage</h4>
              <span class="metric-value" id="memory-value">0%</span>
            </div>
            <div class="metric-chart">
              <canvas id="memory-chart" width="300" height="100"></canvas>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <h4>Storage Usage</h4>
              <span class="metric-value" id="storage-value">0%</span>
            </div>
            <div class="metric-chart">
              <canvas id="storage-chart" width="300" height="100"></canvas>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <h4>Active Connections</h4>
              <span class="metric-value" id="connections-value">0</span>
            </div>
            <div class="metric-chart">
              <canvas id="connections-chart" width="300" height="100"></canvas>
            </div>
          </div>
        </div>

        <div class="health-details">
          <div class="detail-section">
            <h4>System Information</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Uptime:</span>
                <span class="detail-value" id="uptime-value">0h 0m</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Requests/sec:</span>
                <span class="detail-value" id="rps-value">0</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Database Size:</span>
                <span class="detail-value" id="db-size-value">0 MB</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Collections:</span>
                <span class="detail-value" id="collections-value">0</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4>Recent Alerts</h4>
            <div class="alerts-list" id="alerts-list">
              <div class="no-alerts">No recent alerts</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupHealthStyles();
  }

  setupHealthStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .health-dashboard {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-xl);
        padding: var(--space-xl);
        margin: var(--space-lg) 0;
      }

      .health-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-xl);
        padding-bottom: var(--space-lg);
        border-bottom: 1px solid var(--border-color);
      }

      .health-title {
        color: var(--text-primary);
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
      }

      .health-controls {
        display: flex;
        align-items: center;
        gap: var(--space-md);
      }

      .health-status {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--error);
        animation: pulse 2s infinite;
      }

      .health-status.active .status-dot {
        background: var(--success);
      }

      .status-text {
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: 500;
      }

      .health-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: var(--space-lg);
        margin-bottom: var(--space-xl);
      }

      .metric-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        transition: transform 0.2s ease;
      }

      .metric-card:hover {
        transform: translateY(-2px);
      }

      .metric-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-md);
      }

      .metric-header h4 {
        color: var(--text-primary);
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
      }

      .metric-value {
        color: var(--primary);
        font-size: 1.25rem;
        font-weight: 700;
      }

      .metric-chart {
        height: 100px;
        position: relative;
      }

      .health-details {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-xl);
      }

      .detail-section h4 {
        color: var(--text-primary);
        margin: 0 0 var(--space-md) 0;
        font-size: 1.125rem;
        font-weight: 600;
      }

      .detail-grid {
        display: grid;
        gap: var(--space-md);
      }

      .detail-item {
        display: flex;
        justify-content: space-between;
        padding: var(--space-sm) 0;
        border-bottom: 1px solid var(--border-color);
      }

      .detail-label {
        color: var(--text-secondary);
        font-size: 0.875rem;
      }

      .detail-value {
        color: var(--text-primary);
        font-size: 0.875rem;
        font-weight: 600;
      }

      .alerts-list {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: var(--space-md);
        max-height: 200px;
        overflow-y: auto;
      }

      .no-alerts {
        color: var(--text-muted);
        font-size: 0.875rem;
        text-align: center;
        padding: var(--space-md);
      }

      .alert-item {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm);
        border-radius: var(--radius-sm);
        margin-bottom: var(--space-sm);
        font-size: 0.875rem;
      }

      .alert-item.warning {
        background: rgba(251, 191, 36, 0.1);
        color: var(--warning);
      }

      .alert-item.error {
        background: rgba(239, 68, 68, 0.1);
        color: var(--error);
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      @media (max-width: 768px) {
        .health-metrics {
          grid-template-columns: 1fr;
        }
        
        .health-details {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  setupCharts() {
    const chartOptions = {
      type: 'line',
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { display: false },
          y: { 
            display: false,
            min: 0,
            max: 100
          }
        },
        elements: {
          point: { radius: 0 },
          line: { tension: 0.4 }
        },
        animation: { duration: 0 }
      }
    };

    // CPU Chart
    this.charts.cpu = new Chart(document.getElementById('cpu-chart'), {
      ...chartOptions,
      data: {
        labels: Array(20).fill(''),
        datasets: [{
          data: Array(20).fill(0),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true
        }]
      }
    });

    // Memory Chart
    this.charts.memory = new Chart(document.getElementById('memory-chart'), {
      ...chartOptions,
      data: {
        labels: Array(20).fill(''),
        datasets: [{
          data: Array(20).fill(0),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true
        }]
      }
    });

    // Storage Chart
    this.charts.storage = new Chart(document.getElementById('storage-chart'), {
      ...chartOptions,
      data: {
        labels: Array(20).fill(''),
        datasets: [{
          data: Array(20).fill(0),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true
        }]
      }
    });

    // Connections Chart
    this.charts.connections = new Chart(document.getElementById('connections-chart'), {
      ...chartOptions,
      options: {
        ...chartOptions.options,
        scales: {
          ...chartOptions.options.scales,
          y: { 
            display: false,
            min: 0,
            max: 50
          }
        }
      },
      data: {
        labels: Array(20).fill(''),
        datasets: [{
          data: Array(20).fill(0),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true
        }]
      }
    });
  }

  generateMockData() {
    // Simulate realistic system metrics
    this.metrics.cpu = Math.max(0, Math.min(100, this.metrics.cpu + (Math.random() - 0.5) * 10));
    this.metrics.memory = Math.max(0, Math.min(100, this.metrics.memory + (Math.random() - 0.5) * 5));
    this.metrics.storage = Math.max(0, Math.min(100, this.metrics.storage + (Math.random() - 0.5) * 2));
    this.metrics.activeConnections = Math.max(0, Math.floor(this.metrics.activeConnections + (Math.random() - 0.5) * 5));
    this.metrics.uptime += 1;
    this.metrics.requestsPerSecond = Math.max(0, Math.floor(Math.random() * 100));

    // Check for alerts
    this.checkAlerts();
  }

  checkAlerts() {
    const alerts = [];
    
    if (this.metrics.cpu > 80) {
      alerts.push({ type: 'warning', message: 'High CPU usage detected' });
    }
    
    if (this.metrics.memory > 85) {
      alerts.push({ type: 'error', message: 'Memory usage critical' });
    }
    
    if (this.metrics.storage > 90) {
      alerts.push({ type: 'error', message: 'Storage space running low' });
    }

    if (alerts.length > 0) {
      this.displayAlerts(alerts);
    }
  }

  displayAlerts(alerts) {
    const alertsList = document.getElementById('alerts-list');
    alertsList.innerHTML = '';
    
    alerts.forEach(alert => {
      const alertDiv = document.createElement('div');
      alertDiv.className = `alert-item ${alert.type}`;
      alertDiv.innerHTML = `
        <span>⚠</span>
        <span>${alert.message}</span>
        <span style="margin-left: auto; font-size: 0.75rem; opacity: 0.7;">
          ${new Date().toLocaleTimeString()}
        </span>
      `;
      alertsList.appendChild(alertDiv);
    });
  }

  updateDisplay() {
    // Update metric values
    document.getElementById('cpu-value').textContent = `${Math.round(this.metrics.cpu)}%`;
    document.getElementById('memory-value').textContent = `${Math.round(this.metrics.memory)}%`;
    document.getElementById('storage-value').textContent = `${Math.round(this.metrics.storage)}%`;
    document.getElementById('connections-value').textContent = this.metrics.activeConnections;
    
    // Update detail values
    const hours = Math.floor(this.metrics.uptime / 3600);
    const minutes = Math.floor((this.metrics.uptime % 3600) / 60);
    document.getElementById('uptime-value').textContent = `${hours}h ${minutes}m`;
    document.getElementById('rps-value').textContent = this.metrics.requestsPerSecond;
    document.getElementById('db-size-value').textContent = `${(Math.random() * 500 + 100).toFixed(1)} MB`;
    document.getElementById('collections-value').textContent = Math.floor(Math.random() * 10 + 5);

    // Update charts
    this.updateChart('cpu', this.metrics.cpu);
    this.updateChart('memory', this.metrics.memory);
    this.updateChart('storage', this.metrics.storage);
    this.updateChart('connections', this.metrics.activeConnections);
  }

  updateChart(chartName, value) {
    const chart = this.charts[chartName];
    if (!chart) return;

    const data = chart.data.datasets[0].data;
    data.shift();
    data.push(value);
    chart.update('none');
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    document.querySelector('.health-status').classList.add('active');
    document.querySelector('.toggle-text').textContent = 'Stop';
    
    this.updateInterval = setInterval(() => {
      this.generateMockData();
      this.updateDisplay();
    }, 1000);
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    document.querySelector('.health-status').classList.remove('active');
    document.querySelector('.toggle-text').textContent = 'Start';
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  toggle() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }
}

// Initialize health monitor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('health-monitor')) {
    window.healthMonitor = new SystemHealthMonitor();
    healthMonitor.init();
  }
});
