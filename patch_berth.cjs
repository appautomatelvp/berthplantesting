const fs = require('fs');
let c = fs.readFileSync('src/pages/BerthSimulationLive.jsx', 'utf8');
let changes = 0;

// =====================================================
// 1. ADD qcProductivity STATE (after showGuideLines state)
// =====================================================
const stateAnchor = "const [showGuideLines, setShowGuideLines] = useState(true); // NEW STATE: Toggle guide lines in visual map";
if (c.includes(stateAnchor) && !c.includes('qcProductivity')) {
    c = c.replace(stateAnchor, stateAnchor + "\n  const [qcProductivity, setQcProductivity] = useState(25); // Năng suất QC (cont/h)");
    changes++;
    console.log("[1] Added qcProductivity state");
} else if (c.includes('qcProductivity')) {
    console.log("[1] SKIP: qcProductivity already exists");
} else {
    console.log("[1] ERROR: Could not find state anchor");
}

// =====================================================
// 2. ADD totalRemain TO addBarge FUNCTION
// =====================================================
const bargeColorLine = "        color: getAvailableColor(vessels)\n    };\n    setVessels([...vessels, newBarge]); setActiveVesselId(newBarge.id); setShowBargeMenu(false);";
if (c.includes(bargeColorLine) && !c.includes('totalRemain')) {
    c = c.replace(bargeColorLine, 
        "        color: getAvailableColor(vessels),\n        totalRemain: 0\n    };\n    setVessels([...vessels, newBarge]); setActiveVesselId(newBarge.id); setShowBargeMenu(false);");
    changes++;
    console.log("[2] Added totalRemain to addBarge");
} else if (c.includes('totalRemain')) {
    console.log("[2] SKIP: totalRemain already exists");
} else {
    console.log("[2] ERROR: Could not find addBarge color line");
}

// =====================================================
// 3. ADD totalRemain INPUT to barge detail panel (after TIER control)
// =====================================================
const tierEndAnchor = `                                    )}\n\n                                    {activeVessel.type === 'vessel' && (`;
if (c.includes(tierEndAnchor) && !c.includes('TOTAL REMAIN')) {
    const totalRemainUI = `                                    )}

                                    {activeVessel.type === 'barge' && (
                                        <div className="flex gap-2 items-center bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                                            <span className="text-[9px] font-black text-amber-600 tracking-widest ml-1 whitespace-nowrap">TOTAL REMAIN:</span>
                                            <input type="number" min="0" value={activeVessel.totalRemain || 0} onChange={(e) => {
                                                const v = e.target.value === '' ? 0 : Number(e.target.value);
                                                updateActiveVessel({ totalRemain: v });
                                            }} className="flex-1 text-center font-black outline-none text-[11px] bg-white border border-amber-300 rounded shadow-sm text-amber-800 py-0.5" />
                                            <span className="text-[9px] font-black text-amber-600">CONT</span>
                                        </div>
                                    )}

                                    {activeVessel.type === 'vessel' && (`;
    c = c.replace(tierEndAnchor, totalRemainUI);
    changes++;
    console.log("[3] Added totalRemain input to barge detail panel");
} else if (c.includes('TOTAL REMAIN')) {
    console.log("[3] SKIP: TOTAL REMAIN UI already exists");
} else {
    console.log("[3] ERROR: Could not find tier end anchor");
}

// =====================================================
// 4. ADD qcProductivity to syncToCloud
// =====================================================
const syncOld = "try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vesselPlans', 'currentPlan'), { vessels: vData || vessels, qcs: qData || qcTasks, mooringPercent: pData !== undefined ? pData : mooringPercent, updatedAt: new Date().toISOString() }); }";
if (c.includes(syncOld) && !c.includes('qcProductivity:')) {
    const syncNew = "try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vesselPlans', 'currentPlan'), { vessels: vData || vessels, qcs: qData || qcTasks, mooringPercent: pData !== undefined ? pData : mooringPercent, qcProductivity: qcProductivity, updatedAt: new Date().toISOString() }); }";
    c = c.replace(syncOld, syncNew);
    changes++;
    console.log("[4] Added qcProductivity to syncToCloud");
} else if (c.includes('qcProductivity:')) {
    console.log("[4] SKIP: qcProductivity already in syncToCloud");
} else {
    console.log("[4] ERROR: Could not find syncToCloud payload");
}

// =====================================================
// 5. RESTORE qcProductivity from Firebase snapshot (processSnapshot)
// =====================================================
const mooringRestore = `      if (data.mooringPercent !== undefined) {\n          setMooringPercent(data.mooringPercent);\n      }`;
if (c.includes(mooringRestore) && !c.includes('data.qcProductivity')) {
    c = c.replace(mooringRestore, mooringRestore + `\n      if (data.qcProductivity !== undefined) {\n          setQcProductivity(data.qcProductivity);\n      }`);
    changes++;
    console.log("[5] Added qcProductivity restore in processSnapshot");
} else if (c.includes('data.qcProductivity')) {
    console.log("[5] SKIP: qcProductivity restore already exists");
} else {
    console.log("[5] ERROR: Could not find mooringPercent restore block");
}

// =====================================================
// 6. ADD qcProductivity INPUT to Schedule Map Toolbar
// =====================================================
const toolbarAnchor = `<button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setScheduleStartDate(d); }} className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-black transition-colors uppercase tracking-widest shadow-sm">Hôm nay</button>`;
if (c.includes(toolbarAnchor) && !c.includes('Năng suất QC')) {
    const qcInput = `<button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setScheduleStartDate(d); }} className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-black transition-colors uppercase tracking-widest shadow-sm">Hôm nay</button>
                    </div>
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                        <Zap size={14} className="text-amber-600" />
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest whitespace-nowrap">Năng suất QC:</span>
                        <input type="number" min="1" max="100" value={qcProductivity} onChange={(e) => {
                            const v = e.target.value === '' ? 25 : Math.max(1, Number(e.target.value));
                            setQcProductivity(v);
                            syncToCloud();
                        }} className="w-12 text-center font-black outline-none text-[11px] bg-white border border-amber-300 rounded shadow-sm text-amber-800" />
                        <span className="text-[10px] font-black text-amber-600">cont/h</span>`;
    // Need to also remove the existing closing </div> that follows
    const afterToolbar = toolbarAnchor + "\n                </div>";
    if (c.includes(afterToolbar)) {
        c = c.replace(afterToolbar, qcInput);
        changes++;
        console.log("[6] Added qcProductivity input to schedule toolbar");
    } else {
        console.log("[6] ERROR: Could not find toolbar closing div after button");
    }
} else if (c.includes('Năng suất QC')) {
    console.log("[6] SKIP: Năng suất QC already exists");
} else {
    console.log("[6] ERROR: Could not find toolbar anchor");
}

// =====================================================
// 7. DYNAMIC DURATION + TIERED SNAP in renderScheduleMap
// =====================================================
// Replace the vessel rendering block to add dynamic calc
const renderAnchor = `                        {/* RENDER CÁC KHỐI TÀU LÊN GANTT CHART */}
                        {vessels.map((vessel, index) => {
                            if (!vessel || !vessel.eta) return null;
                            
                            const vEtaMs = new Date(vessel.eta).getTime();
                            const vEtdMs = new Date(vessel.etd || getEtdFallback(vessel.eta)).getTime();`;

const renderReplacement = `                        {/* RENDER CÁC KHỐI TÀU LÊN GANTT CHART */}
                        {(() => {
                            // === TIERED SCHEDULING: Pre-compute effective ETD for all barges ===
                            const effectiveTimes = {};
                            
                            // Pass 1: Calculate base durations for all vessels/barges
                            vessels.forEach(v => {
                                if (!v || !v.eta) return;
                                const baseEtaMs = new Date(v.eta).getTime();
                                let etdMs;
                                if (v.type === 'barge' && v.totalRemain > 0 && qcProductivity > 0) {
                                    const durationHours = v.totalRemain / qcProductivity;
                                    etdMs = baseEtaMs + durationHours * 3600000;
                                } else {
                                    etdMs = new Date(v.etd || getEtdFallback(v.eta)).getTime();
                                }
                                effectiveTimes[v.id] = { eta: baseEtaMs, etd: etdMs, tier: v.tier || 1 };
                            });
                            
                            // Pass 2: Snap-to-Finish for Tier 2+ barges
                            const maxTier = Math.max(...vessels.map(v => v.tier || 1), 1);
                            for (let tier = 2; tier <= maxTier; tier++) {
                                vessels.filter(v => v && (v.tier || 1) === tier && v.type === 'barge').forEach(barge => {
                                    if (!effectiveTimes[barge.id]) return;
                                    // Find all lower-tier barges that overlap in berth position
                                    const overlapping = vessels.filter(other => {
                                        if (!other || other.id === barge.id || !effectiveTimes[other.id]) return false;
                                        if ((other.tier || 1) >= tier) return false;
                                        // Check X-axis overlap (berth position)
                                        const bBow = barge.bowPos || 0;
                                        const bStern = barge.sternPos || (bBow + (barge.loa || 0));
                                        const oBow = other.bowPos || 0;
                                        const oStern = other.sternPos || (oBow + (other.loa || 0));
                                        return bBow < oStern && bStern > oBow;
                                    });
                                    
                                    if (overlapping.length > 0) {
                                        const latestEtd = Math.max(...overlapping.map(o => effectiveTimes[o.id].etd));
                                        const duration = effectiveTimes[barge.id].etd - effectiveTimes[barge.id].eta;
                                        effectiveTimes[barge.id].eta = latestEtd;
                                        effectiveTimes[barge.id].etd = latestEtd + duration;
                                    }
                                });
                            }
                            
                            return vessels.map((vessel, index) => {
                            if (!vessel || !vessel.eta) return null;
                            const times = effectiveTimes[vessel.id];
                            if (!times) return null;
                            
                            const vEtaMs = times.eta;
                            const vEtdMs = times.etd;`;

if (c.includes(renderAnchor) && !c.includes('effectiveTimes')) {
    c = c.replace(renderAnchor, renderReplacement);
    changes++;
    console.log("[7a] Replaced render block opening with tiered scheduling");
} else if (c.includes('effectiveTimes')) {
    console.log("[7a] SKIP: effectiveTimes already exists");
} else {
    console.log("[7a] ERROR: Could not find render anchor");
}

// Replace the closing of the vessels.map to close the IIFE
const mapClose = `                        })}
                    </div>
                </div>
            </div>
            
            {/* Ghi chú dưới cùng */}`;
const mapCloseNew = `                        });
                        })()}
                    </div>
                </div>
            </div>
            
            {/* Ghi chú dưới cùng */}`;

if (c.includes(mapClose) && c.includes('effectiveTimes')) {
    c = c.replace(mapClose, mapCloseNew);
    changes++;
    console.log("[7b] Fixed closing of IIFE wrapper");
} else if (!c.includes('effectiveTimes')) {
    console.log("[7b] SKIP: No effectiveTimes found (depends on 7a)");
} else {
    console.log("[7b] SKIP or already done");
}

// =====================================================
// 8. SHOW totalRemain on barge block in Gantt chart
// =====================================================
const blockLabelOld = `                                    {/* Header của block tàu */}
                                    <div className="bg-black/20 w-full px-1.5 py-0.5 flex justify-between items-center text-[8px] text-white font-black uppercase tracking-wider backdrop-blur-sm flex-shrink-0">
                                        <span className="truncate pr-1 drop-shadow-md">{vessel.name}</span>
                                        {isBarge && vesselTier > 1 && <span className="bg-red-500 px-1 rounded text-[6px] flex-shrink-0">T{vesselTier}</span>}
                                    </div>`;
const blockLabelNew = `                                    {/* Header của block tàu */}
                                    <div className="bg-black/20 w-full px-1.5 py-0.5 flex justify-between items-center text-[8px] text-white font-black uppercase tracking-wider backdrop-blur-sm flex-shrink-0">
                                        <span className="truncate pr-1 drop-shadow-md">{vessel.name}</span>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {isBarge && vessel.totalRemain > 0 && <span className="bg-amber-500 px-1 rounded text-[6px]">{vessel.totalRemain}c</span>}
                                            {isBarge && vesselTier > 1 && <span className="bg-red-500 px-1 rounded text-[6px]">T{vesselTier}</span>}
                                        </div>
                                    </div>`;
if (c.includes(blockLabelOld)) {
    c = c.replace(blockLabelOld, blockLabelNew);
    changes++;
    console.log("[8] Added totalRemain badge to Gantt block header");
} else {
    console.log("[8] SKIP or ERROR: Could not find block label");
}

// =====================================================
// 9. UPDATE Gantt note to mention dynamic duration
// =====================================================
const noteOld = `<span className="text-emerald-600 font-black">• Các Sà Lan cập chung một vị trí (Lớp 2, 3...) sẽ tự động dàn ngang nối tiếp nhau như xếp hình để không bị che khuất.</span>`;
const noteNew = `<span className="text-emerald-600 font-black">• Sà lan có Total Remain sẽ tự tính thời lượng = Remain ÷ Năng suất QC</span>
                <span className="text-purple-600 font-black">• Lớp 2+ tự snap sau khi Lớp dưới hoàn thành (Snap-to-Finish)</span>`;
if (c.includes(noteOld)) {
    c = c.replace(noteOld, noteNew);
    changes++;
    console.log("[9] Updated footer note");
}

// =====================================================
// WRITE OUTPUT
// =====================================================
fs.writeFileSync('src/pages/BerthSimulationLive.jsx', c);
console.log(`\n=== DONE: ${changes} changes applied ===`);
