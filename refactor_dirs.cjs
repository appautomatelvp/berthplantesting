const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function moveFile(oldPath, newPath) {
    if (!fs.existsSync(oldPath)) return;
    const newDir = path.dirname(newPath);
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    fs.renameSync(oldPath, newPath);
    console.log("Moved " + oldPath + " to " + newPath);
}

// 1. Move firebase
moveFile(path.join(srcDir, 'lib/firebase.js'), path.join(srcDir, 'services/firebase/firebase.js'));

// 2. Move generic components
['ConfirmModal.jsx', 'ButtonHints.jsx', 'PageToolbar.jsx', 'icons/PortIcons.jsx', 'ParameterExcel.jsx'].forEach(f => {
    moveFile(path.join(srcDir, 'components', f), path.join(srcDir, 'shared/components', f));
});

// 3. Move i18n
moveFile(path.join(srcDir, 'i18n'), path.join(srcDir, 'shared/i18n'));

// 4. Move data
moveFile(path.join(srcDir, 'data/seed.js'), path.join(srcDir, 'shared/utils/seed.js'));

// 5. Move UI Settings
moveFile(path.join(srcDir, 'lib/uiSettings.js'), path.join(srcDir, 'shared/utils/uiSettings.js'));
moveFile(path.join(srcDir, 'lib/lockZone.js'), path.join(srcDir, 'shared/utils/lockZone.js'));

// 6. Move Berth Plan feature files
['BerthingWindow.jsx', 'Benchmarks.jsx'].forEach(f => {
    moveFile(path.join(srcDir, 'pages', f), path.join(srcDir, 'features/berth-plan/pages', f));
});
['crane.js', 'operations.js', 'serviceColor.js'].forEach(f => {
    moveFile(path.join(srcDir, 'lib', f), path.join(srcDir, 'features/berth-plan/utils', f));
});
['CraneManager.jsx', 'CraneRail.jsx', 'LockZoneManager.jsx', 'StsManager.jsx', 'StsRail.jsx', 'ChartTip.jsx'].forEach(f => {
    moveFile(path.join(srcDir, 'components', f), path.join(srcDir, 'features/berth-plan/components', f));
});

// 7. Move Capacity feature files
['CapacityBoard.jsx'].forEach(f => {
    moveFile(path.join(srcDir, 'pages', f), path.join(srcDir, 'features/capacity/pages', f));
});
moveFile(path.join(srcDir, 'lib/capacity'), path.join(srcDir, 'features/capacity/utils'));
moveFile(path.join(srcDir, 'lib/sts.js'), path.join(srcDir, 'features/capacity/utils/sts.js'));

// 8. Move Dashboard feature files
['Dashboard.jsx'].forEach(f => {
    moveFile(path.join(srcDir, 'pages', f), path.join(srcDir, 'features/dashboard/pages', f));
});
['dashboard.js'].forEach(f => {
    moveFile(path.join(srcDir, 'lib', f), path.join(srcDir, 'features/dashboard/utils', f));
});

// 9. Move Settings feature files
['Settings.jsx'].forEach(f => {
    moveFile(path.join(srcDir, 'pages', f), path.join(srcDir, 'features/settings/pages', f));
});
['QuayLengthInput.jsx', 'StrategyPanels.jsx'].forEach(f => {
    moveFile(path.join(srcDir, 'components', f), path.join(srcDir, 'features/settings/components', f));
});
moveFile(path.join(srcDir, 'lib/parameterWorkbook.js'), path.join(srcDir, 'features/settings/utils/parameterWorkbook.js'));

// 10. Move Secondary Berth feature
['SecondaryBerth.jsx'].forEach(f => {
    moveFile(path.join(srcDir, 'pages', f), path.join(srcDir, 'features/secondary-berth/pages', f));
});

// 11. Move Guide feature
['Guide.jsx'].forEach(f => {
    moveFile(path.join(srcDir, 'pages', f), path.join(srcDir, 'features/guide/pages', f));
});

// 12. Move App entry points
['App.jsx', 'main.jsx', 'index.css'].forEach(f => {
    moveFile(path.join(srcDir, f), path.join(srcDir, 'app', f));
});

// Also remove empty old dirs
try { fs.rmdirSync(path.join(srcDir, 'data')); } catch(e){}
try { fs.rmdirSync(path.join(srcDir, 'pages')); } catch(e){}
try { fs.rmdirSync(path.join(srcDir, 'components/icons')); } catch(e){}
try { fs.rmdirSync(path.join(srcDir, 'components')); } catch(e){}
try { fs.rmdirSync(path.join(srcDir, 'lib')); } catch(e){}

