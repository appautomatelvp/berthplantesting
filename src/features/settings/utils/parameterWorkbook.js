import * as XLSX from 'xlsx';
import { CRANE_WIDTH_M, clampCranePosition } from '../../berth-plan/utils/crane.js';
import { withServiceColors } from '../../berth-plan/utils/serviceColor.js';

/** Sheet names are fixed so a file saved in either language can be uploaded again. */
export const SHEET = {
  guide: 'Huong dan',
  params: 'Thong so',
  services: 'Dich vu',
  fleet: 'Thiet bi CY',
  cranes: 'Cau bo',
  maintenance: 'Bao tri',
  secondaryCranes: 'Cau ben phu',
  external: 'Ben thue',
};

const FLEET_TYPES = ['STS', 'RTG', 'RS', 'EH'];

function text(locale, vi, en) {
  return locale === 'en' ? en : vi;
}

function normHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  let s = String(value).trim().replace(/\s/g, '');
  if (!s || s === '-' || s === 'â€”') return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
  else if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseDay(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim().toLowerCase();
  const s = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '');
  const map = {
    mon: 'Mon',
    monday: 'Mon',
    t2: 'Mon',
    thu2: 'Mon',
    '2': 'Mon',
    tue: 'Tue',
    tuesday: 'Tue',
    t3: 'Tue',
    thu3: 'Tue',
    '3': 'Tue',
    wed: 'Wed',
    wednesday: 'Wed',
    t4: 'Wed',
    thu4: 'Wed',
    '4': 'Wed',
    thu: 'Thu',
    thursday: 'Thu',
    t5: 'Thu',
    thu5: 'Thu',
    '5': 'Thu',
    fri: 'Fri',
    friday: 'Fri',
    t6: 'Fri',
    thu6: 'Fri',
    '6': 'Fri',
    sat: 'Sat',
    saturday: 'Sat',
    t7: 'Sat',
    thu7: 'Sat',
    '7': 'Sat',
    sun: 'Sun',
    sunday: 'Sun',
    cn: 'Sun',
    chunhat: 'Sun',
    t8: 'Sun',
    '8': 'Sun',
  };
  return map[s] || null;
}

export function parseTime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 0 && value < 1) {
      const mins = Math.round(value * 24 * 60);
      return `${pad2(Math.floor(mins / 60) % 24)}:${pad2(mins % 60)}`;
    }
    if (value >= 0 && value < 24) {
      const h = Math.floor(value);
      const m = Math.round((value - h) * 60);
      return `${pad2(h % 24)}:${pad2(m % 60)}`;
    }
  }
  const m = String(value)
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${pad2(h)}:${pad2(min)}`;
}

function fieldCatalog(locale) {
  const t = (vi, en) => text(locale, vi, en);
  const ratio = t(
    'Nháº­p sá»‘ tháº­p phÃ¢n tá»« 0 Ä‘áº¿n 1. VÃ­ dá»¥ 0,1 nghÄ©a lÃ  10%. KhÃ´ng nháº­p 10 vÃ  khÃ´ng gÃµ dáº¥u %.',
    'Enter a decimal from 0 to 1. Example: 0.1 means 10%. Do not enter 10 and do not type %.'
  );
  const pct = t(
    'Nháº­p sá»‘ pháº§n trÄƒm tá»« 0 Ä‘áº¿n 100. VÃ­ dá»¥ 60 nghÄ©a lÃ  60%. KhÃ´ng nháº­p 0,6.',
    'Enter a percent from 0 to 100. Example: 60 means 60%. Do not enter 0.6.'
  );
  const hours = t(
    'Sá»‘ giá», dÃ¹ng dáº¥u cháº¥m tháº­p phÃ¢n náº¿u cáº§n. VÃ­ dá»¥ 0,5 lÃ  30 phÃºt. KhÃ´ng gÃµ chá»¯ "giá»".',
    'Hours. Use a decimal if needed. Example: 0.5 is 30 minutes. Do not type the word "hours".'
  );
  const meters = t('Sá»‘ mÃ©t. Chá»‰ nháº­p sá»‘, vÃ­ dá»¥ 600.', 'Meters. Enter a number only, for example 600.');
  return [
    {
      code: 'terminal.name',
      group: t('Cáº§u chÃ­nh', 'Main quay'),
      name: t('TÃªn terminal', 'Terminal name'),
      unit: t('chá»¯', 'text'),
      kind: 'text',
      note: t('TÃªn hiá»ƒn thá»‹ trÃªn Ä‘áº§u há»‡ thá»‘ng. KhÃ´ng Ä‘á»ƒ trá»‘ng.', 'Shown in the header. Required.'),
    },
    {
      code: 'terminal.quayLength',
      group: t('Cáº§u chÃ­nh', 'Main quay'),
      name: t('Chiá»u dÃ i cáº§u chÃ­nh', 'Main quay length'),
      unit: 'm',
      kind: 'number',
      min: 50,
      max: 5000,
      note: t(
        'DÃ¹ng Ä‘á»ƒ tÃ­nh mÃ©t-giá» kháº£ dá»¥ng = chiá»u dÃ i cáº§u Ã— ngÃ y lÃ m viá»‡c/nÄƒm Ã— giá»/ngÃ y, vÃ  lÃ m trá»¥c mÃ©t trÃªn BERTH PLAN. ' + meters,
        'Used for available meter-hours = quay length Ã— working days/year Ã— hours/day, and as the BERTH PLAN meter axis. ' + meters
      ),
    },
    {
      code: 'terminal.workingDaysPerYear',
      group: t('Lá»‹ch lÃ m viá»‡c', 'Working calendar'),
      name: t('Sá»‘ ngÃ y lÃ m viá»‡c / nÄƒm', 'Working days / year'),
      unit: t('ngÃ y', 'days'),
      kind: 'number',
      min: 1,
      max: 366,
      note: t('Máº«u sá»‘ mÃ©t-giá» nÄƒm. ThÆ°á»ng lÃ  365.', 'Yearly meter-hour denominator. Usually 365.'),
    },
    {
      code: 'terminal.workingHoursPerDay',
      group: t('Lá»‹ch lÃ m viá»‡c', 'Working calendar'),
      name: t('Sá»‘ giá» lÃ m viá»‡c / ngÃ y', 'Working hours / day'),
      unit: t('giá»', 'h'),
      kind: 'number',
      min: 1,
      max: 24,
      note: t('ThÆ°á»ng lÃ  24 náº¿u cáº§u hoáº¡t Ä‘á»™ng xuyÃªn ngÃ y.', 'Usually 24 when the quay works around the clock.'),
    },
    {
      code: 'terminal.workingWeeksPerYear',
      group: t('Lá»‹ch lÃ m viá»‡c', 'Working calendar'),
      name: t('Sá»‘ tuáº§n lÃ m viá»‡c / nÄƒm', 'Working weeks / year'),
      unit: t('tuáº§n', 'weeks'),
      kind: 'number',
      min: 1,
      max: 53,
      note: t('DÃ¹ng khi quy tuáº§n ra nÄƒm. ThÆ°á»ng lÃ  52.', 'Used to annualize a week. Usually 52.'),
    },
    {
      code: 'terminal.workingDaysPerWeek',
      group: t('Lá»‹ch lÃ m viá»‡c', 'Working calendar'),
      name: t('Sá»‘ ngÃ y tÃ­nh BOR / tuáº§n', 'Days in the BOR week'),
      unit: t('ngÃ y', 'days'),
      kind: 'number',
      min: 1,
      max: 7,
      note: t(
        'Máº«u sá»‘ BOR theo tuáº§n = chiá»u dÃ i cáº§u Ã— sá»‘ ngÃ y nÃ y Ã— giá»/ngÃ y. ThÆ°á»ng lÃ  7.',
        'Weekly BOR denominator = quay length Ã— this number Ã— hours/day. Usually 7.'
      ),
    },
    {
      code: 'metrics.bargeVesselVolumeRatio',
      group: t('SÃ  lan', 'Barge'),
      name: t('Tá»· lá»‡ sáº£n lÆ°á»£ng sÃ  lan / tÃ u', 'Barge / vessel volume ratio'),
      unit: t('tá»· lá»‡ 0â€“1', 'ratio 0â€“1'),
      kind: 'number',
      min: 0,
      max: 5,
      note: t(
        'Sáº£n lÆ°á»£ng sÃ  lan = sáº£n lÆ°á»£ng tuyáº¿n chÃ­nh Ã— tá»· lá»‡ nÃ y. 0,63 nghÄ©a lÃ  sÃ  lan báº±ng 63% sáº£n lÆ°á»£ng tÃ u. KhÃ´ng nháº­p 63.',
        'Barge volume = mainline volume Ã— this ratio. 0.63 means barges equal 63% of vessel volume. Do not enter 63.'
      ),
    },
    {
      code: 'metrics.vesselArrivalHrs',
      group: t('TÃ u máº¹', 'Mother vessel'),
      name: t('Giá» manoeuvre cáº­p â€” tÃ u', 'Vessel arrival maneuver'),
      unit: t('giá»', 'h'),
      kind: 'number',
      min: 0,
      max: 48,
      note: hours + ' ' + t('Cá»™ng vÃ o giá» chiáº¿m cáº§u cá»§a má»—i chuyáº¿n tÃ u.', 'Added to berth hours of each vessel call.'),
    },
    {
      code: 'metrics.vesselDepartureHrs',
      group: t('TÃ u máº¹', 'Mother vessel'),
      name: t('Giá» manoeuvre rá»i â€” tÃ u', 'Vessel departure maneuver'),
      unit: t('giá»', 'h'),
      kind: 'number',
      min: 0,
      max: 48,
      note: hours,
    },
    {
      code: 'metrics.bargeArrivalHrs',
      group: t('SÃ  lan', 'Barge'),
      name: t('Giá» manoeuvre cáº­p â€” sÃ  lan', 'Barge arrival maneuver'),
      unit: t('giá»', 'h'),
      kind: 'number',
      min: 0,
      max: 48,
      note: hours,
    },
    {
      code: 'metrics.bargeDepartureHrs',
      group: t('SÃ  lan', 'Barge'),
      name: t('Giá» manoeuvre rá»i â€” sÃ  lan', 'Barge departure maneuver'),
      unit: t('giá»', 'h'),
      kind: 'number',
      min: 0,
      max: 48,
      note: hours + ' ' + t('CÃ³ thá»ƒ nháº­p 0 náº¿u sÃ  lan rá»i khÃ´ng tÃ­nh thÃªm giá».', 'Enter 0 when departure adds no extra time.'),
    },
    {
      code: 'metrics.bargeCallsPerWeek',
      group: t('SÃ  lan', 'Barge'),
      name: t('Sá»‘ lÆ°á»£t sÃ  lan trung bÃ¬nh / tuáº§n', 'Average barge calls / week'),
      unit: t('lÆ°á»£t', 'calls'),
      kind: 'number',
      min: 0,
      max: 10000,
      note: t('Sá»‘ nguyÃªn hoáº·c sá»‘ tháº­p phÃ¢n. DÃ¹ng Ä‘á»ƒ tÃ­nh mÃ©t-giá» sÃ  lan trong tuáº§n.', 'Integer or decimal. Used for weekly barge meter-hours.'),
    },
    {
      code: 'metrics.bargeLoa',
      group: t('SÃ  lan', 'Barge'),
      name: t('LOA trung bÃ¬nh sÃ  lan', 'Average barge LOA'),
      unit: 'm',
      kind: 'number',
      min: 1,
      max: 500,
      note: meters,
    },
    {
      code: 'metrics.bargeCmph',
      group: t('SÃ  lan', 'Barge'),
      name: t('CMPH sÃ  lan', 'Barge CMPH'),
      unit: t('moves/giá»', 'moves/h'),
      kind: 'number',
      min: 0.1,
      max: 200,
      note: t('NÄƒng suáº¥t xáº¿p dá»¡ trung bÃ¬nh cá»§a má»™t tá»• lÃ m sÃ  lan.', 'Average moves per hour of a barge gang.'),
    },
    {
      code: 'metrics.vesselCmph',
      group: t('TÃ u máº¹', 'Mother vessel'),
      name: t('CMPH máº·c Ä‘á»‹nh tÃ u', 'Default vessel CMPH'),
      unit: t('moves/giá»', 'moves/h'),
      kind: 'number',
      min: 0.1,
      max: 200,
      note: t(
        'DÃ¹ng khi má»™t dÃ²ng dá»‹ch vá»¥ Ä‘á»ƒ trá»‘ng CMPH. NÃªn khá»›p vá»›i nÄƒng suáº¥t cáº©u bá».',
        'Used when a service row leaves CMPH blank. Should match quay-crane productivity.'
      ),
    },
    {
      code: 'metrics.mooringCap',
      group: t('Buá»™c dÃ¢y', 'Mooring'),
      name: t('Tráº§n khoáº£ng cÃ¡ch buá»™c dÃ¢y má»—i Ä‘áº§u', 'Mooring allowance cap, each end'),
      unit: 'm',
      kind: 'number',
      min: 0,
      max: 200,
      note: t(
        'Chiá»u dÃ i chiáº¿m cáº§u = LOA + 2 Ã— min(LOA Ã— tá»· lá»‡ buá»™c dÃ¢y, tráº§n nÃ y). VÃ­ dá»¥ 30.',
        'Berth occupation = LOA + 2 Ã— min(LOA Ã— mooring ratio, this cap). Example: 30.'
      ),
    },
    {
      code: 'metrics.mooringRatio',
      group: t('Buá»™c dÃ¢y', 'Mooring'),
      name: t('Tá»· lá»‡ buá»™c dÃ¢y theo LOA', 'Mooring ratio of LOA'),
      unit: t('tá»· lá»‡ 0â€“1', 'ratio 0â€“1'),
      kind: 'number',
      min: 0,
      max: 1,
      note: ratio + ' ' + t('GiÃ¡ trá»‹ chuáº©n lÃ  0,1 (10% LOA má»—i Ä‘áº§u tÃ u).', 'The standard value is 0.1 (10% of LOA at each end).'),
    },
    {
      code: 'metrics.targetBorPct',
      group: 'BOR',
      name: t('BOR má»¥c tiÃªu', 'Target BOR'),
      unit: '%',
      kind: 'number',
      min: 0,
      max: 100,
      note: pct,
    },
    {
      code: 'metrics.borAlertPct',
      group: 'BOR',
      name: t('NgÆ°á»¡ng cáº£nh bÃ¡o BOR', 'BOR alert threshold'),
      unit: '%',
      kind: 'number',
      min: 0,
      max: 150,
      note: pct + ' ' + t('Tá»« ngÆ°á»¡ng nÃ y há»‡ thá»‘ng báº­t cáº£nh bÃ¡o chiáº¿m cáº§u.', 'At or above this level the system raises an occupancy alert.'),
    },
    {
      code: 'metrics.borSpillPct',
      group: 'BOR',
      name: t('NgÆ°á»¡ng trÃ n sang báº¿n thuÃª', 'Spill-over threshold'),
      unit: '%',
      kind: 'number',
      min: 0,
      max: 150,
      note: pct + ' ' + t('Khi BOR vÆ°á»£t ngÆ°á»¡ng nÃ y, há»‡ thá»‘ng xÃ©t chuyá»ƒn chuyáº¿n sang báº¿n thuÃª ngoÃ i.', 'Above this BOR the system considers diverting a call to a hired berth.'),
    },
    {
      code: 'metrics.waitingTriggerHrs',
      group: 'BOR',
      name: t('NgÆ°á»¡ng giá» chá» kÃ­ch hoáº¡t trÃ n', 'Waiting hours that trigger spill-over'),
      unit: t('giá»', 'h'),
      kind: 'number',
      min: 0,
      max: 168,
      note: hours + ' ' + t('Chá» hÃ¬nh há»c tá»« ngÆ°á»¡ng nÃ y cÅ©ng kÃ­ch hoáº¡t xÃ©t báº¿n thuÃª, ká»ƒ cáº£ khi BOR chÆ°a tá»›i ngÆ°á»¡ng trÃ n.', 'Geometric waiting at or above this also considers a hired berth, even if BOR is still under the spill line.'),
    },
    {
      code: 'metrics.delayPenaltyVndPerHour',
      group: 'BOR',
      name: t('PhÃ­ pháº¡t chá» / giá»', 'Waiting penalty per hour'),
      unit: 'VND/h',
      kind: 'number',
      min: 0,
      note: t(
        'Nháº­p sá»‘ Ä‘á»“ng, khÃ´ng gÃµ dáº¥u cháº¥m ngÄƒn cÃ¡ch. VÃ­ dá»¥ 45000000 lÃ  45 triá»‡u Ä‘á»“ng má»—i giá» chá».',
        'Enter dong as a plain number. Example: 45000000 is 45 million dong per waiting hour.'
      ),
    },
    {
      code: 'metrics.unplannedBreakdownPct',
      group: t('NÄƒng lá»±c', 'Capacity'),
      name: t('Tá»· lá»‡ há»ng báº¥t thÆ°á»ng', 'Unplanned breakdown'),
      unit: '%',
      kind: 'number',
      min: 0,
      max: 100,
      note: pct + ' ' + t('Trá»« vÃ o nÄƒng lá»±c thiáº¿t káº¿ khi Æ°á»›c lÆ°á»£ng sáº£n lÆ°á»£ng thá»±c.', 'Subtracted from design capacity when estimating achievable moves.'),
    },
    {
      code: 'equipment.gateMovesDesigned',
      group: t('BÃ£i CY', 'CY yard'),
      name: t('Moves cá»•ng thiáº¿t káº¿ / nÄƒm', 'Designed gate moves / year'),
      unit: t('moves/nÄƒm', 'moves/year'),
      kind: 'number',
      min: 0,
      note: t(
        'Cá»™ng vÃ o moves bÃ£i = moves cáº§u + moves cá»•ng + Ä‘áº£o chuyá»ƒn. Nháº­p sá»‘ nguyÃªn.',
        'Added to yard moves = quay + gate + rehandles. Enter a whole number.'
      ),
    },
    {
      code: 'equipment.rehandleRatio',
      group: t('BÃ£i CY', 'CY yard'),
      name: t('Tá»· lá»‡ Ä‘áº£o chuyá»ƒn', 'Rehandle ratio'),
      unit: t('tá»· lá»‡ 0â€“1', 'ratio 0â€“1'),
      kind: 'number',
      min: 0,
      max: 1,
      note: ratio + ' ' + t('Moves Ä‘áº£o chuyá»ƒn = moves cáº©u bá» Ã— tá»· lá»‡ nÃ y. 0,1 = 10%.', 'Rehandles = quay moves Ã— this ratio. 0.1 = 10%.'),
    },
    {
      code: 'secondary.name',
      group: t('Báº¿n phá»¥', 'Secondary berth'),
      name: t('TÃªn báº¿n phá»¥', 'Secondary berth name'),
      unit: t('chá»¯', 'text'),
      kind: 'text',
      note: t('TÃªn cáº§u Ä‘ang váº½ á»Ÿ má»¥c Báº¿n thuÃª ngoÃ i. KhÃ´ng Ä‘á»ƒ trá»‘ng.', 'Name of the berth drawn on External Berth. Required.'),
    },
    {
      code: 'secondary.quayLength',
      group: t('Báº¿n phá»¥', 'Secondary berth'),
      name: t('Chiá»u dÃ i báº¿n phá»¥', 'Secondary quay length'),
      unit: 'm',
      kind: 'number',
      min: 50,
      max: 5000,
      note: meters + ' ' + t('Cáº©u á»Ÿ sheet Cau ben phu pháº£i náº±m trong chiá»u dÃ i nÃ y. Má»—i cáº©u chiáº¿m 30 m.', 'Cranes on Cau ben phu must fit inside this length. Each crane is 30 m wide.'),
    },
  ];
}

const PARAM_HEADERS = {
  vi: ['code', 'NhÃ³m', 'ThÃ´ng sá»‘', 'value', 'ÄÆ¡n vá»‹', 'CÃ¡ch nháº­p'],
  en: ['code', 'Group', 'Parameter', 'value', 'Unit', 'How to fill'],
};

function getPath(model, code) {
  const [root, key] = code.split('.');
  if (root === 'terminal') return model.terminal?.[key];
  if (root === 'metrics') return model.metrics?.[key];
  if (root === 'equipment') return model.equipment?.[key];
  if (root === 'secondary') return model.secondaryBerth?.[key];
  return undefined;
}

function guideRows(locale) {
  const t = (vi, en) => text(locale, vi, en);
  return [
    [t('CÃCH DÃ™NG FILE NÃ€Y', 'HOW TO USE THIS FILE')],
    [''],
    [
      t(
        'File lÃ  bá»™ thÃ´ng sá»‘ tÃ­nh toÃ¡n cá»§a Há»‡ thá»‘ng NÄƒng lá»±c Váº­n hÃ nh Cáº§u báº¿n. Chá»‰ sá»­a sá»‘ liá»‡u. KhÃ´ng Ä‘á»•i tÃªn sheet, khÃ´ng Ä‘á»•i cá»™t code / value, khÃ´ng xÃ³a dÃ²ng tiÃªu Ä‘á».',
        'This file is the calculation input set for the Berth Operations Capacity System. Edit values only. Do not rename sheets, do not rename the code / value columns, and do not delete header rows.'
      ),
    ],
    [''],
    [t('CÃC BÆ¯á»šC', 'STEPS')],
    [
      t(
        '1. Sá»­a cá»™t value trÃªn sheet Thong so. Má»—i dÃ²ng lÃ  má»™t chá»‰ sá»‘. Äá»c cá»™t CÃ¡ch nháº­p trÆ°á»›c khi gÃµ.',
        '1. Edit the value column on Thong so. Each row is one indicator. Read How to fill before typing.'
      ),
    ],
    [
      t(
        '2. CÃ¡c sheet cÃ²n láº¡i lÃ  báº£ng: má»™t dÃ²ng lÃ  má»™t chuyáº¿n, má»™t cáº©u, má»™t ca báº£o trÃ¬ hoáº·c má»™t báº¿n thuÃª. ThÃªm dÃ²ng má»›i á»Ÿ phÃ­a dÆ°á»›i Ä‘á»ƒ thÃªm má»¥c. XÃ³a cáº£ dÃ²ng Ä‘á»ƒ bá» má»¥c Ä‘Ã³ khá»i há»‡ thá»‘ng.',
        '2. Other sheets are tables: one row is one call, crane, maintenance window, or hired berth. Add a row at the bottom to add an item. Delete the whole row to remove it.'
      ),
    ],
    [
      t(
        '3. DÃ²ng 2 cá»§a má»—i báº£ng lÃ  mÃ£ cá»™t (áº©n). KhÃ´ng hiá»‡n, khÃ´ng xÃ³a, khÃ´ng Ä‘á»•i chá»¯. Khi thÃªm dÃ²ng má»›i, Ä‘á»ƒ trá»‘ng cá»™t id â€” há»‡ thá»‘ng sáº½ tá»± cáº¥p mÃ£.',
        '3. Row 2 of each table is the hidden column code. Do not unhide, delete, or edit it. For a new row, leave id blank â€” the system assigns an id.'
      ),
    ],
    [
      t(
        '4. LÆ°u file Excel (.xlsx) rá»“i báº¥m Nháº­p Excel trÃªn há»‡ thá»‘ng. Náº¿u cÃ³ Ã´ sai, há»‡ thá»‘ng khÃ´ng ghi Ä‘Ã¨ sá»‘ Ä‘ang cháº¡y vÃ  sáº½ liá»‡t kÃª lá»—i Ä‘á»ƒ sá»­a.',
        '4. Save the .xlsx file and press Upload Excel in the system. If any cell is invalid, current numbers stay unchanged and the system lists what to fix.'
      ),
    ],
    [''],
    [t('QUY Æ¯á»šC NHáº¬P LIá»†U', 'ENTRY RULES')],
    [
      t(
        'Sá»‘: chá»‰ nháº­p sá»‘. KhÃ´ng gÃµ Ä‘Æ¡n vá»‹ (m, %, giá») vÃ o Ã´ giÃ¡ trá»‹. Pháº§n tháº­p phÃ¢n cÃ³ thá»ƒ dÃ¹ng dáº¥u pháº©y hoáº·c dáº¥u cháº¥m: 0,5 vÃ  0.5 Ä‘á»u Ä‘Æ°á»£c.',
        'Numbers: enter a number only. Do not type units (m, %, hours) into the value cell. Decimals may use a comma or a dot: 0.5 and 0,5 both work.'
      ),
    ],
    [
      t(
        'Pháº§n trÄƒm 0â€“100 (BOR, há»ng hÃ³c, nÄƒng lá»±c báº£o trÃ¬): nháº­p 60 cho 60%. KhÃ´ng nháº­p 0,6.',
        'Percents 0â€“100 (BOR, breakdown, maintenance capacity): enter 60 for 60%. Do not enter 0.6.'
      ),
    ],
    [
      t(
        'Tá»· lá»‡ 0â€“1 (sÃ  lan/tÃ u, buá»™c dÃ¢y, sáºµn sÃ ng mÃ¡y, sá»­ dá»¥ng mÃ¡y, Ä‘áº£o chuyá»ƒn): nháº­p 0,92 cho 92%. KhÃ´ng nháº­p 92.',
        'Ratios 0â€“1 (barge/vessel, mooring, machine availability, utilization, rehandles): enter 0.92 for 92%. Do not enter 92.'
      ),
    ],
    [
      t(
        'NgÃ y: T2 T3 T4 T5 T6 T7 CN hoáº·c Mon Tue Wed Thu Fri Sat Sun. Giá»: 14:00 theo Ä‘á»“ng há»“ 24 giá».',
        'Days: T2 T3 T4 T5 T6 T7 CN or Mon Tue Wed Thu Fri Sat Sun. Time: 14:00 on a 24-hour clock.'
      ),
    ],
    [
      t(
        'MÃ u dá»‹ch vá»¥: mÃ£ hex nhÆ° #0e7490, hoáº·c Ä‘á»ƒ trá»‘ng Ä‘á»ƒ há»‡ thá»‘ng tá»± gÃ¡n. CÃ¹ng mÃ£ dá»‹ch vá»¥ dÃ¹ng cÃ¹ng má»™t mÃ u.',
        'Service color: a hex code such as #0e7490, or leave blank and the system assigns one. The same service code shares one color.'
      ),
    ],
    [''],
    [t('SHEET NÃ€O CHá»¨A GÃŒ', 'WHAT EACH SHEET HOLDS')],
    [
      t(
        'Thong so â€” toÃ n bá»™ chá»‰ sá»‘ Ä‘Æ¡n: cáº§u chÃ­nh, lá»‹ch lÃ m viá»‡c, tÃ u, sÃ  lan, BOR, cá»•ng, Ä‘áº£o chuyá»ƒn, tÃªn vÃ  chiá»u dÃ i báº¿n phá»¥.',
        'Thong so â€” every single-value indicator: main quay, calendar, vessels, barges, BOR, gate, rehandles, secondary berth name and length.'
      ),
    ],
    [
      t(
        'Dich vu â€” proforma tuáº§n. LOA mÃ©t, sáº£n lÆ°á»£ng moves, ngÃ y giá» ETB/ETD, CMPH cá»§a tá»«ng cá»­a sá»•. Giá» chiáº¿m cáº§u = giá» cáº­p + giá» rá»i + khoáº£ng ETB tá»›i ETD. Loáº¡i tuyáº¿n: co dinh láº·p tuáº§n (cÃ³ % lá»‡ch sáº£n lÆ°á»£ng vÃ  giá» cáº­p) hoáº·c ad hoc khÃ´ng láº·p. HÆ°á»›ng cáº­p: thuong luu sÃ¡t má»‘c 0, ha luu sÃ¡t chiá»u dÃ i cáº§u Ä‘ang khai bÃ¡o.',
        'Dich vu â€” weekly proforma. LOA in meters, volume in moves, ETB/ETD day and time, CMPH of each window. Berth hours = arrival + departure + ETB to ETD. Line kind: fixed repeats weekly (with volume and berth-time swing %) or ad hoc does not repeat. Berthing end: upstream is wharf mark 0, downstream is the current quay length.',
      ),
    ],
    [
      t(
        'Thiet bi CY â€” STS, RTG, RS, EH. NÄƒng lá»±c = CMPH Ã— sá»‘ mÃ¡y Ã— giá»/nÄƒm Ã— sáºµn sÃ ng Ã— sá»­ dá»¥ng. DÃ²ng STS: sá»‘ mÃ¡y vÃ  CMPH láº¥y tá»« sheet Cau bo (sá»‘ cáº©u vÃ  mph trung bÃ¬nh). á»ž dÃ²ng STS chá»‰ cáº§n Ä‘Ãºng há»‡ sá»‘ sáºµn sÃ ng vÃ  há»‡ sá»‘ sá»­ dá»¥ng.',
        'Thiet bi CY â€” STS, RTG, RS, EH. Capacity = CMPH Ã— count Ã— hours/year Ã— availability Ã— utilization. STS count and CMPH come from Cau bo (crane count and average mph). On the STS row, only availability and utilization are taken from this sheet.'
      ),
    ],
    [
      t(
        'Cau bo â€” tá»«ng cáº©u cáº§u chÃ­nh. Má»—i cáº©u rá»™ng 30 m. positionM lÃ  mÃ©t báº¯t Ä‘áº§u thÃ¢n cáº©u, pháº£i náº±m trong chiá»u dÃ i cáº§u vÃ  khÃ´ng Ä‘Ã¨ lÃªn cáº©u khÃ¡c. order = 1 lÃ  cáº©u phÃ­a mÃ©t nhá».',
        'Cau bo â€” each main-quay crane. Every crane is 30 m wide. positionM is the start meter of the crane, must sit inside the quay and must not overlap another crane. order = 1 is the crane toward the low meter mark.'
      ),
    ],
    [
      t(
        'Bao tri â€” khung thá»i gian Ä‘Ã³ng má»™t Ä‘oáº¡n cáº§u. capacityPct = 0 lÃ  Ä‘Ã³ng hoÃ n toÃ n. fromMeter + lengthM khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ chiá»u dÃ i cáº§u chÃ­nh.',
        'Bao tri â€” time windows that close a quay segment. capacityPct = 0 means fully closed. fromMeter + lengthM must not exceed the main quay length.'
      ),
    ],
    [
      t(
        'Cau ben phu â€” cáº©u cá»§a báº¿n phá»¥. CÃ¹ng quy táº¯c 30 m, náº±m trong chiá»u dÃ i báº¿n phá»¥ á»Ÿ sheet Thong so.',
        'Cau ben phu â€” cranes of the secondary berth. Same 30 m rule, inside the secondary length on Thong so.'
      ),
    ],
    [
      t(
        'Ben thue â€” báº¿n thuÃª ngoÃ i dÃ¹ng khi BOR hoáº·c giá» chá» vÆ°á»£t ngÆ°á»¡ng. maxLoa vÃ  quayLength pháº£i Ä‘á»§ cho tÃ u Ä‘Æ°á»£c xÃ©t chuyá»ƒn. hireVnd lÃ  tiá»n thuÃª má»™t chuyáº¿n, báº±ng sá»‘ Ä‘á»“ng.',
        'Ben thue â€” hired berths used when BOR or waiting exceeds the threshold. maxLoa and quayLength must fit the call being considered. hireVnd is the hire of one call, in dong as a plain number.'
      ),
    ],
  ];
}

function tableSpec(locale) {
  const t = (vi, en) => text(locale, vi, en);
  const dayNote = t('T2â€“T7, CN hoáº·c Monâ€“Sun.', 'T2â€“T7, CN or Monâ€“Sun.');
  const timeNote = t('Dáº¡ng 14:00.', 'Use 14:00.');
  return {
    [SHEET.services]: {
      keys: [
        'id',
        'service',
        'vesselName',
        'loa',
        'volume',
        'expectedVolume',
        'etbDay',
        'etbTime',
        'etdDay',
        'etdTime',
        'cmph',
        'color',
        'lineKind',
        'volumeChangePct',
        'timeChangePct',
        'berthSide',
      ],
      titles: [
        'id',
        t('MÃ£ dá»‹ch vá»¥', 'Service code'),
        t('TÃªn tÃ u', 'Vessel name'),
        'LOA (m)',
        t('Sáº£n lÆ°á»£ng (moves)', 'Volume (moves)'),
        t('Sáº£n lÆ°á»£ng dá»± kiáº¿n (moves)', 'Expected volume (moves)'),
        'ETB ' + t('ngÃ y', 'day'),
        'ETB ' + t('giá»', 'time'),
        'ETD ' + t('ngÃ y', 'day'),
        'ETD ' + t('giá»', 'time'),
        'CMPH',
        t('MÃ u #hex', 'Color #hex'),
        t('Loáº¡i tuyáº¿n', 'Line kind'),
        t('Lá»‡ch sáº£n lÆ°á»£ng %', 'Volume swing %'),
        t('Lá»‡ch giá» cáº­p %', 'Berth-time swing %'),
        t('HÆ°á»›ng cáº­p', 'Berthing end'),
      ],
      notes: [
        t('Äá»ƒ trá»‘ng náº¿u thÃªm dÃ²ng má»›i.', 'Leave blank for a new row.'),
        t('Báº¯t buá»™c. VÃ­ dá»¥ VCS. CÃ¹ng mÃ£ sáº½ dÃ¹ng chung má»™t mÃ u.', 'Required. Example: VCS. The same code shares one color.'),
        t('TÃªn tÃ u hiá»ƒn thá»‹ trÃªn káº¿ hoáº¡ch.', 'Vessel name shown on the plan.'),
        t('Chiá»u dÃ i tÃ u, mÃ©t, lá»›n hÆ¡n 0.', 'Vessel length in meters, greater than 0.'),
        t('Moves káº¿ hoáº¡ch cá»§a chuyáº¿n, â‰¥ 0.', 'Planned moves of the call, â‰¥ 0.'),
        t('Moves dá»± kiáº¿n thá»±c táº¿, â‰¥ 0. DÃ¹ng cho so sÃ¡nh sáº£n lÆ°á»£ng.', 'Expected actual moves, â‰¥ 0. Used for volume comparison.'),
        dayNote,
        timeNote,
        dayNote,
        timeNote,
        t('Moves/giá» cá»§a chuyáº¿n nÃ y. Lá»›n hÆ¡n 0.', 'Moves per hour of this call. Greater than 0.'),
        t('VÃ­ dá»¥ #0e7490 hoáº·c Ä‘á»ƒ trá»‘ng.', 'Example #0e7490 or leave blank.'),
        t('co dinh hoáº·c ad hoc. Cá»‘ Ä‘á»‹nh láº·p má»—i tuáº§n. Ad hoc chá»‰ cÃ³ á»Ÿ tuáº§n Ä‘ang xáº¿p.', 'fixed or ad hoc. Fixed repeats every week. Ad hoc stays only in the current week.'),
        t('0â€“100. Pháº§n trÄƒm sáº£n lÆ°á»£ng tuáº§n láº·p Ä‘Æ°á»£c phÃ©p lá»‡ch khá»i proforma. Äá»ƒ trá»‘ng = 0.', '0â€“100. Percent a repeated week may swing from proforma volume. Blank = 0.'),
        t('0â€“100. Pháº§n trÄƒm giá» cáº­p tuáº§n láº·p Ä‘Æ°á»£c phÃ©p lá»‡ch. Äá»ƒ trá»‘ng = 0.', '0â€“100. Percent a repeated week may swing berth time. Blank = 0.'),
        t('thuong luu (sÃ¡t má»‘c 0) hoáº·c ha luu (sÃ¡t má»‘c cuá»‘i cáº§u Ä‘ang cÃ i). Äá»ƒ trá»‘ng thÃ¬ giá»¯ chá»— Ä‘ang xáº¿p.', 'upstream (wharf mark 0) or downstream (current quay end). Blank keeps the current berth position.'),
      ],
    },
    [SHEET.fleet]: {
      keys: ['type', 'cmph', 'count', 'availableHrsPerYear', 'availability', 'utilization'],
      titles: [
        t('Loáº¡i', 'Type'),
        'CMPH',
        t('Sá»‘ mÃ¡y', 'Count'),
        t('Giá»/nÄƒm', 'Hours/year'),
        t('Sáºµn sÃ ng (0â€“1)', 'Availability (0â€“1)'),
        t('Sá»­ dá»¥ng (0â€“1)', 'Utilization (0â€“1)'),
      ],
      notes: [
        t('ÄÃºng má»™t dÃ²ng cho má»—i loáº¡i: STS, RTG, RS, EH. KhÃ´ng thÃªm loáº¡i khÃ¡c.', 'Exactly one row per type: STS, RTG, RS, EH. Do not add another type.'),
        t('Vá»›i RTG, RS, EH: moves/giá» má»—i mÃ¡y. Vá»›i STS: há»‡ thá»‘ng láº¥y mph trung bÃ¬nh cá»§a sheet Cau bo.', 'For RTG, RS, EH: moves/hour per machine. For STS: the system uses the average mph from Cau bo.'),
        t('Vá»›i RTG, RS, EH: sá»‘ mÃ¡y â‰¥ 0. Vá»›i STS: há»‡ thá»‘ng láº¥y sá»‘ dÃ²ng á»Ÿ Cau bo.', 'For RTG, RS, EH: machine count â‰¥ 0. For STS: the system uses the number of rows on Cau bo.'),
        t('ThÆ°á»ng 8760. NÄƒng lá»±c = CMPH Ã— sá»‘ mÃ¡y Ã— giá» nÃ y Ã— sáºµn sÃ ng Ã— sá»­ dá»¥ng.', 'Usually 8760. Capacity = CMPH Ã— count Ã— this Ã— availability Ã— utilization.'),
        t('0â€“1. VÃ­ dá»¥ 0,92 = mÃ¡y sáºµn sÃ ng 92% thá»i gian. KhÃ´ng nháº­p 92.', '0â€“1. Example: 0.92 = the machine is available 92% of the time. Do not enter 92.'),
        t('0â€“1. VÃ­ dá»¥ 0,8 = sá»­ dá»¥ng 80% giá» sáºµn sÃ ng. KhÃ´ng nháº­p 80.', '0â€“1. Example: 0.8 = used for 80% of available hours. Do not enter 80.'),
      ],
    },
    [SHEET.cranes]: {
      keys: ['id', 'name', 'mph', 'order', 'positionM'],
      titles: ['id', t('TÃªn cáº©u', 'Crane name'), 'MPH', t('Thá»© tá»±', 'Order'), t('MÃ©t báº¯t Ä‘áº§u', 'Start meter')],
      notes: [
        t('Äá»ƒ trá»‘ng náº¿u thÃªm cáº©u má»›i.', 'Leave blank for a new crane.'),
        t('TÃªn hiá»ƒn thá»‹, vÃ­ dá»¥ Crane-01.', 'Display name, for example Crane-01.'),
        t('Moves/giá» cá»§a cáº©u. Trung bÃ¬nh cÃ¡c cáº©u nÃ y trá»Ÿ thÃ nh CMPH cá»§a STS.', 'Moves per hour. The average becomes the STS CMPH.'),
        t('1, 2, 3â€¦ theo hÆ°á»›ng tá»« mÃ©t nhá» tá»›i mÃ©t lá»›n.', '1, 2, 3â€¦ from the low meter mark toward the high one.'),
        t('MÃ©t báº¯t Ä‘áº§u thÃ¢n cáº©u. Cáº©u dÃ i 30 m, pháº£i náº±m trá»n trong cáº§u vÃ  khÃ´ng chá»“ng lÃªn cáº©u káº¿.', 'Start meter of the crane body. A crane is 30 m long, must fit on the quay, and must not overlap the next crane.'),
      ],
    },
    [SHEET.maintenance]: {
      keys: ['id', 'reason', 'fromMeter', 'lengthM', 'capacityPct', 'etbDay', 'etbTime', 'etdDay', 'etdTime'],
      titles: [
        'id',
        t('LÃ½ do', 'Reason'),
        t('Tá»« mÃ©t', 'From meter'),
        t('Chiá»u dÃ i (m)', 'Length (m)'),
        t('NÄƒng lá»±c cÃ²n (%)', 'Remaining capacity (%)'),
        t('Tá»« ngÃ y', 'From day'),
        t('Tá»« giá»', 'From time'),
        t('Äáº¿n ngÃ y', 'To day'),
        t('Äáº¿n giá»', 'To time'),
      ],
      notes: [
        t('Äá»ƒ trá»‘ng náº¿u thÃªm ca má»›i. XÃ³a háº¿t dÃ²ng náº¿u tuáº§n khÃ´ng báº£o trÃ¬.', 'Leave blank for a new window. Delete all rows if the week has no maintenance.'),
        t('TÃªn hiá»ƒn thá»‹ trÃªn káº¿ hoáº¡ch.', 'Name shown on the plan.'),
        t('MÃ©t báº¯t Ä‘áº§u Ä‘oáº¡n báº£o trÃ¬, â‰¥ 0.', 'Start meter of the maintenance stretch, â‰¥ 0.'),
        t('Äá»™ dÃ i Ä‘oáº¡n, mÃ©t. fromMeter + lengthM khÃ´ng vÆ°á»£t quÃ¡ chiá»u dÃ i cáº§u chÃ­nh.', 'Length in meters. fromMeter + lengthM must not pass the main quay length.'),
        t('0 = Ä‘Ã³ng hoÃ n toÃ n (khÃ´ng xáº¿p dá»¡). 50 = cÃ²n 50% nÄƒng lá»±c. Nháº­p 0â€“100.', '0 = fully closed. 50 = 50% capacity left. Enter 0â€“100.'),
        dayNote,
        timeNote,
        dayNote,
        timeNote,
      ],
    },
    [SHEET.secondaryCranes]: {
      keys: ['id', 'name', 'mph', 'order', 'positionM'],
      titles: ['id', t('TÃªn cáº©u', 'Crane name'), 'MPH', t('Thá»© tá»±', 'Order'), t('MÃ©t báº¯t Ä‘áº§u', 'Start meter')],
      notes: [
        t('Äá»ƒ trá»‘ng náº¿u thÃªm cáº©u má»›i.', 'Leave blank for a new crane.'),
        t('TÃªn cáº©u trÃªn báº¿n phá»¥.', 'Crane name on the secondary berth.'),
        t('Moves/giá», lá»›n hÆ¡n 0.', 'Moves per hour, greater than 0.'),
        t('Thá»© tá»± 1, 2, 3.', 'Order 1, 2, 3.'),
        t('MÃ©t báº¯t Ä‘áº§u. Cáº©u dÃ i 30 m vÃ  pháº£i náº±m trong chiá»u dÃ i báº¿n phá»¥.', 'Start meter. The crane is 30 m and must fit the secondary length.'),
      ],
    },
    [SHEET.external]: {
      keys: ['id', 'name', 'partner', 'quayLength', 'draftM', 'maxLoa', 'towNm', 'hireVnd'],
      titles: [
        'id',
        t('TÃªn báº¿n', 'Berth name'),
        t('Äá»‘i tÃ¡c', 'Partner'),
        t('Chiá»u dÃ i cáº§u (m)', 'Quay length (m)'),
        t('Má»›n nÆ°á»›c (m)', 'Draft (m)'),
        t('LOA tá»‘i Ä‘a (m)', 'Max LOA (m)'),
        t('KÃ©o tÃ u (háº£i lÃ½)', 'Tow (nm)'),
        t('GiÃ¡ thuÃª / chuyáº¿n (VND)', 'Hire / call (VND)'),
      ],
      notes: [
        t('Äá»ƒ trá»‘ng náº¿u thÃªm báº¿n má»›i.', 'Leave blank for a new berth.'),
        t('TÃªn báº¿n thuÃª. Báº¯t buá»™c.', 'Hired berth name. Required.'),
        t('TÃªn Ä‘Æ¡n vá»‹ liÃªn káº¿t. CÃ³ thá»ƒ Ä‘á»ƒ trá»‘ng.', 'Linked operator. May be blank.'),
        t('Pháº£i â‰¥ LOA cá»§a tÃ u Ä‘Æ°á»£c chuyá»ƒn, tÃ­nh báº±ng mÃ©t.', 'Must be at least the LOA of the diverted vessel, in meters.'),
        t('Má»›n khai thÃ¡c, mÃ©t.', 'Working draft, meters.'),
        t('TÃ u dÃ i hÆ¡n má»©c nÃ y khÃ´ng Ä‘Æ°á»£c chá»n báº¿n nÃ y.', 'A longer vessel cannot be assigned here.'),
        t('Khoáº£ng cÃ¡ch lai dáº¯t, háº£i lÃ½.', 'Tow distance, nautical miles.'),
        t('Sá»‘ Ä‘á»“ng cho má»™t chuyáº¿n, khÃ´ng gÃµ dáº¥u cháº¥m. VÃ­ dá»¥ 850000000.', 'Dong for one call, without separators. Example: 850000000.'),
      ],
    },
  };
}

function sheetFromAoa(rows, widths) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths.map((wch) => ({ wch }));
  return ws;
}

function tableRows(spec, records, pick) {
  const body = records.map((row) => spec.keys.map((key) => pick(row, key)));
  return [spec.titles, spec.keys, spec.notes, ...body];
}

function readSheet(wb, name) {
  const found = wb.SheetNames.find((n) => normHeader(n) === normHeader(name));
  return found ? wb.Sheets[found] : null;
}

function matrix(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
}

function requireSheet(wb, name, errors, locale) {
  const sheet = readSheet(wb, name);
  if (!sheet) {
    errors.push({
      sheet: name,
      row: 0,
      message: text(
        locale,
        `Thiáº¿u sheet "${name}". HÃ£y dÃ¹ng Ä‘Ãºng file máº«u, khÃ´ng Ä‘á»•i tÃªn sheet.`,
        `Missing sheet "${name}". Use the template and do not rename sheets.`
      ),
    });
  }
  return sheet;
}

function readKeyedTable(sheet, spec, errors, locale, sheetName) {
  const rows = matrix(sheet);
  const keys = (rows[1] || []).map((cell) => String(cell ?? '').trim());
  const expected = spec.keys.join('|');
  if (keys.join('|') !== expected) {
    errors.push({
      sheet: sheetName,
      row: 2,
      message: text(
        locale,
        'DÃ²ng mÃ£ cá»™t (dÃ²ng 2) bá»‹ sá»­a hoáº·c bá»‹ xÃ³a. HÃ£y táº£i láº¡i file máº«u vÃ  chá»‰ sá»­a sá»‘ liá»‡u tá»« dÃ²ng 4.',
        'The column-code row (row 2) was changed or deleted. Download a fresh template and edit data from row 4 only.'
      ),
    });
    return [];
  }
  const out = [];
  for (let i = 3; i < rows.length; i += 1) {
    const line = rows[i] || [];
    if (line.every((cell) => String(cell ?? '').trim() === '')) continue;
    const obj = {};
    spec.keys.forEach((key, idx) => {
      obj[key] = line[idx];
    });
    out.push({ row: i + 1, obj });
  }
  return out;
}

function pushError(errors, sheet, row, message) {
  errors.push({ sheet, row, message });
}

function readText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function foldToken(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function readLineKind(value) {
  const s = foldToken(value);
  if (!s) return 'fixed';
  if (s === 'fixed' || s === 'co dinh' || s === 'codinh') return 'fixed';
  if (s === 'ad hoc' || s === 'adhoc' || s === 'cong them') return 'adhoc';
  return null;
}

function readBerthSide(value) {
  const s = foldToken(value);
  if (!s) return '';
  if (s === 'upstream' || s === 'thuong luu' || s === 'thuongluu') return 'upstream';
  if (s === 'downstream' || s === 'ha luu' || s === 'haluu') return 'downstream';
  return null;
}

function optionalPercent(errors, locale, sheet, row, label, value) {
  if (value == null || String(value).trim() === '') return 0;
  return needNumber(errors, locale, sheet, row, label, value, { min: 0, max: 100 }) ?? 0;
}

function needNumber(errors, locale, sheet, row, label, value, { min, max, integer = false } = {}) {
  const n = parseNumber(value);
  if (n == null) {
    pushError(
      errors,
      sheet,
      row,
      text(locale, `${label}: Ã´ trá»‘ng hoáº·c khÃ´ng pháº£i sá»‘.`, `${label}: empty or not a number.`)
    );
    return null;
  }
  if (min != null && n < min) {
    pushError(errors, sheet, row, text(locale, `${label}: pháº£i â‰¥ ${min}.`, `${label}: must be â‰¥ ${min}.`));
    return null;
  }
  if (max != null && n > max) {
    pushError(errors, sheet, row, text(locale, `${label}: pháº£i â‰¤ ${max}.`, `${label}: must be â‰¤ ${max}.`));
    return null;
  }
  if (integer && Math.round(n) !== n) {
    pushError(errors, sheet, row, text(locale, `${label}: pháº£i lÃ  sá»‘ nguyÃªn.`, `${label}: must be a whole number.`));
    return null;
  }
  return n;
}

function needDay(errors, locale, sheet, row, label, value) {
  const day = parseDay(value);
  if (!day) {
    pushError(
      errors,
      sheet,
      row,
      text(locale, `${label}: nháº­p T2â€“T7, CN hoáº·c Monâ€“Sun.`, `${label}: use T2â€“T7, CN or Monâ€“Sun.`)
    );
    return null;
  }
  return day;
}

function needTime(errors, locale, sheet, row, label, value) {
  const time = parseTime(value);
  if (!time) {
    pushError(errors, sheet, row, text(locale, `${label}: nháº­p giá» dáº¡ng 14:00.`, `${label}: use a time like 14:00.`));
    return null;
  }
  return time;
}

function needId(raw, prefix, used) {
  let id = readText(raw);
  if (!id) id = `${prefix}-${used.size + 1}`;
  const base = id;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function checkCranes(rows, quayLength, errors, locale, sheetName) {
  const laid = [...rows].sort((a, b) => a.positionM - b.positionM || a.order - b.order);
  laid.forEach((crane) => {
    const pos = clampCranePosition(crane.positionM, quayLength);
    if (Math.abs(pos - crane.positionM) > 0.05) {
      pushError(
        errors,
        sheetName,
        crane.sourceRow,
        text(
          locale,
          `${crane.name}: mÃ©t báº¯t Ä‘áº§u ${crane.positionM} khÃ´ng náº±m vá»«a cáº§u dÃ i ${quayLength} m (cáº©u chiáº¿m ${CRANE_WIDTH_M} m).`,
          `${crane.name}: start meter ${crane.positionM} does not fit a ${quayLength} m quay (a crane uses ${CRANE_WIDTH_M} m).`
        )
      );
    }
  });
  for (let i = 1; i < laid.length; i += 1) {
    if (laid[i].positionM < laid[i - 1].positionM + CRANE_WIDTH_M - 0.05) {
      pushError(
        errors,
        sheetName,
        laid[i].sourceRow,
        text(
          locale,
          `${laid[i].name} chá»“ng lÃªn ${laid[i - 1].name}. Má»—i cáº©u cáº§n 30 m riÃªng.`,
          `${laid[i].name} overlaps ${laid[i - 1].name}. Each crane needs its own 30 m.`
        )
      );
    }
  }
}

function parseCranes(records, errors, locale, sheetName, quayLength) {
  const used = new Set();
  const cranes = records.map(({ row, obj }, index) => {
    const name = readText(obj.name) || `Crane-${pad2(index + 1)}`;
    const mph = needNumber(errors, locale, sheetName, row, `${name} MPH`, obj.mph, { min: 0.1, max: 200 });
    const order = needNumber(errors, locale, sheetName, row, `${name} order`, obj.order, {
      min: 1,
      max: 500,
      integer: true,
    });
    const positionM = needNumber(errors, locale, sheetName, row, `${name} positionM`, obj.positionM, {
      min: 0,
      max: 5000,
    });
    return {
      id: needId(obj.id, 'crn', used),
      name,
      mph: mph ?? 0,
      order: order ?? index + 1,
      positionM: positionM ?? 0,
      sourceRow: row,
    };
  });
  if (!errors.some((e) => e.sheet === sheetName) && quayLength >= 50) {
    checkCranes(cranes, quayLength, errors, locale, sheetName);
  }
  return cranes
    .sort((a, b) => a.order - b.order || a.positionM - b.positionM)
    .map(({ sourceRow, ...crane }, index) => ({ ...crane, order: index + 1, sourceRow }));
}

export function buildParameterWorkbook(model, locale = 'vi') {
  const lang = locale === 'en' ? 'en' : 'vi';
  const catalog = fieldCatalog(lang);
  const specs = tableSpec(lang);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, sheetFromAoa(guideRows(lang), [110]), SHEET.guide);

  const paramHeader = PARAM_HEADERS[lang];
  const paramBody = catalog.map((field) => [
    field.code,
    field.group,
    field.name,
    getPath(model, field.code) ?? '',
    field.unit,
    field.note,
  ]);
  const paramSheet = sheetFromAoa(
    [
      paramHeader,
      [
        text(lang, 'KhÃ´ng sá»­a', 'Do not edit'),
        text(lang, 'KhÃ´ng sá»­a', 'Do not edit'),
        text(lang, 'KhÃ´ng sá»­a', 'Do not edit'),
        text(lang, 'CHá»ˆ Sá»¬A Cá»˜T NÃ€Y', 'EDIT THIS COLUMN ONLY'),
        text(lang, 'KhÃ´ng sá»­a', 'Do not edit'),
        text(lang, 'Äá»c trÆ°á»›c khi nháº­p', 'Read before entering'),
      ],
      ...paramBody,
    ],
    [34, 18, 42, 18, 16, 88]
  );
  XLSX.utils.book_append_sheet(wb, paramSheet, SHEET.params);

  const services = model.services || [];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromAoa(
      tableRows(specs[SHEET.services], services, (row, key) => (row[key] == null ? '' : row[key])),
      [16, 16, 28, 12, 18, 24, 14, 12, 14, 12, 12, 14]
    ),
    SHEET.services
  );

  const fleet = FLEET_TYPES.map((type) => {
    const found = (model.equipment?.fleet || []).find((row) => row.type === type) || {};
    return {
      type,
      cmph: found.cmph ?? '',
      count: found.count ?? '',
      availableHrsPerYear: found.availableHrsPerYear ?? 8760,
      availability: found.availability ?? '',
      utilization: found.utilization ?? '',
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromAoa(
      tableRows(specs[SHEET.fleet], fleet, (row, key) => row[key]),
      [12, 12, 12, 14, 18, 18]
    ),
    SHEET.fleet
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromAoa(
      tableRows(specs[SHEET.cranes], model.cranes || [], (row, key) => (row[key] == null ? '' : row[key])),
      [16, 18, 12, 12, 16]
    ),
    SHEET.cranes
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromAoa(
      tableRows(specs[SHEET.maintenance], model.lockZones || [], (row, key) => (row[key] == null ? '' : row[key])),
      [14, 28, 12, 14, 18, 12, 12, 12, 12]
    ),
    SHEET.maintenance
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromAoa(
      tableRows(
        specs[SHEET.secondaryCranes],
        model.secondaryBerth?.cranes || [],
        (row, key) => (row[key] == null ? '' : row[key])
      ),
      [16, 18, 12, 12, 16]
    ),
    SHEET.secondaryCranes
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromAoa(
      tableRows(specs[SHEET.external], model.externalBerths || [], (row, key) => (row[key] == null ? '' : row[key])),
      [14, 22, 22, 16, 14, 16, 16, 24]
    ),
    SHEET.external
  );

  Object.values(SHEET).forEach((name) => {
    if (name === SHEET.guide || name === SHEET.params) return;
    const ws = wb.Sheets[name];
    if (ws) ws['!rows'] = [{}, { hidden: true }, {}];
  });

  return wb;
}

export function workbookFileName(locale) {
  return locale === 'en' ? 'Berth-parameters-template.xlsx' : 'Mau-thong-so-cau-ben.xlsx';
}

export function downloadParameterWorkbook(model, locale = 'vi') {
  const wb = buildParameterWorkbook(model, locale);
  XLSX.writeFile(wb, workbookFileName(locale));
}

function readParams(sheet, errors, locale) {
  const rows = matrix(sheet);
  const header = (rows[0] || []).map(normHeader);
  const codeIdx = header.findIndex((h) => h === 'code' || h === 'ma');
  const valueIdx = header.findIndex((h) => h === 'value' || h === 'giatri');
  if (codeIdx < 0 || valueIdx < 0) {
    pushError(
      errors,
      SHEET.params,
      1,
      text(
        locale,
        'DÃ²ng tiÃªu Ä‘á» sheet Thong so pháº£i cÃ²n hai cá»™t code vÃ  value. HÃ£y dÃ¹ng láº¡i file máº«u.',
        'The Thong so header must still contain the code and value columns. Use the template again.'
      )
    );
    return {};
  }
  const values = {};
  for (let i = 1; i < rows.length; i += 1) {
    const code = readText(rows[i]?.[codeIdx]);
    if (!code.includes('.')) continue;
    values[code] = { value: rows[i][valueIdx], row: i + 1 };
  }
  return values;
}

/**
 * Read a filled template. When errors is non-empty, do not apply data.
 * @returns {{ errors: {sheet:string,row:number,message:string}[], data: object|null, summary: object|null }}
 */
export function parseParameterWorkbook(buffer, locale = 'vi') {
  const lang = locale === 'en' ? 'en' : 'vi';
  const errors = [];
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch {
    return {
      errors: [
        {
          sheet: '',
          row: 0,
          message: text(lang, 'KhÃ´ng Ä‘á»c Ä‘Æ°á»£c file. HÃ£y dÃ¹ng file Excel .xlsx máº«u.', 'This file could not be read. Use the .xlsx template.'),
        },
      ],
      data: null,
      summary: null,
    };
  }

  const catalog = fieldCatalog(lang);
  const specs = tableSpec(lang);
  const paramSheet = requireSheet(wb, SHEET.params, errors, lang);
  const serviceSheet = requireSheet(wb, SHEET.services, errors, lang);
  const fleetSheet = requireSheet(wb, SHEET.fleet, errors, lang);
  const craneSheet = requireSheet(wb, SHEET.cranes, errors, lang);
  const maintSheet = requireSheet(wb, SHEET.maintenance, errors, lang);
  const secCraneSheet = requireSheet(wb, SHEET.secondaryCranes, errors, lang);
  const externalSheet = requireSheet(wb, SHEET.external, errors, lang);
  if (errors.length) return { errors, data: null, summary: null };

  const raw = readParams(paramSheet, errors, lang);
  const bag = { terminal: {}, metrics: {}, equipment: {}, secondary: {} };
  catalog.forEach((field) => {
    const found = raw[field.code];
    if (!found) {
      pushError(
        errors,
        SHEET.params,
        0,
        text(lang, `Thiáº¿u chá»‰ sá»‘ ${field.code}. KhÃ´ng xÃ³a dÃ²ng trong sheet Thong so.`, `Missing indicator ${field.code}. Do not delete rows on Thong so.`)
      );
      return;
    }
    const [root, key] = field.code.split('.');
    if (field.kind === 'text') {
      const s = readText(found.value);
      if (!s) {
        pushError(
          errors,
          SHEET.params,
          found.row,
          text(lang, `${field.name}: khÃ´ng Ä‘á»ƒ trá»‘ng.`, `${field.name}: must not be empty.`)
        );
      }
      bag[root][key] = s;
      return;
    }
    const n = needNumber(errors, lang, SHEET.params, found.row, field.name, found.value, {
      min: field.min,
      max: field.max,
    });
    bag[root][key] = n ?? 0;
  });

  const serviceRecords = readKeyedTable(serviceSheet, specs[SHEET.services], errors, lang, SHEET.services);
  const usedServiceIds = new Set();
  const services = serviceRecords.map(({ row, obj }) => {
    const service = readText(obj.service).toUpperCase();
    if (!service) {
      pushError(errors, SHEET.services, row, text(lang, 'MÃ£ dá»‹ch vá»¥ khÃ´ng Ä‘Æ°á»£c trá»‘ng.', 'Service code is required.'));
    }
    const loa = needNumber(errors, lang, SHEET.services, row, 'LOA', obj.loa, { min: 1, max: 500 });
    const volume = needNumber(errors, lang, SHEET.services, row, text(lang, 'Sáº£n lÆ°á»£ng', 'Volume'), obj.volume, {
      min: 0,
    });
    const expectedVolume = needNumber(
      errors,
      lang,
      SHEET.services,
      row,
      text(lang, 'Sáº£n lÆ°á»£ng dá»± kiáº¿n', 'Expected volume'),
      obj.expectedVolume,
      { min: 0 }
    );
    const cmph = needNumber(errors, lang, SHEET.services, row, 'CMPH', obj.cmph, { min: 0.1, max: 200 });
    const color = readText(obj.color);
    const lineKind = readLineKind(obj.lineKind);
    const berthSide = readBerthSide(obj.berthSide);
    if (lineKind == null) {
      pushError(
        errors,
        SHEET.services,
        row,
        text(lang, 'Loáº¡i tuyáº¿n chá»‰ lÃ  co dinh hoáº·c ad hoc.', 'Line kind must be fixed or ad hoc.')
      );
    }
    if (berthSide == null) {
      pushError(
        errors,
        SHEET.services,
        row,
        text(lang, 'HÆ°á»›ng cáº­p chá»‰ lÃ  thuong luu hoáº·c ha luu, hoáº·c Ä‘á»ƒ trá»‘ng.', 'Berthing end must be upstream or downstream, or be left blank.')
      );
    }
    const volumeChangePct = optionalPercent(
      errors,
      lang,
      SHEET.services,
      row,
      text(lang, 'Lá»‡ch sáº£n lÆ°á»£ng %', 'Volume swing %'),
      obj.volumeChangePct
    );
    const timeChangePct = optionalPercent(
      errors,
      lang,
      SHEET.services,
      row,
      text(lang, 'Lá»‡ch giá» cáº­p %', 'Berth-time swing %'),
      obj.timeChangePct
    );
    if (color && !/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(color)) {
      pushError(
        errors,
        SHEET.services,
        row,
        text(lang, 'MÃ u pháº£i dáº¡ng #0e7490 hoáº·c Ä‘á»ƒ trá»‘ng.', 'Color must look like #0e7490, or be left blank.')
      );
    }
    return {
      id: needId(obj.id, 'svc', usedServiceIds),
      service,
      vesselName: readText(obj.vesselName),
      loa: loa ?? 0,
      volume: volume ?? 0,
      expectedVolume: expectedVolume ?? 0,
      etbDay: needDay(errors, lang, SHEET.services, row, 'ETB', obj.etbDay),
      etbTime: needTime(errors, lang, SHEET.services, row, 'ETB', obj.etbTime),
      etdDay: needDay(errors, lang, SHEET.services, row, 'ETD', obj.etdDay),
      etdTime: needTime(errors, lang, SHEET.services, row, 'ETD', obj.etdTime),
      cmph: cmph ?? 0,
      lineKind,
      volumeChangePct,
      timeChangePct,
      ...(berthSide ? { berthSide } : {}),
      ...(color ? { color } : {}),
    };
  });

  const fleetRecords = readKeyedTable(fleetSheet, specs[SHEET.fleet], errors, lang, SHEET.fleet);
  const fleetMap = new Map();
  fleetRecords.forEach(({ row, obj }) => {
    const type = readText(obj.type).toUpperCase();
    if (!FLEET_TYPES.includes(type)) {
      pushError(
        errors,
        SHEET.fleet,
        row,
        text(lang, 'Loáº¡i mÃ¡y chá»‰ Ä‘Æ°á»£c lÃ  STS, RTG, RS hoáº·c EH.', 'Machine type must be STS, RTG, RS, or EH.')
      );
      return;
    }
    if (fleetMap.has(type)) {
      pushError(errors, SHEET.fleet, row, text(lang, `Loáº¡i ${type} bá»‹ nháº­p hai láº§n.`, `${type} is entered twice.`));
      return;
    }
    fleetMap.set(type, {
      type,
      cmph: needNumber(errors, lang, SHEET.fleet, row, `${type} CMPH`, obj.cmph, { min: 0.1, max: 200 }) ?? 0,
      count:
        needNumber(errors, lang, SHEET.fleet, row, `${type} count`, obj.count, { min: 0, max: 500, integer: true }) ??
        0,
      availableHrsPerYear:
        needNumber(errors, lang, SHEET.fleet, row, `${type} hours`, obj.availableHrsPerYear, { min: 1, max: 9000 }) ??
        8760,
      availability:
        needNumber(errors, lang, SHEET.fleet, row, `${type} availability`, obj.availability, { min: 0, max: 1 }) ?? 0,
      utilization:
        needNumber(errors, lang, SHEET.fleet, row, `${type} utilization`, obj.utilization, { min: 0, max: 1 }) ?? 0,
    });
  });
  FLEET_TYPES.forEach((type) => {
    if (!fleetMap.has(type)) {
      pushError(
        errors,
        SHEET.fleet,
        0,
        text(lang, `Thiáº¿u dÃ²ng ${type}. Giá»¯ Ä‘Ãºng bá»‘n dÃ²ng STS, RTG, RS, EH.`, `Missing the ${type} row. Keep all four: STS, RTG, RS, EH.`)
      );
    }
  });

  const quayLength = bag.terminal.quayLength || 0;
  const craneRecords = readKeyedTable(craneSheet, specs[SHEET.cranes], errors, lang, SHEET.cranes);
  if (!craneRecords.length && !errors.some((e) => e.sheet === SHEET.cranes && e.row === 2)) {
    pushError(errors, SHEET.cranes, 0, text(lang, 'Cáº§n Ã­t nháº¥t má»™t cáº©u bá».', 'At least one quay crane is required.'));
  }
  const cranes = parseCranes(craneRecords, errors, lang, SHEET.cranes, quayLength).map(
    ({ sourceRow, ...crane }) => crane
  );

  const maintRecords = readKeyedTable(maintSheet, specs[SHEET.maintenance], errors, lang, SHEET.maintenance);
  const usedMaint = new Set();
  const lockZones = maintRecords.map(({ row, obj }) => {
    const fromMeter = needNumber(errors, lang, SHEET.maintenance, row, text(lang, 'Tá»« mÃ©t', 'From meter'), obj.fromMeter, {
      min: 0,
      max: 5000,
    });
    const lengthM = needNumber(errors, lang, SHEET.maintenance, row, text(lang, 'Chiá»u dÃ i', 'Length'), obj.lengthM, {
      min: 1,
      max: 5000,
    });
    if (fromMeter != null && lengthM != null && fromMeter + lengthM > quayLength + 0.05) {
      pushError(
        errors,
        SHEET.maintenance,
        row,
        text(
          lang,
          `Äoáº¡n báº£o trÃ¬ vÆ°á»£t quÃ¡ cáº§u chÃ­nh ${quayLength} m.`,
          `The maintenance stretch exceeds the main quay of ${quayLength} m.`
        )
      );
    }
    return {
      id: needId(obj.id, 'mnt', usedMaint),
      reason: readText(obj.reason) || text(lang, 'Báº£o trÃ¬', 'Maintenance'),
      fromMeter: fromMeter ?? 0,
      lengthM: lengthM ?? 0,
      capacityPct:
        needNumber(errors, lang, SHEET.maintenance, row, text(lang, 'NÄƒng lá»±c cÃ²n', 'Remaining capacity'), obj.capacityPct, {
          min: 0,
          max: 100,
        }) ?? 0,
      etbDay: needDay(errors, lang, SHEET.maintenance, row, text(lang, 'Tá»« ngÃ y', 'From day'), obj.etbDay),
      etbTime: needTime(errors, lang, SHEET.maintenance, row, text(lang, 'Tá»« giá»', 'From time'), obj.etbTime),
      etdDay: needDay(errors, lang, SHEET.maintenance, row, text(lang, 'Äáº¿n ngÃ y', 'To day'), obj.etdDay),
      etdTime: needTime(errors, lang, SHEET.maintenance, row, text(lang, 'Äáº¿n giá»', 'To time'), obj.etdTime),
    };
  });

  const secRecords = readKeyedTable(secCraneSheet, specs[SHEET.secondaryCranes], errors, lang, SHEET.secondaryCranes);
  const secondaryCranes = parseCranes(
    secRecords,
    errors,
    lang,
    SHEET.secondaryCranes,
    bag.secondary.quayLength || 0
  ).map(({ sourceRow, ...crane }) => crane);

  const extRecords = readKeyedTable(externalSheet, specs[SHEET.external], errors, lang, SHEET.external);
  const usedExt = new Set();
  const externalBerths = extRecords.map(({ row, obj }) => {
    const name = readText(obj.name);
    if (!name) {
      pushError(errors, SHEET.external, row, text(lang, 'TÃªn báº¿n thuÃª khÃ´ng Ä‘Æ°á»£c trá»‘ng.', 'Hired berth name is required.'));
    }
    return {
      id: needId(obj.id, 'ext', usedExt),
      name,
      partner: readText(obj.partner),
      quayLength: needNumber(errors, lang, SHEET.external, row, text(lang, 'Chiá»u dÃ i cáº§u', 'Quay length'), obj.quayLength, {
        min: 1,
        max: 5000,
      }),
      draftM: needNumber(errors, lang, SHEET.external, row, text(lang, 'Má»›n nÆ°á»›c', 'Draft'), obj.draftM, {
        min: 0,
        max: 40,
      }),
      maxLoa: needNumber(errors, lang, SHEET.external, row, 'LOA', obj.maxLoa, { min: 1, max: 500 }),
      towNm: needNumber(errors, lang, SHEET.external, row, text(lang, 'KÃ©o tÃ u', 'Tow'), obj.towNm, { min: 0, max: 500 }),
      hireVnd: needNumber(errors, lang, SHEET.external, row, text(lang, 'GiÃ¡ thuÃª', 'Hire'), obj.hireVnd, { min: 0 }),
    };
  });

  if (errors.length) return { errors, data: null, summary: null };

  const avgMph =
    cranes.length > 0 ? Math.round(cranes.reduce((sum, crane) => sum + crane.mph, 0) / cranes.length) : 25;
  const fleet = FLEET_TYPES.map((type) => {
    const row = fleetMap.get(type);
    if (type === 'STS') return { ...row, count: cranes.length, cmph: avgMph || row.cmph };
    return row;
  });

  const data = {
    terminal: { ...bag.terminal, stsCount: cranes.length },
    metrics: bag.metrics,
    services: withServiceColors(services),
    equipment: {
      gateMovesDesigned: bag.equipment.gateMovesDesigned,
      rehandleRatio: bag.equipment.rehandleRatio,
      fleet,
    },
    cranes,
    lockZones,
    secondaryBerth: {
      name: bag.secondary.name,
      quayLength: bag.secondary.quayLength,
      cranes: secondaryCranes,
    },
    externalBerths,
  };

  return {
    errors: [],
    data,
    summary: {
      params: catalog.length,
      services: services.length,
      cranes: cranes.length,
      zones: lockZones.length,
      secondaryCranes: secondaryCranes.length,
      external: externalBerths.length,
    },
  };
}

export function applyParameterWorkbook(model, data) {
  model.setTerminal(data.terminal);
  model.setMetrics(data.metrics);
  model.setServices(data.services);
  model.setEquipment(data.equipment);
  model.setCranes(data.cranes);
  model.setLockZones(data.lockZones);
  model.setSecondaryBerth(data.secondaryBerth);
  model.setExternalBerths(data.externalBerths);
}
