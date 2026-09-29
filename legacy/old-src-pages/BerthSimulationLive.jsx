import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, collection, deleteDoc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { 
  Ship, Anchor, Clock, Package, Info, Plus, Trash2, 
  Save, Navigation, ClipboardList, AlertCircle, MapPin, 
  ArrowRight, Settings2, Activity, Database, 
  Download, LayoutDashboard, History, MoveHorizontal, Zap, Maximize2, Layers, Crosshair, ChevronsUp, ChevronsDown,
  ZoomIn, ZoomOut, Focus, EyeOff, Eye, Search, X, UploadCloud, FileText, CheckCircle, ScanSearch, Printer, ChevronLeft, ChevronRight,
  Lock, Unlock, Image as ImageIcon, Check, CalendarDays, Minus
} from 'lucide-react';

// --- CONFIGURATION DATA ---
const CMIT_BOLLARDS = [
  { id: 1, pos: 6 }, { id: 2, pos: 24 }, { id: 3, pos: 42 }, { id: 4, pos: 59 },
  { id: 5, pos: 77 }, { id: 6, pos: 95 }, { id: 7, pos: 113 }, { id: 8, pos: 131 },
  { id: 9, pos: 148 }, { id: 10, pos: 166 }, { id: 11, pos: 184 }, { id: 12, pos: 202 },
  { id: 13, pos: 220 }, { id: 14, pos: 237 }, { id: 15, pos: 255 }, { id: 16, pos: 273 },
  { id: 17, pos: 291 }, { id: 18, pos: 309 }, { id: 19, pos: 326 }, { id: 20, pos: 344 },
  { id: 21, pos: 362 }, { id: 22, pos: 380 }, { id: 23, pos: 398 }, { id: 24, pos: 415 },
  { id: 25, pos: 433 }, { id: 26, pos: 451 }, { id: 27, pos: 469 }, { id: 28, pos: 487 },
  { id: 29, pos: 504 }, { id: 30, pos: 522 }, { id: 31, pos: 540 }, { id: 32, pos: 558 },
  { id: 33, pos: 576 }, { id: 34, pos: 599 }
];

const QC_RANGES = [
  { id: 'qc7', name: 'QC07', start: 15, end: 430, color: '#8b5cf6' },
  { id: 'qc1', name: 'QC01', start: 30, end: 458, color: '#2563eb' },
  { id: 'qc2', name: 'QC02', start: 58, end: 486, color: '#eab308' },
  { id: 'qc3', name: 'QC03', start: 86, end: 514, color: '#166534' },
  { id: 'qc4', name: 'QC04', start: 220, end: 542, color: '#22c55e' },
  { id: 'qc5', name: 'QC05', start: 248, end: 570, color: '#84cc16' },
  { id: 'qc6', name: 'QC06', start: 276, end: 585, color: '#dc2626' },
];
const QC_LOCKED_ORDER_IDS = ['qc6', 'qc5', 'qc4', 'qc3', 'qc2', 'qc1', 'qc7'];
const QC_MIN_SPACING = 35;
const BARGE_EDGE_SAFETY_M = 8;
const BARGE_BOW_SAFETY_FROM_VESSEL_M = 40;
const AUTO_FILL_MIN_BARGE_LOA = 69; // 4 bays and above
const AUTO_FILL_QC_MAINT_BUFFER_M = 20;
const AUTO_FILL_MAINT_ZONE_BUFFER_M = 5;
const LARGE_VESSEL_LOA_THRESHOLD_M = 300;

const BARGE_PRESETS = [
  { loa: 57, bays: '3 BAYS' },
  { loa: 87, bays: '5 BAYS' },
  { loa: 75, bays: '4.5 BAYS' },
  { loa: 81, bays: '4.5 BAYS' },
  { loa: 69, bays: '4 BAYS' },
  { loa: 63, bays: '3.5 BAYS' },
  { loa: 45, bays: '2 BAYS' }
];

const RAW_VESSELS = [
  { name: "ADRIAN MAERSK", loa: 352, remark: "- Bay 02, 06: đứng dưới giật được lớp 5\n- Bay 10 -> 70: giật được lớp 6\n- Bay 74 -> lái: giật đươc lớp 5\n- Từ bay 21 -> mũi, lashing bridege 2 tier", flipHC: "- Flip HCs: 2 nắp hầm sông và bờ không thể đặt lên nắp giữa", twistlock: "GÙ 1 DÂY", reeferMotor: "ALL FACING AFT", gearBoxes: "9 X 20'", keelToHatch: "", keelToNav: "", keelToMast: "", bowToCabin: 249 },
  { name: "CAUQUENES", loa: 300, remark: "Cabin giữa bay 26-30, ống khói giữa bay 54-58", flipHC: "", twistlock: "GÙ TỰ ĐỘNG", reeferMotor: "", gearBoxes: "6X20'", keelToHatch: "", keelToNav: "", keelToMast: "", bowToCabin: 127 },
  { name: "VUNG TAU EXPRESS", loa: 300, remark: "Arrival draft: Fwd-11.70m & Aft-11.90m.", flipHC: "", twistlock: "SEMI-AUTOMATIC TWIST LOCKS", reeferMotor: "ALL FACING AFT", gearBoxes: "", keelToHatch: "27.25", keelToNav: "49.75", keelToMast: "", bowToCabin: 211 },
  { name: "ACX CRYSTAL", loa: 200 }
];

/** Nhịp đánh số bay 40' (chỉ số ô từ mũi = 0). */
const BAY_SCHEME_SINGLE_01_04_08 = 'single_01_04_08';
const BAY_SCHEME_PAIR_02_06_10 = 'pair_02_06_10';

const bayNumericFromScheme40ft = (indexFromBow, scheme) => {
  const i = Math.max(0, Number(indexFromBow) || 0);
  if (scheme === BAY_SCHEME_PAIR_02_06_10) return 2 + 4 * i;
  if (i === 0) return 1;
  return 1 + 3 + 4 * (i - 1);
};

/** Khoảng tối thiểu (m) từ mũi: tâm cabin phải gần mũi hơn tâm ống khói (chế độ tách). */
const MIN_BOW_DIST_CABIN_FUNNEL_M = 1;

/**
 * Chế độ tách và có ống khói (bowToFunnel > 0): luôn bowToCabin + gap ≤ bowToFunnel.
 * Liền: không đổi quan hệ (caller gán bowToFunnel = bowToCabin).
 */
const clampBowToCabinFunnelOrder = (loaM, bowToCabin, bowToFunnel, combined, funnelActive) => {
  const loa = Math.max(1, Number(loaM) || 1);
  const maxD = Math.max(5, loa - 5);
  let btc = Math.round(Number(bowToCabin) || 0);
  let btf = Math.round(Number(bowToFunnel) || 0);
  btc = Math.max(5, Math.min(maxD, btc));
  btf = Math.max(0, Math.min(maxD, btf));
  if (combined || !funnelActive || btf <= 0) {
    return { bowToCabin: btc, bowToFunnel: btf };
  }
  if (btc + MIN_BOW_DIST_CABIN_FUNNEL_M <= btf) {
    return { bowToCabin: btc, bowToFunnel: btf };
  }
  btf = Math.min(maxD, btc + MIN_BOW_DIST_CABIN_FUNNEL_M);
  if (btc + MIN_BOW_DIST_CABIN_FUNNEL_M > btf) {
    btc = Math.max(5, btf - MIN_BOW_DIST_CABIN_FUNNEL_M);
  }
  return { bowToCabin: btc, bowToFunnel: btf };
};

const normalizeMasterVesselProfile = (v = {}) => {
  const loa = Math.max(0, Number(v.loa || 0));
  const width = Math.round(((loa / 4.5) || 0) * 10) / 10;
  const cabinWidthM = Math.max(2, Math.round(Number(v.cabinWidthM != null ? v.cabinWidthM : 10) * 10) / 10);
  const funnelWidthM = Math.max(2, Math.round(Number(v.funnelWidthM != null ? v.funnelWidthM : 8) * 10) / 10);
  const bayMarkFirstEven = Math.max(0, Math.round(Number(v.bayMarkFirstEven != null ? v.bayMarkFirstEven : 2)));
  const bayMarkLastEven = Math.max(0, Math.round(Number(v.bayMarkLastEven != null ? v.bayMarkLastEven : 0)));
  const bayCellM = Math.max(1, Math.round(Number(v.bayCellM != null ? v.bayCellM : 12) * 10) / 10);
  const bayGapM = Math.max(0, Math.round(Number(v.bayGapM != null ? v.bayGapM : 2.5) * 10) / 10);
  const cabinBayGapM = Math.max(0, Math.round(Number(v.cabinBayGapM != null ? v.cabinBayGapM : 2.5) * 10) / 10);
  const cabinFunnelCombinedNorm =
    v.cabinFunnelCombined === false || v.cabinFunnelCombined === '0' ? false : true;
  let bowToCabinNorm = Math.max(0, Math.round(Number(v.bowToCabin || 0)));
  let bowToFunnelNorm = Math.max(0, Math.round(Number(v.bowToFunnel || 0)));
  const loaClamp = Math.max(1, loa || 200);
  if (!cabinFunnelCombinedNorm && bowToFunnelNorm > 0) {
    const ord = clampBowToCabinFunnelOrder(loaClamp, bowToCabinNorm, bowToFunnelNorm, false, true);
    bowToCabinNorm = ord.bowToCabin;
    bowToFunnelNorm = ord.bowToFunnel;
  }
  return {
    name: String(v.name || '').trim().toUpperCase(),
    voyage: String(v.voyage || 'TBU').trim().toUpperCase(),
    loa: loa || 200,
    width,
    bowToCabin: bowToCabinNorm,
    cabinWidthM,
    bowToFunnel: bowToFunnelNorm,
    funnelWidthM,
    bayMarkFirstEven,
    bayMarkLastEven,
    bayCellM,
    bayGapM,
    cabinBayGapM,
    remark: String(v.remark || '').toUpperCase(),
    flipHC: String(v.flipHC || '').toUpperCase(),
    twistlock: String(v.twistlock || '').toUpperCase(),
    reeferMotor: String(v.reeferMotor || '').toUpperCase(),
    gearBoxes: String(v.gearBoxes || '').toUpperCase(),
    keelToHatch: String(v.keelToHatch || '').toUpperCase(),
    keelToNav: String(v.keelToNav || '').toUpperCase(),
    keelToMast: String(v.keelToMast || '').toUpperCase(),
    operationDeckBays: String(v.operationDeckBays || '').trim(),
    /** Liền: một vị trí cabin+ống khói; tách: hai vị trí độc lập */
    cabinFunnelCombined: cabinFunnelCombinedNorm,
    /**
     * single_01_04_08: 01, 04, 08, 12… (ô 40' đơn nhìn từ mũi)
     * pair_02_06_10: 02, 06, 10, 14… (nhịp cặp / chẵn)
     */
    bayNumberingScheme:
      String(v.bayNumberingScheme || '').toLowerCase() === BAY_SCHEME_PAIR_02_06_10 ||
      String(v.bayNumberingScheme || '').toLowerCase() === 'pair'
        ? BAY_SCHEME_PAIR_02_06_10
        : BAY_SCHEME_SINGLE_01_04_08,
    /** Chỉ số khe trên biểu đồ Operation (sau full[c] — giữa full[c] và full[c+1]); SB: full[0]=lái. */
    operationCabinAfterFull: Number.isFinite(Number(v.operationCabinAfterFull))
      ? Math.max(0, Math.round(Number(v.operationCabinAfterFull)))
      : null,
    operationFunnelAfterFull: Number.isFinite(Number(v.operationFunnelAfterFull))
      ? Math.max(0, Math.round(Number(v.operationFunnelAfterFull)))
      : null,
    /** true = sort SB (mũi phải trên chart), false = PS */
    operationDeckSortSB: v.operationDeckSortSB === false ? false : true,
    /** Khe cabin/khói theo đúng nhãn Operation "Giữa aa – bb" (mũi = số nhỏ hơn, lái = số lớn hơn). */
    operationCabinGapBow: Number.isFinite(Number(v.operationCabinGapBow))
      ? Math.round(Number(v.operationCabinGapBow))
      : null,
    operationCabinGapStern: Number.isFinite(Number(v.operationCabinGapStern))
      ? Math.round(Number(v.operationCabinGapStern))
      : null,
    operationFunnelGapBow: Number.isFinite(Number(v.operationFunnelGapBow))
      ? Math.round(Number(v.operationFunnelGapBow))
      : null,
    operationFunnelGapStern: Number.isFinite(Number(v.operationFunnelGapStern))
      ? Math.round(Number(v.operationFunnelGapStern))
      : null
  };
};

const INITIAL_MASTER_VESSEL_DB = RAW_VESSELS.map(v => normalizeMasterVesselProfile(v));

/** Lỗi tạm thời / offline — không nên spam console.error (Firebase SDK vẫn có thể log WebChannel riêng). */
const isFirestoreConnectivityError = (err) => {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  if (code === 'unavailable' || code === 'deadline-exceeded') return true;
  if (msg.includes('client is offline')) return true;
  if (msg.includes('failed to get document')) return true;
  if (msg.includes('could not reach cloud firestore')) return true;
  if (msg.includes("backend didn't respond")) return true;
  if (msg.includes('network')) return true;
  if (msg.includes('failed to fetch')) return true;
  return false;
};

/**
 * Khoảng cách d đo từ MŨI về phía LÁI trên mạn (mũi d=0, lái d=LOA).
 * Mỗi ô bay: chiều dài bayCellM (40' ~12m), khe giữa các bay bayGapM, khe cabin–bay cabinGapM.
 * bowToCabinCenter: mũi → tâm cabin (m). cabinWidthM: bề ngang cabin (m).
 */
const computeBaySlotsFromCabinGeometry = (loaM, bowToCabinCenter, cabinWidthM, bayCellM = 12, bayGapM = 3, cabinGapM = 3) => {
  const loa = Math.max(0, Number(loaM) || 0);
  const dc = Math.max(0, Number(bowToCabinCenter) || 0);
  const cw = Math.max(0, Number(cabinWidthM) || 10);
  const cell = Math.max(1, Number(bayCellM) || 12);
  const gap = Math.max(0, Number(bayGapM) || 3);
  const cg = Math.max(0, Number(cabinGapM) || 3);
  const pitch = cell + gap;
  if (loa <= 0 || dc <= 0 || cw <= 0) return [];

  const cabinBowEdge = dc - cw / 2;
  const cabinSternEdge = dc + cw / 2;
  const forwardMaxBayEnd = cabinBowEdge - cg;
  const aftFirstBayStart = cabinSternEdge + cg;

  const slots = [];
  let k = 0;
  while (k * pitch + cell <= forwardMaxBayEnd + 1e-6) {
    slots.push({ fromBowStartM: k * pitch, segment: 'F', n: k + 1 });
    k += 1;
  }
  let j = 0;
  while (aftFirstBayStart + j * pitch + cell <= loa + 1e-6) {
    slots.push({ fromBowStartM: aftFirstBayStart + j * pitch, segment: 'A', n: j + 1 });
    j += 1;
  }
  return slots;
};

/** Thông thường ~72% chiều dài tàu dành cho dải ô container; ~28% còn lại cho cabin, ống khói, khoảng hở mũi/lái. */
const VESSEL_CARGO_LENGTH_FRACTION = 0.72;

/** Khe giữa các cột 40′ trên Operation — mặt cắt Berth giữ đúng (m); không thu nhỏ khe khi ép vừa LOA. */
const VESSEL_ELEVATION_CHART_GAP_M = 2.5;

/** Khe giữa các ô trên mặt cắt: tối thiểu 2,5 m; nếu hồ sơ tàu đặt lớn hơn thì dùng giá trị đó. */
const elevationInterBayGapM = (gapM) =>
  Math.max(VESSEL_ELEVATION_CHART_GAP_M, Math.max(0, Number(gapM) || 0));

/** Màu container kiểu minh họa vector (tham chiếu sách giáo khoa / infographic tàu chở hàng). */
const ELEVATION_CONTAINER_PALETTE = [
  '#b91c1c',
  '#dc2626',
  '#1d4ed8',
  '#2563eb',
  '#ca8a04',
  '#d97706',
  '#15803d',
  '#78716c',
  '#9a3412',
  '#7c3aed',
  '#0f766e',
  '#4338ca'
];

const elevationContainerFill = (bayIndex) =>
  ELEVATION_CONTAINER_PALETTE[Math.abs(Number(bayIndex) || 0) % ELEVATION_CONTAINER_PALETTE.length];

const svgSafeId = (raw) => String(raw || 'x').replace(/[^a-zA-Z0-9_-]/g, '_');

/**
 * Số ô bay tối đa trong ngân sách cargoFraction×LOA: n×cell + (n−1)×gap ≤ budget.
 * Phần còn lại của LOA = cabin + ống khói + khoảng hở (ứng với công thức người dùng).
 */
const computeCargoBayPackInFraction = (
  loaM,
  bayCellM = 12,
  bayGapM = 3,
  cargoFraction = VESSEL_CARGO_LENGTH_FRACTION
) => {
  const loa = Math.max(0, Number(loaM) || 0);
  const cell = Math.max(1, Number(bayCellM) || 12);
  const gap = Math.max(0, Number(bayGapM) || 3);
  const frac = Math.max(0.1, Math.min(0.95, Number(cargoFraction) || VESSEL_CARGO_LENGTH_FRACTION));
  const budget = loa * frac;
  let n = 0;
  while ((n + 1) * cell + n * gap <= budget + 1e-6) {
    n += 1;
  }
  const cargoUsedM = n <= 0 ? 0 : n * cell + Math.max(0, n - 1) * gap;
  const structureBudgetM = Math.max(0, loa - cargoUsedM);
  return { nBays: n, cargoUsedM, structureBudgetM, cargoBudgetM: budget };
};

/** Gộn các đoạn [a,b] trên trục s (mũi = 0 → lái, đơn vị m). */
const mergeIntervals1D = (raw) => {
  const pairs = (Array.isArray(raw) ? raw : [])
    .map(([a, b]) => [Math.min(a, b), Math.max(a, b)])
    .filter(([a, b]) => b > a)
    .sort((u, v) => u[0] - v[0]);
  const out = [];
  for (const [x, y] of pairs) {
    if (!out.length || x > out[out.length - 1][1]) out.push([x, y]);
    else out[out.length - 1][1] = Math.max(out[out.length - 1][1], y);
  }
  return out;
};

/**
 * Khoảng cách từ MŨI (m) — vùng không vẽ container (cabin / ống khói).
 * deckClearM: khe đều hai bên superstructure ↔ dải bay (thường = cabinBayGapM).
 */
const superstructureForbiddenSFromBow = (
  loaM,
  bowToCabinCenter,
  cabWM,
  bowToFunnelCenter,
  funWM,
  combined,
  funnelActive,
  deckClearM = 0
) => {
  const loa = Math.max(1, Number(loaM) || 1);
  const cabW = Math.max(0, Number(cabWM) || 0);
  const funW = Math.max(0, Number(funWM) || 0);
  const pad = Math.max(0, Number(deckClearM) || 0);
  const c = Math.max(0, Math.min(loa, Number(bowToCabinCenter) || 0));
  const blocks = [];
  if (combined) {
    const half = (Math.max(cabW, funW) + 2) / 2 + pad;
    blocks.push([c - half, c + half]);
  } else {
    blocks.push([c - cabW / 2 - pad, c + cabW / 2 + pad]);
    if (funnelActive) {
      const f = Math.max(0, Math.min(loa, Number(bowToFunnelCenter) || 0));
      blocks.push([f - funW / 2 - pad, f + funW / 2 + pad]);
    }
  }
  return mergeIntervals1D(blocks.map(([a, b]) => [Math.max(0, a), Math.min(loa, b)])).filter(([a, b]) => b > a);
};

/**
 * Đoạn deck trống (s từ MŨI → lái) sau khi trừ vùng cấm cabin/ống khói.
 */
const elevationDeckFreeIntervals = (loaM, forbiddenS, bowClearM = 0, sternClearM = 0) => {
  const loa = Math.max(1, Number(loaM) || 1);
  const lo = Math.max(0, Number(bowClearM) || 0);
  const hi = loa - Math.max(0, Number(sternClearM) || 0);
  if (hi <= lo + 1e-6) return [];
  const merged = mergeIntervals1D(forbiddenS);
  const free = [];
  let c = lo;
  for (const [a, b] of merged) {
    const A = Math.max(lo, Math.min(hi, a));
    const B = Math.max(lo, Math.min(hi, b));
    if (c < A - 1e-6) free.push([c, A]);
    c = Math.max(c, B);
    if (c >= hi - 1e-6) break;
  }
  if (c < hi - 1e-6) free.push([c, hi]);
  return free.filter(([s, e]) => e > s + 1e-3);
};

/**
 * Một lần xếp ô (pitch cố định): lấp **lần lượt** từng đoạn deck trống (mũi→lái),
 * để vùng **sau ống khói** về lái vẫn nhận bay (54, 58, 62…).
 */
const packElevationBaySlotsOnce = (
  loaM,
  targetNBays,
  cellM,
  gapM,
  forbiddenS,
  bowClearM = 0,
  sternClearM = 0
) => {
  const loa = Math.max(1, Number(loaM) || 1);
  const cell = Math.max(0.35, Number(cellM) || 12);
  const gap = Math.max(0, Number(gapM) || 3);
  const usable = elevationDeckFreeIntervals(loa, forbiddenS, bowClearM, sternClearM);
  const slots = [];
  const nMax = Math.max(0, Math.min(96, Math.round(Number(targetNBays) || 0)));
  let seq = 0;
  for (const [intLo, intHi] of usable) {
    let prev = intLo - gap;
    while (seq < nMax) {
      const s0 = Math.max(intLo, prev + gap);
      const s1 = s0 + cell;
      if (s1 > intHi + 1e-6) break;
      slots.push({ s0, s1, xL: loa - s1, xR: loa - s0, seqIndex: seq });
      seq += 1;
      prev = s1;
    }
  }
  return slots;
};

/**
 * Xếp đủ targetNBays ô: **khe giữa các ô cố định** (≥2,5 m, đồng bộ Operation); chỉ **thu nhỏ chiều dài ô**
 * nếu cần để vừa LOA + cabin/khói khi BAY OPERATION có nhiều bay (vd. 02…62).
 */
const packElevationBaySlotsFromBow = (
  loaM,
  targetNBays,
  cellM,
  gapM,
  forbiddenS,
  bowClearM = 0,
  sternClearM = 0
) => {
  const nNeed = Math.max(0, Math.min(96, Math.round(Number(targetNBays) || 0)));
  if (nNeed <= 0) return [];
  const cell0 = Math.max(0.5, Number(cellM) || 12);
  const gapFixed = elevationInterBayGapM(gapM);
  const tryScale = (sc) =>
    packElevationBaySlotsOnce(loaM, nNeed, cell0 * sc, gapFixed, forbiddenS, bowClearM, sternClearM);

  const maxScaleFit = (sc) => {
    const t = tryScale(sc);
    return t.length >= nNeed ? t.slice(0, nNeed) : null;
  };

  let s = 1.0;
  let feasible = maxScaleFit(s);
  while (!feasible && s > 0.24) {
    s *= 0.88;
    feasible = maxScaleFit(s);
  }
  if (!feasible) {
    const last = tryScale(0.22);
    return last.slice(0, Math.min(nNeed, last.length));
  }

  let lo = s;
  let hi = 1.0;
  let best = feasible;
  for (let b = 0; b < 18; b++) {
    const mid = (lo + hi) / 2;
    const t = maxScaleFit(mid);
    if (t) {
      best = t;
      lo = mid;
    } else hi = mid;
  }
  return best;
};

/** Khoảng trống mũi trước dải bay (quả lê / forecastle) — mặt cắt Berth khớp thực tế & Operation. */
const VESSEL_ELEVATION_FORECASTLE_M = 12;
/** Phần lái sau bay cuối (m) — gần 0 để bay cuối sát mạn lái vuông. */
const VESSEL_ELEVATION_STERN_TRIM_M = 0.35;

/**
 * Trùng công thức `vesselSuperGapsToBowToMeters` (operation.html): tâm khe sau full[gapAfterFull] tính từ mũi (m).
 */
const operationStyleGapCenterFromBow = (gapAfterFull, nBays, loaM, cellM, gapM, sortSB) => {
  const cell = Math.max(8, Number(cellM) || 12);
  const gap = Math.max(0, Number(gapM) || 2.5);
  const pitch = cell + gap;
  const n = Math.max(2, Math.round(Number(nBays) || 0));
  const L = n * cell + (n - 1) * gap;
  const loaRaw = Number(loaM);
  const loa = Number.isFinite(loaRaw) && loaRaw > 0 ? loaRaw : L;
  const scale = loa / L;
  const gi = Math.max(0, Math.min(n - 2, Math.round(Number(gapAfterFull) || 0)));
  const xFromStern = gi * pitch + cell + gap / 2;
  const bowToUnscaled = sortSB ? L - xFromStern : xFromStern;
  const bowTo = bowToUnscaled * scale;
  const maxD = Math.max(5, loa - 5);
  return Math.max(5, Math.min(maxD, bowTo));
};

/**
 * Tìm chỉ số khe k (giữa op[k] mũi và op[k+1] lái) khớp cặp số bay từ dropdown Operation.
 */
const elevationGapIndexFromOperationBayPair = (opListBowToStern, bowBayNum, sternBayNum) => {
  if (!Array.isArray(opListBowToStern) || opListBowToStern.length < 2) return null;
  const bow = Math.round(Number(bowBayNum));
  const stern = Math.round(Number(sternBayNum));
  if (!Number.isFinite(bow) || !Number.isFinite(stern)) return null;
  const lo = String(Math.min(bow, stern)).padStart(2, '0');
  const hi = String(Math.max(bow, stern)).padStart(2, '0');
  for (let k = 0; k < opListBowToStern.length - 1; k++) {
    if (opListBowToStern[k] === lo && opListBowToStern[k + 1] === hi) return k;
  }
  return null;
};

const inferOperationGapAfterFullFromBowTo = (bowToM, nBays, loaM, cellM, gapM, sortSB) => {
  const loa = Math.max(1, Number(loaM) || 1);
  const target = Math.max(0, Math.min(loa, Number(bowToM) || 0));
  const n = Math.max(2, Math.round(Number(nBays) || 0));
  if (target <= 1) return Math.max(0, Math.min(n - 2, Math.round(n * 0.38)));
  let best = 0;
  let bestE = Infinity;
  for (let g = 0; g <= n - 2; g++) {
    const p = operationStyleGapCenterFromBow(g, n, loaM, cellM, gapM, sortSB);
    const e = Math.abs(p - target);
    if (e < bestE) {
      bestE = e;
      best = g;
    }
  }
  return Math.max(0, Math.min(n - 2, best));
};

/**
 * Xếp ô mặt cắt đúng nhịp Operation: mũi ~12 m trước bay đầu; khe cabin/khói đúng cặp bay (chỉ số full[]).
 * opListBowToStern: mũi→lái như BAY OPERATION.
 */
const buildElevationSlotsOperationAligned = ({ loaM, opListBowToStern, vessel, deckClearM }) => {
  const loa = Math.max(1, Number(loaM) || 1);
  const n = opListBowToStern.length;
  if (n < 2 || !vessel) return null;
  const F = VESSEL_ELEVATION_FORECASTLE_M;
  const sternTrim = VESSEL_ELEVATION_STERN_TRIM_M;
  const cellNom = Math.max(8, Number(vessel.bayCellM) || 12);
  const gapFix = elevationInterBayGapM(vessel.bayGapM);
  const cabW = Math.max(2, Number(vessel.cabinWidthM) || 10);
  const funW = Math.max(2, Number(vessel.funnelWidthM) || 8);
  const pad = Math.max(0, Number(deckClearM) || 0);
  const combined = vessel.cabinFunnelCombined !== false;
  const sortSB = vessel.operationDeckSortSB !== false;

  let kCab = elevationGapIndexFromOperationBayPair(
    opListBowToStern,
    vessel.operationCabinGapBow,
    vessel.operationCabinGapStern
  );
  let cAfter;
  if (kCab == null) {
    cAfter = vessel.operationCabinAfterFull;
    if (!Number.isFinite(Number(cAfter))) {
      cAfter = inferOperationGapAfterFullFromBowTo(vessel.bowToCabin, n, loa, cellNom, gapFix, sortSB);
    } else {
      cAfter = Math.max(0, Math.min(n - 2, Math.round(Number(cAfter))));
    }
    kCab = Math.max(0, Math.min(n - 2, n - 2 - cAfter));
  } else {
    kCab = Math.max(0, Math.min(n - 2, kCab));
    cAfter = Math.max(0, Math.min(n - 2, n - 2 - kCab));
  }

  let kFun;
  let fAfter;
  if (combined) {
    fAfter = cAfter;
    kFun = kCab;
  } else if ((Number(vessel.bowToFunnel) || 0) > 0) {
    kFun = elevationGapIndexFromOperationBayPair(
      opListBowToStern,
      vessel.operationFunnelGapBow,
      vessel.operationFunnelGapStern
    );
    if (kFun == null) {
      fAfter = vessel.operationFunnelAfterFull;
      if (!Number.isFinite(Number(fAfter))) {
        fAfter = inferOperationGapAfterFullFromBowTo(vessel.bowToFunnel || 0, n, loa, cellNom, gapFix, sortSB);
      } else {
        fAfter = Math.max(0, Math.min(n - 2, Math.round(Number(fAfter))));
      }
      kFun = Math.max(0, Math.min(n - 2, n - 2 - fAfter));
    } else {
      kFun = Math.max(0, Math.min(n - 2, kFun));
      fAfter = Math.max(0, Math.min(n - 2, n - 2 - kFun));
    }
  } else {
    fAfter = 0;
    kFun = 0;
  }

  const W = Array(n - 1).fill(gapFix);
  if (combined) {
    const k = kCab;
    W[k] = Math.max(cabW, funW) + 2 * pad;
  } else if (kCab === kFun && (Number(vessel.bowToFunnel) || 0) > 0) {
    W[kCab] = Math.max(cabW, funW) + 2 * pad;
  } else {
    W[kCab] = cabW + 2 * pad;
    if ((Number(vessel.bowToFunnel) || 0) > 0) W[kFun] = funW + 2 * pad;
  }

  const sumW = W.reduce((a, b) => a + b, 0);
  let cell = (loa - F - sternTrim - sumW) / n;
  const minCell = 4.5;
  if (cell < minCell) cell = minCell;

  const slots = [];
  let pos = F;
  for (let j = 0; j < n; j++) {
    const s0 = pos;
    const s1 = pos + cell;
    slots.push({ s0, s1, xL: loa - s1, xR: loa - s0, seqIndex: j });
    if (j < n - 1) pos = s1 + W[j];
  }

  const sumW0 = (k) => (k <= 0 ? 0 : W.slice(0, k).reduce((a, b) => a + b, 0));
  const endOfBay = (j) => F + (j + 1) * cell + sumW0(j);
  const centerOfGap = (k) => endOfBay(k) + W[k] / 2;

  const cabinCenterS = centerOfGap(Math.max(0, Math.min(n - 2, kCab)));
  const funnelCenterS =
    combined || !(Number(vessel.bowToFunnel) > 0)
      ? cabinCenterS
      : centerOfGap(Math.max(0, Math.min(n - 2, kFun)));

  return {
    slots,
    cabinCenterS,
    funnelCenterS,
    cellEff: cell,
    opFullGapCabin: cAfter,
    opFullGapFunnel: fAfter
  };
};

/** khoảng cách từ MŨI theo hướng lái (m) → % cạnh trái của thanh (PS: mũi trái; SB: mũi phải). */
const pctFromLeftFromDistFromBowMini = (dFromBowM, loaM, isPs) => {
  const loa = Math.max(1, Number(loaM) || 1);
  const d = Math.max(0, Math.min(loa, Number(dFromBowM) || 0));
  if (isPs) return (d / loa) * 100;
  return ((loa - d) / loa) * 100;
};

/**
 * Số bay hiển thị từ token Operation / VESSEL BAY·DECK (43A → 43; mã slot 430204… → 43).
 * Không giữ hậu tố deck — chỉ số nhịp.
 */
const displayBayNumberFromOperationToken = (raw) => {
  const s = String(raw || '')
    .trim()
    .replace(/^BAY\s+/i, '');
  if (!s) return '';
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  let n;
  if (d.length >= 6) n = parseInt(d.slice(0, 2), 10);
  else n = parseInt(d, 10);
  if (!Number.isFinite(n) || n < 0) return '';
  return n <= 99 ? String(n).padStart(2, '0') : String(n);
};

/** Tooltip mặt cắt: quy ước lẻ = 20′, chẵn = 40′ (ghép hai ô lẻ kề). */
const elevationBayFootprintHint = (bayNumStr) => {
  const n = parseInt(String(bayNumStr || '').replace(/\D/g, ''), 10);
  if (Number.isNaN(n)) return `Bay ${bayNumStr}`;
  if (n % 2 === 0) {
    const a = String(Math.max(0, n - 1)).padStart(2, '0');
    const b = String(Math.min(99, n + 1)).padStart(2, '0');
    return `Bay ${bayNumStr} — 40′ (ô chẵn; tương đương ghép 20′ ${a} + ${b})`;
  }
  return `Bay ${bayNumStr} — 20′ (ô lẻ)`;
};

/** Chuỗi "02, 06, 62" hoặc "43A, 45A" — thứ tự mũi → lái; chuẩn hóa số từ dữ liệu Operation. */
const parseOperationDeckBaysString = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return [];
  return s
    .split(/[,;\n]+/)
    .map((t) =>
      String(t || '')
        .trim()
        .replace(/^BAY\s+/i, '')
        .trim()
    )
    .filter(Boolean)
    .map((t) => displayBayNumberFromOperationToken(t))
    .filter(Boolean);
};

/** Gợi ý mũi → tâm ống khói (m): ưu tiên giữa hai bay (khe rộng) phía trước cabin, hợp lý cho máy/phân khoang. */
const suggestBowToFunnelFromSlots = (slots, loaM, bowToCabinCenter, cabinWidthM, bayCellM) => {
  const loa = Math.max(1, Number(loaM) || 1);
  const cell = Math.max(1, Number(bayCellM) || 12);
  const dc = Math.max(0, Number(bowToCabinCenter) || 0);
  const cw = Math.max(0, Number(cabinWidthM) || 10);
  if (!Array.isArray(slots) || slots.length < 2) {
    return Math.max(8, Math.min(loa - 8, Math.round(loa * 0.42)));
  }
  const centers = slots
    .map((sl) => Number(sl.fromBowStartM) + cell / 2)
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);
  if (centers.length < 2) {
    return Math.max(8, Math.min(loa - 8, Math.round(loa * 0.42)));
  }
  const cabinBowEdge = dc - cw / 2;
  let bestMid = null;
  let bestW = -1;
  for (let i = 0; i < centers.length - 1; i += 1) {
    const mid = (centers[i] + centers[i + 1]) / 2;
    const w = centers[i + 1] - centers[i];
    if (mid >= cabinBowEdge - cell * 0.35) continue;
    if (mid < loa * 0.12) continue;
    if (w >= bestW) {
      bestW = w;
      bestMid = mid;
    }
  }
  if (bestMid == null) {
    for (let i = 0; i < centers.length - 1; i += 1) {
      const mid = (centers[i] + centers[i + 1]) / 2;
      const w = centers[i + 1] - centers[i];
      if (mid < cabinBowEdge - 1 && w > bestW) {
        bestW = w;
        bestMid = mid;
      }
    }
  }
  if (bestMid == null) {
    bestMid = (centers[0] + centers[1]) / 2;
  }
  return Math.max(8, Math.min(loa - 8, Math.round(bestMid)));
};

const PRESET_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#eab308', '#9333ea', '#db2777', '#ea580c', '#0d9488'];

// Fix cứng ID ứng dụng để tất cả các phiên bản (kể cả khi copy/share link) đều trỏ về chung 1 CSDL
const appId = 'CMIT_BERTH_PLANNER_MAIN';

const firebaseConfig = { 
    apiKey: "AIzaSyBXRwurRyERLg_bdZKcLtLr68UpalQkEeA", 
    authDomain: "cmit-berth-planner.firebaseapp.com", 
    projectId: "cmit-berth-planner", 
    storageBucket: "cmit-berth-planner.firebasestorage.app", 
    messagingSenderId: "43356799872", 
    appId: "1:43356799872:web:86d1daac85a9b6e2def765" 
};

const vbmsFirebaseConfig = {
    apiKey: "AIzaSyAP3qCZ9_JARgqCUgsvwDVCEb_IOMOn2I8",
    authDomain: "vbms-system-3bde4.firebaseapp.com",
    projectId: "vbms-system-3bde4",
    storageBucket: "vbms-system-3bde4.firebasestorage.app",
    messagingSenderId: "211209133317",
    appId: "1:211209133317:web:3e80f443c35caade172b6c"
};
const vbmsAppId = 'vbms-production-core';

// --- GLOBAL UTILITY COMPONENTS ---
const InputField = ({ label, value, onChange, type = "text", placeholder = "", forceUpper = true, disabled = false }) => {
  const [localValue, setLocalValue] = useState(value !== undefined && value !== null ? value : '');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
      if (!isFocused) {
          setLocalValue(value !== undefined && value !== null ? value : '');
      }
  }, [value, isFocused]);

  const handleCommit = () => {
      if (localValue !== (value !== undefined && value !== null ? value : '')) {
          let val = localValue;
          if (type === "number") {
              val = val === '' ? '' : Number(val);
          } else if (forceUpper && type !== "datetime-local") {
              val = String(val).toUpperCase();
          }
          onChange(val);
      }
  };

  const handleBlur = () => {
      setIsFocused(false);
      handleCommit();
  };

  const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
          e.target.blur();
      }
  };

  return (
    <div className="flex flex-col gap-1 w-full h-full">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{String(label || '')}</label>
      <input 
          type={type} 
          value={localValue} 
          placeholder={placeholder} 
          disabled={disabled}
          autoComplete="off"
          data-form-type="other"
          data-lpignore="true"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onChange={(e) => setLocalValue(e.target.value)} 
          className={`w-full rounded-xl px-4 py-3 text-sm font-bold text-[#002D54] outline-none transition-all select-text h-full
              ${type !== 'datetime-local' ? 'uppercase' : ''}
              ${disabled ? 'bg-slate-100/50 border border-slate-200/60 text-slate-600 shadow-none' : 'bg-white border border-blue-200 focus:ring-2 focus:ring-blue-500 shadow-inner'}`} 
      />
    </div>
  );
};

const TextAreaField = ({ label, value, onChange, disabled = false }) => {
  const textareaRef = useRef(null);
  const [localValue, setLocalValue] = useState(value || '');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
      if (!isFocused) {
          setLocalValue(value || '');
      }
  }, [value, isFocused]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [localValue]);

  const handleBlur = () => {
      setIsFocused(false);
      if (localValue !== (value || '')) {
          onChange(String(localValue).toUpperCase());
      }
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{String(label || '')}</label>
      <textarea 
          ref={textareaRef}
          value={localValue} 
          disabled={disabled}
          rows={1}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onChange={(e) => setLocalValue(e.target.value)} 
          className={`w-full rounded-xl px-4 py-3 text-sm font-bold text-[#002D54] outline-none transition-all resize-none overflow-hidden uppercase select-text leading-relaxed
              ${disabled ? 'bg-slate-100/50 border border-slate-200/60 text-slate-600 shadow-none' : 'bg-yellow-50/50 border border-yellow-400 focus:ring-2 focus:ring-yellow-500 shadow-inner'}`} 
      />
    </div>
  );
};

const SmallInputField = ({ label, value, onChange, type = "text" }) => {
  const [localValue, setLocalValue] = useState(value !== undefined && value !== null ? value : '');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
      if (!isFocused) {
          setLocalValue(value !== undefined && value !== null ? value : '');
      }
  }, [value, isFocused]);

  const handleBlur = () => {
      setIsFocused(false);
      if (localValue !== (value !== undefined && value !== null ? value : '')) {
          let val = localValue;
          if (type === "number") {
              val = val === '' ? '' : Number(val);
          } else if (type !== "datetime-local") {
              val = String(val).toUpperCase(); 
          }
          onChange(val);
      }
  };

  return (
      <div className="flex flex-col gap-0.5">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{String(label || '')}</label>
        <input 
            type={type} 
            value={localValue} 
            autoComplete="off" 
            data-form-type="other" 
            data-lpignore="true" 
            autoCapitalize="none" 
            autoCorrect="off" 
            spellCheck={false} 
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            onChange={(e) => setLocalValue(e.target.value)} 
            className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-[#002D54] focus:ring-2 focus:ring-blue-500 outline-none transition-all select-text ${type !== 'datetime-local' ? 'uppercase' : ''}`} 
        />
      </div>
  );
};

const SummaryRow = ({ label, value, color = "slate" }) => (
  <div className="flex justify-between items-center py-3 border-b border-slate-100">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{String(label || '')}</span>
    <span className={`text-xs font-black text-${color}-700 uppercase`}>{String(value || '')}</span>
  </div>
);

// --- HELPER FUNCTIONS ---
const getMooringSpace = (v, percent = 6) => v?.type === 'vessel' ? Math.round((v.loa || 0) * (percent / 100)) : 0;

const getMooringBollards = (vessel, percent = 6) => {
    if (!vessel || vessel.bowPos < -200) return { bowBollard: { id: '-', pos: 0 }, sternBollard: { id: '-', pos: 0 }, rightBollard: { id: '-', pos: 0 }, leftBollard: { id: '-', pos: 0 } };
    const mooringLen = getMooringSpace(vessel, percent);
    const rightEdge = vessel.bowPos;
    const validRight = CMIT_BOLLARDS.filter(b => b.pos <= rightEdge - mooringLen);
    const rightBollard = validRight.length > 0 ? validRight.reduce((max, b) => b.pos > max.pos ? b : max, validRight[0]) : CMIT_BOLLARDS[0]; 
    const leftEdge = vessel.sternPos;
    const validLeft = CMIT_BOLLARDS.filter(b => b.pos >= leftEdge + mooringLen);
    const leftBollard = validLeft.length > 0 ? validLeft.reduce((min, b) => b.pos < min.pos ? b : min, validLeft[0]) : CMIT_BOLLARDS[CMIT_BOLLARDS.length - 1]; 
    const isPS = vessel.side === 'PS';
    const bowBollard = isPS ? leftBollard : rightBollard;
    const sternBollard = isPS ? rightBollard : leftBollard;
    return { bowBollard, sternBollard, rightBollard, leftBollard };
};

const getClearance = (vA, vB, percent = 6) => {
    if (vA?.type === 'barge' && vB?.type === 'barge') return 5; 
    return (getMooringSpace(vA, percent) || 2) + (getMooringSpace(vB, percent) || 2); 
};

const findFreePosition = (newVesselObj, currentVessels, percent = 6) => {
    const sameTier = currentVessels.filter(v => (v.tier || 1) === newVesselObj.tier).sort((a, b) => a.bowPos - b.bowPos);
    let candidatePos = 0; 
    for (const v of sameTier) {
        const clearance = getClearance(newVesselObj, v, percent);
        if (candidatePos + newVesselObj.loa <= v.bowPos - clearance) return candidatePos; 
        candidatePos = v.sternPos + clearance; 
    }
    return candidatePos; 
};

const getAvailableColor = (currentVessels) => {
    const usedColors = currentVessels.map(v => v.color);
    const available = PRESET_COLORS.find(c => !usedColors.includes(c));
    return available || PRESET_COLORS[currentVessels.length % PRESET_COLORS.length];
};

const getCurrentDateTimeLocal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
};

const getEtdFallback = (etaStr) => {
    const etaDate = etaStr ? new Date(etaStr) : new Date();
    const etdDate = new Date(etaDate.getTime() + 24 * 60 * 60 * 1000); // Mặc định +24h
    etdDate.setMinutes(etdDate.getMinutes() - etdDate.getTimezoneOffset());
    return etdDate.toISOString().slice(0, 16);
}

const sanitizeBargeName = (name) => String(name || '').replace(/-AUTO-\d+$/i, '').trim();

const fixTypos = (text) => {
    if (!text) return "";
    let res = String(text).toUpperCase();
    res = res.replace(/GUU|GUÙ|GÙI/g, "GÙ");
    res = res.replace(/GÙ\s*1 DÂY/g, "1 DÂY"); 
    res = res.replace(/1 DÂY/g, "GÙ 1 DÂY");
    return res.trim();
};

const parseSmartRemark = (remarkText, vessel) => {
    if (!remarkText) return {};
    const updates = {};
    const text = remarkText.toUpperCase();
    const extractNumber = (regex) => {
        const match = text.match(regex);
        if (match && match[1]) {
            return match[1].replace(/,/g, '.');
        }
        return null;
    };
    const hatch = extractNumber(/KEEL\s+TO\s+HATCH[^\d]*?(\d+([.,]\d+)?)/);
    if (hatch) updates.keelToHatch = hatch;
    const nav = extractNumber(/KEEL\s+TO\s+NAV[^\d]*?(\d+([.,]\d+)?)/);
    if (nav) updates.keelToNav = nav;
    const mast = extractNumber(/KEEL\s+TO\s+(?:TOP|ACCOMMODATION)[^\d]*?(\d+([.,]\d+)?)/);
    if (mast) updates.keelToMast = mast;
    const sternBridge = extractNumber(/DISTANCE\s+FROM\s+STERN[^\d]*?(\d+([.,]\d+)?)/);
    if (sternBridge && vessel && vessel.loa) {
        updates.bowToCabin = Math.round(vessel.loa - parseFloat(sternBridge));
    }
    const bowBridge = extractNumber(/DISTANCE\s+FROM\s+BOW[^\d]*?(\d+([.,]\d+)?)/);
    if (bowBridge) updates.bowToCabin = Math.round(parseFloat(bowBridge));
    const tlMatch = text.match(/(?:TWIST\s*LOCK|TWISTLOCK)[^:：\-]*[:：\-]\s*([^.\n]+)/);
    if (tlMatch) {
        let tlStr = tlMatch[1].replace(/(?:TYPE|TWIST\s*LOCK\s*TYPE|TWISTLOCK\s*TYPE)/g, '').trim();
        updates.twistlock = fixTypos(tlStr);
    }
    const reeferMatch = text.match(/REEFER\s*MOTOR[^:：\-]*[:：\-]\s*([^.\n]+)/);
    if (reeferMatch) {
        let cleanReefer = reeferMatch[1].replace(/DIRECTION/g, '').trim();
        updates.reeferMotor = cleanReefer;
    }
    return updates;
};

const compressImage = (base64Str, maxWidth = 800, quality = 0.6) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
    });
};


// --- MAIN APP ---
const App = () => {
  const navigate = useNavigate();
  const [db, setDb] = useState(null);
  const [vbmsDb, setVbmsDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [vbmsUserId, setVbmsUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isVbmsAuthReady, setIsVbmsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('visual'); 
  const [historyPlans, setHistoryPlans] = useState([]);
  const [allVoyages, setAllVoyages] = useState([]);
  const [toastMsg, setToastMsg] = useState('');
  
  const [zoomLevel, setZoomLevel] = useState(1.5);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }); 
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth <= 900);
  const [isPortraitViewport, setIsPortraitViewport] = useState(() => window.innerHeight >= window.innerWidth);
  const mapContainerRef = useRef(null);
  const innerMapRef = useRef(null);

  const totalVisLength = 1200; 
  const bufferLength = 300; 

  const [masterVessels, setMasterVessels] = useState(INITIAL_MASTER_VESSEL_DB);

  const [vessels, setVessels] = useState([]);
  
  const [activeVesselId, setActiveVesselId] = useState(null);
  const [selectedVesselIds, setSelectedVesselIds] = useState([]); // MULTI-SELECT
  const [selectedObjectType, setSelectedObjectType] = useState(null); // vessel | barge | qc
  const [selectionBox, setSelectionBox] = useState(null); // MULTI-SELECT BOX
  const activeVessel = vessels.find(v => v?.id === activeVesselId) || vessels[0] || null;

  useEffect(() => {
    activeVesselRef.current = activeVessel;
  }, [activeVessel]);

  const [qcTasks, setQcTasks] = useState(QC_RANGES.map((qc, idx) => ({
    id: qc.id, name: qc.name, lane: String(4 - (idx % 3)), notes: 'SẴN SÀNG.', pos: qc.start + 50, color: qc.color, rangeStart: qc.start, rangeEnd: qc.end, boomDown: true, isSafeMode: false, selected: false
  })));

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false); 
  const dragStartRef = useRef({ id: null, type: null, bowPos: 0, pos: 0, startX: 0, startY: 0, cabinOffset: 0, lastData: null, lastQcData: null, startPanX: 0, startPanY: 0, hasMoved: false });
  const moveRafRef = useRef(null);
  const latestPointerRef = useRef({ clientX: 0, clientY: 0 });
  
  const [showBargeMenu, setShowBargeMenu] = useState(false);
  const [mooringPercent, setMooringPercent] = useState(6);
  const [showVesselModal, setShowVesselModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [vesselTabSearch, setVesselTabSearch] = useState('');
  
  // SCHEDULE VIEW CONFIG
  const [scheduleDays, setScheduleDays] = useState(7);
  const [scheduleStartDate, setScheduleStartDate] = useState(() => {
      const d = new Date();
      d.setHours(0,0,0,0);
      return d;
  });

  const [isPrintMode, setIsPrintMode] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfConfig, setPdfConfig] = useState({
      showQcRanges: false,
      showBargeLabels: false,
      showVesselLabels: true,
      showMooringLines: true,
      scale: 125
  });

  const [showNewVesselForm, setShowNewVesselForm] = useState(false);
  const [newVesselData, setNewVesselData] = useState({ name: '', loa: '', side: 'SB', eta: '', etd: '', voyage: 'TBU' });
  const [quickAddVoyage, setQuickAddVoyage] = useState('TBU');
  const [pendingAddVessel, setPendingAddVessel] = useState(null);
  const [pendingAddVoyage, setPendingAddVoyage] = useState('TBU');
  const [pendingProfileDraft, setPendingProfileDraft] = useState(null);
  const [isPendingProfileUnlocked, setIsPendingProfileUnlocked] = useState(false);
  const [pendingProfilePin, setPendingProfilePin] = useState('');
  const [formError, setFormError] = useState('');

  const fileInputRef = useRef(null);
  const [uploadMsg, setUploadMsg] = useState('');

  const [isVesselUnlocked, setIsVesselUnlocked] = useState(false);
  const [vesselPin, setVesselPin] = useState('');
  /** Draft bow→cabin / bow→funnel (m) while PIN unlocked; committed via "Lưu" on mini preview only */
  const [miniLayoutDraft, setMiniLayoutDraft] = useState(null);
  const miniShipTrackRef = useRef(null);
  const miniLayoutDragRef = useRef({ kind: null });
  const activeVesselRef = useRef(null);
  const vesselSyncDebounceRef = useRef(null);
  const vesselProfileDebounceRef = useRef(null);

  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('cmit_gemini_api_key') || '');

  const aiImageInputRef = useRef(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResultText, setAiResultText] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiSuccessMsg, setAiSuccessMsg] = useState('');
  const [pendingAiDistance, setPendingAiDistance] = useState(null);
  const [pendingAiImage, setPendingAiImage] = useState(null);
  const [activeVesselImage, setActiveVesselImage] = useState(null);

  const [clickCount, setClickCount] = useState(0);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const clickTimeoutRef = useRef(null);
  const [berthMaintenanceZones, setBerthMaintenanceZones] = useState([]);
  const [qcMaintenanceIds, setQcMaintenanceIds] = useState([]);
  const [maintenanceDraft, setMaintenanceDraft] = useState({ start: 0, end: 50 });
  const maintenanceDragRef = useRef(null);
  const [selectedMaintenanceZoneIds, setSelectedMaintenanceZoneIds] = useState([]);
  const [isQcRangeUnlocked, setIsQcRangeUnlocked] = useState(false);
  const [qcRangePin, setQcRangePin] = useState('');
  const berthMaintenanceZonesRef = useRef([]);
  const qcMaintenanceIdsRef = useRef([]);
  const [dialogState, setDialogState] = useState({
      open: false,
      type: 'confirm',
      title: '',
      message: '',
      choices: [],
      selectedChoice: '',
      confirmText: 'Đồng ý',
      cancelText: 'Hủy'
  });
  const dialogResolverRef = useRef(null);

  const [uiState, setUiState] = useState({
      listExpanded: false,
      detailsExpanded: false,
      qcExpanded: true
  });
  const toggleUi = (key) => setUiState(prev => ({ ...prev, [key]: !prev[key] }));
  
  const [isAutoExpand, setIsAutoExpand] = useState(true);
  const [showGuideLines, setShowGuideLines] = useState(true); // NEW STATE: Toggle guide lines in visual map
  const [qcProductivity, setQcProductivity] = useState(25); // Năng suất QC (cont/h)
  
  const nudgeIntervalRef = useRef(null);
  const isTypingRef = useRef(false);
  const pendingSnapshotRef = useRef(null);
  const largeVesselSyncRef = useRef({ hash: '', syncing: false });
  const voyageSyncRef = useRef({ hash: '', syncing: false });
  const voyageSyncBlockRef = useRef({ defaultDenied: false, vbmsDenied: false, warned: false });
  const planSyncWarnRef = useRef(false);
  const previousTabRef = useRef(activeTab);
  const mobileFrameKeyRef = useRef('');
  const firestoreConnectivityRef = useRef({ lastConsoleMs: 0, userNotified: false });

  const reportFirestoreConnectivity = (label, err) => {
    if (!isFirestoreConnectivityError(err)) return false;
    const now = Date.now();
    if (now - firestoreConnectivityRef.current.lastConsoleMs > 45000) {
      firestoreConnectivityRef.current.lastConsoleMs = now;
      console.warn(
        `[Firestore] Không kết nối được máy chủ (${label}). Kiểm tra Internet/DNS/VPN — ứng dụng chạy offline tạm thời.`,
        err?.code || err?.message || ''
      );
    }
    if (!firestoreConnectivityRef.current.userNotified) {
      firestoreConnectivityRef.current.userNotified = true;
      setToastMsg('Mất kết nối Firestore (mạng/DNS). Dữ liệu dùng cục bộ; đồng bộ lại khi mạng ổn định.');
      setTimeout(() => setToastMsg(''), 6500);
    }
    return true;
  };

  useEffect(() => { berthMaintenanceZonesRef.current = berthMaintenanceZones; }, [berthMaintenanceZones]);
  useEffect(() => { qcMaintenanceIdsRef.current = qcMaintenanceIds; }, [qcMaintenanceIds]);

  const normalizeVesselName = (name) => String(name || '').trim().toUpperCase();

  useEffect(() => {
    const onOpBaySync = (e) => {
      if (e.origin !== window.location.origin || !e.data || e.data.type !== 'CMIT_OPERATION_BAY_SEQUENCE') return;
      const { vesselNames, parentBaysBowToStern } = e.data;
      if (!Array.isArray(parentBaysBowToStern) || parentBaysBowToStern.length === 0) return;
      const setNm = new Set(
        (vesselNames || []).map((x) => normalizeVesselName(x)).filter(Boolean)
      );
      if (setNm.size === 0) return;
      const listStr = parentBaysBowToStern
        .map((b) => {
          const n = parseInt(String(b).replace(/\D/g, ''), 10);
          return Number.isFinite(n) ? String(n).padStart(2, '0') : String(b || '').trim();
        })
        .join(',');
      const bayNums = parentBaysBowToStern
        .map((b) => parseInt(String(b).replace(/\D/g, ''), 10))
        .filter((n) => Number.isFinite(n));
      const maxOpBay = bayNums.length ? Math.max(...bayNums) : 0;
      setVessels((prev) =>
        prev.map((v) => {
          if (!v || v.type !== 'vessel') return v;
          if (!setNm.has(normalizeVesselName(v.name))) return v;
          const b0 = Math.max(0, Number(v.bayMarkFirstEven) || 2);
          const b1 = Math.max(0, Number(v.bayMarkLastEven) || 0);
          const manualMarks = b1 >= b0;
          const nextLast =
            manualMarks && maxOpBay >= b0 ? Math.max(b1, maxOpBay) : b1;
          const sameBays = String(v.operationDeckBays || '').replace(/\s/g, '') === listStr.replace(/\s/g, '');
          const sameMarks = !manualMarks || nextLast === b1;
          if (sameBays && sameMarks) return v;
          return {
            ...v,
            operationDeckBays: listStr,
            ...(manualMarks && maxOpBay >= b0 ? { bayMarkLastEven: nextLast } : {})
          };
        })
      );
    };
    window.addEventListener('message', onOpBaySync);
    return () => window.removeEventListener('message', onOpBaySync);
  }, []);

  /** Đồng bộ MŨI-CABIN / ống khói từ Operation (Lưu bố cục cabin & khói) vào tàu trùng tên trên kế hoạch. */
  useEffect(() => {
    const onOpSuper = (e) => {
      if (e.origin !== window.location.origin || !e.data || e.data.type !== 'CMIT_OPERATION_VESSEL_SUPERSTRUCTURE') {
        return;
      }
      const {
        vesselNames,
        bowToCabin: btcRaw,
        bowToFunnel: btfRaw,
        cabinFunnelCombined: combRaw,
        cabinWidthM: cwRaw,
        funnelWidthM: fwRaw,
        cabinGap: cabinGapRaw,
        funnelGap: funnelGapRaw,
        sortSB: sortSBRaw,
        cabinGapBow: cabinGapBowRaw,
        cabinGapStern: cabinGapSternRaw,
        funnelGapBow: funnelGapBowRaw,
        funnelGapStern: funnelGapSternRaw
      } = e.data;
      if (!Array.isArray(vesselNames) || vesselNames.length === 0) return;
      const setNm = new Set(
        vesselNames.map((x) => normalizeVesselName(x)).filter(Boolean)
      );
      if (setNm.size === 0) return;

      setVessels((prev) => {
        let touched = false;
        const next = prev.map((v) => {
          if (!v || v.type !== 'vessel' || !setNm.has(normalizeVesselName(v.name))) return v;
          const bow = Number(v.bowPos || 0);
          const stern = Number(v.sternPos || 0);
          const loaNum = Number(v.loa) || Math.max(1, Math.abs(stern - bow));
          const combined = combRaw !== false;
          let btc = Math.round(Number(btcRaw) || 0);
          let btf = combined ? btc : Math.round(Number(btfRaw) || 0);
          const fixed = clampBowToCabinFunnelOrder(loaNum, btc, btf, combined, !combined && btf > 0);
          btc = fixed.bowToCabin;
          btf = fixed.bowToFunnel;
          const isPs = String(v.side || '').toUpperCase() === 'PS';
          const cabinPos = isPs ? Math.round(stern - btc) : Math.round(bow + btc);
          let funnelPos;
          if (btf > 0) {
            funnelPos = isPs ? Math.round(stern - btf) : Math.round(bow + btf);
          } else {
            funnelPos = undefined;
          }
          const cabinWidthM = cwRaw != null ? Math.max(2, Number(cwRaw) || 10) : v.cabinWidthM;
          const funnelWidthM = fwRaw != null ? Math.max(2, Number(fwRaw) || 8) : v.funnelWidthM;
          const merged = {
            ...v,
            bowToCabin: btc,
            bowToFunnel: btf,
            cabinFunnelCombined: combined,
            cabinPos,
            cabinWidthM,
            funnelWidthM,
            operationDeckSortSB: sortSBRaw !== false
          };
          if (Number.isFinite(Number(cabinGapRaw))) {
            merged.operationCabinAfterFull = Math.max(0, Math.round(Number(cabinGapRaw)));
          }
          if (Number.isFinite(Number(funnelGapRaw))) {
            merged.operationFunnelAfterFull = Math.max(0, Math.round(Number(funnelGapRaw)));
          }
          if (
            cabinGapBowRaw != null &&
            cabinGapSternRaw != null &&
            Number.isFinite(Number(cabinGapBowRaw)) &&
            Number.isFinite(Number(cabinGapSternRaw))
          ) {
            merged.operationCabinGapBow = Math.round(Number(cabinGapBowRaw));
            merged.operationCabinGapStern = Math.round(Number(cabinGapSternRaw));
          }
          if (
            funnelGapBowRaw != null &&
            funnelGapSternRaw != null &&
            Number.isFinite(Number(funnelGapBowRaw)) &&
            Number.isFinite(Number(funnelGapSternRaw))
          ) {
            merged.operationFunnelGapBow = Math.round(Number(funnelGapBowRaw));
            merged.operationFunnelGapStern = Math.round(Number(funnelGapSternRaw));
          }
          if (funnelPos !== undefined) merged.funnelPos = funnelPos;
          else delete merged.funnelPos;

          const same =
            v.bowToCabin === merged.bowToCabin &&
            v.bowToFunnel === merged.bowToFunnel &&
            v.cabinFunnelCombined === merged.cabinFunnelCombined &&
            Number(v.cabinPos) === Number(merged.cabinPos) &&
            Number(v.funnelPos || NaN) === Number(merged.funnelPos || NaN) &&
            Number(v.cabinWidthM) === Number(merged.cabinWidthM) &&
            Number(v.funnelWidthM) === Number(merged.funnelWidthM) &&
            v.operationDeckSortSB === merged.operationDeckSortSB &&
            Number(v.operationCabinAfterFull || NaN) === Number(merged.operationCabinAfterFull || NaN) &&
            Number(v.operationFunnelAfterFull || NaN) === Number(merged.operationFunnelAfterFull || NaN) &&
            Number(v.operationCabinGapBow || NaN) === Number(merged.operationCabinGapBow || NaN) &&
            Number(v.operationCabinGapStern || NaN) === Number(merged.operationCabinGapStern || NaN) &&
            Number(v.operationFunnelGapBow || NaN) === Number(merged.operationFunnelGapBow || NaN) &&
            Number(v.operationFunnelGapStern || NaN) === Number(merged.operationFunnelGapStern || NaN);
          if (!same) touched = true;
          return same ? v : merged;
        });
        if (touched) {
          queueMicrotask(() => {
            setToastMsg('Đã đồng bộ cabin & ống khói từ Operation vào mô phỏng tàu (tên trùng trên kế hoạch).');
            setTimeout(() => setToastMsg(''), 4500);
          });
        }
        return next;
      });
    };
    window.addEventListener('message', onOpSuper);
    return () => window.removeEventListener('message', onOpSuper);
  }, []);

  /** Lắng nghe cập nhật từ tab Dữ Liệu Tàu (operation.html) */
  useEffect(() => {
    const onOpSpecUpdate = (e) => {
      if (e.origin !== window.location.origin || !e.data || e.data.type !== 'CMIT_VESSEL_SPEC_UPDATE') return;
      const { vesselName, specs } = e.data;
      if (!vesselName || !specs) return;
      
      const normalizedName = normalizeVesselName(vesselName);
      
      // Update master vessels
      const newProfile = {
          name: normalizedName,
          ...specs,
          ...(specs.bowToCabin != null ? { bowToCabin: Number(specs.bowToCabin) } : {}),
          ...(specs.cabinWidthM != null ? { cabinWidthM: Number(specs.cabinWidthM) } : {}),
          ...(specs.bowToFunnel != null ? { bowToFunnel: Number(specs.bowToFunnel) } : {}),
          ...(specs.funnelWidthM != null ? { funnelWidthM: Number(specs.funnelWidthM) } : {})
      };
      
      persistVesselProfile(newProfile);

      // Update active vessels
      setVessels(prev => {
         let touched = false;
         const next = prev.map(v => {
            if (v.type !== 'vessel' || normalizeVesselName(v.name) !== normalizedName) return v;
            const updated = { ...v };
            if (specs.bowToCabin != null) updated.bowToCabin = Number(specs.bowToCabin);
            if (specs.cabinWidthM != null) updated.cabinWidthM = Number(specs.cabinWidthM);
            if (specs.bowToFunnel != null) updated.bowToFunnel = Number(specs.bowToFunnel);
            if (specs.funnelWidthM != null) updated.funnelWidthM = Number(specs.funnelWidthM);
            
            // Recompute cabinPos / funnelPos
            const isPs = String(v.side || '').toUpperCase() === 'PS';
            const bow = Number(v.bowPos || 0);
            const stern = Number(v.sternPos || 0);
            
            if (specs.bowToCabin != null) {
                updated.cabinPos = isPs ? Math.round(stern - updated.bowToCabin) : Math.round(bow + updated.bowToCabin);
            }
            if (specs.bowToFunnel != null) {
                if (updated.bowToFunnel > 0) {
                    updated.funnelPos = isPs ? Math.round(stern - updated.bowToFunnel) : Math.round(bow + updated.bowToFunnel);
                } else {
                    updated.funnelPos = undefined;
                }
            }

            touched = true;
            return updated;
         });
         
         if (touched) {
            queueMicrotask(() => {
                setToastMsg(`Đã đồng bộ thông số tàu ${normalizedName} từ bảng Dữ Liệu Tàu.`);
                setTimeout(() => setToastMsg(''), 4500);
            });
            if (vesselSyncDebounceRef.current) clearTimeout(vesselSyncDebounceRef.current);
            vesselSyncDebounceRef.current = setTimeout(() => { syncToCloud(next); vesselSyncDebounceRef.current = null; }, 800);
         }
         return next;
      });
    };
    window.addEventListener('message', onOpSpecUpdate);
    return () => window.removeEventListener('message', onOpSpecUpdate);
  }, []);

  /** Lắng nghe yêu cầu thêm tàu từ bảng Dữ Liệu Tàu */
  useEffect(() => {
    const onOpAddVessel = (e) => {
      if (e.origin !== window.location.origin || !e.data || e.data.type !== 'CMIT_ADD_VESSEL_FROM_OPERATION') return;
      
      const names = e.data.vesselNames || [];
      if (names.length === 0) return;
      
      const vesselName = names[0]; // just use the first one if multiple
      const voyage = e.data.voyage || 'TBU';
      
      const normalizedName = normalizeVesselName(vesselName);
      
      // Look up if this vessel exists in the master vessels db
      const currentSafeMasterVessels = Array.isArray(masterVessels) ? masterVessels : [];
      const existingProfile = currentSafeMasterVessels.find(v => normalizeVesselName(v.name) === normalizedName);
      
      if (existingProfile) {
          if (e.data.specs) {
              Object.assign(existingProfile, e.data.specs);
              setMasterVessels(prev => prev.map(v => 
                  normalizeVesselName(v.name) === normalizedName ? { ...v, ...e.data.specs } : v
              ));
          }
          
          try {
              addVesselFromDB(existingProfile, { voyage, specs: e.data.specs });
              setToastMsg(`Đã thêm tàu ${existingProfile.name} vào biểu đồ.`);
              setTimeout(() => setToastMsg(''), 3000);
          } catch(err) {
              setToastMsg(`Lỗi khi thêm tàu: ${err.message}`);
              setTimeout(() => setToastMsg(''), 3000);
          }
          navigate('/berth');
      } else {
          const curEta = getCurrentDateTimeLocal();
          const curEtd = getEtdFallback(curEta);
          setNewVesselData({ 
              name: vesselName.toUpperCase(), 
              loa: '', side: 'SB', 
              eta: curEta, etd: curEtd, 
              voyage: voyage,
              specs: e.data.specs 
          });
          setShowVesselModal(true);
          setShowNewVesselForm(true);
          setToastMsg(`Chưa có thông số cho tàu ${vesselName}. Vui lòng khai báo.`);
          setTimeout(() => setToastMsg(''), 4500);
          navigate('/berth');
      }
    };
    window.addEventListener('message', onOpAddVessel);
    return () => window.removeEventListener('message', onOpAddVessel);
  }, [masterVessels, vessels, navigate]);


  const isDuplicateVesselNameOnBerth = (name, excludeId = null) => {
      const normalized = normalizeVesselName(name);
      if (!normalized) return false;
      return vessels.some(v => v && v.type === 'vessel' && v.id !== excludeId && normalizeVesselName(v.name) === normalized);
  };

  const closeDialog = (result) => {
      setDialogState(prev => ({ ...prev, open: false }));
      if (dialogResolverRef.current) {
          dialogResolverRef.current(result);
          dialogResolverRef.current = null;
      }
  };

  const openConfirmDialog = ({ title = 'Xác nhận', message = '', confirmText = 'Đồng ý', cancelText = 'Hủy' }) => {
      return new Promise((resolve) => {
          dialogResolverRef.current = resolve;
          setDialogState({
              open: true,
              type: 'confirm',
              title,
              message,
              choices: [],
              selectedChoice: '',
              confirmText,
              cancelText
          });
      });
  };

  const openChoiceDialog = ({ title = 'Chọn phương án', message = '', choices = [], defaultChoice = '' }) => {
      return new Promise((resolve) => {
          dialogResolverRef.current = resolve;
          setDialogState({
              open: true,
              type: 'choice',
              title,
              message,
              choices,
              selectedChoice: defaultChoice || (choices[0]?.value || ''),
              confirmText: 'Áp dụng',
              cancelText: 'Hủy'
          });
      });
  };

  const openAlertDialog = ({ title = 'Thông báo', message = '', confirmText = 'Đã hiểu' }) => {
      return new Promise((resolve) => {
          dialogResolverRef.current = resolve;
          setDialogState({
              open: true,
              type: 'alert',
              title,
              message,
              choices: [],
              selectedChoice: '',
              confirmText,
              cancelText: ''
          });
      });
  };

  useEffect(() => {
      const applyNoAutofill = () => {
          const fields = document.querySelectorAll('input, textarea');
          fields.forEach((field, idx) => {
              field.setAttribute('autocomplete', 'off');
              field.setAttribute('data-form-type', 'other');
              field.setAttribute('data-lpignore', 'true');
              field.setAttribute('autocapitalize', 'none');
              field.setAttribute('autocorrect', 'off');
              field.setAttribute('spellcheck', 'false');
              if (!field.getAttribute('name')) {
                  const kind = field.getAttribute('type') || field.tagName.toLowerCase();
                  field.setAttribute('name', `${kind}-field-${idx}`);
              }
          });
      };

      applyNoAutofill();
      const observer = new MutationObserver(() => applyNoAutofill());
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
  }, []);

  const handleTitleClick = () => {
    setClickCount((prev) => {
      const next = prev + 1;
      if (next >= 10) {
        setIsSetupMode((mode) => !mode);
        return 0;
      }
      return next;
    });

    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      setClickCount(0);
    }, 2000);
  };

  const saveSetupConfig = () => {
      syncToCloud(vessels, qcTasks);
      setIsSetupMode(false);
  };

  const addBerthMaintenanceZone = () => {
      const start = Math.max(0, Math.min(600, Number(maintenanceDraft.start || 0)));
      const end = Math.max(0, Math.min(600, Number(maintenanceDraft.end || 0)));
      if (end <= start) return;
      const newZone = { id: `maint-${Date.now()}-${Math.floor(Math.random() * 1000)}`, start, end };
      const nextZones = [...berthMaintenanceZonesRef.current, newZone];
      berthMaintenanceZonesRef.current = nextZones;
      setBerthMaintenanceZones(nextZones);
      syncToCloud(vessels, qcTasks);
  };

  const removeBerthMaintenanceZone = async (indexToRemove) => {
      const zone = berthMaintenanceZones[indexToRemove];
      if (!zone) return;
      const zoneName = `Vùng bảo trì ${Math.round(zone.start)}m → ${Math.round(zone.end)}m`;
      const ok = await openConfirmDialog({
          title: 'Xác nhận xóa',
          message: `Bạn có chắc muốn xóa:\n- ${zoneName}`
      });
      if (!ok) return;
      const nextZones = berthMaintenanceZonesRef.current.filter((_, idx) => idx !== indexToRemove);
      berthMaintenanceZonesRef.current = nextZones;
      setBerthMaintenanceZones(nextZones);
      setSelectedMaintenanceZoneIds(prev => prev.filter(id => id !== zone.id));
      syncToCloud(vessels, qcTasks);
  };

  const toggleQcMaintenance = (qcId) => {
      setQcMaintenanceIds(prev => {
          const next = prev.includes(qcId) ? prev.filter(id => id !== qcId) : [...prev, qcId];
          qcMaintenanceIdsRef.current = next;
          // Persist immediately so other tabs/devices reflect the newest maintenance state.
          syncToCloud(vessels, qcTasks);
          return next;
      });
  };

  const startMaintenanceZoneDrag = (e, index, zone) => {
      if (!innerMapRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = innerMapRef.current.getBoundingClientRect();
      // Map is rendered with "right" positioning (WM600 on left -> WM0 on right)
      const zoneLeftPx = rect.left + (1 - (zone.end / totalVisLength)) * rect.width;
      const zoneRightPx = rect.left + (1 - (zone.start / totalVisLength)) * rect.width;
      const edgeThreshold = 14;
      const nearLeftEdge = Math.abs(e.clientX - zoneLeftPx) <= edgeThreshold;
      const nearRightEdge = Math.abs(e.clientX - zoneRightPx) <= edgeThreshold;
      let mode = 'move';
      // Shift + drag => resize zone (edge if near, otherwise nearest edge)
      if (e.shiftKey) {
          if (nearLeftEdge) mode = 'resize-left';
          else if (nearRightEdge) mode = 'resize-right';
          else mode = Math.abs(e.clientX - zoneLeftPx) <= Math.abs(e.clientX - zoneRightPx) ? 'resize-left' : 'resize-right';
      }

      maintenanceDragRef.current = {
          index,
          mode,
          startX: e.clientX,
          startStart: zone.start,
          startEnd: zone.end,
          moved: false
      };
      if (zone.id) setSelectedMaintenanceZoneIds([zone.id]);
  };

  const unlockQcRangeEditing = () => {
      if (qcRangePin === '1506') {
          setIsQcRangeUnlocked(true);
          setQcRangePin('');
          setToastMsg('Đã mở khóa chỉnh QC Range.');
          setTimeout(() => setToastMsg(''), 2500);
      } else {
          setToastMsg('Sai mã PIN QC Range.');
          setTimeout(() => setToastMsg(''), 2500);
      }
  };

  const normalizeQcPhysicalOrder = (qcs) => {
      if (!Array.isArray(qcs) || qcs.length === 0) return qcs;

      const byId = new Map(qcs.map(q => [q.id, { ...q }]));
      const ordered = QC_LOCKED_ORDER_IDS.map(id => byId.get(id)).filter(Boolean);
      if (ordered.length === 0) return qcs;

      // Anchor from right-most crane (closest WM0), then place leftwards.
      const rightMost = ordered[ordered.length - 1];
      rightMost.pos = Math.max(15, Math.min(585, Math.min(rightMost.rangeEnd, Math.max(rightMost.rangeStart, Number(rightMost.pos || 0)))));

      for (let i = ordered.length - 2; i >= 0; i--) {
          const current = ordered[i];
          const rightNeighbor = ordered[i + 1];
          const minPos = Math.max(15, current.rangeStart, rightNeighbor.pos + QC_MIN_SPACING);
          const maxPos = Math.min(585, current.rangeEnd);
          const rawPos = Number(current.pos || 0);
          current.pos = Math.max(minPos, Math.min(maxPos, rawPos));
      }

      const fixedById = new Map(ordered.map(q => [q.id, Math.round(q.pos)]));
      return qcs.map(q => (fixedById.has(q.id) ? { ...q, pos: fixedById.get(q.id) } : q));
  };

  const processSnapshot = (data) => {
      if (data.vessels && Array.isArray(data.vessels) && data.vessels.length > 0) {
          const validVessels = data.vessels.filter(v => v && v.id).map(v => {
              const normalizedName = v.type === 'barge' ? sanitizeBargeName(v.name) : v.name;
              if (!v.etd) {
                  return { ...v, name: normalizedName, etd: getEtdFallback(v.eta) };
              }
              return { ...v, name: normalizedName };
          });
          setVessels(validVessels);
          if (activeVesselId && !validVessels.find(v => v.id === activeVesselId)) {
              setActiveVesselId(null);
          }
      } else {
          setVessels([]);
      }
      if (data.qcs && Array.isArray(data.qcs)) {
          const updatedQcs = data.qcs.filter(q => q && q.id).map(q => {
              const rangeMatch = QC_RANGES.find(r => r.id === q.id) || { start: 15, end: 585, color: '#94a3b8' };
              const clampedPos = Math.max(15, Math.min(585, q.pos ?? (rangeMatch.start + 50)));
              return { ...q, pos: clampedPos, boomDown: q.boomDown ?? true, isSafeMode: q.isSafeMode ?? false, selected: q.selected ?? false, rangeStart: q.rangeStart ?? rangeMatch.start, rangeEnd: q.rangeEnd ?? rangeMatch.end, color: rangeMatch.color };
          });
          if(updatedQcs.length > 0) setQcTasks(normalizeQcPhysicalOrder(updatedQcs));
      }
      if (data.mooringPercent !== undefined) {
          setMooringPercent(data.mooringPercent);
      }
      if (data.qcProductivity !== undefined) {
          setQcProductivity(data.qcProductivity);
      }
      if (Array.isArray(data.berthMaintenanceZones)) {
          setBerthMaintenanceZones(
              data.berthMaintenanceZones
                  .map((z, idx) => ({ id: z.id || `maint-cloud-${idx}`, start: Number(z.start), end: Number(z.end) }))
                  .filter(z => Number.isFinite(z.start) && Number.isFinite(z.end) && z.end > z.start)
          );
      }
      if (Array.isArray(data.qcMaintenanceIds)) {
          qcMaintenanceIdsRef.current = data.qcMaintenanceIds;
          setQcMaintenanceIds(data.qcMaintenanceIds);
      }
  };

  useEffect(() => {
      const handleFocusIn = (e) => {
          if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) isTypingRef.current = true;
      };
      const handleFocusOut = (e) => {
          if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
              isTypingRef.current = false;
              if (pendingSnapshotRef.current) {
                  processSnapshot(pendingSnapshotRef.current);
                  pendingSnapshotRef.current = null;
              }
          }
      };
      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);
      return () => {
          document.removeEventListener('focusin', handleFocusIn);
          document.removeEventListener('focusout', handleFocusOut);
      };
  }, []);

  useEffect(() => {
    const app = getApps().some(a => a.name === '[DEFAULT]') ? getApp() : initializeApp(firebaseConfig);
    const database = getFirestore(app);
    const authentication = getAuth(app);
    setDb(database);

    const vbmsApp = getApps().some(a => a.name === 'VBMS_SYNC_APP')
      ? getApp('VBMS_SYNC_APP')
      : initializeApp(vbmsFirebaseConfig, 'VBMS_SYNC_APP');
    const vbmsDatabase = getFirestore(vbmsApp);
    const vbmsAuth = getAuth(vbmsApp);
    setVbmsDb(vbmsDatabase);

    const initAuth = async () => {
      try {
        await signInAnonymously(authentication);
      } catch (error) {
        console.error("Auth error:", error);
        setIsAuthReady(true);
      }
    };
    const initVbmsAuth = async () => {
      try {
        await signInAnonymously(vbmsAuth);
      } catch (error) {
        console.error("VBMS auth error:", error);
        setIsVbmsAuthReady(false);
      }
    };
    const unsubAuth = onAuthStateChanged(
      authentication,
      (user) => {
        if (user) setUserId(String(user.uid));
        setIsAuthReady(true);
      },
      (error) => {
        console.error("Auth state error:", error);
        setIsAuthReady(true);
      }
    );
    const unsubVbmsAuth = onAuthStateChanged(
      vbmsAuth,
      (user) => {
        if (user) {
          setVbmsUserId(String(user.uid));
          setIsVbmsAuthReady(true);
        } else {
          setVbmsUserId(null);
          setIsVbmsAuthReady(false);
        }
      },
      (error) => {
        console.error("VBMS auth state error:", error);
        setIsVbmsAuthReady(false);
      }
    );
    const authTimeout = setTimeout(() => setIsAuthReady(true), 5000);
    initAuth();
    initVbmsAuth();
    return () => {
      clearTimeout(authTimeout);
      unsubAuth();
      unsubVbmsAuth();
    };
  }, []);

  useEffect(() => {
      if (!isAuthReady || !db || !activeVessel?.name) return;
      const fetchImage = async () => {
          try {
              const vesselNameKey = activeVessel.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
              const imgRef = doc(db, 'artifacts', appId, 'public', 'data', 'vesselImages', vesselNameKey);
              const imgSnap = await getDoc(imgRef);
              if (imgSnap.exists() && imgSnap.data().base64) {
                  setActiveVesselImage(imgSnap.data().base64);
              } else {
                  setActiveVesselImage(null);
              }
          } catch (e) {
              if (!reportFirestoreConnectivity('vesselImages', e)) console.error('Error fetching image:', e);
              setActiveVesselImage(null);
          }
      };
      fetchImage();
  }, [isAuthReady, db, activeVessel?.name]);

  useEffect(() => {
    if (!isAuthReady || !db) return;
    if (!userId) {
      setLoading(false);
      return;
    }

    const masterDbRef = doc(db, 'artifacts', appId, 'public', 'data', 'vesselMasterDB', 'database');
    const unsubMaster = onSnapshot(masterDbRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.vessels && Array.isArray(data.vessels)) {
                setMasterVessels(data.vessels.filter(v => v && v.name).map(v => normalizeMasterVesselProfile(v))); 
            }
        }
    }, (error) => {
      if (!reportFirestoreConnectivity('Master DB', error)) console.error('Error Master DB', error);
    });

    const planDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'vesselPlans', 'currentPlan');
    const unsubCurrent = onSnapshot(planDocRef, (snapshot) => {
      if (snapshot.exists() && !isDraggingRef.current && !isSetupMode) { 
        const data = snapshot.data();
        if (isTypingRef.current) {
            pendingSnapshotRef.current = data;
        } else {
            processSnapshot(data);
        }
      }
      setLoading(false);
    }, (error) => {
      if (!reportFirestoreConnectivity('Current Plan', error)) console.error('Error Current Plan', error);
      setLoading(false);
    });

    const historyColRef = collection(db, 'artifacts', appId, 'public', 'data', 'vesselHistory');
    const unsubHistory = onSnapshot(historyColRef, (snapshot) => {
      const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistoryPlans(plans.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    }, (error) => {
      if (!reportFirestoreConnectivity('History', error)) console.error('Error History', error);
    });

    const voyagesColRef = collection(db, 'artifacts', appId, 'public', 'data', 'vesselVoyages');
    const unsubVoyages = onSnapshot(voyagesColRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllVoyages(data);
    }, (error) => {
      if (!reportFirestoreConnectivity('Voyages', error)) console.error('Error Voyages', error);
    });

    return () => { unsubCurrent(); unsubHistory(); unsubMaster(); unsubVoyages(); };
  }, [isAuthReady, db, userId, activeVesselId, isSetupMode]); 

  const activeVesselVoyages = useMemo(() => {
      if (!activeVessel?.name) return [];
      const key = activeVessel.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
      return allVoyages
        .filter(v => v.vesselNameKey === key)
        .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
  }, [allVoyages, activeVessel?.name]);

  const vesselSearchMatches = useMemo(() => {
      const keyword = String(vesselTabSearch || '').trim().toUpperCase();
      if (!keyword) return [];
      const source = Array.isArray(masterVessels) ? masterVessels : [];
      return source
          .filter(v => v && v.name)
          .filter(v => String(v.name || '').toUpperCase().includes(keyword))
          .slice(0, 20);
  }, [masterVessels, vesselTabSearch]);

  const nearestEtaVesselId = useMemo(() => {
      const now = Date.now();
      const vesselCandidates = vessels.filter(v => v && v.type === 'vessel');
      if (vesselCandidates.length === 0) return null;

      const withTime = vesselCandidates
          .map(v => {
              const etaMs = new Date(v.eta || '').getTime();
              return {
                  id: v.id,
                  diff: Number.isFinite(etaMs) ? Math.abs(etaMs - now) : Number.MAX_SAFE_INTEGER
              };
          })
          .sort((a, b) => a.diff - b.diff);

      return withTime[0]?.id || vesselCandidates[0]?.id || null;
  }, [vessels]);

  useEffect(() => {
      const prevTab = previousTabRef.current;
      if (activeTab === 'vessel' && prevTab !== 'vessel' && nearestEtaVesselId) {
          setActiveVesselId(nearestEtaVesselId);
      }
      previousTabRef.current = activeTab;
  }, [activeTab, nearestEtaVesselId]);

  useEffect(() => {
      if (!pendingAddVessel) {
          setPendingProfileDraft(null);
          setIsPendingProfileUnlocked(false);
          setPendingProfilePin('');
          return;
      }
      setPendingProfileDraft(normalizeMasterVesselProfile(pendingAddVessel));
      setIsPendingProfileUnlocked(false);
      setPendingProfilePin('');
  }, [pendingAddVessel]);

  useEffect(() => {
      const updateViewport = () => {
          setIsMobileViewport(window.innerWidth <= 900);
          setIsPortraitViewport(window.innerHeight >= window.innerWidth);
      };
      updateViewport();
      window.addEventListener('resize', updateViewport);
      return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
      const handleAfterPrint = () => { setIsPrintMode(false); };
      window.addEventListener('afterprint', handleAfterPrint);
      return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const getDefaultVisualPanY = () => {
      if (isMobileViewport) return isPortraitViewport ? -260 : -210;
      return -120;
  };
  const handleAutoCenter = () => {
      if (activeTab === 'visual' && !isPrintMode) {
          setPanOffset({ x: 0, y: getDefaultVisualPanY() });
          return;
      }
      setPanOffset({ x: 0, y: 0 });
  };
  useEffect(() => {
      if (activeTab !== 'visual' || isPrintMode) return;
      if (isMobileViewport) {
          const key = `${activeTab}-${isPortraitViewport ? 'portrait' : 'landscape'}`;
          if (mobileFrameKeyRef.current === key) return;
          mobileFrameKeyRef.current = key;
          setZoomLevel(1.5);
          setPanOffset({ x: 0, y: getDefaultVisualPanY() });
          return;
      }
      mobileFrameKeyRef.current = '';
      setPanOffset({ x: 0, y: getDefaultVisualPanY() });
  }, [activeTab, isMobileViewport, isPortraitViewport, isPrintMode]);

  const loadPdfLibraries = async () => {
      const promises = [];
      if (!window.htmlToImage) {
          promises.push(new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js';
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
          }));
      }
      if (!window.jspdf) {
          promises.push(new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
          }));
      }
      return Promise.all(promises);
  };

  const openPdfOptions = () => { setShowPdfModal(true); };

  const executePdfExport = async () => {
      setShowPdfModal(false);
      setActiveTab('visual');
      setIsPrintMode(true);
      setIsExportingPDF(true);
      
      setTimeout(async () => {
          try {
              await loadPdfLibraries();
              const element = document.getElementById('vessel-map-export');
              if (element) {
                  const dataUrl = await window.htmlToImage.toPng(element, { quality: 1.0, pixelRatio: 2, backgroundColor: '#ffffff' });
                  const { jsPDF } = window.jspdf;
                  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const pdfHeight = pdf.internal.pageSize.getHeight();
                  const margin = 5;
                  const availWidth = pdfWidth - (margin * 2);
                  const availHeight = pdfHeight - (margin * 2);
                  const baseRatio = Math.min(availWidth / 1200, availHeight / 700);
                  const userScaleFactor = (pdfConfig.scale || 125) / 100;
                  const finalWidth = 1200 * baseRatio * userScaleFactor;
                  const finalHeight = 700 * baseRatio * userScaleFactor;
                  const xOffset = margin + (availWidth - finalWidth) / 2;
                  const yOffset = margin + (availHeight - finalHeight) / 2;

                  pdf.addImage(dataUrl, 'PNG', xOffset, yOffset, finalWidth, finalHeight);
                  pdf.save(`KeHoachBen_CMIT_${new Date().getTime()}.pdf`);
              }
          } catch (error) {
              console.error("Lỗi xuất PDF:", error);
              await openAlertDialog({
                  title: 'Lỗi tạo PDF',
                  message: 'Vui lòng kiểm tra kết nối mạng để tải thư viện.'
              });
          } finally {
              setIsPrintMode(false);
              setIsExportingPDF(false);
          }
      }, 1000);
  };

  const callGeminiVision = async (base64Data, loa) => {
    const apiKey = geminiApiKey.trim();
    if (!apiKey) {
      throw new Error("Vui lòng nhập API Key của Gemini để sử dụng tính năng này.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const prompt = `Bạn là một chuyên gia AI về Thị giác Máy tính và Hàng hải. Nhiệm vụ của bạn là phân tích hình ảnh tàu biển và tính toán khoảng cách vật lý từ "Mũi tàu" (Bow) đến "TÂM CỦA CABIN" (Center of Accommodation Block).\n\nLOA: ${loa} mét.\n\nĐẦU RA BẮT BUỘC: \nRESULT_METERS: [X]`;
    const payload = { contents: [{ role: "user", parts: [ { text: prompt }, { inlineData: { mimeType: "image/jpeg", data: base64Data } } ] }] };
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let attempt = 0; attempt < 6; attempt++) {
        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (error) {
            if (attempt === 5) throw new Error("Lỗi kết nối Server AI sau nhiều lần thử.");
            await new Promise(res => setTimeout(res, delays[attempt]));
        }
    }
  };

  const handleAiImageUpload = (e) => {
      const file = e.target.files[0];
      if(!file || !activeVessel) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          const base64Full = event.target.result;
          setAiLoading(true); setAiError(''); setAiSuccessMsg(''); 
          setPendingAiDistance(null); setPendingAiImage(null);
          setAiResultText('Đang nén ảnh và gửi cho AI xử lý (Có thể mất 10-15s)...');
          try {
              const compressedBase64Full = await compressImage(base64Full, 800, 0.6);
              const compressedDataOnly = compressedBase64Full.split(',')[1];
              const resultText = await callGeminiVision(compressedDataOnly, activeVessel.loa || 200);
              setAiResultText(resultText);
              const match = resultText.match(/RESULT_METERS:\s*([0-9.]+)/i) || resultText.match(/ước tính là:\s*([0-9.]+)/i);
              if (match && match[1]) {
                  setPendingAiDistance(parseFloat(match[1]));
                  setPendingAiImage(compressedBase64Full);
                  setAiSuccessMsg(`Thành công! Khoảng cách Mũi -> Cabin = ${parseFloat(match[1])}m.`);
              } else {
                  setAiError('AI đã trả về kết quả nhưng hệ thống không thể tự động trích xuất con số.');
              }
          } catch(err) { setAiError(err.message); setAiResultText(''); } 
          finally { setAiLoading(false); if(aiImageInputRef.current) aiImageInputRef.current.value = ''; }
      };
      reader.readAsDataURL(file);
  };

  const confirmAndSaveAiResult = async () => {
      if (!pendingAiDistance || !activeVessel) return;
      let newCabinPos;
      if (activeVessel.side === 'PS') {
          newCabinPos = (activeVessel.sternPos || 0) - pendingAiDistance;
      } else {
          newCabinPos = (activeVessel.bowPos || 0) + pendingAiDistance;
      }
      updateActiveVessel({ bowToCabin: pendingAiDistance, cabinPos: newCabinPos });
      if (pendingAiImage && db && isAuthReady) {
          try {
              const vesselNameKey = activeVessel.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
              const imgRef = doc(db, 'artifacts', appId, 'public', 'data', 'vesselImages', vesselNameKey);
              await setDoc(imgRef, { base64: pendingAiImage, savedAt: new Date().toISOString() });
              setActiveVesselImage(pendingAiImage);
          } catch (e) {
            if (!reportFirestoreConnectivity('vesselImages save', e)) console.error('Lỗi khi lưu ảnh lên Cloud:', e);
          }
      }
      setPendingAiDistance(null); setPendingAiImage(null);
      setAiSuccessMsg('Đã lưu dữ liệu AI và hình ảnh vào hồ sơ!');
      setTimeout(() => setAiSuccessMsg(''), 3000);
  };

  const syncToCloud = async (vData, qData, pData) => {
    if (!db || !isAuthReady) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vesselPlans', 'currentPlan'), { vessels: vData || vessels, qcs: qData || qcTasks, mooringPercent: pData !== undefined ? pData : mooringPercent, qcProductivity: qcProductivity, berthMaintenanceZones: berthMaintenanceZonesRef.current, qcMaintenanceIds: qcMaintenanceIdsRef.current, updatedAt: new Date().toISOString() });
      planSyncWarnRef.current = false;
    } catch (e) {
      if (!reportFirestoreConnectivity('currentPlan', e)) {
        console.error(e);
        const denied = String(e?.code || '').includes('permission-denied') || /insufficient permissions/i.test(String(e?.message || ''));
        if (denied && !planSyncWarnRef.current) {
          planSyncWarnRef.current = true;
          setToastMsg('Không lưu được plan chính lên Cloud do thiếu quyền Firestore.');
          setTimeout(() => setToastMsg(''), 5000);
        }
      }
    }
  };

  useEffect(() => {
    if (!vbmsDb || !isVbmsAuthReady || !vbmsUserId) return;
    if (largeVesselSyncRef.current.syncing) return;

    const largeVesselsPayload = {};
    vessels.forEach((v) => {
      if (!v || v.type !== 'vessel') return;
      const loa = Number(v.loa || 0);
      const vesselName = String(v.name || '').trim().toUpperCase();
      if (!vesselName || !Number.isFinite(loa) || loa < LARGE_VESSEL_LOA_THRESHOLD_M) return;
      const voyage = String(v.voyage || '').trim().toUpperCase();
      largeVesselsPayload[vesselName] = {
        loa: Math.round(loa * 100) / 100,
        voyage: voyage || '-'
      };
    });

    const payloadHash = JSON.stringify(largeVesselsPayload);
    if (payloadHash === largeVesselSyncRef.current.hash) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      largeVesselSyncRef.current.syncing = true;
      try {
        const shipDbRef = doc(vbmsDb, 'artifacts', vbmsAppId, 'public', 'data', 'app_config', 'shipDatabase');
        const snapshot = await getDoc(shipDbRef);
        const existingData = snapshot.exists() ? snapshot.data() : {};
        const existingValue = existingData && typeof existingData.value === 'object' && existingData.value !== null ? existingData.value : {};
        const mergedValue = { ...existingValue, ...largeVesselsPayload };

        await setDoc(
          shipDbRef,
          {
            value: mergedValue,
            autoSyncLargeVessels: {
              enabled: true,
              loaThreshold: LARGE_VESSEL_LOA_THRESHOLD_M,
              source: 'berth-simulation-live',
              targetProject: vbmsFirebaseConfig.projectId,
              updatedAt: new Date().toISOString()
            }
          },
          { merge: true }
        );

        if (!cancelled) {
          largeVesselSyncRef.current.hash = payloadHash;
        }
      } catch (error) {
        if (!reportFirestoreConnectivity('VBMS shipDatabase', error)) {
          console.error('Error syncing LOA>=300 vessels to VBMS app_config/shipDatabase:', error);
          if (String(error?.code || '').includes('permission-denied')) {
            console.error('VBMS sync blocked: verify Anonymous Auth is enabled in vbms-system-3bde4 and Firestore rules allow write for authenticated users on artifacts/vbms-production-core/public/data/app_config/shipDatabase');
          }
        }
      } finally {
        largeVesselSyncRef.current.syncing = false;
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [vbmsDb, isVbmsAuthReady, vbmsUserId, vessels]);

  useEffect(() => {
    if (!db || !isAuthReady) return;
    if (voyageSyncRef.current.syncing) return;
    if (voyageSyncBlockRef.current.defaultDenied && voyageSyncBlockRef.current.vbmsDenied) return;

    const vesselOpsPayload = vessels
      .filter(v => v && v.type === 'vessel')
      .map(v => ({
        name: String(v.name || '').trim().toUpperCase(),
        voyage: String(v.voyage || '').trim().toUpperCase(),
        eta: v.eta || '',
        etd: v.etd || '',
        bowPos: Math.round(Number(v.bowPos || 0)),
        sternPos: Math.round(Number(v.sternPos || 0)),
        loa: Math.round(Number(v.loa || 0))
      }))
      .filter(v => v.name);

    const vesselOpsMap = {};
    vesselOpsPayload.forEach(v => {
      vesselOpsMap[v.name] = {
        vesselName: v.name,
        voyage: v.voyage || 'TBU',
        eta: v.eta || '',
        etd: v.etd || '',
        bowPos: v.bowPos,
        sternPos: v.sternPos,
        loa: v.loa
      };
    });

    const payloadHash = JSON.stringify(vesselOpsMap);
    if (payloadHash === voyageSyncRef.current.hash) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      voyageSyncRef.current.syncing = true;
      try {
        const defaultVoyageRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_config', 'voyage_history');
        const syncMeta = {
          source: 'berth-simulation-live',
          updatedAt: new Date().toISOString(),
          totalVessels: Object.keys(vesselOpsMap).length
        };

        const writeTasks = [];
        if (!voyageSyncBlockRef.current.defaultDenied) {
          writeTasks.push(
            setDoc(defaultVoyageRef, { value: vesselOpsMap, syncMeta }, { merge: true })
              .then(() => ({ target: 'default', ok: true }))
              .catch((err) => ({ target: 'default', ok: false, err }))
          );
        }
        if (vbmsDb && isVbmsAuthReady && vbmsUserId && !voyageSyncBlockRef.current.vbmsDenied) {
          const vbmsVoyageRef = doc(vbmsDb, 'artifacts', vbmsAppId, 'public', 'data', 'app_config', 'voyage_history');
          writeTasks.push(
            setDoc(vbmsVoyageRef, { value: vesselOpsMap, syncMeta }, { merge: true })
              .then(() => ({ target: 'vbms', ok: true }))
              .catch((err) => ({ target: 'vbms', ok: false, err }))
          );
        }
        if (writeTasks.length === 0) return;

        const writeResults = await Promise.all(writeTasks);
        const hasSuccess = writeResults.some(r => r.ok);

        writeResults.forEach((result) => {
          if (result.ok) return;
          const errCode = String(result.err?.code || '');
          const isDenied = errCode.includes('permission-denied') || /insufficient permissions/i.test(String(result.err?.message || ''));
          if (isDenied) {
            if (result.target === 'default') voyageSyncBlockRef.current.defaultDenied = true;
            if (result.target === 'vbms') voyageSyncBlockRef.current.vbmsDenied = true;
            if (!voyageSyncBlockRef.current.warned) {
              voyageSyncBlockRef.current.warned = true;
              setToastMsg('Một số quyền Cloud đang bị chặn (voyage_history). Lưu kế hoạch chính vẫn hoạt động.');
              setTimeout(() => setToastMsg(''), 4500);
            }
            console.warn(`Sync ${result.target} voyage_history disabled due to permission-denied.`);
            return;
          }
          if (!reportFirestoreConnectivity(`voyage_history (${result.target})`, result.err)) {
            console.error(`Error syncing ${result.target} app_config/voyage_history:`, result.err);
          }
        });

        if (!cancelled && hasSuccess) {
          voyageSyncRef.current.hash = payloadHash;
        }
      } catch (error) {
        if (!reportFirestoreConnectivity('voyage_history batch', error)) {
          console.error('Error syncing vessel voyage/berth positions to default+VBMS app_config/voyage_history:', error);
        }
      } finally {
        voyageSyncRef.current.syncing = false;
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [db, isAuthReady, vbmsDb, isVbmsAuthReady, vbmsUserId, vessels]);

  const saveToHistory = async () => {
    if (!db || !isAuthReady) return;
    try { 
        const planId = `Plan_${Date.now()}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vesselHistory', planId), { vessels, qcs: qcTasks, mooringPercent, berthMaintenanceZones, qcMaintenanceIds, updatedAt: new Date().toISOString(), updatedBy: userId }); 
        for (const v of vessels) {
            if (!v.name || !v.voyage || v.voyage === 'TBU' || v.voyage === '-') continue;
            const vesselNameKey = v.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
            const voyageKey = v.voyage.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
            const docId = `${vesselNameKey}_${voyageKey}`;
            const voyageRef = doc(db, 'artifacts', appId, 'public', 'data', 'vesselVoyages', docId);
            await setDoc(voyageRef, { ...v, vesselNameKey, savedAt: new Date().toISOString(), planId: planId });
        }
        setToastMsg('Đã lưu Kế hoạch & Hồ sơ chuyến thành công!');
        setTimeout(() => setToastMsg(''), 4000);
    } catch (err) { 
        setToastMsg('Lỗi khi lưu dữ liệu lên đám mây!');
        setTimeout(() => setToastMsg(''), 4000);
    }
  };

  const PROFILE_LOCKED_FIELDS = new Set([
    'name', 'loa', 'width', 'bowToCabin', 'cabinWidthM', 'bowToFunnel', 'funnelWidthM', 'bayMarkFirstEven', 'bayMarkLastEven',
    'bayCellM', 'bayGapM', 'cabinBayGapM', 'operationDeckBays', 'cabinFunnelCombined', 'bayNumberingScheme',
    'keelToHatch', 'keelToNav', 'keelToMast', 'twistlock', 'reeferMotor', 'flipHC', 'gearBoxes', 'remark', 'color'
  ]);

  const persistVesselProfile = async (vesselProfile) => {
    if (!vesselProfile || !String(vesselProfile.name || '').trim()) return;
    const key = String(vesselProfile.name || '').trim().toUpperCase();
    const nextProfile = normalizeMasterVesselProfile({ ...vesselProfile, name: key });

    const uniqueMap = new Map();
    (Array.isArray(masterVessels) ? masterVessels : []).forEach(v => {
      if (!v || !v.name) return;
      uniqueMap.set(String(v.name).toUpperCase(), normalizeMasterVesselProfile(v));
    });
    uniqueMap.set(key, normalizeMasterVesselProfile({ ...(uniqueMap.get(key) || {}), ...nextProfile }));
    const updatedDB = Array.from(uniqueMap.values());
    setMasterVessels(updatedDB);

    if (db && isAuthReady) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vesselMasterDB', 'database'), { vessels: updatedDB });
      } catch (err) {
        if (!reportFirestoreConnectivity('vesselMasterDB', err)) {
          console.error('Không thể lưu profile tàu vào master DB:', err);
          setToastMsg('Không thể lưu profile tàu vào cơ sở dữ liệu cloud.');
          setTimeout(() => setToastMsg(''), 3500);
        }
      }
    }
  };

  const deleteVesselProfileByName = async (vesselName) => {
    const key = String(vesselName || '').trim().toUpperCase();
    if (!key) return false;
    const ok = await openConfirmDialog({
      title: 'Xác nhận xóa profile tàu',
      message: `Bạn có chắc muốn xóa profile tàu:\n- ${key}\n\nThao tác này chỉ xóa hồ sơ trong cơ sở dữ liệu, không tự xóa tàu trên biểu đồ mô phỏng.`
    });
    if (!ok) return false;

    const updatedDB = (Array.isArray(masterVessels) ? masterVessels : []).filter(v => String(v?.name || '').toUpperCase() !== key);
    setMasterVessels(updatedDB);

    if (db && isAuthReady) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vesselMasterDB', 'database'), { vessels: updatedDB });
      } catch (err) {
        if (!reportFirestoreConnectivity('vesselMasterDB delete', err)) {
          console.error('Không thể xóa profile tàu khỏi master DB:', err);
          setToastMsg('Không thể xóa profile tàu trên cloud.');
          setTimeout(() => setToastMsg(''), 3500);
        }
        return false;
      }
    }
    return true;
  };

  const updateActiveVessel = (updates) => {
    const targetId = activeVesselId || activeVessel?.id;
    if (!targetId) return;
    const normalizedUpdates = { ...(updates || {}) };
    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'loa')) {
      const loaNum = Number(normalizedUpdates.loa || 0);
      if (Number.isFinite(loaNum) && loaNum > 0) {
        normalizedUpdates.width = Math.round((loaNum / 4.5) * 10) / 10;
      }
    }

    if (normalizedUpdates && Object.prototype.hasOwnProperty.call(normalizedUpdates, 'name')) {
      const active = vessels.find(v => v.id === targetId);
      if (active?.type === 'vessel' && isDuplicateVesselNameOnBerth(normalizedUpdates.name, targetId)) {
        setToastMsg('Không thể đặt trùng tên cho 2 tàu trên cùng cầu cảng.');
        setTimeout(() => setToastMsg(''), 3000);
        return;
      }
    }
    const hasLockedProfileChange = Object.keys(normalizedUpdates).some((k) => PROFILE_LOCKED_FIELDS.has(k));
    if (hasLockedProfileChange && !isVesselUnlocked) {
      setToastMsg('Cần nhập PIN để chỉnh sửa hồ sơ tàu.');
      setTimeout(() => setToastMsg(''), 2800);
      return;
    }

    const activeRow = vessels.find(v => v.id === targetId);
    if (activeRow?.type === 'vessel' && Object.prototype.hasOwnProperty.call(normalizedUpdates, 'bowToFunnel')) {
      const bf = Math.max(0, Math.round(Number(normalizedUpdates.bowToFunnel) || 0));
      normalizedUpdates.bowToFunnel = bf;
      const side = normalizedUpdates.side !== undefined ? normalizedUpdates.side : activeRow.side;
      const bow = Number(normalizedUpdates.bowPos !== undefined ? normalizedUpdates.bowPos : activeRow.bowPos) || 0;
      const stern = Number(normalizedUpdates.sternPos !== undefined ? normalizedUpdates.sternPos : activeRow.sternPos) || 0;
      if (bf <= 0) normalizedUpdates.funnelPos = undefined;
      else if (side === 'PS') normalizedUpdates.funnelPos = Math.round(stern - bf);
      else normalizedUpdates.funnelPos = Math.round(bow + bf);
    }

    if (activeRow?.type === 'vessel') {
      const nextCombined = Object.prototype.hasOwnProperty.call(normalizedUpdates, 'cabinFunnelCombined')
        ? normalizedUpdates.cabinFunnelCombined !== false
        : activeRow.cabinFunnelCombined !== false;
      const combinedSyncKeys = ['bowToCabin', 'cabinFunnelCombined', 'bowToFunnel', 'loa', 'bowPos', 'sternPos', 'side'];
      const shouldSyncCombined = nextCombined && combinedSyncKeys.some((k) => Object.prototype.hasOwnProperty.call(normalizedUpdates, k));
      if (shouldSyncCombined) {
        const loaNum = Number(normalizedUpdates.loa !== undefined ? normalizedUpdates.loa : activeRow.loa) || Math.max(1, Math.abs(Number(activeRow.sternPos || 0) - Number(activeRow.bowPos || 0)));
        let btc = Object.prototype.hasOwnProperty.call(normalizedUpdates, 'bowToCabin')
          ? Math.round(Number(normalizedUpdates.bowToCabin) || 0)
          : Math.round(Number(activeRow.bowToCabin) || 0);
        if (!Number.isFinite(btc) || btc <= 0) {
          const isPs = String(normalizedUpdates.side !== undefined ? normalizedUpdates.side : activeRow.side || '').toUpperCase() === 'PS';
          const bow = Number(normalizedUpdates.bowPos !== undefined ? normalizedUpdates.bowPos : activeRow.bowPos) || 0;
          const stern = Number(normalizedUpdates.sternPos !== undefined ? normalizedUpdates.sternPos : activeRow.sternPos) || 0;
          btc = isPs ? stern - Number(activeRow.cabinPos || 0) : Number(activeRow.cabinPos || 0) - bow;
          btc = Math.round(btc);
        }
        btc = Math.max(5, Math.min(loaNum - 5, btc));
        normalizedUpdates.bowToCabin = btc;
        normalizedUpdates.bowToFunnel = btc;
        const side = normalizedUpdates.side !== undefined ? normalizedUpdates.side : activeRow.side;
        const bow = Number(normalizedUpdates.bowPos !== undefined ? normalizedUpdates.bowPos : activeRow.bowPos) || 0;
        const stern = Number(normalizedUpdates.sternPos !== undefined ? normalizedUpdates.sternPos : activeRow.sternPos) || 0;
        if (btc <= 0) normalizedUpdates.funnelPos = undefined;
        else if (String(side || '').toUpperCase() === 'PS') normalizedUpdates.funnelPos = Math.round(stern - btc);
        else normalizedUpdates.funnelPos = Math.round(bow + btc);
      }
    }

    if (activeRow?.type === 'vessel') {
      const merged = { ...activeRow, ...normalizedUpdates };
      const combinedFinal = merged.cabinFunnelCombined !== false;
      if (!combinedFinal) {
        const loaNum =
          Number(merged.loa) ||
          Math.max(1, Math.abs(Number(merged.sternPos || 0) - Number(merged.bowPos || 0)));
        let btc = merged.bowToCabin;
        if (btc === '' || !Number.isFinite(Number(btc))) {
          const isPs = String(merged.side || '').toUpperCase() === 'PS';
          const bow = Number(merged.bowPos || 0);
          const stern = Number(merged.sternPos || 0);
          btc = isPs ? stern - Number(merged.cabinPos || 0) : Number(merged.cabinPos || 0) - bow;
        }
        btc = Math.round(Number(btc) || 0);
        const btf = Math.round(Number(merged.bowToFunnel) || 0);
        const fixed = clampBowToCabinFunnelOrder(loaNum, btc, btf, false, btf > 0);
        if (fixed.bowToCabin !== btc || fixed.bowToFunnel !== btf) {
          normalizedUpdates.bowToCabin = fixed.bowToCabin;
          normalizedUpdates.bowToFunnel = fixed.bowToFunnel;
          const side = merged.side;
          const bow = Number(merged.bowPos || 0);
          const stern = Number(merged.sternPos || 0);
          if (fixed.bowToFunnel <= 0) normalizedUpdates.funnelPos = undefined;
          else if (String(side || '').toUpperCase() === 'PS')
            normalizedUpdates.funnelPos = Math.round(stern - fixed.bowToFunnel);
          else normalizedUpdates.funnelPos = Math.round(bow + fixed.bowToFunnel);
          if (String(side || '').toUpperCase() === 'PS')
            normalizedUpdates.cabinPos = Math.round(stern - fixed.bowToCabin);
          else normalizedUpdates.cabinPos = Math.round(bow + fixed.bowToCabin);
        }
      }
    }

    const newVessels = vessels.map(v => v.id === targetId ? { ...v, ...normalizedUpdates } : v);
    setVessels(newVessels);
    if (!activeVesselId) setActiveVesselId(targetId);
    // Debounce cloud sync to avoid Firebase writes on every keystroke
    if (vesselSyncDebounceRef.current) clearTimeout(vesselSyncDebounceRef.current);
    vesselSyncDebounceRef.current = setTimeout(() => { syncToCloud(newVessels); vesselSyncDebounceRef.current = null; }, 800);
    if (hasLockedProfileChange) {
      const updatedProfile = newVessels.find(v => v.id === targetId && v.type === 'vessel');
      if (updatedProfile) {
        if (vesselProfileDebounceRef.current) clearTimeout(vesselProfileDebounceRef.current);
        vesselProfileDebounceRef.current = setTimeout(() => { persistVesselProfile(updatedProfile); vesselProfileDebounceRef.current = null; }, 1200);
      }
    }
  };

  const buildMiniLayoutDraftFromVessel = (v) => {
    if (!v || v.type !== 'vessel') return null;
    const bow = Number(v.bowPos || 0);
    const stern = Number(v.sternPos || 0);
    const loa = Math.max(1, Number(v.loa || (stern - bow) || 1));
    const isPs = String(v.side || '').toUpperCase() === 'PS';
    let btc = Number(v.bowToCabin);
    if (!Number.isFinite(btc)) {
      btc = isPs ? stern - Number(v.cabinPos || 0) : Number(v.cabinPos || 0) - bow;
    }
    btc = Math.max(5, Math.min(loa - 5, Math.round(btc)));
    let btf = Math.round(Number(v.bowToFunnel) || 0);
    if (!Number.isFinite(btf)) btf = 0;
    btf = Math.max(0, Math.min(loa - 5, btf));
    const combined = v.cabinFunnelCombined !== false;
    if (combined) btf = btc;
    const fixed = clampBowToCabinFunnelOrder(loa, btc, btf, combined, btf > 0);
    return { vesselId: v.id, bowToCabin: fixed.bowToCabin, bowToFunnel: fixed.bowToFunnel };
  };

  useEffect(() => {
    if (!isVesselUnlocked || activeVessel?.type !== 'vessel') {
      setMiniLayoutDraft(null);
      return;
    }
    setMiniLayoutDraft((prev) => {
      if (prev && prev.vesselId === activeVessel.id) return prev;
      return buildMiniLayoutDraftFromVessel(activeVessel);
    });
  }, [isVesselUnlocked, activeVessel?.id, activeVessel?.type]);

  useEffect(() => {
    const onMove = (e) => {
      const kind = miniLayoutDragRef.current.kind;
      if (!kind || !miniShipTrackRef.current) return;
      const v = activeVesselRef.current;
      if (!v || v.type !== 'vessel') return;
      const r = miniShipTrackRef.current.getBoundingClientRect();
      let p = (e.clientX - r.left) / Math.max(1, r.width);
      p = Math.max(0.02, Math.min(0.98, p));
      const bow = Number(v.bowPos || 0);
      const stern = Number(v.sternPos || 0);
      const loa = Math.max(1, Number(v.loa || (stern - bow) || 1));
      const isPs = String(v.side || '').toUpperCase() === 'PS';
      const distFromBow = isPs ? p * loa : (1 - p) * loa;
      if (kind === 'cabin') {
        const btc = Math.max(5, Math.min(loa - 5, distFromBow));
        const btcR = Math.round(btc);
        const combined = v.cabinFunnelCombined !== false;
        setMiniLayoutDraft((d) => {
          if (!d || d.vesselId !== v.id) return d;
          if (combined) return { ...d, bowToCabin: btcR, bowToFunnel: btcR };
          const fixed = clampBowToCabinFunnelOrder(loa, btcR, d.bowToFunnel, false, d.bowToFunnel > 0);
          return { ...d, ...fixed };
        });
      } else if (kind === 'funnel') {
        const btf = Math.max(0, Math.min(loa - 5, distFromBow));
        const btfR = Math.round(btf);
        setMiniLayoutDraft((d) => {
          if (!d || d.vesselId !== v.id) return d;
          const fixed = clampBowToCabinFunnelOrder(loa, d.bowToCabin, btfR, false, btfR > 0);
          return { ...d, ...fixed };
        });
      }
    };
    const onUp = () => {
      miniLayoutDragRef.current.kind = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const commitMiniLayoutDraft = () => {
    const draft = miniLayoutDraft;
    const v = activeVessel;
    if (!draft || !v || v.type !== 'vessel' || draft.vesselId !== v.id) return;
    const bow = Number(v.bowPos || 0);
    const stern = Number(v.sternPos || 0);
    const loa = Math.max(1, stern - bow);
    const isPs = String(v.side || '').toUpperCase() === 'PS';
    let btc = Math.round(draft.bowToCabin);
    btc = Math.max(5, Math.min(loa - 5, btc));
    let btf = Math.round(draft.bowToFunnel);
    btf = Math.max(0, Math.min(loa - 5, btf));
    if (v.cabinFunnelCombined !== false) btf = btc;
    const ord = clampBowToCabinFunnelOrder(loa, btc, btf, v.cabinFunnelCombined !== false, btf > 0);
    btc = ord.bowToCabin;
    btf = ord.bowToFunnel;
    const cabinPos = isPs ? Math.round(stern - btc) : Math.round(bow + btc);
    const updates = { cabinPos, bowToCabin: btc, bowToFunnel: btf };
    if (btf <= 0) updates.funnelPos = undefined;
    else updates.funnelPos = isPs ? Math.round(stern - btf) : Math.round(bow + btf);
    updateActiveVessel(updates);
    setToastMsg('Đã lưu vị trí cabin & ống khói vào hồ sơ tàu.');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleAutoExtractRemark = async () => {
      if (!activeVessel || !activeVessel.remark) return;
      const extractedUpdates = parseSmartRemark(activeVessel.remark, activeVessel);
      if (Object.keys(extractedUpdates).length > 0) {
          if (extractedUpdates.bowToCabin !== undefined) {
              if (activeVessel.side === 'PS') {
                  extractedUpdates.cabinPos = (activeVessel.sternPos || 0) - extractedUpdates.bowToCabin;
              } else {
                  extractedUpdates.cabinPos = (activeVessel.bowPos || 0) + extractedUpdates.bowToCabin;
              }
          }
          updateActiveVessel(extractedUpdates);
          setToastMsg('Đã bóc tách thông số từ Ghi chú thành công!');
          setTimeout(() => setToastMsg(''), 3000);
      } else {
          await openAlertDialog({
              title: 'Thiếu thông số',
              message: 'Hệ thống chưa tìm thấy thông số hợp lệ!'
          });
      }
  };

  const addNewVessel = () => {
    setShowVesselModal(true); setUploadMsg(''); setSearchQuery('');
    setShowNewVesselForm(false); setFormError(''); setQuickAddVoyage('TBU');
    // if (!uiState.listExpanded) toggleUi('listExpanded');
  };

  const triggerNewVesselForm = (defaultName = '') => {
    const curEta = getCurrentDateTimeLocal();
    const curEtd = getEtdFallback(curEta);
    setNewVesselData({ name: defaultName || searchQuery.toUpperCase(), loa: '', side: 'SB', eta: curEta, etd: curEtd, voyage: 'TBU' });
    setShowNewVesselForm(true);
    setFormError('');
  };
  const openCreateVesselFromSearch = (seedName = '') => {
    setShowVesselModal(true);
    setUploadMsg('');
    setSearchQuery(String(seedName || '').toUpperCase());
    triggerNewVesselForm(String(seedName || '').toUpperCase());
  };

  const handleCreateNewVessel = () => {
    if (!newVesselData.name.trim()) { setFormError('Vui lòng nhập Tên Tàu!'); return; }
    if (!newVesselData.loa || newVesselData.loa <= 0) { setFormError('Vui lòng nhập LOA hợp lệ (lớn hơn 0)!'); return; }
    if (!newVesselData.side) { setFormError('Vui lòng chọn Mạn Cập!'); return; }
    if (isDuplicateVesselNameOnBerth(newVesselData.name)) { setFormError('Tên tàu đã tồn tại trên cùng cầu cảng. Vui lòng dùng tên khác.'); return; }

    const newLoa = Number(newVesselData.loa);
    const newType = 'vessel';
    const newTier = 1;
    const freeBowPos = findFreePosition({ loa: newLoa, type: newType, tier: newTier }, vessels, mooringPercent);
    const etaVal = newVesselData.eta || getCurrentDateTimeLocal();
    
    let bowCabinNew = Math.round(newLoa * 0.8);
    let bowFunnelNew = bowCabinNew;
    let cabinWidth = 10;
    let funnelWidth = 8;
    let combined = true;
    
    if (newVesselData.specs) {
        if (newVesselData.specs.bowToCabin != null) bowCabinNew = Math.round(newVesselData.specs.bowToCabin);
        if (newVesselData.specs.bowToFunnel != null) bowFunnelNew = Math.round(newVesselData.specs.bowToFunnel);
        if (newVesselData.specs.cabinWidthM != null) cabinWidth = newVesselData.specs.cabinWidthM;
        if (newVesselData.specs.funnelWidthM != null) funnelWidth = newVesselData.specs.funnelWidthM;
        if (newVesselData.specs.cabinFunnelCombined != null) combined = newVesselData.specs.cabinFunnelCombined;
    }
    
    const funnelPosNew =
      newVesselData.side === 'PS'
        ? Math.round(freeBowPos + newLoa - bowFunnelNew)
        : Math.round(freeBowPos + bowFunnelNew);

    const newVessel = { 
        id: `vessel-${Date.now()}-${Math.floor(Math.random()*1000)}`, type: newType, tier: newTier, 
        name: newVesselData.name.trim().toUpperCase(), voyage: String(newVesselData.voyage || 'TBU').toUpperCase(), loa: newLoa, 
        width: Math.round((newLoa / 4.5) * 10) / 10,
        eta: etaVal, etd: newVesselData.etd || getEtdFallback(etaVal),
        berthName: "CMIT", side: newVesselData.side, direction: "THƯỢNG LƯU", 
        bowPos: freeBowPos, sternPos: freeBowPos + newLoa, cabinPos: freeBowPos + bowCabinNew, 
        dis: 0, load: 0, hue: (vessels.length * 80 + 200) % 360,
        color: getAvailableColor(vessels),
        bowToCabin: bowCabinNew, cabinWidthM: cabinWidth, bowToFunnel: bowFunnelNew, funnelWidthM: funnelWidth,
        bayMarkFirstEven: 2, bayMarkLastEven: 0,
        bayCellM: 12, bayGapM: 2.5, cabinBayGapM: 2.5,
        operationDeckBays: '',
        cabinFunnelCombined: combined,
        bayNumberingScheme: BAY_SCHEME_SINGLE_01_04_08,
        funnelPos: funnelPosNew,
        keelToHatch: "", keelToNav: "", keelToMast: "",
        twistlock: "", reeferMotor: "", flipHC: "", gearBoxes: "", remark: ""
    };
    setVessels([...vessels, newVessel]); setActiveVesselId(newVessel.id); syncToCloud([...vessels, newVessel]);
    persistVesselProfile(newVessel);
    // setUiState(prev => ({ ...prev, detailsExpanded: true }));
    setShowVesselModal(false); setShowNewVesselForm(false);
  };

  const addVesselFromDB = (dbVessel, options = {}) => {
    const normalizedDbProfile = normalizeMasterVesselProfile(dbVessel || {});
    const dbVesselName = String(normalizedDbProfile.name || 'TÀU DB').toUpperCase();
    if (isDuplicateVesselNameOnBerth(dbVesselName)) {
      setToastMsg(`Không thể thêm. Tàu "${dbVesselName}" đã có trên cầu cảng.`);
      setTimeout(() => setToastMsg(''), 3000);
      return;
    }

    // Merge specs from operation if provided (overrides master db layout)
    const opSpecs = options.specs || null;

    const newLoa = normalizedDbProfile.loa || 200;
    const newType = 'vessel';
    const newTier = 1;
    const freeBowPos = findFreePosition({ loa: newLoa, type: newType, tier: newTier }, vessels, mooringPercent);
    let bowCabinRounded = Math.round(normalizedDbProfile.bowToCabin || newLoa * 0.8);
    let bowFunnelRounded = Math.round(normalizedDbProfile.bowToFunnel || 0);
    let cabinWidthFinal = normalizedDbProfile.cabinWidthM;
    let funnelWidthFinal = normalizedDbProfile.funnelWidthM;
    let combinedFinal = normalizedDbProfile.cabinFunnelCombined !== false;
    let operationCabinAfterFull = normalizedDbProfile.operationCabinAfterFull ?? null;
    let operationFunnelAfterFull = normalizedDbProfile.operationFunnelAfterFull ?? null;
    let operationCabinGapBow = normalizedDbProfile.operationCabinGapBow ?? null;
    let operationCabinGapStern = normalizedDbProfile.operationCabinGapStern ?? null;
    let operationFunnelGapBow = normalizedDbProfile.operationFunnelGapBow ?? null;
    let operationFunnelGapStern = normalizedDbProfile.operationFunnelGapStern ?? null;
    let operationDeckSortSB = normalizedDbProfile.operationDeckSortSB !== false;

    // Override with fresh layout from operation module if available
    if (opSpecs) {
      if (opSpecs.bowToCabin != null) bowCabinRounded = Math.round(opSpecs.bowToCabin);
      if (opSpecs.bowToFunnel != null) bowFunnelRounded = Math.round(opSpecs.bowToFunnel);
      if (opSpecs.cabinWidthM != null) cabinWidthFinal = opSpecs.cabinWidthM;
      if (opSpecs.funnelWidthM != null) funnelWidthFinal = opSpecs.funnelWidthM;
      if (opSpecs.cabinFunnelCombined != null) combinedFinal = opSpecs.cabinFunnelCombined;
      if (opSpecs.operationCabinAfterFull != null) operationCabinAfterFull = opSpecs.operationCabinAfterFull;
      if (opSpecs.operationFunnelAfterFull != null) operationFunnelAfterFull = opSpecs.operationFunnelAfterFull;
      if (opSpecs.operationCabinGapBow != null) operationCabinGapBow = opSpecs.operationCabinGapBow;
      if (opSpecs.operationCabinGapStern != null) operationCabinGapStern = opSpecs.operationCabinGapStern;
      if (opSpecs.operationFunnelGapBow != null) operationFunnelGapBow = opSpecs.operationFunnelGapBow;
      if (opSpecs.operationFunnelGapStern != null) operationFunnelGapStern = opSpecs.operationFunnelGapStern;
      if (opSpecs.operationDeckSortSB != null) operationDeckSortSB = opSpecs.operationDeckSortSB;
    }

    const autoBayMode = normalizedDbProfile.bayMarkLastEven < normalizedDbProfile.bayMarkFirstEven;
    if (combinedFinal) {
      bowFunnelRounded = bowCabinRounded;
    } else if (bowFunnelRounded <= 0 && autoBayMode) {
      const slotsSeed = computeBaySlotsFromCabinGeometry(
        newLoa,
        bowCabinRounded,
        cabinWidthFinal,
        normalizedDbProfile.bayCellM,
        normalizedDbProfile.bayGapM,
        normalizedDbProfile.cabinBayGapM
      );
      if (slotsSeed.length > 0) {
        bowFunnelRounded = suggestBowToFunnelFromSlots(
          slotsSeed,
          newLoa,
          bowCabinRounded,
          cabinWidthFinal,
          normalizedDbProfile.bayCellM
        );
      } else {
        bowFunnelRounded = Math.round(newLoa * 0.42);
      }
    }
    if (!combinedFinal && bowFunnelRounded > 0) {
      const ord = clampBowToCabinFunnelOrder(newLoa, bowCabinRounded, bowFunnelRounded, false, true);
      bowCabinRounded = ord.bowToCabin;
      bowFunnelRounded = ord.bowToFunnel;
    }
    const vesselSide = options.side === 'PS' ? 'PS' : 'SB';
    const sternPos = freeBowPos + newLoa;
    const cabinPosInit = vesselSide === 'PS'
      ? Math.round(sternPos - bowCabinRounded)
      : Math.round(freeBowPos + bowCabinRounded);
    const funnelPosInit = bowFunnelRounded > 0
      ? (vesselSide === 'PS' ? Math.round(sternPos - bowFunnelRounded) : Math.round(freeBowPos + bowFunnelRounded))
      : null;
    const etaVal = getCurrentDateTimeLocal();

    const newVessel = {
        id: `vessel-${Date.now()}-${Math.floor(Math.random()*1000)}`, type: newType, tier: newTier, name: dbVesselName, voyage: String(options.voyage || normalizedDbProfile.voyage || 'TBU').toUpperCase(), loa: newLoa,
        width: Math.round((newLoa / 4.5) * 10) / 10,
        eta: etaVal, etd: getEtdFallback(etaVal), berthName: "CMIT",
        side: vesselSide,
        direction: "THƯỢNG LƯU",
        bowPos: freeBowPos, sternPos: sternPos, cabinPos: cabinPosInit,
        dis: 0, load: 0, hue: (vessels.length * 80 + 200) % 360,
        color: getAvailableColor(vessels),
        bowToCabin: bowCabinRounded,
        cabinWidthM: cabinWidthFinal,
        bowToFunnel: bowFunnelRounded,
        funnelWidthM: funnelWidthFinal,
        bayMarkFirstEven: normalizedDbProfile.bayMarkFirstEven,
        bayMarkLastEven: normalizedDbProfile.bayMarkLastEven,
        bayCellM: normalizedDbProfile.bayCellM,
        bayGapM: normalizedDbProfile.bayGapM,
        cabinBayGapM: normalizedDbProfile.cabinBayGapM,
        operationDeckBays: normalizedDbProfile.operationDeckBays || '',
        cabinFunnelCombined: combinedFinal,
        bayNumberingScheme: normalizedDbProfile.bayNumberingScheme,
        operationCabinAfterFull,
        operationFunnelAfterFull,
        operationDeckSortSB,
        operationCabinGapBow,
        operationCabinGapStern,
        operationFunnelGapBow,
        operationFunnelGapStern,
        funnelPos: funnelPosInit,
        keelToHatch: String(normalizedDbProfile.keelToHatch || "").toUpperCase(),
        keelToNav: String(normalizedDbProfile.keelToNav || "").toUpperCase(),
        keelToMast: String(normalizedDbProfile.keelToMast || "").toUpperCase(),
        twistlock: String(normalizedDbProfile.twistlock || "").toUpperCase(),
        reeferMotor: String(normalizedDbProfile.reeferMotor || "").toUpperCase(),
        flipHC: String(normalizedDbProfile.flipHC || "").toUpperCase(),
        gearBoxes: String(normalizedDbProfile.gearBoxes || "").toUpperCase(),
        remark: String(normalizedDbProfile.remark || "").toUpperCase()
    };
    setVessels([...vessels, newVessel]); setActiveVesselId(newVessel.id); syncToCloud([...vessels, newVessel]);
    setShowVesselModal(false);
    return newVessel.id;
  };

  const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadMsg('Đang tải thư viện xử lý Excel...');
      try {
          if (!window.XLSX) {
              await new Promise((resolve, reject) => {
                  const script = document.createElement('script');
                  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                  script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
              });
          }
          setUploadMsg('Đang nạp hàng trăm con tàu...');
          const reader = new FileReader();
          reader.onload = async (event) => {
              try {
                  const data = new Uint8Array(event.target.result);
                  const workbook = window.XLSX.read(data, { type: 'array' });
                  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                  const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                  if (jsonData.length === 0) { setUploadMsg('Lỗi: File trống!'); return; }
                  const newVessels = [];
                  for (let i = 0; i < jsonData.length; i++) {
                      const row = jsonData[i];
                      const normalizedRow = {};
                      for (let key in row) normalizedRow[key.trim().toLowerCase()] = row[key];
                      const nameKey = Object.keys(normalizedRow).find(k => ['vessel name', 'tên tàu', 'vessel', 'name'].some(match => k.includes(match)));
                      if (!nameKey || !normalizedRow[nameKey]) continue; 
                      const findCol = (keywords) => { const key = Object.keys(normalizedRow).find(k => keywords.some(match => k.includes(match))); return key ? normalizedRow[key] : ""; };
                      const name = String(normalizedRow[nameKey]).trim().toUpperCase();
                      const remarkRaw = String(findCol(['remark', 'ghi chú', 'all info'])).toUpperCase();
                      const cabinFunnelCol = String(
                        findCol([
                          'cabin+funnel liền',
                          'cabin funnel combined',
                          'cabin khói liền',
                          'liền cabin khói',
                          'cabinfunnelcombined'
                        ])
                      ).trim().toLowerCase();
                      const cabinFunnelCombined =
                        cabinFunnelCol === '0' ||
                        cabinFunnelCol === 'false' ||
                        cabinFunnelCol === 'no' ||
                        cabinFunnelCol === 'tách' ||
                        cabinFunnelCol === 'separate'
                          ? false
                          : true;
                      const baySchCol = String(
                        findCol(['nhịp bay', 'bay numbering', 'baynumberscheme', 'bay scheme'])
                      ).trim().toLowerCase();
                      const bayNumberingScheme =
                        baySchCol.includes('pair') ||
                        baySchCol.includes('02_06') ||
                        baySchCol === BAY_SCHEME_PAIR_02_06_10
                          ? BAY_SCHEME_PAIR_02_06_10
                          : BAY_SCHEME_SINGLE_01_04_08;
                      let parsedData = {
                          name: name, loa: parseFloat(findCol(['loa', 'chiều dài'])) || 200, remark: remarkRaw,
                          flipHC: String(findCol(['flip'])).toUpperCase(), twistlock: fixTypos(String(findCol(['twislock', 'twistlock']))), 
                          reeferMotor: String(findCol(['reefer'])).toUpperCase(), gearBoxes: String(findCol(['gear'])).toUpperCase(),
                          keelToHatch: String(findCol(['hatch'])).toUpperCase(), keelToNav: String(findCol(['navigation', 'nav'])).toUpperCase(),
                          keelToMast: String(findCol(['mast'])).toUpperCase(), bowToCabin: Math.round(parseFloat(findCol(['cabin', 'mũi-cabin'])) || 0),
                          operationDeckBays: String(
                            findCol(['operation deck bays', 'operation bay', 'deck bays operation', 'bays operation overview'])
                          ).trim(),
                          cabinFunnelCombined,
                          bayNumberingScheme
                      };
                      parsedData.width = Math.round((Number(parsedData.loa || 0) / 4.5) * 10) / 10;
                      const smartUpdates = parseSmartRemark(remarkRaw, { loa: parsedData.loa });
                      Object.assign(parsedData, smartUpdates);
                      newVessels.push(parsedData);
                  }
                  if (newVessels.length === 0) { setUploadMsg('Lỗi: Không tìm thấy tên tàu.'); return; }
                  const uniqueMap = new Map();
                  masterVessels.forEach(v => uniqueMap.set(String(v.name).toUpperCase(), v));
                  let addedCount = 0, updatedCount = 0;
                  newVessels.forEach(nv => {
                      const key = nv.name.toUpperCase();
                      if (uniqueMap.has(key)) { updatedCount++; uniqueMap.set(key, { ...uniqueMap.get(key), ...nv }); } 
                      else { addedCount++; uniqueMap.set(key, nv); }
                  });
                  const updatedDB = Array.from(uniqueMap.values()).map(v => normalizeMasterVesselProfile(v));
                  setMasterVessels(updatedDB);
                  if (db && isAuthReady) {
                      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vesselMasterDB', 'database'), { vessels: updatedDB });
                      setUploadMsg(`Thành công: Nạp ${addedCount}, Cập nhật ${updatedCount}!`);
                  }
              } catch (err) { setUploadMsg('Lỗi đọc file: ' + err.message); }
              if (fileInputRef.current) fileInputRef.current.value = '';
          };
          reader.readAsArrayBuffer(file);
      } catch (error) { setUploadMsg('LỖI: KHÔNG TẢI ĐƯỢC THƯ VIỆN.'); }
  };

  const handleExportExcel = async () => {
      setUploadMsg('ĐANG TẠO FILE EXCEL...');
      try {
          if (!window.ExcelJS) {
              await new Promise((resolve, reject) => {
                  const script = document.createElement('script'); script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
                  script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
              });
          }
          const workbook = new window.ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('MASTER_VESSELS');
          worksheet.columns = [
              { header: 'VESSEL NAME', key: 'name', width: 22 }, { header: 'LOA (M)', key: 'loa', width: 8 },
              { header: 'MŨI-CABIN', key: 'bowToCabin', width: 12 },
              { header: 'RỘNG CABIN', key: 'cabinWidthM', width: 11 },
              { header: 'MŨI-KHÓI', key: 'bowToFunnel', width: 11 },
              { header: 'RỘNG KHÓI', key: 'funnelWidthM', width: 11 },
              { header: 'BAY ĐẦU', key: 'bayMarkFirstEven', width: 9 },
              { header: 'BAY CUỐI', key: 'bayMarkLastEven', width: 9 },
              { header: 'Ô BAY (M)', key: 'bayCellM', width: 9 },
              { header: 'KHE BAY (M)', key: 'bayGapM', width: 9 },
              { header: 'KHE CABIN (M)', key: 'cabinBayGapM', width: 11 },
              { header: 'BAY OPERATION (mũi→lái)', key: 'operationDeckBays', width: 28 },
              { header: 'CABIN+KHÓI LIỀN (1/0)', key: 'cabinFunnelCombined', width: 16 },
              { header: 'NHỊP BAY (single|pair)', key: 'bayNumberingScheme', width: 22 },
              { header: 'TWISTLOCK', key: 'twistlock', width: 18 },
              { header: 'FLIP H/C', key: 'flipHC', width: 22 }, { header: 'KEEL TO HATCH COVER', key: 'keelToHatch', width: 14 },
              { header: 'KEEL TO NAV DECK', key: 'keelToNav', width: 14 }, { header: 'KEEL TO TOP MAST', key: 'keelToMast', width: 14 },
              { header: 'REEFER MOTOR', key: 'reeferMotor', width: 15 }, { header: 'GEAR BOXES', key: 'gearBoxes', width: 14 },
              { header: 'REMARK', key: 'remark', width: 40 } 
          ];
          safeMasterVessels.forEach(v => { worksheet.addRow(v); });
          const buffer = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `BANG_THONG_SO_TAU.xlsx`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
          setUploadMsg('XUẤT EXCEL THÀNH CÔNG!');
      } catch (error) { setUploadMsg('LỖI XUẤT EXCEL!'); }
  };

  const addBarge = (preset) => {
    const newLoa = preset.loa;
    const newType = 'barge';
    const newTier = 1; 
    const freeBowPos = findFreePosition({ loa: newLoa, type: newType, tier: newTier }, vessels, mooringPercent);
    const etaVal = getCurrentDateTimeLocal();

    const newBarge = { 
        id: `barge-${Date.now()}-${Math.floor(Math.random()*1000)}`, type: newType, tier: newTier, name: String(preset.bays).toUpperCase(), voyage: "-", loa: newLoa, 
        eta: etaVal, etd: getEtdFallback(etaVal), berthName: "CMIT", side: "SB", direction: "THƯỢNG LƯU", 
        bowPos: freeBowPos, sternPos: freeBowPos + newLoa, cabinPos: freeBowPos + newLoa - 5, 
        dis: 0, load: 0, hue: (vessels.length * 50 + 20) % 360,
        color: getAvailableColor(vessels),
        totalRemain: 0
    };
    setVessels([...vessels, newBarge]); setActiveVesselId(newBarge.id); setShowBargeMenu(false); syncToCloud([...vessels, newBarge]);
    // setUiState(prev => ({ ...prev, detailsExpanded: true }));
    // if (!uiState.listExpanded) toggleUi('listExpanded');
  }

  const canPlaceAutoBargeAt = (bowPos, loa, currentVessels) => {
      const sternPos = bowPos + loa;
      if (bowPos < BARGE_EDGE_SAFETY_M || sternPos > (600 - BARGE_EDGE_SAFETY_M)) return false; // keep 8m edge safety inside CMIT 600m

      const newBargeProbe = { type: 'barge', tier: 1, loa, bowPos, sternPos };
      const sameTier = currentVessels.filter(v => (v.tier || 1) === 1);

      for (const other of sameTier) {
          // Skip vessels fully outside 600m scope
          if ((other.sternPos || 0) <= 0 || (other.bowPos || 0) >= 600) continue;

          // Additional safety from vessel bow: barge body must stay >= 40m away from ship bow point
          if (other.type === 'vessel') {
              const vesselBow = Number(other.bowPos || 0);
              if (vesselBow >= (bowPos - BARGE_BOW_SAFETY_FROM_VESSEL_M) && vesselBow <= (sternPos + BARGE_BOW_SAFETY_FROM_VESSEL_M)) {
                  return false;
              }
          }

          const clearance = getClearance(newBargeProbe, other, mooringPercent);
          const noOverlap = sternPos <= (other.bowPos - clearance) || bowPos >= (other.sternPos + clearance);
          if (!noOverlap) return false;
      }

      // Avoid berth maintenance zones
      for (const zone of berthMaintenanceZonesRef.current || []) {
          const zoneStart = Number(zone.start || 0);
          const zoneEnd = Number(zone.end || 0);
          if (!Number.isFinite(zoneStart) || !Number.isFinite(zoneEnd) || zoneEnd <= zoneStart) continue;
          const noOverlap = sternPos <= (zoneStart - AUTO_FILL_MAINT_ZONE_BUFFER_M) || bowPos >= (zoneEnd + AUTO_FILL_MAINT_ZONE_BUFFER_M);
          if (!noOverlap) return false;
      }

      // Avoid QC under maintenance (keep a safety buffer around its current position)
      for (const qc of qcTasks) {
          if (!qcMaintenanceIdsRef.current?.includes(qc.id)) continue;
          const left = Number(qc.pos || 0) - AUTO_FILL_QC_MAINT_BUFFER_M;
          const right = Number(qc.pos || 0) + AUTO_FILL_QC_MAINT_BUFFER_M;
          const noOverlap = sternPos <= left || bowPos >= right;
          if (!noOverlap) return false;
      }

      return true;
  };

  const autoFillBargesInBerth = async () => {
      const eligiblePresets = [...BARGE_PRESETS]
          .filter(p => Number(p.loa || 0) >= AUTO_FILL_MIN_BARGE_LOA);
      if (eligiblePresets.length === 0) {
          setToastMsg('Không có preset sà lan từ 4 bays trở lên để auto fill.');
          setTimeout(() => setToastMsg(''), 3000);
          return;
      }

      const runScenario = (presetsInOrder, scenarioLabel) => {
          const workingVessels = [...vessels];
          const autoAddedTier1 = [];
          let cursor = BARGE_EDGE_SAFETY_M;
          let autoIdx = 1;
          const minPresetLoa = Math.min(...presetsInOrder.map(p => p.loa));

          while (cursor <= (600 - BARGE_EDGE_SAFETY_M - minPresetLoa)) {
              let placed = false;
              for (const preset of presetsInOrder) {
                  const loa = Number(preset.loa || 0);
                  if (!loa || cursor + loa > (600 - BARGE_EDGE_SAFETY_M)) continue;
                  if (!canPlaceAutoBargeAt(cursor, loa, workingVessels)) continue;

                  const etaVal = getCurrentDateTimeLocal();
                  const newBarge = {
                      id: `barge-auto-${Date.now()}-${scenarioLabel}-${autoIdx}`,
                      type: 'barge',
                      tier: 1,
                      name: String(preset.bays).toUpperCase(),
                      voyage: "-",
                      loa,
                      eta: etaVal,
                      etd: getEtdFallback(etaVal),
                      berthName: "CMIT",
                      side: "SB",
                      direction: "THƯỢNG LƯU",
                      bowPos: cursor,
                      sternPos: cursor + loa,
                      cabinPos: cursor + loa - 5,
                      dis: 0,
                      load: 0,
                      hue: (workingVessels.length * 50 + 20) % 360,
                      color: getAvailableColor(workingVessels),
                      totalRemain: 0
                  };
                  workingVessels.push(newBarge);
                  autoAddedTier1.push(newBarge);
                  autoIdx += 1;
                  cursor = newBarge.sternPos + 5;
                  placed = true;
                  break;
              }
              if (!placed) cursor += 1;
          }

          // Step 2: auto fill alongside barges (tier 2) from existing tier1 barges.
          // Rule: one alongside barge per tier1 barge; LOA alongside must be <= host LOA.
          const tier1Hosts = workingVessels
              .filter(v => v?.type === 'barge' && (v.tier || 1) === 1 && v.bowPos >= 0 && v.sternPos <= 600)
              .sort((a, b) => a.bowPos - b.bowPos);
          const autoAddedTier2 = [];
          let alongIdx = 1;

          for (const host of tier1Hosts) {
              const hasAlongsideAlready = workingVessels.some(v =>
                  v?.type === 'barge' &&
                  (v.tier || 1) > 1 &&
                  Math.abs((v.bowPos || 0) - (host.bowPos || 0)) < 1 &&
                  Math.abs((v.sternPos || 0) - (host.sternPos || 0)) < 1
              );
              if (hasAlongsideAlready) continue;

              const candidatePreset = presetsInOrder.find(p => Number(p.loa || 0) <= Number(host.loa || 0));
              if (!candidatePreset) continue;

              const loa = Number(candidatePreset.loa || 0);
              const bowPos = Number(host.bowPos || 0);
              const sternPos = bowPos + loa;
              if (bowPos < 0 || sternPos > 600) continue;

              const tier2Collision = workingVessels.some(v =>
                  v?.type === 'barge' &&
                  (v.tier || 1) === 2 &&
                  !((sternPos <= (v.bowPos - 5)) || (bowPos >= (v.sternPos + 5)))
              );
              if (tier2Collision) continue;

              const etaVal = getCurrentDateTimeLocal();
              const alongsideBarge = {
                  id: `barge-auto-along-${Date.now()}-${scenarioLabel}-${alongIdx}`,
                  type: 'barge',
                  tier: 2,
                  name: String(candidatePreset.bays).toUpperCase(),
                  voyage: "-",
                  loa,
                  eta: etaVal,
                  etd: getEtdFallback(etaVal),
                  berthName: "CMIT",
                  side: "SB",
                  direction: "THƯỢNG LƯU",
                  bowPos,
                  sternPos,
                  cabinPos: sternPos - 5,
                  dis: 0,
                  load: 0,
                  hue: (workingVessels.length * 50 + 20) % 360,
                  color: getAvailableColor(workingVessels),
                  totalRemain: 0
              };
              workingVessels.push(alongsideBarge);
              autoAddedTier2.push(alongsideBarge);
              alongIdx += 1;
          }

          const autoAdded = [...autoAddedTier1, ...autoAddedTier2];
          const mixSummary = autoAdded.reduce((acc, b) => {
              acc[b.name] = (acc[b.name] || 0) + 1;
              return acc;
          }, {});

          return { scenarioLabel, workingVessels, autoAdded, autoAddedTier1, autoAddedTier2, mixSummary };
      };

      const fiveOnly = runScenario(
          eligiblePresets.filter(p => String(p.bays).toUpperCase().includes('5 BAYS')).sort((a, b) => b.loa - a.loa),
          '5B_ONLY'
      );
      const mixMaxCount = runScenario(
          [...eligiblePresets].sort((a, b) => a.loa - b.loa), // smallest first => maximize count
          'MIX_MAX'
      );
      const mix45And4First = runScenario(
          [...eligiblePresets].sort((a, b) => {
              const score = (p) => {
                  const bays = String(p.bays).toUpperCase();
                  if (bays.includes('4.5')) return 0;
                  if (bays.includes('4 BAYS')) return 1;
                  if (bays.includes('5 BAYS')) return 2;
                  return 3;
              };
              const sa = score(a), sb = score(b);
              if (sa !== sb) return sa - sb;
              return a.loa - b.loa;
          }),
          'MIX_45_4'
      );

      const scenarios = [fiveOnly, mixMaxCount, mix45And4First].filter(s => s.autoAdded.length > 0);
      if (scenarios.length === 0) {
          setToastMsg('Không còn khoảng trống phù hợp trong 600m để tự động fill sà lan.');
          setTimeout(() => setToastMsg(''), 3500);
          return;
      }

      const byCountDesc = [...scenarios].sort((a, b) => b.autoAdded.length - a.autoAdded.length);
      let chosen = byCountDesc[0];

      const shouldAskUser =
          scenarios.length > 1 &&
          (byCountDesc[0].autoAdded.length !== byCountDesc[scenarios.length - 1].autoAdded.length ||
           JSON.stringify(byCountDesc[0].mixSummary) !== JSON.stringify(byCountDesc[scenarios.length - 1].mixSummary));

      if (shouldAskUser) {
          const optionText = byCountDesc.map((s, idx) => {
              const mixText = Object.entries(s.mixSummary).map(([k, v]) => `${k}:${v}`).join(', ');
              const label = s.scenarioLabel === '5B_ONLY' ? 'Toàn bộ 5 bay'
                  : s.scenarioLabel === 'MIX_MAX' ? 'Mix tối đa số lượng'
                  : 'Mix ưu tiên 4.5 + 4 bay';
              return `${idx + 1}) ${label} - ${s.autoAdded.length} sà lan (${mixText})`;
          }).join('\n');

          const selectedValue = await openChoiceDialog({
              title: 'Chọn phương án auto fill',
              message: `Có nhiều phương án phù hợp:\n${optionText}`,
              choices: byCountDesc.map((s, idx) => {
                  const label = s.scenarioLabel === '5B_ONLY' ? 'Toàn bộ 5 bay'
                      : s.scenarioLabel === 'MIX_MAX' ? 'Mix tối đa số lượng'
                      : 'Mix ưu tiên 4.5 + 4 bay';
                  return {
                      value: String(idx),
                      label: `${label} - ${s.autoAdded.length} sà lan`
                  };
              }),
              defaultChoice: '0'
          });
          if (selectedValue === null) return;
          const selectedIndex = Number(selectedValue);
          if (Number.isFinite(selectedIndex) && selectedIndex >= 0 && selectedIndex < byCountDesc.length) {
              chosen = byCountDesc[selectedIndex];
          }
      }

      setVessels(chosen.workingVessels);
      setShowBargeMenu(false);
      setActiveVesselId(chosen.autoAdded[0].id);
      syncToCloud(chosen.workingVessels, qcTasks);
      setToastMsg(`Đã auto fill ${chosen.autoAdded.length} sà lan (${chosen.autoAddedTier1.length} sát cầu + ${chosen.autoAddedTier2.length} cập mạn).`);
      setTimeout(() => setToastMsg(''), 3500);
  };

  const removeVessel = async (idToRemove) => {
      const target = vessels.find(v => v.id === idToRemove);
      const targetName = target ? `${target.type === 'barge' ? 'Sà lan' : 'Tàu'} ${target.name || target.id}` : idToRemove;
      const ok = await openConfirmDialog({
          title: 'Xác nhận xóa khỏi mô phỏng',
          message: `Bạn có chắc muốn xóa khỏi biểu đồ mô phỏng:\n- ${targetName}\n\nHồ sơ tàu trong cơ sở dữ liệu sẽ được giữ nguyên.`
      });
      if (!ok) return;
      const newVessels = vessels.filter(v => v.id !== idToRemove);
      setVessels(newVessels); 
      if (activeVesselId === idToRemove) setActiveVesselId(null);
      syncToCloud(newVessels);
  }

  const removeSelectedVessels = async (idsToRemove) => {
      if (!idsToRemove?.length) return;
      const targetNames = vessels
          .filter(v => idsToRemove.includes(v.id))
          .map(v => `${v.type === 'barge' ? 'Sà lan' : 'Tàu'} ${v.name || v.id}`);
      const ok = await openConfirmDialog({
          title: 'Xác nhận xóa khỏi mô phỏng',
          message: `Bạn có chắc muốn xóa các vật thể sau khỏi biểu đồ mô phỏng?\n${targetNames.map(n => `- ${n}`).join('\n')}\n\nHồ sơ tàu trong cơ sở dữ liệu sẽ được giữ nguyên.`
      });
      if (!ok) return;
      const removeSet = new Set(idsToRemove);
      const newVessels = vessels.filter(v => !removeSet.has(v.id));
      setVessels(newVessels);
      if (activeVesselId && removeSet.has(activeVesselId)) setActiveVesselId(null);
      setSelectedVesselIds([]);
      setSelectedObjectType(null);
      syncToCloud(newVessels, qcTasks);
  };

  useEffect(() => {
    let syncTimeout;
    const handleKeyDown = async (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        if (e.key === 'Delete') {
            if (selectedMaintenanceZoneIds.length > 0) {
                const selectedZones = berthMaintenanceZones.filter(z => selectedMaintenanceZoneIds.includes(z.id));
                const zoneNames = selectedZones.map(z => `Vùng bảo trì ${Math.round(z.start)}m → ${Math.round(z.end)}m`);
                const ok = await openConfirmDialog({
                    title: 'Xác nhận xóa vùng bảo trì',
                    message: `Bạn có chắc muốn xóa các vật thể sau?\n${zoneNames.map(n => `- ${n}`).join('\n')}`
                });
                if (!ok) return;
                const selectedSet = new Set(selectedMaintenanceZoneIds);
                const nextZones = berthMaintenanceZones.filter(z => !selectedSet.has(z.id));
                berthMaintenanceZonesRef.current = nextZones;
                setBerthMaintenanceZones(nextZones);
                setSelectedMaintenanceZoneIds([]);
                syncToCloud(vessels, qcTasks);
                return;
            }
            if (selectedObjectType === 'qc') {
                const selectedQcIds = qcTasks.filter(q => q.selected).map(q => q.id);
                if (selectedQcIds.length === 0) return;
                const removableQcIds = selectedQcIds.filter(id => qcMaintenanceIdsRef.current.includes(id));
                if (removableQcIds.length === 0) return;
                const qcNames = qcTasks.filter(q => removableQcIds.includes(q.id)).map(q => q.name);
                const ok = await openConfirmDialog({
                    title: 'Xác nhận gỡ QC bảo trì',
                    message: `Bạn có chắc muốn xóa trạng thái bảo trì của các QC sau?\n${qcNames.map(n => `- ${n}`).join('\n')}`
                });
                if (!ok) return;
                const removeSet = new Set(removableQcIds);
                const nextMaintIds = qcMaintenanceIdsRef.current.filter(id => !removeSet.has(id));
                qcMaintenanceIdsRef.current = nextMaintIds;
                setQcMaintenanceIds(nextMaintIds);
                syncToCloud(vessels, qcTasks);
                return;
            }
            if ((selectedObjectType === 'vessel' || selectedObjectType === 'barge') && selectedVesselIds.length > 0) {
                await removeSelectedVessels(selectedVesselIds);
                return;
            }
            if (activeVesselId) {
                await removeVessel(activeVesselId);
                return;
            }
        }
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && activeVesselId && (activeTab === 'visual' || activeTab === 'schedule')) {
            e.preventDefault(); 
            const direction = e.key === 'ArrowLeft' ? 1 : -1; 
            setVessels(prev => {
                const v = prev.find(x => x.id === activeVesselId);
                if (!v) return prev;
                const step = e.shiftKey ? 5 : 1;
                const newBow = v.bowPos + (direction * step);
                const constrainedBow = Math.max(-250, Math.min(850 - (v.loa || 200), newBow));
                const newStern = constrainedBow + (v.loa || 200);

                let isColliding = false;
                const others = prev.filter(x => x.id !== activeVesselId && (x.tier || 1) === (v.tier || 1));
                const dummyVessel = { ...v, bowPos: constrainedBow, sternPos: newStern };
                
                for (const other of others) {
                    const clearance = getClearance(dummyVessel, other, mooringPercent);
                    if (!(newStern <= other.bowPos - clearance || constrainedBow >= other.sternPos + clearance)) {
                        isColliding = true; break;
                    }
                }
                if (isColliding) return prev; 
                const updated = prev.map(x => x.id === activeVesselId ? {
                    ...x,
                    bowPos: constrainedBow,
                    sternPos: newStern,
                    cabinPos: Math.round(constrainedBow + (x.cabinPos - x.bowPos)),
                    ...(Number.isFinite(x.funnelPos) ? { funnelPos: Math.round(constrainedBow + (x.funnelPos - x.bowPos)) } : {})
                } : x);
                clearTimeout(syncTimeout);
                syncTimeout = setTimeout(() => { syncToCloud(updated, qcTasks); }, 500);
                return updated;
            });
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); clearTimeout(syncTimeout); };
  }, [activeVesselId, vessels, activeTab, mooringPercent, qcTasks, selectedObjectType, selectedVesselIds, selectedMaintenanceZoneIds, berthMaintenanceZones]);

  const deleteFromHistory = async (id) => { if(db) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vesselHistory', id)); }

  const getVesselStyles = (vessel) => {
      if (vessel.color) return { color: vessel.color, rank: 0 };
      const idx = vessels.findIndex(v => v.id === vessel.id);
      return { color: PRESET_COLORS[Math.max(0, idx) % PRESET_COLORS.length], rank: 0 };
  }

  const toggleQcSelection = (id) => {
      const newQcs = qcTasks.map(q => q.id === id ? { ...q, selected: !q.selected } : q);
      const anySelected = newQcs.some(q => q.selected);
      setSelectedObjectType(anySelected ? 'qc' : null);
      if (anySelected) setSelectedVesselIds([]);
      setQcTasks(newQcs); syncToCloud(vessels, newQcs);
  };

  const setBoomState = (isDown, isSafe) => {
      const newQcs = qcTasks.map(q => q.selected ? { ...q, boomDown: isDown, isSafeMode: isSafe } : q);
      setQcTasks(newQcs); syncToCloud(vessels, newQcs);
  };

  const autoGatherCranesForVessel = (targetVesselId) => {
      const targetV = vessels.find(v => v.id === targetVesselId);
      if(!targetV) return;
      const targetCenter = targetV.bowPos + targetV.loa / 2;
      setQcTasks(prev => {
          const sortedQcs = [...prev].sort((a, b) => a.pos - b.pos);
          const selectedIndices = [];
          sortedQcs.forEach((qc, idx) => { if (qc.selected) selectedIndices.push(idx); });
          if (selectedIndices.length === 0) return prev;
          
          const spacing = 35; 
          const firstSelIdx = selectedIndices[0]; 
          const lastSelIdx = selectedIndices[selectedIndices.length - 1]; 
          const blockWidth = (lastSelIdx - firstSelIdx) * spacing;
          const startPos = targetCenter - blockWidth / 2;
          
          let newPositions = sortedQcs.map(q => q.pos);
          for (let i = firstSelIdx; i <= lastSelIdx; i++) newPositions[i] = startPos + (i - firstSelIdx) * spacing;
          for (let i = firstSelIdx - 1; i >= 0; i--) {
              if (newPositions[i] > newPositions[i + 1] - spacing) newPositions[i] = newPositions[i + 1] - spacing;
          }
          for (let i = lastSelIdx + 1; i < sortedQcs.length; i++) {
              if (newPositions[i] < newPositions[i - 1] + spacing) newPositions[i] = newPositions[i - 1] + spacing;
          }

          const N = sortedQcs.length;
          if (newPositions[0] < 15) { const diff = 15 - newPositions[0]; for (let i = 0; i < N; i++) newPositions[i] += diff; }
          if (newPositions[N - 1] > 585) { const diff = newPositions[N - 1] - 585; for (let i = 0; i < N; i++) newPositions[i] -= diff; }

          const newQcs = sortedQcs.map((qc, i) => {
              if (qc.selected) return { ...qc, pos: newPositions[i], boomDown: false, isSafeMode: true }; 
              return { ...qc, pos: newPositions[i] }; 
          });
          syncToCloud(vessels, newQcs);
          return newQcs;
      });
  };

  const handleSafeBoomClick = () => {
      if (activeVessel) autoGatherCranesForVessel(activeVessel.id);
      else setBoomState(false, true);
  };

  const rectsIntersect = (a, b) => {
      return !(
          a.right < b.left ||
          a.left > b.right ||
          a.bottom < b.top ||
          a.top > b.bottom
      );
  };

  const clampQcGroupDelta = (requestedDelta, selectedIds, baseQcs) => {
      const spacing = 35;
      let minDelta = -Infinity;
      let maxDelta = Infinity;

      const selectedSet = new Set(selectedIds);
      const selectedQcs = baseQcs.filter(q => selectedSet.has(q.id));
      const otherQcs = baseQcs.filter(q => !selectedSet.has(q.id));

      for (const qc of selectedQcs) {
          const minPos = Math.max(15, qc.rangeStart);
          const maxPos = Math.min(585, qc.rangeEnd);

          // qc.pos - delta must stay within [minPos, maxPos]
          minDelta = Math.max(minDelta, qc.pos - maxPos);
          maxDelta = Math.min(maxDelta, qc.pos - minPos);

          for (const other of otherQcs) {
              if (other.pos < qc.pos) {
                  // keep selected qc to the right of left neighbor by spacing
                  maxDelta = Math.min(maxDelta, qc.pos - (other.pos + spacing));
              } else if (other.pos > qc.pos) {
                  // keep selected qc to the left of right neighbor by spacing
                  minDelta = Math.max(minDelta, qc.pos - (other.pos - spacing));
              }
          }
      }

      if (minDelta > maxDelta) {
          // No valid movement window: keep group in place
          return 0;
      }
      return Math.max(minDelta, Math.min(maxDelta, requestedDelta));
  };

  const applyQcGroupSqueeze = (proposedQcs, selectedIds, requestedDelta) => {
      const spacing = 35;
      const selectedSet = new Set(selectedIds);
      const moveToLowerPos = requestedDelta > 0; // pos = basePos - delta

      const nonSelected = proposedQcs.filter(q => !selectedSet.has(q.id));
      const fixedPositions = nonSelected.map(q => q.pos);
      const fixedSorted = [...fixedPositions].sort((a, b) => a - b);

      const selected = proposedQcs
          .filter(q => selectedSet.has(q.id))
          .sort((a, b) => a.pos - b.pos);

      if (selected.length <= 1) return proposedQcs;

      const getNearestLeftFixed = (pos) => {
          let v = null;
          for (const p of fixedSorted) {
              if (p < pos) v = p;
              else break;
          }
          return v;
      };
      const getNearestRightFixed = (pos) => {
          for (const p of fixedSorted) {
              if (p > pos) return p;
          }
          return null;
      };

      const byId = new Map(proposedQcs.map(q => [q.id, q]));

      if (moveToLowerPos) {
          let prevPlaced = null;
          for (const qc of selected) {
              const leftFixed = getNearestLeftFixed(qc.pos);
              const rightFixed = getNearestRightFixed(qc.pos);
              const minPos = Math.max(15, qc.rangeStart, leftFixed !== null ? leftFixed + spacing : -Infinity, prevPlaced !== null ? prevPlaced + spacing : -Infinity);
              const maxPos = Math.min(585, qc.rangeEnd, rightFixed !== null ? rightFixed - spacing : Infinity);

              let nextPos = qc.pos;
              if (prevPlaced !== null) nextPos = Math.min(nextPos, prevPlaced + spacing);
              nextPos = Math.max(minPos, Math.min(maxPos, nextPos));

              byId.set(qc.id, { ...qc, pos: Math.round(nextPos) });
              prevPlaced = nextPos;
          }
      } else {
          let nextPlaced = null;
          for (let i = selected.length - 1; i >= 0; i--) {
              const qc = selected[i];
              const leftFixed = getNearestLeftFixed(qc.pos);
              const rightFixed = getNearestRightFixed(qc.pos);
              const minPos = Math.max(15, qc.rangeStart, leftFixed !== null ? leftFixed + spacing : -Infinity);
              const maxPos = Math.min(585, qc.rangeEnd, rightFixed !== null ? rightFixed - spacing : Infinity, nextPlaced !== null ? nextPlaced - spacing : Infinity);

              let nextPos = qc.pos;
              if (nextPlaced !== null) nextPos = Math.max(nextPos, nextPlaced - spacing);
              nextPos = Math.max(minPos, Math.min(maxPos, nextPos));

              byId.set(qc.id, { ...qc, pos: Math.round(nextPos) });
              nextPlaced = nextPos;
          }
      }

      return proposedQcs.map(q => byId.get(q.id) || q);
  };

  const ensureNoQcOverlapForSelected = (proposedQcs, selectedIds) => {
      const spacing = 35;
      const selectedSet = new Set(selectedIds);
      const sorted = [...proposedQcs]
          .map(q => ({ ...q, pos: Number(q.pos || 0), originalPos: Number(q.pos || 0) }))
          .sort((a, b) => a.pos - b.pos);

      // Forward pass: enforce lower bounds and spacing
      for (let i = 0; i < sorted.length; i++) {
          const qc = sorted[i];
          const ownMin = Math.max(15, qc.rangeStart);
          const prevPos = i > 0 ? sorted[i - 1].pos + spacing : -Infinity;
          const minPos = Math.max(ownMin, prevPos);
          if (selectedSet.has(qc.id)) {
              qc.pos = Math.max(minPos, qc.pos);
          }
      }

      // Backward pass: enforce upper bounds and spacing
      for (let i = sorted.length - 1; i >= 0; i--) {
          const qc = sorted[i];
          const ownMax = Math.min(585, qc.rangeEnd);
          const nextPos = i < sorted.length - 1 ? sorted[i + 1].pos - spacing : Infinity;
          const maxPos = Math.min(ownMax, nextPos);
          if (selectedSet.has(qc.id)) {
              qc.pos = Math.min(maxPos, qc.pos);
          }
      }

      // Final clamp for selected QCs (best effort near requested drag)
      for (let i = 0; i < sorted.length; i++) {
          const qc = sorted[i];
          if (!selectedSet.has(qc.id)) continue;
          const ownMin = Math.max(15, qc.rangeStart);
          const ownMax = Math.min(585, qc.rangeEnd);
          const leftBound = i > 0 ? sorted[i - 1].pos + spacing : -Infinity;
          const rightBound = i < sorted.length - 1 ? sorted[i + 1].pos - spacing : Infinity;
          const minPos = Math.max(ownMin, leftBound);
          const maxPos = Math.min(ownMax, rightBound);
          if (minPos <= maxPos) qc.pos = Math.max(minPos, Math.min(maxPos, qc.pos));
          else qc.pos = qc.originalPos; // fallback nhẹ, tránh "kẹt cứng" toàn cụm
      }

      const mapById = new Map(sorted.map(q => [q.id, q.pos]));
      return proposedQcs.map(q => ({ ...q, pos: Math.round(mapById.get(q.id) ?? q.pos) }));
  };

  const constrainQcByLockedOrder = (proposedQcs, selectedIds, qcOrderIds) => {
      const spacing = 35;
      if (!qcOrderIds || qcOrderIds.length === 0) return proposedQcs;

      const selectedSet = new Set(selectedIds);
      const byId = new Map(proposedQcs.map(q => [q.id, { ...q, pos: Number(q.pos || 0) }]));
      const ordered = qcOrderIds
          .map(id => byId.get(id))
          .filter(Boolean);

      if (ordered.length <= 1) return proposedQcs;

      // Locked order is defined by screen direction (left -> right).
      // In this map, left side is WM600 and right side is WM0, so:
      // left crane must keep HIGHER pos than right crane by at least spacing.
      // Rule: ordered[i - 1].pos >= ordered[i].pos + spacing

      // Forward pass (left -> right): enforce upper bound from left neighbor
      for (let i = 0; i < ordered.length; i++) {
          const qc = ordered[i];
          const prev = i > 0 ? ordered[i - 1] : null;
          const maxPos = Math.min(585, qc.rangeEnd, prev ? prev.pos - spacing : Infinity);

          if (selectedSet.has(qc.id)) {
              qc.pos = Math.min(qc.pos, maxPos);
          } else if (qc.pos > maxPos) {
              return null; // fixed crane already violated => reject frame
          }
      }

      // Backward pass (right -> left): enforce lower bound from right neighbor
      for (let i = ordered.length - 1; i >= 0; i--) {
          const qc = ordered[i];
          const next = i < ordered.length - 1 ? ordered[i + 1] : null;
          const minPos = Math.max(15, qc.rangeStart, next ? next.pos + spacing : -Infinity);

          if (selectedSet.has(qc.id)) {
              qc.pos = Math.max(qc.pos, minPos);
          } else if (qc.pos < minPos) {
              return null; // fixed crane already violated => reject frame
          }
      }

      // Final validation: strict non-overlap and no jump-over in locked screen order
      for (let i = 1; i < ordered.length; i++) {
          if (ordered[i - 1].pos < ordered[i].pos + spacing) return null;
      }

      const posMap = new Map(ordered.map(q => [q.id, Math.round(q.pos)]));
      return proposedQcs.map(q => ({ ...q, pos: posMap.has(q.id) ? posMap.get(q.id) : q.pos }));
  };

  const clearAllSelections = () => {
      setSelectedVesselIds([]);
      setSelectedObjectType(null);
      setQcTasks(prev => prev.map(q => (q.selected ? { ...q, selected: false } : q)));
  };

  const toggleSingleVesselSelection = (vesselId, forcedType = null) => {
      const targetVessel = vessels.find(v => v.id === vesselId);
      if (!targetVessel) return;
      const vesselType = forcedType || targetVessel.type;

      // Vessel/Barge selection is exclusive with QC selection
      setQcTasks(prev => prev.map(q => (q.selected ? { ...q, selected: false } : q)));

      if (selectedObjectType !== vesselType) {
          setSelectedObjectType(vesselType);
          setSelectedVesselIds([vesselId]);
          setActiveVesselId(vesselId);
          return;
      }

      setSelectedVesselIds(prev => {
          const exists = prev.includes(vesselId);
          const next = exists ? prev.filter(id => id !== vesselId) : [...prev, vesselId];
          if (next.length === 0) {
              setSelectedObjectType(null);
              setActiveVesselId(null);
          } else {
              setSelectedObjectType(vesselType);
              setActiveVesselId(vesselId);
          }
          return next;
      });
  };

  const handleMouseDown = (e, type, id) => {
    if ((activeTab !== 'visual' && activeTab !== 'schedule') || isPrintMode) return;
    
    if (type === 'map' || type === 'scheduleMap') {
        if (type === 'scheduleMap') {
            // Keep schedule board fixed in place (no pan drift).
            clearAllSelections();
            setActiveVesselId(null);
            return;
        }
        if (e.shiftKey) {
            e.preventDefault();
            setActiveVesselId(null);
            isDraggingRef.current = true;
            setIsDragging(true);
            setSelectionBox({
                startX: e.clientX,
                startY: e.clientY,
                currentX: e.clientX,
                currentY: e.clientY
            });
            dragStartRef.current = { type: 'selection', startX: e.clientX, startY: e.clientY, hasMoved: false };
            return;
        }

        clearAllSelections();
        setActiveVesselId(null); 
        isDraggingRef.current = true; setIsDragging(true);
        dragStartRef.current = { type, startX: e.clientX, startY: e.clientY, startPanX: panOffset.x, startPanY: panOffset.y, hasMoved: false };
        return;
    }

    e.preventDefault(); e.stopPropagation();
    isDraggingRef.current = true; setIsDragging(true);
    
    if (type === 'vessel') {
        const targetVessel = vessels.find(v => v.id === id);
        if(targetVessel) {
            if (e.shiftKey) {
                // Shift + drag from ship/barge: start box selection.
                // Shift + click (no drag area): toggle single vessel/barge on mouseup.
                setSelectionBox({
                    startX: e.clientX,
                    startY: e.clientY,
                    currentX: e.clientX,
                    currentY: e.clientY
                });
                dragStartRef.current = {
                    type: 'selection',
                    startX: e.clientX,
                    startY: e.clientY,
                    selectionAnchorId: id,
                    selectionAnchorType: targetVessel.type,
                    hasMoved: false
                };
                return;
            }

            setActiveVesselId(id); 
            const selectedSameType = selectedVesselIds.filter((selectedId) => {
                const selectedVessel = vessels.find(v => v.id === selectedId);
                return selectedVessel && selectedVessel.type === targetVessel.type;
            });
            const isGroupDrag = selectedSameType.length > 1 && selectedSameType.includes(id);
            dragStartRef.current = { 
                type: isGroupDrag ? 'vessel-group' : 'vessel',
                id: id,
                selectedIds: isGroupDrag ? selectedSameType : [id],
                objectType: targetVessel.type,
                lastMoveKey: null,
                bowPos: targetVessel.bowPos,
                startX: e.clientX,
                startY: e.clientY,
                cabinOffset: targetVessel.cabinPos - targetVessel.bowPos,
                funnelOffset: (() => {
                    if (Number.isFinite(targetVessel.funnelPos) && Number.isFinite(targetVessel.bowPos)) {
                        return targetVessel.funnelPos - targetVessel.bowPos;
                    }
                    const bf = Number(targetVessel.bowToFunnel) || 0;
                    if (bf <= 0) return null;
                    return targetVessel.side === 'PS' ? (targetVessel.loa || 200) - bf : bf;
                })(),
                originData: vessels,
                lastData: vessels,
                hasMoved: false
            };
        }
    } else if (type === 'qc') {
        const targetQc = qcTasks.find(q => q.id === id);
        if(targetQc) {
            const selectedQcIds = qcTasks.filter(q => q.selected).map(q => q.id);
            const isGroupDrag = selectedQcIds.length > 1 && selectedQcIds.includes(id);
            const presentQcIds = new Set(qcTasks.map(q => q.id));
            const qcOrderIds = QC_LOCKED_ORDER_IDS.filter(id => presentQcIds.has(id));
            dragStartRef.current = {
                type: isGroupDrag ? 'qc-group' : 'qc',
                id: id,
                selectedIds: isGroupDrag ? selectedQcIds : [id],
                qcOrderIds: qcOrderIds,
                lastMoveKey: null,
                pos: targetQc.pos,
                startX: e.clientX,
                startY: e.clientY,
                shiftKey: !!e.shiftKey,
                originQcData: qcTasks,
                lastQcData: qcTasks,
                hasMoved: false
            };
        }
    }
  };

  const handlePointerDown = (e, type, id) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerType === 'touch') e.preventDefault();
      handleMouseDown(e, type, id);
  };

  useEffect(() => {
    const processMouseMove = (clientX, clientY) => {
      if (!isDraggingRef.current || isPrintMode) return;
      const type = dragStartRef.current.type;
      const currentZoom = activeTab === 'schedule' ? 1 : zoomLevel;

      if (!dragStartRef.current.hasMoved) {
          if (Math.abs(clientX - dragStartRef.current.startX) > 3 || Math.abs(clientY - dragStartRef.current.startY) > 3) {
              dragStartRef.current.hasMoved = true;
              if (type === 'vessel' || type === 'barge') {
                  setUiState({ listExpanded: false, detailsExpanded: false, qcExpanded: false });
              }
          }
      }

      if (type === 'map') {
          const deltaX = clientX - dragStartRef.current.startX;
          const deltaY = clientY - dragStartRef.current.startY;
          setPanOffset({ x: dragStartRef.current.startPanX + deltaX, y: dragStartRef.current.startPanY + deltaY });
          return;
      }

      if (type === 'selection') {
          setSelectionBox(prev => (
              prev
                  ? { ...prev, currentX: clientX, currentY: clientY }
                  : prev
          ));
          return;
      }

      if (!innerMapRef.current) return;
      const rect = innerMapRef.current.getBoundingClientRect();
      const baseWidth = rect.width / currentZoom; 
      const pixelsPerMeter = baseWidth / totalVisLength; 
      const deltaX = (clientX - dragStartRef.current.startX) / currentZoom; 
      const deltaMeters = deltaX / pixelsPerMeter;
      const isPointerOutOfBerth = clientX < rect.left || clientX > rect.right;
      const moveKey = Math.round(deltaMeters);

      if (dragStartRef.current.lastMoveKey === moveKey) return;
      dragStartRef.current.lastMoveKey = moveKey;
      
      if ((type === 'vessel' || type === 'vessel-group') && dragStartRef.current.lastData) {
          const selectedIds = dragStartRef.current.selectedIds || [dragStartRef.current.id];
          const baseData = dragStartRef.current.originData || dragStartRef.current.lastData;
          const draggedVessel = dragStartRef.current.lastData.find(v => v.id === dragStartRef.current.id);
          if(!draggedVessel) return;
          
          setVessels(prev => {
            const newData = prev.map(v => {
                if (!selectedIds.includes(v.id)) return v;
                const baseVessel = baseData.find(x => x.id === v.id) || v;
                const loa = baseVessel.loa || 200;
                const newBow = Math.max(-250, Math.min(850 - loa, Math.round(baseVessel.bowPos - deltaMeters)));
                const cabinOffset = (baseVessel.cabinPos || 0) - (baseVessel.bowPos || 0);
                const fo = dragStartRef.current.funnelOffset;
                return {
                    ...v,
                    bowPos: newBow,
                    sternPos: newBow + loa,
                    cabinPos: Math.round(newBow + cabinOffset),
                    ...(fo != null && Number.isFinite(fo) ? { funnelPos: Math.round(newBow + fo) } : {})
                };
            });
            dragStartRef.current.lastData = newData; 
            return newData;
          });
      } else if ((type === 'qc' || type === 'qc-group') && dragStartRef.current.lastQcData) {
          const selectedIds = dragStartRef.current.selectedIds || [dragStartRef.current.id];
          const baseQcs = dragStartRef.current.originQcData || dragStartRef.current.lastQcData;
          const qcToMove = dragStartRef.current.lastQcData.find(q => q.id === dragStartRef.current.id);
          if(!qcToMove) return;
          const isGroup = type === 'qc-group';
          const effectiveDelta = isGroup ? clampQcGroupDelta(deltaMeters, selectedIds, baseQcs) : deltaMeters;
          
          setQcTasks(prev => {
             let newData = prev.map(q => {
                 if (!selectedIds.includes(q.id)) return q;
                 const baseQc = baseQcs.find(x => x.id === q.id) || q;
                 const rawPos = Math.round(baseQc.pos - effectiveDelta);
                 const minLimit = Math.max(15, baseQc.rangeStart);
                 const maxLimit = Math.min(585, baseQc.rangeEnd);
                 return { ...q, pos: Math.max(minLimit, Math.min(maxLimit, rawPos)) };
             });

             // Only when cursor is pulled out of berth, selected QCs gain "squeeze" tendency.
             if (isGroup && isPointerOutOfBerth) {
                 newData = applyQcGroupSqueeze(newData, selectedIds, effectiveDelta);
             }

             const nonOverlapData = ensureNoQcOverlapForSelected(newData, selectedIds);
             const safeData = constrainQcByLockedOrder(nonOverlapData, selectedIds, dragStartRef.current.qcOrderIds);
             if (!safeData) return prev;

             dragStartRef.current.lastQcData = safeData;
             return safeData;
          });
      }
    };

    const handleMouseMove = (e) => {
      latestPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
      if (moveRafRef.current) return;
      moveRafRef.current = requestAnimationFrame(() => {
          moveRafRef.current = null;
          const { clientX, clientY } = latestPointerRef.current;
          processMouseMove(clientX, clientY);
      });
    };

    const handleTouchMove = (e) => {
      if (!isDraggingRef.current) return;
      const touch = e.touches?.[0] || e.changedTouches?.[0];
      if (!touch) return;
      if (e.cancelable) e.preventDefault();
      handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    };

    const handleMouseUp = (e) => {
      if (isDraggingRef.current) {
        if (moveRafRef.current) {
            cancelAnimationFrame(moveRafRef.current);
            moveRafRef.current = null;
        }
        if (dragStartRef.current.type === 'selection') {
            const selectionRect = {
                left: Math.min(dragStartRef.current.startX, e.clientX),
                right: Math.max(dragStartRef.current.startX, e.clientX),
                top: Math.min(dragStartRef.current.startY, e.clientY),
                bottom: Math.max(dragStartRef.current.startY, e.clientY)
            };

            const hasSelectionArea =
                Math.abs(selectionRect.right - selectionRect.left) > 3 &&
                Math.abs(selectionRect.bottom - selectionRect.top) > 3;

            if (hasSelectionArea && innerMapRef.current) {
                const hits = Array.from(
                    innerMapRef.current.querySelectorAll('[data-selectable-object="true"]')
                )
                    .filter((el) => rectsIntersect(selectionRect, el.getBoundingClientRect()))
                    .map((el) => ({
                        id: el.getAttribute('data-object-id'),
                        type: el.getAttribute('data-object-type')
                    }))
                    .filter((item) => item.id && item.type);

                const typeCounts = hits.reduce((acc, item) => {
                    acc[item.type] = (acc[item.type] || 0) + 1;
                    return acc;
                }, {});
                const dominantType = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a])[0] || null;

                if (dominantType === 'qc') {
                    const selectedQcIds = hits.filter(item => item.type === 'qc').map(item => item.id);
                    setSelectedObjectType('qc');
                    setSelectedVesselIds([]);
                    setActiveVesselId(null);
                    setQcTasks(prev => prev.map(q => ({ ...q, selected: selectedQcIds.includes(q.id) })));
                } else if (dominantType === 'vessel' || dominantType === 'barge') {
                    const selectedIds = hits.filter(item => item.type === dominantType).map(item => item.id);
                    setSelectedObjectType(dominantType);
                    setSelectedVesselIds(selectedIds);
                    setActiveVesselId(selectedIds[0] || null);
                    setQcTasks(prev => prev.map(q => (q.selected ? { ...q, selected: false } : q)));
                } else {
                    clearAllSelections();
                    setActiveVesselId(null);
                }
            } else {
                const anchorId = dragStartRef.current.selectionAnchorId;
                const anchorType = dragStartRef.current.selectionAnchorType;
                if (anchorId && (anchorType === 'vessel' || anchorType === 'barge')) {
                    toggleSingleVesselSelection(anchorId, anchorType);
                } else {
                    clearAllSelections();
                }
            }

            setSelectionBox(null);
            isDraggingRef.current = false;
            setIsDragging(false);
            dragStartRef.current = { id: null, type: null, bowPos: 0, pos: 0, startX: 0, startY: 0, cabinOffset: 0, originData: null, lastData: null, originQcData: null, lastQcData: null, startPanX: 0, startPanY: 0, hasMoved: false };
            return;
        }

        isDraggingRef.current = false; setIsDragging(false);

        if ((dragStartRef.current.type === 'qc' || dragStartRef.current.type === 'qc-group') && !dragStartRef.current.hasMoved) {
            const clickedQcId = dragStartRef.current.id;
            const shouldToggle = !!dragStartRef.current.shiftKey;
            setActiveVesselId(null);
            setSelectedVesselIds([]);
            setSelectedMaintenanceZoneIds([]);
            setQcTasks(prev => {
                const updated = prev.map(q => {
                    if (shouldToggle) {
                        return q.id === clickedQcId ? { ...q, selected: !q.selected } : q;
                    }
                    return q.id === clickedQcId ? { ...q, selected: true } : (q.selected ? { ...q, selected: false } : q);
                });
                const anySelected = updated.some(q => q.selected);
                setSelectedObjectType(anySelected ? 'qc' : null);
                syncToCloud(vessels, updated);
                return updated;
            });
            dragStartRef.current = { id: null, type: null, bowPos: 0, pos: 0, startX: 0, startY: 0, cabinOffset: 0, originData: null, lastData: null, originQcData: null, lastQcData: null, startPanX: 0, startPanY: 0, hasMoved: false };
            return;
        }
        
        if ((dragStartRef.current.type === 'vessel' || dragStartRef.current.type === 'vessel-group') && dragStartRef.current.lastData) {
            if (dragStartRef.current.type === 'vessel-group') {
                syncToCloud(dragStartRef.current.lastData, qcTasks);
                return;
            }
            if (!dragStartRef.current.hasMoved && isAutoExpand) {
                // setUiState(prev => ({ ...prev, detailsExpanded: true }));
            }
            const originalBow = dragStartRef.current.bowPos;
            const originalTier = dragStartRef.current.lastData.find(v => v.id === dragStartRef.current.id)?.tier || 1;
            const draggedVessel = dragStartRef.current.lastData.find(v => v.id === dragStartRef.current.id);
            
            if(draggedVessel) {
                const loa = draggedVessel.loa || 200;
                const cabinOffset = dragStartRef.current.cabinOffset;
                const funnelOff = dragStartRef.current.funnelOffset;
                let finalTier = draggedVessel.tier || 1;
                let finalBow = draggedVessel.bowPos;

                const checkCollision = (tierToCheck, bowPosToCheck) => {
                    const sternPosToCheck = bowPosToCheck + loa;
                    const dummyVessel = { ...draggedVessel, bowPos: bowPosToCheck, sternPos: sternPosToCheck, tier: tierToCheck };
                    const others = dragStartRef.current.lastData.filter(v => v.id !== draggedVessel.id && (v.tier || 1) === tierToCheck);
                    
                    for (const other of others) {
                        const isOverlapping = (bowPosToCheck < other.sternPos) && (sternPosToCheck > other.bowPos);
                        const clearance = getClearance(dummyVessel, other, mooringPercent);
                        const hasClearanceViolation = !(sternPosToCheck <= other.bowPos - clearance || bowPosToCheck >= other.sternPos + clearance);

                        if (isOverlapping) return { collision: true, type: 'overlap', target: other };
                        else if (hasClearanceViolation) return { collision: true, type: 'clearance', target: other };
                    }
                    return { collision: false };
                };

                // Nếu đang ở tab Mô Phỏng và di chuyển tàu
                if (activeTab === 'visual') {
                    if (draggedVessel.type === 'barge') {
                        // Logic cho Sà Lan (bỏ giới hạn Tier)
                        let tryTier = 1;
                        let maxTiers = 5; // Có thể mở rộng lên N lớp
                        let collisionFound = true;
                        
                        while(collisionFound && tryTier <= maxTiers) {
                            const check = checkCollision(tryTier, finalBow);
                            if (!check.collision) {
                                finalTier = tryTier;
                                collisionFound = false;
                            } else {
                                tryTier++;
                            }
                        }
                        // Nếu vẫn va chạm, lùi về gốc
                        if (collisionFound) {
                            finalBow = originalBow;
                            finalTier = originalTier;
                        }
                    } else {
                        // Logic cho Tàu lớn
                        const currentCheck = checkCollision(finalTier, finalBow);
                        if (currentCheck.collision) {
                            finalBow = originalBow;
                        }
                    }
                }

                setVessels(prev => {
                    const updated = prev.map(v => v.id === dragStartRef.current.id ? { 
                        ...v,
                        bowPos: finalBow,
                        sternPos: finalBow + loa,
                        cabinPos: Math.round(finalBow + cabinOffset),
                        ...(funnelOff != null && Number.isFinite(funnelOff) ? { funnelPos: Math.round(finalBow + funnelOff) } : {}),
                        tier: finalTier
                    } : v);
                    dragStartRef.current.lastData = updated;
                    syncToCloud(updated, qcTasks);
                    return updated;
                });
            }
        }
        if ((dragStartRef.current.type === 'qc' || dragStartRef.current.type === 'qc-group') && dragStartRef.current.lastQcData) syncToCloud(vessels, dragStartRef.current.lastQcData);
      }
    };

    const handleTouchEnd = (e) => {
      if (!isDraggingRef.current) return;
      const touch = e.changedTouches?.[0] || latestPointerRef.current;
      if (!touch) return;
      handleMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
    };

    if (isDragging && !isPrintMode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd, { passive: false });
      window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      if (moveRafRef.current) {
          cancelAnimationFrame(moveRafRef.current);
          moveRafRef.current = null;
      }
    };
  }, [isDragging, zoomLevel, panOffset, isPrintMode, isAutoExpand, activeTab]);

  const handleNudgeStart = (e, id, direction) => {
      e.preventDefault(); e.stopPropagation();
      const doNudge = () => {
          setVessels(prev => {
              const v = prev.find(x => x.id === id);
              if(!v) return prev;
              const newBow = v.bowPos + direction;
              const constrainedBow = Math.max(-250, Math.min(850 - (v.loa || 200), newBow));
              const newStern = constrainedBow + (v.loa || 200);

              let isColliding = false;
              const others = prev.filter(x => x.id !== id && (x.tier || 1) === (v.tier || 1));
              const dummyVessel = { ...v, bowPos: constrainedBow, sternPos: newStern };
              
              for (const other of others) {
                  const clearance = getClearance(dummyVessel, other, mooringPercent);
                  if (!(newStern <= other.bowPos - clearance || constrainedBow >= other.sternPos + clearance)) {
                      isColliding = true; break;
                  }
              }
              if (isColliding) return prev; 
              const updated = prev.map(x => x.id === id ? {
                  ...x,
                  bowPos: constrainedBow,
                  sternPos: newStern,
                  cabinPos: Math.round(constrainedBow + (x.cabinPos - x.bowPos)),
                  ...(Number.isFinite(x.funnelPos) ? { funnelPos: Math.round(constrainedBow + (x.funnelPos - x.bowPos)) } : {})
              } : x);
              dragStartRef.current.lastData = updated;
              return updated;
          });
      };
      doNudge(); nudgeIntervalRef.current = setInterval(doNudge, 80); 
  };

  const handleNudgeStop = (e) => {
      if(e) { e.preventDefault(); e.stopPropagation(); }
      if (nudgeIntervalRef.current) {
          clearInterval(nudgeIntervalRef.current);
          nudgeIntervalRef.current = null;
          if (dragStartRef.current.lastData) syncToCloud(dragStartRef.current.lastData, qcTasks);
      }
  };

  useEffect(() => { return () => { if (nudgeIntervalRef.current) clearInterval(nudgeIntervalRef.current); }; }, []);

  useEffect(() => {
      const handleKeyDown = (e) => {
          if (e.key === 'Escape') setIsSetupMode(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
      const handleMouseMove = (e) => {
          if (!maintenanceDragRef.current || !innerMapRef.current) return;
          const drag = maintenanceDragRef.current;
          drag.moved = true;
          const rect = innerMapRef.current.getBoundingClientRect();
          const baseWidth = rect.width / zoomLevel;
          const pixelsPerMeter = baseWidth / totalVisLength;
          const deltaX = (e.clientX - drag.startX) / zoomLevel;
          const deltaMeters = deltaX / pixelsPerMeter;

          setBerthMaintenanceZones(prev => {
              const nextZones = prev.map((z, idx) => {
                  if (idx !== drag.index) return z;
                  const minWidth = 5;
                  if (drag.mode === 'move') {
                      const width = drag.startEnd - drag.startStart;
                      let nextStart = drag.startStart - deltaMeters;
                      nextStart = Math.max(0, Math.min(600 - width, nextStart));
                      return { ...z, start: Math.round(nextStart), end: Math.round(nextStart + width) };
                  }
                  if (drag.mode === 'resize-left') {
                      let nextStart = drag.startStart - deltaMeters;
                      nextStart = Math.max(0, Math.min(drag.startEnd - minWidth, nextStart));
                      return { ...z, start: Math.round(nextStart), end: Math.round(drag.startEnd) };
                  }
                  let nextEnd = drag.startEnd - deltaMeters;
                  nextEnd = Math.max(drag.startStart + minWidth, Math.min(600, nextEnd));
                  return { ...z, start: Math.round(drag.startStart), end: Math.round(nextEnd) };
              });
              berthMaintenanceZonesRef.current = nextZones;
              return nextZones;
          });
      };

      const handleMouseUp = () => {
          if (!maintenanceDragRef.current) return;
          const drag = maintenanceDragRef.current;
          maintenanceDragRef.current = null;
          if (!drag.moved) return;
          syncToCloud(vessels, qcTasks);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [zoomLevel, vessels, qcTasks]);

  const selectedQcCount = qcTasks.filter(q => q.selected).length;
  const safeMasterVessels = Array.isArray(masterVessels) ? masterVessels : [];
  const filteredVessels = safeMasterVessels.filter(v => String(v.name || '').toUpperCase().includes(String(searchQuery || '').toUpperCase()));

  // -------------------------------------------------------------
  // RENDER: VISUAL MAP (MÔ PHỎNG BẾN 2D)
  // -------------------------------------------------------------
  const renderVesselMap = () => {
    return (
      <div id="vessel-map-export" className={`relative flex flex-col select-none overflow-hidden ${isPrintMode ? 'bg-white rounded-none border-none shadow-none w-[1200px] h-[700px] flex-shrink-0' : 'w-full h-full bg-slate-100 rounded-[32px] border border-slate-200 shadow-inner'}`}>
        {isPrintMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] text-center w-full bg-white pb-2 border-b-2 border-black">
                <h1 className="text-xl font-black uppercase text-black tracking-widest">Sơ đồ Kế hoạch Bến CMIT</h1>
                <p className="text-[10px] font-bold text-black mt-1">Ngày In: {new Date().toLocaleString('vi-VN')}</p>
            </div>
        )}

        {isSetupMode && !isPrintMode && (
            <div className="absolute top-20 right-4 z-[110] bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-red-500 shadow-[0_20px_50px_rgba(220,38,38,0.3)] p-5 w-[340px] max-h-[80vh] overflow-y-auto custom-scrollbar pointer-events-auto">
                <div className="sticky top-0 bg-white/90 pb-3 mb-3 border-b border-red-100 z-10">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-red-600 flex items-center gap-2 uppercase tracking-widest"><Settings2 size={16} /> SETUP CẦU BẾN (ADMIN)</h3>
                        <button onClick={() => setIsSetupMode(false)} className="w-7 h-7 rounded-lg bg-red-50 text-red-600 font-black hover:bg-red-100 transition-colors">×</button>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold mt-1 leading-relaxed">Đường kẻ màu tượng trưng cho giới hạn di chuyển của các Cẩu QC.</p>
                </div>
                <form
                    autoComplete="off"
                    data-form-type="other"
                    data-lpignore="true"
                    onSubmit={(e) => e.preventDefault()}
                    className="flex flex-col gap-4"
                >
                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-rose-700 uppercase tracking-widest">Vùng bảo trì cầu cảng</span>
                            <span className="text-[9px] font-black text-rose-600">Nền đỏ</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <input
                                type="number"
                                min="0"
                                max="600"
                                value={maintenanceDraft.start}
                                onChange={(e) => setMaintenanceDraft(prev => ({ ...prev, start: Number(e.target.value || 0) }))}
                                autoComplete="off"
                                name="setup-maint-start"
                                data-form-type="other"
                                data-lpignore="true"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                className="px-2 py-1.5 rounded-lg border border-rose-200 text-[10px] font-bold outline-none focus:ring-2 focus:ring-rose-300"
                                placeholder="Start (m)"
                            />
                            <input
                                type="number"
                                min="0"
                                max="600"
                                value={maintenanceDraft.end}
                                onChange={(e) => setMaintenanceDraft(prev => ({ ...prev, end: Number(e.target.value || 0) }))}
                                autoComplete="off"
                                name="setup-maint-end"
                                data-form-type="other"
                                data-lpignore="true"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                className="px-2 py-1.5 rounded-lg border border-rose-200 text-[10px] font-bold outline-none focus:ring-2 focus:ring-rose-300"
                                placeholder="End (m)"
                            />
                        </div>
                        <button onClick={addBerthMaintenanceZone} className="w-full py-2 rounded-lg bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-colors">+ Thêm vùng bảo trì</button>
                        {berthMaintenanceZones.length > 0 && (
                            <div className="mt-2 flex flex-col gap-1">
                                {berthMaintenanceZones.map((z, idx) => (
                                    <div key={`maint-zone-${idx}`} className="flex items-center justify-between bg-white rounded-lg border border-rose-200 px-2 py-1.5">
                                        <span className="text-[10px] font-black text-rose-700">{Math.round(z.start)}m → {Math.round(z.end)}m</span>
                                        <span className="text-[9px] font-black text-slate-500 uppercase">Chọn vùng + Delete</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Khóa QC Range</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded ${isQcRangeUnlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {isQcRangeUnlocked ? 'ĐÃ MỞ KHÓA' : 'ĐANG KHÓA'}
                            </span>
                        </div>
                        {!isQcRangeUnlocked ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={qcRangePin}
                                    onChange={(e) => setQcRangePin(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') unlockQcRangeEditing(); }}
                                    placeholder="Xác nhận 1506"
                                    autoComplete="off"
                                    name="setup-qc-auth"
                                    data-form-type="other"
                                    data-lpignore="true"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-300"
                                />
                                <button onClick={unlockQcRangeEditing} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors">Mở</button>
                            </div>
                        ) : (
                            <button onClick={() => setIsQcRangeUnlocked(false)} className="w-full py-1.5 rounded-lg bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">Khóa lại</button>
                        )}
                    </div>
                    {qcTasks.map((qc, index) => (
                        <div key={`setup-qc-${qc.id}`} className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full" style={{backgroundColor: qc.color}}></div>
                            <div className="flex justify-between items-center mb-4 pl-2">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{qc.name}</span>
                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded shadow-inner">{qc.rangeStart}m ↔ {qc.rangeEnd}m</span>
                            </div>
                            <div className="flex flex-col gap-3 pl-2">
                                <label className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">
                                    <span className="text-[9px] font-black text-rose-700 uppercase tracking-widest">QC bảo trì</span>
                                    <input
                                        type="checkbox"
                                        checked={qcMaintenanceIds.includes(qc.id)}
                                        onChange={() => toggleQcMaintenance(qc.id)}
                                        className="w-4 h-4 accent-rose-600"
                                    />
                                </label>
                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-black w-8 text-slate-400">MIN:</span>
                                    <input type="range" min="15" max={qc.rangeEnd - 10} value={qc.rangeStart}
                                        disabled={!isQcRangeUnlocked}
                                        onChange={(e) => {
                                            if (!isQcRangeUnlocked) return;
                                            const val = parseInt(e.target.value);
                                            const newQcs = [...qcTasks];
                                            newQcs[index].rangeStart = val;
                                            if (newQcs[index].pos < val) newQcs[index].pos = val;
                                            setQcTasks(newQcs);
                                        }}
                                        className={`flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none ${isQcRangeUnlocked ? 'accent-blue-500 cursor-pointer' : 'accent-slate-300 cursor-not-allowed opacity-60'}`} />
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-black w-8 text-slate-400">MAX:</span>
                                    <input type="range" min={qc.rangeStart + 10} max="585" value={qc.rangeEnd}
                                        disabled={!isQcRangeUnlocked}
                                        onChange={(e) => {
                                            if (!isQcRangeUnlocked) return;
                                            const val = parseInt(e.target.value);
                                            const newQcs = [...qcTasks];
                                            newQcs[index].rangeEnd = val;
                                            if (newQcs[index].pos > val) newQcs[index].pos = val;
                                            setQcTasks(newQcs);
                                        }}
                                        className={`flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none ${isQcRangeUnlocked ? 'accent-blue-500 cursor-pointer' : 'accent-slate-300 cursor-not-allowed opacity-60'}`} />
                                </div>
                            </div>
                        </div>
                    ))}
                </form>
                <div className="flex gap-2 mt-5">
                    <button onClick={() => setIsSetupMode(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-colors shadow-sm">HỦY / ĐÓNG</button>
                    <button onClick={saveSetupConfig} className="flex-1 py-3 bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-colors shadow-lg flex items-center justify-center gap-2"><Save size={14}/> LƯU CÀI ĐẶT</button>
                </div>
            </div>
        )}

        {!isPrintMode && (
            <div className="absolute top-4 left-4 z-50 flex gap-4 pointer-events-none w-[calc(100%-2rem)] justify-between items-start">
                 <div className="flex gap-4 items-start">
                     
                     {/* BẢNG 1: ĐỘI TÀU */}
                     <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-white/50 shadow-2xl pointer-events-auto flex flex-col shadow-blue-900/10 transition-all duration-300 relative z-50">
                        <div className={`flex justify-between items-center p-3 cursor-pointer bg-slate-50/50 hover:bg-slate-100/50 group ${uiState.listExpanded ? 'rounded-t-2xl' : 'rounded-2xl'}`} onClick={() => toggleUi('listExpanded')}>
                            <h3 className="text-[10px] font-black tracking-[0.2em] text-slate-600 flex items-center gap-2">
                                <Ship size={14}/> Đội Phương Tiện ({vessels.length})
                            </h3>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center group-hover:bg-slate-200 transition-colors ml-4 text-slate-400">
                                {uiState.listExpanded ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}
                            </div>
                        </div>
                        {uiState.listExpanded && (
                            <div className="p-2 border-t border-slate-100 flex flex-col gap-2 w-[250px]">
                                <div className="max-h-[200px] overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1">
                                    {vessels.map((v, idx) => {
                                        const { color } = getVesselStyles(v);
                                        const isActive = activeVesselId === v.id;
                                        return (
                                            <div key={`sidebar-vessel-${v.id || idx}`} className="flex gap-1 group">
                                                <button onClick={() => setActiveVesselId(v.id)} className={`flex-1 text-left px-2 py-2 rounded-xl transition-all border flex items-center justify-between ${isActive ? 'bg-[#002D54] text-white border-transparent shadow-lg' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50'}`}>
                                                    <div className="flex items-center gap-2 overflow-hidden w-full">
                                                        <div className="relative w-4 h-4 flex-shrink-0 cursor-pointer hover:scale-125 transition-transform" title="Bấm để đổi màu tàu">
                                                            <div className={`absolute inset-0 shadow-inner ${v.type==='barge' ? 'rounded-sm' : 'rounded-full'}`} style={{ backgroundColor: color, pointerEvents: 'none' }}></div>
                                                            <input type="color" value={color} onChange={(e) => { const newVessels = vessels.map(ves => ves.id === v.id ? { ...ves, color: e.target.value } : ves); setVessels(newVessels); syncToCloud(newVessels); }} onClick={(e) => e.stopPropagation()} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                                        </div>
                                                        <span className="text-xs font-black truncate uppercase">{String(v.name || 'UNKNOWN')}</span>
                                                    </div>
                                                </button>
                                                {vessels.length > 1 && isActive && (
                                                    <button onClick={() => removeVessel(v.id)} className="px-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-50 hover:text-white transition-colors"><Trash2 size={14} /></button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="mt-1 grid grid-cols-3 gap-1 relative">
                                    <button onClick={addNewVessel} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-1"><Ship size={12} /> + TÀU</button>
                                    <button onClick={() => setShowBargeMenu(!showBargeMenu)} className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-700 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-1"><Layers size={12} /> + SÀ LAN</button>
                                    <button onClick={autoFillBargesInBerth} className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-1"><Zap size={12} /> Auto Fill</button>
                                    {showBargeMenu && (
                                        <div className="absolute top-full right-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                                            {BARGE_PRESETS.map((preset, idx) => (
                                                <button key={`barge-preset-${idx}`} onClick={() => addBarge(preset)} className="w-full text-left px-4 py-2 hover:bg-amber-50 text-[10px] font-black text-slate-700 flex justify-between border-b last:border-0">
                                                    <span className="uppercase">{String(preset.bays)}</span><span className="text-amber-600">{Number(preset.loa)}m</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                     </div>

                     {/* BẢNG 2: CHI TIẾT TÀU */}
                     {activeVessel && (
                         <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-white/50 shadow-2xl pointer-events-auto shadow-blue-900/10 flex flex-col transition-all duration-300 overflow-hidden uppercase">
                            <div className="flex items-center justify-between p-4 cursor-pointer bg-slate-50/50 hover:bg-slate-100/50 group" onClick={() => toggleUi('detailsExpanded')}>
                                 <div className="flex items-center gap-2">
                                     <div className={`w-3 h-3 shadow-inner animate-pulse ${activeVessel.type === 'barge' ? 'rounded-sm' : 'rounded-full'}`} style={{ backgroundColor: getVesselStyles(activeVessel).color }}></div>
                                     <h3 className="text-[10px] font-black tracking-[0.2em] text-slate-600 uppercase">{activeVessel.name || (activeVessel.type === 'barge' ? 'SÀ LAN' : 'TÀU')}</h3>
                                 </div>
                                 <div className="w-6 h-6 rounded-md flex items-center justify-center group-hover:bg-slate-200 transition-colors ml-6 text-slate-400">
                                    {uiState.detailsExpanded ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}
                                 </div>
                            </div>
                            {uiState.detailsExpanded && (
                                <div className="p-4 pt-2 w-64 space-y-3 border-t border-slate-100">
                                    <SmallInputField label="Mũi (Bow m)" type="number" value={activeVessel.bowPos} onChange={(v) => {
                                        const parsed = v === '' ? '' : Math.round(v);
                                        if (parsed === '') { updateActiveVessel({ bowPos: '', sternPos: '' }); } 
                                        else {
                                            const cabinOffset = (activeVessel.cabinPos || 0) - (activeVessel.bowPos || 0);
                                            updateActiveVessel({ bowPos: parsed, sternPos: parsed + (activeVessel.loa || 0), cabinPos: parsed + cabinOffset });
                                        }
                                    }} />
                                    <SmallInputField label="Lái (Stern m)" type="number" value={activeVessel.sternPos} onChange={(v) => {
                                        const parsed = v === '' ? '' : Math.round(v);
                                        if (parsed === '') { updateActiveVessel({ bowPos: '', sternPos: '' }); } 
                                        else {
                                            const newBow = parsed - (activeVessel.loa || 0);
                                            const cabinOffset = (activeVessel.cabinPos || 0) - (activeVessel.bowPos || 0);
                                            updateActiveVessel({ sternPos: parsed, bowPos: newBow, cabinPos: newBow + cabinOffset });
                                        }
                                    }} />
                                    
                                    {activeVessel.type === 'barge' && (
                                        <div className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200 justify-between">
                                            <span className="text-[9px] font-black text-slate-400 tracking-widest ml-1">LỚP CẬP (TIER):</span>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => updateActiveVessel({ tier: Math.max(1, (activeVessel.tier || 1) - 1) })} className="w-6 h-6 bg-slate-200 text-slate-600 rounded flex items-center justify-center hover:bg-slate-300"><Minus size={12}/></button>
                                                <div className="w-8 text-center text-xs font-black text-[#002D54]">{activeVessel.tier || 1}</div>
                                                <button onClick={() => updateActiveVessel({ tier: (activeVessel.tier || 1) + 1 })} className="w-6 h-6 bg-slate-200 text-slate-600 rounded flex items-center justify-center hover:bg-slate-300"><Plus size={12}/></button>
                                            </div>
                                        </div>
                                    )}

                                    {activeVessel.type === 'barge' && (
                                        <div className="flex gap-2 items-center bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                                            <span className="text-[9px] font-black text-amber-600 tracking-widest ml-1 whitespace-nowrap">TOTAL REMAIN:</span>
                                            <input type="number" min="0" value={activeVessel.totalRemain || 0} onChange={(e) => {
                                                const v = e.target.value === '' ? 0 : Number(e.target.value);
                                                updateActiveVessel({ totalRemain: v });
                                            }} className="flex-1 text-center font-black outline-none text-[11px] bg-white border border-amber-300 rounded shadow-sm text-amber-800 py-0.5" />
                                            <span className="text-[9px] font-black text-amber-600">CONT</span>
                                        </div>
                                    )}

                                    {activeVessel.type === 'vessel' && (
                                        <div className="flex gap-2 items-center bg-blue-50 p-1.5 rounded-lg border border-blue-200">
                                            <span className="text-[9px] font-black text-blue-600 tracking-widest ml-1 uppercase whitespace-nowrap">NEO MŨI/LÁI:</span>
                                            <input type="number" value={mooringPercent} onChange={(e) => { const v = e.target.value === '' ? 0 : Number(e.target.value); setMooringPercent(v); syncToCloud(null, null, v); }} className="w-10 text-center font-black outline-none text-[10px] bg-white border border-blue-300 rounded shadow-sm text-blue-800" />
                                            <span className="text-[9px] font-black text-blue-600">% =</span>
                                            <span className="flex-1 text-center font-black text-[11px] text-blue-900 shadow-sm bg-white rounded py-0.5">{getMooringSpace(activeVessel, mooringPercent)}m</span>
                                        </div>
                                    )}

                                    <div className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                                        <span className="text-[9px] font-black text-slate-400 tracking-widest ml-1">MẠN CẬP:</span>
                                        <button onClick={() => {
                                            if (activeVessel.side === 'PS') {
                                                const bow = Number(activeVessel.bowPos) || 0;
                                                const stern = Number(activeVessel.sternPos) || 0;
                                                const distFromBow = activeVessel.bowToCabin || ((Number(activeVessel.sternPos)||0) - (Number(activeVessel.cabinPos)||0));
                                                const bowTF = Number(activeVessel.bowToFunnel) || 0;
                                                updateActiveVessel({
                                                    side: 'SB',
                                                    cabinPos: Math.round(bow + distFromBow),
                                                    ...(bowTF > 0 ? { funnelPos: Math.round(bow + bowTF) } : {})
                                                });
                                            }
                                        }} className={`flex-1 py-1 rounded font-black text-[9px] transition-colors ${(!activeVessel.side || activeVessel.side === 'SB') ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'}`}>SB (PHẢI)</button>
                                        <button onClick={() => {
                                            if (!activeVessel.side || activeVessel.side === 'SB') {
                                                const stern = Number(activeVessel.sternPos) || 0;
                                                const distFromBow = activeVessel.bowToCabin || ((Number(activeVessel.cabinPos)||0) - (Number(activeVessel.bowPos)||0));
                                                const bowTF = Number(activeVessel.bowToFunnel) || 0;
                                                updateActiveVessel({
                                                    side: 'PS',
                                                    cabinPos: Math.round(stern - distFromBow),
                                                    ...(bowTF > 0 ? { funnelPos: Math.round(stern - bowTF) } : {})
                                                });
                                            }
                                        }} className={`flex-1 py-1 rounded font-black text-[9px] transition-colors ${activeVessel.side === 'PS' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'}`}>PS (TRÁI)</button>
                                    </div>

                                    <div className="flex gap-2">
                                        <SmallInputField label="LOA" type="number" value={activeVessel.loa} onChange={(v) => {
                                            const parsed = v === '' ? '' : Math.round(v);
                                            updateActiveVessel({ loa: parsed, sternPos: parsed === '' ? activeVessel.sternPos : Math.round((Number(activeVessel.bowPos)||0) + parsed)})
                                        }} />
                                        {activeVessel.type !== 'barge' && (
                                            <SmallInputField label="CABIN" type="number" value={activeVessel.cabinPos} onChange={(v) => {
                                                const parsed = v === '' ? '' : Math.round(v);
                                                updateActiveVessel({ cabinPos: parsed })
                                            }} />
                                        )}
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                                        <SmallInputField label="Cập dự kiến (ETA)" type="datetime-local" value={activeVessel.eta || ''} onChange={(v) => {
                                            updateActiveVessel({ eta: v });
                                        }} />
                                        <SmallInputField label="Rời dự kiến (ETD)" type="datetime-local" value={activeVessel.etd || ''} onChange={(v) => {
                                            updateActiveVessel({ etd: v });
                                        }} />
                                    </div>
                                </div>
                            )}
                         </div>
                     )}
                 </div>

                 {/* BẢNG 3: BẢNG CẨU BỜ */}
                 <div className={`transition-all duration-300 transform origin-top-right ${selectedQcCount > 0 ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'}`}>
                     <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-700 shadow-[0_15px_40px_rgba(0,0,0,0.6)] flex flex-col transition-all duration-300 overflow-hidden min-w-[280px]">
                         <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50 group border-b border-slate-700" onClick={() => toggleUi('qcExpanded')}>
                             <div className="flex items-center gap-2">
                                <Crosshair size={14} className="text-sky-400" />
                                <h3 className="text-[10px] font-black tracking-[0.2em] text-white">Bảng Điều Khiển Cẩu Bờ</h3>
                             </div>
                             <div className="flex items-center gap-3">
                                 <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{Number(selectedQcCount)} Đang chọn</span>
                                 <div className="text-slate-400 group-hover:text-white transition-colors">
                                     {uiState.qcExpanded ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}
                                 </div>
                             </div>
                         </div>
                         {uiState.qcExpanded && (
                             <div className="p-4 flex flex-col gap-3">
                                 <div className="flex gap-2">
                                     <button onClick={() => setBoomState(true, false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-colors flex flex-col justify-center items-center gap-1 border border-slate-600"><ChevronsDown size={14}/><span>Làm Hàng</span></button>
                                     <button onClick={handleSafeBoomClick} className="flex-1 bg-red-600 hover:bg-red-50 text-white py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-colors flex flex-col justify-center items-center gap-1 shadow-lg shadow-red-900/50"><ChevronsUp size={14}/><span>An Toàn</span></button>
                                 </div>
                                 <div className="pt-2 border-t border-slate-700/50">
                                     <p className="text-[9px] font-bold text-slate-400 tracking-widest mb-2 italic">Tập trung Cẩu về mục tiêu:</p>
                                     <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                                         {vessels.map((v, idx) => (
                                             <button key={`qc-target-${v.id || idx}`} onClick={() => autoGatherCranesForVessel(v.id)} className="w-full text-left bg-blue-900/40 hover:bg-blue-600 text-blue-100 py-1.5 px-3 rounded-lg text-[10px] font-black tracking-widest transition-colors flex justify-between items-center group border border-blue-500/20 uppercase">
                                                 <span className="truncate pr-2">{String(v.name || 'UNKNOWN')}</span><ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                             </button>
                                         ))}
                                     </div>
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
            </div>
        )}

        {!isPrintMode && (
            <>
                <div className={`absolute z-50 flex bg-white/95 backdrop-blur-sm p-1.5 rounded-xl shadow-2xl border border-slate-200 pointer-events-auto items-center ${isMobileViewport ? 'bottom-3 right-3 scale-95 origin-bottom-right' : 'bottom-6 right-6'}`}>
                    <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-700 active:scale-95 transition-all"><ZoomOut size={18}/></button>
                    <div className="w-12 text-[10px] font-black text-center text-slate-800">{Math.round(zoomLevel * 100)}%</div>
                    <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-700 active:scale-95 transition-all"><ZoomIn size={18}/></button>
                    <div className="w-[1px] h-6 bg-slate-300 mx-1"></div>
                    <button onClick={() => setIsSetupMode(prev => !prev)} className={`px-2.5 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${isSetupMode ? 'bg-rose-600 text-white shadow-lg' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`} title="Mở/Tắt Setup bảo trì">SETUP BT</button>
                    <div className="w-[1px] h-6 bg-slate-300 mx-1"></div>
                    <div className="relative group pointer-events-auto">
                        <button className="p-2.5 rounded-xl border border-slate-200 shadow-lg bg-white/90 hover:bg-slate-50 text-slate-600 transition-all active:scale-95 flex items-center justify-center">
                            <Settings2 size={18} />
                        </button>
                        <div className="absolute bottom-full right-0 pb-2 hidden group-hover:flex flex-col gap-2 min-w-max">
                            <button onClick={() => setIsAutoExpand(!isAutoExpand)} className={`px-4 py-2.5 rounded-xl border shadow-lg transition-all text-[10px] font-black flex items-center gap-2 pointer-events-auto active:scale-95 ${isAutoExpand ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'}`}>
                                {isAutoExpand ? <Eye size={14}/> : <EyeOff size={14}/>} {isAutoExpand ? 'AUTO-BẬT BẢNG: ON' : 'AUTO-BẬT BẢNG: OFF'}
                            </button>
                            <button onClick={() => setShowGuideLines(!showGuideLines)} className={`px-4 py-2.5 rounded-xl border shadow-lg transition-all text-[10px] font-black flex items-center gap-2 pointer-events-auto active:scale-95 ${showGuideLines ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'}`}>
                                {showGuideLines ? <Eye size={14}/> : <EyeOff size={14}/>} {showGuideLines ? 'HIỆN TỌA ĐỘ MŨI/LÁI: ON' : 'HIỆN TỌA ĐỘ MŨI/LÁI: OFF'}
                            </button>
                            <div className="px-3 py-2 rounded-xl border border-slate-200 bg-white/95 text-[9px] font-black text-slate-500 tracking-wide leading-relaxed">
                                Chuột/touch: kéo bản đồ. Shift + kéo: quét chọn nhiều sà lan.
                            </div>
                        </div>
                    </div>
                    <div className="w-[1px] h-6 bg-slate-300 mx-1"></div>
                    <button onClick={handleAutoCenter} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg active:scale-95 transition-all" title="Tự động cân tâm"><Focus size={18}/></button>
                </div>
                
                
            </>
        )}

        <div ref={mapContainerRef} onMouseDown={(e) => handleMouseDown(e, 'map')} onPointerDown={(e) => handlePointerDown(e, 'map')} className={`w-full h-full overflow-hidden touch-none ${isPrintMode ? 'bg-white' : 'bg-blue-900/5'} ${isDraggingRef.current && dragStartRef.current.type === 'map' && !isPrintMode ? 'cursor-grabbing' : (isPrintMode ? '' : 'cursor-grab')}`}>
            {/* MULTI-SELECT BOX: render outside transformed map so it follows mouse exactly */}
            {selectionBox && (
                <div
                    className="fixed pointer-events-none z-[9999] border-2 border-red-500 bg-red-500/15 animate-pulse shadow-[0_0_0_2px_rgba(239,68,68,0.35)]"
                    style={{
                        left: Math.min(selectionBox.startX, selectionBox.currentX),
                        top: Math.min(selectionBox.startY, selectionBox.currentY),
                        width: Math.abs(selectionBox.currentX - selectionBox.startX),
                        height: Math.abs(selectionBox.currentY - selectionBox.startY)
                    }}
                />
            )}
            <div ref={innerMapRef} className="w-full h-full flex flex-col relative transition-transform duration-100 ease-linear" style={{ transformOrigin: isMobileViewport ? '50% 100%' : '50% 85%', transform: isPrintMode ? 'scale(1) translate(0,0)' : `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})` }}>
                
                {/* GLOBAL GUIDE LINES */}
                {vessels.map((vessel, index) => {
                    if(!vessel) return null;
                    const isBarge = vessel.type === 'barge';
                    const shouldShowGuides = isPrintMode ? (isBarge ? pdfConfig.showBargeLabels : pdfConfig.showVesselLabels) : showGuideLines;
                    if (!shouldShowGuides) return null;

                    const bowRightPercent = ((bufferLength + (vessel.bowPos||0)) / totalVisLength) * 100;
                    const sternRightPercent = ((bufferLength + (vessel.sternPos||0)) / totalVisLength) * 100;
                    const cabinRightPercent = ((bufferLength + (vessel.cabinPos||0)) / totalVisLength) * 100;
                    const { color } = getVesselStyles(vessel);
                    const isPS = vessel.side === 'PS';
                    const rightLabel = isPS ? 'LÁI' : 'MŨI';
                    const leftLabel = isPS ? 'MŨI' : 'LÁI';
                    const FIXED_BARGE_WIDTH = 18.5; 
                    const vesselHeightCqi = isBarge ? (FIXED_BARGE_WIDTH / totalVisLength) * 100 : ((vessel.loa || 200) / totalVisLength) * 100 / 7.5;
                    const yOffset = index * 26; 
                    const labelBottom = `calc(140px + ${Math.max(30, vesselHeightCqi*10)}px + 12px + ${yOffset}px)`;

                    return (
                        <div key={`guides-${vessel.id || index}`} className={`absolute top-0 left-0 w-full h-full pointer-events-none z-[60] ${isPrintMode ? 'opacity-100' : 'opacity-80'}`}>
                            <div className="absolute top-0 h-full w-[1px] border-r border-dashed" style={{ right: `${bowRightPercent}%`, borderColor: isPrintMode ? '#000' : color }}>
                                <div className={`absolute right-0 translate-x-1/2 text-[9px] font-black px-1.5 py-0.5 rounded whitespace-nowrap uppercase ${isPrintMode ? 'text-black bg-white border border-black shadow-none' : 'text-white shadow-md border border-white/40'}`} style={{ bottom: labelBottom, backgroundColor: isPrintMode ? 'white' : color }}>{String(rightLabel)} {Math.round(vessel.bowPos||0)}m</div>
                            </div>
                            <div className="absolute top-0 h-full w-[1px] border-r border-dashed" style={{ right: `${sternRightPercent}%`, borderColor: isPrintMode ? '#000' : color }}>
                                <div className={`absolute right-0 translate-x-1/2 text-[9px] font-black px-1.5 py-0.5 rounded whitespace-nowrap uppercase ${isPrintMode ? 'text-black bg-white border border-black shadow-none' : 'text-white shadow-md border border-white/40'}`} style={{ bottom: labelBottom, backgroundColor: isPrintMode ? 'white' : color }}>{String(leftLabel)} {Math.round(vessel.sternPos||0)}m</div>
                            </div>
                            {vessel.type !== 'barge' && (
                                <div className={`absolute top-0 h-full w-[1px] border-r border-dashed ${isPrintMode ? 'opacity-100' : 'opacity-50'}`} style={{ right: `${cabinRightPercent}%`, borderColor: isPrintMode ? '#000' : color }}>
                                    <div className={`absolute right-0 translate-x-1/2 text-[8px] font-black px-1.5 py-0.5 rounded whitespace-nowrap uppercase ${isPrintMode ? 'text-black bg-white border border-black shadow-none' : 'text-white shadow-md border border-white/40'}`} style={{ bottom: `calc(${labelBottom} + 22px)`, backgroundColor: isPrintMode ? 'white' : color }}>CAB {Math.round(vessel.cabinPos||0)}m</div>
                                </div>
                            )}
                            {vessel.type !== 'barge' && Number(vessel.bowToFunnel) > 0 && Number.isFinite(vessel.funnelPos) && (
                                <div className={`absolute top-0 h-full w-[1px] border-r border-dashed border-amber-400/90 ${isPrintMode ? 'opacity-100' : 'opacity-70'}`} style={{ right: `${((bufferLength + (vessel.funnelPos||0)) / totalVisLength) * 100}%` }}>
                                    <div className={`absolute right-0 translate-x-1/2 text-[7px] font-black px-1.5 py-0.5 rounded whitespace-nowrap uppercase ${isPrintMode ? 'text-black bg-amber-100 border border-black' : 'text-amber-100 shadow-md border border-amber-400/50 bg-amber-950/90'}`} style={{ bottom: `calc(${labelBottom} + 42px)` }}>KHÓI {Math.round(vessel.funnelPos||0)}m</div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* SEA ZONE */}
                <div style={{ containerType: 'inline-size' }} className={`relative w-full flex-1 flex items-end overflow-hidden z-10 ${isPrintMode ? 'bg-white border-t-2 border-black' : 'bg-gradient-to-t from-blue-400/20 to-blue-600/10 border-b border-blue-200/40'}`}>
                  {!isPrintMode && <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(3, 105, 161, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(3, 105, 161, 0.3) 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>}
                  
                  {/* MOORING LINES */}
                  {(!isPrintMode || pdfConfig.showMooringLines) && (
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }} className="absolute inset-0 pointer-events-none z-20 overflow-visible">
                          {vessels.filter(v => v?.type === 'vessel').map((vessel, index) => {
                              const { rightBollard, leftBollard } = getMooringBollards(vessel, mooringPercent);
                              const rightBollardX = 100 - ((bufferLength + Number(rightBollard.pos || 0)) / totalVisLength) * 100;
                              const rightShipX = 100 - ((bufferLength + Number(vessel.bowPos || 0)) / totalVisLength) * 100;
                              const leftBollardX = 100 - ((bufferLength + Number(leftBollard.pos || 0)) / totalVisLength) * 100;
                              const leftShipX = 100 - ((bufferLength + Number(vessel.sternPos || 0)) / totalVisLength) * 100;

                              const W = vessel.loa || 200;
                              const H = vessel.type === 'barge' ? 18.5 : W / 7.5;
                              const halfHeightCqi = (H / 2 / totalVisLength) * 100;
                              const fullHeightCqi = (H / totalVisLength) * 100;
                              
                              let shipMidY;
                              if ((vessel.tier || 1) > 1) {
                                  shipMidY = `calc(100% - ${(vessel.tier - 1) * fullHeightCqi}cqi - ${(vessel.tier - 1) * 4}px - ${halfHeightCqi}cqi)`;
                              } else {
                                  shipMidY = `calc(100% - ${halfHeightCqi}cqi)`;
                              }

                              const lineColor = isPrintMode ? '#000' : '#EF4444';
                              const strokeW = isPrintMode ? "1.5" : "2";

                              return (
                                  <g key={`mooring-line-${vessel.id || index}`}>
                                      <line x1={`${rightBollardX}%`} y1="100%" x2={`${rightShipX}%`} y2={shipMidY} style={{ y2: shipMidY }} stroke={lineColor} strokeWidth={strokeW} className={isPrintMode ? '' : 'drop-shadow-sm opacity-90'} />
                                      {!isPrintMode && <circle cx={`${rightBollardX}%`} cy="100%" r="4" fill={lineColor} className="drop-shadow-sm" />}
                                      {!isPrintMode && <circle cx={`${rightShipX}%`} cy={shipMidY} style={{ cy: shipMidY }} r="3" fill={lineColor} />}
                                      
                                      <line x1={`${leftBollardX}%`} y1="100%" x2={`${leftShipX}%`} y2={shipMidY} style={{ y2: shipMidY }} stroke={lineColor} strokeWidth={strokeW} className={isPrintMode ? '' : 'drop-shadow-sm opacity-90'} />
                                      {!isPrintMode && <circle cx={`${leftBollardX}%`} cy="100%" r="4" fill={lineColor} className="drop-shadow-sm" />}
                                      {!isPrintMode && <circle cx={`${leftShipX}%`} cy={shipMidY} style={{ cy: shipMidY }} r="3" fill={lineColor} />}
                                  </g>
                              );
                          })}
                      </svg>
                  )}

                  {/* RENDER VESSELS & BARGES */}
                  {vessels.map((vessel, index) => {
                      if(!vessel) return null;
                      const isBarge = vessel.type === 'barge';
                      const shipWidthPercent = ((vessel.loa||200) / totalVisLength) * 100;
                      const rightPosPercent = ((bufferLength + (vessel.bowPos||0)) / totalVisLength) * 100;
                      
                      const mooringLen = getMooringSpace(vessel, mooringPercent);
                      const mooringWidthPercent = (mooringLen / totalVisLength) * 100;
                      const rightMooringPosPercent = ((bufferLength + (vessel.bowPos||0) - mooringLen) / totalVisLength) * 100;
                      const leftMooringPosPercent = ((bufferLength + (vessel.sternPos||0)) / totalVisLength) * 100;

                      const { color } = getVesselStyles(vessel);
                      const isThisActive = vessel.id === activeVesselId;
                      const isMultiSelectedObject = selectedVesselIds.includes(vessel.id);
                      const isDraggingThis = isDragging && isThisActive && dragStartRef.current.type === 'vessel';
                      const isPS = vessel.side === 'PS';
                      
                      const shapeClipPath = isBarge
                        ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'
                        : (isPS ? 'polygon(6% 0%, 100% 0%, 100% 100%, 6% 100%, 0% 50%)' : 'polygon(0% 0%, 94% 0%, 100% 50%, 94% 100%, 0% 100%)');
                      
                      const FIXED_BARGE_WIDTH = 18.5; 
                      const aspectRatio = isBarge ? `${vessel.loa || 50} / ${FIXED_BARGE_WIDTH}` : '7.5 / 1'; 
                      
                      // Hỗ trợ Unlimited Tiers (Không giới hạn lớp cập mạn)
                      const vesselTier = vessel.tier || 1;
                      const doubleBerthingOffset = vesselTier > 1 ? `translateY(calc(-${(vesselTier - 1) * 100}% - ${(vesselTier - 1) * 4}px))` : 'translateY(0)';

                      const W = vessel.loa || 200;
                      const H = isBarge ? FIXED_BARGE_WIDTH : W / 7.5;
                      let polyPoints = "";
                      if (isBarge) polyPoints = `0,0 ${W},0 ${W},${H} 0,${H}`;
                      else {
                          if (isPS) polyPoints = `${W * 0.06},0 ${W},0 ${W},${H} ${W * 0.06},${H} 0,${H / 2}`;
                          else polyPoints = `0,0 ${W * 0.94},0 ${W},${H / 2} ${W * 0.94},${H} 0,${H}`;
                      }

                      let displayName = String(vessel.name || 'UNKNOWN');
                      let textColClass = "flex-col items-center justify-center text-center";
                      let textWidthClass = "w-[90%]";
                      let fontSize = 9;
                      
                      if (isBarge) {
                          displayName = displayName.replace(/\s*BAYS?/i, 'B').trim();
                          textColClass = "flex-col items-end justify-center pr-1 text-right";
                          textWidthClass = "w-full";
                          if (isPrintMode) fontSize = 5; 
                      }

                      return (
                          <div key={`vessel-group-${vessel.id || index}`} className="absolute bottom-0 pointer-events-none" style={{ right: 0, width: '100%', height: '100%' }}>
                              {vessel.type === 'vessel' && !isPrintMode && (
                                  <>
                                      <div className="absolute bottom-0 border-x border-t border-dashed rounded-t-sm z-10 flex items-center justify-center overflow-hidden transition-all opacity-60"
                                           style={{ right: `${rightMooringPosPercent}%`, width: `${mooringWidthPercent}%`, aspectRatio: aspectRatio, borderColor: color, backgroundColor: `${color}1A` }}>
                                           <span className="text-[5px] font-black tracking-widest drop-shadow-md whitespace-nowrap uppercase" style={{color: color}}>NEO {Number(mooringLen)}M</span>
                                      </div>
                                      <div className="absolute bottom-0 border-x border-t border-dashed rounded-t-sm z-10 flex items-center justify-center overflow-hidden transition-all opacity-60"
                                           style={{ right: `${leftMooringPosPercent}%`, width: `${mooringWidthPercent}%`, aspectRatio: aspectRatio, borderColor: color, backgroundColor: `${color}1A` }}>
                                           <span className="text-[5px] font-black tracking-widest drop-shadow-md whitespace-nowrap uppercase" style={{color: color}}>NEO {Number(mooringLen)}M</span>
                                      </div>
                                  </>
                              )}

                              <div 
                                onMouseDown={(e) => handleMouseDown(e, 'vessel', vessel.id)}
                                onPointerDown={(e) => handlePointerDown(e, 'vessel', vessel.id)}
                                data-object-id={vessel.id}
                                data-object-type={vessel.type}
                                data-selectable-object="true"
                                className={`absolute bottom-0 flex flex-col justify-center transition-shadow duration-75 pointer-events-auto
                                    ${isDraggingThis && !isPrintMode ? 'shadow-[0_-15px_30px_rgba(0,100,255,0.4)] ring-2 ring-blue-400 cursor-grabbing z-40 scale-[1.01]' : isThisActive && !isPrintMode ? 'hover:brightness-110 cursor-grab z-30 shadow-[0_-5px_15px_rgba(0,0,0,0.3)]' : `cursor-pointer z-20 ${isPrintMode ? '' : 'opacity-90 shadow-lg hover:opacity-100 hover:z-25'}`}
                                    ${isMultiSelectedObject && !isDraggingThis && !isPrintMode ? 'ring-2 ring-red-500 animate-pulse shadow-[0_0_0_2px_rgba(239,68,68,0.35)]' : ''}`}
                                style={{ 
                                    right: `${rightPosPercent}%`, width: `${shipWidthPercent}%`, aspectRatio: aspectRatio, 
                                    borderRadius: isBarge ? '4px' : '4px 0 0 4px',
                                    transform: doubleBerthingOffset
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                                    {isPrintMode ? (
                                        <polygon points={polyPoints} fill="#ffffff" stroke="#000000" strokeWidth={Math.max(0.5, W / 200)} strokeLinejoin="round" />
                                    ) : (
                                        <polygon points={polyPoints} fill={color} />
                                    )}
                                    {vessel.type === 'vessel' && !isPrintMode && (() => {
                                        const b0 = Math.max(0, Number(vessel.bayMarkFirstEven) || 2);
                                        const b1 = Math.max(0, Number(vessel.bayMarkLastEven) || 0);
                                        const cellM = Number(vessel.bayCellM) || 12;
                                        const els = [];

                                        if (b1 >= b0) {
                                            const marginBow = W * 0.07;
                                            const marginStern = W * 0.07;
                                            const usable = Math.max(W * 0.2, W - marginBow - marginStern);
                                            const steps = [];
                                            for (let b = b0; b <= b1; b += 4) steps.push(b);
                                            const opMarks = parseOperationDeckBaysString(vessel.operationDeckBays);
                                            steps.forEach((b, idx) => {
                                                const frac = (b - b0) / Math.max(1, (b1 - b0));
                                                const xFromBow = marginBow + frac * usable;
                                                const x = isPS ? xFromBow : W - xFromBow;
                                                const digits = opMarks.length === steps.length && opMarks[idx] ? String(opMarks[idx]).replace(/\D/g, '') : '';
                                                const schM =
                                                    vessel.bayNumberingScheme === BAY_SCHEME_PAIR_02_06_10
                                                        ? BAY_SCHEME_PAIR_02_06_10
                                                        : BAY_SCHEME_SINGLE_01_04_08;
                                                const label = digits
                                                    ? digits.padStart(2, '0')
                                                    : String(Math.min(99, Math.max(1, bayNumericFromScheme40ft(idx, schM)))).padStart(2, '0');
                                                els.push(
                                                    <g key={`deck-bay-${vessel.id}-m-${b}`}>
                                                        <line x1={x} y1={H * 0.14} x2={x} y2={H * 0.86} stroke="rgba(255,255,255,0.5)" strokeWidth={Math.max(0.35, W / 520)} />
                                                        <text x={x} y={H * 0.12} fill="rgba(255,255,255,0.92)" fontSize={Math.max(4, W / 70)} textAnchor="middle" fontWeight="800" style={{ fontFamily: 'system-ui, sans-serif' }}>{label}</text>
                                                    </g>
                                                );
                                            });
                                            return <g>{els}</g>;
                                        }

                                        const btc = Number(vessel.bowToCabin) || 0;
                                        const cabW = Number(vessel.cabinWidthM) || 10;
                                        if (btc <= 0 || cabW <= 0) return null;

                                        const slots = computeBaySlotsFromCabinGeometry(
                                            W,
                                            btc,
                                            cabW,
                                            vessel.bayCellM,
                                            vessel.bayGapM,
                                            vessel.cabinBayGapM
                                        );
                                        const opList = parseOperationDeckBaysString(vessel.operationDeckBays);
                                        const orderedSlots = [...slots].sort(
                                            (a, b) => a.fromBowStartM + cellM / 2 - (b.fromBowStartM + cellM / 2)
                                        );
                                        const opSpread =
                                            opList.length > 0 && opList.length > orderedSlots.length;
                                        if (opSpread) {
                                            const marginBow = W * 0.07;
                                            const usable = Math.max(W * 0.2, W - 2 * marginBow);
                                            const schSpread =
                                                vessel.bayNumberingScheme === BAY_SCHEME_PAIR_02_06_10
                                                    ? BAY_SCHEME_PAIR_02_06_10
                                                    : BAY_SCHEME_SINGLE_01_04_08;
                                            opList.forEach((tok, idx) => {
                                                const frac =
                                                    opList.length <= 1 ? 0.5 : idx / Math.max(1, opList.length - 1);
                                                const xFromBow = marginBow + frac * usable;
                                                const x = isPS ? xFromBow : W - xFromBow;
                                                const digits = String(tok || '').replace(/\D/g, '');
                                                const label = digits
                                                    ? digits.padStart(2, '0')
                                                    : String(
                                                          Math.min(
                                                              99,
                                                              Math.max(1, bayNumericFromScheme40ft(idx, schSpread))
                                                          )
                                                      ).padStart(2, '0');
                                                els.push(
                                                    <g key={`deck-bay-${vessel.id}-op-${idx}-${tok}`}>
                                                        <line
                                                            x1={x}
                                                            y1={H * 0.14}
                                                            x2={x}
                                                            y2={H * 0.86}
                                                            stroke="rgba(255,255,255,0.55)"
                                                            strokeWidth={Math.max(0.35, W / 520)}
                                                        />
                                                        <text
                                                            x={x}
                                                            y={H * 0.12}
                                                            fill="rgba(255,255,255,0.95)"
                                                            fontSize={Math.max(4, W / 70)}
                                                            textAnchor="middle"
                                                            fontWeight="800"
                                                            style={{ fontFamily: 'system-ui, sans-serif' }}
                                                        >
                                                            {label}
                                                        </text>
                                                    </g>
                                                );
                                            });
                                            return els.length ? <g>{els}</g> : null;
                                        }
                                        slots.forEach((sl) => {
                                            const xFromBow = sl.fromBowStartM + cellM / 2;
                                            const x = isPS ? xFromBow : W - xFromBow;
                                            const ordIdx = orderedSlots.findIndex(
                                                (o) => o.segment === sl.segment && o.n === sl.n
                                            );
                                            let label = `${sl.segment}${sl.n}`;
                                            if (opList.length && ordIdx >= 0) {
                                                if (opList.length === orderedSlots.length) {
                                                    const digits = String(opList[ordIdx] || '').replace(/\D/g, '');
                                                    if (digits) label = digits.padStart(2, '0');
                                                } else if (ordIdx < opList.length) {
                                                    const digits = String(opList[ordIdx] || '').replace(/\D/g, '');
                                                    if (digits) label = digits.padStart(2, '0');
                                                }
                                            }
                                            if (/^[FA]\d+$/.test(label) && ordIdx >= 0) {
                                                const schA =
                                                    vessel.bayNumberingScheme === BAY_SCHEME_PAIR_02_06_10
                                                        ? BAY_SCHEME_PAIR_02_06_10
                                                        : BAY_SCHEME_SINGLE_01_04_08;
                                                const bn = bayNumericFromScheme40ft(ordIdx, schA);
                                                label = String(Math.min(99, Math.max(1, bn))).padStart(2, '0');
                                            }
                                            els.push(
                                                <g key={`deck-bay-${vessel.id}-g-${sl.segment}-${sl.n}`}>
                                                    <line x1={x} y1={H * 0.14} x2={x} y2={H * 0.86} stroke="rgba(255,255,255,0.55)" strokeWidth={Math.max(0.35, W / 520)} />
                                                    <text x={x} y={H * 0.12} fill="rgba(255,255,255,0.95)" fontSize={Math.max(4, W / 70)} textAnchor="middle" fontWeight="800" style={{ fontFamily: 'system-ui, sans-serif' }}>{label}</text>
                                                </g>
                                            );
                                        });
                                        return els.length ? <g>{els}</g> : null;
                                    })()}
                                </svg>

                                {!isPrintMode && <div className="absolute inset-0 pointer-events-none opacity-50" style={{ clipPath: shapeClipPath, background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.4) 100%)' }}></div>}
                                
                                {vessel.type === 'vessel' && (() => {
                                    const loaM = vessel.loa || 200;
                                    const cabinWm = Math.min(Math.max(Number(vessel.cabinWidthM) || 10, 2), loaM * 0.4);
                                    return (
                                    <div className={`absolute top-[8%] h-[84%] rounded-[2px] flex flex-col justify-evenly py-[1px] px-[2px] z-20 transition-all pointer-events-none ${isPrintMode ? 'bg-white border-[1px] border-black shadow-none' : 'bg-[#f8fafc] border border-slate-500 shadow-sm'}`}
                                         style={{ right: `${(Math.abs((vessel.cabinPos || 0) - (vessel.bowPos || 0)) / loaM) * 100}%`, width: `${(cabinWm / loaM) * 100}%`, transform: 'translateX(50%)' }}>
                                        <div className={`w-full h-[15%] rounded-[1px] ${isPrintMode ? 'border border-black bg-white' : 'bg-slate-800/80'}`}></div>
                                        <div className={`w-full h-[15%] rounded-[1px] ${isPrintMode ? 'border border-black bg-white' : 'bg-slate-800/80'}`}></div>
                                        <div className={`w-full h-[15%] rounded-[1px] ${isPrintMode ? 'border border-black bg-white' : 'bg-slate-800/80'}`}></div>
                                        <div className={`w-full h-[15%] rounded-[1px] ${isPrintMode ? 'border border-black bg-white' : 'bg-slate-800/80'}`}></div>
                                    </div>
                                    );
                                })()}
                                {vessel.type === 'vessel' && !isPrintMode && vessel.cabinFunnelCombined === false && Number(vessel.bowToFunnel) > 0 && Number.isFinite(vessel.funnelPos) && (() => {
                                    const loaM = vessel.loa || 200;
                                    const funnelWm = Math.min(Math.max(Number(vessel.funnelWidthM) || 8, 2), loaM * 0.3);
                                    return (
                                        <div
                                            className="absolute top-[22%] h-[28%] rounded-[3px] z-[19] pointer-events-none flex items-center justify-center bg-gradient-to-b from-amber-900/95 to-slate-900/90 border border-amber-400/70 shadow-md"
                                            style={{
                                                right: `${(Math.abs((vessel.funnelPos || 0) - (vessel.bowPos || 0)) / loaM) * 100}%`,
                                                width: `${(funnelWm / loaM) * 100}%`,
                                                transform: 'translateX(50%)'
                                            }}
                                        >
                                            <span className="text-[5px] font-black text-amber-100/90 tracking-tighter uppercase leading-none text-center px-0.5">Ống khói</span>
                                        </div>
                                    );
                                })()}

                                <div className={`relative z-30 w-full h-full flex items-center justify-center pointer-events-none px-2 overflow-hidden ${textColClass}`}>
                                    <div className={`flex flex-col items-center justify-center ${textWidthClass} min-w-0`}>
                                        <p
                                            style={{ fontSize: `${Number.isFinite(fontSize) ? fontSize : 9}px`, color: isPrintMode ? '#000' : '#fff' }}
                                            className={`font-black tracking-[0.08em] leading-none whitespace-nowrap overflow-hidden text-ellipsis uppercase text-center ${
                                                isPrintMode ? 'shadow-none' : 'drop-shadow-[0_3px_6px_rgba(0,0,0,0.95)]'
                                            }`}
                                        >
                                            {displayName}
                                        </p>
                                        {vessel.type === 'vessel' && (
                                            <p
                                                className={`mt-1 text-[7px] sm:text-[8px] font-black tracking-[0.08em] leading-none whitespace-nowrap overflow-hidden text-ellipsis uppercase text-center ${
                                                    isPrintMode ? 'text-black' : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]'
                                                }`}
                                            >
                                                {String(vessel.voyage || 'TBU').toUpperCase()}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {isThisActive && !isPrintMode && !isDraggingThis && (
                                    <>
                                        <button onPointerDown={(e) => handleNudgeStart(e, vessel.id, 1)} onPointerUp={handleNudgeStop} onPointerLeave={handleNudgeStop} className="absolute top-1/2 -left-8 -translate-y-1/2 p-1 text-white/80 hover:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-[100] active:scale-75 transition-all cursor-pointer group" style={{ pointerEvents: 'auto' }} title="Nhích Trái"><ChevronLeft size={24} strokeWidth={4} className="group-hover:-translate-x-1 transition-transform" /></button>
                                        <button onPointerDown={(e) => handleNudgeStart(e, vessel.id, -1)} onPointerUp={handleNudgeStop} onPointerLeave={handleNudgeStop} className="absolute top-1/2 -right-8 -translate-y-1/2 p-1 text-white/80 hover:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-[100] active:scale-75 transition-all cursor-pointer group" style={{ pointerEvents: 'auto' }} title="Nhích Phải"><ChevronRight size={24} strokeWidth={4} className="group-hover:translate-x-1 transition-transform" /></button>
                                    </>
                                )}
                              </div>
                          </div>
                      );
                  })}
                </div>

                {/* PIER ZONE */}
                <div className={`relative w-full h-[140px] flex flex-row flex-shrink-0 z-30 ${isPrintMode ? 'shadow-none border-t border-black' : 'shadow-2xl'}`}>
                    <div className={`w-[25%] flex items-center justify-center relative overflow-hidden ${isPrintMode ? 'bg-white border-t-2 border-black' : 'bg-slate-300 border-t-8 border-slate-400'}`}>
                        {!isPrintMode && <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 20px)' }}></div>}
                        <span className={`text-xl sm:text-3xl font-black italic ${isPrintMode ? 'text-black opacity-100' : 'text-slate-500 opacity-30'}`}>TCTT (300m)</span>
                    </div>

                    <div className={`w-[50%] relative ${isPrintMode ? 'bg-white border-t-2 border-black border-x' : 'bg-[#94A3B8] border-t-8 border-[#475569] border-x border-slate-500 shadow-inner'}`}>
                        <div className={`absolute top-0 left-0 w-full h-3 z-10 flex items-center ${isPrintMode ? 'bg-white border-b border-black' : 'bg-slate-800 border-b border-slate-600'}`}>
                            {Array.from({ length: 13 }).map((_, i) => (
                                <div key={`ruler-${i}`} className="absolute top-0 flex flex-col items-center" style={{ right: `${((i * 50) / 600) * 100}%`, transform: 'translateX(50%)' }}>
                                    <div className={`w-0.5 h-1.5 ${isPrintMode ? 'bg-black' : 'bg-slate-400'}`}></div>
                                    <div className={`mt-0.5 text-[6px] font-black px-1 rounded shadow-md leading-none py-0.5 ${isPrintMode ? 'bg-white text-black border border-black shadow-none' : 'bg-slate-800 text-yellow-400 border border-slate-600'}`}>{i * 50}m</div>
                                </div>
                            ))}
                        </div>

                        {!isPrintMode && berthMaintenanceZones.map((zone, idx) => {
                            const start = Math.max(0, Math.min(600, Number(zone.start || 0)));
                            const end = Math.max(0, Math.min(600, Number(zone.end || 0)));
                            if (end <= start) return null;
                            const isSelectedMaintenance = selectedMaintenanceZoneIds.includes(zone.id);
                            return (
                                <div
                                    key={`berth-maint-${idx}`}
                                    onMouseDown={(e) => startMaintenanceZoneDrag(e, idx, { id: zone.id, start, end })}
                                    onPointerDown={(e) => { if (e.pointerType === 'mouse') return; startMaintenanceZoneDrag(e, idx, { id: zone.id, start, end }); }}
                                    className={`absolute -top-8 h-[calc(100%+8px)] z-[15] pointer-events-auto border-2 bg-red-700/45 shadow-[inset_0_0_0_1px_rgba(127,29,29,0.6),0_0_18px_rgba(220,38,38,0.45)] group ${isSelectedMaintenance ? 'border-red-900 ring-2 ring-red-500' : 'border-red-700'}`}
                                    style={{ right: `${(start / 600) * 100}%`, width: `${((end - start) / 600) * 100}%` }}
                                    title="Giữ Shift + kéo cạnh để nới vùng; kéo thường ở giữa để di chuyển"
                                />
                            );
                        })}
                        
                        {(!isPrintMode || pdfConfig.showQcRanges) && (
                            <div className={`absolute top-6 left-0 w-full flex flex-col gap-[2px] px-6 z-20 pointer-events-none ${isPrintMode ? 'opacity-100' : 'opacity-80'}`}>
                                {qcTasks.map((qc, idx) => (
                                    <div key={`qc-range-${qc.id || idx}`} className={`relative h-[8px] w-full rounded-full flex items-center ${isPrintMode ? 'bg-transparent' : 'bg-black/10'}`}>
                                        <div className={`absolute h-full rounded-full transition-all flex items-center justify-center overflow-hidden ${isPrintMode ? 'shadow-none' : 'shadow-sm'}`} 
                                             style={{ right: `${(qc.rangeStart/600)*100}%`, width: `${((qc.rangeEnd-qc.rangeStart)/600)*100}%`, backgroundColor: isPrintMode ? 'transparent' : qc.color, border: isPrintMode ? `1px dashed ${qc.color}` : 'none' }}>
                                            <span className={`text-[6px] font-black px-1 tracking-widest ${isPrintMode ? 'text-black' : 'text-white'}`}>{String(qc.name)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="absolute top-0 left-0 w-full h-full z-50 pointer-events-none">
                             {!isPrintMode && qcTasks.filter(q => qcMaintenanceIds.includes(q.id)).map((qc) => (
                                <div
                                    key={`qc-maint-frame-${qc.id}`}
                                    onMouseDown={(e) => handleMouseDown(e, 'qc', qc.id)}
                                    onPointerDown={(e) => handlePointerDown(e, 'qc', qc.id)}
                                    className="absolute pointer-events-auto cursor-pointer z-[48] border-2 border-rose-600 bg-rose-500/10 shadow-[0_0_0_2px_rgba(190,24,93,0.25)]"
                                    style={{
                                        right: `${(Number(qc.pos || 0) / 600) * 100}%`,
                                        width: `${(44 / 600) * 100}%`,
                                        height: 'calc(100% + 90px)',
                                        top: '-90px',
                                        transform: 'translateX(50%)'
                                    }}
                                >
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-black tracking-widest px-2 py-0.5 rounded bg-rose-600 text-white uppercase shadow-md">QC bảo trì</div>
                                </div>
                             ))}
                             {qcTasks.map((qc, idx) => {
                                 if(!qc) return null;
                                 const isDraggingThisQc = isDragging && dragStartRef.current.type === 'qc' && dragStartRef.current.id === qc.id;
                                 const isQcMaintenance = qcMaintenanceIds.includes(qc.id);
                                 return (
                                    <div
                                        key={`qc-body-${qc.id || idx}`}
                                        data-object-id={qc.id}
                                        data-object-type="qc"
                                        data-selectable-object="true"
                                        className={`absolute top-10 flex flex-col items-center transition-transform pointer-events-auto ${isPrintMode ? 'bg-white border-[1.5px] border-black shadow-none' : 'bg-slate-300 border-2 border-slate-400 shadow-[0_10px_20px_rgba(0,0,0,0.5)]'} ${isDraggingThisQc && !isPrintMode ? 'z-50 scale-105 ring-2 ring-blue-500' : (!isPrintMode ? 'hover:-translate-y-1 hover:brightness-110 z-40' : 'z-40')} ${qc.selected && !isDraggingThisQc && !isPrintMode ? 'ring-2 ring-red-500 animate-pulse shadow-[0_0_0_2px_rgba(239,68,68,0.35)]' : ''} ${isQcMaintenance && !isPrintMode ? 'ring-2 ring-rose-700 shadow-[0_0_0_3px_rgba(225,29,72,0.35)]' : ''}`}
                                        style={{ right: `${(Number(qc.pos||0)/600)*100}%`, width: `${(30/600)*100}%`, height: '4rem', transform: 'translateX(50%)' }}
                                    >
                                        <div className={`absolute bottom-full transition-all duration-[600ms] origin-bottom border-x border-t rounded-t-sm z-50 ${isPrintMode ? 'bg-white border-black border-[1px]' : (qc.boomDown ? 'bg-slate-800 border-black/50 shadow-[0_20px_25px_rgba(0,0,0,0.5)]' : 'bg-red-500 border-black/50 shadow-[0_20px_25px_rgba(0,0,0,0.5)]')}`} style={{ height: isPrintMode ? (qc.boomDown ? '15px' : '5px') : (qc.boomDown ? '50px' : '10px'), width: '8px' }}>
                                           {!isPrintMode && <div className="w-full h-full opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 4px, #fff 4px, #fff 6px)' }}></div>}
                                        </div>
                                        <div onMouseDown={(e) => handleMouseDown(e, 'qc', qc.id)} onPointerDown={(e) => handlePointerDown(e, 'qc', qc.id)} className={`flex-1 w-full flex flex-col items-center justify-start pt-1 relative z-50 pointer-events-auto touch-none cursor-grab active:cursor-grabbing overflow-hidden ${isPrintMode ? 'bg-white' : 'bg-gradient-to-b from-slate-200 to-slate-400'}`}>
                                            <div className={`absolute top-0 w-full h-1.5 ${isPrintMode ? 'opacity-100' : 'opacity-80'}`} style={{ backgroundColor: qc.color }}></div>
                                            {!isPrintMode && <div onMouseDown={(e) => { e.stopPropagation(); toggleQcSelection(qc.id); }} onPointerDown={(e) => { if (e.pointerType === 'mouse') return; e.stopPropagation(); if (e.pointerType === 'touch') e.preventDefault(); toggleQcSelection(qc.id); }} className={`mt-1.5 mb-1.5 w-4 h-4 flex items-center justify-center rounded border shadow-inner cursor-pointer transition-all ${qc.selected ? 'bg-blue-500 border-blue-700 hover:bg-blue-600' : 'bg-white border-slate-400 hover:bg-slate-100'}`}>{qc.selected && <span className="text-white font-black text-[10px] leading-none">✓</span>}</div>}
                                            <span className={`text-[6px] font-black px-1 rounded mt-0.5 uppercase ${isPrintMode ? 'text-black bg-white border border-black shadow-none' : 'text-slate-800 bg-white/90 border border-slate-300 shadow-sm'}`}>{String(qc.name || '')}</span>
                                            <span className={`text-[8px] font-black mt-0.5 leading-none ${isPrintMode ? 'text-black' : 'text-slate-800'}`}>{Math.round(qc.pos||0)}</span>
                                            {!isPrintMode && <div className={`absolute -top-8 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded shadow-xl whitespace-nowrap ${isDraggingThisQc ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>{Math.round(qc.pos||0)}m</div>}
                                        </div>
                                    </div>
                                 )
                             })}
                        </div>

                        <div className="absolute top-0 left-0 w-full h-full z-30 pointer-events-none">
                            {CMIT_BOLLARDS.map((b, idx) => (
                                <div key={`bollard-${b.id || idx}`} className={`absolute top-0 h-full w-[1px] flex flex-col items-center group ${isPrintMode ? 'bg-black/10' : 'bg-white/20'}`} style={{ right: `${(Number(b.pos||0)/600)*100}%` }}>
                                    <div className={`w-3 h-3 rounded-full -mt-1.5 transition-all relative flex items-center justify-center pointer-events-auto ${isPrintMode ? 'bg-white border border-black shadow-none' : 'bg-[#0F172A] border border-slate-400 shadow-md group-hover:bg-blue-600 group-hover:border-blue-300 hover:scale-150 hover:z-50 cursor-help'}`}>
                                        <span className={`text-[5px] font-black leading-none ${isPrintMode ? 'text-black' : 'text-white'}`}>{String(b.id)}</span>
                                        {!isPrintMode && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none">Cọc {String(b.id)} ({Number(b.pos)}m)</div>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {!isPrintMode && (
                            <div className="absolute bottom-2 sm:bottom-4 left-0 w-full flex px-4 gap-4 items-end pointer-events-none opacity-20">
                                <div className="flex-1 h-12 sm:h-20 bg-blue-900/50 rounded-xl flex items-center justify-center font-black text-white text-lg sm:text-2xl tracking-widest">B2</div>
                                <div className="flex-1 h-12 sm:h-20 bg-blue-900/50 rounded-xl flex items-center justify-center font-black text-white text-lg sm:text-2xl tracking-widest">B1</div>
                            </div>
                        )}
                    </div>

                    <div className={`w-[25%] flex items-center justify-center relative overflow-hidden ${isPrintMode ? 'bg-white border-t-2 border-black' : 'bg-slate-300 border-t-8 border-slate-400'}`}>
                        {!isPrintMode && <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #000 0, #000 1px, transparent 0, transparent 20px)' }}></div>}
                        <span className={`text-xl sm:text-3xl font-black italic ${isPrintMode ? 'text-black opacity-100' : 'text-slate-500 opacity-30'}`}>Hưng Thái (300m)</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // RENDER: SCHEDULE MAP (KẾ HOẠCH BẾN GANTT CHART)
  // -------------------------------------------------------------
  const renderScheduleMap = () => {
    // 1. Tính toán trục Thời Gian (Y-axis)
    const msPerDay = 24 * 60 * 60 * 1000;
    const startMs = scheduleStartDate.getTime();
    const totalMs = scheduleDays * msPerDay;
    
    // Mảng các ngày để vẽ lưới trục Y
    const daysArr = Array.from({ length: scheduleDays }).map((_, i) => {
        const d = new Date(startMs + i * msPerDay);
        return {
            dateStr: d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }),
            isWeekend: d.getDay() === 0 || d.getDay() === 6
        };
    });

    return (
        <div className="w-full h-full bg-slate-50 rounded-[32px] border border-slate-200 shadow-inner flex flex-col overflow-hidden relative">
            
            {/* Thanh công cụ cấu hình biểu đồ Kế Hoạch */}
            <div className="bg-white px-6 py-3 border-b border-slate-200 flex items-center justify-between shadow-sm z-30 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-sm font-black text-[#002D54] tracking-widest flex items-center gap-2 uppercase">
                        <CalendarDays size={18} className="text-blue-600"/> Lịch chiếm dụng cầu bến
                    </h2>
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setScheduleDays(3)} className={`px-3 py-1 rounded text-[10px] font-black transition-colors uppercase ${scheduleDays === 3 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>3 Ngày</button>
                        <button onClick={() => setScheduleDays(7)} className={`px-3 py-1 rounded text-[10px] font-black transition-colors uppercase ${scheduleDays === 7 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>7 Ngày</button>
                        <button onClick={() => setScheduleDays(14)} className={`px-3 py-1 rounded text-[10px] font-black transition-colors uppercase ${scheduleDays === 14 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>14 Ngày</button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bắt đầu từ:</span>
                    <input 
                        type="date" 
                        value={scheduleStartDate.toISOString().split('T')[0]} 
                        onChange={(e) => {
                            const d = new Date(e.target.value);
                            d.setHours(0,0,0,0);
                            if(!isNaN(d.getTime())) setScheduleStartDate(d);
                        }}
                        className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black text-[#002D54] outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setScheduleStartDate(d); }} className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-black transition-colors uppercase tracking-widest shadow-sm">Hôm nay</button>
                </div>
            </div>

            {/* Trục X: Chiều dài cầu bến (Y chang tab Mô Phỏng) */}
            <div className="relative w-full h-[40px] flex flex-row flex-shrink-0 z-20 border-b border-slate-300 shadow-sm bg-white">
                <div className="w-[25%] flex items-center justify-center bg-slate-100 border-r border-slate-200">
                    <span className="text-xs font-black text-slate-400 italic">TCTT (300m)</span>
                </div>
                <div className="w-[50%] relative bg-slate-50 shadow-inner">
                    <div className="absolute top-0 left-0 w-full h-full flex items-end pb-1 border-b-4 border-slate-400">
                        {Array.from({ length: 13 }).map((_, i) => (
                            <div key={`sched-ruler-${i}`} className="absolute top-0 h-full flex flex-col justify-end items-center" style={{ right: `${((i * 50) / 600) * 100}%`, transform: 'translateX(50%)' }}>
                                <div className="w-px h-full bg-slate-200 absolute top-0 -z-10"></div>
                                <div className="w-0.5 h-2 bg-slate-400"></div>
                                <div className="text-[8px] font-black text-slate-600 leading-none mt-1">{i * 50}m</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="w-[25%] flex items-center justify-center bg-slate-100 border-l border-slate-200">
                    <span className="text-xs font-black text-slate-400 italic">Hưng Thái (300m)</span>
                </div>
            </div>

            {/* Main Grid: Biểu đồ thời gian (Scrollable Y, Pan-able X) */}
            <div className="flex-1 overflow-hidden bg-slate-50 relative touch-none"
                 ref={mapContainerRef} 
                 onMouseDown={(e) => handleMouseDown(e, 'scheduleMap')}
                 onPointerDown={(e) => handlePointerDown(e, 'scheduleMap')}>
                
                <div ref={innerMapRef} className="w-full h-full flex relative" 
                     style={{ transformOrigin: 'top center', transform: 'translate(0px, 0px) scale(1)' }}>
                    
                    {/* Cột mốc thời gian (Y-Axis Labels) */}
                    <div className="absolute left-0 top-0 h-full w-[44px] sm:w-[60px] bg-white border-r border-slate-200 z-30 flex flex-col drop-shadow-md">
                        {daysArr.map((day, i) => (
                            <div key={`y-axis-${i}`} className={`flex-1 flex flex-col items-center justify-center border-b border-slate-200 ${day.isWeekend ? 'bg-red-50/50 text-red-600' : 'text-slate-600'}`}>
                                <span className="text-[10px] font-black uppercase">{day.dateStr.split(' ')[0]}</span>
                                <span className="text-xs font-black">{day.dateStr.split(' ')[1]}</span>
                            </div>
                        ))}
                    </div>

                    {/* Vùng Lưới vẽ Tàu */}
                    <div className="flex-1 h-full relative ml-[44px] sm:ml-[60px]">
                        
                        {/* Lưới ngang (Theo ngày) */}
                        <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
                            {daysArr.map((day, i) => (
                                <div key={`grid-y-${i}`} className={`flex-1 border-b border-slate-200 w-full relative ${day.isWeekend ? 'bg-red-50/20' : ''}`}>
                                    {/* Line phân chia 12h trưa */}
                                    <div className="absolute top-1/2 left-0 w-full h-px border-t border-dashed border-slate-200 opacity-50"></div>
                                </div>
                            ))}
                        </div>

                        {/* Lưới dọc (Kéo dài từ thước đo cầu bến xuống) */}
                        <div className="absolute inset-0 pointer-events-none z-0 flex">
                            <div className="w-[25%] bg-slate-100/50 border-r border-slate-200"></div>
                            <div className="w-[50%] relative">
                                {Array.from({ length: 13 }).map((_, i) => (
                                    <div key={`grid-x-${i}`} className="absolute top-0 h-full w-px bg-slate-200/50" style={{ right: `${((i * 50) / 600) * 100}%` }}></div>
                                ))}
                                {/* Highlight vùng Bollard chính */}
                                <div className="absolute inset-0 border-x-2 border-blue-200/30 bg-blue-50/10"></div>
                            </div>
                            <div className="w-[25%] bg-slate-100/50 border-l border-slate-200"></div>
                        </div>

                        {/* RENDER CÁC KHỐI TÀU LÊN GANTT CHART */}
                        {(() => {
                            // === TIERED SCHEDULING: Pre-compute effective ETD ===
                            const effectiveTimes = {};
                            vessels.forEach(v => {
                                if (!v || !v.eta) return;
                                const baseEtaMs = new Date(v.eta).getTime();
                                let etdMs;
                                if (v.type === 'barge' && v.totalRemain > 0 && qcProductivity > 0) {
                                    const durationHours = v.totalRemain / qcProductivity;
                                    etdMs = baseEtaMs + durationHours * 3600000;
                                } else {
                                    etdMs = new Date(v.etd || getEtdFallback(v.eta)).getTime();
                                }
                                effectiveTimes[v.id] = { eta: baseEtaMs, etd: etdMs, tier: v.tier || 1 };
                            });
                            // Pass 2: Snap-to-Finish for Tier 2+ barges
                            const maxTier = Math.max(...vessels.map(v => v.tier || 1), 1);
                            for (let tier = 2; tier <= maxTier; tier++) {
                                vessels.filter(v => v && (v.tier || 1) === tier && v.type === 'barge').forEach(barge => {
                                    if (!effectiveTimes[barge.id]) return;
                                    const overlapping = vessels.filter(other => {
                                        if (!other || other.id === barge.id || !effectiveTimes[other.id]) return false;
                                        if ((other.tier || 1) >= tier) return false;
                                        const bB = barge.bowPos || 0, bS = barge.sternPos || (bB + (barge.loa || 0));
                                        const oB = other.bowPos || 0, oS = other.sternPos || (oB + (other.loa || 0));
                                        return bB < oS && bS > oB;
                                    });
                                    if (overlapping.length > 0) {
                                        const latestEtd = Math.max(...overlapping.map(o => effectiveTimes[o.id].etd));
                                        const dur = effectiveTimes[barge.id].etd - effectiveTimes[barge.id].eta;
                                        effectiveTimes[barge.id].eta = latestEtd;
                                        effectiveTimes[barge.id].etd = latestEtd + dur;
                                    }
                                });
                            }
                            return vessels.map((vessel, index) => {
                            if (!vessel || !vessel.eta) return null;
                            const times = effectiveTimes[vessel.id];
                            if (!times) return null;
                            const vEtaMs = times.eta;
                            const vEtdMs = times.etd;
                            
                            // Chỉ render nếu tàu nằm trong khoảng thời gian đang xem
                            if (vEtdMs < startMs || vEtaMs > startMs + totalMs) return null;

                            // Tọa độ Y & Chiều cao (Theo Thời gian)
                            const topPercent = Math.max(0, ((vEtaMs - startMs) / totalMs) * 100);
                            const bottomPercent = Math.min(100, ((vEtdMs - startMs) / totalMs) * 100);
                            const heightPercent = bottomPercent - topPercent;
                            
                            if (heightPercent <= 0) return null;

                            // Tọa độ X & Chiều rộng (Theo Cầu bến)
                            const W = vessel.loa || 200;
                            const isBarge = vessel.type === 'barge';
                            const shipWidthPercent = (W / totalVisLength) * 100;
                            
                            const { color } = getVesselStyles(vessel);
                            const isThisActive = vessel.id === activeVesselId;

                            const vesselTier = vessel.tier || 1;
                            const zIndexBase = 10 + vesselTier;
                            // Keep schedule X aligned 1:1 with visual map.
                            const baseRightPosPercent = ((bufferLength + (vessel.bowPos||0)) / totalVisLength) * 100;

                            return (
                                <div 
                                    key={`sched-vessel-${vessel.id || index}`}
                                    onMouseDown={(e) => handleMouseDown(e, 'vessel', vessel.id)}
                                    onPointerDown={(e) => handlePointerDown(e, 'vessel', vessel.id)}
                                    className={`absolute flex flex-col overflow-hidden rounded-md border cursor-pointer transition-all pointer-events-auto group
                                        ${isThisActive ? 'ring-2 ring-blue-500 z-50 brightness-110' : 'hover:brightness-110 hover:z-40'}`}
                                    style={{
                                        top: `${topPercent}%`,
                                        height: `${heightPercent}%`,
                                        minHeight: '26px', // Đảm bảo luôn hiển thị được Header
                                        right: `${baseRightPosPercent}%`,
                                        width: `${shipWidthPercent}%`,
                                        backgroundColor: `${color}F2`,
                                        borderTopColor: isThisActive ? '#fff' : 'rgba(255,255,255,0.4)',
                                        borderRightColor: isThisActive ? '#fff' : 'rgba(255,255,255,0.3)',
                                        borderBottomColor: isThisActive ? '#fff' : 'rgba(255,255,255,0.3)',
                                        borderLeftColor: isThisActive ? '#fff' : 'rgba(255,255,255,0.3)',
                                        zIndex: isThisActive ? 50 : zIndexBase,
                                        boxShadow: 'none',
                                        borderTopWidth: '2px',
                                    }}
                                    title={`${vessel.name}\nETA: ${new Date(vEtaMs).toLocaleString('vi-VN')}\nETD: ${new Date(vEtdMs).toLocaleString('vi-VN')}\nLớp cập (Tier): ${vesselTier}`}
                                >
                                    {/* Header của block tàu */}
                                    <div className="bg-black/20 w-full px-1.5 py-0.5 flex justify-between items-center text-[8px] text-white font-black uppercase tracking-wider backdrop-blur-sm flex-shrink-0">
                                        <span className="truncate pr-1 drop-shadow-md">{vessel.name}</span>
                                        {/* totalRemain badge */}
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {isBarge && vessel.totalRemain > 0 && <span className="bg-amber-500 px-1 rounded text-[6px]">{vessel.totalRemain}c</span>}
                                                {isBarge && vesselTier > 1 && <span className="bg-red-500 px-1 rounded text-[6px]">T{vesselTier}</span>}
                                            </div>
                                    </div>
                                    
                                    {/* Thời gian hiển thị bên trong block nếu đủ không gian */}
                                    {heightPercent > 2 && (
                                        <div className="flex-1 w-full flex flex-col justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity min-h-0">
                                            <span className="text-[7px] text-white/90 font-bold leading-tight drop-shadow-sm truncate">↓ {new Date(vEtaMs).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
                                            <div className="flex-1 flex items-center justify-center min-h-0">
                                                <span className="text-[10px] text-white font-black opacity-30 rotate-[-15deg]">{W}m</span>
                                            </div>
                                            <span className="text-[7px] text-white/90 font-bold leading-tight drop-shadow-sm text-right truncate">↑ {new Date(vEtdMs).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        });
                        })()}

                        {/* OVERLAY BẢO TRÌ: hiển thị xuyên suốt khoảng thời gian đang xem */}
                        {!isPrintMode && (
                            <div className="absolute inset-0 pointer-events-none z-[5]">
                                {berthMaintenanceZones.map((zone) => {
                                    const zoneStart = Number(zone.start || 0);
                                    const zoneEnd = Number(zone.end || 0);
                                    if (!Number.isFinite(zoneStart) || !Number.isFinite(zoneEnd) || zoneEnd <= zoneStart) return null;
                                    return (
                                        <div
                                            key={`sched-maint-zone-${zone.id || `${zoneStart}-${zoneEnd}`}`}
                                            className="absolute top-0 h-full border-x-2 border-red-700/70 bg-red-500/15"
                                            style={{
                                                right: `${((bufferLength + zoneStart) / totalVisLength) * 100}%`,
                                                width: `${((zoneEnd - zoneStart) / totalVisLength) * 100}%`
                                            }}
                                        >
                                            <div className="absolute top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-red-700 text-white text-[8px] font-black tracking-widest uppercase whitespace-nowrap">
                                                BT {Math.round(zoneStart)}-{Math.round(zoneEnd)}m (toàn kỳ)
                                            </div>
                                        </div>
                                    );
                                })}
                                {qcTasks
                                    .filter(q => qcMaintenanceIds.includes(q.id))
                                    .map((qc) => (
                                        <div
                                            key={`sched-maint-qc-${qc.id}`}
                                            className="absolute top-0 h-full border-x border-rose-700/80 bg-rose-500/12"
                                            style={{
                                                right: `${((bufferLength + Number(qc.pos || 0) - 10) / totalVisLength) * 100}%`,
                                                width: `${(20 / totalVisLength) * 100}%`
                                            }}
                                        >
                                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-rose-700 text-white text-[8px] font-black tracking-wide uppercase whitespace-nowrap">
                                                {qc.name} BT
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Ghi chú dưới cùng */}
            <div className="bg-slate-100 px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-4 flex-shrink-0 border-t border-slate-200">
                <span className="flex items-center gap-1 text-blue-600"><Info size={12}/> LƯU Ý KẾ HOẠCH BẾN:</span>
                <span>• Trục ngang là Tọa độ Bến | Trục dọc là Thời gian (ETA tới ETD)</span>
                <span className="text-emerald-600 font-black">• Sà lan có Total Remain sẽ tự tính thời lượng = Remain ÷ Năng suất QC</span>
                <span className="text-purple-600 font-black">• Lớp 2+ tự snap sau khi Lớp dưới hoàn thành (Snap-to-Finish)</span>
            </div>
        </div>
    );
  };


  const renderTabButton = (id, label, Icon) => (
    <button onClick={() => setActiveTab(id)} className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-black text-[10px] tracking-widest transition-all uppercase ${activeTab === id ? 'bg-[#002D54] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-[#002D54]'}`}>
      <Icon size={14} strokeWidth={3} /><span>{String(label || '')}</span>
    </button>
  );

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#002D54]">
        <div className="flex flex-col items-center gap-6"><Activity className="w-16 h-16 text-sky-400 animate-spin" /><p className="text-white font-black tracking-[0.5em] text-sm uppercase">Đang tải Dữ liệu Cảng...</p></div>
      </div>
    );
  }

  const { bowBollard: bow, sternBollard: stern } = activeVessel && activeVessel.bowPos >= -200 
    ? getMooringBollards(activeVessel, mooringPercent) 
    : { bowBollard:{id:'-'}, sternBollard:{id:'-'} };

  return (
    <div className={`h-screen text-[#002D54] flex flex-col overflow-hidden select-none tracking-wide relative ${isPrintMode ? 'bg-white' : 'bg-[#F8FAFC]'}`}>
      {!isPrintMode && (
          <header className="bg-white border-b border-slate-200 h-12 flex-shrink-0 z-50 px-6 flex items-center justify-between shadow-sm uppercase">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-cyan-200/60 bg-white shadow-md shrink-0">
                <img
                  src="/cmit-logo-round-source.png"
                  alt="CMIT"
                  className="w-full h-full object-cover scale-[1.7]"
                  style={{ objectPosition: 'center 40%' }}
                />
              </div>
              
              <h1 onClick={handleTitleClick} className="text-base font-black tracking-tighter italic leading-none cursor-pointer select-none hover:opacity-80 transition-opacity">
                CMIT VESSEL BERTHING <span className="text-blue-600 tracking-normal opacity-50 not-italic font-semibold text-xs">v39 (NESTED SCHEDULE)</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={openPdfOptions} disabled={isExportingPDF} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg font-black text-[9px] transition-all flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50">
                    {isExportingPDF ? <Activity size={14} className="animate-spin"/> : <Printer size={14} />} 
                    {isExportingPDF ? 'ĐANG TẠO PDF...' : 'TẢI PDF BẢN IN'}
                </button>
                <button onClick={saveToHistory} className="bg-[#0072BC] hover:bg-[#005a96] text-white px-4 py-1.5 rounded-lg font-black text-[9px] transition-all flex items-center gap-2 shadow-lg active:scale-95"><Save size={14} /> Tự động lưu đám mây</button>
            </div>
          </header>
      )}

      {!isPrintMode && (
          <nav className="bg-white/80 backdrop-blur-md px-6 py-1.5 border-b border-slate-200 flex justify-between items-center flex-shrink-0 relative z-40 overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5 flex-shrink-0">
                {renderTabButton("vessel", "DỮ LIỆU TÀU", Settings2)}
                {renderTabButton("visual", "MÔ PHỎNG BẾN", Anchor)}
                {renderTabButton("schedule", "KẾ HOẠCH BẾN", CalendarDays)}
                {renderTabButton("qc", "KẾ HOẠCH CẨU", ClipboardList)}
                {renderTabButton("summary", "BÁO CÁO", LayoutDashboard)}
                {renderTabButton("history", "LỊCH SỬ", History)}
            </div>
            {activeVessel && (
                <div className="flex gap-4 items-center flex-shrink-0 ml-4">
                    <div className="bg-[#002D54] text-white px-3 py-1 rounded-full text-[9px] font-black italic shadow-xl tracking-tighter uppercase">{activeVessel.type === 'barge' ? 'SÀ LAN' : 'TÀU'} ↔ Cọc #{String(bow?.id || '-')} - #{String(stern?.id || '-')}</div>
                    <div className="text-[9px] font-black text-slate-400 italic">User: {String(userId || '').slice(0,8)}</div>
                </div>
            )}
          </nav>
      )}

      <main className={`flex-1 overflow-hidden relative z-10 ${isPrintMode ? 'p-0 absolute inset-0 z-50 bg-white' : 'p-3'}`}>
        <div className="w-full h-full flex flex-col">
          
          {/* TAB 1: VISUAL MAP */}
          {activeTab === 'visual' && (<div className="flex-1 animate-in fade-in duration-300">{renderVesselMap()}</div>)}

          {/* TAB 2: SCHEDULE MAP */}
          {activeTab === 'schedule' && (<div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-300">{renderScheduleMap()}</div>)}

          {/* TAB 3: DỮ LIỆU TÀU */}
          {activeTab === 'vessel' && !isPrintMode && (
            <div className="h-full overflow-y-auto custom-scrollbar animate-in slide-in-from-left-4 duration-400 uppercase">
              {!activeVessel ? (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 max-w-6xl mx-auto mt-4 mb-8">
                      <div className="flex justify-between items-end border-b border-slate-200 pb-4 mb-6">
                          <div>
                              <h2 className="text-3xl font-black text-[#002D54] italic leading-none">DỮ LIỆU TÀU</h2>
                              <p className="text-sm font-bold text-blue-600 mt-1 tracking-widest uppercase">Chọn tàu trong danh sách để thêm vào biểu đồ</p>
                          </div>
                      </div>
                      <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100">
                          <div className="flex flex-col md:flex-row gap-3 md:items-center">
                              <div className="flex-1">
                                  <InputField
                                      label="Tìm tàu theo tên"
                                      value={vesselTabSearch}
                                      onChange={(v) => setVesselTabSearch(String(v || '').toUpperCase())}
                                      placeholder="Nhập tên tàu..."
                                      forceUpper={true}
                                  />
                              </div>
                              {vesselTabSearch && (
                                  <button
                                      onClick={() => setVesselTabSearch('')}
                                      className="px-3 py-2 mt-4 md:mt-0 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-black uppercase tracking-widest"
                                  >
                                      Xóa tìm
                                  </button>
                              )}
                          </div>
                          {vesselTabSearch && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                  {vesselSearchMatches.length > 0 ? vesselSearchMatches.map((v) => (
                                      <button
                                          key={`vessel-empty-search-hit-${String(v.name || '').toUpperCase()}`}
                                          onClick={() => {
                                              const selectedName = String(v.name || '').toUpperCase();
                                              setPendingAddVessel(v);
                                              setPendingAddVoyage(String(v.voyage || 'TBU').toUpperCase());
                                              setVesselTabSearch(selectedName);
                                          }}
                                          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors bg-white text-blue-700 border-blue-200 hover:bg-blue-100"
                                      >
                                          {String(v.name || '').toUpperCase()}
                                      </button>
                                  )) : (
                                      <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-slate-500">Không tìm thấy tàu phù hợp.</span>
                                          <button
                                              onClick={() => openCreateVesselFromSearch(vesselTabSearch)}
                                              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700"
                                          >
                                              + Tạo tàu mới
                                          </button>
                                      </div>
                                  )}
                              </div>
                          )}
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
                              <InputField
                                  label="CHUYẾN (VOYAGE)"
                                  value={pendingAddVoyage}
                                  disabled={false}
                                  onChange={(v) => setPendingAddVoyage(String(v || '').toUpperCase())}
                              />
                              <button
                                  onClick={() => {
                                      if (!pendingAddVessel) return;
                                      const newId = addVesselFromDB(pendingProfileDraft || pendingAddVessel, { voyage: pendingAddVoyage || 'TBU' });
                                      if (newId) setActiveVesselId(newId);
                                      setPendingAddVessel(null);
                                  }}
                                  disabled={!pendingAddVessel}
                                  className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                      pendingAddVessel
                                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  }`}
                              >
                                  ADD VÀO BIỂU ĐỒ
                              </button>
                          </div>
                          {pendingAddVessel && (
                              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-200">
                                      <h4 className="text-sm font-black text-emerald-800 italic tracking-widest">
                                          HỒ SƠ TÀU ĐÃ TÌM THẤY (CHƯA ADD VÀO BIỂU ĐỒ)
                                      </h4>
                                      <div className="flex items-center gap-2">
                                          {isPendingProfileUnlocked ? (
                                              <button onClick={() => setIsPendingProfileUnlocked(false)} className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 uppercase tracking-widest border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-sm">
                                                  <Unlock size={14}/> Đang mở khóa
                                              </button>
                                          ) : (
                                              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-inner">
                                                  <Lock size={14} className="text-slate-400 ml-1"/>
                                                  <input
                                                      type="password"
                                                      value={pendingProfilePin}
                                                      onChange={e => setPendingProfilePin(e.target.value)}
                                                      onKeyDown={async e => {
                                                          if (e.key !== 'Enter') return;
                                                          if (pendingProfilePin === '1506') { setIsPendingProfileUnlocked(true); setPendingProfilePin(''); }
                                                          else { await openAlertDialog({ title: 'Sai mã PIN', message: 'Sai mã PIN bảo mật!' }); setPendingProfilePin(''); }
                                                      }}
                                                      placeholder="PIN..."
                                                      autoComplete="new-password"
                                                      className="w-16 bg-transparent outline-none text-[11px] font-black text-center text-slate-700 placeholder-slate-300"
                                                  />
                                                  <button onClick={async () => {
                                                      if (pendingProfilePin === '1506') { setIsPendingProfileUnlocked(true); setPendingProfilePin(''); }
                                                      else { await openAlertDialog({ title: 'Sai mã PIN', message: 'Sai mã PIN bảo mật!' }); setPendingProfilePin(''); }
                                                  }} className="bg-blue-600 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-black hover:bg-blue-700 uppercase tracking-widest transition-colors shadow-md">Mở</button>
                                              </div>
                                          )}
                                          <button
                                              onClick={async () => {
                                                  if (!pendingProfileDraft) return;
                                                  if (!isPendingProfileUnlocked) {
                                                      setToastMsg('Cần nhập PIN để cập nhật hồ sơ tàu.');
                                                      setTimeout(() => setToastMsg(''), 2500);
                                                      return;
                                                  }
                                                  await persistVesselProfile(pendingProfileDraft);
                                                  setPendingAddVessel(pendingProfileDraft);
                                                  setToastMsg('Đã cập nhật hồ sơ tàu vào cơ sở dữ liệu.');
                                                  setTimeout(() => setToastMsg(''), 2600);
                                              }}
                                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${isPendingProfileUnlocked ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                          >
                                              Lưu hồ sơ
                                          </button>
                                          <button
                                              onClick={async () => {
                                                  if (!pendingProfileDraft?.name) return;
                                                  if (!isPendingProfileUnlocked) {
                                                      setToastMsg('Cần nhập PIN để xóa hồ sơ tàu.');
                                                      setTimeout(() => setToastMsg(''), 2500);
                                                      return;
                                                  }
                                                  const deleted = await deleteVesselProfileByName(pendingProfileDraft.name);
                                                  if (deleted) {
                                                      setPendingAddVessel(null);
                                                      setToastMsg('Đã xóa profile tàu khỏi cơ sở dữ liệu.');
                                                      setTimeout(() => setToastMsg(''), 2800);
                                                  }
                                              }}
                                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${isPendingProfileUnlocked ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                          >
                                              Xóa profile
                                          </button>
                                          <span className="text-[10px] font-black px-2 py-1 rounded bg-emerald-100 text-emerald-700 uppercase tracking-wide">
                                              {String(pendingAddVessel.name || '').toUpperCase()}
                                          </span>
                                      </div>
                                  </div>
                                  <div className="space-y-4 uppercase">
                                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                          <h5 className="text-[10px] font-black text-blue-700 tracking-widest mb-2">THÔNG TIN CƠ BẢN & NHẬN DIỆN</h5>
                                          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[10px] font-black">
                                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 md:col-span-2">
                                                  <p className="text-slate-400 mb-1">Vessel Name</p>
                                                  <input disabled={!isPendingProfileUnlocked} value={String(pendingProfileDraft?.name || '')} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), name: e.target.value }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                              </div>
                                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                  <p className="text-slate-400 mb-1">LOA (m)</p>
                                                  <input disabled={!isPendingProfileUnlocked} type="number" value={Math.round(Number(pendingProfileDraft?.loa || 0)) || ''} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), loa: Number(e.target.value || 0) }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                              </div>
                                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                  <p className="text-slate-400 mb-1">Độ rộng (m)</p>
                                                  <p className="text-slate-800 text-sm">{Math.round((Number((pendingProfileDraft?.width || (Number(pendingProfileDraft?.loa || 0) / 4.5)) || 0) * 10)) / 10 || '-'}</p>
                                              </div>
                                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                  <p className="text-slate-400 mb-1">Mũi-Cabin (m)</p>
                                                  <input disabled={!isPendingProfileUnlocked} type="number" value={Math.round(Number(pendingProfileDraft?.bowToCabin || 0)) || ''} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), bowToCabin: Number(e.target.value || 0) }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                              </div>
                                          </div>
                                          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                                              <h5 className="text-[10px] font-black text-emerald-800 tracking-widest mb-2">MÔ PHỎNG BERTH (LƯU PROFILE)</h5>
                                              <p className="text-[9px] text-slate-600 mb-2 leading-relaxed normal-case">Tâm cabin (Mũi–Cabin) + bề ngang cabin. Ống khói: mũi→tâm + rộng. <b className="text-emerald-800">Bay cuối = 0</b>: tự chia lưới theo LOA + cabin (ô 12m, khe 3m, khe cabin 3m). Nhập bay đầu/cuối chẵn để vẽ tuyến tính thủ công (ưu tiên hơn auto).</p>
                                              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px] font-black">
                                                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                                      <p className="text-slate-400 mb-1">Rộng cabin (m)</p>
                                                      <input disabled={!isPendingProfileUnlocked} type="number" step="0.1" value={Number(pendingProfileDraft?.cabinWidthM) || ''} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), cabinWidthM: Number(e.target.value || 0) }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                  </div>
                                                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                                      <p className="text-slate-400 mb-1">Mũi→tâm ống khói (m)</p>
                                                      <input disabled={!isPendingProfileUnlocked} type="number" value={Math.round(Number(pendingProfileDraft?.bowToFunnel || 0)) || ''} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), bowToFunnel: Number(e.target.value || 0) }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                  </div>
                                                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                                      <p className="text-slate-400 mb-1">Rộng ống khói (m)</p>
                                                      <input disabled={!isPendingProfileUnlocked} type="number" step="0.1" value={Number(pendingProfileDraft?.funnelWidthM) || ''} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), funnelWidthM: Number(e.target.value || 0) }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                  </div>
                                                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                                      <p className="text-slate-400 mb-1">Bay đầu (chẵn)</p>
                                                      <input disabled={!isPendingProfileUnlocked} type="number" value={Math.round(Number(pendingProfileDraft?.bayMarkFirstEven || 2)) || ''} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), bayMarkFirstEven: Number(e.target.value || 0) }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                  </div>
                                                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                                      <p className="text-slate-400 mb-1">Bay cuối (chẵn, 0=tắt)</p>
                                                      <input disabled={!isPendingProfileUnlocked} type="number" value={Math.round(Number(pendingProfileDraft?.bayMarkLastEven || 0)) || ''} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), bayMarkLastEven: Number(e.target.value || 0) }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                  </div>
                                                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 md:col-span-2">
                                                      <p className="text-slate-400 mb-1">Ô bay (m) / Khe bay (m) / Khe cabin (m)</p>
                                                      <div className="flex gap-1">
                                                          <input disabled={!isPendingProfileUnlocked} type="number" step="0.1" title="Chiều dài 1 ô ~40'" value={Number(pendingProfileDraft?.bayCellM) || ''} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), bayCellM: Number(e.target.value || 0) }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                          <input disabled={!isPendingProfileUnlocked} type="number" step="0.1" title="Khe giữa 2 bay" value={Number(pendingProfileDraft?.bayGapM) || ''} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), bayGapM: Number(e.target.value || 0) }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                          <input disabled={!isPendingProfileUnlocked} type="number" step="0.1" title="Khe cabin ↔ bay" value={Number(pendingProfileDraft?.cabinBayGapM) || ''} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), cabinBayGapM: Number(e.target.value || 0) }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                      </div>
                                                  </div>
                                                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 md:col-span-5">
                                                      <p className="text-slate-400 mb-1">Bay Operation (mũi→lái, cách phẩy — tự nhận từ tab Operation nếu trùng tên tàu)</p>
                                                      <input disabled={!isPendingProfileUnlocked} value={String(pendingProfileDraft?.operationDeckBays || '')} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), operationDeckBays: e.target.value }))} placeholder="02,06,10,14,…" className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                  </div>
                                                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 md:col-span-5 flex flex-wrap items-center gap-2">
                                                      <span className="text-slate-400 text-[10px] font-black uppercase tracking-tight">Cabin + ống khói</span>
                                                      <button
                                                        type="button"
                                                        disabled={!isPendingProfileUnlocked}
                                                        onClick={() => setPendingProfileDraft((prev) => normalizeMasterVesselProfile({ ...(prev || {}), cabinFunnelCombined: true, bowToFunnel: Math.round(Number(prev?.bowToCabin) || 0) }))}
                                                        className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${pendingProfileDraft?.cabinFunnelCombined !== false ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-50`}
                                                      >
                                                        Liền (1 vị trí)
                                                      </button>
                                                      <button
                                                        type="button"
                                                        disabled={!isPendingProfileUnlocked}
                                                        onClick={() => setPendingProfileDraft((prev) => normalizeMasterVesselProfile({ ...(prev || {}), cabinFunnelCombined: false }))}
                                                        className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${pendingProfileDraft?.cabinFunnelCombined === false ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-50`}
                                                      >
                                                        Tách (2 vị trí)
                                                      </button>
                                                      <span className="text-slate-400 text-[10px] font-black uppercase tracking-tight ml-1">Nhịp số bay (40′)</span>
                                                      <button
                                                        type="button"
                                                        disabled={!isPendingProfileUnlocked}
                                                        onClick={() => setPendingProfileDraft((prev) => normalizeMasterVesselProfile({ ...(prev || {}), bayNumberingScheme: BAY_SCHEME_SINGLE_01_04_08 }))}
                                                        className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${pendingProfileDraft?.bayNumberingScheme === BAY_SCHEME_PAIR_02_06_10 ? 'bg-slate-100 text-slate-600' : 'bg-emerald-600 text-white'} disabled:opacity-50`}
                                                      >
                                                        01→04→08…
                                                      </button>
                                                      <button
                                                        type="button"
                                                        disabled={!isPendingProfileUnlocked}
                                                        onClick={() => setPendingProfileDraft((prev) => normalizeMasterVesselProfile({ ...(prev || {}), bayNumberingScheme: BAY_SCHEME_PAIR_02_06_10 }))}
                                                        className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${pendingProfileDraft?.bayNumberingScheme === BAY_SCHEME_PAIR_02_06_10 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-50`}
                                                      >
                                                        02→06→10…
                                                      </button>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>

                                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                          <h5 className="text-[10px] font-black text-fuchsia-700 tracking-widest mb-2">TRANG THIẾT BỊ LÀM HÀNG</h5>
                                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[10px] font-black">
                                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                  <p className="text-slate-400 mb-1">Twistlock</p>
                                                  <input disabled={!isPendingProfileUnlocked} value={String(pendingProfileDraft?.twistlock || '')} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), twistlock: e.target.value }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                              </div>
                                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                  <p className="text-slate-400 mb-1">Reefer Motor</p>
                                                  <input disabled={!isPendingProfileUnlocked} value={String(pendingProfileDraft?.reeferMotor || '')} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), reeferMotor: e.target.value }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                              </div>
                                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                  <p className="text-slate-400 mb-1">Flip H/C</p>
                                                  <input disabled={!isPendingProfileUnlocked} value={String(pendingProfileDraft?.flipHC || '')} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), flipHC: e.target.value }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                              </div>
                                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                  <p className="text-slate-400 mb-1">Gear Boxes</p>
                                                  <input disabled={!isPendingProfileUnlocked} value={String(pendingProfileDraft?.gearBoxes || '')} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), gearBoxes: e.target.value }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                              </div>
                                          </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                              <h5 className="text-[10px] font-black text-amber-700 tracking-widest mb-2">THÔNG SỐ CHIỀU CAO (MÉT)</h5>
                                              <div className="grid grid-cols-1 gap-2 text-[10px] font-black">
                                                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                      <p className="text-slate-400 mb-1">Keel to Hatch Cover</p>
                                                      <input disabled={!isPendingProfileUnlocked} value={String(pendingProfileDraft?.keelToHatch || '')} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), keelToHatch: e.target.value }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                  </div>
                                                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                      <p className="text-slate-400 mb-1">Keel to Navigation Deck</p>
                                                      <input disabled={!isPendingProfileUnlocked} value={String(pendingProfileDraft?.keelToNav || '')} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), keelToNav: e.target.value }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                  </div>
                                                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                      <p className="text-slate-400 mb-1">Keel to Top Mast</p>
                                                      <input disabled={!isPendingProfileUnlocked} value={String(pendingProfileDraft?.keelToMast || '')} onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), keelToMast: e.target.value }))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-black text-slate-800 outline-none disabled:opacity-70" />
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-3">
                                              <h5 className="text-[10px] font-black text-rose-700 tracking-widest mb-2">GHI CHÚ QUAN TRỌNG (REMARK)</h5>
                                              <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 min-h-[120px]">
                                                  <textarea
                                                      disabled={!isPendingProfileUnlocked}
                                                      value={String(pendingProfileDraft?.remark || '')}
                                                      onChange={(e) => setPendingProfileDraft(prev => normalizeMasterVesselProfile({ ...(prev || {}), remark: e.target.value }))}
                                                      placeholder="Chưa có ghi chú hồ sơ tàu."
                                                      className="w-full min-h-[110px] bg-white outline-none text-[11px] font-bold text-slate-700 whitespace-pre-wrap normal-case resize-none disabled:opacity-70"
                                                  />
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              ) : (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 max-w-6xl mx-auto mt-4 mb-8">
                  <div className="flex justify-between items-end border-b border-slate-200 pb-4 mb-6">
                     <div>
                        <h2 className="text-3xl font-black text-[#002D54] italic leading-none">{String(activeVessel.name || 'UNKNOWN').toUpperCase()}</h2>
                        <p className="text-sm font-bold text-blue-600 mt-1 tracking-widest uppercase">{activeVessel.type === 'barge' ? 'HỒ SƠ SÀ LAN' : 'HỒ SƠ THÔNG SỐ TÀU (MASTER FILE)'}</p>
                     </div>
                     
                     <div className="flex items-center">
                         {isVesselUnlocked ? (
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsVesselUnlocked(false)} className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 uppercase tracking-widest border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-sm">
                                    <Unlock size={16}/> ĐANG MỞ KHÓA SỬA MÁY MÓC
                                </button>
                                <button
                                    onClick={() => {
                                        persistVesselProfile(activeVessel);
                                        setToastMsg('Đã lưu profile tàu thủ công vào cơ sở dữ liệu gốc.');
                                        setTimeout(() => setToastMsg(''), 3000);
                                    }}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-md"
                                >
                                    <Save size={14} /> LƯU PROFILE TÀU
                                </button>
                                <button
                                    onClick={async () => {
                                        const deleted = await deleteVesselProfileByName(activeVessel?.name);
                                        if (deleted) {
                                            setToastMsg('Đã xóa profile tàu khỏi cơ sở dữ liệu.');
                                            setTimeout(() => setToastMsg(''), 3000);
                                        }
                                    }}
                                    className="bg-rose-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-colors shadow-md"
                                >
                                    Xóa profile
                                </button>
                            </div>
                         ) : (
                             <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                                 <Lock size={16} className="text-slate-400 ml-2"/>
                                <input type="password" value={vesselPin} onChange={e => setVesselPin(e.target.value)} onKeyDown={async e => { if(e.key === 'Enter') { if(vesselPin === '1506') { setIsVesselUnlocked(true); setVesselPin(''); } else { await openAlertDialog({ title: 'Sai mã PIN', message: 'Sai mã PIN bảo mật!' }); setVesselPin(''); } } }} placeholder="MÃ PIN..." autoComplete="new-password" name={`vessel-pin-${appId}`} data-form-type="other" spellCheck={false} className="w-20 bg-transparent outline-none text-sm font-black text-center text-slate-700 placeholder-slate-300" />
                                <button onClick={async () => { if(vesselPin === '1506') { setIsVesselUnlocked(true); setVesselPin(''); } else { await openAlertDialog({ title: 'Sai mã PIN', message: 'Sai mã PIN bảo mật!' }); setVesselPin(''); } }} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-blue-700 uppercase tracking-widest transition-colors shadow-md">MỞ KHÓA</button>
                             </div>
                         )}
                     </div>
                  </div>

                  <div className="flex flex-col gap-6">
                      <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100">
                          <div className="flex flex-col md:flex-row gap-3 md:items-center">
                              <div className="flex-1">
                                  <InputField
                                      label="Tìm tàu theo tên"
                                      value={vesselTabSearch}
                                      onChange={(v) => setVesselTabSearch(String(v || '').toUpperCase())}
                                      placeholder="Nhập tên tàu..."
                                      forceUpper={true}
                                  />
                              </div>
                              {vesselTabSearch && (
                                  <button
                                      onClick={() => setVesselTabSearch('')}
                                      className="px-3 py-2 mt-4 md:mt-0 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-black uppercase tracking-widest"
                                  >
                                      Xóa tìm
                                  </button>
                              )}
                          </div>
                          {vesselTabSearch && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                  {vesselSearchMatches.length > 0 ? vesselSearchMatches.map((v) => (
                                      <button
                                          key={`vessel-search-hit-${String(v.name || '').toUpperCase()}`}
                                          onClick={() => {
                                              const selectedName = String(v.name || '').toUpperCase();
                                              const existingOnBerth = vessels.find(x => x && x.type === 'vessel' && String(x.name || '').toUpperCase() === selectedName);
                                              if (existingOnBerth) {
                                                  setActiveVesselId(existingOnBerth.id);
                                                  setPendingAddVessel(null);
                                              } else {
                                                  setPendingAddVessel(v);
                                                  setPendingAddVoyage(String(v.voyage || activeVessel?.voyage || 'TBU').toUpperCase());
                                                  setToastMsg(`Đã chọn "${selectedName}". Bấm "ADD VÀO BIỂU ĐỒ" để thêm.`);
                                                  setTimeout(() => setToastMsg(''), 2400);
                                              }
                                              setVesselTabSearch(selectedName);
                                          }}
                                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors ${
                                              (activeVessel && String(activeVessel.name || '').toUpperCase() === String(v.name || '').toUpperCase())
                                                  ? 'bg-blue-600 text-white border-blue-600'
                                                  : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                                          }`}
                                      >
                                          {String(v.name || '').toUpperCase()}
                                      </button>
                                  )) : (
                                      <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-slate-500">Không tìm thấy tàu phù hợp.</span>
                                          <button
                                              onClick={() => openCreateVesselFromSearch(vesselTabSearch)}
                                              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700"
                                          >
                                              + Tạo tàu mới
                                          </button>
                                      </div>
                                  )}
                              </div>
                          )}
                          {pendingAddVessel && (
                              <div className="mt-3 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-[10px] font-black text-amber-700 tracking-wide uppercase flex items-center justify-between gap-2">
                                  <span>Chờ thêm vào biểu đồ: {String(pendingAddVessel.name || '').toUpperCase()}</span>
                                  <button
                                      onClick={() => setPendingAddVessel(null)}
                                      className="px-2 py-1 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-100"
                                  >
                                      Bỏ chọn
                                  </button>
                              </div>
                          )}
                      </div>
                      
                      {/* NHÓM 2: LỊCH TRÌNH */}
                      <div className="bg-emerald-50/30 p-6 rounded-3xl border border-emerald-100 flex flex-col gap-5">
                          <div className="flex justify-between items-center border-b border-emerald-200 pb-2">
                              <h4 className="text-xs font-black text-emerald-800 italic tracking-widest flex items-center gap-2">
                                  <Navigation size={16}/> THÔNG TIN CHUYẾN (ĐƯỢC CHỈNH SỬA TỰ DO)
                              </h4>
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase font-black tracking-widest">Thay đổi theo chuyến</span>
                          </div>
                          
                          <div className="grid grid-cols-12 gap-5">
                              <div className="col-span-12 md:col-span-3">
                                  <div className="flex items-end gap-2">
                                      <div className="flex-1">
                                          <InputField
                                              label="CHUYẾN (VOYAGE)"
                                              value={pendingAddVessel ? pendingAddVoyage : activeVessel.voyage}
                                              disabled={false}
                                              onChange={(v) => {
                                                  const normalizedVoyage = String(v).toUpperCase();
                                                  if (pendingAddVessel) {
                                                      setPendingAddVoyage(normalizedVoyage);
                                                      return;
                                                  }
                                                  updateActiveVessel({ voyage: normalizedVoyage });
                                              }}
                                          />
                                      </div>
                                      <button
                                          onClick={() => {
                                              if (!pendingAddVessel) return;
                                              const newId = addVesselFromDB(pendingAddVessel, { voyage: pendingAddVoyage || 'TBU' });
                                              if (newId) setActiveVesselId(newId);
                                              setPendingAddVessel(null);
                                          }}
                                          disabled={!pendingAddVessel}
                                          className={`mb-0.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                              pendingAddVessel
                                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                          }`}
                                      >
                                          ADD VÀO BIỂU ĐỒ
                                      </button>
                                  </div>
                              </div>
                              <div className="col-span-12 md:col-span-3">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">HƯỚNG CẬP</label>
                                  <div className="flex gap-2">
                                      {['THƯỢNG LƯU', 'HẠ LƯU'].map((direction) => (
                                          <button
                                              key={`dir-${direction}`}
                                              onPointerDown={(e) => {
                                                  if (e.pointerType === 'touch') e.preventDefault();
                                                  updateActiveVessel({ direction });
                                              }}
                                              onClick={() => updateActiveVessel({ direction })}
                                              className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
                                                  String(activeVessel.direction || '').toUpperCase() === direction
                                                      ? 'bg-emerald-600 text-white shadow-md'
                                                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                              }`}
                                          >
                                              {direction}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              <div className="col-span-6 md:col-span-3">
                                  <InputField label="CẬP DỰ KIẾN (ETA)" type="datetime-local" value={activeVessel.eta || ''} disabled={false} onChange={(v) => updateActiveVessel({ eta: v })} />
                              </div>
                              <div className="col-span-6 md:col-span-3">
                                  <InputField label="RỜI DỰ KIẾN (ETD)" type="datetime-local" value={activeVessel.etd || ''} disabled={false} onChange={(v) => updateActiveVessel({ etd: v })} />
                              </div>
                              <div className="col-span-12 md:col-span-3">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">MẠN CẬP</label>
                                  <div className="flex gap-2">
                                      {[
                                          { id: 'SB', label: 'MẠN PHẢI (SB)' },
                                          { id: 'PS', label: 'MẠN TRÁI (PS)' }
                                      ].map((sideOption) => (
                                          <button
                                              key={`side-${sideOption.id}`}
                                              onPointerDown={(e) => {
                                                  if (e.pointerType === 'touch') e.preventDefault();
                                                  updateActiveVessel({ side: sideOption.id });
                                              }}
                                              onClick={() => updateActiveVessel({ side: sideOption.id })}
                                              className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
                                                  String(activeVessel.side || '').toUpperCase() === sideOption.id
                                                      ? 'bg-blue-600 text-white shadow-md'
                                                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                              }`}
                                          >
                                              {sideOption.label}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              <div className="col-span-12">
                                  {(() => {
                                      const bow = Number(activeVessel.bowPos || 0);
                                      const stern = Number(activeVessel.sternPos || 0);
                                      const loa = Math.max(1, Number(activeVessel.loa || (stern - bow) || 1));
                                      const isPs = String(activeVessel.side || '').toUpperCase() === 'PS';
                                      const draftActive =
                                          isVesselUnlocked &&
                                          miniLayoutDraft &&
                                          miniLayoutDraft.vesselId === activeVessel.id &&
                                          activeVessel.type === 'vessel';
                                      const hasBowCabin = Number.isFinite(Number(activeVessel.bowToCabin));
                                      const bowCabinDistFromVessel = hasBowCabin
                                          ? Number(activeVessel.bowToCabin)
                                          : Math.max(0, Number(activeVessel.cabinPos || 0) - bow);
                                      const bowCabinDist = draftActive ? miniLayoutDraft.bowToCabin : bowCabinDistFromVessel;
                                      const bowCabinSafe = Math.max(0, Math.min(loa, bowCabinDist));
                                      const displayCabinPos = isPs
                                          ? Math.round(stern - bowCabinSafe)
                                          : Math.round(bow + bowCabinSafe);
                                      const rawCabinRatioFromLeft = isPs
                                          ? (bowCabinSafe / loa) * 100
                                          : ((loa - bowCabinSafe) / loa) * 100;
                                      const cabinRatio = Math.max(8, Math.min(92, rawCabinRatioFromLeft));
                                      const funnelBtfSaved = Math.max(0, Math.min(loa - 5, Math.round(Number(activeVessel.bowToFunnel) || 0)));
                                      const funnelBtf = draftActive ? miniLayoutDraft.bowToFunnel : funnelBtfSaved;
                                      const funnelGhost = draftActive && funnelBtf <= 0;
                                      const rawFunnelRatioFromLeft =
                                          funnelBtf > 0
                                              ? isPs
                                                  ? (funnelBtf / loa) * 100
                                                  : ((loa - funnelBtf) / loa) * 100
                                              : isPs
                                                  ? 42
                                                  : 58;
                                      const funnelRatio = Math.max(8, Math.min(92, rawFunnelRatioFromLeft));
                                      const startMiniDrag = (kind, e) => {
                                          if (!draftActive) return;
                                          if (e.pointerType === 'touch') e.preventDefault();
                                          miniLayoutDragRef.current.kind = kind;
                                      };
                                      const cellMini = Number(activeVessel.bayCellM) || 12;
                                      const gapMini = Number(activeVessel.bayGapM) || 2.5;
                                      const cargoPack = computeCargoBayPackInFraction(loa, cellMini, gapMini, VESSEL_CARGO_LENGTH_FRACTION);
                                      const opListMini = parseOperationDeckBaysString(activeVessel.operationDeckBays);
                                      const combinedSf = activeVessel.cabinFunnelCombined !== false;
                                      const schEl =
                                          activeVessel.bayNumberingScheme === BAY_SCHEME_PAIR_02_06_10
                                              ? BAY_SCHEME_PAIR_02_06_10
                                              : BAY_SCHEME_SINGLE_01_04_08;
                                      const cabWmMini = Number(activeVessel.cabinWidthM) || 10;
                                      const funWmMini = Number(activeVessel.funnelWidthM) || 8;
                                      const elevVBH = 58;
                                      const manyOpBays = opListMini.length >= 12;
                                      const bowEndClrElev = manyOpBays
                                          ? Math.max(0.1, loa * 0.003)
                                          : Math.max(0.35, loa * 0.006);
                                      const sternEndClrElev = manyOpBays
                                          ? Math.max(0.1, loa * 0.003)
                                          : Math.max(0.35, loa * 0.006);
                                      const deckClearElev = elevationInterBayGapM(activeVessel.cabinBayGapM);
                                      /** Ưu tiên đúng số bay từ Operation (BAY OPERATION); không dùng ngân sách 72% LOA khi đã có danh sách. */
                                      const elevTargetNBays =
                                          opListMini.length > 0
                                              ? opListMini.length
                                              : Math.max(1, Math.round(Number(cargoPack.nBays) || 1));
                                      const elevAlign =
                                          opListMini.length >= 2
                                              ? buildElevationSlotsOperationAligned({
                                                    loaM: loa,
                                                    opListBowToStern: opListMini,
                                                    vessel: activeVessel,
                                                    deckClearM: deckClearElev
                                                })
                                              : null;
                                      const useOpAlignedElev =
                                          elevAlign &&
                                          Array.isArray(elevAlign.slots) &&
                                          elevAlign.slots.length === opListMini.length &&
                                          opListMini.length >= 2;
                                      let elevBaySlots;
                                      if (useOpAlignedElev) {
                                          elevBaySlots = elevAlign.slots;
                                      } else {
                                          const elevForbiddenS = superstructureForbiddenSFromBow(
                                              loa,
                                              bowCabinSafe,
                                              cabWmMini,
                                              funnelBtf,
                                              funWmMini,
                                              combinedSf,
                                              !combinedSf && funnelBtf > 0,
                                              deckClearElev
                                          );
                                          elevBaySlots = packElevationBaySlotsFromBow(
                                              loa,
                                              elevTargetNBays,
                                              cellMini,
                                              gapMini,
                                              elevForbiddenS,
                                              bowEndClrElev,
                                              sternEndClrElev
                                          );
                                      }
                                      /** Khi có BAY OPERATION: cabin/khói đặt đúng khe giữa hai bay như Operation (mũi ~12 m trước ô đầu). */
                                      const cabinCenterElev = useOpAlignedElev ? elevAlign.cabinCenterS : bowCabinSafe;
                                      const funnelCenterElev =
                                          useOpAlignedElev && !combinedSf && funnelBtf > 0 ? elevAlign.funnelCenterS : funnelBtf;
                                      const cabinRatioForMini = useOpAlignedElev
                                          ? Math.max(8, Math.min(92, pctFromLeftFromDistFromBowMini(cabinCenterElev, loa, isPs)))
                                          : cabinRatio;
                                      const funnelRatioForMini =
                                          useOpAlignedElev && !combinedSf && funnelBtf > 0
                                              ? Math.max(8, Math.min(92, pctFromLeftFromDistFromBowMini(funnelCenterElev, loa, isPs)))
                                              : funnelRatio;
                                      const yDeck = 27;
                                      const yKeel = 41;
                                      /** Mặt nước (mũi phải x=LOA): thân đen trên WL, đỏ dưới WL; lái vuông; quả lê rõ dưới nước. */
                                      const yWL = yDeck + (yKeel - yDeck) * 0.42;
                                      const yForecastle = yDeck - 3.15;
                                      const yStemWl = yWL - 0.42;
                                      const xRunAft = Math.max(2.8, loa * 0.036);
                                      const xFlatEnd = loa * 0.828;
                                      const bulbNoseY = yKeel + Math.min(3.55, Math.max(2.05, loa * 0.013));
                                      const hullPathElev = `M 0 ${yDeck} L 0 ${yWL + 0.32} C ${loa * 0.012} ${yWL + 1.85} ${xRunAft * 0.48} ${yKeel + 0.55} ${xRunAft} ${yKeel + 0.04} L ${xFlatEnd} ${yKeel + 0.04} C ${loa * 0.862} ${yKeel + 0.1} ${loa * 0.898} ${bulbNoseY - 0.55} ${loa * 0.944} ${bulbNoseY} C ${loa * 0.981} ${bulbNoseY - 0.95} ${loa} ${yWL + 1.05} ${loa} ${yStemWl} L ${loa} ${yForecastle} C ${loa * 0.972} ${yDeck - 1.35} ${loa * 0.915} ${yDeck - 0.02} ${loa * 0.848} ${yDeck} L 0 ${yDeck} Z`;
                                      const hullGradTop = yForecastle - 1.2;
                                      const hullGradBot = yKeel + 2.2;
                                      const hullWlOffsetPct = Math.max(
                                          22,
                                          Math.min(
                                              72,
                                              ((yWL - hullGradTop) / Math.max(1e-6, hullGradBot - hullGradTop)) * 100
                                          )
                                      );
                                      const hullGradId = `hullElev-${svgSafeId(activeVessel.id)}`;
                                      const seaGradId = `elev-sea-${svgSafeId(activeVessel.id)}`;
                                      const skyGradId = `elev-sky-${svgSafeId(activeVessel.id)}`;
                                      return (
                                          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-inner">
                                              <div className="flex items-center justify-between mb-3">
                                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mô phỏng mặt cắt ngang (nhìn từ mạn)</span>
                                                  <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                                                      {String(activeVessel.direction || 'THƯỢNG LƯU').toUpperCase()} | {isPs ? 'MẠN TRÁI (PS)' : 'MẠN PHẢI (SB)'}
                                                  </span>
                                              </div>
                                              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                                  <div className="flex flex-wrap items-center gap-2">
                                                      <span className="text-[9px] font-black text-slate-500 uppercase">Cabin & ống khói</span>
                                                      <button
                                                          type="button"
                                                          disabled={!isVesselUnlocked}
                                                          onClick={() => {
                                                              const btc = Number(activeVessel.bowToCabin) || 0;
                                                              updateActiveVessel({ cabinFunnelCombined: true, bowToFunnel: btc });
                                                          }}
                                                          className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${combinedSf ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-50`}
                                                      >
                                                          Liền (1 vị trí)
                                                      </button>
                                                      <button
                                                          type="button"
                                                          disabled={!isVesselUnlocked}
                                                          onClick={() => updateActiveVessel({ cabinFunnelCombined: false })}
                                                          className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${!combinedSf ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-50`}
                                                      >
                                                          Tách (2 vị trí)
                                                      </button>
                                                  </div>
                                                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0 sm:pl-3 sm:border-l">
                                                      <span className="text-[9px] font-black text-slate-500 uppercase">Nhịp số bay 40&apos;</span>
                                                      <button
                                                          type="button"
                                                          disabled={!isVesselUnlocked}
                                                          onClick={() => updateActiveVessel({ bayNumberingScheme: BAY_SCHEME_SINGLE_01_04_08 })}
                                                          className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${schEl === BAY_SCHEME_SINGLE_01_04_08 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-50`}
                                                      >
                                                          01→04→08…
                                                      </button>
                                                      <button
                                                          type="button"
                                                          disabled={!isVesselUnlocked}
                                                          onClick={() => updateActiveVessel({ bayNumberingScheme: BAY_SCHEME_PAIR_02_06_10 })}
                                                          className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${schEl === BAY_SCHEME_PAIR_02_06_10 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-50`}
                                                      >
                                                          02→06→10…
                                                      </button>
                                                  </div>
                                              </div>
                                              <p className="mb-2 text-[8px] font-semibold text-slate-600 normal-case leading-relaxed">
                                                  ~{Math.round(VESSEL_CARGO_LENGTH_FRACTION * 100)}% LOA lưới ô ({cellMini}m + khe {gapMini}m): tham chiếu <strong>{cargoPack.nBays}</strong> ô (~{Math.round(cargoPack.cargoUsedM)}m); phần còn ~{Math.round(cargoPack.structureBudgetM)}m (cabin/khói/hở).
                                                  {opListMini.length > 0 ? (
                                                      <span>
                                                          {' '}
                                                          Mặt cắt: <strong>{elevTargetNBays}</strong> ô theo <strong>BAY OPERATION</strong> ({opListMini.length} mũi→lái).
                                                      </span>
                                                  ) : (
                                                      <span> Mặt cắt: <strong>{elevTargetNBays}</strong> ô.</span>
                                                  )}
                                                  {' '}
                                                  {useOpAlignedElev ? (
                                                      <>
                                                          Có <strong>BAY OPERATION</strong>: khe cabin/ống khói trùng lựa chọn trên tab Operation (Giữa bay…); khoảng trống mũi trước ô đầu{' '}
                                                          <strong>{VESSEL_ELEVATION_FORECASTLE_M}m</strong> (forecastle / quả lê); lái vuông, bay cuối sát đuôi. Khe ô:{' '}
                                                          <strong>{elevationInterBayGapM(gapMini).toFixed(1)}m</strong>; chiều dài ô 40′ co giãn theo LOA. 1 đơn vị ngang = 1m.
                                                      </>
                                                  ) : (
                                                      <>
                                                          Khe cabin/khói ↔ dải ô: <strong>{deckClearElev.toFixed(1)}m</strong> mỗi bên (tối thiểu {VESSEL_ELEVATION_CHART_GAP_M}m như Operation). Khe <strong>giữa các ô</strong>:{' '}
                                                          <strong>{elevationInterBayGapM(gapMini).toFixed(1)}m</strong>. Xếp theo đoạn deck trống (mũi→lái). 1 đơn vị ngang = 1m.
                                                      </>
                                                  )}{' '}
                                                  Nhãn: ưu tiên BAY OPERATION; số lẻ = 20′, chẵn = 40′ — tooltip trên ô.
                                                  {elevBaySlots.length > 0 && elevBaySlots.length < elevTargetNBays ? (
                                                      <span className="block mt-0.5 text-amber-700 font-bold">
                                                          Chỉ vẽ được <strong>{elevBaySlots.length}</strong> / {elevTargetNBays} ô trên LOA (hết chỗ về lái sau superstructure — kiểm tra LOA, cabin/khói, khe).
                                                      </span>
                                                  ) : null}
                                              </p>
                                                  {draftActive && (
                                                  <p className="mb-2 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                                      {combinedSf
                                                          ? 'Kéo CAB+KHÓI (một điểm), rồi Lưu.'
                                                          : 'Kéo CABIN (luôn gần mũi hơn ống khói) và ỐNG KHÓI riêng, rồi Lưu.'}
                                                  </p>
                                              )}
                                              <div
                                                  ref={miniShipTrackRef}
                                                  className={`relative w-full rounded-xl border border-blue-200 bg-slate-100 overflow-hidden ${draftActive ? 'ring-1 ring-blue-300/60' : ''}`}
                                              >
                                                  <div
                                                      className="relative mx-auto w-full"
                                                      style={{ aspectRatio: `${loa} / ${elevVBH}`, maxHeight: '11rem' }}
                                                  >
                                                      <svg
                                                          viewBox={`0 0 ${loa} ${elevVBH}`}
                                                          preserveAspectRatio="none"
                                                          className={`pointer-events-none absolute inset-0 h-full w-full ${isPs ? '-scale-x-100' : ''}`}
                                                      >
                                                          <defs>
                                                              <linearGradient id={skyGradId} x1="0" y1="0" x2="0" y2="1">
                                                                  <stop offset="0%" stopColor="#e0f2fe" stopOpacity={0.95} />
                                                                  <stop offset="100%" stopColor="#f8fafc" stopOpacity={0.5} />
                                                              </linearGradient>
                                                              <linearGradient id={seaGradId} x1="0" y1="0" x2="0" y2="1">
                                                                  <stop offset="0%" stopColor="#0ea5e9" />
                                                                  <stop offset="55%" stopColor="#0284c7" />
                                                                  <stop offset="100%" stopColor="#0c4a6e" />
                                                              </linearGradient>
                                                              <linearGradient
                                                                  id={hullGradId}
                                                                  gradientUnits="userSpaceOnUse"
                                                                  x1={0}
                                                                  y1={hullGradTop}
                                                                  x2={0}
                                                                  y2={hullGradBot}
                                                              >
                                                                  <stop offset="0%" stopColor="#525252" />
                                                                  <stop offset={`${Math.max(8, hullWlOffsetPct - 8)}%`} stopColor="#262626" />
                                                                  <stop offset={`${Math.max(10, hullWlOffsetPct - 1)}%`} stopColor="#171717" />
                                                                  <stop offset={`${Math.min(90, hullWlOffsetPct + 2)}%`} stopColor="#991b1b" />
                                                                  <stop offset="100%" stopColor="#450a0a" />
                                                              </linearGradient>
                                                          </defs>
                                                          <rect x={0} y={0} width={loa} height={Math.max(0, yWL - 3)} fill={`url(#${skyGradId})`} />
                                                          <rect
                                                              x={0}
                                                              y={yWL - 0.35}
                                                              width={loa}
                                                              height={elevVBH - yWL + 4}
                                                              fill={`url(#${seaGradId})`}
                                                              opacity={0.92}
                                                          />
                                                          <path
                                                              d={hullPathElev}
                                                              fill={`url(#${hullGradId})`}
                                                              stroke="#0a0a0a"
                                                              strokeWidth={Math.max(0.14, loa / 900)}
                                                              strokeLinejoin="round"
                                                          />
                                                          <line
                                                              x1={0}
                                                              x2={loa}
                                                              y1={yWL}
                                                              y2={yWL}
                                                              stroke="#f1f5f9"
                                                              strokeWidth={Math.max(0.18, loa / 2200)}
                                                              strokeOpacity={0.9}
                                                          />
                                                          <path
                                                              d={`M ${xRunAft * 0.35} ${yWL + 1.05} L ${xRunAft * 0.15} ${yKeel + 0.55} L ${xRunAft * 0.92} ${yKeel + 0.52} L ${xRunAft * 0.78} ${yWL + 0.85} Z`}
                                                              fill="#334155"
                                                              stroke="#0f172a"
                                                              strokeWidth={0.1}
                                                              opacity={0.95}
                                                          />
                                                          <ellipse
                                                              cx={xRunAft * 0.52}
                                                              cy={yWL + 2.35}
                                                              rx={Math.max(0.55, loa * 0.004)}
                                                              ry={1.15}
                                                              fill="#475569"
                                                              stroke="#1e293b"
                                                              strokeWidth={0.08}
                                                              opacity={0.9}
                                                          />
                                                          <line
                                                              x1={loa * 0.9}
                                                              y1={yForecastle + 0.2}
                                                              x2={loa * 0.9}
                                                              y2={yDeck - 14.5}
                                                              stroke="#1e293b"
                                                              strokeWidth={Math.max(0.2, loa / 1400)}
                                                              strokeLinecap="round"
                                                          />
                                                          <path
                                                              d={`M ${loa * 0.9} ${yDeck - 14.5} L ${loa * 0.905} ${yDeck - 15.6} L ${loa * 0.895} ${yDeck - 15.6} Z`}
                                                              fill="#64748b"
                                                          />
                                                          <line
                                                              x1={loa * 0.06}
                                                              y1={yDeck - 0.4}
                                                              x2={loa * 0.06}
                                                              y2={yDeck - 8.2}
                                                              stroke="#475569"
                                                              strokeWidth={Math.max(0.18, loa / 1600)}
                                                              strokeLinecap="round"
                                                          />
                                                          <path
                                                              d={`M 0 ${yDeck - 0.15} L ${loa * 0.84} ${yDeck - 0.15} Q ${loa * 0.91} ${yDeck - 0.35} ${loa * 0.97} ${yForecastle + 0.5}`}
                                                              fill="none"
                                                              stroke="rgba(248,250,252,0.65)"
                                                              strokeWidth={Math.max(0.35, loa / 700)}
                                                              strokeLinecap="round"
                                                          />
                                                          <line
                                                              x1={0}
                                                              x2={loa}
                                                              y1={yDeck}
                                                              y2={yDeck}
                                                              stroke="#cbd5e1"
                                                              strokeWidth={0.28}
                                                              opacity={0.95}
                                                          />
                                                          <text
                                                              x={isPs ? -(loa / 2) : loa / 2}
                                                              y={yDeck - 10}
                                                              transform={isPs ? 'scale(-1, 1)' : undefined}
                                                              fill="#f8fafc"
                                                              stroke="#0f172a"
                                                              strokeWidth={0.12}
                                                              paintOrder="stroke fill"
                                                              fontSize={Math.max(2.2, loa / 70)}
                                                              fontWeight="800"
                                                              textAnchor="middle"
                                                              style={{ fontFamily: 'system-ui,sans-serif' }}
                                                          >
                                                              {String(activeVessel.name || '').toUpperCase()} · LOA {Math.round(loa)}M
                                                          </text>
                                                          {elevBaySlots.length > 0 &&
                                                              elevBaySlots.map((slot) => {
                                                                  const i = slot.seqIndex;
                                                                  const { xL, xR } = slot;
                                                                  const bw = Math.max(0.2, xR - xL);
                                                                  const tiers = Math.min(6, 4 + (i % 3) + (elevTargetNBays > 14 ? 1 : 0));
                                                                  const th = 2.05;
                                                                  const bayTxt = opListMini[i]
                                                                      ? opListMini[i]
                                                                      : String(
                                                                            Math.min(
                                                                                99,
                                                                                Math.max(1, bayNumericFromScheme40ft(i, schEl))
                                                                            )
                                                                        ).padStart(2, '0');
                                                                  const yLblStagger = elevVBH - 3.2 - (i % 2) * 2.4;
                                                                  const fsLbl = Math.max(1.05, Math.min(1.9, loa / 150));
                                                                  const baseCol = elevationContainerFill(i);
                                                                  return (
                                                                      <g key={`elev-bay-${activeVessel.id}-${i}`}>
                                                                          <title>{elevationBayFootprintHint(bayTxt)}</title>
                                                                          {Array.from({ length: tiers }).map((__, t) => (
                                                                              <g key={`elev-t-${i}-${t}`}>
                                                                                  <rect
                                                                                      x={xL + 0.18}
                                                                                      y={yDeck - (t + 1) * th}
                                                                                      width={bw - 0.36}
                                                                                      height={th - 0.08}
                                                                                      rx={0.12}
                                                                                      fill={baseCol}
                                                                                      stroke="#1e293b"
                                                                                      strokeWidth={0.09}
                                                                                  />
                                                                                  <rect
                                                                                      x={xL + 0.35}
                                                                                      y={yDeck - (t + 1) * th + 0.12}
                                                                                      width={bw - 0.7}
                                                                                      height={Math.max(0.15, th * 0.22)}
                                                                                      rx={0.06}
                                                                                      fill="rgba(255,255,255,0.28)"
                                                                                  />
                                                                              </g>
                                                                          ))}
                                                                          <text
                                                                              x={isPs ? -((xL + xR) / 2) : (xL + xR) / 2}
                                                                              y={yLblStagger}
                                                                              transform={isPs ? 'scale(-1, 1)' : undefined}
                                                                              fill="#0f172a"
                                                                              fontSize={fsLbl}
                                                                              fontWeight="800"
                                                                              textAnchor="middle"
                                                                              style={{ fontFamily: 'system-ui,sans-serif' }}
                                                                          >
                                                                              {bayTxt}
                                                                          </text>
                                                                      </g>
                                                                  );
                                                              })}
                                                          <line
                                                              x1={loa - 0.65}
                                                              y1={yDeck - 12}
                                                              x2={loa - 0.65}
                                                              y2={yDeck}
                                                              stroke="#e2e8f0"
                                                              strokeWidth={0.4}
                                                              strokeLinecap="round"
                                                          />
                                                          <line
                                                              x1={loa - 3.2}
                                                              y1={yDeck - 9.5}
                                                              x2={loa - 0.65}
                                                              y2={yDeck - 9.5}
                                                              stroke="#cbd5e1"
                                                              strokeWidth={0.22}
                                                          />
                                                          {combinedSf ? (() => {
                                                              const combW = Math.max(cabWmMini, funWmMini) + 2;
                                                              const combLeft = loa - cabinCenterElev - combW / 2;
                                                              const funWpart = Math.min(funWmMini + 0.8, combW * 0.32);
                                                              const cabWpart = combW - funWpart;
                                                              const cabLeftP = combLeft + funWpart;
                                                              const nWinCol = Math.max(2, Math.min(8, Math.floor(cabWpart / 2.2)));
                                                              const nWinRow = 3;
                                                              return (
                                                                  <g>
                                                                      <rect
                                                                          x={combLeft}
                                                                          y={yDeck - 17}
                                                                          width={funWpart}
                                                                          height={17}
                                                                          rx={0.55}
                                                                          fill="#292524"
                                                                          stroke="#0c0a09"
                                                                          strokeWidth={0.18}
                                                                      />
                                                                      <rect
                                                                          x={combLeft + funWpart * 0.12}
                                                                          y={yDeck - 14}
                                                                          width={funWpart * 0.76}
                                                                          height={3.2}
                                                                          rx={0.2}
                                                                          fill="#ea580c"
                                                                      />
                                                                      <rect
                                                                          x={combLeft + funWpart * 0.22}
                                                                          y={yDeck - 17.5}
                                                                          width={funWpart * 0.56}
                                                                          height={2.8}
                                                                          rx={0.35}
                                                                          fill="#f97316"
                                                                          stroke="#c2410c"
                                                                          strokeWidth={0.08}
                                                                      />
                                                                      <rect
                                                                          x={cabLeftP}
                                                                          y={yDeck - 17}
                                                                          width={cabWpart}
                                                                          height={17}
                                                                          rx={0.65}
                                                                          fill="#f8fafc"
                                                                          stroke="#334155"
                                                                          strokeWidth={0.22}
                                                                      />
                                                                      {[1, 2, 3].map((d) => (
                                                                          <line
                                                                              key={`comb-h-${d}`}
                                                                              x1={cabLeftP + 0.35}
                                                                              x2={cabLeftP + cabWpart - 0.35}
                                                                              y1={yDeck - 17 + (d * 17) / 4}
                                                                              y2={yDeck - 17 + (d * 17) / 4}
                                                                              stroke="#cbd5e1"
                                                                              strokeWidth={0.12}
                                                                          />
                                                                      ))}
                                                                      {Array.from({ length: nWinRow * nWinCol }).map((__, k) => {
                                                                          const r = Math.floor(k / nWinCol);
                                                                          const c = k % nWinCol;
                                                                          return (
                                                                              <rect
                                                                                  key={`comb-w-${k}`}
                                                                                  x={
                                                                                      cabLeftP +
                                                                                      0.55 +
                                                                                      (c * (cabWpart - 1.1)) / Math.max(1, nWinCol - 1)
                                                                                  }
                                                                                  y={yDeck - 15.2 + r * 3.6}
                                                                                  width={0.75}
                                                                                  height={1.35}
                                                                                  rx={0.06}
                                                                                  fill="#64748b"
                                                                                  opacity={0.88}
                                                                              />
                                                                          );
                                                                      })}
                                                                      <text
                                                                          x={isPs ? -(loa - cabinCenterElev) : loa - cabinCenterElev}
                                                                          y={yDeck - 5.5}
                                                                          transform={isPs ? 'scale(-1, 1)' : undefined}
                                                                          fill="#0f172a"
                                                                          fontSize={Math.max(1.5, loa / 88)}
                                                                          fontWeight="800"
                                                                          textAnchor="middle"
                                                                          style={{ fontFamily: 'system-ui,sans-serif' }}
                                                                      >
                                                                          CAB · KHÓI
                                                                      </text>
                                                                  </g>
                                                              );
                                                          })() : (
                                                              <g>
                                                                  {(() => {
                                                                      const cabLeft = loa - cabinCenterElev - cabWmMini / 2;
                                                                      const cabH = 16;
                                                                      const cabTop = yDeck - cabH;
                                                                      const nWinCol = Math.max(2, Math.min(8, Math.floor(cabWmMini / 2.2)));
                                                                      const nWinRow = 3;
                                                                      return (
                                                                          <>
                                                                              <rect
                                                                                  x={cabLeft}
                                                                                  y={cabTop}
                                                                                  width={cabWmMini}
                                                                                  height={cabH}
                                                                                  rx={0.65}
                                                                                  fill="#f8fafc"
                                                                                  stroke="#334155"
                                                                                  strokeWidth={0.22}
                                                                              />
                                                                              {[1, 2, 3].map((d) => (
                                                                                  <line
                                                                                      key={`cab-h-${d}`}
                                                                                      x1={cabLeft + 0.35}
                                                                                      x2={cabLeft + cabWmMini - 0.35}
                                                                                      y1={cabTop + (d * cabH) / 4}
                                                                                      y2={cabTop + (d * cabH) / 4}
                                                                                      stroke="#cbd5e1"
                                                                                      strokeWidth={0.12}
                                                                                  />
                                                                              ))}
                                                                              {Array.from({ length: nWinRow * nWinCol }).map((__, k) => {
                                                                                  const r = Math.floor(k / nWinCol);
                                                                                  const c = k % nWinCol;
                                                                                  return (
                                                                                      <rect
                                                                                          key={`cab-w-${k}`}
                                                                                          x={
                                                                                              cabLeft +
                                                                                              0.55 +
                                                                                              (c * (cabWmMini - 1.1)) / Math.max(1, nWinCol - 1)
                                                                                          }
                                                                                          y={cabTop + 1.8 + r * 3.5}
                                                                                          width={0.75}
                                                                                          height={1.35}
                                                                                          rx={0.06}
                                                                                          fill="#64748b"
                                                                                          opacity={0.88}
                                                                                      />
                                                                                  );
                                                                              })}
                                                                              <text
                                                                                  x={isPs ? -(loa - cabinCenterElev) : loa - cabinCenterElev}
                                                                                  y={yDeck - 4.5}
                                                                                  transform={isPs ? 'scale(-1, 1)' : undefined}
                                                                                  fill="#0f172a"
                                                                                  fontSize={Math.max(1.55, loa / 85)}
                                                                                  fontWeight="800"
                                                                                  textAnchor="middle"
                                                                                  style={{ fontFamily: 'system-ui,sans-serif' }}
                                                                              >
                                                                                  CABIN
                                                                              </text>
                                                                          </>
                                                                      );
                                                                  })()}
                                                                  {funnelBtf > 0 && (() => {
                                                                      const fx = loa - funnelCenterElev - funWmMini / 2;
                                                                      const fy = yDeck - 14;
                                                                      const fw = funWmMini;
                                                                      return (
                                                                          <g>
                                                                              <rect
                                                                                  x={fx}
                                                                                  y={fy + 3}
                                                                                  width={fw}
                                                                                  height={11}
                                                                                  rx={0.45}
                                                                                  fill="#292524"
                                                                                  stroke="#0c0a09"
                                                                                  strokeWidth={0.16}
                                                                              />
                                                                              <rect
                                                                                  x={fx + fw * 0.1}
                                                                                  y={fy + 4.2}
                                                                                  width={fw * 0.8}
                                                                                  height={3.1}
                                                                                  rx={0.15}
                                                                                  fill="#ea580c"
                                                                              />
                                                                              <rect
                                                                                  x={fx + fw * 0.28}
                                                                                  y={fy}
                                                                                  width={fw * 0.44}
                                                                                  height={2.6}
                                                                                  rx={0.32}
                                                                                  fill="#f97316"
                                                                                  stroke="#c2410c"
                                                                                  strokeWidth={0.08}
                                                                              />
                                                                              <text
                                                                                  x={isPs ? -(loa - funnelCenterElev) : loa - funnelCenterElev}
                                                                                  y={yDeck - 3.8}
                                                                                  transform={isPs ? 'scale(-1, 1)' : undefined}
                                                                                  fill="#fed7aa"
                                                                                  fontSize={Math.max(1.45, loa / 92)}
                                                                                  fontWeight="800"
                                                                                  textAnchor="middle"
                                                                                  style={{ fontFamily: 'system-ui,sans-serif' }}
                                                                              >
                                                                                  KHÓI
                                                                              </text>
                                                                          </g>
                                                                      );
                                                                  })()}
                                                              </g>
                                                          )}
                                                      </svg>
                                                  </div>

                                                  <div
                                                      className="absolute top-6 bottom-10 z-20 w-1 rounded-full bg-amber-400 shadow-[0_0_0_2px_rgba(245,158,11,0.25)]"
                                                      style={{ left: `calc(${cabinRatioForMini}% - 2px)` }}
                                                  />
                                                  <div
                                                      role="slider"
                                                      tabIndex={draftActive ? 0 : -1}
                                                      aria-label={combinedSf ? 'Kéo cabin và ống khói (liền)' : 'Kéo vị trí cabin'}
                                                      onPointerDown={(e) => startMiniDrag('cabin', e)}
                                                      className={`absolute bottom-8 top-4 z-30 flex w-6 -translate-x-1/2 flex-col items-center justify-start touch-none ${draftActive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                                                      style={{ left: `${cabinRatioForMini}%` }}
                                                  >
                                                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[8px] font-black whitespace-nowrap">
                                                          {combinedSf ? 'CAB+KHÓI' : 'CABIN'}
                                                      </span>
                                                  </div>

                                                  {!combinedSf && (
                                                      <>
                                                          <div
                                                              className={`absolute top-6 bottom-10 z-20 w-0.5 rounded-full ${funnelGhost ? 'border border-dashed border-slate-500 bg-slate-400/50' : 'bg-slate-800'}`}
                                                              style={{ left: `calc(${funnelRatioForMini}% - 1px)` }}
                                                          />
                                                          <div
                                                              role="slider"
                                                              tabIndex={draftActive ? 0 : -1}
                                                              aria-label="Kéo vị trí ống khói"
                                                              onPointerDown={(e) => startMiniDrag('funnel', e)}
                                                              className={`absolute bottom-8 top-4 z-30 flex w-6 -translate-x-1/2 flex-col items-center justify-end touch-none ${draftActive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                                                              style={{ left: `${funnelRatioForMini}%` }}
                                                          >
                                                              <span
                                                                  className={`px-2 py-0.5 rounded-full text-[8px] font-black text-white ${funnelGhost ? 'bg-slate-500' : 'bg-slate-800'}`}
                                                              >
                                                                  ỐNG KHÓI
                                                              </span>
                                                          </div>
                                                      </>
                                                  )}

                                                  <div className={`pointer-events-none absolute bottom-1 z-20 ${isPs ? 'left-1' : 'right-1'}`}>
                                                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[8px] font-black">MŨI</span>
                                                  </div>
                                                  <div className={`pointer-events-none absolute bottom-1 z-20 ${isPs ? 'right-1' : 'left-1'}`}>
                                                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[8px] font-black">LÁI</span>
                                                  </div>
                                              </div>
                                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[10px] font-black uppercase tracking-wide">
                                                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 text-slate-700">
                                                      <label className="block text-[9px] text-slate-500 mb-1">Bow</label>
                                                      <input
                                                          type="number"
                                                          value={Math.round(bow)}
                                                          onChange={(e) => {
                                                              const nextBow = Number(e.target.value);
                                                              if (!Number.isFinite(nextBow)) return;
                                                              const nextStern = Math.round(nextBow + loa);
                                                              const nextCabin = isPs
                                                                  ? Math.round(nextBow + bowCabinSafe)
                                                                  : Math.round(nextStern - bowCabinSafe);
                                                              updateActiveVessel({ bowPos: Math.round(nextBow), sternPos: nextStern, cabinPos: nextCabin });
                                                          }}
                                                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-black text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                                                      />
                                                  </div>
                                                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 text-slate-700">
                                                      <label className="block text-[9px] text-slate-500 mb-1">Stern</label>
                                                      <input
                                                          type="number"
                                                          value={Math.round(stern)}
                                                          onChange={(e) => {
                                                              const nextStern = Number(e.target.value);
                                                              if (!Number.isFinite(nextStern)) return;
                                                              const nextBow = Math.round(nextStern - loa);
                                                              const nextCabin = isPs
                                                                  ? Math.round(nextBow + bowCabinSafe)
                                                                  : Math.round(nextStern - bowCabinSafe);
                                                              updateActiveVessel({ sternPos: Math.round(nextStern), bowPos: nextBow, cabinPos: nextCabin });
                                                          }}
                                                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-black text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                                                      />
                                                  </div>
                                                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5 text-amber-700">
                                                      <label className="block text-[9px] text-amber-600 mb-1">Cabin</label>
                                                      <input
                                                          type="number"
                                                          value={displayCabinPos}
                                                          onChange={(e) => {
                                                              const nextCabin = Number(e.target.value);
                                                              if (!Number.isFinite(nextCabin)) return;
                                                              if (draftActive) {
                                                                  const btc = isPs
                                                                      ? Math.round(stern - nextCabin)
                                                                      : Math.round(nextCabin - bow);
                                                                  const clamped = Math.max(5, Math.min(loa - 5, btc));
                                                                  setMiniLayoutDraft((d) => {
                                                                      if (!d || d.vesselId !== activeVessel.id) return d;
                                                                      const fixed = clampBowToCabinFunnelOrder(
                                                                          loa,
                                                                          clamped,
                                                                          d.bowToFunnel,
                                                                          false,
                                                                          d.bowToFunnel > 0
                                                                      );
                                                                      return { ...d, ...fixed };
                                                                  });
                                                                  return;
                                                              }
                                                              const nextBow = isPs
                                                                  ? Math.round(nextCabin - bowCabinSafe)
                                                                  : Math.round(nextCabin + bowCabinSafe - loa);
                                                              const nextStern = Math.round(nextBow + loa);
                                                              updateActiveVessel({ cabinPos: Math.round(nextCabin), bowPos: nextBow, sternPos: nextStern });
                                                          }}
                                                          className="w-full bg-white border border-amber-200 rounded px-2 py-1 text-[11px] font-black text-amber-800 outline-none focus:ring-1 focus:ring-amber-400"
                                                      />
                                                  </div>
                                                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-2 py-1.5 text-blue-700 flex flex-col justify-center">
                                                      <span className="block text-[9px] text-blue-500 mb-1">LOA (read-only)</span>
                                                      <span className="text-[12px] font-black">LOA: {Math.round(loa)}m</span>
                                                  </div>
                                              </div>
                                              {draftActive && (
                                                  <button
                                                      type="button"
                                                      onClick={commitMiniLayoutDraft}
                                                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 py-2.5 text-[11px] font-black uppercase tracking-widest text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100"
                                                  >
                                                      <Save size={16} strokeWidth={2.5} />
                                                      Lưu vị trí cabin & ống khói vào hồ sơ tàu
                                                  </button>
                                              )}
                                          </div>
                                      );
                                  })()}
                              </div>
                              
                              {activeVessel.type !== 'barge' && (
                                  <div className="col-span-12 flex flex-col gap-1 mt-2">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">KHOẢNG BUỘC DÂY (%/LOA)</label>
                                      <div className={`flex items-center justify-between h-full px-4 rounded-xl border ${isVesselUnlocked ? 'bg-blue-50 border-blue-200 shadow-inner' : 'bg-slate-100/50 border-slate-200/60'}`}>
                                          <input type="number" key={`mooring-${mooringPercent}`} defaultValue={mooringPercent} disabled={!isVesselUnlocked} onBlur={(e) => { const v = parseInt(e.target.value) || 0; if (v !== mooringPercent) { setMooringPercent(v); syncToCloud(null, null, v); } }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} className="w-12 text-center text-blue-800 font-black outline-none text-sm bg-white border border-blue-200 rounded py-1 shadow-sm disabled:opacity-50" />
                                          <div className="flex flex-col text-right py-2">
                                              <span className="text-[10px] font-black text-slate-500 uppercase">MŨI / LÁI TƯƠNG ĐƯƠNG</span>
                                              <span className="text-sm font-black text-blue-800">{getMooringSpace(activeVessel, mooringPercent)} MÉT CHUẨN</span>
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* NHÓM 1: CƠ BẢN */}
                      <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-5">
                          <h4 className="text-xs font-black text-blue-800 border-b border-blue-100 pb-2 italic tracking-widest flex items-center gap-2">
                              <Ship size={16}/> THÔNG TIN CƠ BẢN & NHẬN DIỆN
                          </h4>
                          <div className="grid grid-cols-12 gap-5">
                              <div className="col-span-5"><InputField label="VESSEL NAME" value={activeVessel.name} disabled={!isVesselUnlocked} onChange={(v) => updateActiveVessel({ name: String(v).toUpperCase() })} /></div>
                              <div className="col-span-2"><InputField label="LOA (m)" type="number" value={activeVessel.loa} disabled={!isVesselUnlocked} onChange={(v) => { const parsed = v === '' ? '' : Math.round(v); updateActiveVessel({ loa: parsed, sternPos: parsed === '' ? activeVessel.sternPos : Math.round((Number(activeVessel.bowPos)||0) + parsed) }); }} /></div>
                              {activeVessel.type !== 'barge' && (
                                  <div className="col-span-2"><InputField label="ĐỘ RỘNG (m)" type="number" value={Math.round((Number(activeVessel.loa || 0) / 4.5) * 10) / 10} disabled={true} onChange={() => {}} /></div>
                              )}
                              {activeVessel.type !== 'barge' && (
                                  <div className="col-span-2"><InputField label="MŨI-CABIN (m)" type="number" value={activeVessel.bowToCabin} disabled={!isVesselUnlocked} onChange={(v) => { const parsed = v === '' ? '' : Math.round(v); if (parsed === '') { updateActiveVessel({ bowToCabin: '' }); } else { let newCabinPos; if (activeVessel.side === 'PS') { newCabinPos = (activeVessel.sternPos || 0) - parsed; } else { newCabinPos = (activeVessel.bowPos || 0) + parsed; } updateActiveVessel({ bowToCabin: parsed, cabinPos: newCabinPos }); } }} /></div>
                              )}
                              {activeVessel.type !== 'barge' && (
                                  <>
                                  <div className="col-span-2"><InputField label="RỘNG CABIN (m)" type="number" value={activeVessel.cabinWidthM ?? 10} disabled={!isVesselUnlocked} onChange={(v) => { const parsed = v === '' ? 10 : Math.max(2, Number(v)); updateActiveVessel({ cabinWidthM: parsed }); }} /></div>
                                  <div className="col-span-2"><InputField label="MŨI → TÂM ỐNG KHÓI (m)" type="number" value={activeVessel.bowToFunnel ?? 0} disabled={!isVesselUnlocked} onChange={(v) => { const parsed = v === '' ? 0 : Math.max(0, Math.round(Number(v))); updateActiveVessel({ bowToFunnel: parsed }); }} /></div>
                                  <div className="col-span-2"><InputField label="RỘNG ỐNG KHÓI (m)" type="number" value={activeVessel.funnelWidthM ?? 8} disabled={!isVesselUnlocked} onChange={(v) => { const parsed = v === '' ? 8 : Math.max(2, Number(v)); updateActiveVessel({ funnelWidthM: parsed }); }} /></div>
                                  <div className="col-span-2"><InputField label="VẠCH BAY ĐẦU (chẵn)" type="number" value={activeVessel.bayMarkFirstEven ?? 2} disabled={!isVesselUnlocked} onChange={(v) => { const parsed = v === '' ? 2 : Math.max(0, Math.round(Number(v))); updateActiveVessel({ bayMarkFirstEven: parsed }); }} /></div>
                                  <div className="col-span-2"><InputField label="VẠCH BAY CUỐI (0=auto theo cabin)" type="number" value={activeVessel.bayMarkLastEven ?? 0} disabled={!isVesselUnlocked} onChange={(v) => { const parsed = v === '' ? 0 : Math.max(0, Math.round(Number(v))); updateActiveVessel({ bayMarkLastEven: parsed }); }} /></div>
                                  <div className="col-span-2"><InputField label="Ô BAY (M) ~40'" type="number" value={activeVessel.bayCellM ?? 12} disabled={!isVesselUnlocked} onChange={(v) => { const parsed = v === '' ? 12 : Math.max(1, Number(v)); updateActiveVessel({ bayCellM: parsed }); }} /></div>
                                  <div className="col-span-2"><InputField label="KHE GIỮA CÁC BAY (M)" type="number" value={activeVessel.bayGapM ?? 2.5} disabled={!isVesselUnlocked} onChange={(v) => { const parsed = v === '' ? 2.5 : Math.max(0, Number(v)); updateActiveVessel({ bayGapM: parsed }); }} /></div>
                                  <div className="col-span-2"><InputField label="KHE CABIN ↔ BAY (M)" type="number" value={activeVessel.cabinBayGapM ?? 2.5} disabled={!isVesselUnlocked} onChange={(v) => { const parsed = v === '' ? 2.5 : Math.max(0, Number(v)); updateActiveVessel({ cabinBayGapM: parsed }); }} /></div>
                                  <div className="col-span-6"><InputField label="BAY OPERATION (mũi→lái, cách phẩy — đồng bộ tab Operation)" value={activeVessel.operationDeckBays ?? ''} disabled={!isVesselUnlocked} onChange={(v) => updateActiveVessel({ operationDeckBays: String(v || '').trim() })} /></div>
                                  </>
                              )}
                              <div className={`${activeVessel.type === 'barge' ? 'col-span-5' : 'col-span-1'} flex flex-col gap-1`}>
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">MÀU HIỂN TRÊN MAP</label>
                                  <div className={`flex items-center h-full gap-3 px-3 py-2 rounded-xl border ${isVesselUnlocked ? 'bg-white border-blue-200 shadow-inner' : 'bg-slate-100/50 border-slate-200/60'}`}>
                                      <input type="color" value={activeVessel.color || '#2563eb'} disabled={!isVesselUnlocked} onChange={(e) => updateActiveVessel({ color: e.target.value })} className={`w-10 h-8 p-0 border-0 rounded bg-transparent ${isVesselUnlocked ? 'cursor-pointer' : 'opacity-50 pointer-events-none'}`} />
                                      <button onClick={() => updateActiveVessel({ color: "" })} disabled={!isVesselUnlocked} className={`text-[9px] border px-3 py-1.5 rounded-lg font-bold uppercase transition-colors flex-1 ${isVesselUnlocked ? 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'bg-slate-100 border-transparent text-slate-400'}`}>Khôi phục</button>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* NHÓM 3: TRANG THIẾT BỊ */}
                      <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-5">
                          <h4 className="text-xs font-black text-purple-800 border-b border-purple-100 pb-2 italic tracking-widest flex items-center gap-2"><Settings2 size={16}/> TRANG THIẾT BỊ LÀM HÀNG</h4>
                          <div className="grid grid-cols-12 gap-5">
                              <div className="col-span-3"><InputField label="TWISTLOCK" value={activeVessel.twistlock} disabled={!isVesselUnlocked} onChange={(v) => updateActiveVessel({ twistlock: fixTypos(v) })} /></div>
                              <div className="col-span-3"><InputField label="REEFER MOTOR" value={activeVessel.reeferMotor} disabled={!isVesselUnlocked} onChange={(v) => updateActiveVessel({ reeferMotor: String(v).toUpperCase() })} /></div>
                              <div className="col-span-3"><InputField label="FLIP H/C" value={activeVessel.flipHC} disabled={!isVesselUnlocked} onChange={(v) => updateActiveVessel({ flipHC: String(v).toUpperCase() })} /></div>
                              <div className="col-span-3"><InputField label="GEAR BOXES" value={activeVessel.gearBoxes} disabled={!isVesselUnlocked} onChange={(v) => updateActiveVessel({ gearBoxes: String(v).toUpperCase() })} /></div>
                          </div>
                      </div>

                      {/* NHÓM 4: GHI CHÚ */}
                      <div className="grid grid-cols-12 gap-6">
                          <div className="col-span-12 lg:col-span-5 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-5">
                              <h4 className="text-xs font-black text-amber-800 border-b border-amber-100 pb-2 italic tracking-widest flex items-center gap-2"><Maximize2 size={16}/> THÔNG SỐ CHIỀU CAO (MÉT)</h4>
                              <div className="flex flex-col gap-4">
                                  <InputField label="KEEL TO HATCH COVER" value={activeVessel.keelToHatch} disabled={!isVesselUnlocked} onChange={(v) => updateActiveVessel({ keelToHatch: String(v).toUpperCase() })} />
                                  <InputField label="KEEL TO NAVIGATION DECK" value={activeVessel.keelToNav} disabled={!isVesselUnlocked} onChange={(v) => updateActiveVessel({ keelToNav: String(v).toUpperCase() })} />
                                  <InputField label="KEEL TO TOP MAST" value={activeVessel.keelToMast} disabled={!isVesselUnlocked} onChange={(v) => updateActiveVessel({ keelToMast: String(v).toUpperCase() })} />
                              </div>
                          </div>
                          
                          <div className="col-span-12 lg:col-span-7 bg-amber-50/30 p-6 rounded-3xl border border-amber-200/50 flex flex-col gap-5 h-full relative group">
                              <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                                  <h4 className="text-xs font-black text-red-800 italic tracking-widest flex items-center gap-2"><AlertCircle size={16}/> GHI CHÚ QUAN TRỌNG (REMARK)</h4>
                                  {(() => {
                                      const hasExtractableData = activeVessel?.remark && (activeVessel.remark.includes('KEEL TO') || activeVessel.remark.includes('DISTANCE FROM STERN') || activeVessel.remark.includes('TWIST LOCK') || activeVessel.remark.includes('REEFER MOTOR'));
                                      return (
                                          <button disabled={!isVesselUnlocked || !activeVessel.remark} onClick={handleAutoExtractRemark} className={`text-[9px] px-3 py-1.5 rounded shadow-sm font-black uppercase tracking-widest flex items-center gap-1 transition-all disabled:opacity-50 disabled:grayscale ${hasExtractableData ? 'bg-blue-600 text-white animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.6)]' : 'bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white'}`}><Zap size={12} className="fill-current"/> TRÍCH XUẤT</button>
                                      )
                                  })()}
                              </div>
                              <div className="flex-1"><TextAreaField label="ALL INFO" value={activeVessel.remark} disabled={!isVesselUnlocked} onChange={(v) => updateActiveVessel({ remark: String(v).toUpperCase() })} /></div>
                          </div>
                      </div>

                      {/* --- KHU VỰC AI VISION --- */}
                      {activeVessel.type !== 'barge' && (
                          <div className="md:col-span-3 mt-2 pt-6 border-t border-slate-200">
                              <h4 className="text-sm font-black text-[#002D54] mb-4 italic tracking-widest flex items-center gap-2 uppercase"><Zap size={18} className="text-amber-500 fill-amber-500/20"/> Phân tích ảnh tàu & Định vị Cabin (AI Vision)</h4>
                              <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200 flex flex-col md:flex-row gap-6 items-start shadow-inner">
                                  <div className="flex flex-col gap-4 w-full md:w-1/3 flex-shrink-0">
                                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed normal-case">Tải lên hình ảnh tàu. Hệ thống tự động <b>Nén Ảnh</b>. Có thể dùng AI để đo khoảng cách Mũi-Cabin dựa vào LOA.</p>
                                      
                                      {/* API KEY INPUT */}
                                      <div className="flex flex-col gap-1">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">API KEY (GEMINI VISION)</label>
                                          <input 
                                              type="password" 
                                              value={geminiApiKey} 
                                              onChange={(e) => {
                                                  const val = e.target.value;
                                                  setGeminiApiKey(val);
                                                  localStorage.setItem('cmit_gemini_api_key', val);
                                              }} 
                                              placeholder="Nhập API Key..." 
                                              className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                              disabled={!isVesselUnlocked}
                                          />
                                      </div>

                                      <input type="file" accept="image/*" ref={aiImageInputRef} className="hidden" onChange={handleAiImageUpload} />
                                      <button onClick={() => aiImageInputRef.current?.click()} disabled={aiLoading || !isVesselUnlocked} className="py-4 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-black text-xs rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale uppercase tracking-widest">
                                          {aiLoading ? <Activity size={18} className="animate-spin"/> : <ScanSearch size={18}/>}
                                          {aiLoading ? 'ĐANG PHÂN TÍCH...' : 'CHỌN ẢNH ĐỂ PHÂN TÍCH'}
                                      </button>
                                      {!isVesselUnlocked && <p className="text-[9px] text-center text-red-500 font-bold uppercase mt-[-10px]">Cần mở khóa</p>}
                                      {pendingAiDistance && (
                                          <div className="bg-amber-100 border-2 border-amber-400 p-4 rounded-2xl flex flex-col gap-3 shadow-lg relative overflow-hidden">
                                              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                                              <p className="text-[11px] font-black text-amber-900 uppercase">AI đề xuất Mũi-Cabin: <span className="text-xl">{pendingAiDistance}m</span></p>
                                              <div className="flex gap-2 mt-1">
                                                  <button onClick={() => { setPendingAiDistance(null); setPendingAiImage(null); }} className="flex-1 bg-white text-slate-600 text-[10px] font-black py-2 rounded-lg border border-slate-300 hover:bg-slate-50 uppercase">Hủy Bỏ</button>
                                                  <button onClick={confirmAndSaveAiResult} className="flex-[2] bg-emerald-500 text-white text-[10px] font-black py-2 rounded-lg shadow-md hover:bg-emerald-600 flex items-center justify-center gap-1 uppercase"><Check size={14}/> Đồng Ý Lưu</button>
                                              </div>
                                          </div>
                                      )}
                                      {aiSuccessMsg && <div className="text-emerald-700 text-[10px] font-black bg-emerald-100 p-3 rounded-xl border border-emerald-200 flex gap-2"><CheckCircle size={16} className="flex-shrink-0"/> <span className="normal-case">{aiSuccessMsg}</span></div>}
                                      {aiError && <div className="text-red-700 text-[10px] font-black bg-red-100 p-3 rounded-xl border border-red-200 flex gap-2"><AlertCircle size={16} className="flex-shrink-0"/> <span className="normal-case">{aiError}</span></div>}
                                  </div>
                                  <div className="flex-1 flex gap-4 w-full">
                                      <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-2 min-h-[160px] max-h-[250px] shadow-sm flex flex-col items-center justify-center relative group overflow-hidden">
                                          {pendingAiImage ? (
                                              <><div className="absolute top-2 left-2 bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded z-10 shadow-md">ẢNH CHỜ LƯU</div><img src={pendingAiImage} alt="Pending" className="w-full h-full object-contain rounded-xl opacity-50 grayscale" /></>
                                          ) : activeVesselImage ? (
                                              <img src={activeVesselImage} alt="Stored" className="w-full h-full object-contain rounded-xl" />
                                          ) : (
                                              <div className="flex flex-col items-center gap-2 text-slate-300"><ImageIcon size={32} /><span className="text-[10px] font-black tracking-widest uppercase">CHƯA CÓ ẢNH TÀU</span></div>
                                          )}
                                      </div>
                                      <div className="flex-[1.2] bg-white rounded-2xl border border-slate-200 p-5 min-h-[160px] max-h-[250px] overflow-y-auto custom-scrollbar shadow-sm relative">
                                          <p className="text-[10px] font-black text-slate-400 mb-3 tracking-[0.2em] uppercase sticky top-0 bg-white/90 backdrop-blur pb-2 z-10 border-b border-slate-100">NHẬT KÝ SUY LUẬN TỪ AI:</p>
                                          {aiResultText ? <div className="text-xs text-slate-700 font-bold whitespace-pre-wrap normal-case leading-loose">{aiResultText}</div> : <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-xs gap-3 mt-[-20px]"><ScanSearch size={32} className="opacity-20" /><span>Khu vực trả kết quả của AI.</span></div>}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}
                      
                      {/* --- LỊCH SỬ CÁC CHUYẾN --- */}
                      <div className="md:col-span-3 mt-6 pt-6 border-t border-slate-200">
                          <h4 className="text-sm font-black text-[#002D54] mb-4 italic tracking-widest flex items-center gap-2 uppercase"><History size={18} className="text-blue-500"/> Lịch sử các chuyến (Voyages)</h4>
                          {activeVesselVoyages.length > 0 ? (
                              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-inner">
                                  <table className="w-full text-left bg-white text-xs">
                                      <thead className="bg-slate-50 border-b border-slate-200"><tr className="text-slate-500 uppercase tracking-widest font-black"><th className="p-3">Chuyến</th><th className="p-3">Hướng Cập</th><th className="p-3">ETA</th><th className="p-3">Mạn Cập</th><th className="p-3">Vị trí</th><th className="p-3 text-right">Ngày lưu hệ thống</th></tr></thead>
                                      <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                          {activeVesselVoyages.map(voy => (
                                              <tr key={voy.id} className="hover:bg-blue-50 transition-colors">
                                                  <td className="p-3 text-blue-600 tracking-wider text-sm">{voy.voyage}</td><td className="p-3">{voy.direction || '-'}</td><td className="p-3 text-emerald-700">{voy.eta ? new Date(voy.eta).toLocaleString('vi-VN') : '-'}</td><td className="p-3">{voy.side || '-'}</td><td className="p-3">{Math.round(voy.bowPos)}m - {Math.round(voy.sternPos)}m</td><td className="p-3 text-slate-400 text-right">{new Date(voy.savedAt).toLocaleString('vi-VN')}</td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          ) : (
                              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs font-bold gap-2"><History size={24} className="opacity-50" /><p>Chưa có dữ liệu chuyến nào.</p></div>
                          )}
                      </div>

                  </div>
              </div>
              )}
            </div>
          )}


          {activeTab === 'summary' && activeVessel && !isPrintMode && (
            <div className="h-full overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-6 duration-400">
              <div className="bg-white p-16 rounded-[60px] border border-slate-200 shadow-2xl space-y-10 min-h-full max-w-6xl mx-auto mt-4 uppercase">
                  <div className="flex justify-between items-start border-b-2 border-slate-50 pb-8">
                      <div><h2 className="text-4xl font-black text-[#002D54] tracking-tighter italic leading-none">Báo cáo Hoạt động<br/><span className="text-blue-600">{String(activeVessel.name || 'UNKNOWN').toUpperCase()}</span></h2></div>
                      <div className="text-right">
                           <div className="bg-slate-900 text-white px-5 py-2 rounded-xl font-black text-[8px] tracking-widest mb-3 italic shadow-xl">Đã xác minh thông số</div>
                           <p className="text-2xl font-black text-slate-800 italic leading-none">{new Date().toLocaleDateString('vi-VN')}</p>
                      </div>
                  </div>
                  <div className="grid grid-cols-3 gap-8">
                      <div className="space-y-2 bg-slate-50 p-10 rounded-[40px] border border-slate-100">
                          <SummaryRow label="Tàu / Sà lan" value={`${activeVessel.name || ''} / ${activeVessel.voyage || ''}`.toUpperCase()} color="blue" />
                          <SummaryRow label="Dự kiến cập (ETA)" value={activeVessel.eta ? new Date(activeVessel.eta).toLocaleString('vi-VN') : 'TBU'} color="blue" />
                          <SummaryRow label="Dự kiến rời (ETD)" value={activeVessel.etd ? new Date(activeVessel.etd).toLocaleString('vi-VN') : 'TBU'} color="blue" />
                          {activeVessel.type === 'vessel' && (
                              <SummaryRow label={`Khoảng Buộc Dây (${Number(mooringPercent)}%)`} value={`${getMooringSpace(activeVessel, mooringPercent)}m`} color="emerald" />
                          )}
                      </div>
                      <div className="space-y-2 bg-slate-50 p-10 rounded-[40px] border border-slate-100">
                          <SummaryRow label="Cọc Mũi (Bow)" value={bow?.id !== '-' ? `Cọc ${bow.id} (${bow.pos}m)` : 'Ngoài bến'} color="purple" />
                          <SummaryRow label="Cọc Lái (Stern)" value={stern?.id !== '-' ? `Cọc ${stern.id} (${stern.pos}m)` : 'Ngoài bến'} color="purple" />
                          {activeVessel.type !== 'barge' && (
                              <SummaryRow label="Vị trí Cabin" value={`${Math.round(activeVessel.cabinPos||0)}m`} color="purple" />
                          )}
                      </div>
                      <div className="space-y-2 bg-slate-50 p-10 rounded-[40px] border border-slate-100">
                          <SummaryRow label="Tổng Sản Lượng" value={`${Number(activeVessel.dis||0) + Number(activeVessel.load||0)} Moves`} color="emerald" />
                          <SummaryRow label="Hướng Cập Cầu" value={String(activeVessel.direction || '').toUpperCase()} color="amber" />
                      </div>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && !isPrintMode && (
            <div className="h-full flex flex-col animate-in fade-in duration-400 max-w-6xl mx-auto w-full mt-4">
              <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-xl flex-1 flex flex-col overflow-hidden uppercase">
                  <div className="flex items-center gap-5 mb-10">
                      <div className="p-3 bg-slate-900 rounded-xl text-white shadow-xl shadow-slate-100"><History size={24} /></div>
                      <h2 className="font-black text-2xl text-slate-900 tracking-tighter italic">Lưu trữ Kế hoạch Bến</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                      <table className="w-full text-left border-separate border-spacing-y-5">
                          <thead>
                              <tr className="text-[10px] font-black text-slate-400 tracking-[0.4em] px-10">
                                  <th className="px-10 py-2">Chi tiết Kế hoạch</th>
                                  <th className="px-10 py-2 text-center w-48">Thao tác</th>
                              </tr>
                          </thead>
                          <tbody>
                              {historyPlans.map(plan => (
                                  <tr key={plan.id} className="bg-slate-50 hover:bg-white hover:shadow-xl transition-all duration-500 rounded-[30px] border border-transparent hover:border-blue-50 group">
                                      <td className="px-10 py-6 rounded-l-[30px]">
                                          <p className="font-black text-slate-900 text-lg tracking-tighter italic truncate">BẢN LƯU: {new Date(plan.updatedAt).toLocaleString('vi-VN')}</p>
                                          <p className="text-[10px] font-bold text-blue-600 mt-1 tracking-widest italic uppercase">Số phương tiện: {plan.vessels?.length || 1} | Người tạo: {String(plan.updatedBy || '').slice(0,8)}</p>
                                      </td>
                                      <td className="px-10 py-6 rounded-r-[30px] text-center">
                                          <div className="flex items-center justify-center gap-4">
                                              <button onClick={() => { const vs = plan.vessels || [plan.vessel]; setVessels(vs); setActiveVesselId(vs[0].id); const normalizedPlanQcs = normalizeQcPhysicalOrder(plan.qcs || qcTasks); setQcTasks(normalizedPlanQcs); setBerthMaintenanceZones(Array.isArray(plan.berthMaintenanceZones) ? plan.berthMaintenanceZones.map((z, idx) => ({ id: z.id || `maint-plan-${idx}`, start: Number(z.start), end: Number(z.end) })).filter(z => Number.isFinite(z.start) && Number.isFinite(z.end) && z.end > z.start) : []); setQcMaintenanceIds(Array.isArray(plan.qcMaintenanceIds) ? plan.qcMaintenanceIds : []); syncToCloud(vs, normalizedPlanQcs); setActiveTab('visual'); }} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg active:scale-90"><Download size={16} /></button>
                                              <button onClick={() => deleteFromHistory(plan.id)} className="p-3 bg-red-50 text-red-500 rounded-xl active:scale-90 hover:bg-red-500 hover:text-white transition-colors"><Trash2 size={16} /></button>
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL CƠ SỞ DỮ LIỆU & THÊM MỚI */}
      {showVesselModal && !isPrintMode && (
          <div className="absolute inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
              <div className="bg-white w-[600px] max-h-[85%] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 uppercase">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 relative overflow-hidden flex-shrink-0">
                      <div className="absolute -right-4 -top-4 text-blue-500/10 pointer-events-none"><Database size={100} /></div>
                      <div className="relative z-10">
                          <h3 className="text-xl font-black text-[#002D54] italic">{showNewVesselForm ? 'TẠO TÀU MỚI' : 'CƠ SỞ DỮ LIỆU TÀU'}</h3>
                          {!showNewVesselForm && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Trích xuất từ Master File ({safeMasterVessels.length} Tàu)</p>}
                      </div>
                      {!showNewVesselForm && (
                          <div className="flex gap-3 relative z-10">
                              <input
                                  type="text"
                                  value={quickAddVoyage}
                                  onChange={(e) => setQuickAddVoyage(String(e.target.value || '').toUpperCase())}
                                  placeholder="VOYAGE..."
                                  className="w-36 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-[#002D54] outline-none focus:ring-2 focus:ring-blue-500 uppercase shadow-inner"
                              />
                              <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-xl font-black text-[10px] tracking-widest uppercase transition-colors shadow-sm"><Download size={16} /> XUẤT EXCEL</button>
                              <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-xl font-black text-[10px] tracking-widest uppercase transition-colors shadow-sm"><UploadCloud size={16} /> NHẬP CSV/EXCEL</button>
                              <button onClick={() => setShowVesselModal(false)} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors"><X size={16}/></button>
                          </div>
                      )}
                  </div>

                  {showNewVesselForm ? (
                      <div className="p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
                          {formError && <div className="text-red-600 text-xs font-black bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2"><AlertCircle size={14}/>{formError}</div>}
                          
                          <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TÊN TÀU (*)</label>
                              <input type="text" value={newVesselData.name} onChange={e => setNewVesselData({...newVesselData, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-[#002D54] outline-none focus:ring-2 focus:ring-blue-500 uppercase shadow-inner" placeholder="NHẬP TÊN TÀU..." />
                          </div>

                          <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CHUYẾN (VOYAGE)</label>
                              <input type="text" value={newVesselData.voyage || ''} onChange={e => setNewVesselData({...newVesselData, voyage: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-[#002D54] outline-none focus:ring-2 focus:ring-blue-500 uppercase shadow-inner" placeholder="VD: 123123" />
                          </div>

                          <div className="flex gap-5">
                              <div className="flex flex-col gap-1.5 flex-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LOA (m) (*)</label>
                                  <input type="number" value={newVesselData.loa} onChange={e => setNewVesselData({...newVesselData, loa: e.target.value ? parseInt(e.target.value) : ''})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-[#002D54] outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="Vd: 200" />
                              </div>
                              <div className="flex flex-col gap-1.5 flex-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MẠN CẬP (*)</label>
                                  <div className="flex gap-2">
                                      <button onClick={() => setNewVesselData({...newVesselData, side: 'SB'})} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${newVesselData.side === 'SB' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>SB (PHẢI)</button>
                                      <button onClick={() => setNewVesselData({...newVesselData, side: 'PS'})} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${newVesselData.side === 'PS' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>PS (TRÁI)</button>
                                  </div>
                              </div>
                          </div>

                          <div className="flex gap-5">
                              <div className="flex flex-col gap-1.5 flex-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CẬP DỰ KIẾN (ETA)</label>
                                  <input type="datetime-local" value={newVesselData.eta} onChange={e => setNewVesselData({...newVesselData, eta: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-[#002D54] outline-none focus:ring-2 focus:ring-blue-500 uppercase shadow-inner" />
                              </div>
                              <div className="flex flex-col gap-1.5 flex-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RỜI DỰ KIẾN (ETD)</label>
                                  <input type="datetime-local" value={newVesselData.etd} onChange={e => setNewVesselData({...newVesselData, etd: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-[#002D54] outline-none focus:ring-2 focus:ring-blue-500 uppercase shadow-inner" />
                              </div>
                          </div>

                          <div className="flex gap-3 mt-4 pt-6 border-t border-slate-100">
                              <button onClick={() => setShowNewVesselForm(false)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-black text-xs rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-colors shadow-sm">QUAY LẠI</button>
                              <button onClick={handleCreateNewVessel} className="flex-[2] py-3.5 bg-[#002D54] text-white font-black text-xs rounded-xl hover:bg-[#00407a] uppercase tracking-widest shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"><Plus size={16}/> XÁC NHẬN THÊM</button>
                          </div>
                      </div>
                  ) : (
                      <>
                          {uploadMsg && (
                              <div className={`px-6 py-3 text-xs font-black tracking-widest flex items-center gap-2 flex-shrink-0 ${uploadMsg.includes('Lỗi') || uploadMsg.includes('LỖI') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                  {uploadMsg.includes('Lỗi') || uploadMsg.includes('LỖI') ? <AlertCircle size={14} /> : <CheckCircle size={14} />} {String(uploadMsg)}
                              </div>
                          )}

                          <div className="p-4 border-b border-slate-100 bg-white flex-shrink-0">
                              <div className="relative">
                                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input autoFocus type="text" placeholder="TÌM KIẾM TÊN TÀU (GỢI Ý GẦN GIỐNG)..." value={searchQuery || ''} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-100 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow shadow-inner uppercase" />
                              </div>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                              {filteredVessels.length > 0 ? (
                                  <>
                                      {searchQuery && !filteredVessels.some(v => String(v.name).toUpperCase() === searchQuery.trim().toUpperCase()) && (
                                          <button onClick={() => triggerNewVesselForm(searchQuery)} className="w-full text-left p-4 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-200 group flex items-center justify-between mb-3 shadow-sm">
                                              <div>
                                                  <h4 className="text-sm font-black text-emerald-800 uppercase flex items-center gap-2"><Plus size={16}/> TẠO MỚI TÀU: "{searchQuery.toUpperCase()}"</h4>
                                                  <p className="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-widest">Không tìm thấy tàu khớp hoàn toàn. Bấm để tạo mới.</p>
                                              </div>
                                              <ArrowRight size={18} className="text-emerald-600 transform group-hover:translate-x-1 transition-transform" />
                                          </button>
                                      )}

                                      {filteredVessels.map((v, i) => (
                                          <button key={`master-db-vessel-${i}`} onClick={() => addVesselFromDB(v, { voyage: quickAddVoyage || 'TBU' })} className="w-full text-left p-4 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-200 group flex items-center justify-between mb-1">
                                              <div>
                                                  <h4 className="text-sm font-black text-slate-800 uppercase">{String(v.name || 'UNKNOWN')}</h4>
                                                  <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
                                                      LOA: <span className="text-blue-600">{Number(v.loa || 200)}m</span> 
                                                      {v.twistlock ? ` • ${String(v.twistlock).slice(0,25)}${String(v.twistlock).length > 25 ? '...' : ''}` : ''}
                                                  </p>
                                              </div>
                                              <Plus size={18} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-125" />
                                          </button>
                                      ))}
                                  </>
                              ) : (
                                  <div className="p-10 flex flex-col items-center justify-center text-slate-500 gap-4 text-center">
                                      <Database size={48} className="text-blue-300 mb-2" />
                                      <h4 className="text-lg font-black text-[#002D54]">Không tìm thấy tàu phù hợp!</h4>
                                      {searchQuery ? (
                                          <button onClick={() => triggerNewVesselForm(searchQuery)} className="mt-2 py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2">
                                              <Plus size={16}/> TẠO MỚI "{searchQuery.toUpperCase()}"
                                          </button>
                                      ) : (
                                          <p className="text-sm font-bold">Hãy bấm nút <b>"NHẬP CSV/EXCEL"</b> màu xanh lá ở góc trên bên phải.</p>
                                      )}
                                  </div>
                              )}
                          </div>
                          <div className="p-5 border-t border-slate-100 bg-slate-50 flex-shrink-0">
                              <button onClick={() => triggerNewVesselForm('')} className="w-full py-3.5 bg-[#002D54] hover:bg-[#00407a] text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-[0.98]">
                                  + THÊM TÀU TÙY CHỈNH MỚI
                              </button>
                          </div>
                      </>
                  )}
              </div>
          </div>
      )}

      {/* MODAL CẤU HÌNH XUẤT PDF */}
      {showPdfModal && !isPrintMode && (
          <div className="absolute inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
              <div className="bg-white w-[420px] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <h3 className="font-black text-[#002D54] uppercase tracking-widest flex items-center gap-2 text-sm"><Printer size={18} className="text-emerald-600"/> Tùy chọn Xuất PDF</h3>
                      <button onClick={() => setShowPdfModal(false)} className="text-slate-400 hover:text-red-500 bg-slate-200 hover:bg-red-50 p-1.5 rounded-full transition-colors"><X size={16}/></button>
                  </div>
                  <div className="p-6 flex flex-col gap-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">Chọn các thành phần muốn hiển thị trong bản PDF:</p>
                      
                      <label className="flex items-center gap-3 cursor-pointer group bg-slate-50 p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
                          <input type="checkbox" checked={pdfConfig.showVesselLabels} onChange={e => setPdfConfig({...pdfConfig, showVesselLabels: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"/>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide group-hover:text-blue-600">Mốc tọa độ Tàu (Mũi/Lái/Cabin)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group bg-slate-50 p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
                          <input type="checkbox" checked={pdfConfig.showBargeLabels} onChange={e => setPdfConfig({...pdfConfig, showBargeLabels: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"/>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide group-hover:text-blue-600">Mốc tọa độ Sà Lan (Mũi/Lái)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group bg-slate-50 p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
                          <input type="checkbox" checked={pdfConfig.showQcRanges} onChange={e => setPdfConfig({...pdfConfig, showQcRanges: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"/>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide group-hover:text-blue-600">Tầm di chuyển giới hạn của Cẩu</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group bg-slate-50 p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
                          <input type="checkbox" checked={pdfConfig.showMooringLines} onChange={e => setPdfConfig({...pdfConfig, showMooringLines: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"/>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide group-hover:text-blue-600">Mô phỏng đường cáp Dây Neo</span>
                      </label>
                      <label className="flex items-center justify-between group bg-slate-50 p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors mt-2">
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide group-hover:text-blue-600">Tỷ lệ in (Scale %):</span>
                          <input type="number" value={pdfConfig.scale} onChange={e => setPdfConfig({...pdfConfig, scale: parseInt(e.target.value) || 100})} className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-center text-xs font-black text-blue-600 outline-none" min="50" max="200" />
                      </label>
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
                      <button onClick={() => setShowPdfModal(false)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-black text-[10px] rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-colors shadow-sm">HỦY BỎ</button>
                      <button onClick={executePdfExport} className="flex-[2] py-3.5 bg-emerald-600 text-white font-black text-[10px] rounded-xl hover:bg-emerald-700 uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"><Download size={16}/> TIẾN HÀNH XUẤT PDF</button>
                  </div>
              </div>
          </div>
      )}
      
      {dialogState.open && (
        <div className="absolute inset-0 z-[210] bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">{dialogState.title}</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{dialogState.message}</p>
              {dialogState.type === 'choice' && (
                <div className="mt-4 space-y-2">
                  {dialogState.choices.map((choice) => (
                    <button
                      key={choice.value}
                      onClick={() => setDialogState(prev => ({ ...prev, selectedChoice: choice.value }))}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
                        dialogState.selectedChoice === choice.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              {dialogState.type !== 'alert' && (
                <button onClick={() => closeDialog(null)} className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black uppercase tracking-wider transition-colors">
                  {dialogState.cancelText || 'Hủy'}
                </button>
              )}
              <button
                onClick={() => closeDialog(dialogState.type === 'choice' ? dialogState.selectedChoice : true)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-md"
              >
                {dialogState.confirmText || 'Đồng ý'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-bottom-4 flex items-center gap-2 border border-emerald-400">
            <CheckCircle size={16} /> {toastMsg}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700;900&display=swap');
        * { font-family: 'Montserrat', sans-serif; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; border: 2px solid #fff; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
        input[type=range] { -webkit-appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #3b82f6; cursor: pointer; margin-top: -5px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 6px; cursor: pointer; background: #e2e8f0; border-radius: 4px; }
        
        @media print {
            @page { size: landscape; margin: 10mm; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; }
        }
      `}} />
    </div>
  );
};

export default App;