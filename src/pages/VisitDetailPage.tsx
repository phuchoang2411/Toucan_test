import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EVIDENCE_TYPES, STAGES, STAGE_LABELS } from '../domain/types';
import type { EvidenceType, Stage } from '../domain/types';
import { useDB } from '../hooks/useDB';
import { visitService } from '../services/visitService';
import { StageBadge } from '../components/StageBadge';
import { SyncBadge } from '../components/SyncBadge';

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
  const [error, setError] = useState('');

  if (!visit || !outlet) return <p>Visit not found.</p>;

  const readOnly = visit.status === 'completed';
  const hasEvidence = evidence.length > 0;

  async function addEvidence() {
    if (!evName.trim()) return;
    await visitService.addEvidence(visit!.id, { type: evType, name: evName.trim() });
    setEvName('');
  }

  async function save() {
    setError('');
    try {
      await visitService.complete({
        visitId: visit!.id,
        result,
        resultNotes: resultNotes || undefined,
        newStage: changeStage ? newStage : null,
      });
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
            <select value={evType} onChange={(e) => setEvType(e.target.value as EvidenceType)}>
              {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="filename or note text (mock)"
                value={evName}
                onChange={(e) => setEvName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn" onClick={addEvidence}>Add</button>
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
            <label>Result *</label>
            <input value={result} onChange={(e) => setResult(e.target.value)} />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea rows={2} value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} />
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
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
            <div className="field" style={{ marginTop: 8 }}>
              <label>New stage (defaults to target)</label>
              <select value={newStage} onChange={(e) => setNewStage(e.target.value as Stage)}>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" style={{ marginTop: 12 }} type="button" onClick={save}>
            Complete visit
          </button>
        </div>
      )}

      <div className="card">
        <h2>Stage history — {outlet.name}</h2>
        {history.length === 0 && <p className="muted">No transitions yet.</p>}
        <table className="table">
          <thead><tr><th>When</th><th>From</th><th>To</th><th>By</th><th>Visit</th></tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{new Date(h.changedAt).toLocaleString()}</td>
                <td><StageBadge stage={h.fromStage} /></td>
                <td><StageBadge stage={h.toStage} /></td>
                <td>{h.changedBy}</td>
                <td className="muted">{h.visitId.slice(0, 8)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}