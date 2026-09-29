const fs = require('fs');
const path = require('path');
function walk(dir) { let r = []; for (let f of fs.readdirSync(dir)) { let p = path.join(dir, f); if (fs.statSync(p).isDirectory()) r = r.concat(walk(p)); else if (p.endsWith('.js') || p.endsWith('.jsx')) r.push(p); } return r; }

for (const file of walk('src')) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  if (content.includes('???')) { content = content.replace(/???/g, '?'); changed = true; }
  if (content.includes('???')) { content = content.replace(/???/g, '?'); changed = true; }
  if (content.includes('??')) { content = content.replace(/??/g, '?'); changed = true; }
  if (content.includes('??')) { content = content.replace(/??/g, '?'); changed = true; }
  
  // Specific fix for SecondaryBerth.jsx
  if (content.includes("{t('window.closeEditor')} o ")) {
    content = content.replace(/\{t\('window\.closeEditor'\)\} \?o /g, "{t('window.closeEditor')} ?");
    changed = true;
  }
  if (content.includes("{t('window.closeEditor')} o ")) {
    content = content.replace(/\{t\('window\.closeEditor'\)\} o /g, "{t('window.closeEditor')} ?");
    changed = true;
  }
  // Some powershell corruptions turn it into literal ?
  if (content.includes("{t('window.closeEditor')} ?")) {
    content = content.replace(/\{t\('window\.closeEditor'\)\} \?/g, "{t('window.closeEditor')} ?");
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
}
