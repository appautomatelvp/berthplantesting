import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CapacityBoard from './pages/CapacityBoard';
import BerthingWindow from './pages/BerthingWindow';
import SecondaryBerth from './pages/SecondaryBerth';
import Dashboard from './pages/Dashboard';
import Guide from './pages/Guide';
import Settings from './pages/Settings';
import { useI18n } from './i18n/I18nContext';
import {
  DEFAULT_CRANES,
  DEFAULT_EQUIPMENT,
  DEFAULT_EXTERNAL_BERTHS,
  DEFAULT_LOCK_ZONES,
  DEFAULT_METRICS,
  DEFAULT_SECONDARY_BERTH,
  DEFAULT_SERVICES,
  DEFAULT_TERMINAL,
} from './data/seed';
import { DEFAULT_UI, HORIZONS, withHorizon } from './lib/uiSettings';
import { clampCraneDragPosition } from './lib/crane';
import { applyColorToServiceLine, withServiceColors } from './lib/serviceColor';
import { FlagUnitedKingdom, FlagVietnam, PortLogo } from './components/icons/PortIcons';
import ParameterExcel from './components/ParameterExcel';
import ButtonHints from './components/ButtonHints';

function TabBranch({ path }) {
  const [geom, setGeom] = useState(null);

  const measure = useCallback(() => {
    const stack = document.querySelector('.app-nav-stack');
    const active = stack?.querySelector('.nav-link.active');
    const actions = stack?.querySelector('.page-fnbar-actions');
    if (!stack || !active || !actions) {
      setGeom(null);
      return;
    }
    const buttons = [...actions.children].filter((el) => el.getBoundingClientRect().width > 0);
    if (!buttons.length) {
      setGeom(null);
      return;
    }
    const bar = actions.parentElement;
    const barBox = bar.getBoundingClientRect();
    const actionsBox = actions.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    const picked =
      buttons.find((el) => el.classList.contains('fn-picked')) ||
      buttons.find((el) => el.classList.contains('active')) ||
      buttons[0];
    const anchor = picked.getBoundingClientRect();
    const currentShift = parseFloat(actions.style.marginLeft) || 0;
    const maxShift = Math.max(0, barBox.width - actionsBox.width);
    const nextShift = Math.max(
      0,
      Math.min(maxShift, currentShift + (tab.left + tab.width / 2) - (anchor.left + anchor.width / 2))
    );
    if (Math.abs(nextShift - currentShift) > 0.5) {
      actions.style.marginLeft = `${nextShift}px`;
    }
    const origin = stack.getBoundingClientRect();
    const node = picked
      ? (() => {
          const box = picked.getBoundingClientRect();
          return {
            x: box.left + box.width / 2 - origin.left,
            top: box.top - origin.top,
          };
        })()
      : null;
    setGeom({
      width: origin.width,
      height: origin.height,
      stemX: tab.left + tab.width / 2 - origin.left,
      stemTop: tab.bottom - origin.top,
      node,
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    const stack = document.querySelector('.app-nav-stack');
    const bar = document.getElementById('page-fnbar');
    if (!stack) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(stack);
    if (bar) ro.observe(bar);
    const mo = new MutationObserver(measure);
    if (bar) mo.observe(bar, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, path]);

  if (!geom?.node) return null;
  const railY = geom.node.top - 8;

  return (
    <svg className="tab-branch" width={geom.width} height={geom.height} aria-hidden>
      <line className="tab-branch-stem" x1={geom.stemX} y1={geom.stemTop} x2={geom.stemX} y2={railY} />
      <line className="tab-branch-rail" x1={geom.stemX} y1={railY} x2={geom.node.x} y2={railY} />
      <line className="tab-branch-drop hot" x1={geom.node.x} y1={railY} x2={geom.node.x} y2={geom.node.top - 1} />
      <circle className="tab-branch-node" cx={geom.stemX} cy={geom.stemTop + 1} r="2.5" />
      <circle className="tab-branch-node" cx={geom.node.x} cy={geom.node.top - 1} r="2.5" />
    </svg>
  );
}

const DATA_KEY = 'bcl.data';

function readSavedData() {
  try {
    return JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
  } catch {
    return null;
  }
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const bootRef = useRef(false);
  const bootMark = useRef(false);
  const dataBaseline = useRef(null);
  const dataSkips = useRef(1);
  const dataDirty = useRef(false);
  const { t, locale, setLocale } = useI18n();
  const [savedPack] = useState(readSavedData);
  const [terminal, setTerminal] = useState(savedPack?.terminal || DEFAULT_TERMINAL);
  const [metrics, setMetrics] = useState(savedPack?.metrics || DEFAULT_METRICS);
  const [services, setServicesState] = useState(() =>
    withServiceColors(savedPack?.services || DEFAULT_SERVICES)
  );
  const [equipment, setEquipment] = useState(savedPack?.equipment || DEFAULT_EQUIPMENT);
  const [cranes, setCranes] = useState(savedPack?.cranes || DEFAULT_CRANES);
  const [lockZones, setLockZones] = useState(savedPack?.lockZones || DEFAULT_LOCK_ZONES);
  const [secondaryBerth, setSecondaryBerth] = useState(
    savedPack?.secondaryBerth || DEFAULT_SECONDARY_BERTH
  );
  const [externalBerths, setExternalBerths] = useState(
    savedPack?.externalBerths || DEFAULT_EXTERNAL_BERTHS
  );
  const [ui, setUiState] = useState(() => {
    const fromFile = savedPack?.ui;
    if (fromFile) return { ...DEFAULT_UI, ...fromFile };
    try {
      const saved = JSON.parse(localStorage.getItem('bcl.ui') || 'null');
      return { ...DEFAULT_UI, ...saved };
    } catch {
      return { ...DEFAULT_UI };
    }
  });
  const [savedFlash, setSavedFlash] = useState(false);

  const setUi = useCallback((next) => {
    setUiState(next);
    try {
      localStorage.setItem('bcl.ui', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setServices = useCallback((next) => {
    setServicesState((prev) => withServiceColors(typeof next === 'function' ? next(prev) : next));
  }, []);

  const setServiceLineColor = useCallback((serviceCode, color) => {
    setServicesState((prev) => withServiceColors(applyColorToServiceLine(prev, serviceCode, color)));
  }, []);

  const liveRef = useRef(null);
  liveRef.current = {
    terminal,
    metrics,
    services,
    equipment,
    cranes,
    lockZones,
    secondaryBerth,
    externalBerths,
    ui,
  };
  const historyRef = useRef({ past: [], future: [], lock: false, at: 0 });

  const remember = useCallback(() => {
    const book = historyRef.current;
    if (book.lock || !liveRef.current) return;
    const now = Date.now();
    if (now - book.at < 450 && book.past.length) return;
    book.at = now;
    book.past.push(cloneData(liveRef.current));
    if (book.past.length > 40) book.past.shift();
    book.future = [];
  }, []);

  const applyPack = useCallback((pack) => {
    if (!pack) return;
    historyRef.current.lock = true;
    setTerminal(pack.terminal || DEFAULT_TERMINAL);
    setMetrics(pack.metrics || DEFAULT_METRICS);
    setServicesState(withServiceColors(pack.services || []));
    setEquipment(pack.equipment || DEFAULT_EQUIPMENT);
    setCranes(pack.cranes || DEFAULT_CRANES);
    setLockZones(pack.lockZones || []);
    setSecondaryBerth(pack.secondaryBerth || DEFAULT_SECONDARY_BERTH);
    setExternalBerths(pack.externalBerths || []);
    setUi({ ...DEFAULT_UI, ...(pack.ui || {}) });
    window.setTimeout(() => {
      historyRef.current.lock = false;
    }, 0);
  }, [setUi]);

  const undoData = useCallback(() => {
    const book = historyRef.current;
    const prev = book.past.pop();
    if (!prev) return;
    book.future.push(cloneData(liveRef.current));
    book.at = Date.now();
    applyPack(prev);
  }, [applyPack]);

  const redoData = useCallback(() => {
    const book = historyRef.current;
    const next = book.future.pop();
    if (!next) return;
    book.past.push(cloneData(liveRef.current));
    book.at = Date.now();
    applyPack(next);
  }, [applyPack]);

  const saveData = useCallback(() => {
    const pack = cloneData(liveRef.current);
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(pack));
      localStorage.setItem('bcl.ui', JSON.stringify(pack.ui || {}));
    } catch {
      /* ignore */
    }
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1400);
  }, []);

  const track = useCallback(
    (setter) => (next) => {
      remember();
      setter(next);
    },
    [remember]
  );

  useEffect(() => {
    const onKey = (event) => {
      const tag = document.activeElement?.tagName;
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
      if (!(event.ctrlKey || event.metaKey) || typing) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoData();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redoData();
      } else if (key === 's') {
        event.preventDefault();
        saveData();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undoData, redoData, saveData]);

  if (!bootMark.current) {
    bootMark.current = true;
    try {
      sessionStorage.setItem('bcl.bootNow', '1');
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    document.title =
      locale === 'vi'
        ? 'Hệ thống Năng lực Vận hành Cầu bến'
        : 'Berth Operations Capacity System';
  }, [locale]);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    setUi(withHorizon(ui, 'week'));
    if (location.pathname !== '/window') navigate('/window', { replace: true });
    const hour = window.setTimeout(() => {
      if (dataDirty.current) return;
      try {
        sessionStorage.setItem('bcl.bootNow', '1');
      } catch {
        /* ignore */
      }
      setUiState((prev) => {
        const next = withHorizon(prev, 'week');
        try {
          localStorage.setItem('bcl.ui', JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      if (window.location.pathname !== '/window') navigate('/window');
      window.dispatchEvent(new Event('bcl-focus-now'));
    }, 60 * 60 * 1000);
    return () => window.clearTimeout(hour);
    // Open once: week view on BERTH PLAN. Do not depend on later route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const snap = JSON.stringify({
      terminal,
      metrics,
      services,
      equipment,
      cranes,
      lockZones,
      secondaryBerth,
      externalBerths,
    });
    if (dataSkips.current > 0) {
      dataSkips.current -= 1;
      dataBaseline.current = snap;
      return;
    }
    if (snap !== dataBaseline.current) dataDirty.current = true;
  }, [terminal, metrics, services, equipment, cranes, lockZones, secondaryBerth, externalBerths]);

  useEffect(() => {
    const n = cranes.length;
    const avgMph =
      n > 0 ? Math.round(cranes.reduce((s, c) => s + (Number(c.mph) || 0), 0) / n) : 25;
    setTerminal((term) => (term.stsCount === n ? term : { ...term, stsCount: n }));
    setEquipment((eq) => {
      const fleet = eq.fleet.map((f) =>
        f.type === 'STS' ? { ...f, count: n, cmph: avgMph || f.cmph } : f
      );
      const same = fleet.every(
        (f, i) => f.count === eq.fleet[i].count && f.cmph === eq.fleet[i].cmph
      );
      return same ? eq : { ...eq, fleet };
    });
  }, [cranes]);

  const moveMainCrane = useCallback((id, positionM) => {
    remember();
    setCranes((list) =>
      list.map((c) =>
        c.id === id
          ? { ...c, positionM: clampCraneDragPosition(id, positionM, list, terminal.quayLength) }
          : c
      )
    );
  }, [remember, terminal.quayLength]);

  const moveSecondaryCrane = useCallback((id, positionM) => {
    remember();
    setSecondaryBerth((sb) => ({
      ...sb,
      cranes: sb.cranes.map((c) =>
        c.id === id
          ? {
              ...c,
              positionM: clampCraneDragPosition(id, positionM, sb.cranes, sb.quayLength),
            }
          : c
      ),
    }));
  }, [remember]);

  const model = useMemo(
    () => ({
      terminal,
      metrics,
      services,
      equipment,
      cranes,
      lockZones,
      secondaryBerth,
      externalBerths,
      ui,
      setTerminal: track(setTerminal),
      setMetrics: track(setMetrics),
      setServices: track(setServices),
      setServiceLineColor: (code, color) => {
        remember();
        setServiceLineColor(code, color);
      },
      setEquipment: track(setEquipment),
      setCranes: track(setCranes),
      setLockZones: track(setLockZones),
      setSecondaryBerth: track(setSecondaryBerth),
      setExternalBerths: track(setExternalBerths),
      moveMainCrane,
      moveSecondaryCrane,
      setUi: track(setUi),
      stsCranes: cranes,
      setStsCranes: track(setCranes),
    }),
    [
      terminal,
      metrics,
      services,
      equipment,
      cranes,
      lockZones,
      secondaryBerth,
      externalBerths,
      ui,
      setUi,
      setServiceLineColor,
      moveMainCrane,
      moveSecondaryCrane,
      remember,
      track,
    ]
  );

  /** Ops-first navigation: overview → plan → capacity worksheet → secondary → system hub */
  const nav = [
    { to: '/', label: t('nav.dashboard'), tip: t('tip.navDashboard'), match: (p) => p === '/' || p === '/dashboard' },
    { to: '/window', label: t('nav.window'), tip: t('tip.navWindow'), match: (p) => p === '/window' },
    { to: '/capacity', label: t('nav.capacity'), tip: t('tip.navCapacity'), match: (p) => p === '/capacity' },
    { to: '/secondary', label: t('nav.secondary'), tip: t('tip.navSecondary'), match: (p) => p === '/secondary' },
    { to: '/guide', label: t('nav.guide'), tip: t('tip.navGuide'), match: (p) => p === '/guide' },
    {
      to: '/settings',
      label: t('nav.settings'),
      tip: t('tip.navSettings'),
      match: (p) => p === '/settings' || p === '/benchmarks',
    },
  ];

  const path = location.pathname;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-row">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <PortLogo />
          </div>
          <div className="brand-text">
            <div className="brand-name">{t('brand')}</div>
            <div className="brand-sub">{terminal.name}</div>
          </div>
        </div>
        <div className="app-nav-stack">
          <nav className="app-nav" aria-label={t('nav.aria')}>
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-link ${item.match(path) ? 'active' : ''}`}
                data-tip={item.tip}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div id="page-fnbar" className="page-fnbar" />
          <TabBranch path={path} />
        </div>
        <div className="header-side">
          <div className="header-side-top">
            <div className="history-switch" role="group" aria-label={t('history.save')}>
              <button type="button" className="excel-btn excel-icon" data-tip={t('history.undo')} onClick={undoData} aria-label={t('history.undo')}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8.5 5.5 3 11l5.5 5.5 1.4-1.4L6.8 12H15a5 5 0 1 1 0 10H8v-2h7a3 3 0 0 0 0-6H6.8l3.1 3.1-1.4 1.4L3 13z" transform="translate(0 -1)" /></svg>
              </button>
              <button type="button" className="excel-btn excel-icon" data-tip={t('history.redo')} onClick={redoData} aria-label={t('history.redo')}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M15.5 5.5 21 11l-5.5 5.5-1.4-1.4 3.1-3.1H9a5 5 0 1 0 0 10h7v-2H9a3 3 0 0 1 0-6h8.2l-3.1 3.1 1.4 1.4L21 13z" transform="translate(0 -1)" /></svg>
              </button>
              <button type="button" className={`excel-btn excel-icon ${savedFlash ? 'is-saved' : ''}`} data-tip={savedFlash ? t('history.saved') : t('history.save')} onClick={saveData} aria-label={t('history.save')}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 2v4H8V5h5Zm-5 8h8a1 1 0 0 1 1 1v6H7v-6a1 1 0 0 1 1-1Z" /></svg>
              </button>
            </div>
            <ParameterExcel model={model} />
            <div className="lang-switch" title={t('lang.toggle')}>
              <button
                type="button"
                className={`lang-btn lang-vi ${locale === 'vi' ? 'active' : ''}`}
                data-tip={t('tip.langVi')}
                onClick={() => setLocale('vi')}
              >
                <FlagVietnam />
                VI
              </button>
              <button
                type="button"
                className={`lang-btn lang-en ${locale === 'en' ? 'active' : ''}`}
                data-tip={t('tip.langEn')}
                onClick={() => setLocale('en')}
              >
                <FlagUnitedKingdom />
                EN
              </button>
            </div>
          </div>
          <select
            className="horizon-select"
            aria-label={t('timeScale.label')}
            value={ui?.horizon || ui?.timeScale || 'week'}
            onChange={(event) => {
              remember();
              setUi(withHorizon(ui, event.target.value));
            }}
          >
            {HORIZONS.map((id) => (
              <option key={id} value={id}>
                {t(`horizon.${id}`)}
              </option>
            ))}
          </select>
        </div>
        </div>
      </header>
      <ButtonHints />
      <main className="app-main">
        {(path === '/' || path === '/dashboard') && <Dashboard model={model} />}
        {path === '/window' && <BerthingWindow model={model} />}
        {path === '/capacity' && <CapacityBoard model={model} />}
        {path === '/secondary' && <SecondaryBerth model={model} />}
        {path === '/guide' && <Guide model={model} />}
        {(path === '/settings' || path === '/benchmarks') && <Settings model={model} />}
      </main>
    </div>
  );
}
