const fs = require('fs');
const p = 'src/features/berth-plan/pages/BerthingWindow.jsx';
let s = fs.readFileSync(p, 'utf8');

// Remove the button
const btnRegex = /<button[\s\S]*?onClick=\{\(\) => openToolsPanel\('view'\)\}[\s\S]*?<\/button>/;
s = s.replace(btnRegex, '');

// Remove the panel (the if block: {toolsPanel === 'view' && (...)})
// We know it ends before {toolsPanel === 'cranes' &&
const panelStartIdx = s.indexOf("{toolsPanel === 'view' && (");
if (panelStartIdx !== -1) {
    const nextPanelIdx = s.indexOf("{toolsPanel === 'cranes' && (");
    if (nextPanelIdx !== -1) {
        s = s.substring(0, panelStartIdx) + s.substring(nextPanelIdx);
    }
}

fs.writeFileSync(p, s, 'utf8');
