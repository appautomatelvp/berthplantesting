const fs = require('fs');
let p = 'src/features/berth-plan/pages/BerthingWindow.jsx';
let lines = fs.readFileSync(p, 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('window.closeEditor')) {
    lines[i] = lines[i].replace(/\{t\('window\.closeEditor'\)\}.*/, "{t('window.closeEditor')} ?");
  }
}
fs.writeFileSync(p, lines.join('\n'), 'utf8');
