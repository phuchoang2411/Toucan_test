import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CANCEL_REASONS, EVIDENCE_TYPES, STAGES, STAGE_LABELS } from '../domain/types';
import type { CancelReason, EvidenceType, Stage } from '../domain/types';
import { useDB } from '../hooks/useDB';
import { useSession } from '../hooks/useSession';
import { canAccess } from '../domain/authz';
import { visitService } from '../services/visitService';
import { isOverdue } from '../domain/visits';
import { localISODate } from '../domain/dates';
import { StageBadge } from '../components/StageBadge';
import { SyncBadge } from '../components/SyncBadge';
import { fireToast } from '../components/Toast';

export function VisitDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDB();
  const user = useSession();

  const foundVisit = db.visits.find((v) => v.id === id);
  // Treat another rep's visit the same as "not found" — no existence disclosure (A9 rework).
  const visit = foundVisit && canAccess(user, foundVisit) ? foundVisit : undefined;
  const outlet = visit ? db.outlets.find((o) => o.id === visit.outletId) : undefined;
  const evidence = db.evidence.filter((e) => e.visitId === id);
  const history = outlet
    ? db.stageHistory
        .filter((h) => h.outletId === outlet.id)
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    : [];

  const [result, setResult] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [dateMismatchNote, setDateMismatchNote] = useState('');
  const [changeStage, setChangeStage] = useState(false);
  const [newStage, setNewStage] = useState<Stage>(visit?.targetStage ?? 'SQL');
  const [evType, setEvType] = useState<EvidenceType>('photo');
  const [evName, setEvName] = useState('');
  const [evError, setEvError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingEvidence, setAddingEvidence] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>(CANCEL_REASONS[0]);
  const [cancelNote, setCancelNote] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

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

  const readOnly = visit.status !== 'planned';
  const hasEvidence = evidence.length > 0;
  const completingOnDifferentDay = visit.visitDate !== localISODate();

  async function addEvidence() {
    if (!evName.trim()) return;
    setEvError('');
    setAddingEvidence(true);
    try {
      await visitService.addEvidence(visit!.id, { type: evType, name: evName.trim() });
      fireToast('Evidence added');
      setEvName('');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setEvError(message === 'FORBIDDEN' ? 'You are not authorized to add evidence to this visit.' : 'Failed to add evidence');
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
        dateMismatchNote: dateMismatchNote.trim() || undefined,
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
            : message === 'DATE_MISMATCH_NOTE_REQUIRED'
              ? 'This visit is being completed on a different day than scheduled — please explain why (BR7).'
              : message === 'FORBIDDEN'
                ? 'You are not authorized to complete this visit.'
                : message,
      );
      setSaving(false);
    }
  }

  async function handleReschedule() {
    if (!newDate.trim()) return;
    setRescheduleError('');
    setRescheduling(true);
    try {
      await visitService.reschedule({ visitId: visit!.id, newDate });
      fireToast(`Visit rescheduled to ${newDate}`);
      setShowReschedule(false);
      setNewDate('');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setRescheduleError(
        message === 'DATE_ALREADY_PLANNED'
          ? 'This outlet already has a planned visit on that date.'
          : message === 'FORBIDDEN'
            ? 'You are not authorized to reschedule this visit.'
            : message,
      );
    }
    setRescheduling(false);
  }

  async function handleCancel() {
    if (confirmCancel) {
      setCancelError('');
      setCancelling(true);
      try {
        await visitService.cancelVisit(visit!.id, cancelReason as CancelReason, cancelNote || undefined);
        fireToast('Visit cancelled');
        setShowCancel(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setCancelError(message === 'FORBIDDEN' ? 'You are not authorized to cancel this visit.' : message);
      }
      setCancelling(false);
    } else {
      setConfirmCancel(true);
    }
  }

  return (
    <section>
      <header className="page-header">
        <h1>Visit — {outlet.name}</h1>
        <span className={`badge badge--${visit.status}`}>{visit.status}</span>
        <SyncBadge visit={visit} />
      </header>

      <div className="card">
        <p><strong>{visit.visitDate}</strong>
          {isOverdue(visit.status, visit.visitDate, localISODate()) && (
            <span className="badge badge--overdue" style={{ marginLeft: 8 }}>overdue</span>
          )}
          {' · '}{visit.salesRep} · {outlet.address}</p>
        <p>
          Stage at planning: <StageBadge stage={visit.currentStageSnapshot} />{' '}
          → target: <StageBadge stage={visit.targetStage} />{' '}
          · outlet now: <StageBadge stage={outlet.currentStage} />
        </p>
        <p className="muted">Objective: {visit.objective}</p>
      </div>

      {!readOnly && (
        <div className="card">
          <h2>Actions</h2>
          <div className="field-row">
            {!showReschedule && !showCancel && (
              <>
                <button className="btn" type="button" onClick={() => { setShowReschedule(true); setShowCancel(false); }}>
                  Reschedule…
                </button>
                <button className="btn btn-danger" type="button" onClick={() => { setShowCancel(true); setShowReschedule(false); setConfirmCancel(false); }}>
                  Cancel visit…
                </button>
              </>
            )}
          </div>

          {showReschedule && (
            <div className="field-group--conditional" style={{ marginTop: 12 }}>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="reschedule-date">New date</label>
                  <input
                    id="reschedule-date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
              </div>
              {newDate && newDate < localISODate() && (
                <p className="warning-text">⚠ Date is in the past — allowed but please verify.</p>
              )}
              {rescheduleError && <p className="error-text" role="alert">{rescheduleError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary" type="button" onClick={handleReschedule} disabled={rescheduling || !newDate.trim()} aria-busy={rescheduling}>
                  {rescheduling ? 'Rescheduling…' : 'Confirm reschedule'}
                </button>
                <button className="btn" type="button" onClick={() => { setShowReschedule(false); setNewDate(''); setRescheduleError(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showCancel && (
            <div className="field-group--conditional" style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="cancel-reason">Reason *</label>
                <select
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => { setCancelReason(e.target.value); setConfirmCancel(false); }}
                >
                  {CANCEL_REASONS.filter((r) => r !== 'Unscheduled from outlet form').map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="cancel-note">Note (optional)</label>
                <textarea
                  id="cancel-note"
                  rows={2}
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder={cancelReason === 'Other' ? 'Describe why…' : 'Additional details (optional)'}
                />
              </div>
              {cancelError && <p className="error-text" role="alert">{cancelError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-danger" type="button" onClick={handleCancel} disabled={cancelling} aria-busy={cancelling}>
                  {cancelling ? 'Cancelling…' : confirmCancel ? 'Click again to confirm' : 'Cancel visit'}
                </button>
                <button className="btn" type="button" onClick={() => { setShowCancel(false); setCancelNote(''); setCancelError(''); setConfirmCancel(false); }}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
          <h2>{visit.status === 'cancelled' ? 'Cancelled' : 'Result'}</h2>
          {visit.status === 'cancelled' ? (
            <>
              <p className="muted">This visit was cancelled.</p>
              {visit.cancelReason && <p>Reason: <strong>{visit.cancelReason}</strong></p>}
              {visit.cancelNote && <p className="muted">Note: {visit.cancelNote}</p>}
              <p className="muted">Evidence is preserved.</p>
              <p className="muted">A cancellation was sent to MISA.</p>
            </>
          ) : (
            <>
              <p>{visit.result}</p>
              {visit.resultNotes && <p className="muted">{visit.resultNotes}</p>}
              {visit.dateMismatchNote && (
                <p className="warning-text">⚠ Completed on a different day than scheduled ({visit.visitDate}) — {visit.dateMismatchNote}</p>
              )}
              <p className="muted">This visit is completed and read-only.</p>
            </>
          )}
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
              {newStage === outlet.currentStage && (
                <p className="warning-text">⚠ This is the outlet's current stage — no transition or history entry will be recorded.</p>
              )}
            </div>
          )}
          {completingOnDifferentDay && (
            <div className="field">
              <p className="warning-text">⚠ This is being completed on a different day than scheduled ({visit.visitDate}) — why?</p>
              <label htmlFor="visit-date-mismatch-note">Reason *</label>
              <textarea
                id="visit-date-mismatch-note"
                rows={2}
                value={dateMismatchNote}
                onChange={(e) => setDateMismatchNote(e.target.value)}
              />
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
              {history.map((h) => {
                const sourceVisit = db.visits.find((v) => v.id === h.visitId);
                return (
                  <tr key={h.id}>
                    <td>{new Date(h.changedAt).toLocaleString()}</td>
                    <td><StageBadge stage={h.fromStage} /></td>
                    <td><StageBadge stage={h.toStage} /></td>
                    <td>{h.changedBy}</td>
                    <td>
                      {sourceVisit ? (
                        <>
                          <Link to={`/visits/${h.visitId}`}>{sourceVisit.visitDate}</Link>
                          {sourceVisit.dateMismatchNote && (
                            <span className="warning-text" title={sourceVisit.dateMismatchNote} style={{ marginLeft: 4 }}>⚠</span>
                          )}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}