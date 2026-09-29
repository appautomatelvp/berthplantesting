const fs = require('fs');
let p = 'src/app/index.css';
let lines = fs.readFileSync(p, 'utf8').split('\n');

// Find the last occurrences and replace them
let start = lines.findIndex(l => l.includes('.field-check {') && lines.slice(lines.indexOf(l)).some(x => x.includes('row-reverse')));
// Actually it's easier to just read the file and replace the end.

let s = fs.readFileSync(p, 'utf8');

// I will just use regex to remove the appended overrides and replace with the correct one.
// The overrides are at the bottom.
s = s.replace(/\.field-check \{\s*justify-content: space-between !important;\s*flex-direction: row-reverse !important;\s*\}/, "");

let replacement = 
.berth-plan-drawer .field-check-grid.drawer-checks {
    grid-template-columns: 1fr 1fr !important;
    gap: 0.4rem;
}
.berth-plan-drawer .drawer-checks .field-check {
    flex-direction: column-reverse !important;
    align-items: flex-start !important;
    justify-content: space-between !important;
    min-height: 70px;
    padding: 0.5rem 0.6rem !important;
    white-space: normal;
}
.berth-plan-drawer .drawer-checks .field-check input[type="checkbox"] {
    align-self: flex-end;
}
;

s = s.replace(/\.berth-plan-drawer \.field-check-grid\.drawer-checks \{\s*grid-template-columns: repeat\(auto-fill, minmax\(110px, 1fr\)\) !important;\s*\}/, "");
s = s.replace(/\.berth-plan-drawer \.field-check \{\s*justify-content: space-between !important;\s*flex-direction: row-reverse !important;\s*\}/, "");

s += replacement;

fs.writeFileSync(p, s, 'utf8');
