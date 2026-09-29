const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src/app/index.css');
let css = fs.readFileSync(cssPath, 'utf8');
css = css.replace('.svc-table input,\n  .svc-table select {', '.svc-table input,\n  .svc-table select,\n  .svc-table textarea {');
css = css.replace('.svc-table .cell,\n  .svc-table .cell.num,\n  .svc-table input,\n  .svc-table select {', '.svc-table .cell,\n  .svc-table .cell.num,\n  .svc-table input,\n  .svc-table textarea,\n  .svc-table select {');
fs.writeFileSync(cssPath, css, 'utf8');

const bPath = path.join(__dirname, 'src/features/capacity/pages/CapacityBoard.jsx');
let b = fs.readFileSync(bPath, 'utf8');
const search = '<input\\s+className="cell"\\s+value=\\{raw\\.vesselName \\|\\| \'\'\\}\\s+placeholder=\\{t\\(\'window\\.vesselPlaceholder\'\\)\\}\\s+onChange=\\{\\(e\\) => updateService\\(row\\.id, \\{ vesselName: e\\.target\\.value \\}\\)\\}\\s+/>';
const replace = '<textarea className="cell" rows={2} style={{ resize: "none", overflow: "hidden", minHeight: "2.4rem", background: "transparent", border: "none", color: "inherit", outline: "none", textAlign: "center" }} value={raw.vesselName || ""} placeholder={t("window.vesselPlaceholder")} onChange={(e) => updateService(row.id, { vesselName: e.target.value })} />';
b = b.replace(new RegExp(search), replace);
fs.writeFileSync(bPath, b, 'utf8');

console.log('done');
