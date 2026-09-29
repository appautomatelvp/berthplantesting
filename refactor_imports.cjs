const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const map = {
  // App
  './App': 'src/app/App',
  './index.css': 'src/app/index.css',
  
  // Firebase
  './lib/firebase': 'src/services/firebase/firebase',
  '../lib/firebase': 'src/services/firebase/firebase',
  '../../lib/firebase': 'src/services/firebase/firebase',

  // Shared UI
  './components/ConfirmModal': 'src/shared/components/ConfirmModal',
  '../components/ConfirmModal': 'src/shared/components/ConfirmModal',
  '../../components/ConfirmModal': 'src/shared/components/ConfirmModal',
  
  './components/ButtonHints': 'src/shared/components/ButtonHints',
  '../components/ButtonHints': 'src/shared/components/ButtonHints',
  '../../components/ButtonHints': 'src/shared/components/ButtonHints',

  './components/PageToolbar': 'src/shared/components/PageToolbar',
  '../components/PageToolbar': 'src/shared/components/PageToolbar',
  '../../components/PageToolbar': 'src/shared/components/PageToolbar',

  './components/icons/PortIcons': 'src/shared/components/icons/PortIcons',
  '../components/icons/PortIcons': 'src/shared/components/icons/PortIcons',
  '../../components/icons/PortIcons': 'src/shared/components/icons/PortIcons',

  './components/ParameterExcel': 'src/shared/components/ParameterExcel',
  '../components/ParameterExcel': 'src/shared/components/ParameterExcel',
  '../../components/ParameterExcel': 'src/shared/components/ParameterExcel',

  // Shared Utils
  './data/seed': 'src/shared/utils/seed',
  '../data/seed': 'src/shared/utils/seed',
  '../../data/seed': 'src/shared/utils/seed',
  
  './lib/uiSettings': 'src/shared/utils/uiSettings',
  '../lib/uiSettings': 'src/shared/utils/uiSettings',
  '../../lib/uiSettings': 'src/shared/utils/uiSettings',

  './lib/lockZone': 'src/shared/utils/lockZone',
  '../lib/lockZone': 'src/shared/utils/lockZone',
  '../../lib/lockZone': 'src/shared/utils/lockZone',

  // i18n
  './i18n/I18nContext': 'src/shared/i18n/I18nContext',
  '../i18n/I18nContext': 'src/shared/i18n/I18nContext',
  '../../i18n/I18nContext': 'src/shared/i18n/I18nContext',
  
  './opsCopy': 'src/shared/i18n/opsCopy',
  '../i18n/opsCopy': 'src/shared/i18n/opsCopy',

  './translations': 'src/shared/i18n/translations',
  '../i18n/translations': 'src/shared/i18n/translations',

  // Berth Plan
  './pages/BerthingWindow': 'src/features/berth-plan/pages/BerthingWindow',
  '../pages/BerthingWindow': 'src/features/berth-plan/pages/BerthingWindow',
  '../../pages/BerthingWindow': 'src/features/berth-plan/pages/BerthingWindow',

  './lib/crane': 'src/features/berth-plan/utils/crane',
  '../lib/crane': 'src/features/berth-plan/utils/crane',
  '../../lib/crane': 'src/features/berth-plan/utils/crane',

  './lib/operations': 'src/features/berth-plan/utils/operations',
  '../lib/operations': 'src/features/berth-plan/utils/operations',
  '../../lib/operations': 'src/features/berth-plan/utils/operations',

  './lib/serviceColor': 'src/features/berth-plan/utils/serviceColor',
  '../lib/serviceColor': 'src/features/berth-plan/utils/serviceColor',
  '../../lib/serviceColor': 'src/features/berth-plan/utils/serviceColor',

  './components/CraneManager': 'src/features/berth-plan/components/CraneManager',
  '../components/CraneManager': 'src/features/berth-plan/components/CraneManager',

  './components/CraneRail': 'src/features/berth-plan/components/CraneRail',
  '../components/CraneRail': 'src/features/berth-plan/components/CraneRail',

  './components/LockZoneManager': 'src/features/berth-plan/components/LockZoneManager',
  '../components/LockZoneManager': 'src/features/berth-plan/components/LockZoneManager',

  './components/StsManager': 'src/features/berth-plan/components/StsManager',
  '../components/StsManager': 'src/features/berth-plan/components/StsManager',

  './components/StsRail': 'src/features/berth-plan/components/StsRail',
  '../components/StsRail': 'src/features/berth-plan/components/StsRail',

  './components/ChartTip': 'src/features/berth-plan/components/ChartTip',
  '../components/ChartTip': 'src/features/berth-plan/components/ChartTip',

  // Capacity
  './pages/CapacityBoard': 'src/features/capacity/pages/CapacityBoard',
  '../pages/CapacityBoard': 'src/features/capacity/pages/CapacityBoard',

  './lib/capacity': 'src/features/capacity/utils/index',
  '../lib/capacity': 'src/features/capacity/utils/index',

  './lib/sts': 'src/features/capacity/utils/sts',
  '../lib/sts': 'src/features/capacity/utils/sts',

  // Dashboard
  './pages/Dashboard': 'src/features/dashboard/pages/Dashboard',
  '../pages/Dashboard': 'src/features/dashboard/pages/Dashboard',

  './lib/dashboard': 'src/features/dashboard/utils/dashboard',
  '../lib/dashboard': 'src/features/dashboard/utils/dashboard',

  // Settings
  './pages/Settings': 'src/features/settings/pages/Settings',
  '../pages/Settings': 'src/features/settings/pages/Settings',

  './components/QuayLengthInput': 'src/features/settings/components/QuayLengthInput',
  '../components/QuayLengthInput': 'src/features/settings/components/QuayLengthInput',

  './components/StrategyPanels': 'src/features/settings/components/StrategyPanels',
  '../components/StrategyPanels': 'src/features/settings/components/StrategyPanels',

  './lib/parameterWorkbook': 'src/features/settings/utils/parameterWorkbook',
  '../lib/parameterWorkbook': 'src/features/settings/utils/parameterWorkbook',

  // Secondary Berth
  './pages/SecondaryBerth': 'src/features/secondary-berth/pages/SecondaryBerth',
  '../pages/SecondaryBerth': 'src/features/secondary-berth/pages/SecondaryBerth',

  // Guide
  './pages/Guide': 'src/features/guide/pages/Guide',
  '../pages/Guide': 'src/features/guide/pages/Guide',
};

function getRelativePath(fromFile, toAbsolute) {
  const fromDir = path.dirname(fromFile);
  const toDir = path.dirname(path.join(__dirname, toAbsolute));
  let rel = path.relative(fromDir, toDir);
  if (!rel.startsWith('.')) rel = './' + rel;
  let target = path.join(rel, path.basename(toAbsolute)).replace(/\\/g, '/');
  if (!target.startsWith('.')) target = './' + target;
  return target;
}

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let modified = false;
      const importRegex = /import([\s\S]*?)from\s+['"](.*?)['"]/g;
      content = content.replace(importRegex, (match, p1, p2) => {
        let p2key = p2;
        if (p2key.endsWith('.js') || p2key.endsWith('.jsx')) {
           p2key = p2key.replace(/\.jsx?$/, '');
        }
        
        if (map[p2key]) {
           modified = true;
           const newImport = getRelativePath(fullPath, map[p2key]);
           return "import" + p1 + "from '" + newImport + "'";
        }
        return match;
      });
      
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log("Updated imports in " + fullPath);
      }
    }
  }
}

processDir(srcDir);
