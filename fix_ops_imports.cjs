const fs = require('fs');
let p = 'src/features/berth-plan/utils/operations.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/'\.\/capacity\/engine\.js'/g, "'../../capacity/utils/engine.js'");
s = s.replace(/'\.\/uiSettings\.js'/g, "'../../../shared/utils/uiSettings.js'");
s = s.replace(/'\.\/capacity'/g, "'../../capacity/utils/index.js'");
fs.writeFileSync(p, s, 'utf8');
