const fs = require('fs');
let p = 'src/features/dashboard/utils/dashboard.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/'\.\/capacity\/index\.js'/g, "'../../capacity/utils/index.js'");
s = s.replace(/'\.\/uiSettings\.js'/g, "'../../../shared/utils/uiSettings.js'");
fs.writeFileSync(p, s, 'utf8');
