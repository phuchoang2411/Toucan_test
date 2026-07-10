import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CHANNELS, SALES_REPS, STAGES, STAGE_LABELS, TIERS } from '../domain/types';
import { localISODate } from '../domain/dates';
import type { Channel, Stage, Tier } from '../domain/types';
import { StageBadge } from '../components/StageBadge';
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
          <h1>Outlet not found</h1>
        </header>
        <div className="empty-state">
          <p>No outlet with ID "{id}" exists.</p>
          <Link className="btn btn-primary" to="/outlets">Back to Outlets</Link>
        </div>
      </section>
    );

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const today = localISODate();
  const warnings: string[] = [];
  if (schedule && visitDate && visitDate < today)
    warnings.push('Visit date is in the past — allowed for after-the-fact logging, but double-check it.');
  if (schedule && targetStage === form.currentStage)
    warnings.push('Target stage equals the current stage — this visit plans no progression.');
  if (schedule && existingPlan && visitDate && visitDate !== existingPlan.visitDate)
    warnings.push(`This reschedules the planned visit from ${existingPlan.visitDate} to ${visitDate}.`);
  if (schedule && existingPlans.length > 1)
    warnings.push(
      `This outlet has ${existingPlans.length} planned visits (${existingPlans.map((p) => p.visitDate).join(', ')}). This form edits the earliest one (${existingPlan.visitDate}); the others are untouched.`,
    );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.address.trim()) errs.address = 'Address is required';
    if (schedule && !visitDate) errs.visitDate = 'Visit date is required';
    if (schedule && !objective.trim()) errs.objective = 'Visit objective is required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      await outletService.save(
        { id: editing?.id, ...form, notes: form.notes || undefined },
        schedule ? { visitDate, targetStage, objective, existingVisitId: existingPlan?.id } : null,
      );
      fireToast(editing ? 'Outlet updated' : 'Outlet created');
      navigate(schedule ? '/schedule' : '/outlets');
    } catch (e) {
      setSaving(false);
      const code = e instanceof Error ? e.message : String(e);
      fireToast(
        code === 'DATE_ALREADY_PLANNED'
          ? 'This outlet already has a different planned visit on that date — pick another date.'
          : code === 'OUTLET_NOT_FOUND'
            ? 'This outlet no longer exists — it may have been deleted elsewhere.'
            : code === 'FORBIDDEN' || code === 'FORBIDDEN_REASSIGN'
              ? 'You are not authorized to make this change.'
              : 'Failed to save outlet',
        'error',
      );
    }
  }

  return (
    <section>
      <header className="page-header">
        <h1>{editing ? `Edit — ${editing.name}` : 'New outlet'}</h1>
      </header>
      <form onSubmit={onSubmit} noValidate ref={formRef}>
        <div className="card">
          <div className="field" data-field="name">
            <label htmlFor="outlet-name">Name *</label>
            <input id="outlet-name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'outlet-name-error' : undefined} />
            {errors.name && <span className="error-text" id="outlet-name-error" role="alert">{errors.name}</span>}
          </div>
          <div className="field" data-field="address">
            <label htmlFor="outlet-address">Address *</label>
            <input id="outlet-address" value={form.address} onChange={set('address')} aria-invalid={!!errors.address} aria-describedby={errors.address ? 'outlet-address-error' : undefined} />
            {errors.address && <span className="error-text" id="outlet-address-error" role="alert">{errors.address}</span>}
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="outlet-channel">Channel *</label>
              <select id="outlet-channel" value={form.channel} onChange={set('channel')}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="outlet-tier">Tier *</label>
              <select id="outlet-tier" value={form.tier} onChange={set('tier')}>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="outlet-sales-rep">Sales rep *</label>
              {isManager ? (
                <select id="outlet-sales-rep" value={form.salesRep} onChange={set('salesRep')}>
                  {SALES_REPS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <>
                  <input id="outlet-sales-rep" value={form.salesRep} disabled readOnly />
                  <span className="muted">Only a manager can reassign an outlet to another rep</span>
                </>
              )}
            </div>
            <div className="field">
              <label htmlFor="outlet-current-stage">Current stage</label>
              {editing ? (
                <>
                  <StageBadge stage={editing.currentStage} />
                  <span className="muted">Change stage by completing a visit</span>
                </>
              ) : (
                <select id="outlet-current-stage" value={form.currentStage} onChange={set('currentStage')}>
                  {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="field">
            <label htmlFor="outlet-notes">Notes / next step</label>
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
                  <label htmlFor="visit-date">Visit date *</label>
                  <input id="visit-date" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} aria-invalid={!!errors.visitDate} aria-describedby={errors.visitDate ? 'visit-date-error' : undefined} />
                  {errors.visitDate && <span className="error-text" id="visit-date-error" role="alert">{errors.visitDate}</span>}
                </div>
                <div className="field">
                  <label htmlFor="target-stage">Target stage *</label>
                  <select id="target-stage" value={targetStage} onChange={(e) => setTargetStage(e.target.value as Stage)}>
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="field" data-field="objective">
                <label htmlFor="visit-objective">Visit objective *</label>
                <input id="visit-objective" value={objective} onChange={(e) => setObjective(e.target.value)} aria-invalid={!!errors.objective} aria-describedby={errors.objective ? 'visit-objective-error' : undefined} />
                {errors.objective && <span className="error-text" id="visit-objective-error" role="alert">{errors.objective}</span>}
              </div>
            </div>
          )}
          {!schedule && existingPlan && (
            <p className="warning-text">Saving with this unchecked cancels {existingPlans.length > 1 ? `${existingPlans.length} planned visits on ` : 'the planned visit on '}{existingPlans.map((p) => p.visitDate).join(', ')}. Completed and already-cancelled visits are kept as records.</p>
          )}
          {warnings.map((w) => <p key={w} className="warning-text">⚠ {w}</p>)}
        </div>

        <button className="btn btn-primary" type="submit" aria-busy={saving} disabled={saving}>
          {saving ? 'Saving…' : 'Save outlet'}
        </button>
      </form>
    </section>
  );
}