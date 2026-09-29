const fs = require('fs');
let c = fs.readFileSync('public/operation.html', 'utf8');

// 1. Remove <h1>OPERATION OVERVIEW</h1> to save space
c = c.replace('<h1 class="text-3xl md:text-4xl font-bold text-white uppercase">OPERATION OVERVIEW</h1>', '');
// Reduce header margin
c = c.replace('<header class="text-center mb-2 relative">', '<header class="text-center relative">');
c = c.replace('<div id="initProgressContainer" class="mt-3 w-full max-w-md mx-auto">', '<div id="initProgressContainer" class="mt-1 w-full max-w-md mx-auto">');

// 2. Fix updateProgress scope
// Remove it from inside DOMContentLoaded
const badFunc = `        function updateProgress(percent, label) {
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
        }`;

// Replace with empty string (it was at line 8580)
if (c.includes(badFunc)) {
    c = c.replace(badFunc, '');
} else {
    console.log("Could not find bad updateProgress to remove!");
}

// And place it right BEFORE DOMContentLoaded as a global window property
const goodFunc = `        // === INITIALIZATION PROGRESS BAR ===
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
        };

        // --- Start the App ---
        document.addEventListener('DOMContentLoaded', () => {`;

c = c.replace(`        // --- Start the App ---\n        document.addEventListener('DOMContentLoaded', () => {`, goodFunc);

// 3. Update calls to updateProgress inside DOMContentLoaded?
// It can just be window.updateProgress now, but wait, updateProgress(...) still works if we declare it as window.updateProgress, we should update the calls to window.updateProgress or define a global var updateProgress = window.updateProgress. Actually, assigning to window.updateProgress makes it available globally as updateProgress.
// Just to be safe, I will change window.updateProgress = to just function updateProgress(...) outside DOMContentLoaded!
const betterFunc = `        // === INITIALIZATION PROGRESS BAR ===
        function updateProgress(percent, label) {
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
        window.updateProgress = updateProgress;

        // --- Start the App ---
        document.addEventListener('DOMContentLoaded', () => {`;

c = c.replace(goodFunc, betterFunc);
if(!c.includes(betterFunc)) { // Try replacing again if goodFunc wasn't found (meaning it replaced the original marker)
    c = c.replace(`        // --- Start the App ---\n        document.addEventListener('DOMContentLoaded', () => {`, betterFunc);
}

fs.writeFileSync('public/operation.html', c);
console.log("Fixed operation.html");
