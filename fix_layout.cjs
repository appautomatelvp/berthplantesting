const fs = require('fs');
let p = 'src/app/index.css';
let s = fs.readFileSync(p, 'utf8');

// Replace the last rules in index.css
let toReplace = `
.berth-plan-drawer .field-check-grid.drawer-checks {
    grid-template-columns: 1fr 1fr !important;
    gap: 0.4rem;
}
.berth-plan-drawer .field-check {
    flex-direction: column-reverse !important;
    align-items: flex-start !important;
    justify-content: space-between !important;
    min-height: 70px;
    padding: 0.5rem 0.6rem !important;
    white-space: normal;
}
.berth-plan-drawer .field-check input[type="checkbox"] {
    align-self: flex-end;
}`;

let replacement = `
.berth-plan-drawer .field-check-grid.drawer-checks {
    grid-template-columns: 1fr !important;
    gap: 0.4rem;
}
.berth-plan-drawer .field-check {
    display: flex;
    flex-direction: row-reverse !important;
    align-items: center !important;
    justify-content: space-between !important;
    min-height: auto;
    padding: 0.5rem 0.75rem !important;
    white-space: normal;
}
.berth-plan-drawer .field-check input[type="checkbox"] {
    align-self: auto;
    margin: 0 !important;
}`;

s = s.replace(toReplace, replacement);
fs.writeFileSync(p, s, 'utf8');
