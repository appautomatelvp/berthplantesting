const fs = require('fs');
let p = 'src/features/berth-plan/pages/BerthingWindow.jsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/\{t\(`window\.blockField\.\$\{key\}`\)\}/, "<span style={{ flex: 1, textAlign: 'left' }}>{t(`window.blockField.${key}`)}</span>");
fs.writeFileSync(p, s, 'utf8');

let p2 = 'src/app/index.css';
let s2 = fs.readFileSync(p2, 'utf8');
s2 = s2.replace(/padding: 0\.5rem 0\.75rem !important;/g, "padding: 0.35rem 0.5rem !important;");
fs.writeFileSync(p2, s2, 'utf8');
