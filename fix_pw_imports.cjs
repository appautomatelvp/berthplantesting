const fs = require('fs');
let p = 'src/features/settings/utils/parameterWorkbook.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/'\.\/crane\.js'/g, "'../../../shared/utils/crane.js'");
s = s.replace(/'\.\/serviceColor\.js'/g, "'../../../shared/utils/serviceColor.js'");
fs.writeFileSync(p, s, 'utf8');
