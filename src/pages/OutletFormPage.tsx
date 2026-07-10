import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CHANNELS, SALES_REPS, STAGES, STAGE_LABELS, TIERS } from '../domain/types';
import { localISODate } from '../domain/dates';
import type { Channel, Stage, Tier } from '../domain/types';
import { StageBadge } from '../components/StageBadge';
import { t } from '../strings';
import { useDB } from '../hooks/useDB';
import { useSession } from '../hooks/useSession';
import { canAccess } from '../domain/authz';
import { outletService } from '../services/outletService';
import { fireToast } from '../components/Toast';

export function OutletFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDB();
  const user = useSession();
  const isManager = user.role === 'manager';
  const found = db.outlets.find((o) => o.id === id);
  // Treat another rep's outlet the same as "not found" — no existence disclosure (A9 rework).
  const editing = found && canAccess(user, found) ? found : undefined;
  const formRef = useRef<HTMLFormElement>(null);

  const existingPlans = useMemo(
    () =>
      db.visits
        .filter((v) => v.outletId === id && v.status === 'planned')
        .sort((a, b) => a.visitDate.localeCompare(b.visitDate)),
    [db.visits, id],
  );
  const existingPlan = existingPlans[0];

  const [form, setForm] = useState({
    name: editing?.name ?? '',
    address: editing?.address ?? '',
    channel: (editing?.channel ?? 'Cafe') as Channel,
    tier: (editing?.tier ?? 'B') as Tier,
    salesRep: editing?.salesRep ?? (isManager ? (SALES_REPS[0] as string) : user.name),
    currentStage: (editing?.currentStage ?? 'RawLead') as Stage,
    notes: editing?.notes ?? '',
  });
  const [schedule, setSchedule] = useState(Boolean(existingPlan));
  const [visitDate, setVisitDate] = useState(existingPlan?.visitDate ?? '');
  const [targetStage, setTargetStage] = useState<Stage>(existingPlan?.targetStage ?? 'SQL');
  const [objective, setObjective] = useState(existingPlan?.objective ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const keys = Object.keys(errors);
    if (keys.length > 0) {
      const first = keys[0];
      const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] select, [data-field="${first}"] textarea`);
      el?.focus();
    }
  }, [errors]);

  if (id && !editing)
    return (
      <section>
        <header className="page-header">
          <h1>{t('outlet_not_found')}</h1>
        </header>
        <div className="empty-state">
          <p>{t('no_outlet_with_id', { id })}</p>
          <Link className="btn btn-primary" to="/outlets">{t('back_to_outlets')}</Link>
        </div>
      </section>
    );

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const today = localISODate();
  const warnings: string[] = [];
  if (schedule && visitDate && visitDate < today)
    warnings.push(t('visit_date_past_warning'));
  if (schedule && targetStage === form.currentStage)
    warnings.push(t('target_stage_no_progression'));
  if (schedule && existingPlan && visitDate && visitDate !== existingPlan.visitDate)
    warnings.push(t('reschedule_planned_visit', { from: existingPlan.visitDate, to: visitDate }));
  if (schedule && existingPlans.length > 1)
    warnings.push(t('multiple_planned_visits', { count: existingPlans.length, dates: existingPlans.map((p) => p.visitDate).join(', '), date: existingPlan.visitDate }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('name_required');
    if (!form.address.trim()) errs.address = t('address_required');
    if (schedule && !visitDate) errs.visitDate = t('visit_date_required');
    if (schedule && !objective.trim()) errs.objective = t('objective_required');
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      await outletService.save(
        { id: editing?.id, ...form, notes: form.notes || undefined },
        schedule ? { visitDate, targetStage, objective, existingVisitId: existingPlan?.id } : null,
      );
      fireToast(t(editing ? 'outlet_updated' : 'outlet_created'));
      navigate(schedule ? '/schedule' : '/outlets');
    } catch (e) {
      setSaving(false);
      const code = e instanceof Error ? e.message : String(e);
      fireToast(
        code === 'DATE_ALREADY_PLANNED'
          ? t('date_already_planned')
          : code === 'OUTLET_NOT_FOUND'
            ? t('outlet_no_longer_exists')
            : code === 'FORBIDDEN' || code === 'FORBIDDEN_REASSIGN'
              ? t('not_authorized_change')
              : t('failed_to_save_outlet'),
        'error',
      );
    }
  }

  return (
    <section>
      <header className="page-header">
        <h1>{editing ? t('edit_outlet_title', { name: editing.name }) : t('new_outlet_title')}</h1>
      </header>
      <form onSubmit={onSubmit} noValidate ref={formRef}>
        <div className="card">
          <div className="field" data-field="name">
            <label htmlFor="outlet-name">{t('name_label')}</label>
            <input id="outlet-name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'outlet-name-error' : undefined} />
            {errors.name && <span className="error-text" id="outlet-name-error" role="alert">{errors.name}</span>}
          </div>
          <div className="field" data-field="address">
            <label htmlFor="outlet-address">{t('address_label')}</label>
            <input id="outlet-address" value={form.address} onChange={set('address')} aria-invalid={!!errors.address} aria-describedby={errors.address ? 'outlet-address-error' : undefined} />
            {errors.address && <span className="error-text" id="outlet-address-error" role="alert">{errors.address}</span>}
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="outlet-channel">{t('channel_label')}</label>
              <select id="outlet-channel" value={form.channel} onChange={set('channel')}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="outlet-tier">{t('tier_label')}</label>
              <select id="outlet-tier" value={form.tier} onChange={set('tier')}>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="outlet-sales-rep">{t('sales_rep_label')}</label>
              {isManager ? (
                <select id="outlet-sales-rep" value={form.salesRep} onChange={set('salesRep')}>
                  {SALES_REPS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <>
                  <input id="outlet-sales-rep" value={form.salesRep} disabled readOnly />
                  <span className="muted">{t('manager_reassign_only')}</span>
                </>
              )}
            </div>
            <div className="field">
              <label htmlFor="outlet-current-stage">{t('current_stage_label')}</label>
              {editing ? (
                <>
                  <StageBadge stage={editing.currentStage} />
                  <span className="muted">{t('change_stage_via_visit')}</span>
                </>
              ) : (
                <select id="outlet-current-stage" value={form.currentStage} onChange={set('currentStage')}>
                  {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="field">
            <label htmlFor="outlet-notes">{t('notes_next_step')}</label>
            <textarea id="outlet-notes" rows={2} value={form.notes} onChange={set('notes')} />
          </div>
        </div>

        <div className="card">
          <label className="checkbox-row">
            <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
            Schedule a visit (<span lang="vi">đi tuyến</span>)
          </label>
          {schedule && (
            <div className="field-group--conditional">
              <div className="field-row">
                <div className="field" data-field="visitDate">
                  <label htmlFor="visit-date">{t('visit_date_label')}</label>
                  <input id="visit-date" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} aria-invalid={!!errors.visitDate} aria-describedby={errors.visitDate ? 'visit-date-error' : undefined} />
                  {errors.visitDate && <span className="error-text" id="visit-date-error" role="alert">{errors.visitDate}</span>}
                </div>
                <div className="field">
                  <label htmlFor="target-stage">{t('target_stage_label')}</label>
                  <select id="target-stage" value={targetStage} onChange={(e) => setTargetStage(e.target.value as Stage)}>
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="field" data-field="objective">
                <label htmlFor="visit-objective">{t('visit_objective_label')}</label>
                <input id="visit-objective" value={objective} onChange={(e) => setObjective(e.target.value)} aria-invalid={!!errors.objective} aria-describedby={errors.objective ? 'visit-objective-error' : undefined} />
                {errors.objective && <span className="error-text" id="visit-objective-error" role="alert">{errors.objective}</span>}
              </div>
            </div>
          )}
          {!schedule && existingPlan && (
            <p className="warning-text">
              {existingPlans.length > 1
                ? t('unschedule_warning', { count: existingPlans.length, dates: existingPlans.map((p) => p.visitDate).join(', ') })
                : t('unschedule_warning_single', { dates: existingPlan.visitDate })}
            </p>
          )}
          {warnings.map((w) => <p key={w} className="warning-text">⚠ {w}</p>)}
        </div>

        <button className="btn btn-primary" type="submit" aria-busy={saving} disabled={saving}>
          {saving ? t('saving') : t('save_outlet')}
        </button>
      </form>
    </section>
  );
}