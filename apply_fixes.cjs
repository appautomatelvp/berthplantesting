const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src/app/index.css');
let css = fs.readFileSync(cssPath, 'utf8');
css += '\n.svc-table { min-width: 0 !important; word-wrap: break-word; }\n.svc-table th, .svc-table td, .svc-table th.num, .svc-table td.num { white-space: normal !important; overflow-wrap: anywhere !important; line-height: 1.15; padding: 0.15rem; }\n.svc-table input, .svc-table select, .svc-table textarea { white-space: normal !important; }\n';
fs.writeFileSync(cssPath, css, 'utf8');

const tPath = path.join(__dirname, 'src/shared/i18n/translations.js');
let t = fs.readFileSync(tPath, 'utf8');
t = t.replace("volumeChange: 'L?ch s?n l??ng %'", "volumeChange: 'L?ch SL(%)'");
t = t.replace("timeChange: 'L?ch gi? c?p %'", "timeChange: 'L?ch GC(%)'");
t = t.replace("netStay: 'Portstay t?nh (h)'", "netStay: 'Portstay(h)'");
t = t.replace("berthH: 'Gi? c?u (h)'", "berthH: 'Gi? c?u(h)'");
t = t.replace("crane: 'M?t ?? c?u'", "crane: 'M?t ??'");
fs.writeFileSync(tPath, t, 'utf8');

const bPath = path.join(__dirname, 'src/features/capacity/pages/CapacityBoard.jsx');
let b = fs.readFileSync(bPath, 'utf8');
b = b.replace("{t('window.proformaVolume')}", "'PROFORMA'");
b = b.replace("{t('window.expectedVolume')}", "'D? KI?N'");
fs.writeFileSync(bPath, b, 'utf8');

console.log('done');
