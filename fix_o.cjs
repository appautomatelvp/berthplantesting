const fs = require('fs');
let p = 'src/features/berth-plan/pages/BerthingWindow.jsx';
let s = fs.readFileSync(p, 'utf8');

s = s.replace("const mooringCap = metrics.mooringCap ? 30;", "const mooringCap = metrics.mooringCap ?? 30;");
s = s.replace("const mooringRati?= metrics.mooringRati?? 0.1;", "const mooringRatio = metrics.mooringRatio ?? 0.1;");
s = s.replace(/mooringRati\?/g, 'mooringRatio');
s = s.replace(/mooringRati/g, 'mooringRatio');

fs.writeFileSync(p, s, 'utf8');
