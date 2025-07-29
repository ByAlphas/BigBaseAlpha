// Real-time Analytics for BigBaseAlpha Dashboard
class AnalyticsManager {
  constructor() {
    this.metrics = new Map();
    this.charts = new Map();
    this.updateInterval = 5000; // 5 seconds
  }

  startRealTimeMonitoring() {
    setInterval(() => {
      this.updateMetrics();
      this.updateCharts();
    }, this.updateInterval);
  }

  async updateMetrics() {
    try {
      const response = await fetch('/api/analytics/realtime');
      const data = await response.json();
      
      this.updateOperationsPerSecond(data.opsPerSecond);
      this.updateActiveConnections(data.activeConnections);
      this.updateMemoryUsage(data.memoryUsage);
      this.updateQueryPerformance(data.queryPerformance);
    } catch (error) {
      console.error('Analytics update failed:', error);
    }
  }

  updateOperationsPerSecond(ops) {
    const element = document.getElementById('ops-per-second');
    if (element) {
      element.textContent = ops.toLocaleString();
      this.animateValue(element, ops);
    }
  }

  animateValue(element, value) {
    element.style.transform = 'scale(1.1)';
    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, 200);
  }

  createPerformanceChart() {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Operations/sec',
          data: [],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}

// Global instance for dashboard
window.AnalyticsManager = AnalyticsManager;
