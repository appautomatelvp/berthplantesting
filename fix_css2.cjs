const fs = require('fs');
let p = 'src/app/index.css';
let s = fs.readFileSync(p, 'utf8');

s = s.replace(/\.field-check \{\s*justify-content: space-between !important;\s*flex-direction: row-reverse !important;\s*\}/g, "");
s = s.replace(/\.berth-plan-drawer \.field-check-grid\.drawer-checks \{\s*grid-template-columns: repeat\(auto-fill, minmax\(110px, 1fr\)\) !important;\s*\}/g, "");
s = s.replace(/\.berth-plan-drawer \.field-check \{\s*justify-content: space-between !important;\s*flex-direction: row-reverse !important;\s*\}/g, "");
s = s.replace(/\.field-check \{\s*justify-content: flex-start;\s*text-align: left;\s*\}/g, "");
s = s.replace(/\.berth-plan-drawer \.field-check-grid\.drawer-checks \{\s*grid-template-columns: 1fr 1fr;\s*gap: 0.35rem 0.5rem;\s*\}/g, "");

let replacement = `
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
`;

s += replacement;

fs.writeFileSync(p, s, 'utf8');
