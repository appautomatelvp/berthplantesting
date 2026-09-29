const fs = require('fs');
const p = 'src/features/berth-plan/pages/BerthingWindow.jsx';
let s = fs.readFileSync(p, 'utf8');

const target = '<PageToolbar>\n        ';
const replacement = target + <button type="button" className="btn" data-tip={t('tip.jumpNow')} onClick={jumpToNow}>
          {t('window.jumpNow')}
        </button>
        <button type="button" className="btn" data-tip={t('tip.addService')} onClick={addService}>
          {t('window.addService')}
        </button>
        ;

s = s.replace(target, replacement);
fs.writeFileSync(p, s, 'utf8');
