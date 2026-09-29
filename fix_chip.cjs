const fs = require('fs');
let p = 'src/features/guide/pages/Guide.jsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/className=\{chip \\\}/g, 'className={\chip \ \}');
fs.writeFileSync(p, s, 'utf8');
