const fs = require('fs');
let c = fs.readFileSync('public/operation.html', 'utf8');
let changes = 0;

// =====================================================
// 1. AUTO-SAVE originalData to localStorage after processing
// =====================================================
const saveAnchor = "populateGlobalVesselColorMap(originalData);";
if (c.includes(saveAnchor) && !c.includes('cmit_op_originalData')) {
    c = c.replace(saveAnchor, 
        `populateGlobalVesselColorMap(originalData);
                    // AUTO-SAVE: Lưu originalData vào localStorage để khôi phục khi chuyển tab
                    try { localStorage.setItem('cmit_op_originalData', JSON.stringify(originalData)); console.log('[LocalStorage] Đã lưu ' + originalData.length + ' dòng.'); } catch(e) { console.warn('[LocalStorage] Lỗi lưu:', e); }`);
    changes++;
    console.log("[1] Added localStorage save after data processing");
} else if (c.includes('cmit_op_originalData')) {
    console.log("[1] SKIP: Already exists");
} else {
    console.log("[1] ERROR: Could not find anchor");
}

// =====================================================
// 2. AUTO-RESTORE originalData from localStorage on page load
// Insert right after the variable declarations block
// =====================================================
const restoreAnchor = "let originalData = [];";
if (c.includes(restoreAnchor) && !c.includes('// AUTO-RESTORE')) {
    c = c.replace(restoreAnchor,
        `let originalData = [];

        // AUTO-RESTORE: Khôi phục dữ liệu từ localStorage khi iframe tải lại (chuyển tab)
        try {
            const savedData = localStorage.getItem('cmit_op_originalData');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    originalData = parsed;
                    console.log('[LocalStorage] Đã khôi phục ' + originalData.length + ' dòng từ phiên trước.');
                    // Defer render đến sau khi DOM sẵn sàng
                    setTimeout(() => {
                        try {
                            if (typeof populateGlobalVesselColorMap === 'function') populateGlobalVesselColorMap(originalData);
                            if (typeof updateDisplay === 'function') updateDisplay();
                            if (typeof populateVesselSelector === 'function') populateVesselSelector();
                            if (typeof updateBargeNameDatalist === 'function') updateBargeNameDatalist();
                            if (typeof showStatus === 'function') showStatus('Đã khôi phục ' + originalData.length + ' dòng từ phiên làm việc trước.', 'success');
                        } catch(renderErr) { console.warn('[LocalStorage] Lỗi render:', renderErr); }
                    }, 1500);
                }
            }
        } catch(e) { console.warn('[LocalStorage] Lỗi khôi phục:', e); }`);
    changes++;
    console.log("[2] Added localStorage auto-restore on page load");
} else if (c.includes('// AUTO-RESTORE')) {
    console.log("[2] SKIP: Already exists");
} else {
    console.log("[2] ERROR: Could not find anchor");
}

fs.writeFileSync('public/operation.html', c);
console.log(`\n=== DONE: ${changes} changes applied to operation.html ===`);
