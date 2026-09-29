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
  if (!s || s === '-' || s === '—') return null;
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
    'Nhập số thập phân từ 0 đến 1. Ví dụ 0,1 nghĩa là 10%. Không nhập 10 và không gõ dấu %.',
    'Enter a decimal from 0 to 1. Example: 0.1 means 10%. Do not enter 10 and do not type %.'
  );
  const pct = t(
    'Nhập số phần trăm từ 0 đến 100. Ví dụ 60 nghĩa là 60%. Không nhập 0,6.',
    'Enter a percent from 0 to 100. Example: 60 means 60%. Do not enter 0.6.'
  );
  const hours = t(
    'Số giờ, dùng dấu chấm thập phân nếu cần. Ví dụ 0,5 là 30 phút. Không gõ chữ "giờ".',
    'Hours. Use a decimal if needed. Example: 0.5 is 30 minutes. Do not type the word "hours".'
  );
  const meters = t('Số mét. Chỉ nhập số, ví dụ 600.', 'Meters. Enter a number only, for example 600.');
  return [
    {
      code: 'terminal.name',
      group: t('Cầu chính', 'Main quay'),
      name: t('Tên terminal', 'Terminal name'),
      unit: t('chữ', 'text'),
      kind: 'text',
      note: t('Tên hiển thị trên đầu hệ thống. Không để trống.', 'Shown in the header. Required.'),
    },
    {
      code: 'terminal.quayLength',
      group: t('Cầu chính', 'Main quay'),
      name: t('Chiều dài cầu chính', 'Main quay length'),
      unit: 'm',
      kind: 'number',
      min: 50,
      max: 5000,
      note: t(
        'Dùng để tính mét-giờ khả dụng = chiều dài cầu × ngày làm việc/năm × giờ/ngày, và làm trục mét trên BERTH PLAN. ' + meters,
        'Used for available meter-hours = quay length × working days/year × hours/day, and as the BERTH PLAN meter axis. ' + meters
      ),
    },
    {
      code: 'terminal.workingDaysPerYear',
      group: t('Lịch làm việc', 'Working calendar'),
      name: t('Số ngày làm việc / năm', 'Working days / year'),
      unit: t('ngày', 'days'),
      kind: 'number',
      min: 1,
      max: 366,
      note: t('Mẫu số mét-giờ năm. Thường là 365.', 'Yearly meter-hour denominator. Usually 365.'),
    },
    {
      code: 'terminal.workingHoursPerDay',
      group: t('Lịch làm việc', 'Working calendar'),
      name: t('Số giờ làm việc / ngày', 'Working hours / day'),
      unit: t('giờ', 'h'),
      kind: 'number',
      min: 1,
      max: 24,
      note: t('Thường là 24 nếu cầu hoạt động xuyên ngày.', 'Usually 24 when the quay works around the clock.'),
    },
    {
      code: 'terminal.workingWeeksPerYear',
      group: t('Lịch làm việc', 'Working calendar'),
      name: t('Số tuần làm việc / năm', 'Working weeks / year'),
      unit: t('tuần', 'weeks'),
      kind: 'number',
      min: 1,
      max: 53,
      note: t('Dùng khi quy tuần ra năm. Thường là 52.', 'Used to annualize a week. Usually 52.'),
    },
    {
      code: 'terminal.workingDaysPerWeek',
      group: t('Lịch làm việc', 'Working calendar'),
      name: t('Số ngày tính BOR / tuần', 'Days in the BOR week'),
      unit: t('ngày', 'days'),
      kind: 'number',
      min: 1,
      max: 7,
      note: t(
        'Mẫu số BOR theo tuần = chiều dài cầu × số ngày này × giờ/ngày. Thường là 7.',
        'Weekly BOR denominator = quay length × this number × hours/day. Usually 7.'
      ),
    },
    {
      code: 'metrics.bargeVesselVolumeRatio',
      group: t('Sà lan', 'Barge'),
      name: t('Tỷ lệ sản lượng sà lan / tàu', 'Barge / vessel volume ratio'),
      unit: t('tỷ lệ 0–1', 'ratio 0–1'),
      kind: 'number',
      min: 0,
      max: 5,
      note: t(
        'Sản lượng sà lan = sản lượng tuyến chính × tỷ lệ này. 0,63 nghĩa là sà lan bằng 63% sản lượng tàu. Không nhập 63.',
        'Barge volume = mainline volume × this ratio. 0.63 means barges equal 63% of vessel volume. Do not enter 63.'
      ),
    },
    {
      code: 'metrics.vesselArrivalHrs',
      group: t('Tàu mẹ', 'Mother vessel'),
      name: t('Giờ manoeuvre cập — tàu', 'Vessel arrival maneuver'),
      unit: t('giờ', 'h'),
      kind: 'number',
      min: 0,
      max: 48,
      note: hours + ' ' + t('Cộng vào giờ chiếm cầu của mỗi chuyến tàu.', 'Added to berth hours of each vessel call.'),
    },
    {
      code: 'metrics.vesselDepartureHrs',
      group: t('Tàu mẹ', 'Mother vessel'),
      name: t('Giờ manoeuvre rời — tàu', 'Vessel departure maneuver'),
      unit: t('giờ', 'h'),
      kind: 'number',
      min: 0,
      max: 48,
      note: hours,
    },
    {
      code: 'metrics.bargeArrivalHrs',
      group: t('Sà lan', 'Barge'),
      name: t('Giờ manoeuvre cập — sà lan', 'Barge arrival maneuver'),
      unit: t('giờ', 'h'),
      kind: 'number',
      min: 0,
      max: 48,
      note: hours,
    },
    {
      code: 'metrics.bargeDepartureHrs',
      group: t('Sà lan', 'Barge'),
      name: t('Giờ manoeuvre rời — sà lan', 'Barge departure maneuver'),
      unit: t('giờ', 'h'),
      kind: 'number',
      min: 0,
      max: 48,
      note: hours + ' ' + t('Có thể nhập 0 nếu sà lan rời không tính thêm giờ.', 'Enter 0 when departure adds no extra time.'),
    },
    {
      code: 'metrics.bargeCallsPerWeek',
      group: t('Sà lan', 'Barge'),
      name: t('Số lượt sà lan trung bình / tuần', 'Average barge calls / week'),
      unit: t('lượt', 'calls'),
      kind: 'number',
      min: 0,
      max: 10000,
      note: t('Số nguyên hoặc số thập phân. Dùng để tính mét-giờ sà lan trong tuần.', 'Integer or decimal. Used for weekly barge meter-hours.'),
    },
    {
      code: 'metrics.bargeLoa',
      group: t('Sà lan', 'Barge'),
      name: t('LOA trung bình sà lan', 'Average barge LOA'),
      unit: 'm',
      kind: 'number',
      min: 1,
      max: 500,
      note: meters,
    },
    {
      code: 'metrics.bargeCmph',
      group: t('Sà lan', 'Barge'),
      name: t('CMPH sà lan', 'Barge CMPH'),
      unit: t('moves/giờ', 'moves/h'),
      kind: 'number',
      min: 0.1,
      max: 200,
      note: t('Năng suất xếp dỡ trung bình của một tổ làm sà lan.', 'Average moves per hour of a barge gang.'),
    },
    {
      code: 'metrics.vesselCmph',
      group: t('Tàu mẹ', 'Mother vessel'),
      name: t('CMPH mặc định tàu', 'Default vessel CMPH'),
      unit: t('moves/giờ', 'moves/h'),
      kind: 'number',
      min: 0.1,
      max: 200,
      note: t(
        'Dùng khi một dòng dịch vụ để trống CMPH. Nên khớp với năng suất cẩu bờ.',
        'Used when a service row leaves CMPH blank. Should match quay-crane productivity.'
      ),
    },
    {
      code: 'metrics.mooringCap',
      group: t('Buộc dây', 'Mooring'),
      name: t('Trần khoảng cách buộc dây mỗi đầu', 'Mooring allowance cap, each end'),
      unit: 'm',
      kind: 'number',
      min: 0,
      max: 200,
      note: t(
        'Chiều dài chiếm cầu = LOA + 2 × min(LOA × tỷ lệ buộc dây, trần này). Ví dụ 30.',
        'Berth occupation = LOA + 2 × min(LOA × mooring ratio, this cap). Example: 30.'
      ),
    },
    {
      code: 'metrics.mooringRatio',
      group: t('Buộc dây', 'Mooring'),
      name: t('Tỷ lệ buộc dây theo LOA', 'Mooring ratio of LOA'),
      unit: t('tỷ lệ 0–1', 'ratio 0–1'),
      kind: 'number',
      min: 0,
      max: 1,
      note: ratio + ' ' + t('Giá trị chuẩn là 0,1 (10% LOA mỗi đầu tàu).', 'The standard value is 0.1 (10% of LOA at each end).'),
    },
    {
      code: 'metrics.targetBorPct',
      group: 'BOR',
      name: t('BOR mục tiêu', 'Target BOR'),
      unit: '%',
      kind: 'number',
      min: 0,
      max: 100,
      note: pct,
    },
    {
      code: 'metrics.borAlertPct',
      group: 'BOR',
      name: t('Ngưỡng cảnh báo BOR', 'BOR alert threshold'),
      unit: '%',
      kind: 'number',
      min: 0,
      max: 150,
      note: pct + ' ' + t('Từ ngưỡng này hệ thống bật cảnh báo chiếm cầu.', 'At or above this level the system raises an occupancy alert.'),
    },
    {
      code: 'metrics.borSpillPct',
      group: 'BOR',
      name: t('Ngưỡng tràn sang bến thuê', 'Spill-over threshold'),
      unit: '%',
      kind: 'number',
      min: 0,
      max: 150,
      note: pct + ' ' + t('Khi BOR vượt ngưỡng này, hệ thống xét chuyển chuyến sang bến thuê ngoài.', 'Above this BOR the system considers diverting a call to a hired berth.'),
    },
    {
      code: 'metrics.waitingTriggerHrs',
      group: 'BOR',
      name: t('Ngưỡng giờ chờ kích hoạt tràn', 'Waiting hours that trigger spill-over'),
      unit: t('giờ', 'h'),
      kind: 'number',
      min: 0,
      max: 168,
      note: hours + ' ' + t('Chờ hình học từ ngưỡng này cũng kích hoạt xét bến thuê, kể cả khi BOR chưa tới ngưỡng tràn.', 'Geometric waiting at or above this also considers a hired berth, even if BOR is still under the spill line.'),
    },
    {
      code: 'metrics.delayPenaltyVndPerHour',
      group: 'BOR',
      name: t('Phí phạt chờ / giờ', 'Waiting penalty per hour'),
      unit: 'VND/h',
      kind: 'number',
      min: 0,
      note: t(
        'Nhập số đồng, không gõ dấu chấm ngăn cách. Ví dụ 45000000 là 45 triệu đồng mỗi giờ chờ.',
        'Enter dong as a plain number. Example: 45000000 is 45 million dong per waiting hour.'
      ),
    },
    {
      code: 'metrics.unplannedBreakdownPct',
      group: t('Năng lực', 'Capacity'),
      name: t('Tỷ lệ hỏng bất thường', 'Unplanned breakdown'),
      unit: '%',
      kind: 'number',
      min: 0,
      max: 100,
      note: pct + ' ' + t('Trừ vào năng lực thiết kế khi ước lượng sản lượng thực.', 'Subtracted from design capacity when estimating achievable moves.'),
    },
    {
      code: 'equipment.gateMovesDesigned',
      group: t('Bãi CY', 'CY yard'),
      name: t('Moves cổng thiết kế / năm', 'Designed gate moves / year'),
      unit: t('moves/năm', 'moves/year'),
      kind: 'number',
      min: 0,
      note: t(
        'Cộng vào moves bãi = moves cầu + moves cổng + đảo chuyển. Nhập số nguyên.',
        'Added to yard moves = quay + gate + rehandles. Enter a whole number.'
      ),
    },
    {
      code: 'equipment.rehandleRatio',
      group: t('Bãi CY', 'CY yard'),
      name: t('Tỷ lệ đảo chuyển', 'Rehandle ratio'),
      unit: t('tỷ lệ 0–1', 'ratio 0–1'),
      kind: 'number',
      min: 0,
      max: 1,
      note: ratio + ' ' + t('Moves đảo chuyển = moves cẩu bờ × tỷ lệ này. 0,1 = 10%.', 'Rehandles = quay moves × this ratio. 0.1 = 10%.'),
    },
    {
      code: 'secondary.name',
      group: t('Bến phụ', 'Secondary berth'),
      name: t('Tên bến phụ', 'Secondary berth name'),
      unit: t('chữ', 'text'),
      kind: 'text',
      note: t('Tên cầu đang vẽ ở mục Bến thuê ngoài. Không để trống.', 'Name of the berth drawn on External Berth. Required.'),
    },
    {
      code: 'secondary.quayLength',
      group: t('Bến phụ', 'Secondary berth'),
      name: t('Chiều dài bến phụ', 'Secondary quay length'),
      unit: 'm',
      kind: 'number',
      min: 50,
      max: 5000,
      note: meters + ' ' + t('Cẩu ở sheet Cau ben phu phải nằm trong chiều dài này. Mỗi cẩu chiếm 30 m.', 'Cranes on Cau ben phu must fit inside this length. Each crane is 30 m wide.'),
    },
  ];
}

const PARAM_HEADERS = {
  vi: ['code', 'Nhóm', 'Thông số', 'value', 'Đơn vị', 'Cách nhập'],
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
    [t('CÁCH DÙNG FILE NÀY', 'HOW TO USE THIS FILE')],
    [''],
    [
      t(
        'File là bộ thông số tính toán của Hệ thống Năng lực Vận hành Cầu bến. Chỉ sửa số liệu. Không đổi tên sheet, không đổi cột code / value, không xóa dòng tiêu đề.',
        'This file is the calculation input set for the Berth Operations Capacity System. Edit values only. Do not rename sheets, do not rename the code / value columns, and do not delete header rows.'
      ),
    ],
    [''],
    [t('CÁC BƯỚC', 'STEPS')],
    [
      t(
        '1. Sửa cột value trên sheet Thong so. Mỗi dòng là một chỉ số. Đọc cột Cách nhập trước khi gõ.',
        '1. Edit the value column on Thong so. Each row is one indicator. Read How to fill before typing.'
      ),
    ],
    [
      t(
        '2. Các sheet còn lại là bảng: một dòng là một chuyến, một cẩu, một ca bảo trì hoặc một bến thuê. Thêm dòng mới ở phía dưới để thêm mục. Xóa cả dòng để bỏ mục đó khỏi hệ thống.',
        '2. Other sheets are tables: one row is one call, crane, maintenance window, or hired berth. Add a row at the bottom to add an item. Delete the whole row to remove it.'
      ),
    ],
    [
      t(
        '3. Dòng 2 của mỗi bảng là mã cột (ẩn). Không hiện, không xóa, không đổi chữ. Khi thêm dòng mới, để trống cột id — hệ thống sẽ tự cấp mã.',
        '3. Row 2 of each table is the hidden column code. Do not unhide, delete, or edit it. For a new row, leave id blank — the system assigns an id.'
      ),
    ],
    [
      t(
        '4. Lưu file Excel (.xlsx) rồi bấm Nhập Excel trên hệ thống. Nếu có ô sai, hệ thống không ghi đè số đang chạy và sẽ liệt kê lỗi để sửa.',
        '4. Save the .xlsx file and press Upload Excel in the system. If any cell is invalid, current numbers stay unchanged and the system lists what to fix.'
      ),
    ],
    [''],
    [t('QUY ƯỚC NHẬP LIỆU', 'ENTRY RULES')],
    [
      t(
        'Số: chỉ nhập số. Không gõ đơn vị (m, %, giờ) vào ô giá trị. Phần thập phân có thể dùng dấu phẩy hoặc dấu chấm: 0,5 và 0.5 đều được.',
        'Numbers: enter a number only. Do not type units (m, %, hours) into the value cell. Decimals may use a comma or a dot: 0.5 and 0,5 both work.'
      ),
    ],
    [
      t(
        'Phần trăm 0–100 (BOR, hỏng hóc, năng lực bảo trì): nhập 60 cho 60%. Không nhập 0,6.',
        'Percents 0–100 (BOR, breakdown, maintenance capacity): enter 60 for 60%. Do not enter 0.6.'
      ),
    ],
    [
      t(
        'Tỷ lệ 0–1 (sà lan/tàu, buộc dây, sẵn sàng máy, sử dụng máy, đảo chuyển): nhập 0,92 cho 92%. Không nhập 92.',
        'Ratios 0–1 (barge/vessel, mooring, machine availability, utilization, rehandles): enter 0.92 for 92%. Do not enter 92.'
      ),
    ],
    [
      t(
        'Ngày: T2 T3 T4 T5 T6 T7 CN hoặc Mon Tue Wed Thu Fri Sat Sun. Giờ: 14:00 theo đồng hồ 24 giờ.',
        'Days: T2 T3 T4 T5 T6 T7 CN or Mon Tue Wed Thu Fri Sat Sun. Time: 14:00 on a 24-hour clock.'
      ),
    ],
    [
      t(
        'Màu dịch vụ: mã hex như #0e7490, hoặc để trống để hệ thống tự gán. Cùng mã dịch vụ dùng cùng một màu.',
        'Service color: a hex code such as #0e7490, or leave blank and the system assigns one. The same service code shares one color.'
      ),
    ],
    [''],
    [t('SHEET NÀO CHỨA GÌ', 'WHAT EACH SHEET HOLDS')],
    [
      t(
        'Thong so — toàn bộ chỉ số đơn: cầu chính, lịch làm việc, tàu, sà lan, BOR, cổng, đảo chuyển, tên và chiều dài bến phụ.',
        'Thong so — every single-value indicator: main quay, calendar, vessels, barges, BOR, gate, rehandles, secondary berth name and length.'
      ),
    ],
    [
      t(
        'Dich vu — proforma tuần. LOA mét, sản lượng moves, ngày giờ ETB/ETD, CMPH của từng cửa sổ. Giờ chiếm cầu = giờ cập + giờ rời + khoảng ETB tới ETD. Loại tuyến: co dinh lặp tuần (có % lệch sản lượng và giờ cập) hoặc ad hoc không lặp. Hướng cập: thuong luu sát mốc 0, ha luu sát chiều dài cầu đang khai báo.',
        'Dich vu — weekly proforma. LOA in meters, volume in moves, ETB/ETD day and time, CMPH of each window. Berth hours = arrival + departure + ETB to ETD. Line kind: fixed repeats weekly (with volume and berth-time swing %) or ad hoc does not repeat. Berthing end: upstream is wharf mark 0, downstream is the current quay length.',
      ),
    ],
    [
      t(
        'Thiet bi CY — STS, RTG, RS, EH. Năng lực = CMPH × số máy × giờ/năm × sẵn sàng × sử dụng. Dòng STS: số máy và CMPH lấy từ sheet Cau bo (số cẩu và mph trung bình). Ở dòng STS chỉ cần đúng hệ số sẵn sàng và hệ số sử dụng.',
        'Thiet bi CY — STS, RTG, RS, EH. Capacity = CMPH × count × hours/year × availability × utilization. STS count and CMPH come from Cau bo (crane count and average mph). On the STS row, only availability and utilization are taken from this sheet.'
      ),
    ],
    [
      t(
        'Cau bo — từng cẩu cầu chính. Mỗi cẩu rộng 30 m. positionM là mét bắt đầu thân cẩu, phải nằm trong chiều dài cầu và không đè lên cẩu khác. order = 1 là cẩu phía mét nhỏ.',
        'Cau bo — each main-quay crane. Every crane is 30 m wide. positionM is the start meter of the crane, must sit inside the quay and must not overlap another crane. order = 1 is the crane toward the low meter mark.'
      ),
    ],
    [
      t(
        'Bao tri — khung thời gian đóng một đoạn cầu. capacityPct = 0 là đóng hoàn toàn. fromMeter + lengthM không được vượt quá chiều dài cầu chính.',
        'Bao tri — time windows that close a quay segment. capacityPct = 0 means fully closed. fromMeter + lengthM must not exceed the main quay length.'
      ),
    ],
    [
      t(
        'Cau ben phu — cẩu của bến phụ. Cùng quy tắc 30 m, nằm trong chiều dài bến phụ ở sheet Thong so.',
        'Cau ben phu — cranes of the secondary berth. Same 30 m rule, inside the secondary length on Thong so.'
      ),
    ],
    [
      t(
        'Ben thue — bến thuê ngoài dùng khi BOR hoặc giờ chờ vượt ngưỡng. maxLoa và quayLength phải đủ cho tàu được xét chuyển. hireVnd là tiền thuê một chuyến, bằng số đồng.',
        'Ben thue — hired berths used when BOR or waiting exceeds the threshold. maxLoa and quayLength must fit the call being considered. hireVnd is the hire of one call, in dong as a plain number.'
      ),
    ],
  ];
}

function tableSpec(locale) {
  const t = (vi, en) => text(locale, vi, en);
  const dayNote = t('T2–T7, CN hoặc Mon–Sun.', 'T2–T7, CN or Mon–Sun.');
  const timeNote = t('Dạng 14:00.', 'Use 14:00.');
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
        t('Mã dịch vụ', 'Service code'),
        t('Tên tàu', 'Vessel name'),
        'LOA (m)',
        t('Sản lượng (moves)', 'Volume (moves)'),
        t('Sản lượng dự kiến (moves)', 'Expected volume (moves)'),
        'ETB ' + t('ngày', 'day'),
        'ETB ' + t('giờ', 'time'),
        'ETD ' + t('ngày', 'day'),
        'ETD ' + t('giờ', 'time'),
        'CMPH',
        t('Màu #hex', 'Color #hex'),
        t('Loại tuyến', 'Line kind'),
        t('Lệch sản lượng %', 'Volume swing %'),
        t('Lệch giờ cập %', 'Berth-time swing %'),
        t('Hướng cập', 'Berthing end'),
      ],
      notes: [
        t('Để trống nếu thêm dòng mới.', 'Leave blank for a new row.'),
        t('Bắt buộc. Ví dụ VCS. Cùng mã sẽ dùng chung một màu.', 'Required. Example: VCS. The same code shares one color.'),
        t('Tên tàu hiển thị trên kế hoạch.', 'Vessel name shown on the plan.'),
        t('Chiều dài tàu, mét, lớn hơn 0.', 'Vessel length in meters, greater than 0.'),
        t('Moves kế hoạch của chuyến, ≥ 0.', 'Planned moves of the call, ≥ 0.'),
        t('Moves dự kiến thực tế, ≥ 0. Dùng cho so sánh sản lượng.', 'Expected actual moves, ≥ 0. Used for volume comparison.'),
        dayNote,
        timeNote,
        dayNote,
        timeNote,
        t('Moves/giờ của chuyến này. Lớn hơn 0.', 'Moves per hour of this call. Greater than 0.'),
        t('Ví dụ #0e7490 hoặc để trống.', 'Example #0e7490 or leave blank.'),
        t('co dinh hoặc ad hoc. Cố định lặp mỗi tuần. Ad hoc chỉ có ở tuần đang xếp.', 'fixed or ad hoc. Fixed repeats every week. Ad hoc stays only in the current week.'),
        t('0–100. Phần trăm sản lượng tuần lặp được phép lệch khỏi proforma. Để trống = 0.', '0–100. Percent a repeated week may swing from proforma volume. Blank = 0.'),
        t('0–100. Phần trăm giờ cập tuần lặp được phép lệch. Để trống = 0.', '0–100. Percent a repeated week may swing berth time. Blank = 0.'),
        t('thuong luu (sát mốc 0) hoặc ha luu (sát mốc cuối cầu đang cài). Để trống thì giữ chỗ đang xếp.', 'upstream (wharf mark 0) or downstream (current quay end). Blank keeps the current berth position.'),
      ],
    },
    [SHEET.fleet]: {
      keys: ['type', 'cmph', 'count', 'availableHrsPerYear', 'availability', 'utilization'],
      titles: [
        t('Loại', 'Type'),
        'CMPH',
        t('Số máy', 'Count'),
        t('Giờ/năm', 'Hours/year'),
        t('Sẵn sàng (0–1)', 'Availability (0–1)'),
        t('Sử dụng (0–1)', 'Utilization (0–1)'),
      ],
      notes: [
        t('Đúng một dòng cho mỗi loại: STS, RTG, RS, EH. Không thêm loại khác.', 'Exactly one row per type: STS, RTG, RS, EH. Do not add another type.'),
        t('Với RTG, RS, EH: moves/giờ mỗi máy. Với STS: hệ thống lấy mph trung bình của sheet Cau bo.', 'For RTG, RS, EH: moves/hour per machine. For STS: the system uses the average mph from Cau bo.'),
        t('Với RTG, RS, EH: số máy ≥ 0. Với STS: hệ thống lấy số dòng ở Cau bo.', 'For RTG, RS, EH: machine count ≥ 0. For STS: the system uses the number of rows on Cau bo.'),
        t('Thường 8760. Năng lực = CMPH × số máy × giờ này × sẵn sàng × sử dụng.', 'Usually 8760. Capacity = CMPH × count × this × availability × utilization.'),
        t('0–1. Ví dụ 0,92 = máy sẵn sàng 92% thời gian. Không nhập 92.', '0–1. Example: 0.92 = the machine is available 92% of the time. Do not enter 92.'),
        t('0–1. Ví dụ 0,8 = sử dụng 80% giờ sẵn sàng. Không nhập 80.', '0–1. Example: 0.8 = used for 80% of available hours. Do not enter 80.'),
      ],
    },
    [SHEET.cranes]: {
      keys: ['id', 'name', 'mph', 'order', 'positionM'],
      titles: ['id', t('Tên cẩu', 'Crane name'), 'MPH', t('Thứ tự', 'Order'), t('Mét bắt đầu', 'Start meter')],
      notes: [
        t('Để trống nếu thêm cẩu mới.', 'Leave blank for a new crane.'),
        t('Tên hiển thị, ví dụ Crane-01.', 'Display name, for example Crane-01.'),
        t('Moves/giờ của cẩu. Trung bình các cẩu này trở thành CMPH của STS.', 'Moves per hour. The average becomes the STS CMPH.'),
        t('1, 2, 3… theo hướng từ mét nhỏ tới mét lớn.', '1, 2, 3… from the low meter mark toward the high one.'),
        t('Mét bắt đầu thân cẩu. Cẩu dài 30 m, phải nằm trọn trong cầu và không chồng lên cẩu kế.', 'Start meter of the crane body. A crane is 30 m long, must fit on the quay, and must not overlap the next crane.'),
      ],
    },
    [SHEET.maintenance]: {
      keys: ['id', 'reason', 'fromMeter', 'lengthM', 'capacityPct', 'etbDay', 'etbTime', 'etdDay', 'etdTime'],
      titles: [
        'id',
        t('Lý do', 'Reason'),
        t('Từ mét', 'From meter'),
        t('Chiều dài (m)', 'Length (m)'),
        t('Năng lực còn (%)', 'Remaining capacity (%)'),
        t('Từ ngày', 'From day'),
        t('Từ giờ', 'From time'),
        t('Đến ngày', 'To day'),
        t('Đến giờ', 'To time'),
      ],
      notes: [
        t('Để trống nếu thêm ca mới. Xóa hết dòng nếu tuần không bảo trì.', 'Leave blank for a new window. Delete all rows if the week has no maintenance.'),
        t('Tên hiển thị trên kế hoạch.', 'Name shown on the plan.'),
        t('Mét bắt đầu đoạn bảo trì, ≥ 0.', 'Start meter of the maintenance stretch, ≥ 0.'),
        t('Độ dài đoạn, mét. fromMeter + lengthM không vượt quá chiều dài cầu chính.', 'Length in meters. fromMeter + lengthM must not pass the main quay length.'),
        t('0 = đóng hoàn toàn (không xếp dỡ). 50 = còn 50% năng lực. Nhập 0–100.', '0 = fully closed. 50 = 50% capacity left. Enter 0–100.'),
        dayNote,
        timeNote,
        dayNote,
        timeNote,
      ],
    },
    [SHEET.secondaryCranes]: {
      keys: ['id', 'name', 'mph', 'order', 'positionM'],
      titles: ['id', t('Tên cẩu', 'Crane name'), 'MPH', t('Thứ tự', 'Order'), t('Mét bắt đầu', 'Start meter')],
      notes: [
        t('Để trống nếu thêm cẩu mới.', 'Leave blank for a new crane.'),
        t('Tên cẩu trên bến phụ.', 'Crane name on the secondary berth.'),
        t('Moves/giờ, lớn hơn 0.', 'Moves per hour, greater than 0.'),
        t('Thứ tự 1, 2, 3.', 'Order 1, 2, 3.'),
        t('Mét bắt đầu. Cẩu dài 30 m và phải nằm trong chiều dài bến phụ.', 'Start meter. The crane is 30 m and must fit the secondary length.'),
      ],
    },
    [SHEET.external]: {
      keys: ['id', 'name', 'partner', 'quayLength', 'draftM', 'maxLoa', 'towNm', 'hireVnd'],
      titles: [
        'id',
        t('Tên bến', 'Berth name'),
        t('Đối tác', 'Partner'),
        t('Chiều dài cầu (m)', 'Quay length (m)'),
        t('Mớn nước (m)', 'Draft (m)'),
        t('LOA tối đa (m)', 'Max LOA (m)'),
        t('Kéo tàu (hải lý)', 'Tow (nm)'),
        t('Giá thuê / chuyến (VND)', 'Hire / call (VND)'),
      ],
      notes: [
        t('Để trống nếu thêm bến mới.', 'Leave blank for a new berth.'),
        t('Tên bến thuê. Bắt buộc.', 'Hired berth name. Required.'),
        t('Tên đơn vị liên kết. Có thể để trống.', 'Linked operator. May be blank.'),
        t('Phải ≥ LOA của tàu được chuyển, tính bằng mét.', 'Must be at least the LOA of the diverted vessel, in meters.'),
        t('Mớn khai thác, mét.', 'Working draft, meters.'),
        t('Tàu dài hơn mức này không được chọn bến này.', 'A longer vessel cannot be assigned here.'),
        t('Khoảng cách lai dắt, hải lý.', 'Tow distance, nautical miles.'),
        t('Số đồng cho một chuyến, không gõ dấu chấm. Ví dụ 850000000.', 'Dong for one call, without separators. Example: 850000000.'),
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
        `Thiếu sheet "${name}". Hãy dùng đúng file mẫu, không đổi tên sheet.`,
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
        'Dòng mã cột (dòng 2) bị sửa hoặc bị xóa. Hãy tải lại file mẫu và chỉ sửa số liệu từ dòng 4.',
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
      text(locale, `${label}: ô trống hoặc không phải số.`, `${label}: empty or not a number.`)
    );
    return null;
  }
  if (min != null && n < min) {
    pushError(errors, sheet, row, text(locale, `${label}: phải ≥ ${min}.`, `${label}: must be ≥ ${min}.`));
    return null;
  }
  if (max != null && n > max) {
    pushError(errors, sheet, row, text(locale, `${label}: phải ≤ ${max}.`, `${label}: must be ≤ ${max}.`));
    return null;
  }
  if (integer && Math.round(n) !== n) {
    pushError(errors, sheet, row, text(locale, `${label}: phải là số nguyên.`, `${label}: must be a whole number.`));
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
      text(locale, `${label}: nhập T2–T7, CN hoặc Mon–Sun.`, `${label}: use T2–T7, CN or Mon–Sun.`)
    );
    return null;
  }
  return day;
}

function needTime(errors, locale, sheet, row, label, value) {
  const time = parseTime(value);
  if (!time) {
    pushError(errors, sheet, row, text(locale, `${label}: nhập giờ dạng 14:00.`, `${label}: use a time like 14:00.`));
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
          `${crane.name}: mét bắt đầu ${crane.positionM} không nằm vừa cầu dài ${quayLength} m (cẩu chiếm ${CRANE_WIDTH_M} m).`,
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
          `${laid[i].name} chồng lên ${laid[i - 1].name}. Mỗi cẩu cần 30 m riêng.`,
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
        text(lang, 'Không sửa', 'Do not edit'),
        text(lang, 'Không sửa', 'Do not edit'),
        text(lang, 'Không sửa', 'Do not edit'),
        text(lang, 'CHỈ SỬA CỘT NÀY', 'EDIT THIS COLUMN ONLY'),
        text(lang, 'Không sửa', 'Do not edit'),
        text(lang, 'Đọc trước khi nhập', 'Read before entering'),
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
        'Dòng tiêu đề sheet Thong so phải còn hai cột code và value. Hãy dùng lại file mẫu.',
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
          message: text(lang, 'Không đọc được file. Hãy dùng file Excel .xlsx mẫu.', 'This file could not be read. Use the .xlsx template.'),
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
        text(lang, `Thiếu chỉ số ${field.code}. Không xóa dòng trong sheet Thong so.`, `Missing indicator ${field.code}. Do not delete rows on Thong so.`)
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
          text(lang, `${field.name}: không để trống.`, `${field.name}: must not be empty.`)
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
      pushError(errors, SHEET.services, row, text(lang, 'Mã dịch vụ không được trống.', 'Service code is required.'));
    }
    const loa = needNumber(errors, lang, SHEET.services, row, 'LOA', obj.loa, { min: 1, max: 500 });
    const volume = needNumber(errors, lang, SHEET.services, row, text(lang, 'Sản lượng', 'Volume'), obj.volume, {
      min: 0,
    });
    const expectedVolume = needNumber(
      errors,
      lang,
      SHEET.services,
      row,
      text(lang, 'Sản lượng dự kiến', 'Expected volume'),
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
        text(lang, 'Loại tuyến chỉ là co dinh hoặc ad hoc.', 'Line kind must be fixed or ad hoc.')
      );
    }
    if (berthSide == null) {
      pushError(
        errors,
        SHEET.services,
        row,
        text(lang, 'Hướng cập chỉ là thuong luu hoặc ha luu, hoặc để trống.', 'Berthing end must be upstream or downstream, or be left blank.')
      );
    }
    const volumeChangePct = optionalPercent(
      errors,
      lang,
      SHEET.services,
      row,
      text(lang, 'Lệch sản lượng %', 'Volume swing %'),
      obj.volumeChangePct
    );
    const timeChangePct = optionalPercent(
      errors,
      lang,
      SHEET.services,
      row,
      text(lang, 'Lệch giờ cập %', 'Berth-time swing %'),
      obj.timeChangePct
    );
    if (color && !/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(color)) {
      pushError(
        errors,
        SHEET.services,
        row,
        text(lang, 'Màu phải dạng #0e7490 hoặc để trống.', 'Color must look like #0e7490, or be left blank.')
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
        text(lang, 'Loại máy chỉ được là STS, RTG, RS hoặc EH.', 'Machine type must be STS, RTG, RS, or EH.')
      );
      return;
    }
    if (fleetMap.has(type)) {
      pushError(errors, SHEET.fleet, row, text(lang, `Loại ${type} bị nhập hai lần.`, `${type} is entered twice.`));
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
        text(lang, `Thiếu dòng ${type}. Giữ đúng bốn dòng STS, RTG, RS, EH.`, `Missing the ${type} row. Keep all four: STS, RTG, RS, EH.`)
      );
    }
  });

  const quayLength = bag.terminal.quayLength || 0;
  const craneRecords = readKeyedTable(craneSheet, specs[SHEET.cranes], errors, lang, SHEET.cranes);
  if (!craneRecords.length && !errors.some((e) => e.sheet === SHEET.cranes && e.row === 2)) {
    pushError(errors, SHEET.cranes, 0, text(lang, 'Cần ít nhất một cẩu bờ.', 'At least one quay crane is required.'));
  }
  const cranes = parseCranes(craneRecords, errors, lang, SHEET.cranes, quayLength).map(
    ({ sourceRow, ...crane }) => crane
  );

  const maintRecords = readKeyedTable(maintSheet, specs[SHEET.maintenance], errors, lang, SHEET.maintenance);
  const usedMaint = new Set();
  const lockZones = maintRecords.map(({ row, obj }) => {
    const fromMeter = needNumber(errors, lang, SHEET.maintenance, row, text(lang, 'Từ mét', 'From meter'), obj.fromMeter, {
      min: 0,
      max: 5000,
    });
    const lengthM = needNumber(errors, lang, SHEET.maintenance, row, text(lang, 'Chiều dài', 'Length'), obj.lengthM, {
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
          `Đoạn bảo trì vượt quá cầu chính ${quayLength} m.`,
          `The maintenance stretch exceeds the main quay of ${quayLength} m.`
        )
      );
    }
    return {
      id: needId(obj.id, 'mnt', usedMaint),
      reason: readText(obj.reason) || text(lang, 'Bảo trì', 'Maintenance'),
      fromMeter: fromMeter ?? 0,
      lengthM: lengthM ?? 0,
      capacityPct:
        needNumber(errors, lang, SHEET.maintenance, row, text(lang, 'Năng lực còn', 'Remaining capacity'), obj.capacityPct, {
          min: 0,
          max: 100,
        }) ?? 0,
      etbDay: needDay(errors, lang, SHEET.maintenance, row, text(lang, 'Từ ngày', 'From day'), obj.etbDay),
      etbTime: needTime(errors, lang, SHEET.maintenance, row, text(lang, 'Từ giờ', 'From time'), obj.etbTime),
      etdDay: needDay(errors, lang, SHEET.maintenance, row, text(lang, 'Đến ngày', 'To day'), obj.etdDay),
      etdTime: needTime(errors, lang, SHEET.maintenance, row, text(lang, 'Đến giờ', 'To time'), obj.etdTime),
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
      pushError(errors, SHEET.external, row, text(lang, 'Tên bến thuê không được trống.', 'Hired berth name is required.'));
    }
    return {
      id: needId(obj.id, 'ext', usedExt),
      name,
      partner: readText(obj.partner),
      quayLength: needNumber(errors, lang, SHEET.external, row, text(lang, 'Chiều dài cầu', 'Quay length'), obj.quayLength, {
        min: 1,
        max: 5000,
      }),
      draftM: needNumber(errors, lang, SHEET.external, row, text(lang, 'Mớn nước', 'Draft'), obj.draftM, {
        min: 0,
        max: 40,
      }),
      maxLoa: needNumber(errors, lang, SHEET.external, row, 'LOA', obj.maxLoa, { min: 1, max: 500 }),
      towNm: needNumber(errors, lang, SHEET.external, row, text(lang, 'Kéo tàu', 'Tow'), obj.towNm, { min: 0, max: 500 }),
      hireVnd: needNumber(errors, lang, SHEET.external, row, text(lang, 'Giá thuê', 'Hire'), obj.hireVnd, { min: 0 }),
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
