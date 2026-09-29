const fs = require('fs');
let p = 'src/app/index.css';
let s = fs.readFileSync(p, 'utf8');

s = s.replace(/\.berth-plan-drawer \.drawer-checks \.field-check/g, ".berth-plan-drawer .field-check");
fs.writeFileSync(p, s, 'utf8');
