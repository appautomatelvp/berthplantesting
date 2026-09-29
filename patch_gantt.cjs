const fs = require('fs');
let c = fs.readFileSync('src/pages/BerthSimulationLive.jsx', 'utf8');
let changes = 0;

// =====================================================
// 7. DYNAMIC DURATION + TIERED SNAP in renderScheduleMap
// =====================================================
const anchor7 = '{/* RENDER CÁC KHỐI TÀU LÊN GANTT CHART */}';
const oldMapOpen = '{vessels.map((vessel, index) => {';
const oldEtaLine = 'const vEtaMs = new Date(vessel.eta).getTime();';
const oldEtdLine = "const vEtdMs = new Date(vessel.etd || getEtdFallback(vessel.eta)).getTime();";

if (c.includes(anchor7) && c.includes(oldMapOpen) && !c.includes('effectiveTimes')) {
    // Find the start of the render block
    const anchorIdx = c.indexOf(anchor7);
    const mapOpenIdx = c.indexOf(oldMapOpen, anchorIdx);
    const etdLineIdx = c.indexOf(oldEtdLine, mapOpenIdx);
    const afterEtdLine = etdLineIdx + oldEtdLine.length;
    
    // Build the replacement: from anchor7 to after etdLine
    const originalBlock = c.substring(anchorIdx, afterEtdLine);
    
    const newBlock = `{/* RENDER CÁC KHỐI TÀU LÊN GANTT CHART */}
                        {(() => {
                            // === TIERED SCHEDULING: Pre-compute effective ETD ===
                            const effectiveTimes = {};
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
                                    const overlapping = vessels.filter(other => {
                                        if (!other || other.id === barge.id || !effectiveTimes[other.id]) return false;
                                        if ((other.tier || 1) >= tier) return false;
                                        const bB = barge.bowPos || 0, bS = barge.sternPos || (bB + (barge.loa || 0));
                                        const oB = other.bowPos || 0, oS = other.sternPos || (oB + (other.loa || 0));
                                        return bB < oS && bS > oB;
                                    });
                                    if (overlapping.length > 0) {
                                        const latestEtd = Math.max(...overlapping.map(o => effectiveTimes[o.id].etd));
                                        const dur = effectiveTimes[barge.id].etd - effectiveTimes[barge.id].eta;
                                        effectiveTimes[barge.id].eta = latestEtd;
                                        effectiveTimes[barge.id].etd = latestEtd + dur;
                                    }
                                });
                            }
                            return vessels.map((vessel, index) => {
                            if (!vessel || !vessel.eta) return null;
                            const times = effectiveTimes[vessel.id];
                            if (!times) return null;
                            const vEtaMs = times.eta;
                            const vEtdMs = times.etd;`;
    
    c = c.replace(originalBlock, newBlock);
    changes++;
    console.log("[7a] Replaced render block with tiered scheduling");
} else if (c.includes('effectiveTimes')) {
    console.log("[7a] SKIP: effectiveTimes already exists");
} else {
    console.log("[7a] ERROR: Anchor check failed");
    console.log("  anchor7:", c.includes(anchor7));
    console.log("  oldMapOpen:", c.includes(oldMapOpen));
}

// Close the IIFE - replace the closing of vessels.map
// Find "})}$newline                    </div>" and replace with "});$newline                        })()}$newline                    </div>"
const closeAnchor = '• Trục ngang là Tọa độ Bến';
if (c.includes(closeAnchor) && c.includes('effectiveTimes')) {
    // Find the closing pattern: })}  followed by </div> before the footer
    const footerIdx = c.indexOf(closeAnchor);
    // Go backwards to find the closing "})}  </div>"
    const searchArea = c.substring(footerIdx - 300, footerIdx);
    
    // The pattern we need to change: "})}\n                    </div>"
    const closePat = '})}\n';
    const closePat2 = '})}\r\n';
    
    // Find the last occurrence of })} before the footer
    let replaceIdx = -1;
    let usedPat = '';
    const searchFrom = footerIdx - 300;
    for (let i = searchFrom; i < footerIdx; i++) {
        if (c.substring(i, i + closePat2.length) === closePat2) {
            replaceIdx = i;
            usedPat = closePat2;
        } else if (c.substring(i, i + closePat.length) === closePat) {
            replaceIdx = i;
            usedPat = closePat;
        }
    }
    
    if (replaceIdx !== -1) {
        const before = c.substring(0, replaceIdx);
        const after = c.substring(replaceIdx + usedPat.length);
        c = before + '});\n                        })()}\n' + after;
        changes++;
        console.log("[7b] Fixed IIFE closing");
    } else {
        console.log("[7b] ERROR: Could not find closing })} pattern");
    }
}

// =====================================================
// 8. Show totalRemain badge on Gantt block header
// =====================================================
const headerOld = '{isBarge && vesselTier > 1 && <span className="bg-red-500 px-1 rounded text-[6px] flex-shrink-0">T{vesselTier}</span>}';
if (c.includes(headerOld) && !c.includes('totalRemain badge')) {
    const headerNew = `{/* totalRemain badge */}
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {isBarge && vessel.totalRemain > 0 && <span className="bg-amber-500 px-1 rounded text-[6px]">{vessel.totalRemain}c</span>}
                                                {isBarge && vesselTier > 1 && <span className="bg-red-500 px-1 rounded text-[6px]">T{vesselTier}</span>}
                                            </div>`;
    c = c.replace(headerOld, headerNew);
    changes++;
    console.log("[8] Added totalRemain badge to Gantt header");
} else {
    console.log("[8] SKIP/ERROR");
}

// =====================================================
// 9. Update time display to use effectiveTimes
// =====================================================
const oldTimeDown = "new Date(vessel.eta).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})";
const newTimeDown = "new Date(vEtaMs).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})";
if (c.includes(oldTimeDown)) {
    // Only replace inside the schedule map section (after effectiveTimes)
    const schedIdx = c.indexOf('effectiveTimes');
    if (schedIdx !== -1) {
        const firstOccurrence = c.indexOf(oldTimeDown, schedIdx);
        if (firstOccurrence !== -1) {
            c = c.substring(0, firstOccurrence) + newTimeDown + c.substring(firstOccurrence + oldTimeDown.length);
            changes++;
            console.log("[9a] Updated ETA time display");
        }
    }
}

const oldTimeUp = "new Date(vessel.etd || getEtdFallback(vessel.eta)).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})";
const newTimeUp = "new Date(vEtdMs).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})";
if (c.includes(oldTimeUp)) {
    const schedIdx = c.indexOf('effectiveTimes');
    if (schedIdx !== -1) {
        const firstOccurrence = c.indexOf(oldTimeUp, schedIdx);
        if (firstOccurrence !== -1) {
            c = c.substring(0, firstOccurrence) + newTimeUp + c.substring(firstOccurrence + oldTimeUp.length);
            changes++;
            console.log("[9b] Updated ETD time display");
        }
    }
}

// Also update tooltip
const oldTooltipEtd = "ETD: ${new Date(vessel.etd || getEtdFallback(vessel.eta)).toLocaleString('vi-VN')}";
const newTooltipEtd = "ETD: ${new Date(vEtdMs).toLocaleString('vi-VN')}";
if (c.includes(oldTooltipEtd)) {
    const schedIdx = c.indexOf('effectiveTimes');
    if (schedIdx !== -1) {
        const idx = c.indexOf(oldTooltipEtd, schedIdx);
        if (idx !== -1) {
            c = c.substring(0, idx) + newTooltipEtd + c.substring(idx + oldTooltipEtd.length);
            changes++;
            console.log("[9c] Updated tooltip ETD");
        }
    }
}

const oldTooltipEta = "ETA: ${new Date(vessel.eta).toLocaleString('vi-VN')}";
const newTooltipEta = "ETA: ${new Date(vEtaMs).toLocaleString('vi-VN')}";
if (c.includes(oldTooltipEta)) {
    const schedIdx = c.indexOf('effectiveTimes');
    if (schedIdx !== -1) {
        const idx = c.indexOf(oldTooltipEta, schedIdx);
        if (idx !== -1) {
            c = c.substring(0, idx) + newTooltipEta + c.substring(idx + oldTooltipEta.length);
            changes++;
            console.log("[9d] Updated tooltip ETA");
        }
    }
}

fs.writeFileSync('src/pages/BerthSimulationLive.jsx', c);
console.log(`\n=== DONE: ${changes} changes applied ===`);
