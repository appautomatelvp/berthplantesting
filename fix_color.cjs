const fs = require('fs');
let p = 'src/features/settings/utils/parameterWorkbook.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/'\.\.\/\.\.\/\.\.\/shared\/utils\/serviceColor\.js'/g, "'../../berth-plan/utils/serviceColor.js'");
fs.writeFileSync(p, s, 'utf8');
