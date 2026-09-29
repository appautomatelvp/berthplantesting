const fs = require('fs');
let c = fs.readFileSync('src/pages/BerthSimulation.jsx', 'utf8');

// 1. Add state variable
if (!c.includes('const [showMapSettings, setShowMapSettings] = useState(false);')) {
    c = c.replace(
        'const [showGuideLines, setShowGuideLines] = useState(true); // NEW STATE: Toggle guide lines in visual map',
        'const [showGuideLines, setShowGuideLines] = useState(true); // NEW STATE: Toggle guide lines in visual map\n  const [showMapSettings, setShowMapSettings] = useState(false);'
    );
}

// 2. Replace the UI block
const oldUi = `<div className="absolute bottom-6 left-6 z-50 flex gap-3 pointer-events-none flex-col sm:flex-row">
                    <div className="bg-white/90 px-4 py-2.5 rounded-xl border border-slate-200 shadow-lg flex items-center gap-2">
                        <p className="text-[10px] font-black text-slate-500 flex items-center gap-2"><Hand size={14}/> Kéo chuột vào nền để di chuyển bản đồ</p>
                    </div>
                    <button onClick={() => setIsAutoExpand(!isAutoExpand)} className={\`px-4 py-2.5 rounded-xl border shadow-lg transition-all text-[10px] font-black flex items-center gap-2 pointer-events-auto active:scale-95 \${isAutoExpand ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'}\`}>
                        {isAutoExpand ? <Eye size={14}/> : <EyeOff size={14}/>} {isAutoExpand ? 'AUTO-BẬT BẢNG: ON' : 'AUTO-BẬT BẢNG: OFF'}
                    </button>
                    <button onClick={() => setShowGuideLines(!showGuideLines)} className={\`px-4 py-2.5 rounded-xl border shadow-lg transition-all text-[10px] font-black flex items-center gap-2 pointer-events-auto active:scale-95 \${showGuideLines ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'}\`}>
                        {showGuideLines ? <Eye size={14}/> : <EyeOff size={14}/>} {showGuideLines ? 'HIỆN TỌA ĐỘ MŨI/LÁI: ON' : 'HIỆN TỌA ĐỘ MŨI/LÁI: OFF'}
                    </button>
                </div>`;

const newUi = `<div className="absolute bottom-6 left-6 z-50 flex gap-3 pointer-events-none flex-col sm:flex-row items-end sm:items-center">
                    <div className="bg-white/90 px-4 py-2.5 rounded-xl border border-slate-200 shadow-lg flex items-center gap-2">
                        <p className="text-[10px] font-black text-slate-500 flex items-center gap-2"><Hand size={14}/> Kéo chuột vào nền để di chuyển bản đồ</p>
                    </div>
                    <div className="relative pointer-events-auto">
                        <button onClick={() => setShowMapSettings(!showMapSettings)} className={\`p-2.5 rounded-xl border shadow-lg transition-all flex items-center justify-center active:scale-95 \${showMapSettings ? 'bg-[#002D54] text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}\`}>
                            <Settings2 size={18} />
                        </button>
                        {showMapSettings && (
                            <div className="absolute bottom-full left-0 mb-3 bg-white rounded-xl shadow-xl border border-slate-200 p-2 flex flex-col gap-2 min-w-[220px] animate-in slide-in-from-bottom-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 pt-1 border-b border-slate-100 pb-2">Tùy Chọn Hiển Thị</p>
                                <button onClick={() => setIsAutoExpand(!isAutoExpand)} className={\`px-4 py-2.5 rounded-xl border transition-all text-[10px] font-black flex items-center gap-2 active:scale-95 \${isAutoExpand ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'}\`}>
                                    {isAutoExpand ? <Eye size={14}/> : <EyeOff size={14}/>} {isAutoExpand ? 'AUTO-BẬT BẢNG: ON' : 'AUTO-BẬT BẢNG: OFF'}
                                </button>
                                <button onClick={() => setShowGuideLines(!showGuideLines)} className={\`px-4 py-2.5 rounded-xl border transition-all text-[10px] font-black flex items-center gap-2 active:scale-95 \${showGuideLines ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'}\`}>
                                    {showGuideLines ? <Eye size={14}/> : <EyeOff size={14}/>} {showGuideLines ? 'TỌA ĐỘ MŨI/LÁI: ON' : 'TỌA ĐỘ MŨI/LÁI: OFF'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>`;

if (c.includes(oldUi)) {
    c = c.replace(oldUi, newUi);
    console.log("Successfully replaced UI controls.");
} else {
    // try replacing with regex to ignore whitespace
    const normalizedOldUi = oldUi.replace(/\s+/g, '');
    const currentNormalized = c.replace(/\s+/g, '');
    if (currentNormalized.includes(normalizedOldUi)) {
        console.log("Found match but whitespace differs, using smart replace.");
        // We will just find the start and end tokens
        const startToken = '<div className="absolute bottom-6 left-6 z-50 flex gap-3 pointer-events-none flex-col sm:flex-row">';
        const endToken = 'HIỆN TỌA ĐỘ MŨI/LÁI: OFF\'}\n                    </button>\n                </div>';
        const startIdx = c.indexOf(startToken);
        if(startIdx !== -1) {
            const endIdx = c.indexOf('</div>', startIdx + startToken.length + 100);
            if (endIdx !== -1) {
                // Actually, let's just find `HIỆN TỌA ĐỘ MŨI/LÁI: OFF`
                const realEndIdx = c.indexOf('HIỆN TỌA ĐỘ MŨI/LÁI: OFF');
                if (realEndIdx !== -1) {
                    const finalDivIdx = c.indexOf('</div>', realEndIdx);
                    if (finalDivIdx !== -1) {
                        const extracted = c.substring(startIdx, finalDivIdx + 6);
                        c = c.replace(extracted, newUi);
                        console.log("Replaced using smart index approach.");
                    }
                }
            }
        }
    } else {
        console.log("Could not find the UI code block to replace.");
    }
}

fs.writeFileSync('src/pages/BerthSimulation.jsx', c);
