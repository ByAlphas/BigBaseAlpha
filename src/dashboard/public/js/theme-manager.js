// Enhanced Theme Manager for BigBaseAlpha Dashboard
class ThemeManager {
  constructor() {
    this.currentTheme = this.getStoredTheme() || 'dark';
    this.systemTheme = this.getSystemTheme();
    this.init();
  }

  init() {
    this.setupThemeOptions();
    this.applyTheme(this.currentTheme);
    this.setupSystemThemeListener();
    this.updateActiveThemeButton();
  }

  setupThemeOptions() {
    const themeOptions = document.querySelectorAll('.theme-option');
    
    themeOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const theme = option.dataset.theme;
        if (theme && theme !== this.currentTheme) {
          this.setTheme(theme);
        }
      });
    });
  }

  setTheme(theme) {
    this.currentTheme = theme;
    this.applyTheme(theme);
    this.saveTheme(theme);
    this.updateActiveThemeButton();
    this.triggerThemeChange(theme);
  }

  applyTheme(theme) {
    const html = document.documentElement;
    
    // Remove all theme classes
    html.classList.remove('theme-dark', 'theme-light', 'theme-auto');
    html.removeAttribute('data-theme');
    
    // Apply new theme
    if (theme === 'auto') {
      html.setAttribute('data-theme', 'auto');
      this.applySystemTheme();
    } else {
      html.setAttribute('data-theme', theme);
      html.classList.add(`theme-${theme}`);
    }
    
    // Update charts if they exist
    this.updateChartsTheme();
  }

  applySystemTheme() {
    const systemTheme = this.getSystemTheme();
    const html = document.documentElement;
    html.classList.add(`theme-${systemTheme}`);
  }

  getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  setupSystemThemeListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      this.systemTheme = e.matches ? 'dark' : 'light';
      if (this.currentTheme === 'auto') {
        this.applySystemTheme();
        this.updateChartsTheme();
      }
    });
  }

  updateActiveThemeButton() {
    const themeOptions = document.querySelectorAll('.theme-option');
    
    themeOptions.forEach(option => {
      option.classList.remove('active');
      if (option.dataset.theme === this.currentTheme) {
        option.classList.add('active');
      }
    });
  }

  saveTheme(theme) {
    try {
      localStorage.setItem('bigbase-theme', theme);
    } catch (e) {
      console.warn('Could not save theme preference:', e);
    }
  }

  getStoredTheme() {
    try {
      return localStorage.getItem('bigbase-theme');
    } catch (e) {
      console.warn('Could not get stored theme:', e);
      return null;
    }
  }

  updateChartsTheme() {
    // Update Chart.js themes if they exist
    if (window.dashboard && window.dashboard.charts) {
      Object.values(window.dashboard.charts).forEach(chart => {
        if (chart && chart.update) {
          try {
            chart.update('none');
          } catch (e) {
            console.warn('Could not update chart theme:', e);
          }
        }
      });
    }
  }

  triggerThemeChange(theme) {
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme, effectiveTheme: this.getEffectiveTheme() }
    }));
  }

  getEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      return this.systemTheme;
    }
    return this.currentTheme;
  }

  // Public API
  getCurrentTheme() {
    return this.currentTheme;
  }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.themeManager = new ThemeManager();
});
