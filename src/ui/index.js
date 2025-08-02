import colors from 'colors';
import os from 'os';
import fs from 'fs';
import { performance } from 'perf_hooks';

/**
 * BigBaseAlpha Terminal UI Framework
 * Rich terminal components with colors integration for enhanced developer experience
 */
class TerminalUI {
    constructor(options = {}) {
        this.options = {
            theme: 'default',
            colors: true,
            animation: true,
            refreshRate: 1000,
            ...options
        };
        
        this.monitors = new Map();
        this.components = new Map();
        this.isMonitoring = false;
    }

    /**
     * Create various UI components
     * @param {Object} config - Component configuration
     * @returns {Object} Component instance
     */
    createComponent(config) {
        const { type, data, options = {} } = config;
        
        switch (type) {
            case 'chart':
                return this.createChart(data, options);
            case 'table':
                return this.createTable(data, options);
            case 'log':
                return this.createLogMonitor(data, options);
            case 'progress':
                return this.createProgressBar(data, options);
            default:
                throw new Error(`Unknown component type: ${type}`);
        }
    }

    /**
     * ASCII Bar Chart
     * @param {Array} data - Chart data
     * @param {Object} options - Chart options
     */
    createChart(data, options = {}) {
        const { title = 'Chart', width = 50, color = 'cyan' } = options;
        
        if (data.type === 'bar') {
            return this.createBarChart(data.values, { title, width, color });
        } else if (data.type === 'line') {
            return this.createLineChart(data.values, { title, width, color });
        } else if (data.type === 'pie') {
            return this.createPieChart(data.values, { title, color });
        }
    }

    /**
     * ASCII Bar Chart Implementation
     */
    createBarChart(data, options) {
        const { title, width, color } = options;
        const maxValue = Math.max(...data.map(d => d.value));
        
        let output = `\n${colors[color](title)}\n`;
        output += colors.gray('─'.repeat(width + 20)) + '\n';
        
        data.forEach(item => {
            const barLength = Math.round((item.value / maxValue) * width);
            const bar = '█'.repeat(barLength);
            const label = item.label.padEnd(15);
            const value = item.value.toString().padStart(8);
            
            output += `${colors.white(label)} ${colors[color](bar)} ${colors.yellow(value)}\n`;
        });
        
        return {
            render: () => console.log(output),
            update: (newData) => this.createBarChart(newData, options),
            data: output
        };
    }

    /**
     * ASCII Line Chart Implementation
     */
    createLineChart(data, options) {
        const { title, width, color } = options;
        const height = 10;
        const maxValue = Math.max(...data);
        const minValue = Math.min(...data);
        const range = maxValue - minValue || 1;
        
        let output = `\n${colors[color](title)}\n`;
        
        // Create grid
        for (let y = height; y >= 0; y--) {
            let line = '';
            const currentValue = minValue + (range * y / height);
            
            for (let x = 0; x < Math.min(data.length, width); x++) {
                const dataValue = data[x];
                const normalizedValue = (dataValue - minValue) / range * height;
                
                if (Math.abs(normalizedValue - y) < 0.5) {
                    line += colors[color]('●');
                } else {
                    line += colors.gray('·');
                }
            }
            
            output += `${currentValue.toFixed(1).padStart(6)} │${line}\n`;
        }
        
        output += '       └' + '─'.repeat(width) + '\n';
        
        return {
            render: () => console.log(output),
            update: (newData) => this.createLineChart(newData, options),
            data: output
        };
    }

    /**
     * ASCII Pie Chart Implementation
     */
    createPieChart(data, options) {
        const { title, color } = options;
        const total = data.reduce((sum, item) => sum + item.value, 0);
        
        let output = `\n${colors[color](title)}\n`;
        output += colors.gray('─'.repeat(30)) + '\n';
        
        const symbols = ['█', '▓', '▒', '░', '▪', '▫', '●', '○'];
        
        data.forEach((item, index) => {
            const percentage = ((item.value / total) * 100).toFixed(1);
            const symbol = symbols[index % symbols.length];
            const bar = symbol.repeat(Math.round(percentage / 5));
            
            output += `${colors.white(item.label.padEnd(15))} `;
            output += `${colors[color](bar.padEnd(20))} `;
            output += `${colors.yellow(percentage + '%')}\n`;
        });
        
        return {
            render: () => console.log(output),
            update: (newData) => this.createPieChart(newData, options),
            data: output
        };
    }

    /**
     * Dynamic Data Table
     */
    createTable(data, options = {}) {
        const { title = 'Table', sortBy, filterBy, maxRows = 20 } = options;
        
        if (!Array.isArray(data) || data.length === 0) {
            return { render: () => console.log('No data available') };
        }
        
        let processedData = [...data];
        
        // Apply filter
        if (filterBy) {
            processedData = processedData.filter(row => 
                Object.values(row).some(value => 
                    String(value).toLowerCase().includes(filterBy.toLowerCase())
                )
            );
        }
        
        // Apply sort
        if (sortBy) {
            processedData.sort((a, b) => {
                if (a[sortBy] < b[sortBy]) return -1;
                if (a[sortBy] > b[sortBy]) return 1;
                return 0;
            });
        }
        
        // Limit rows
        processedData = processedData.slice(0, maxRows);
        
        const headers = Object.keys(data[0]);
        const colWidths = headers.map(header => 
            Math.max(header.length, ...processedData.map(row => String(row[header] || '').length))
        );
        
        let output = `\n${colors.cyan(title)}\n`;
        
        // Header
        const headerRow = headers.map((header, i) => 
            colors.yellow(header.padEnd(colWidths[i]))
        ).join(' │ ');
        output += `│ ${headerRow} │\n`;
        
        // Separator
        const separator = colWidths.map(width => '─'.repeat(width)).join('─┼─');
        output += `├─${separator}─┤\n`;
        
        // Data rows
        processedData.forEach(row => {
            const dataRow = headers.map((header, i) => 
                String(row[header] || '').padEnd(colWidths[i])
            ).join(' │ ');
            output += `│ ${colors.white(dataRow)} │\n`;
        });
        
        output += `└─${separator}─┘\n`;
        
        return {
            render: () => console.log(output),
            update: (newData, newOptions) => this.createTable(newData, { ...options, ...newOptions }),
            data: output,
            sort: (column) => this.createTable(data, { ...options, sortBy: column }),
            filter: (term) => this.createTable(data, { ...options, filterBy: term })
        };
    }

    /**
     * Real-time Log Monitor
     */
    createLogMonitor(logSource, options = {}) {
        const { title = 'Logs', maxLines = 50, levels = ['info', 'warn', 'error'] } = options;
        
        let logs = [];
        
        const levelColors = {
            info: 'cyan',
            warn: 'yellow',
            error: 'red',
            debug: 'gray',
            success: 'green'
        };
        
        const addLog = (level, message) => {
            if (!levels.includes(level)) return;
            
            const timestamp = new Date().toISOString().substr(11, 8);
            logs.push({ timestamp, level, message });
            
            if (logs.length > maxLines) {
                logs = logs.slice(-maxLines);
            }
            
            this.renderLogs();
        };
        
        const renderLogs = () => {
            console.clear();
            console.log(colors.cyan(title));
            console.log(colors.gray('─'.repeat(80)));
            
            logs.forEach(log => {
                const color = levelColors[log.level] || 'white';
                const levelTag = `[${log.level.toUpperCase()}]`.padEnd(7);
                console.log(
                    `${colors.gray(log.timestamp)} ${colors[color](levelTag)} ${log.message}`
                );
            });
        };
        
        return {
            render: renderLogs,
            addLog,
            clear: () => { logs = []; renderLogs(); },
            export: () => logs
        };
    }

    /**
     * Progress Bar Component
     */
    createProgressBar(current, options = {}) {
        const { total = 100, width = 40, color = 'green', showPercent = true } = options;
        const percentage = Math.min(100, (current / total) * 100);
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        
        const bar = colors[color]('█'.repeat(filled)) + colors.gray('░'.repeat(empty));
        const percent = showPercent ? ` ${percentage.toFixed(1)}%` : '';
        
        return {
            render: () => process.stdout.write(`\r[${bar}]${percent}`),
            update: (newCurrent) => this.createProgressBar(newCurrent, { total, width, color, showPercent }),
            complete: () => console.log(colors.green('\n✓ Complete!'))
        };
    }

    /**
     * System Performance Monitor
     */
    monitor(type, options = {}) {
        const { duration = 0, interval = 1000 } = options;
        
        switch (type) {
            case 'cpu':
                return this.monitorCPU(duration, interval);
            case 'memory':
                return this.monitorMemory(duration, interval);
            case 'disk':
                return this.monitorDisk(duration, interval);
            case 'all':
                return this.monitorAll(duration, interval);
            default:
                throw new Error(`Unknown monitor type: ${type}`);
        }
    }

    /**
     * CPU Monitoring
     */
    monitorCPU(duration, interval) {
        let cpuData = [];
        const startTime = Date.now();
        
        const getCPUUsage = () => {
            const cpus = os.cpus();
            const usage = cpus.map(cpu => {
                const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
                const idle = cpu.times.idle;
                return ((total - idle) / total * 100).toFixed(1);
            });
            
            const avgUsage = (usage.reduce((acc, val) => acc + parseFloat(val), 0) / usage.length).toFixed(1);
            return { individual: usage, average: parseFloat(avgUsage) };
        };
        
        const monitorId = setInterval(() => {
            const cpuUsage = getCPUUsage();
            cpuData.push(cpuUsage.average);
            
            if (cpuData.length > 50) cpuData.shift();
            
            // Create live chart
            const chart = this.createChart({
                type: 'line',
                values: cpuData
            }, {
                title: `CPU Usage (${cpuUsage.average}%)`,
                color: cpuUsage.average > 80 ? 'red' : cpuUsage.average > 50 ? 'yellow' : 'green'
            });
            
            console.clear();
            chart.render();
            
            console.log(colors.gray(`Cores: ${cpuUsage.individual.join('%, ')}%`));
            console.log(colors.gray(`Uptime: ${(Date.now() - startTime) / 1000}s`));
            
            if (duration > 0 && Date.now() - startTime >= duration) {
                clearInterval(monitorId);
            }
        }, interval);
        
        this.monitors.set('cpu', monitorId);
        return { stop: () => clearInterval(monitorId), data: cpuData };
    }

    /**
     * Memory Monitoring
     */
    monitorMemory(duration, interval) {
        let memData = [];
        const startTime = Date.now();
        
        const monitorId = setInterval(() => {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const usagePercent = (usedMem / totalMem * 100).toFixed(1);
            
            memData.push(parseFloat(usagePercent));
            if (memData.length > 50) memData.shift();
            
            const chart = this.createChart({
                type: 'line',
                values: memData
            }, {
                title: `Memory Usage (${usagePercent}%)`,
                color: usagePercent > 80 ? 'red' : usagePercent > 60 ? 'yellow' : 'green'
            });
            
            console.clear();
            chart.render();
            
            console.log(colors.gray(`Total: ${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`));
            console.log(colors.gray(`Used: ${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB`));
            console.log(colors.gray(`Free: ${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`));
            
            if (duration > 0 && Date.now() - startTime >= duration) {
                clearInterval(monitorId);
            }
        }, interval);
        
        this.monitors.set('memory', monitorId);
        return { stop: () => clearInterval(monitorId), data: memData };
    }

    /**
     * Disk I/O Monitoring (simulated)
     */
    monitorDisk(duration, interval) {
        let diskData = [];
        const startTime = Date.now();
        
        const monitorId = setInterval(async () => {
            try {
                const stats = fs.statSync('.');
                const ioActivity = Math.random() * 100; // Simulated I/O activity
                
                diskData.push(ioActivity);
                if (diskData.length > 50) diskData.shift();
                
                const chart = this.createChart({
                    type: 'line',
                    values: diskData
                }, {
                    title: `Disk I/O Activity (${ioActivity.toFixed(1)}%)`,
                    color: ioActivity > 80 ? 'red' : ioActivity > 50 ? 'yellow' : 'green'
                });
                
                console.clear();
                chart.render();
                
                console.log(colors.gray(`Last Modified: ${stats.mtime.toISOString()}`));
                console.log(colors.gray(`Monitoring Time: ${(Date.now() - startTime) / 1000}s`));
                
                if (duration > 0 && Date.now() - startTime >= duration) {
                    clearInterval(monitorId);
                }
            } catch (error) {
                console.error(colors.red('Disk monitoring error:', error.message));
            }
        }, interval);
        
        this.monitors.set('disk', monitorId);
        return { stop: () => clearInterval(monitorId), data: diskData };
    }

    /**
     * Combined System Monitoring
     */
    monitorAll(duration, interval) {
        const monitors = {
            cpu: this.monitorCPU(duration, interval * 3),
            memory: this.monitorMemory(duration, interval * 3),
            disk: this.monitorDisk(duration, interval * 3)
        };
        
        return {
            stop: () => Object.values(monitors).forEach(monitor => monitor.stop()),
            monitors
        };
    }

    /**
     * Stop all monitors
     */
    stopAllMonitors() {
        this.monitors.forEach(monitorId => clearInterval(monitorId));
        this.monitors.clear();
    }

    /**
     * Create dashboard with multiple components
     */
    createDashboard(components) {
        console.clear();
        console.log(colors.rainbow('BigBaseAlpha Dashboard'));
        console.log(colors.gray('═'.repeat(80)));
        
        components.forEach(component => {
            if (component && component.render) {
                component.render();
            }
        });
    }
}

export default TerminalUI;
