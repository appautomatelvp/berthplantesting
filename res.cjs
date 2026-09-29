const { execSync } = require('child_process');
const fs = require('fs');

function restore(oldP, newP, replaces = {}) {
  try {
    let s = execSync('git show 88a8007~1:' + oldP).toString('utf8');
    for (const [bad, good] of Object.entries(replaces)) {
      s = s.replace(new RegExp(bad, 'g'), good);
    }
    fs.writeFileSync(newP, s, 'utf8');
    console.log('Restored', newP);
  } catch (e) {
    console.log('Error', oldP, e.message);
  }
}

// parameterWorkbook.js
restore('src/lib/parameterWorkbook.js', 'src/features/settings/utils/parameterWorkbook.js', {
  "'\\.\\./utils/crane'": "'../../../shared/utils/crane'",
  "'\\.\\./lib/crane'": "'../../../shared/utils/crane'",
  "'\\.\\./i18n/I18nContext'": "'../../../shared/i18n/I18nContext'",
  "'\\.\\./operations'": "'../../berth-plan/utils/operations'"
});

// dashboard.js
restore('src/lib/dashboard.js', 'src/features/dashboard/utils/dashboard.js', {
  "'\\./operations'": "'../../berth-plan/utils/operations'"
});

// operations.js
restore('src/lib/operations.js', 'src/features/berth-plan/utils/operations.js', {
  "'\\.\\./i18n/I18nContext'": "'../../../shared/i18n/I18nContext'",
  "'\\./crane'": "'../../../shared/utils/crane'"
});

// translations.js
restore('src/i18n/translations.js', 'src/shared/i18n/translations.js', {});

