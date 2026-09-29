import React, { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { calcBerthCapacity } from '../lib/capacity';
import { buildOperations } from '../lib/operations';
import PageToolbar from '../components/PageToolbar';
import { reportPeriodOf } from '../lib/uiSettings';

function fmt(n, d = 0) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
}

function pct(n) {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

const GROUPS = [
  { id: 'space', title: 'guide.spaceTitle', keys: ['occupation', 'portstay', 'maintenance'] },
  { id: 'productivity', title: 'guide.productivityTitle', keys: ['cmph', 'pmph'] },
  { id: 'market', title: 'guide.marketTitle', keys: ['barge', 'external'] },
  { id: 'performance', title: 'guide.performanceTitle', keys: ['bor'] },
];

const STEPS = ['s1', 's2', 's3', 's4'];

export default function Guide({ model }) {
  const { t } = useI18n();
  const { terminal, metrics, services, lockZones, externalBerths, ui } = model;
  const period = reportPeriodOf(ui?.horizon || ui?.timeScale || 'week');

  const view = useMemo(() => {
    const berth = calcBerthCapacity({ services, terminal, metrics, lockZones });
    const avgPmph =
      berth.services.length > 0
        ? berth.services.reduce((s, r) => s + (Number(r.pmph) || 0), 0) / berth.services.length
        : 0;
    const ops = buildOperations({
      services,
      terminal,
      metrics,
      lockZones,
      berth,
      externalBerths,
      period,
      avgPmph,
    });
    return { berth, ops };
  }, [services, terminal, metrics, lockZones, externalBerths, period]);

  const sample = view.ops.exampleOccupation;
  const berth = view.berth;
  const ops = view.ops;

  return (
    <div className="page-grid guide-page">
      <PageToolbar>
        {[
          ['guide-defs', 'guide.defTitle'],
          ['guide-logic', 'guide.logicTitle'],
          ['guide-live', 'guide.live'],
        ].map(([id, key]) => (
          <button
            key={id}
            type="button"
            className="chip"
            data-tip={t('tip.jump')}
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {t(key)}
          </button>
        ))}
      </PageToolbar>
      <section className="panel span-12">
        <h2>{t('guide.title')}</h2>
        <p className="hint">{t('guide.subtitle')}</p>
      </section>

      <section id="guide-defs" className="panel span-12">
        <h3>{t('guide.defTitle')}</h3>
        {GROUPS.map((group) => (
          <div key={group.id} className="guide-group">
            <h4>{t(group.title)}</h4>
            <div className="guide-terms">
              {group.keys.map((key) => (
                <article key={key} className="guide-term">
                  <h5>{t(`guide.terms.${key}.name`)}</h5>
                  <p className="guide-lead">{t(`guide.terms.${key}.lead`)}</p>
                  <p>{t(`guide.terms.${key}.body`)}</p>
                </article>
              ))}
            </div>
          </div>
        ))}
        {sample && (
          <div className="guide-formula">
            <strong>{t('guide.sample')}</strong>
            <p>
              {t('guide.formulaOccupation', {
                service: sample.service,
                loa: fmt(sample.loa, 0),
                moor: fmt(sample.mooring, 1),
                occ: fmt(sample.occupation, 1),
              })}
            </p>
            <p>
              {t('guide.formulaPmph', {
                service: sample.service,
                pmph: fmt(sample.pmph, 1),
                cmph: fmt(sample.cmph, 1),
                density: fmt(sample.craneDensity, 2),
              })}
            </p>
            <p>
              {t('guide.formulaBor', {
                bor: pct(berth.berthUtilization),
              })}
            </p>
          </div>
        )}
      </section>

      <section id="guide-logic" className="panel span-7">
        <h3>{t('guide.logicTitle')}</h3>
        <ol className="guide-steps">
          {STEPS.map((id, i) => (
            <li key={id}>
              <span>{i + 1}</span>
              <div>
                <strong>{t(`guide.steps.${id}.title`)}</strong>
                <p>{t(`guide.steps.${id}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="guide-live" className="panel span-5">
        <h3>{t('guide.live')}</h3>
        <div className="dash-metric-list">
          <div>
            <span>{t('guide.designMh')}</span>
            <strong>{fmt(ops.designWeek, 0)}</strong>
          </div>
          <div>
            <span>{t('guide.maintMh')}</span>
            <strong>{fmt(ops.maintenanceWeek, 0)}</strong>
          </div>
          <div>
            <span>{t('guide.cleanMh')}</span>
            <strong>{fmt(ops.availableWeek, 0)}</strong>
          </div>
          <div>
            <span>{t('guide.motherMh')}</span>
            <strong>{fmt(berth.mainlineMeterHours, 0)}</strong>
          </div>
          <div>
            <span>{t('guide.bargeWindows')}</span>
            <strong>{fmt(ops.bargeWindows.length, 0)}</strong>
          </div>
          <div>
            <span>{t('guide.fitCalls')}</span>
            <strong>{fmt(ops.bargeFit.callsPerWeek, 0)}</strong>
          </div>
          <div>
            <span>{t('guide.demandCalls')}</span>
            <strong>{fmt(berth.barge.callsPerWeek, 0)}</strong>
          </div>
          <div>
            <span>BOR</span>
            <strong>{pct(berth.berthUtilization)}</strong>
          </div>
        </div>
      </section>

      <section className="panel span-12">
        <h3>{t('guide.modulesTitle')}</h3>
        <ul className="guide-modules">
          <li>{t('guide.modules.plan')}</li>
          <li>{t('guide.modules.dash')}</li>
          <li>{t('guide.modules.external')}</li>
        </ul>
      </section>
    </div>
  );
}
