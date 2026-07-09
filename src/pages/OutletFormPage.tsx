import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CHANNELS, SALES_REPS, STAGES, STAGE_LABELS, TIERS } from '../domain/types';
import type { Channel, Stage, Tier } from '../domain/types';
import { useDB } from '../hooks/useDB';
import { outletService } from '../services/outletService';

export function OutletFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDB();
  const editing = db.outlets.find((o) => o.id === id);

  const existingPlan = useMemo(
    () =>
      db.visits
        .filter((v) => v.outletId === id && v.status === 'planned')
        .sort((a, b) => a.visitDate.localeCompare(b.visitDate))[0],
    [db.visits, id],
  );

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

  if (id && !editing) return <p>Outlet not found.</p>;

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const today = new Date().toISOString().slice(0, 10);
  const warnings: string[] = [];
  if (schedule && visitDate && visitDate < today)
    warnings.push('Visit date is in the past — allowed for after-the-fact logging, but double-check it.');
  if (schedule && targetStage === form.currentStage)
    warnings.push('Target stage equals the current stage — this visit plans no progression.');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.address.trim()) errs.address = 'Address is required';
    if (schedule && !visitDate) errs.visitDate = 'Visit date is required';
    if (schedule && !objective.trim()) errs.objective = 'Visit objective is required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    await outletService.save(
      { id: editing?.id, ...form, notes: form.notes || undefined },
      schedule ? { visitDate, targetStage, objective } : null,
    );
    navigate(schedule ? '/schedule' : '/outlets');
  }

  return (
    <section>
      <header className="page-header">
        <h1>{editing ? `Edit — ${editing.name}` : 'New outlet'}</h1>
      </header>
      <form onSubmit={onSubmit} noValidate>
        <div className="card">
          <div className="field">
            <label>Name *</label>
            <input value={form.name} onChange={set('name')} />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>
          <div className="field">
            <label>Address *</label>
            <input value={form.address} onChange={set('address')} />
            {errors.address && <span className="error-text">{errors.address}</span>}
          </div>
          <div className="field-row">
            <div className="field">
              <label>Channel *</label>
              <select value={form.channel} onChange={set('channel')}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Tier *</label>
              <select value={form.tier} onChange={set('tier')}>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Sales rep *</label>
              <select value={form.salesRep} onChange={set('salesRep')}>
                {SALES_REPS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Current stage *</label>
              <select value={form.currentStage} onChange={set('currentStage')}>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Notes / next step</label>
            <textarea rows={2} value={form.notes} onChange={set('notes')} />
          </div>
        </div>

        <div className="card">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
            <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
            Schedule a visit (đi tuyến)
          </label>
          {schedule && (
            <div style={{ marginTop: 12 }}>
              <div className="field-row">
                <div className="field">
                  <label>Visit date *</label>
                  <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                  {errors.visitDate && <span className="error-text">{errors.visitDate}</span>}
                </div>
                <div className="field">
                  <label>Target stage *</label>
                  <select value={targetStage} onChange={(e) => setTargetStage(e.target.value as Stage)}>
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Visit objective *</label>
                <input value={objective} onChange={(e) => setObjective(e.target.value)} />
                {errors.objective && <span className="error-text">{errors.objective}</span>}
              </div>
            </div>
          )}
          {!schedule && existingPlan && (
            <p className="warning-text">Saving with this unchecked cancels the planned visit on {existingPlan.visitDate}. Completed visits are kept.</p>
          )}
          {warnings.map((w) => <p key={w} className="warning-text">⚠ {w}</p>)}
        </div>

        <button className="btn btn-primary" type="submit">Save outlet</button>
      </form>
    </section>
  );
}