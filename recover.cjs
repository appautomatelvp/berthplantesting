const { execSync } = require('child_process');
const fs = require('fs');

function restoreAndFixImport(oldPath, newPath, importFixes) {
  try {
    let content = execSync('git show 88a8007~1:' + oldPath).toString('utf8');
    for (const [bad, good] of Object.entries(importFixes)) {
      content = content.replace(new RegExp(bad, 'g'), good);
    }
    fs.writeFileSync(newPath, content, 'utf8');
    console.log('Restored and fixed', newPath);
  } catch (e) {
    console.log('Skipping', oldPath);
  }
}

restoreAndFixImport('src/utils/parameterWorkbook.js', 'src/features/settings/utils/parameterWorkbook.js', {
  "'\\.\\./utils/crane'": "'../../../shared/utils/crane'",
  "'\\.\\./i18n/I18nContext'": "'../../../shared/i18n/I18nContext'",
  "'\\.\\./lib/operations'": "'../../berth-plan/utils/operations'"
});
restoreAndFixImport('src/utils/dashboard.js', 'src/features/dashboard/utils/dashboard.js', {
  "'\\.\\./lib/operations'": "'../../berth-plan/utils/operations'"
});
restoreAndFixImport('src/utils/operations.js', 'src/features/berth-plan/utils/operations.js', {
  "'\\.\\./i18n/I18nContext'": "'../../../shared/i18n/I18nContext'",
  "'\\.\\./utils/crane'": "'../../../shared/utils/crane'"
});
restoreAndFixImport('src/components/StrategyPanels.jsx', 'src/features/settings/components/StrategyPanels.jsx', {
  "'\\.\\./i18n/I18nContext'": "'../../../shared/i18n/I18nContext'",
  "'\\.\\./components/icons/PortIcons'": "'../../../shared/components/icons/PortIcons'",
  "'\\.\\./lib/operations'": "'../../berth-plan/utils/operations'",
  "'\\./ChartTip'": "'../../berth-plan/components/ChartTip'"
});
