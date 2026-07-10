import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { STAGES } from '../domain/types';
import type { Stage } from '../domain/types';
import { getScheduleWarnings, type ScheduleWarning } from '../domain/visits';
import { localISODate } from '../domain/dates';
import { t, labelFor, STAGE_LABELS } from '../strings';
import { useScopedDB } from '../hooks/useScopedDB';
import { visitService } from '../services/visitService';
import { fireToast } from './Toast';
import styles from './ScheduleDialog.module.css';

/** Shared with OutletFormPage's inline scheduler so both entry points render
 *  getScheduleWarnings() the same way. */
export function warningText(w: ScheduleWarning): string {
  switch (w.type) {
    case 'pastDate': return t('visit_date_past_warning');
    case 'noProgression': return t('target_stage_no_progression');
    case 'reschedule': return t('reschedule_planned_visit', { from: w.from, to: w.to });
    case 'multiplePlanned': return t('multiple_planned_visits', { count: w.count, dates: w.dates, date: w.date });
  }
}

/** Lets a rep/manager create a schedule directly from the Working Schedule tab,
 *  instead of only through the outlet form. Reuses the same upsert rule (BR1/A1) —
 *  the visit's sales rep is always the selected outlet's rep, not a separate pick. */
export function ScheduleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useScopedDB();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const outlets = useMemo(() => [...db.outlets].sort((a, b) => a.name.localeCompare(b.name)), [db.outlets]);

  const [outletId, setOutletId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [targetStage, setTargetStage] = useState<Stage>('SQL');
  const [objective, setObjective] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  function reset() {
    setOutletId('');
    setVisitDate('');
    setTargetStage('SQL');
    setObjective('');
    setErrors({});
    setSaving(false);
  }

  function handleDialogClose() {
    reset();
    onClose();
  }

  const outlet = outlets.find((o) => o.id === outletId);
  const existingPlans = useMemo(
    () =>
      outlet
        ? db.visits
            .filter((v) => v.outletId === outlet.id && v.status === 'planned')
            .sort((a, b) => a.visitDate.localeCompare(b.visitDate))
        : [],
    [db.visits, outlet],
  );

  const today = localISODate();
  const warnings = outlet
    ? getScheduleWarnings({ visitDate, targetStage, currentStage: outlet.currentStage, today, existingPlans })
    : [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!outlet) errs.outletId = t('outlet_required');
    if (!visitDate) errs.visitDate = t('visit_date_required');
    if (!objective.trim()) errs.objective = t('objective_required');
    setErrors(errs);
    if (Object.keys(errs).length > 0 || !outlet) return;

    setSaving(true);
    try {
      await visitService.upsertPlanned({
        outletId: outlet.id,
        salesRep: outlet.salesRep,
        visitDate,
        targetStage,
        objective: objective.trim(),
      });
      fireToast(t('schedule_saved'));
      dialogRef.current?.close(); // triggers handleDialogClose: reset + onClose
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      fireToast(
        code === 'DATE_ALREADY_PLANNED'
          ? t('date_already_planned')
          : code === 'OUTLET_NOT_FOUND'
            ? t('outlet_no_longer_exists')
            : code === 'FORBIDDEN' || code === 'FORBIDDEN_REASSIGN'
              ? t('not_authorized_change')
              : t('failed_to_save_schedule'),
        'error',
      );
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={handleDialogClose}>
      <div className={styles.header}>
        <h2>{t('add_schedule_title')}</h2>
        <button type="button" className={styles.closeBtn} aria-label={t('close_dialog_aria')} onClick={() => dialogRef.current?.close()}>×</button>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <div className="field" data-field="outletId">
          <label htmlFor="schedule-outlet">{t('outlet_select_label')}</label>
          <select
            id="schedule-outlet"
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            aria-invalid={!!errors.outletId}
          >
            <option value="">{t('select_outlet_placeholder')}</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {errors.outletId && <span className="error-text" role="alert">{errors.outletId}</span>}
        </div>
        {outlet && (
          <div className="field">
            <label htmlFor="schedule-rep">{t('sales_rep_label')}</label>
            <input id="schedule-rep" value={outlet.salesRep} disabled readOnly />
          </div>
        )}
        <div className="field-row">
          <div className="field" data-field="visitDate">
            <label htmlFor="schedule-date">{t('visit_date_label')}</label>
            <input
              id="schedule-date"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              aria-invalid={!!errors.visitDate}
            />
            {errors.visitDate && <span className="error-text" role="alert">{errors.visitDate}</span>}
          </div>
          <div className="field">
            <label htmlFor="schedule-target-stage">{t('target_stage_label')}</label>
            <select id="schedule-target-stage" value={targetStage} onChange={(e) => setTargetStage(e.target.value as Stage)}>
              {STAGES.map((s) => <option key={s} value={s}>{labelFor(STAGE_LABELS, s)}</option>)}
            </select>
          </div>
        </div>
        <div className="field" data-field="objective">
          <label htmlFor="schedule-objective">{t('visit_objective_label')}</label>
          <input
            id="schedule-objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            aria-invalid={!!errors.objective}
          />
          {errors.objective && <span className="error-text" role="alert">{errors.objective}</span>}
        </div>
        {warnings.map((w, i) => <p key={i} className="warning-text">⚠ {warningText(w)}</p>)}
        <div className={styles.actions}>
          <button className="btn btn-primary" type="submit" aria-busy={saving} disabled={saving}>
            {saving ? t('saving') : t('save_schedule')}
          </button>
          <button className="btn" type="button" onClick={() => dialogRef.current?.close()}>{t('cancel_dismiss')}</button>
        </div>
      </form>
    </dialog>
  );
}
