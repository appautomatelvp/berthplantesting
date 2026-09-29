const fs = require('fs');
let p = 'src/features/guide/pages/Guide.jsx';
let s = fs.readFileSync(p, 'utf8');

s = s.replace("className={panel span-12 \\}", "className=\"panel span-12\"");
s = s.replace("<li>{t('guide.modules.dash')}</li>", "<li>{t('guide.modules.dash')}</li>\n          <li>{t('guide.modules.settings')}</li>");

fs.writeFileSync(p, s, 'utf8');
