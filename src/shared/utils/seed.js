import { SERVICE_COLOR_PALETTE } from '../../features/berth-plan/utils/serviceColor';

/**
 * Seed scenario for an international container terminal.
 * Structure mirrors berth capacity / berth-window worksheets (meter-hour method).
 */

export const DEFAULT_TERMINAL = {
  name: 'International Container Terminal',
  quayLength: 600,
  stsCount: 7,
  workingDaysPerYear: 365,
  workingHoursPerDay: 24,
  workingWeeksPerYear: 52,
  workingDaysPerWeek: 7,
};

export const DEFAULT_METRICS = {
  bargeVesselVolumeRatio: 0.63,
  vesselArrivalHrs: 1,
  vesselDepartureHrs: 1,
  bargeArrivalHrs: 0.5,
  bargeDepartureHrs: 0,
  bargeCallsPerWeek: 150,
  bargeLoa: 75,
  bargeCmph: 29,
  vesselCmph: 28,
  mooringCap: 30,
  mooringRatio: 0.1,
  targetBorPct: 60,
  borAlertPct: 75,
  borSpillPct: 85,
  waitingTriggerHrs: 12,
  delayPenaltyVndPerHour: 45000000,
  unplannedBreakdownPct: 2,
};

/** Weekly berth-window services — each line has a stable brand color. */
export const DEFAULT_SERVICES = [
  {
    id: 's1',
    service: 'VCS',
    color: SERVICE_COLOR_PALETTE[0],
    vesselName: 'MV PACIFIC STAR',
    loa: 172,
    volume: 500,
    expectedVolume: 520,
    etbDay: 'Mon',
    etbTime: '14:00',
    etdDay: 'Tue',
    etdTime: '07:00',
    cmph: 28,
  },
  {
    id: 's2',
    service: 'A02',
    color: SERVICE_COLOR_PALETTE[1],
    vesselName: 'MV OCEAN PEARL',
    loa: 262,
    volume: 500,
    expectedVolume: 480,
    etbDay: 'Mon',
    etbTime: '06:00',
    etdDay: 'Mon',
    etdTime: '20:00',
    cmph: 28,
  },
  {
    id: 's3',
    service: 'ZPM',
    color: SERVICE_COLOR_PALETTE[2],
    vesselName: 'MV ZENITH PRIME',
    loa: 335,
    volume: 1000,
    expectedVolume: 1050,
    etbDay: 'Sun',
    etbTime: '15:00',
    etdDay: 'Mon',
    etdTime: '15:00',
    cmph: 28,
  },
  {
    id: 's4',
    service: 'SXT',
    color: SERVICE_COLOR_PALETTE[3],
    vesselName: 'MV SOUTHERN EXPRESS',
    loa: 172,
    volume: 500,
    expectedVolume: 500,
    etbDay: 'Wed',
    etbTime: '06:00',
    etdDay: 'Wed',
    etdTime: '18:00',
    cmph: 28,
  },
  {
    id: 's5',
    service: 'VGI',
    color: SERVICE_COLOR_PALETTE[4],
    vesselName: 'MV VANGUARD ISLE',
    loa: 275,
    volume: 2000,
    expectedVolume: 2100,
    etbDay: 'Tue',
    etbTime: '15:00',
    etdDay: 'Wed',
    etdTime: '10:00',
    cmph: 28,
  },
  {
    id: 's6',
    service: 'TP16',
    color: SERVICE_COLOR_PALETTE[5],
    vesselName: 'MV TRANS PACIFIC',
    loa: 367,
    volume: 4000,
    expectedVolume: 3850,
    etbDay: 'Thu',
    etbTime: '08:00',
    etdDay: 'Fri',
    etdTime: '15:00',
    cmph: 28,
  },
  {
    id: 's7',
    service: 'TP6',
    color: SERVICE_COLOR_PALETTE[6],
    vesselName: 'MV TRADE WIND',
    loa: 338,
    volume: 4000,
    expectedVolume: 4100,
    etbDay: 'Sat',
    etbTime: '13:00',
    etdDay: 'Sun',
    etdTime: '23:00',
    cmph: 28,
  },
  {
    id: 's8',
    service: 'ZEX',
    color: SERVICE_COLOR_PALETTE[7],
    vesselName: 'MV ZEPHYR EXPRESS',
    loa: 268,
    volume: 1000,
    expectedVolume: 980,
    etbDay: 'Wed',
    etbTime: '00:01',
    etdDay: 'Wed',
    etdTime: '18:00',
    cmph: 28,
  },
];

export const BOR_BANDS = [
  {
    id: 'under',
    minPct: 0,
    maxPct: 50,
    label: 'Under-Utilized',
    impact: 'Sub-optimal asset yield; ample buffer, near-zero waiting.',
    mitigation: 'Attract new services; review pricing / window offers.',
  },
  {
    id: 'optimal',
    minPct: 50,
    maxPct: 60,
    label: 'Optimal Range',
    impact: 'Industry sweet spot. Buffer absorbs 2–4h delay without cascade.',
    mitigation: 'Standard Berth Window System; normal STS allocation.',
  },
  {
    id: 'sustainable',
    minPct: 60,
    maxPct: 65,
    label: 'Maximum Sustainable',
    impact: 'Narrow buffer. Late mother vessel (>300m) can queue others.',
    mitigation: 'Strict BWS; schedule reliability >75%; continuous allocation.',
  },
  {
    id: 'moderate',
    minPct: 65,
    maxPct: 70,
    label: 'Moderate Congestion',
    impact: 'Frequent conflicts; single delay cascades across weekly windows.',
    mitigation: 'Max crane intensity; dynamic crane reassignment.',
  },
  {
    id: 'severe',
    minPct: 70,
    maxPct: 75,
    label: 'Severe Congestion',
    impact: 'Anchorage waits surge; yard dwell rises; STS productivity drops.',
    mitigation: 'Yard buffering; gate cut-off; priority berthing.',
  },
  {
    id: 'critical',
    minPct: 75,
    maxPct: 999,
    label: 'Critical Gridlock',
    impact: 'Unsustainable. Omissions likely; waiting time explodes.',
    mitigation: 'Quay expansion or offload calls to adjacent terminals.',
  },
];

export const DEFAULT_EQUIPMENT = {
  gateMovesDesigned: 120000,
  rehandleRatio: 0.1,
  fleet: [
    { type: 'STS', cmph: 25, count: 7, availableHrsPerYear: 8760, availability: 0.92, utilization: 0.8 },
    { type: 'RTG', cmph: 12, count: 15, availableHrsPerYear: 8760, availability: 0.88, utilization: 0.65 },
    { type: 'RS', cmph: 13, count: 3, availableHrsPerYear: 8760, availability: 0.8, utilization: 0.4 },
    { type: 'EH', cmph: 15, count: 4, availableHrsPerYear: 8760, availability: 0.8, utilization: 0.4 },
  ],
};

/** Quay cranes — 30m wide footprint; positionM = start meter; mph = moves/hour. */
export const DEFAULT_CRANES = [
  { id: 'crn1', name: 'Crane-01', mph: 28, order: 1, positionM: 30 },
  { id: 'crn2', name: 'Crane-02', mph: 28, order: 2, positionM: 100 },
  { id: 'crn3', name: 'Crane-03', mph: 30, order: 3, positionM: 170 },
  { id: 'crn4', name: 'Crane-04', mph: 30, order: 4, positionM: 250 },
  { id: 'crn5', name: 'Crane-05', mph: 28, order: 5, positionM: 330 },
  { id: 'crn6', name: 'Crane-06', mph: 25, order: 6, positionM: 410 },
  { id: 'crn7', name: 'Crane-07', mph: 25, order: 7, positionM: 490 },
];

/**
 * Lock zones — isolated quay segments with reduced capacity (red on plan).
 * capacityPct = remaining efficiency 0–100 (0 = fully locked).
 */
/** Maintenance downtime — 0% remaining capacity closes that quay rectangle. */
export const DEFAULT_LOCK_ZONES = [
  {
    id: 'mnt1',
    reason: 'STS quay maintenance',
    fromMeter: 0,
    lengthM: 150,
    capacityPct: 0,
    etbDay: 'Tue',
    etbTime: '08:00',
    etdDay: 'Tue',
    etdTime: '17:00',
  },
];

/** Linked berths that can take overflow when the main quay trips the spill line. */
export const DEFAULT_EXTERNAL_BERTHS = [
  {
    id: 'ext2',
    name: 'External Berth 2',
    partner: 'Linked terminal B',
    quayLength: 220,
    draftM: 9.5,
    maxLoa: 200,
    hireVnd: 850000000,
    towNm: 6.4,
  },
  {
    id: 'ext1',
    name: 'External Berth 1',
    partner: 'Linked terminal A',
    quayLength: 280,
    draftM: 12,
    maxLoa: 260,
    hireVnd: 1200000000,
    towNm: 11,
  },
];

/** Secondary berth — independent name, length, and crane set. */
export const DEFAULT_SECONDARY_BERTH = {
  name: 'External Berth 2',
  quayLength: 400,
  cranes: [
    { id: 'scrn1', name: 'Crane-01', mph: 25, order: 1, positionM: 40 },
    { id: 'scrn2', name: 'Crane-02', mph: 25, order: 2, positionM: 140 },
    { id: 'scrn3', name: 'Crane-03', mph: 28, order: 3, positionM: 250 },
  ],
};

/** @deprecated use DEFAULT_CRANES */
export const DEFAULT_STS_CRANES = DEFAULT_CRANES;
