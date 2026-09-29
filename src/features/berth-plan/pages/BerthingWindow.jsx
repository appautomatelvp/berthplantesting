import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { calcBerthCapacity, dayIndex, toDayFraction } from '../../capacity/utils/index';
import { useI18n } from '../../../shared/i18n/I18nContext';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import CraneRail from '../components/CraneRail';
import CraneManager from '../components/CraneManager';
import LockZoneManager from '../components/LockZoneManager';
import PageToolbar from '../../../shared/components/PageToolbar';
import { IconBarge, IconVessel } from '../../../shared/components/icons/PortIcons';
import { layoutLockZones } from '../../../shared/utils/lockZone';
import {
  layoutMotherVessels,
  overlapsMaintenance,
  planBargeWindowsByWeek,
} from '../utils/operations';
import {
  BLOCK_FIELD_OPTIONS,
  buildMeterMarks,
  clientXToMeter,
  clientYToHour,
  DAY_KEYS,
  DEFAULT_UI,
  hourToDayTime,
  loaFromOccupation,
  meterToLeftPercent,
  segmentCss,
  snap,
  TIME_SCALES,
  handoverTimes,
  handoverWeekHours,
  berthScaleOf,
  withHorizon,
} from '../../../shared/utils/uiSettings';
import {
  buildServiceColorMap,
  defaultColorForService,
  resolveServiceColor,
  SERVICE_COLOR_PALETTE,
} from '../utils/serviceColor';

function uid() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function fmt(n, d = 1) {
  if (!Number.isFinite(n)) return 'â€”';
  return n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function buildBlockFacts(block, fields, t) {
  const facts = [];
  const push = (key, label, value, primary = false) => {
    if (value == null || value === '') return;
    facts.push({ key, label, value: String(value), primary, service: key === 'service' });
  };
  for (const key of fields) {
    switch (key) {
      case 'service':
        push(key, '', block.service || 'â€”', true);
        break;
      case 'vessel':
        if (block.vesselName) push(key, '', block.vesselName);
        break;
      case 'schedule':
        push(
          key,
          '',
          `${t(`days.${block.etbDay}`)} ${block.etbTime} â†’ ${t(`days.${block.etdDay}`)} ${block.etdTime}`
        );
        break;
      case 'loa':
        push(key, t('window.blockField.loa'), fmt(block.loa, 0));
        break;
      case 'occupation':
        push(key, t('window.blockField.occupation'), fmt(block.occupation, 0));
        break;
      case 'berthRange':
        push(key, t('window.blockField.berthRange'), `${fmt(block.fromMeter, 0)}â€“${fmt(block.toMeter, 0)}`);
        break;
      case 'volume':
        push(key, t('window.blockField.volume'), fmt(block.volume, 0));
        break;
      case 'expectedVolume': {
        const ev =
          block.expectedVolume != null && block.expectedVolume !== ''
            ? Number(block.expectedVolume)
            : Number(block.volume) || 0;
        push(key, t('window.blockField.expectedVolume'), fmt(ev, 0));
        break;
      }
      case 'meterHours':
        push(key, t('window.blockField.meterHours'), fmt(block.meterHours, 0));
        break;
      case 'netPortstay':
        push(key, t('window.blockField.netPortstay'), fmt(block.netPortstay, 1));
        break;
      case 'pmph':
        push(key, 'PMPH', fmt(block.pmph, 1));
        break;
      case 'cmph':
        push(key, 'CMPH', fmt(block.cmph, 0));
        break;
      case 'craneDensity':
        push(key, t('window.blockField.craneDensity'), fmt(block.craneDensity, 2));
        break;
      default:
        break;
    }
  }
  return facts;
}

function isTypingTarget(el) {
  if (!el || !(el instanceof Element)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function cloneServices(rows) {
  return rows.map((r) => ({ ...r }));
}

/** Intersection rectangles where two services occupy the same time Ã— quay segment. */
function computeOverlapRegions(blocks) {
  const regions = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (a.weekIndex !== b.weekIndex) continue;
      const startHour = Math.max(a.startHour, b.startHour);
      const endHour = Math.min(a.endHour, b.endHour);
      const fromMeter = Math.max(a.fromMeter, b.fromMeter);
      const toMeter = Math.min(a.toMeter, b.toMeter);
      if (endHour <= startHour || toMeter <= fromMeter) continue;
      regions.push({
        key: `ov-${a.key}-${b.key}`,
        startHour,
        endHour,
        fromMeter,
        toMeter,
        ids: [a.id, b.id],
        labels: [a.service, b.service],
      });
    }
  }
  return regions;
}

function planWeekMonday(from = new Date()) {
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const weekday = day.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + delta);
  return day;
}

function formatPlanDate(absoluteHour, anchor) {
  const day = new Date(anchor.getTime());
  day.setDate(anchor.getDate() + Math.floor(absoluteHour / 24));
  const dd = String(day.getDate()).padStart(2, '0');
  const mm = String(day.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function formatHourLabel(absoluteHour, scaleId, t) {
  const hInWeek = ((absoluteHour % 168) + 168) % 168;
  const day = Math.floor(hInWeek / 24);
  const hour = Math.floor(hInWeek % 24);
  const dayLabel = t(`days.${DAY_KEYS[day]}`);
  const clock = `${String(hour).padStart(2, '0')}:00`;
  if (scaleId === 'hour' || scaleId === 'day') return `${dayLabel} ${clock}`;
  return clock;
}

export default function BerthingWindow({ model }) {
  const { t } = useI18n();
  const { terminal, metrics, services, setServices, setServiceLineColor, ui, setUi, cranes, setCranes, moveMainCrane, lockZones, setLockZones } =
    model;
  const scaleId = berthScaleOf(ui?.horizon || ui?.timeScale || DEFAULT_UI.timeScale);
  const scale = TIME_SCALES[scaleId] || TIME_SCALES.week;
  const scrollRef = useRef(null);
  const freezeTrackRef = useRef(null);
  const [viewPx, setViewPx] = useState(640);
  const meterDirection = ui?.meterDirection || DEFAULT_UI.meterDirection;
  const chartLayer = ui?.chartLayer || 'all';
  const fitted = useMemo(() => {
    const pageHours = scale.pageHours;
    const pages = scale.pages || 1;
    if (!pageHours) {
      return {
        pxPerHour: scale.pxPerHour,
        totalHours: 168 * scale.weeks,
        weeks: scale.weeks,
        snap: false,
        pageHours: 0,
      };
    }
    const pxPerHour = Math.max(0.4, viewPx / pageHours);
    return {
      pxPerHour,
      totalHours: pageHours * pages,
      weeks: Math.ceil((pageHours * pages) / 168),
      snap: true,
      pageHours,
    };
  }, [scale, viewPx]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => {
      setViewPx(Math.max(240, el.clientHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (scaleId === 'week' && sessionStorage.getItem('bcl.bootNow') === '1') return;
    el.scrollTop = 0;
  }, [scaleId]);

  const syncFreeze = useCallback(() => {
    const el = scrollRef.current;
    const track = freezeTrackRef.current;
    if (!el || !track) return;
    track.style.transform = `translateX(${-el.scrollLeft}px)`;
  }, []);
  const shiftMarks = handoverWeekHours(handoverTimes(ui), fitted.weeks);
  const blockFields = ui?.blockFields?.length ? ui.blockFields : DEFAULT_UI.blockFields;
  const quay = Math.max(50, Number(terminal.quayLength) || 600);
  const mooringCap = metrics.mooringCap ?? 30;
  const mooringRatio = metrics.mooringRatio ?? 0.1;

  const [selectedId, setSelectedId] = useState(null);
  const [selectedCraneId, setSelectedCraneId] = useState(null);
  const [selectedLockId, setSelectedLockId] = useState(null);
  const [lockZoneMode, setLockZoneMode] = useState(false);
  /** Exclusive tool group: view | cranes | locks | labels | null */
  const [toolsPanel, setToolsPanel] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }
  const [toast, setToast] = useState('');
  const plotRef = useRef(null);
  const editorRef = useRef(null);
  const dragRef = useRef(null);
  const undoStack = useRef([]);
  const clipboard = useRef(null);
  const editorUndoArmed = useRef(false);
  const servicesRef = useRef(services);
  servicesRef.current = services;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const selectedLockIdRef = useRef(selectedLockId);
  selectedLockIdRef.current = selectedLockId;
  const selectedCraneIdRef = useRef(selectedCraneId);
  selectedCraneIdRef.current = selectedCraneId;
  const toolsPanelRef = useRef(toolsPanel);
  toolsPanelRef.current = toolsPanel;
  const lockZonesRef = useRef(lockZones);
  lockZonesRef.current = lockZones;
  const cranesRef = useRef(cranes);
  cranesRef.current = cranes;

  const toolsOpen = toolsPanel != null;

  useEffect(() => {
    editorUndoArmed.current = true;
  }, [selectedId]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(''), 2200);
  }, []);

  const pushUndo = useCallback(() => {
    undoStack.current.push(cloneServices(servicesRef.current));
    if (undoStack.current.length > 40) undoStack.current.shift();
  }, []);

  const applyServices = useCallback(
    (next, { recordUndo = true } = {}) => {
      if (recordUndo) pushUndo();
      setServices(typeof next === 'function' ? next : () => next);
    },
    [pushUndo, setServices]
  );

  const closeDrawer = useCallback(() => {
    setSelectedId(null);
    setToolsPanel(null);
    setLockZoneMode(false);
  }, []);

  const closeEditor = closeDrawer;

  const openToolsPanel = useCallback((panel) => {
    setSelectedId(null);
    setToolsPanel((cur) => {
      const next = cur === panel ? null : panel;
      setLockZoneMode(next === 'locks');
      return next;
    });
  }, []);

  /** Click outside the side panel â†’ auto-collapse (chart stays usable while tools are open). */
  useEffect(() => {
    if (!selectedId && !toolsPanel) return;
    const onPointerDown = (e) => {
      const drawer = editorRef.current;
      if (drawer && drawer.contains(e.target)) return;
      if (e.target.closest?.('.page-fnbar')) return;
      if (e.target.closest?.('.modal-root, .modal-card, .modal-backdrop')) return;
      // Keep tool panels open while working on the berth chart
      if (toolsPanel && e.target.closest?.('.plan-stage')) return;
      if (e.target.closest?.('.window-block.interactive')) return;
      if (e.target.closest?.('.crane-block')) return;
      if (e.target.closest?.('.lock-zone-block')) return;
      closeDrawer();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [selectedId, toolsPanel, closeDrawer]);

  const requestDelete = useCallback(
    (id) => {
      const row = servicesRef.current.find((s) => s.id === id);
      if (!row) return;
      setConfirmDelete({ id: row.id, name: row.service || row.id });
    },
    []
  );

  const doDelete = useCallback(() => {
    if (!confirmDelete) return;
    const { id, name } = confirmDelete;
    applyServices((rows) => rows.filter((r) => r.id !== id));
    if (selectedIdRef.current === id) setSelectedId(null);
    setConfirmDelete(null);
    showToast(t('window.toastDeleted', { name }));
  }, [confirmDelete, applyServices, showToast, t]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) {
      showToast(t('window.toastNothing'));
      return;
    }
    setServices(prev);
    showToast(t('window.toastUndone'));
  }, [setServices, showToast, t]);

  const addService = useCallback(() => {
    const id = uid();
    const name = `SVC${servicesRef.current.length + 1}`;
    const row = {
      id,
      service: name,
      color: defaultColorForService(name, servicesRef.current),
      vesselName: '',
      loa: 200,
      volume: 800,
      expectedVolume: 800,
      etbDay: 'Mon',
      etbTime: '08:00',
      etdDay: 'Mon',
      etdTime: '20:00',
      cmph: metrics.vesselCmph ?? 28,
      lineKind: 'fixed',
      volumeChangePct: 5,
      timeChangePct: 5,
      berthSide: 'downstream',
    };
    applyServices((rows) => [...rows, row]);
    setSelectedId(id);
    showToast(t('window.toastAdded', { name }));
  }, [applyServices, metrics.vesselCmph, quay, showToast, t]);

  const duplicateSelected = useCallback(() => {
    const src = servicesRef.current.find((s) => s.id === selectedIdRef.current);
    if (!src) {
      showToast(t('window.toastSelectFirst'));
      return;
    }
    const id = uid();
    const copy = {
      ...src,
      id,
      service: `${src.service}_copy`,
      berthManual: true,
      berthStart:
        src.berthStart != null
          ? Math.max(0, Number(src.berthStart) - 20)
          : Math.max(0, quay - 240),
    };
    applyServices((rows) => [...rows, copy]);
    setSelectedId(id);
    showToast(t('window.toastPasted', { name: copy.service }));
  }, [applyServices, quay, showToast, t]);

  const copySelected = useCallback(() => {
    const src = servicesRef.current.find((s) => s.id === selectedIdRef.current);
    if (!src) {
      showToast(t('window.toastSelectFirst'));
      return;
    }
    clipboard.current = { ...src };
    showToast(t('window.toastCopied', { name: src.service }));
  }, [showToast, t]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard.current) {
      showToast(t('window.toastSelectFirst'));
      return;
    }
    const id = uid();
    const copy = {
      ...clipboard.current,
      id,
      service: `${clipboard.current.service}_2`,
      berthManual: true,
      berthStart:
        clipboard.current.berthStart != null
          ? Math.max(0, Number(clipboard.current.berthStart) - 25)
          : Math.max(0, quay - 240),
    };
    applyServices((rows) => [...rows, copy]);
    setSelectedId(id);
    showToast(t('window.toastPasted', { name: copy.service }));
  }, [applyServices, quay, showToast, t]);

  useEffect(() => {
    const onKey = (e) => {
      if (confirmDelete) {
        // ConfirmModal handles Enter/Esc
        return;
      }

      const typing = isTypingTarget(document.activeElement);
      const mod = e.ctrlKey || e.metaKey;

      if (e.key === 'Escape') {
        if (typing && document.activeElement?.blur) {
          document.activeElement.blur();
        }
        closeEditor();
        setToolsPanel(null);
        setLockZoneMode(false);
        setConfirmDelete(null);
        return;
      }

      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        addService();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === 'c' && !typing) {
        e.preventDefault();
        copySelected();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v' && !typing) {
        e.preventDefault();
        pasteClipboard();
        return;
      }

      if (typing) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const panel = toolsPanelRef.current;
        const lockId = selectedLockIdRef.current;
        const craneId = selectedCraneIdRef.current;
        if (panel === 'cranes') {
          e.preventDefault();
          if (!craneId) {
            showToast(t('window.toastSelectMaint'));
            return;
          }
          const crane = (cranesRef.current || []).find((c) => c.id === craneId);
          setCranes((list) => (list || []).filter((c) => c.id !== craneId));
          setSelectedCraneId(null);
          showToast(t('window.toastDeleted', { name: crane?.name || t('window.toolGroup.cranes') }));
          return;
        }
        if (panel === 'locks') {
          e.preventDefault();
          if (!lockId) {
            showToast(t('window.toastSelectMaint'));
            return;
          }
          const zone = (lockZonesRef.current || []).find((z) => z.id === lockId);
          setLockZones((list) => (list || []).filter((z) => z.id !== lockId));
          setSelectedLockId(null);
          showToast(t('window.toastDeleted', { name: zone?.reason || t('window.toolGroup.locks') }));
          return;
        }
        if (!selectedIdRef.current) return;
        e.preventDefault();
        requestDelete(selectedIdRef.current);
        return;
      }

      // Arrow nudge â€” Excel-like cell move
      if (!selectedIdRef.current) return;
      const row = servicesRef.current.find((s) => s.id === selectedIdRef.current);
      if (!row) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        pushUndo();
        const visualLeftMeans =
          meterDirection === 'ltr'
            ? e.key === 'ArrowLeft'
              ? -5
              : 5
            : e.key === 'ArrowLeft'
              ? 5
              : -5;
        const occ =
          (Number(row.loa) || 0) +
          2 * Math.min((Number(row.loa) || 0) * mooringRatio, mooringCap);
        const cur = row.berthStart != null ? Number(row.berthStart) : 0;
        const next = Math.max(0, Math.min(quay - occ, snap(cur + visualLeftMeans, 5)));
        setServices((rows) =>
          rows.map((r) => (r.id === row.id ? { ...r, berthStart: next, berthManual: true } : r))
        );
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        pushUndo();
        const shift = e.key === 'ArrowUp' ? -0.25 : 0.25;
        const start =
          (dayIndex(row.etbDay) + toDayFraction(row.etbTime)) * 24 + shift;
        const end =
          (dayIndex(row.etdDay) + toDayFraction(row.etdTime)) * 24 + shift;
        let s = start;
        let en = end;
        if (en < s) en += 168;
        if (s < 0) {
          en -= s;
          s = 0;
        }
        if (en > 168) {
          const over = en - 168;
          s = Math.max(0, s - over);
          en = 168;
        }
        const etb = hourToDayTime(s);
        const etd = hourToDayTime(en);
        setServices((rows) =>
          rows.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  etbDay: etb.day,
                  etbTime: etb.time,
                  etdDay: etd.day,
                  etdTime: etd.time,
                }
              : r
          )
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    confirmDelete,
    closeEditor,
    undo,
    addService,
    duplicateSelected,
    copySelected,
    pasteClipboard,
    requestDelete,
    showToast,
    t,
    setLockZones,
    setCranes,
    pushUndo,
    setServices,
    meterDirection,
    quay,
    mooringCap,
    mooringRatio,
  ]);

  const berth = useMemo(
    () => calcBerthCapacity({ services, terminal, metrics, lockZones }),
    [services, terminal, metrics, lockZones]
  );

  const maintenanceObstacles = useMemo(
    () =>
      layoutLockZones(lockZones || [], quay, 1)
        .filter((z) => (Number(z.capacityPct) ?? 0) <= 0)
        .map((z) => ({
          startHour: z.startHour,
          endHour: z.endHour,
          fromMeter: z.fromMeter,
          toMeter: z.toMeter,
        })),
    [lockZones, quay]
  );

  const blocks = useMemo(
    () => layoutMotherVessels(berth.services, quay, fitted.weeks, maintenanceObstacles),
    [berth.services, quay, fitted.weeks, maintenanceObstacles]
  );

  const bargeWindows = useMemo(
    () =>
      planBargeWindowsByWeek({
        blocks,
        lockBlocks: layoutLockZones(lockZones || [], quay, 1),
        quayLength: quay,
        weeks: fitted.weeks,
      }),
    [blocks, lockZones, quay, fitted.weeks]
  );

  const overlapRegions = useMemo(() => computeOverlapRegions(blocks), [blocks]);

  const serviceLegend = useMemo(() => {
    const map = buildServiceColorMap(services);
    return [...map.entries()].map(([code, color]) => {
      const row = services.find(
        (s) =>
          String(s.service || '')
            .trim()
            .toUpperCase() === code
      );
      const calls = services.filter(
        (s) =>
          String(s.service || '')
            .trim()
            .toUpperCase() === code
      ).length;
      return { code, label: row?.service || code, color, calls };
    });
  }, [services]);

  const lockBlocks = useMemo(
    () => layoutLockZones(lockZones || [], quay, fitted.weeks),
    [lockZones, quay, fitted.weeks]
  );

  const totalHours = fitted.totalHours;
  const chartH = totalHours * fitted.pxPerHour;
  const planAnchor = useMemo(() => planWeekMonday(), []);
  const nowHours = (Date.now() - planAnchor.getTime()) / 3600000;

  const jumpToNow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const y = nowHours * fitted.pxPerHour;
    el.classList.add('snap-free');
    const top = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, y - el.clientHeight / 3));
    el.scrollTop = top;
  }, [nowHours, fitted.pxPerHour]);

  useEffect(() => {
    const focus = () => {
      if (scaleId !== 'week') {
        setUi(withHorizon(ui, 'week'));
        return;
      }
      jumpToNow();
      try {
        sessionStorage.setItem('bcl.bootNow', 'done');
      } catch {
        /* ignore */
      }
    };
    const el = scrollRef.current;
    const laidOut = el && el.clientHeight > 200 && Math.abs(viewPx - el.clientHeight) < 4;
    if (sessionStorage.getItem('bcl.bootNow') === '1' && scaleId === 'week' && laidOut) {
      try {
        sessionStorage.setItem('bcl.bootNow', 'done');
      } catch {
        /* ignore */
      }
      jumpToNow();
    }
    window.addEventListener('bcl-focus-now', focus);
    return () => window.removeEventListener('bcl-focus-now', focus);
  }, [jumpToNow, scaleId, ui, setUi, viewPx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const resumeSnap = () => el.classList.remove('snap-free');
    el.addEventListener('wheel', resumeSnap, { passive: true });
    return () => el.removeEventListener('wheel', resumeSnap);
  }, [scaleId]);
  const meterMarks = useMemo(() => buildMeterMarks(quay), [quay]);

  const ticks = useMemo(() => {
    const list = [];
    for (let h = 0; h < totalHours; h += scale.tickEveryHours) {
      list.push({
        hour: h,
        major: h % scale.majorEveryHours === 0,
        dayStart: h % 24 === 0,
      });
    }
    return list;
  }, [totalHours, scale.tickEveryHours, scale.majorEveryHours]);

  const dayBands = useMemo(() => {
    const bands = [];
    for (let h = 0; h < totalHours; h += 24) {
      const day = Math.floor((h % 168) / 24);
      bands.push({
        hour: h,
        dayKey: DAY_KEYS[day],
        date: formatPlanDate(h, planAnchor),
      });
    }
    return bands;
  }, [totalHours, planAnchor]);

  const selected = services.find((s) => s.id === selectedId) || null;
  const selectedCalc = berth.services.find((s) => s.id === selectedId);

  const patchService = useCallback(
    (id, patch, { recordUndo = true } = {}) => {
      if (recordUndo) pushUndo();
      setServices((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [pushUndo, setServices]
  );

  const removeSelected = () => {
    if (!selectedId) return;
    requestDelete(selectedId);
  };

  const beginDrag = (e, block, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const weekOffset = block.weekIndex * 168;
    const plot = plotRef.current?.getBoundingClientRect();
    if (!plot) return;

    const raw = services.find((s) => s.id === block.id);
    pushUndo();
    if (raw && raw.berthStart == null) {
      setServices((rows) =>
        rows.map((r) =>
          r.id === block.id ? { ...r, berthStart: block.fromMeter, berthManual: true } : r
        )
      );
    }

    dragRef.current = {
      id: block.id,
      mode,
      segment: block.segment || 'whole',
      weekOffset,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origStart: block.localStart != null ? block.localStart : block.startHour - weekOffset,
      origEnd: block.localEnd != null ? block.localEnd : block.endHour - weekOffset,
      origFrom: block.fromMeter,
      origOcc: block.occupation,
      origLoa: block.loa,
      duration:
        (block.localEnd != null ? block.localEnd : block.endHour) -
        (block.localStart != null ? block.localStart : block.startHour - weekOffset),
    };
    setSelectedId(block.id);
    setToolsPanel(null);
    setLockZoneMode(false);
  };

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const plot = plotRef.current?.getBoundingClientRect();
      if (!plot) return;

      if (d.mode === 'move') {
        const dyHours = (e.clientY - d.startClientY) / fitted.pxPerHour;
        const dxMeter =
          clientXToMeter(e.clientX, plot, quay, meterDirection) -
          clientXToMeter(d.startClientX, plot, quay, meterDirection);

        let newStart = snap(d.origStart + dyHours, 0.25);
        let newEnd = newStart + d.duration;
        if (newEnd - newStart < 1) newEnd = newStart + 1;

        const etb = hourToDayTime(newStart);
        const etd = hourToDayTime(newEnd);
        let berthStart = snap(d.origFrom + dxMeter, 5);
        berthStart = Math.max(0, Math.min(quay - d.origOcc, berthStart));
        d.last = { start: newStart, end: newEnd, from: berthStart, occ: d.origOcc };

        patchService(d.id, {
          etbDay: etb.day,
          etbTime: etb.time,
          etdDay: etd.day,
          etdTime: etd.time,
          berthStart,
          berthManual: true,
        }, { recordUndo: false });
        return;
      }

      if (d.mode === 'resize-end') {
        const hourAbs = clientYToHour(e.clientY, plot, fitted.pxPerHour, totalHours);
        let newEnd = snap(hourAbs - d.weekOffset, 0.25);
        if (d.segment === 'tail' && newEnd <= d.origStart) newEnd += 168;
        if (newEnd < d.origStart + 1) newEnd = d.origStart + 1;
        const etd = hourToDayTime(newEnd);
        d.last = { start: d.origStart, end: newEnd, from: d.origFrom, occ: d.origOcc };
        patchService(d.id, { etdDay: etd.day, etdTime: etd.time }, { recordUndo: false });
        return;
      }

      if (d.mode === 'resize-start') {
        const hourAbs = clientYToHour(e.clientY, plot, fitted.pxPerHour, totalHours);
        let newStart = snap(hourAbs - d.weekOffset, 0.25);
        if (d.segment === 'head' && newStart > d.origEnd) newStart -= 168;
        if (newStart > d.origEnd - 1) newStart = d.origEnd - 1;
        const etb = hourToDayTime(newStart);
        d.last = { start: newStart, end: d.origEnd, from: d.origFrom, occ: d.origOcc };
        patchService(d.id, { etbDay: etb.day, etbTime: etb.time }, { recordUndo: false });
        return;
      }

      if (d.mode === 'resize-loa' || d.mode === 'resize-loa-w') {
        // Visual right (resize-loa) / left (resize-loa-w) â†’ change occupation width
        const meterEdge = clientXToMeter(e.clientX, plot, quay, meterDirection);
        const origTo = d.origFrom + d.origOcc;
        const minOcc = 40;
        // Which meter edge is under this visual handle?
        // LTR: left = fromMeter, right = toMeter
        // RTL: left = toMeter, right = fromMeter
        const resizingFromEdge =
          (meterDirection === 'ltr' && d.mode === 'resize-loa-w') ||
          (meterDirection !== 'ltr' && d.mode === 'resize-loa');

        let berthStart;
        let newOcc;
        if (resizingFromEdge) {
          // Keep toMeter fixed; move fromMeter / berthStart
          let newFrom = snap(meterEdge, 5);
          newFrom = Math.max(0, Math.min(origTo - minOcc, newFrom));
          newOcc = origTo - newFrom;
          berthStart = newFrom;
        } else {
          // Keep fromMeter fixed; grow/shrink toward toMeter
          newOcc = Math.max(minOcc, meterEdge - d.origFrom);
          newOcc = Math.min(quay - d.origFrom, snap(newOcc, 5));
          berthStart = d.origFrom;
          if (berthStart + newOcc > quay) berthStart = Math.max(0, quay - newOcc);
        }
        const loa = loaFromOccupation(newOcc, mooringCap, mooringRatio);
        d.last = { start: d.origStart, end: d.origEnd, from: berthStart, occ: newOcc };
        patchService(d.id, { loa, berthStart, berthManual: true }, { recordUndo: false });
      }
    };

    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d?.last) return;
      const occ = d.last.occ || d.origOcc;
      if (overlapsMaintenance(d.last.start, d.last.end, d.last.from, occ, lockZones, quay)) {
        const etb = hourToDayTime(d.origStart);
        const etd = hourToDayTime(d.origEnd);
        patchService(
          d.id,
          {
            etbDay: etb.day,
            etbTime: etb.time,
            etdDay: etd.day,
            etdTime: etd.time,
            berthStart: d.origFrom,
            berthManual: true,
            loa: d.origLoa,
          },
          { recordUndo: false }
        );
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [
    fitted.pxPerHour,
    totalHours,
    quay,
    meterDirection,
    patchService,
    mooringCap,
    mooringRatio,
    lockZones,
  ]);

  return (
    <div className={`plan-shell ${selected || toolsOpen ? 'drawer-open' : ''}`}>
      <PageToolbar>
        <button type="button" className="btn" data-tip={t('tip.jumpNow')} onClick={jumpToNow}>
          {t('window.jumpNow')}
        </button>
        <button type="button" className="btn" data-tip={t('tip.addService')} onClick={addService}>
          {t('window.addService')}
        </button>
        <button
          type="button"
          className={`chip ${toolsPanel === 'cranes' ? 'active' : ''}`}
          data-tip={t('tip.cranes')}
          onClick={() => openToolsPanel('cranes')}
        >
          {t('window.toolGroup.cranes')}
        </button>
        <button
          type="button"
          className={`chip ${toolsPanel === 'locks' || lockZoneMode ? 'active' : ''}`}
          data-tip={t('tip.locks')}
          onClick={() => openToolsPanel('locks')}
        >
          {t('window.toolGroup.locks')}
        </button>
        <button
          type="button"
          className={`chip ${toolsPanel === 'labels' ? 'active' : ''}`}
          data-tip={t('tip.labels')}
          onClick={() => openToolsPanel('labels')}
        >
          {t('window.toolGroup.labels')}
        </button>
      </PageToolbar>
      <div className="plan-toolbar-strip">
        <div className="live-kpis compact">
          <div>
            <span>{t('window.liveBu')}</span>
            <strong>{pct(berth.berthUtilization)}</strong>
          </div>
          <div>
            <span>MH</span>
            <strong>{fmt(berth.proformaMeterHoursWeek, 0)}</strong>
          </div>
        </div>
        <div className="service-color-legend" aria-label={t('window.serviceLegend')}>
          <span className="service-color-legend-title">{t('window.serviceLegend')}</span>
          <ul>
            {serviceLegend.map((item) => (
              <li key={item.code}>
                <span className="swatch" style={{ background: item.color }} />
                <strong>{item.label}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="layer-toggle" role="group" aria-label={t('ops.layerAll')}>
          {[
            ['all', 'ops.layerAll', null, 'tip.layerAll'],
            ['ops', 'ops.layerOps', null, 'tip.layerOps'],
            ['mother', 'ops.layerMother', IconVessel, 'tip.layerMother'],
            ['barge', 'ops.layerBarge', IconBarge, 'tip.layerBarge'],
            ['maintenance', 'ops.layerMaint', null, 'tip.layerMaint'],
          ].map(([id, key, Icon, tip]) => (
            <button
              key={id}
              type="button"
              className={`chip ${chartLayer === id ? 'active' : ''}`}
              data-tip={t(tip)}
              onClick={() => setUi({ ...ui, chartLayer: id })}
            >
              {Icon ? <Icon size={14} /> : null}
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      <div className="plan-workbench">
      <div className="plan-stage">
        <div className="plan-chart-frame plan-chart-full">
          <div className="crane-freeze">
            <div className="crane-freeze-track" ref={freezeTrackRef}>
            <div className="window-meters">
              {meterMarks.map((m) => (
                <span
                  key={m}
                  style={{ left: `${meterToLeftPercent(m, quay, meterDirection)}%` }}
                >
                  {m}m
                </span>
              ))}
            </div>
            <CraneRail
              cranes={cranes || []}
              quayLength={quay}
              meterDirection={meterDirection}
              selectedId={selectedCraneId}
              onSelect={setSelectedCraneId}
              onEdit={(id) => {
                setSelectedId(null);
                setSelectedCraneId(id);
                setToolsPanel('cranes');
                setLockZoneMode(false);
              }}
              onMove={moveMainCrane}
            />
            </div>
          </div>
          <div
            ref={scrollRef}
            className={`window-scroll plan-chart-scroll${fitted.snap ? ' snap-page' : ''}`}
            onScroll={syncFreeze}
          >
          <div className="window-chart plan-plot">
            {fitted.snap
              ? Array.from({ length: scale.pages }, (_, page) => (
                  <div key={`page-${page}`} className="period-snap" style={{ top: page * viewPx }} />
                ))
              : null}
            <div className="window-body continuous has-crane" style={{ height: chartH }}>
              <div className="window-day-rail">
                {dayBands.map((b) => (
                  <div
                    key={`band-${b.hour}`}
                    className={`window-day-band${b.dayKey === 'Sun' ? ' is-sun' : ''}${b.dayKey === 'Mon' ? ' is-mon' : ''}`}
                    style={{
                      top: b.hour * fitted.pxPerHour,
                      height: 24 * fitted.pxPerHour,
                    }}
                  >
                    <span className="day-date">{b.date}</span>
                    {scaleId === 'month' ? null : <span className="day-name">{t(`days.${b.dayKey}`)}</span>}
                  </div>
                ))}
              </div>

              <div className="window-tick-rail">
                {ticks.map((tk) => (
                  <div
                    key={tk.hour}
                    className={`window-tick-row ${tk.major ? 'major' : ''} ${tk.dayStart ? 'day-start' : ''}`}
                    style={{
                      top: tk.hour * fitted.pxPerHour,
                      height: scale.tickEveryHours * fitted.pxPerHour,
                    }}
                  >
                    <span>{scaleId === 'month' ? '' : formatHourLabel(tk.hour, scaleId, t)}</span>
                  </div>
                ))}
              </div>

              <div
                className="window-plot"
                ref={plotRef}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) closeEditor();
                }}
              >
                {ticks.map((tk) => (
                  <div
                    key={`g-${tk.hour}`}
                    className={`window-gridline ${tk.dayStart ? 'day' : ''} ${tk.major ? 'major' : ''}`}
                    style={{ top: tk.hour * fitted.pxPerHour }}
                  />
                ))}
                {nowHours >= 0 && nowHours <= totalHours && (
                  <div className="now-line" style={{ top: nowHours * fitted.pxPerHour }}>
                    <span>{t('window.jumpNow')}</span>
                  </div>
                )}
                {ui?.showShiftMarks !== false && scaleId !== 'week' && scaleId !== 'month' &&
                  shiftMarks.map((mark) => (
                  <div
                    key={mark.key}
                    className="shift-handover"
                    style={{ top: mark.hour * fitted.pxPerHour }}
                    title={t('settings.shiftTitle')}
                  >
                    <span>{mark.label}</span>
                  </div>
                ))}

                {bargeWindows.map((win) => {
                  const top = win.startHour * fitted.pxPerHour;
                  const height = Math.max(16, (win.endHour - win.startHour) * fitted.pxPerHour);
                  const pos = segmentCss(win.fromMeter, win.toMeter, quay, meterDirection);
                  const hidden = chartLayer === 'mother' || chartLayer === 'maintenance';
                  return (
                    <div
                      key={win.key}
                      className="barge-window"
                      style={{
                        top,
                        height,
                        left: pos.left,
                        width: pos.width,
                        opacity: hidden ? 0.08 : 1,
                      }}
                      title={`${t('ops.bargeWindow')} ${Math.round(win.fromMeter)}â€“${Math.round(win.toMeter)} m`}
                    >
                      {height >= 28 && (
                        <span>
                          <IconBarge size={12} />
                          {t('ops.bargeWindow')}
                        </span>
                      )}
                    </div>
                  );
                })}

                {lockBlocks.map((lz) => {
                  const top = lz.startHour * fitted.pxPerHour;
                  const height = Math.max(18, (lz.endHour - lz.startHour) * fitted.pxPerHour);
                  const pos = segmentCss(lz.fromMeter, lz.toMeter, quay, meterDirection);
                  const active = selectedLockId === lz.id;
                  const dimLock = chartLayer === 'mother' || chartLayer === 'barge';
                  const tip = [
                    lz.reason || t('lockZone.title'),
                    `${Math.round(lz.fromMeter)}â€“${Math.round(lz.toMeter)}m`,
                    `${lz.capacityPct}% ${t('lockZone.capacityShort')}`,
                  ].join('\n');
                  return (
                    <div
                      key={lz.key}
                      className={`lock-zone-block maintenance ${active ? 'selected' : ''}`}
                      style={{
                        top,
                        height,
                        left: pos.left,
                        width: pos.width,
                        opacity: dimLock ? 0.12 : 1,
                      }}
                      title={tip}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedLockId(lz.id);
                        setSelectedId(null);
                        setLockZoneMode(true);
                        setToolsPanel('locks');
                      }}
                    >
                      <div className="lock-zone-body">
                        <strong>{lz.reason || t('lockZone.title')}</strong>
                        <span>
                          {Math.round(lz.lengthM)}m Â· {lz.capacityPct}%
                        </span>
                      </div>
                    </div>
                  );
                })}

                {blocks.map((b) => {
                  const top = b.startHour * fitted.pxPerHour;
                  const height = Math.max(18, (b.endHour - b.startHour) * fitted.pxPerHour);
                  const pos = segmentCss(b.fromMeter, b.toMeter, quay, meterDirection);
                  const active = selectedId === b.id;
                  const facts = buildBlockFacts(b, blockFields, t);
                  const tip = facts.map((l) => (l.label ? `${l.label} ${l.value}` : l.value)).join('\n');
                  const bg = chartLayer === 'ops' ? '#1d4ed8' : resolveServiceColor(b, services);
                  const dimMother = chartLayer === 'barge' || chartLayer === 'maintenance';
                  return (
                    <div
                      key={b.key}
                      className={`window-block interactive rich ${b.quayOverflow ? 'quay-overflow' : ''} ${b.maintenanceConflict ? 'maintenance-hit' : ''} ${active ? 'selected' : ''}`}
                      style={{
                        top,
                        height,
                        left: pos.left,
                        width: pos.width,
                        background: bg,
                        opacity: dimMother ? 0.14 : 1,
                      }}
                      onPointerDown={(e) => beginDrag(e, b, 'move')}
                      title={tip}
                    >
                      <div
                        className="handle handle-n"
                        onPointerDown={(e) => beginDrag(e, b, 'resize-start')}
                        hidden={b.segment === 'tail'}
                      />
                      <div className="block-body">
                        {facts.map((line) => (
                          <span key={line.key} className={`block-fact ${line.service ? 'is-service' : ''} ${line.primary ? 'is-primary' : ''}`}>
                            {line.label ? <span className="block-fact-label">{line.label}</span> : null}
                            <span className="block-fact-value">{line.value}</span>
                          </span>
                        ))}
                      </div>
                      <div
                        className="handle handle-s"
                        onPointerDown={(e) => beginDrag(e, b, 'resize-end')}
                        hidden={b.segment === 'head'}
                      />
                      <div
                        className="handle handle-w"
                        onPointerDown={(e) => beginDrag(e, b, 'resize-loa-w')}
                      />
                      <div
                        className="handle handle-e"
                        onPointerDown={(e) => beginDrag(e, b, 'resize-loa')}
                      />
                    </div>
                  );
                })}

                {overlapRegions.map((ov) => {
                  const top = ov.startHour * fitted.pxPerHour;
                  const height = Math.max(4, (ov.endHour - ov.startHour) * fitted.pxPerHour);
                  const pos = segmentCss(ov.fromMeter, ov.toMeter, quay, meterDirection);
                  const tip = t('window.overlapZone', {
                    a: ov.labels[0],
                    b: ov.labels[1],
                  });
                  return (
                    <div
                      key={ov.key}
                      className="overlap-zone"
                      style={{
                        top,
                        height,
                        left: pos.left,
                        width: pos.width,
                      }}
                      title={tip}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {(selected || toolsOpen) && (
            <aside
              ref={editorRef}
              className="plan-editor-drawer berth-plan-drawer panel"
              role="dialog"
              aria-label={selected ? t('window.selected') : t('window.tools')}
              onFocusCapture={() => {
                if (!selected) return;
                if (!editorUndoArmed.current) return;
                editorUndoArmed.current = false;
                pushUndo();
              }}
            >

            {toolsPanel === 'cranes' && (
              <div className="tool-group-body">
                <div className="drawer-head">
                  <h2>{t('window.toolGroup.cranes')}</h2>
                  <button type="button" className="btn-ghost" data-tip={t('tip.close')} onClick={closeDrawer}>
                    {t('window.closeEditor')} ?
                  </button>
                </div>
                <CraneManager
                  cranes={cranes || []}
                  setCranes={setCranes}
                  selectedId={selectedCraneId}
                  setSelectedId={setSelectedCraneId}
                  quayLength={quay}
                  compact
                />
              </div>
            )}

            {toolsPanel === 'locks' && (
              <div className="tool-group-body">
                <div className="drawer-head">
                  <h2>{t('window.toolGroup.locks')}</h2>
                  <button type="button" className="btn-ghost" data-tip={t('tip.close')} onClick={closeDrawer}>
                    {t('window.closeEditor')} ?
                  </button>
                </div>
                <LockZoneManager
                  lockZones={lockZones || []}
                  setLockZones={setLockZones}
                  selectedId={selectedLockId}
                  setSelectedId={setSelectedLockId}
                  quayLength={quay}
                  cranes={cranes || []}
                  shiftTimes={handoverTimes(ui)}
                />
              </div>
            )}

            {toolsPanel === 'labels' && (
              <div className="tool-group-body">
                <div className="drawer-head">
                  <h2>{t('window.toolGroup.labels')}</h2>
                  <button type="button" className="btn-ghost" data-tip={t('tip.close')} onClick={closeDrawer}>
                    {t('window.closeEditor')} ?
                  </button>
                </div>
                <div className="block-fields-config">
                  <div className="block-fields-head">
                    <span className="toolbar-label">{t('window.blockFieldsTitle')}</span>
                    <div className="scale-toggle compact wrap">
                      <button
                        type="button"
                        className="chip"
                        data-tip={t('tip.selectAll')}
                        onClick={() => setUi({ ...ui, blockFields: [...BLOCK_FIELD_OPTIONS] })}
                      >
                        {t('window.selectAllFields')}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        data-tip={t('tip.selectDefault')}
                        onClick={() => setUi({ ...ui, blockFields: [...DEFAULT_UI.blockFields] })}
                      >
                        {t('window.selectDefaultFields')}
                      </button>
                    </div>
                  </div>
                  <p className="hint" style={{ margin: '0.25rem 0 0.45rem' }}>
                    {t('window.blockFieldsHint')}
                  </p>
                  <label className={`field-check span-all ${ui?.showShiftMarks !== false ? 'on' : ''}`} data-tip={t('tip.shiftMark')}>
                    <input
                      type="checkbox"
                      checked={ui?.showShiftMarks !== false}
                      onChange={() => setUi({ ...ui, showShiftMarks: ui?.showShiftMarks === false })}
                    />
                    {t('window.showShiftMarks')}
                  </label>
                  <div className="field-check-grid drawer-checks">
                    {BLOCK_FIELD_OPTIONS.map((key) => {
                      const on = blockFields.includes(key);
                      return (
                        <label key={key} className={`field-check ${on ? 'on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => {
                              const next = on
                                ? blockFields.filter((f) => f !== key)
                                : [...blockFields, key];
                              const ordered = BLOCK_FIELD_OPTIONS.filter((f) => next.includes(f));
                              setUi({
                                ...ui,
                                blockFields: ordered.length ? ordered : ['service'],
                              });
                            }}
                          />
                          {t(`window.blockField.${key}`)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {selected && !toolsOpen ? (
              <div className="tool-group-body service-editor-body">
              <div className="drawer-head">
                <h2>{t('window.selected')}</h2>
                <button type="button" className="btn-ghost" data-tip={t('tip.close')} onClick={closeDrawer}>
                  {t('window.closeEditor')} ?
                  </button>
              </div>
              <div className="field-grid single">
                <label>
                  {t('capacity.th.service')}
                  <input
                    value={selected.service}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      const existing = servicesRef.current.find(
                        (s) =>
                          s.id !== selected.id &&
                          String(s.service || '')
                            .trim()
                            .toUpperCase() === String(nextName).trim().toUpperCase()
                      );
                      patchService(
                        selected.id,
                        {
                          service: nextName,
                          color: existing?.color || selected.color || defaultColorForService(nextName, servicesRef.current),
                        },
                        { recordUndo: false }
                      );
                    }}
                  />
                </label>
                <label className="color-field span-all">
                  {t('window.serviceColor')}
                  <div className="color-field-row">
                    <input
                      type="color"
                      className="color-input"
                      value={resolveServiceColor(selected, services)}
                      onChange={(e) => setServiceLineColor?.(selected.service, e.target.value)}
                      title={t('window.serviceColorHint')}
                    />
                    <div className="color-swatch-row">
                      {SERVICE_COLOR_PALETTE.slice(0, 8).map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`color-swatch ${resolveServiceColor(selected, services) === c ? 'active' : ''}`}
                          style={{ background: c }}
                          aria-label={c}
                          onClick={() => setServiceLineColor?.(selected.service, c)}
                        />
                      ))}
                    </div>
                  </div>
                </label>
                <label className="span-all">
                  {t('window.vesselName')}
                  <input
                    value={selected.vesselName || ''}
                    placeholder={t('window.vesselPlaceholder')}
                    onChange={(e) =>
                      patchService(selected.id, { vesselName: e.target.value }, { recordUndo: false })
                    }
                  />
                </label>
                <label>
                  LOA (m)
                  <input
                    type="number"
                    value={selected.loa}
                    onChange={(e) => {
                      const loa = Number(e.target.value);
                      const occ = loa + 2 * Math.min(loa * mooringRatio, mooringCap);
                      let berthStart = selected.berthStart;
                      if (berthStart != null && berthStart + occ > quay) {
                        berthStart = Math.max(0, quay - occ);
                      }
                      patchService(selected.id, { loa, berthStart }, { recordUndo: false });
                    }}
                  />
                </label>
                <label>
                  {t('window.proformaVolume')}
                  <input
                    type="number"
                    value={selected.volume}
                    onChange={(e) =>
                      patchService(selected.id, { volume: Number(e.target.value) }, { recordUndo: false })
                    }
                  />
                </label>
                <label>
                  {t('window.expectedVolume')}
                  <input
                    type="number"
                    value={selected.expectedVolume ?? selected.volume ?? ''}
                    onChange={(e) =>
                      patchService(
                        selected.id,
                        { expectedVolume: Number(e.target.value) },
                        { recordUndo: false }
                      )
                    }
                  />
                </label>
                <label>
                  CMPH
                  <input
                    type="number"
                    value={selected.cmph ?? metrics.vesselCmph}
                    onChange={(e) =>
                      patchService(selected.id, { cmph: Number(e.target.value) }, { recordUndo: false })
                    }
                  />
                </label>
                <label>
                  {t('capacity.th.etb')}
                  <div className="datetime">
                    <select
                      value={selected.etbDay}
                      onChange={(e) =>
                        patchService(selected.id, { etbDay: e.target.value }, { recordUndo: false })
                      }
                    >
                      {DAY_KEYS.map((d) => (
                        <option key={d} value={d}>
                          {t(`days.${d}`)}
                        </option>
                      ))}
                    </select>
                    <input
                      value={selected.etbTime}
                      onChange={(e) =>
                        patchService(selected.id, { etbTime: e.target.value }, { recordUndo: false })
                      }
                    />
                  </div>
                </label>
                <label>
                  {t('capacity.th.etd')}
                  <div className="datetime">
                    <select
                      value={selected.etdDay}
                      onChange={(e) =>
                        patchService(selected.id, { etdDay: e.target.value }, { recordUndo: false })
                      }
                    >
                      {DAY_KEYS.map((d) => (
                        <option key={d} value={d}>
                          {t(`days.${d}`)}
                        </option>
                      ))}
                    </select>
                    <input
                      value={selected.etdTime}
                      onChange={(e) =>
                        patchService(selected.id, { etdTime: e.target.value }, { recordUndo: false })
                      }
                    />
                  </div>
                </label>
                <label>
                  {t('capacity.th.lineKind')}
                  <select
                    value={selected.lineKind === 'adhoc' ? 'adhoc' : 'fixed'}
                    onChange={(e) =>
                      patchService(selected.id, { lineKind: e.target.value }, { recordUndo: false })
                    }
                  >
                    <option value="fixed">{t('capacity.lineFixed')}</option>
                    <option value="adhoc">{t('capacity.lineAdhoc')}</option>
                  </select>
                </label>
                <label>
                  {t('capacity.th.volumeChange')}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    disabled={selected.lineKind === 'adhoc'}
                    value={selected.lineKind === 'adhoc' ? 0 : selected.volumeChangePct ?? 0}
                    onChange={(e) =>
                      patchService(
                        selected.id,
                        {
                          volumeChangePct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        },
                        { recordUndo: false }
                      )
                    }
                  />
                </label>
                <label>
                  {t('capacity.th.timeChange')}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    disabled={selected.lineKind === 'adhoc'}
                    value={selected.lineKind === 'adhoc' ? 0 : selected.timeChangePct ?? 0}
                    onChange={(e) =>
                      patchService(
                        selected.id,
                        {
                          timeChangePct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        },
                        { recordUndo: false }
                      )
                    }
                  />
                </label>
                <label>
                  {t('capacity.th.berthSide')}
                  <select
                    value={selected.berthManual ? 'manual' : selected.berthSide || 'downstream'}
                    onChange={(e) => {
                      if (e.target.value === 'manual') return;
                      patchService(
                        selected.id,
                        { berthSide: e.target.value, berthManual: false, berthStart: null },
                        { recordUndo: false }
                      );
                    }}
                  >
                    <option value="upstream">{t('capacity.sideUpstream')}</option>
                    <option value="downstream">
                      {t('capacity.sideDownstream', { quay })}
                    </option>
                    {selected.berthManual ? (
                      <option value="manual">{t('capacity.sideManual')}</option>
                    ) : null}
                  </select>
                </label>
                <label>
                  {t('window.berthStart')}
                  <input
                    type="number"
                    step={5}
                    value={Math.round(selected.berthStart ?? selectedCalc?.fromMeter ?? 0)}
                    onChange={(e) =>
                      patchService(
                        selected.id,
                        { berthStart: Number(e.target.value), berthManual: true },
                        { recordUndo: false }
                      )
                    }
                  />
                </label>
              </div>
              {selectedCalc && (
                <div className="editor-stats">
                  <div>
                    <span>{t('capacity.th.occ')}</span>
                    <strong>{fmt(selectedCalc.occupation, 1)} m</strong>
                  </div>
                  <div>
                    <span>{t('capacity.th.netStay')}</span>
                    <strong>{fmt(selectedCalc.netPortstay, 1)} h</strong>
                  </div>
                  <div>
                    <span>{t('capacity.th.meterH')}</span>
                    <strong>{fmt(selectedCalc.meterHours, 0)}</strong>
                  </div>
                  <div>
                    <span>PMPH</span>
                    <strong>{fmt(selectedCalc.pmph, 1)}</strong>
                  </div>
                  {blocks.some((b) => b.id === selected.id && b.hasOverlap) && (
                    <div className="warn">{t('window.overlap')}</div>
                  )}
                  {blocks.some((b) => b.id === selected.id && b.quayOverflow) && (
                    <div className="warn">{t('window.quayOverflow')}</div>
                  )}
                </div>
              )}
              <div className="editor-actions">
                <button type="button" className="btn-ghost danger" data-tip={t('tip.delete')} onClick={removeSelected}>
                  {t('window.delete')}
                  <kbd>Del</kbd>
                </button>
                <button type="button" className="btn-ghost" data-tip={t('tip.duplicate')} onClick={duplicateSelected}>
                  Ctrl+D
                </button>
              </div>
              </div>
            ) : null}
            </aside>
      )}
      </div>

      <footer className="plan-statusbar">
        <span>{t('window.statusBar')}</span>
        {toast && <strong className="plan-toast">{toast}</strong>}
      </footer>

      <ConfirmModal
        open={!!confirmDelete}
        title={t('window.confirmDeleteTitle')}
        message={t('window.confirmDeleteMsg', { name: confirmDelete?.name || '' })}
        confirmLabel={t('window.confirmDeleteOk')}
        cancelLabel={t('window.confirmDeleteCancel')}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
