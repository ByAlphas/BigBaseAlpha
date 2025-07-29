/**
 * Real-time Charts Manager for BigBaseAlpha Dashboard
 * Handles live data visualization and performance monitoring
 */

class RealtimeChartsManager {
    constructor() {
        this.charts = {};
        this.eventSource = null;
        this.isPaused = false;
        this.updateInterval = null;
        this.maxDataPoints = 60; // Show last 60 data points
        this.dataHistory = {
            operations: [],
            memory: [],
            cache: [],
            cpu: [],
            connections: [],
            responseTime: []
        };
        
        this.init();
    }

    init() {
        this.initializeCharts();
        this.setupEventListeners();
        this.startRealTimeUpdates();
        this.loadHistoricalData();
    }

    initializeCharts() {
        // Chart.js default configuration
        Chart.defaults.color = '#cbd5e1';
        Chart.defaults.borderColor = '#475569';
        Chart.defaults.backgroundColor = 'rgba(99, 102, 241, 0.1)';

        // Operations per second chart
        this.charts.operations = new Chart(document.getElementById('operations-chart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Operations/sec',
                    data: [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: this.getLineChartOptions('Operations per Second')
        });

        // Memory usage chart
        this.charts.memory = new Chart(document.getElementById('memory-chart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Memory Usage %',
                    data: [],
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: this.getLineChartOptions('Memory Usage (%)', 0, 100)
        });

        // Cache hit rate chart
        this.charts.cache = new Chart(document.getElementById('cache-chart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Cache Hit Rate %',
                    data: [],
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: this.getLineChartOptions('Cache Hit Rate (%)', 0, 100)
        });

        // Multi-metric overview chart
        this.charts.overview = new Chart(document.getElementById('overview-chart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Operations/sec',
                        data: [],
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Memory %',
                        data: [],
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'CPU %',
                        data: [],
                        borderColor: '#FF9800',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Response Time (ms)',
                        data: [],
                        borderColor: '#E91E63',
                        backgroundColor: 'rgba(233, 30, 99, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y2'
                    }
                ]
            },
            options: this.getMultiAxisChartOptions()
        });

        // Operations donut chart
        this.charts.operationsDonut = new Chart(document.getElementById('operations-donut-chart'), {
            type: 'doughnut',
            data: {
                labels: ['Reads', 'Writes', 'Updates', 'Deletes'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        '#4CAF50',
                        '#2196F3',
                        '#FF9800',
                        '#E91E63'
                    ],
                    borderColor: [
                        '#4CAF50',
                        '#2196F3',
                        '#FF9800',
                        '#E91E63'
                    ],
                    borderWidth: 2
                }]
            },
            options: this.getDonutChartOptions()
        });

        // Connections chart
        this.charts.connections = new Chart(document.getElementById('connections-chart'), {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Active Connections',
                    data: [],
                    backgroundColor: 'rgba(156, 39, 176, 0.6)',
                    borderColor: '#9C27B0',
                    borderWidth: 2
                }]
            },
            options: this.getBarChartOptions('Active Connections')
        });
    }

    getLineChartOptions(title, min = null, max = null) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            },
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(71, 85, 105, 0.3)'
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        callback: function(value, index, values) {
                            const label = this.getLabelForValue(value);
                            return label ? new Date(label).toLocaleTimeString() : '';
                        }
                    }
                },
                y: {
                    display: true,
                    min: min,
                    max: max,
                    grid: {
                        color: 'rgba(71, 85, 105, 0.3)'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        };
    }

    getMultiAxisChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            },
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(71, 85, 105, 0.3)'
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        callback: function(value, index, values) {
                            const label = this.getLabelForValue(value);
                            return label ? new Date(label).toLocaleTimeString() : '';
                        }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Operations/sec'
                    },
                    grid: {
                        color: 'rgba(71, 85, 105, 0.3)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Percentage (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                y2: {
                    type: 'linear',
                    display: false,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Response Time (ms)'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        };
    }

    getDonutChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateRotate: true,
                duration: 1000
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        };
    }

    getBarChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            },
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(71, 85, 105, 0.3)'
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        callback: function(value, index, values) {
                            const label = this.getLabelForValue(value);
                            return label ? new Date(label).toLocaleTimeString() : '';
                        }
                    }
                },
                y: {
                    display: true,
                    grid: {
                        color: 'rgba(71, 85, 105, 0.3)'
                    }
                }
            }
        };
    }

    setupEventListeners() {
        // Pause/Resume button
        const pauseBtn = document.getElementById('pause-charts');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.togglePause();
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-charts');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }

        // Timeframe selector
        const timeframeSelect = document.getElementById('chart-timeframe');
        if (timeframeSelect) {
            timeframeSelect.addEventListener('change', (e) => {
                this.loadHistoricalData(parseInt(e.target.value));
            });
        }
    }

    startRealTimeUpdates() {
        // Use Server-Sent Events for real-time updates
        this.eventSource = new EventSource('/api/realtime/stream');
        
        this.eventSource.onmessage = (event) => {
            if (!this.isPaused) {
                const data = JSON.parse(event.data);
                this.updateCharts(data);
                this.updateLiveMetrics(data);
            }
        };

        this.eventSource.onerror = (error) => {
            console.error('EventSource failed:', error);
            this.showAlert('Connection lost. Attempting to reconnect...', 'warning');
            
            // Fallback to polling
            setTimeout(() => {
                if (this.eventSource.readyState === EventSource.CLOSED) {
                    this.startPolling();
                }
            }, 5000);
        };
    }

    startPolling() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(async () => {
            if (!this.isPaused) {
                try {
                    const response = await fetch('/api/realtime/metrics');
                    const data = await response.json();
                    this.updateCharts(data);
                    this.updateLiveMetrics(data);
                } catch (error) {
                    console.error('Failed to fetch metrics:', error);
                }
            }
        }, 2000);
    }

    updateCharts(data) {
        const timestamp = new Date(data.timestamp);
        const timeLabel = timestamp.toLocaleTimeString();

        // Update operations chart
        this.updateLineChart(this.charts.operations, timeLabel, data.metrics.operationsPerSecond);

        // Update memory chart
        this.updateLineChart(this.charts.memory, timeLabel, data.metrics.memoryUsage);

        // Update cache chart
        this.updateLineChart(this.charts.cache, timeLabel, data.metrics.cacheHitRate);

        // Update connections chart
        this.updateLineChart(this.charts.connections, timeLabel, data.metrics.activeConnections);

        // Update overview chart (multi-metric)
        this.updateMultiMetricChart(this.charts.overview, timeLabel, {
            operations: data.metrics.operationsPerSecond,
            memory: data.metrics.memoryUsage,
            cpu: data.metrics.cpuUsage,
            responseTime: data.metrics.responseTime
        });

        // Update operations donut chart
        if (data.operations) {
            this.updateDonutChart(this.charts.operationsDonut, [
                data.operations.reads,
                data.operations.writes,
                data.operations.updates,
                data.operations.deletes
            ]);
        }

        // Check for performance alerts
        this.checkPerformanceAlerts(data.metrics);
    }

    updateLineChart(chart, label, value) {
        chart.data.labels.push(label);
        chart.data.datasets[0].data.push(value);

        // Limit data points
        if (chart.data.labels.length > this.maxDataPoints) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        chart.update('none');
    }

    updateMultiMetricChart(chart, label, values) {
        chart.data.labels.push(label);
        chart.data.datasets[0].data.push(values.operations);
        chart.data.datasets[1].data.push(values.memory);
        chart.data.datasets[2].data.push(values.cpu);
        chart.data.datasets[3].data.push(values.responseTime);

        // Limit data points
        if (chart.data.labels.length > this.maxDataPoints) {
            chart.data.labels.shift();
            chart.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }

        chart.update('none');
    }

    updateDonutChart(chart, values) {
        chart.data.datasets[0].data = values;
        chart.update('none');
    }

    updateLiveMetrics(data) {
        // Update live metric displays
        this.updateMetricValue('live-ops', data.metrics.operationsPerSecond + ' ops/s');
        this.updateMetricValue('live-memory', data.metrics.memoryUsage + '%');
        this.updateMetricValue('live-cache', data.metrics.cacheHitRate.toFixed(1) + '%');
        this.updateMetricValue('live-response', data.metrics.responseTime + 'ms');
    }

    updateMetricValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
            
            // Add pulse effect
            element.style.transform = 'scale(1.05)';
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, 150);
        }
    }

    async loadHistoricalData(hours = 1) {
        try {
            const response = await fetch(`/api/realtime/history?hours=${hours}`);
            const history = await response.json();

            // Clear existing data
            Object.values(this.charts).forEach(chart => {
                if (chart.data.labels) {
                    chart.data.labels = [];
                    chart.data.datasets.forEach(dataset => {
                        dataset.data = [];
                    });
                }
            });

            // Populate with historical data
            history.forEach(point => {
                const timeLabel = new Date(point.timestamp).toLocaleTimeString();
                
                this.charts.operations.data.labels.push(timeLabel);
                this.charts.operations.data.datasets[0].data.push(point.operationsPerSecond);

                this.charts.memory.data.labels.push(timeLabel);
                this.charts.memory.data.datasets[0].data.push(point.memoryUsage);

                this.charts.cache.data.labels.push(timeLabel);
                this.charts.cache.data.datasets[0].data.push(point.cacheHitRate);

                this.charts.connections.data.labels.push(timeLabel);
                this.charts.connections.data.datasets[0].data.push(Math.floor(Math.random() * 5) + 1);

                // Overview chart
                this.charts.overview.data.labels.push(timeLabel);
                this.charts.overview.data.datasets[0].data.push(point.operationsPerSecond);
                this.charts.overview.data.datasets[1].data.push(point.memoryUsage);
                this.charts.overview.data.datasets[2].data.push(point.cpuUsage);
                this.charts.overview.data.datasets[3].data.push(point.responseTime);
            });

            // Update all charts
            Object.values(this.charts).forEach(chart => {
                chart.update();
            });

        } catch (error) {
            console.error('Failed to load historical data:', error);
            this.showAlert('Failed to load historical data', 'error');
        }
    }

    checkPerformanceAlerts(metrics) {
        const alerts = [];

        if (metrics.memoryUsage > 80) {
            alerts.push({
                type: 'warning',
                title: 'High Memory Usage',
                message: `Memory usage is at ${metrics.memoryUsage}%`,
                icon: '⚠️'
            });
        }

        if (metrics.cpuUsage > 70) {
            alerts.push({
                type: 'warning',
                title: 'High CPU Usage',
                message: `CPU usage is at ${metrics.cpuUsage.toFixed(1)}%`,
                icon: '🔥'
            });
        }

        if (metrics.responseTime > 100) {
            alerts.push({
                type: 'error',
                title: 'High Response Time',
                message: `Response time is ${metrics.responseTime}ms`,
                icon: '🐌'
            });
        }

        if (metrics.cacheHitRate < 50) {
            alerts.push({
                type: 'info',
                title: 'Low Cache Hit Rate',
                message: `Cache hit rate is ${metrics.cacheHitRate.toFixed(1)}%`,
                icon: 'ℹ️'
            });
        }

        this.updateAlerts(alerts);
    }

    updateAlerts(alerts) {
        const container = document.getElementById('performance-alerts');
        if (!container) return;

        // Clear existing alerts
        container.innerHTML = '';

        if (alerts.length === 0) {
            container.innerHTML = '<div class="alert alert-info"><div class="alert-content"><div class="alert-title">🟢 All Systems Normal</div><div class="alert-message">No performance issues detected</div></div></div>';
            return;
        }

        alerts.forEach(alert => {
            const alertElement = document.createElement('div');
            alertElement.className = `alert alert-${alert.type}`;
            alertElement.innerHTML = `
                <div class="alert-icon">${alert.icon}</div>
                <div class="alert-content">
                    <div class="alert-title">${alert.title}</div>
                    <div class="alert-message">${alert.message}</div>
                </div>
                <div class="alert-time">${new Date().toLocaleTimeString()}</div>
            `;
            container.appendChild(alertElement);
        });
    }

    showAlert(message, type = 'info') {
        // This could integrate with the main notification system
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause-charts');
        
        if (pauseBtn) {
            if (this.isPaused) {
                pauseBtn.innerHTML = '▶️ Resume';
                pauseBtn.classList.remove('btn-secondary');
                pauseBtn.classList.add('btn-primary');
            } else {
                pauseBtn.innerHTML = '⏸️ Pause';
                pauseBtn.classList.remove('btn-primary');
                pauseBtn.classList.add('btn-secondary');
            }
        }
    }

    refreshData() {
        const refreshBtn = document.getElementById('refresh-charts');
        if (refreshBtn) {
            refreshBtn.innerHTML = '🔄 Refreshing...';
            refreshBtn.disabled = true;
        }

        const timeframe = document.getElementById('chart-timeframe')?.value || 1;
        this.loadHistoricalData(parseInt(timeframe)).then(() => {
            if (refreshBtn) {
                refreshBtn.innerHTML = '🔄 Refresh';
                refreshBtn.disabled = false;
            }
        });
    }

    destroy() {
        if (this.eventSource) {
            this.eventSource.close();
        }
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Destroy all charts
        Object.values(this.charts).forEach(chart => {
            chart.destroy();
        });
    }
}

// Initialize the real-time charts when the tab becomes active
let realtimeChartsManager = null;

function initRealtimeCharts() {
    if (!realtimeChartsManager) {
        realtimeChartsManager = new RealtimeChartsManager();
    }
}

function destroyRealtimeCharts() {
    if (realtimeChartsManager) {
        realtimeChartsManager.destroy();
        realtimeChartsManager = null;
    }
}

// Export for use in main dashboard
window.RealtimeChartsManager = RealtimeChartsManager;
window.initRealtimeCharts = initRealtimeCharts;
window.destroyRealtimeCharts = destroyRealtimeCharts;
