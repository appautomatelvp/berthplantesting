const fs = require('fs');
const path = require('path');
function walk(dir) { let r = []; for (let f of fs.readdirSync(dir)) { let p = path.join(dir, f); if (fs.statSync(p).isDirectory()) r = r.concat(walk(p)); else if (p.endsWith('.js') || p.endsWith('.jsx')) r.push(p); } return r; }

for (const file of walk('src')) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Replace corrupted close button
  content = content.replace(/\{t\('window\.closeEditor'\)\} [^\n<]+/g, "{t('window.closeEditor')} ?\n");
  
  // Replace corrupted dots and dashes
  content = content.replace(/ A"?/g, ' ?');
  content = content.replace(/A /g, '? ');
  content = content.replace(/ A /g, ' ? ');
  content = content.replace(/??/g, '?');
  content = content.replace(/A?sA/g, '?');
  content = content.replace(/,/g, '?');
  content = content.replace(/\?"/g, '?');
  content = content.replace(/A- /g, '? ');
  content = content.replace(/ A- /g, ' ? ');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
}
