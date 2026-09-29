const fs = require('fs');
let p = 'src/features/berth-plan/pages/BerthingWindow.jsx';
let s = fs.readFileSync(p, 'utf8');

s = s.replace(/pushUnd\?/g, 'pushUndo');
s = s.replace(/pushUnd?/g, 'pushUndo');

fs.writeFileSync(p, s, 'utf8');
