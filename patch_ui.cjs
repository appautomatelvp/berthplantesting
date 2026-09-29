const fs = require('fs');
let c = fs.readFileSync('src/pages/BerthSimulationLive.jsx', 'utf8');
let changes = 0;

// 1. Centralize settings into gear icon
const oldSettingsUI = `<button onClick={() => setIsAutoExpand(!isAutoExpand)} className={\`px-4 py-2.5 rounded-xl border shadow-lg transition-all text-[10px] font-black flex items-center gap-2 pointer-events-auto active:scale-95 \${isAutoExpand ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'}\`}>
                        {isAutoExpand ? <Eye size={14}/> : <EyeOff size={14}/>} {isAutoExpand ? 'AUTO-BẬT BẢNG: ON' : 'AUTO-BẬT BẢNG: OFF'}
                    </button>
                    <button onClick={() => setShowGuideLines(!showGuideLines)} className={\`px-4 py-2.5 rounded-xl border shadow-lg transition-all text-[10px] font-black flex items-center gap-2 pointer-events-auto active:scale-95 \${showGuideLines ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'}\`}>
                        {showGuideLines ? <Eye size={14}/> : <EyeOff size={14}/>} {showGuideLines ? 'HIỆN TỌA ĐỘ MŨI/LÁI: ON' : 'HIỆN TỌA ĐỘ MŨI/LÁI: OFF'}
                    </button>`;

const newSettingsUI = `<div className="relative group pointer-events-auto">
                        <button className="p-2.5 rounded-xl border shadow-lg bg-white hover:bg-slate-50 text-slate-600 transition-all active:scale-95">
                            <Settings2 size={18} />
                        </button>
                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col gap-2 min-w-max">
                            <button onClick={() => setIsAutoExpand(!isAutoExpand)} className={\`px-4 py-2.5 rounded-xl border shadow-lg transition-all text-[10px] font-black flex items-center gap-2 pointer-events-auto active:scale-95 \${isAutoExpand ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'}\`}>
                                {isAutoExpand ? <Eye size={14}/> : <EyeOff size={14}/>} {isAutoExpand ? 'AUTO-BẬT BẢNG: ON' : 'AUTO-BẬT BẢNG: OFF'}
                            </button>
                            <button onClick={() => setShowGuideLines(!showGuideLines)} className={\`px-4 py-2.5 rounded-xl border shadow-lg transition-all text-[10px] font-black flex items-center gap-2 pointer-events-auto active:scale-95 \${showGuideLines ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'}\`}>
                                {showGuideLines ? <Eye size={14}/> : <EyeOff size={14}/>} {showGuideLines ? 'HIỆN TỌA ĐỘ MŨI/LÁI: ON' : 'HIỆN TỌA ĐỘ MŨI/LÁI: OFF'}
                            </button>
                        </div>
                    </div>`;

if (c.includes(oldSettingsUI)) {
    c = c.replace(oldSettingsUI, newSettingsUI);
    changes++;
    console.log('[1] Replaced settings UI with gear menu');
} else {
    // Try to replace by matching the start and end of the buttons block
    const isAutoBtn = `<button onClick={() => setIsAutoExpand(!isAutoExpand)}`;
    const showGuideBtnEnd = `HIỆN TỌA ĐỘ MŨI/LÁI: OFF'}
                    </button>`;
    
    const startIdx = c.indexOf(isAutoBtn);
    const endIdx = c.indexOf(showGuideBtnEnd);
    if (startIdx !== -1 && endIdx !== -1) {
        const fullEnd = endIdx + showGuideBtnEnd.length;
        const oldBlock = c.substring(startIdx, fullEnd);
        c = c.substring(0, startIdx) + newSettingsUI + c.substring(fullEnd);
        changes++;
        console.log('[1] Replaced settings UI with gear menu (fallback)');
    } else {
        console.log('[1] FAILED to replace settings UI');
    }
}

// 2. Disable auto-expand everywhere
// We will change default state to false and remove forced expansions
const defaultStateOld = 'const [isAutoExpand, setIsAutoExpand] = useState(true);';
const defaultStateNew = 'const [isAutoExpand, setIsAutoExpand] = useState(false);';
if (c.includes(defaultStateOld)) {
    c = c.replace(defaultStateOld, defaultStateNew);
    changes++;
    console.log('[2a] Changed default isAutoExpand to false');
}

const forcedExpandPattern1 = "setUiState(prev => ({ ...prev, detailsExpanded: true }));";
const forcedExpandPattern2 = "if (!uiState.listExpanded) toggleUi('listExpanded');";

// We want to completely remove these forced expansions from addNewVessel, selectVessel, addBarge
c = c.split('\\n').filter(line => {
    if (line.includes(forcedExpandPattern1) || line.includes(forcedExpandPattern2)) {
        // except we want to keep it where it's actually toggled? No, the toggle function handles the UI state directly.
        // Wait, what if they click the list item? It shouldn't auto expand details.
        // Wait, if we just remove the line `setUiState(prev => ({ ...prev, detailsExpanded: true }));`, it might break other things.
        // Let's just remove them!
        console.log('[2b] Removed forced expand line');
        changes++;
        return false; // exclude this line
    }
    return true;
}).join('\\n');

// Wait, split('\n') is risky if CRLF.
// Let's use string replace all instead.
c = fs.readFileSync('src/pages/BerthSimulationLive.jsx', 'utf8'); // reload
let c2 = c.replace(/setUiState\(prev => \(\{ \.\.\.prev, detailsExpanded: true \}\)\);/g, '// setUiState(prev => ({ ...prev, detailsExpanded: true }));');
c2 = c2.replace(/if \(\!uiState\.listExpanded\) toggleUi\('listExpanded'\);/g, "// if (!uiState.listExpanded) toggleUi('listExpanded');");

if (c2 !== c) {
    c = c2;
    changes++;
    console.log('[2b] Commented out forced panel expansions');
}

// 3. Change "TỌA ĐỘ SÀ LAN" to vessel name
const oldTitle = "<h3 className=\"text-[10px] font-black tracking-[0.2em] text-slate-600\">{activeVessel.type === 'barge' ? 'TỌA ĐỘ SÀ LAN' : 'TỌA ĐỘ TÀU'}</h3>";
const newTitle = "<h3 className=\"text-[10px] font-black tracking-[0.2em] text-slate-600 uppercase\">{activeVessel.name || (activeVessel.type === 'barge' ? 'SÀ LAN' : 'TÀU')}</h3>";

if (c.includes(oldTitle)) {
    c = c.replace(oldTitle, newTitle);
    changes++;
    console.log('[3] Changed details panel title to vessel name');
} else {
    // Try regex
    const titleRegex = /<h3 className="text-\[10px\] font-black tracking-\[0\.2em\] text-slate-600">\{activeVessel\.type === 'barge' \? 'TỌA ĐỘ SÀ LAN' : 'TỌA ĐỘ TÀU'\}<\/h3>/;
    if (titleRegex.test(c)) {
        c = c.replace(titleRegex, newTitle);
        changes++;
        console.log('[3] Changed details panel title to vessel name (regex)');
    } else {
        console.log('[3] FAILED to change details panel title');
    }
}

fs.writeFileSync('src/pages/BerthSimulationLive.jsx', c);
console.log(`=== DONE: ${changes} applied ===`);
