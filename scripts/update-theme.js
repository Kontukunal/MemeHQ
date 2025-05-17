const fs = require('fs');
const path = require('path');

// List of HTML files to update
const htmlFiles = [
  'index.html',
  'create.html',
  'login.html',
  'analytics.html',
  'badges.html',
  'leaderboard.html'
];

// Theme toggle button HTML
const themeToggleButton = `
        <!-- Theme Toggle -->
        <button id="themeToggle" class="theme-toggle" title="Toggle theme">
          <i class="fas fa-moon"></i>
        </button>
`;

// Theme initialization script
const themeScript = `
    <script type="module">
      import { initTheme, toggleTheme } from './scripts/theme.js';
      
      // Initialize theme system
      initTheme();
      
      // Set up theme toggle
      const themeToggle = document.getElementById('themeToggle');
      themeToggle.addEventListener('click', toggleTheme);
    </script>
`;

// Process each HTML file
htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add theme toggle button before user profile
    if (!content.includes('id="themeToggle"')) {
      content = content.replace(
        '<div class="user-profile">',
        `${themeToggleButton}\n        <div class="user-profile">`
      );
    }
    
    // Add theme initialization script before closing body tag
    if (!content.includes('initTheme')) {
      content = content.replace(
        '</body>',
        `${themeScript}\n  </body>`
      );
    }
    
    // Update font weights in Poppins import if needed
    content = content.replace(
      /Poppins:wght@[^&]+/,
      'Poppins:wght@400;500;600;700'
    );
    
    // Write updated content back to file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated ${file}`);
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠ Skipped ${file} (file not found)`);
    } else {
      console.error(`✗ Error processing ${file}:`, error);
    }
  }
}); 