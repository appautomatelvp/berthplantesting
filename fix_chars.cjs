const fs = require('fs');
const path = require('path');

const replacements = {
  '???': '?',
  '???': '?',
  '??': '?',
  '???': '?',
  'o ': '?',
  '?"': '?'
};

function fixFile(p) {
  let s = fs.readFileSync(p, 'utf8');
  let original = s;
  for (const [bad, good] of Object.entries(replacements)) {
    s = s.split(bad).join(good);
  }
  // Remove BOM if present
  if (s.charCodeAt(0) === 0xFEFF) {
    s = s.substring(1);
  }
  if (s !== original) {
    fs.writeFileSync(p, s, 'utf8');
    console.log('Fixed', p);
  }
}

fixFile('src/features/settings/components/StrategyPanels.jsx');
fixFile('src/features/berth-plan/pages/BerthingWindow.jsx');
fixFile('src/features/dashboard/utils/dashboard.js');
fixFile('src/features/berth-plan/utils/operations.js');
fixFile('src/features/settings/utils/parameterWorkbook.js');
fixFile('src/features/settings/utils/crane.js');
fixFile('src/shared/utils/lockZone.js');
fixFile('src/features/secondary-berth/pages/SecondaryBerth.jsx');

