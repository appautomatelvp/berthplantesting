/**
 * Cross-check engine against Excel Berthing Window reference numbers.
 * Run: npm run verify
 */
import { calcBerthCapacity, calcEquipmentCapacity } from '../src/lib/capacity/engine.js';
import {
  DEFAULT_EQUIPMENT,
  DEFAULT_METRICS,
  DEFAULT_SERVICES,
  DEFAULT_TERMINAL,
} from '../src/data/seed.js';

const berth = calcBerthCapacity({
  services: DEFAULT_SERVICES,
  terminal: DEFAULT_TERMINAL,
  metrics: DEFAULT_METRICS,
});
const equip = calcEquipmentCapacity(DEFAULT_EQUIPMENT);

const expect = {
  mainlineMH: 63887,
  bargeMH: 33145,
  totalMH: 97032,
  bu: 0.961,
  stsMoves: 1128288,
};

function near(a, b, tol = 50) {
  return Math.abs(a - b) <= tol;
}

const checks = [
  ['Mainline MH/week', berth.mainlineMeterHours, expect.mainlineMH, 80],
  ['Barge MH/week', berth.bargeMeterHours, expect.bargeMH, 80],
  ['Total MH/week', berth.proformaMeterHoursWeek, expect.totalMH, 100],
  ['BU', berth.berthUtilization, expect.bu, 0.01],
  ['STS capacity', equip.quayMoves, expect.stsMoves, 5],
];

let ok = true;
for (const [name, got, exp, tol] of checks) {
  const pass = near(got, exp, tol);
  ok &&= pass;
  console.log(
    `${pass ? 'OK' : 'FAIL'}  ${name}: got=${got.toFixed?.(2) ?? got} expected≈${exp}`
  );
}

console.log('\nDetail:');
console.log('  available MH/week', berth.availableMeterHoursWeek);
console.log('  available MH/year', berth.availableMeterHoursYear);
console.log('  services', berth.services.map((s) => `${s.service}:${s.meterHours.toFixed(0)}`).join(', '));
console.log('  barge', berth.barge);

if (!ok) process.exit(1);
console.log('\nAll reference checks passed.');
