import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EVIDENCE_TYPES, STAGES, STAGE_LABELS } from '../domain/types';
import type { EvidenceType, Stage } from '../domain/types';
import { useDB } from '../hooks/useDB';
import { visitService } from '../services/visitService';
import { StageBadge } from '../components/StageBadge';
import { SyncBadge } from '../components/SyncBadge';
import { fireToast } from '../components/Toast';

export function VisitDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDB();

  const visit = db.visits.find((v) => v.id === id);
  const outlet = visit ? db.outlets.find((o) => o.id === visit.outletId) : undefined;
  const evidence = db.evidence.filter((e) => e.visitId === id);
  const history = outlet
    ? db.stageHistory
        .filter((h) => h.outletId === outlet.id)
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    : [];

  const [result, setResult] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [changeStage, setChangeStage] = useState(false);
  const [newStage, setNewStage] = useState<Stage>(visit?.targetStage ?? 'SQL');
  const [evType, setEvType] = useState<EvidenceType>('photo');
  const [evName, setEvName] = useState('');
  const [evError, setEvError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingEvidence, setAddingEvidence] = useState(false);

  if (!visit || !outlet)
    return (
      <section>
        <header className="page-header">
          <h1>Visit not found</h1>
        </header>
        <div className="empty-state">
          <p>No visit with ID "{id}" exists.</p>
          <Link className="btn btn-primary" to="/schedule">Back to Schedule</Link>
        </div>
      </section>
    );

  const readOnly = visit.status === 'completed';
  const hasEvidence = evidence.length > 0;

  async function addEvidence() {
    if (!evName.trim()) return;
    setEvError('');
    setAddingEvidence(true);
    try {
      await visitService.addEvidence(visit!.id, { type: evType, name: evName.trim() });
      fireToast('Evidence added');
      setEvName('');
    } catch {
      setEvError('Failed to add evidence');
    }
    setAddingEvidence(false);
  }

  async function save() {
    setError('');
    setSaving(true);
    try {
      await visitService.complete({
        visitId: visit!.id,
        result,
        resultNotes: resultNotes || undefined,
        newStage: changeStage ? newStage : null,
      });
      fireToast('Visit completed');
      navigate('/schedule');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        message === 'EVIDENCE_REQUIRED'
          ? 'Stage change blocked: attach at least one piece of evidence first (BR3).'
          : message === 'RESULT_REQUIRED'
            ? 'Result is required to complete a visit.'
            : message,
      );
      setSaving(false);
    }
  }

  return (
    <section>
      <header className="page-header">
        <h1>Visit — {outlet.name}</h1>
        <SyncBadge visit={visit} />
      </header>

      <div className="card">
        <p><strong>{visit.visitDate}</strong> · {visit.salesRep} · {outlet.address}</p>
        <p>
          Stage at planning: <StageBadge stage={visit.currentStageSnapshot} />{' '}
          → target: <StageBadge stage={visit.targetStage} />{' '}
          · outlet now: <StageBadge stage={outlet.currentStage} />
        </p>
        <p className="muted">Objective: {visit.objective}</p>
      </div>

      <div className="card">
        <h2>Evidence ({evidence.length})</h2>
        {evidence.length === 0 && <p className="muted">No evidence yet.</p>}
        <ul>
          {evidence.map((e) => <li key={e.id}>[{e.type}] {e.name}</li>)}
        </ul>
        {!readOnly && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="ev-type">Type</label>
              <select id="ev-type" value={evType} onChange={(e) => setEvType(e.target.value as EvidenceType)}>
                {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="ev-name">Filename or note</label>
                <input
                  id="ev-name"
                  placeholder="filename or note text (mock)"
                  value={evName}
                  onChange={(e) => setEvName(e.target.value)}
                  aria-invalid={!!evError}
                  aria-describedby={evError ? 'ev-error' : undefined}
                />
                {evError && <span className="error-text" id="ev-error" role="alert">{evError}</span>}
              </div>
              <button type="button" className="btn" onClick={addEvidence} disabled={addingEvidence} aria-busy={addingEvidence}>
                {addingEvidence ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </div>

      {readOnly ? (
        <div className="card">
          <h2>Result</h2>
          <p>{visit.result}</p>
          {visit.resultNotes && <p className="muted">{visit.resultNotes}</p>}
          <p className="muted">This visit is completed and read-only.</p>
        </div>
      ) : (
        <div className="card">
          <h2>Complete visit</h2>
          <div className="field">
            <label htmlFor="visit-result">Result *</label>
            <input id="visit-result" value={result} onChange={(e) => setResult(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="visit-result-notes">Notes</label>
            <textarea id="visit-result-notes" rows={2} value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} />
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={changeStage}
              disabled={!hasEvidence}
              onChange={(e) => setChangeStage(e.target.checked)}
            />
            Change outlet stage
          </label>
          {!hasEvidence && (
            <p className="muted">Add at least one piece of evidence to unlock stage change (BR3).</p>
          )}
          {changeStage && (
            <div className="field-group--conditional">
              <div className="field">
                <label htmlFor="visit-new-stage">New stage (defaults to target)</label>
                <select id="visit-new-stage" value={newStage} onChange={(e) => setNewStage(e.target.value as Stage)}>
                  {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" style={{ marginTop: 12 }} type="button" onClick={save} disabled={saving} aria-busy={saving}>
            {saving ? 'Completing…' : 'Complete visit'}
          </button>
        </div>
      )}

      <div className="card">
        <h2>Stage history — {outlet.name}</h2>
        {history.length === 0 && <p className="muted">No transitions yet.</p>}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>When</th><th>From</th><th>To</th><th>By</th><th>Visit</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.changedAt).toLocaleString()}</td>
                  <td><StageBadge stage={h.fromStage} /></td>
                  <td><StageBadge stage={h.toStage} /></td>
                  <td>{h.changedBy}</td>
                  <td className="muted">{h.visitId.slice(0, 8)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}