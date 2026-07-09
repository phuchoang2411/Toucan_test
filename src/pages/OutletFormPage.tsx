import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CHANNELS, SALES_REPS, STAGES, STAGE_LABELS, TIERS } from '../domain/types';
import { localISODate } from '../domain/dates';
import type { Channel, Stage, Tier } from '../domain/types';
import { StageBadge } from '../components/StageBadge';
import { useDB } from '../hooks/useDB';
import { outletService } from '../services/outletService';
import { fireToast } from '../components/Toast';

export function OutletFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDB();
  const editing = db.outlets.find((o) => o.id === id);

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
    salesRep: editing?.salesRep ?? (SALES_REPS[0] as string),
    currentStage: (editing?.currentStage ?? 'RawLead') as Stage,
    notes: editing?.notes ?? '',
  });
  const [schedule, setSchedule] = useState(Boolean(existingPlan));
  const [visitDate, setVisitDate] = useState(existingPlan?.visitDate ?? '');
  const [targetStage, setTargetStage] = useState<Stage>(existingPlan?.targetStage ?? 'SQL');
  const [objective, setObjective] = useState(existingPlan?.objective ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (id && !editing) return <p>Outlet not found.</p>;

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const today = localISODate();
  const warnings: string[] = [];
  if (schedule && visitDate && visitDate < today)
    warnings.push('Visit date is in the past — allowed for after-the-fact logging, but double-check it.');
  if (schedule && targetStage === form.currentStage)
    warnings.push('Target stage equals the current stage — this visit plans no progression.');
  if (schedule && existingPlan && visitDate && visitDate !== existingPlan.visitDate)
    warnings.push(
      `Changing the date plans a separate visit on ${visitDate} — the existing plan on ${existingPlan.visitDate} stays in the schedule. To cancel old plans, uncheck "Schedule a visit" and save first.`,
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
        schedule ? { visitDate, targetStage, objective } : null,
      );
      fireToast(editing ? 'Outlet updated' : 'Outlet created');
      navigate(schedule ? '/schedule' : '/outlets');
    } catch {
      setSaving(false);
    }
  }

  return (
    <section>
      <header className="page-header">
        <h1>{editing ? `Edit — ${editing.name}` : 'New outlet'}</h1>
      </header>
      <form onSubmit={onSubmit} noValidate>
        <div className="card">
          <div className="field">
            <label htmlFor="outlet-name">Name *</label>
            <input id="outlet-name" value={form.name} onChange={set('name')} />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="outlet-address">Address *</label>
            <input id="outlet-address" value={form.address} onChange={set('address')} />
            {errors.address && <span className="error-text">{errors.address}</span>}
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
              <select id="outlet-sales-rep" value={form.salesRep} onChange={set('salesRep')}>
                {SALES_REPS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
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
            Schedule a visit (đi tuyến)
          </label>
          {schedule && (
            <div className="field-group--conditional">
              <div className="field-row">
                <div className="field">
                  <label htmlFor="visit-date">Visit date *</label>
                  <input id="visit-date" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                  {errors.visitDate && <span className="error-text">{errors.visitDate}</span>}
                </div>
                <div className="field">
                  <label htmlFor="target-stage">Target stage *</label>
                  <select id="target-stage" value={targetStage} onChange={(e) => setTargetStage(e.target.value as Stage)}>
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="visit-objective">Visit objective *</label>
                <input id="visit-objective" value={objective} onChange={(e) => setObjective(e.target.value)} />
                {errors.objective && <span className="error-text">{errors.objective}</span>}
              </div>
            </div>
          )}
          {!schedule && existingPlan && (
            <p className="warning-text">Saving with this unchecked cancels {existingPlans.length > 1 ? `${existingPlans.length} planned visits on ` : 'the planned visit on '}{existingPlans.map((p) => p.visitDate).join(', ')}. Completed visits are kept.</p>
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