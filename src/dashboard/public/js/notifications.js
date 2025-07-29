// Advanced Notification System
class NotificationManager {
  constructor() {
    this.notifications = [];
    this.container = this.createContainer();
    this.setupStyles();
  }

  createContainer() {
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
    return container;
  }

  setupStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 400px;
      }

      .notification {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-xl);
        padding: var(--space-lg);
        box-shadow: var(--shadow-xl);
        transform: translateX(400px);
        animation: slideIn 0.3s ease-out forwards;
        position: relative;
        overflow: hidden;
      }

      .notification::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
      }

      .notification.success::before { background: var(--success); }
      .notification.error::before { background: var(--error); }
      .notification.warning::before { background: var(--warning); }
      .notification.info::before { background: var(--info); }

      .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .notification-title {
        font-weight: 600;
        color: var(--text-primary);
        font-size: 0.9rem;
      }

      .notification-close {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .notification-message {
        color: var(--text-secondary);
        font-size: 0.875rem;
        line-height: 1.4;
      }

      .notification-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: var(--primary);
        animation: progress linear;
      }

      @keyframes slideIn {
        to { transform: translateX(0); }
      }

      @keyframes slideOut {
        to { transform: translateX(400px); }
      }

      @keyframes progress {
        from { width: 100%; }
        to { width: 0%; }
      }
    `;
    document.head.appendChild(style);
  }

  show(type, title, message, duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
      <div class="notification-header">
        <div class="notification-title">${title}</div>
        <button class="notification-close" onclick="notificationManager.remove(this.parentElement.parentElement)">&times;</button>
      </div>
      <div class="notification-message">${message}</div>
      <div class="notification-progress" style="animation-duration: ${duration}ms"></div>
    `;

    this.container.appendChild(notification);
    this.notifications.push(notification);

    // Auto remove
    setTimeout(() => {
      this.remove(notification);
    }, duration);

    return notification;
  }

  success(title, message) {
    return this.show('success', title, message);
  }

  error(title, message) {
    return this.show('error', title, message, 8000);
  }

  warning(title, message) {
    return this.show('warning', title, message);
  }

  info(title, message) {
    return this.show('info', title, message);
  }

  remove(notification) {
    notification.style.animation = 'slideOut 0.3s ease-out forwards';
    setTimeout(() => {
      if (notification.parentElement) {
        notification.parentElement.removeChild(notification);
      }
      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
    }, 300);
  }

  clear() {
    this.notifications.forEach(notification => this.remove(notification));
  }
}

// Initialize notification manager
window.notificationManager = new NotificationManager();
