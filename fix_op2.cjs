const fs = require('fs');
let c = fs.readFileSync('public/operation.html', 'utf8');

const betterFunc = `        // === INITIALIZATION PROGRESS BAR ===
        window.updateProgress = function(percent, label) {
            const bar = document.getElementById('initProgressBar');
            const lbl = document.getElementById('initProgressLabel');
            const pct = document.getElementById('initProgressPercent');
            if (bar) bar.style.width = percent + '%';
            if (lbl) lbl.textContent = label || '';
            if (pct) pct.textContent = Math.round(percent) + '%';
            if (percent >= 100) {
                setTimeout(() => {
                    const container = document.getElementById('initProgressContainer');
                    if (container) container.style.display = 'none';
                }, 1500);
            }
        }

        // --- Start the App ---
        document.addEventListener('DOMContentLoaded', () => {`;

// Replace using a regex to handle both \n and \r\n
c = c.replace(/\s*\/\/\s*---\s*Start the App\s*---\s*\r?\n\s*document\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*\{/, '\n\n' + betterFunc);

fs.writeFileSync('public/operation.html', c);
console.log("Restored updateProgress");
