const fs = require('fs');
let c = fs.readFileSync('src/pages/BerthSimulationLive.jsx', 'utf8');

// We need to do a few things:
// 1. Add states for selectionBox and selectedVesselIds
const stateAnchor = "const [activeVesselId, setActiveVesselId] = useState(null);";
const stateNew = `const [activeVesselId, setActiveVesselId] = useState(null);
  const [selectedVesselIds, setSelectedVesselIds] = useState([]); // MULTI-SELECT
  const [selectionBox, setSelectionBox] = useState(null); // MULTI-SELECT BOX`;

c = c.replace(stateAnchor, stateNew);

// 2. Modify handleMouseDown
const handleMouseDownOld = `if (type === 'map') {
            dragStartRef.current = {
                type: 'map',
                startX: e.clientX,
                startY: e.clientY,
                startPanX: panOffset.x,
                startPanY: panOffset.y,
                hasMoved: false
            };
        }`;
const handleMouseDownNew = `if (type === 'map') {
            if (e.shiftKey) {
                // MULTI-SELECT START
                dragStartRef.current = { type: 'select', startX: e.clientX, startY: e.clientY };
                setSelectionBox({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
            } else {
                dragStartRef.current = {
                    type: 'map',
                    startX: e.clientX,
                    startY: e.clientY,
                    startPanX: panOffset.x,
                    startPanY: panOffset.y,
                    hasMoved: false
                };
                setSelectedVesselIds([]); // click ngoài map thì clear chọn nhiều
            }
        }`;

c = c.replace(handleMouseDownOld, handleMouseDownNew);

// 3. Modify handleMouseMove inside useEffect
// We need to inject the update logic for selection box
// Look for "if (dragStartRef.current.type === 'map') {"
const mouseMoveAnchor = `if (dragStartRef.current.type === 'map') {
                dragStartRef.current.hasMoved = true;
                const dx = e.clientX - dragStartRef.current.startX;
                const dy = e.clientY - dragStartRef.current.startY;
                setPanOffset({
                    x: dragStartRef.current.startPanX + dx,
                    y: dragStartRef.current.startPanY + dy
                });
            }`;
const mouseMoveNew = `if (dragStartRef.current.type === 'select') {
                setSelectionBox(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
            } else if (dragStartRef.current.type === 'map') {
                dragStartRef.current.hasMoved = true;
                const dx = e.clientX - dragStartRef.current.startX;
                const dy = e.clientY - dragStartRef.current.startY;
                setPanOffset({
                    x: dragStartRef.current.startPanX + dx,
                    y: dragStartRef.current.startPanY + dy
                });
            }`;

c = c.replace(mouseMoveAnchor, mouseMoveNew);

// 4. Modify handleMouseUp
const mouseUpAnchor = `if (!isDragging) return;`;
// Insert before isDragging is set to false
const mouseUpNew = `if (dragStartRef.current && dragStartRef.current.type === 'select' && selectionBox) {
            // FINALIZE MULTI-SELECT
            const left = Math.min(selectionBox.startX, selectionBox.currentX);
            const right = Math.max(selectionBox.startX, selectionBox.currentX);
            const top = Math.min(selectionBox.startY, selectionBox.currentY);
            const bottom = Math.max(selectionBox.startY, selectionBox.currentY);
            
            // Collect overlapping vessels by their DOM nodes
            const newSelectedIds = [];
            vessels.forEach(v => {
                const el = document.getElementById('vessel-node-' + v.id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    // Check intersection
                    if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) {
                        newSelectedIds.push(v.id);
                    }
                }
            });
            if (newSelectedIds.length > 0) {
                setSelectedVesselIds(newSelectedIds);
                setActiveVesselId(null);
            }
            setSelectionBox(null);
        }
        
        if (!isDragging) return;`;

c = c.replace(mouseUpAnchor, mouseUpNew);

// 5. Add id="vessel-node-{id}" to vessels and highlight border if selected
// Find: className={\`absolute top-1/2 -translate-y-1/2 shadow-2xl transition-all duration-300 group \${activeVesselId === vessel.id ? 'ring-2 ring-white/80 scale-105 z-50' : 'hover:scale-105 z-10'}\`}
const vesselDivOld = /className={`absolute top-1\/2 -translate-y-1\/2 shadow-2xl transition-all duration-300 group \${activeVesselId === vessel.id \? 'ring-2 ring-white\/80 scale-105 z-50' : 'hover:scale-105 z-10'}`}/g;
const vesselDivNew = `id={'vessel-node-' + vessel.id} className={\`absolute top-1/2 -translate-y-1/2 shadow-2xl transition-all duration-300 group \${activeVesselId === vessel.id || selectedVesselIds.includes(vessel.id) ? 'ring-4 ring-yellow-400 scale-105 z-50' : 'hover:scale-105 z-10'}\`}`;

c = c.replace(vesselDivOld, vesselDivNew);

// Also need to add id to barges too. Let's just find the main map render loop.
// Actually, it's easier to find `<div key={vessel.id}` or similar in the map.
// Let's replace the general barge/vessel div inside the map.
c = c.replace(/<div key=\{vessel\.id\} onMouseDown=\{\(e\) => handleMouseDown\(e, vessel\.type, vessel\.id\)\}/g, 
              `<div id={'vessel-node-' + vessel.id} key={vessel.id} onMouseDown={(e) => handleMouseDown(e, vessel.type, vessel.id)}`);

c = c.replace(/\${activeVesselId === vessel\.id \? 'ring-2 ring-white\/80/g, 
              `\${(activeVesselId === vessel.id || selectedVesselIds.includes(vessel.id)) ? 'ring-4 ring-yellow-400/80`);

// 6. Render Selection Box overlay
const overlayAnchor = `{/* GLOBAL GUIDE LINES */}`;
const overlayNew = `{/* MULTI-SELECT BOX */}
                {selectionBox && (
                    <div className="fixed border border-blue-500 bg-blue-500/20 pointer-events-none z-[9999]" 
                         style={{
                             left: Math.min(selectionBox.startX, selectionBox.currentX),
                             top: Math.min(selectionBox.startY, selectionBox.currentY),
                             width: Math.abs(selectionBox.currentX - selectionBox.startX),
                             height: Math.abs(selectionBox.currentY - selectionBox.startY)
                         }} />
                )}
                
                {/* GLOBAL GUIDE LINES */}`;

c = c.replace(overlayAnchor, overlayNew);

// 7. Add Floating "Delete Selected" button
const deleteBtnAnchor = `{/* Bản đồ Berth Simulation */}`;
const deleteBtnNew = `{selectedVesselIds.length > 0 && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] bg-white px-4 py-2 rounded-xl shadow-2xl border border-red-200 flex items-center gap-4 animate-bounce">
                <span className="text-sm font-black text-red-600">Đã chọn {selectedVesselIds.length} phương tiện</span>
                <button onClick={() => {
                    if(confirm('Xóa ' + selectedVesselIds.length + ' phương tiện đã chọn?')) {
                        const newVs = vessels.filter(v => !selectedVesselIds.includes(v.id));
                        setVessels(newVs);
                        syncToCloud(newVs);
                        setSelectedVesselIds([]);
                    }
                }} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase shadow-md flex items-center gap-2 transition-all">
                    <Trash2 size={14}/> Xóa Tất Cả
                </button>
                <button onClick={() => setSelectedVesselIds([])} className="text-slate-400 hover:text-slate-600">
                    <X size={14}/>
                </button>
            </div>
        )}
        
        {/* Bản đồ Berth Simulation */}`;

c = c.replace(deleteBtnAnchor, deleteBtnNew);

// 8. Add POW Auto-fill button next to Settings gear
// Search for Settings2
const settingsAnchor = `<div className="relative group pointer-events-auto">
                        <button className="p-2.5 rounded-xl border border-slate-200 shadow-lg bg-white/90 hover:bg-slate-50 text-slate-600 transition-all active:scale-95 flex items-center justify-center">
                            <Settings2 size={18} />
                        </button>`;
const powButtonNew = `<button onClick={() => {
                        try {
                            const raw = localStorage.getItem('cmit_op_originalData');
                            if(!raw) { alert('Không có dữ liệu P.O.W (Hãy vào Operation upload file Excel trước)'); return; }
                            const data = JSON.parse(raw);
                            const powBarges = data.filter(d => d.powGroup || (d.status && d.status.toUpperCase().includes('POW')) || (d.pcn && d.pcn.includes('POW')));
                            if(powBarges.length === 0) { alert('Không tìm thấy sà lan P.O.W trong dữ liệu'); return; }
                            
                            // Auto fill logic
                            let newVs = [...vessels];
                            let currentX = 0;
                            powBarges.forEach(pb => {
                                const exists = newVs.find(v => v.name === pb.bargeName);
                                if(!exists) {
                                    const bLoa = Number(pb.loa) || 50;
                                    newVs.push({
                                        id: 'pow-' + Date.now() + Math.random(),
                                        type: 'barge',
                                        name: pb.bargeName || 'POW BARGE',
                                        loa: bLoa,
                                        totalRemain: Number(pb.totalRemain) || 0,
                                        eta: new Date().toISOString(),
                                        tier: 1,
                                        bowPos: currentX,
                                        sternPos: currentX + bLoa,
                                        color: '#3b82f6',
                                        isPow: true
                                    });
                                    currentX += bLoa + 10;
                                }
                            });
                            setVessels(newVs);
                            syncToCloud(newVs);
                            alert('Đã cập nhật và tự động xếp ' + powBarges.length + ' sà lan P.O.W!');
                        } catch(e) { console.error(e); alert('Lỗi xử lý P.O.W'); }
                    }} className="p-2.5 rounded-xl border border-blue-200 shadow-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2">
                        <Download size={14} /> P.O.W Auto-Fill
                    </button>
                    
                    <div className="relative group pointer-events-auto">
                        <button className="p-2.5 rounded-xl border border-slate-200 shadow-lg bg-white/90 hover:bg-slate-50 text-slate-600 transition-all active:scale-95 flex items-center justify-center">
                            <Settings2 size={18} />
                        </button>`;

c = c.replace(settingsAnchor, powButtonNew);

// Update note about Shift+Drag
const guideAnchor = `<p className="text-[10px] font-black text-slate-500 flex items-center gap-2"><Hand size={14}/> Kéo chuột vào nền để di chuyển bản đồ</p>`;
const guideNew = `<p className="text-[10px] font-black text-slate-500 flex items-center gap-2"><Hand size={14}/> Chuột trái: Di chuyển bản đồ &nbsp;|&nbsp; Shift + Kéo chuột: Bôi đen chọn nhiều sà lan</p>`;
c = c.replace(guideAnchor, guideNew);

fs.writeFileSync('src/pages/BerthSimulationLive.jsx', c);
console.log('Done patching BerthSimulationLive.jsx');
