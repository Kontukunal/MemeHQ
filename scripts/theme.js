// Theme configuration
const themes = {
  dark: {
    '--background': '#1a1a1a',
    '--darker': '#242424',
    '--light': '#ffffff',
    '--gray': '#888888',
    '--primary': '#00CEC9',
    '--primary-dark': '#00A6A3',
    '--accent': '#FD79A8',
    '--accent-dark': '#E84981',
    '--success': '#00b894',
    '--error': '#d63031',
    '--warning': '#fdcb6e',
    '--shadow-sm': '0 2px 4px rgba(0, 0, 0, 0.32)',
    '--shadow-md': '0 4px 6px rgba(0, 0, 0, 0.4)',
    '--shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.5)',
    '--shadow-xl': '0 20px 25px rgba(0, 0, 0, 0.6)',
    '--text-primary': '#ffffff',
    '--text-secondary': '#cccccc',
    '--border-color': 'rgba(255, 255, 255, 0.1)',
    '--card-bg': '#2d2d2d',
    '--hover-bg': 'rgba(255, 255, 255, 0.1)',
  },
  light: {
    '--background': '#f5f5f5',
    '--darker': '#ffffff',
    '--light': '#2d2d2d',
    '--gray': '#666666',
    '--primary': '#00A6A3',
    '--primary-dark': '#008F8C',
    '--accent': '#E84981',
    '--accent-dark': '#D4256D',
    '--success': '#00b894',
    '--error': '#d63031',
    '--warning': '#fdcb6e',
    '--shadow-sm': '0 2px 4px rgba(0, 0, 0, 0.1)',
    '--shadow-md': '0 4px 6px rgba(0, 0, 0, 0.1)',
    '--shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
    '--shadow-xl': '0 20px 25px rgba(0, 0, 0, 0.1)',
    '--text-primary': '#2d2d2d',
    '--text-secondary': '#4a4a4a',
    '--border-color': 'rgba(0, 0, 0, 0.1)',
    '--card-bg': '#ffffff',
    '--hover-bg': 'rgba(0, 0, 0, 0.05)',
  }
};

// Get the current theme from localStorage or system preference
function getInitialTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    return savedTheme;
  }
  
  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  
  return 'light';
}

// Apply theme to document
function applyTheme(theme) {
  const root = document.documentElement;
  const themeColors = themes[theme];
  
  Object.entries(themeColors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
  
  // Update theme class on body
  document.body.classList.remove('theme-light', 'theme-dark');
  document.body.classList.add(`theme-${theme}`);
  
  // Store theme preference
  localStorage.setItem('theme', theme);
  
  // Update toggle button icon if it exists
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

// Toggle between themes
function toggleTheme() {
  const currentTheme = localStorage.getItem('theme') || getInitialTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

// Initialize theme
function initTheme() {
  const initialTheme = getInitialTheme();
  applyTheme(initialTheme);
  
  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

export { initTheme, toggleTheme }; 