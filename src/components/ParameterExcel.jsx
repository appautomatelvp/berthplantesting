import React, { useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import {
  applyParameterWorkbook,
  downloadParameterWorkbook,
  parseParameterWorkbook,
} from '../lib/parameterWorkbook';

/** Download the filled template, or replace every calculation input from an uploaded workbook. */
export default function ParameterExcel({ model, variant = 'header' }) {
  const { t, locale } = useI18n();
  const inputRef = useRef(null);
  const [report, setReport] = useState(null);

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const result = parseParameterWorkbook(buffer, locale);
      if (result.errors.length || !result.data) {
        setReport({ ok: false, errors: result.errors });
        return;
      }
      applyParameterWorkbook(model, result.data);
      setReport({ ok: true, summary: result.summary });
    } catch (err) {
      setReport({
        ok: false,
        errors: [{ sheet: '', row: 0, message: err?.message || String(err) }],
      });
    }
  };

  return (
    <>
      <div className={variant === 'panel' ? 'excel-panel-actions' : 'excel-tools'}>
        <button type="button" className="excel-btn excel-icon" aria-label={t('excel.download')} data-tip={t('tip.excelDown')} onClick={() => downloadParameterWorkbook(model, locale)}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.42L11 12.6V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
          </svg>
          {variant === 'header' ? null : <span>{t('excel.download')}</span>}
        </button>
        <button type="button" className="excel-btn excel-btn-upload excel-icon" aria-label={t('excel.upload')} data-tip={t('tip.excelUp')} onClick={() => inputRef.current?.click()}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M12 21a1 1 0 0 1-1-1v-8.59l-2.3 2.3a1 1 0 1 1-1.4-1.42l4-4a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1-1.4 1.42L13 11.4V20a1 1 0 0 1-1 1ZM5 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V4H7v1a1 1 0 1 1-2 0V3Z" />
          </svg>
          {variant === 'header' ? null : <span>{t('excel.upload')}</span>}
        </button>
        <input
          ref={inputRef}
          className="excel-file"
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onFile}
        />
      </div>
      {report ? (
        <div className="excel-overlay" role="presentation" onClick={() => setReport(null)}>
          <div
            className="excel-dialog panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="excel-report-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="excel-report-title">{report.ok ? t('excel.okTitle') : t('excel.failTitle')}</h2>
            {report.ok ? (
              <>
                <p>{t('excel.summary', report.summary)}</p>
                <p className="hint">{t('excel.stsNote')}</p>
              </>
            ) : (
              <>
                <p className="hint">{t('excel.failHint')}</p>
                <ul className="excel-errors">
                  {report.errors.map((error, index) => (
                    <li key={`${error.sheet}-${error.row}-${index}`}>
                      {error.sheet ? `${error.sheet}` : ''}
                      {error.row ? ` · ${error.row}` : ''}
                      {error.sheet || error.row ? ': ' : ''}
                      {error.message}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button type="button" className="excel-btn excel-btn-upload" onClick={() => setReport(null)}>
              {t('excel.close')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
