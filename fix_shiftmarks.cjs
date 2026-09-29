const fs = require('fs');
let p = 'src/features/berth-plan/pages/BerthingWindow.jsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/\{t\('window\.showShiftMarks'\)\}/, "<span style={{ flex: 1, textAlign: 'left' }}>{t('window.showShiftMarks')}</span>");
fs.writeFileSync(p, s, 'utf8');
