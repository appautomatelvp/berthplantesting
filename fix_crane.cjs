const fs = require('fs');
let p = 'src/features/settings/utils/parameterWorkbook.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/'\.\.\/\.\.\/\.\.\/shared\/utils\/crane\.js'/g, "'../../berth-plan/utils/crane.js'");
s = s.replace(/'\.\.\/\.\.\/\.\.\/shared\/utils\/crane'/g, "'../../berth-plan/utils/crane.js'");
fs.writeFileSync(p, s, 'utf8');

p = 'src/features/berth-plan/utils/operations.js';
s = fs.readFileSync(p, 'utf8');
s = s.replace(/'\.\.\/\.\.\/\.\.\/shared\/utils\/crane\.js'/g, "'./crane.js'");
s = s.replace(/'\.\.\/\.\.\/\.\.\/shared\/utils\/crane'/g, "'./crane.js'");
fs.writeFileSync(p, s, 'utf8');
