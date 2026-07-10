import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CANCEL_REASONS, EVIDENCE_TYPES, STAGES } from '../domain/types';
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
import { t, labelFor, VISIT_STATUS_LABELS, STAGE_LABELS, CANCEL_REASON_LABELS, EVIDENCE_TYPE_LABELS } from '../strings';

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
          <h1>{t('visit_not_found')}</h1>
        </header>
        <div className="empty-state">
          <p>{t('no_visit_with_id', { id: id! })}</p>
          <Link className="btn btn-primary" to="/schedule">{t('back_to_schedule')}</Link>
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
      fireToast(t('evidence_added'));
      setEvName('');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setEvError(message === 'FORBIDDEN' ? t('not_authorized_evidence') : t('failed_add_evidence'));
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
      fireToast(t('visit_completed'));
      navigate('/schedule');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        message === 'EVIDENCE_REQUIRED'
          ? t('stage_change_blocked')
          : message === 'RESULT_REQUIRED'
            ? t('result_required')
            : message === 'DATE_MISMATCH_NOTE_REQUIRED'
              ? t('date_mismatch_required')
              : message === 'FORBIDDEN'
                ? t('not_authorized_complete')
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
      fireToast(t('visit_rescheduled', { date: newDate }));
      setShowReschedule(false);
      setNewDate('');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setRescheduleError(
        message === 'DATE_ALREADY_PLANNED'
          ? t('date_already_planned_visit')
          : message === 'FORBIDDEN'
            ? t('not_authorized_reschedule')
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
        fireToast(t('visit_cancelled'));
        setShowCancel(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setCancelError(message === 'FORBIDDEN' ? t('not_authorized_cancel') : message);
      }
      setCancelling(false);
    } else {
      setConfirmCancel(true);
    }
  }

  return (
    <section>
      <header className="page-header">
        <h1>{t('visit_title', { name: outlet.name })}</h1>
        <span className={`badge badge--${visit.status}`}>{labelFor(VISIT_STATUS_LABELS, visit.status)}</span>
        <SyncBadge visit={visit} />
      </header>

      <div className="card">
        <p><strong>{visit.visitDate}</strong>
          {isOverdue(visit.status, visit.visitDate, localISODate()) && (
            <span className="badge badge--overdue" style={{ marginLeft: 8 }}>{t('overdue_badge')}</span>
          )}
          {' · '}{visit.salesRep} · {outlet.address}</p>
        <p>
          {t('stage_at_planning')} <StageBadge stage={visit.currentStageSnapshot} />{' '}
          {t('target_arrow')} <StageBadge stage={visit.targetStage} />{' '}
          {t('outlet_now')} <StageBadge stage={outlet.currentStage} />
        </p>
        <p className="muted">{t('objective_label_detail')} {visit.objective}</p>
      </div>

      {!readOnly && (
        <div className="card">
          <h2>{t('actions_title')}</h2>
          <div className="field-row">
            {!showReschedule && !showCancel && (
              <>
                <button className="btn" type="button" onClick={() => { setShowReschedule(true); setShowCancel(false); }}>
                  {t('reschedule_button')}
                </button>
                <button className="btn btn-danger" type="button" onClick={() => { setShowCancel(true); setShowReschedule(false); setConfirmCancel(false); }}>
                  {t('cancel_visit_button')}
                </button>
              </>
            )}
          </div>

          {showReschedule && (
            <div className="field-group--conditional" style={{ marginTop: 12 }}>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="reschedule-date">{t('new_date_label')}</label>
                  <input
                    id="reschedule-date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
              </div>
              {newDate && newDate < localISODate() && (
                <p className="warning-text">{t('date_in_past_warning')}</p>
              )}
              {rescheduleError && <p className="error-text" role="alert">{rescheduleError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary" type="button" onClick={handleReschedule} disabled={rescheduling || !newDate.trim()} aria-busy={rescheduling}>
                  {rescheduling ? t('rescheduling') : t('confirm_reschedule')}
                </button>
                <button className="btn" type="button" onClick={() => { setShowReschedule(false); setNewDate(''); setRescheduleError(''); }}>
                  {t('cancel_dismiss')}
                </button>
              </div>
            </div>
          )}

          {showCancel && (
            <div className="field-group--conditional" style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="cancel-reason">{t('reason_label')}</label>
                <select
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => { setCancelReason(e.target.value); setConfirmCancel(false); }}
                >
                  {CANCEL_REASONS.filter((r) => r !== 'Unscheduled from outlet form').map((r) => (
                    <option key={r} value={r}>{labelFor(CANCEL_REASON_LABELS, r)}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="cancel-note">{t('note_optional')}</label>
                <textarea
                  id="cancel-note"
                  rows={2}
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder={cancelReason === 'Other' ? t('describe_why_placeholder') : t('additional_details_placeholder')}
                />
              </div>
              {cancelError && <p className="error-text" role="alert">{cancelError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-danger" type="button" onClick={handleCancel} disabled={cancelling} aria-busy={cancelling}>
                  {cancelling ? t('cancelling') : confirmCancel ? t('click_again_confirm') : t('cancel_visit_destructive')}
                </button>
                <button className="btn" type="button" onClick={() => { setShowCancel(false); setCancelNote(''); setCancelError(''); setConfirmCancel(false); }}>
                  {t('back_button')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2>{t('evidence_count', { count: evidence.length })}</h2>
        {evidence.length === 0 && <p className="muted">{t('no_evidence_yet')}</p>}
        <ul>
          {evidence.map((e) => <li key={e.id}>[{labelFor(EVIDENCE_TYPE_LABELS, e.type)}] {e.name}</li>)}
        </ul>
        {!readOnly && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="ev-type">{t('type_label')}</label>
              <select id="ev-type" value={evType} onChange={(e) => setEvType(e.target.value as EvidenceType)}>
                {EVIDENCE_TYPES.map((et) => <option key={et} value={et}>{labelFor(EVIDENCE_TYPE_LABELS, et)}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="ev-name">{t('filename_or_note_label')}</label>
                <input
                  id="ev-name"
                  placeholder={t('filename_placeholder')}
                  value={evName}
                  onChange={(e) => setEvName(e.target.value)}
                  aria-invalid={!!evError}
                  aria-describedby={evError ? 'ev-error' : undefined}
                />
                {evError && <span className="error-text" id="ev-error" role="alert">{evError}</span>}
              </div>
              <button type="button" className="btn" onClick={addEvidence} disabled={addingEvidence} aria-busy={addingEvidence}>
                {addingEvidence ? t('adding') : t('add_button')}
              </button>
            </div>
          </div>
        )}
      </div>

      {readOnly ? (
        <div className="card">
          <h2>{visit.status === 'cancelled' ? t('cancelled_title') : t('result_title')}</h2>
          {visit.status === 'cancelled' ? (
            <>
              <p className="muted">{t('visit_was_cancelled')}</p>
              {visit.cancelReason && <p>{t('reason_prefix')} <strong>{labelFor(CANCEL_REASON_LABELS, visit.cancelReason)}</strong></p>}
              {visit.cancelNote && <p className="muted">{t('note_display', { note: visit.cancelNote })}</p>}
              <p className="muted">{t('evidence_preserved')}</p>
              <p className="muted">{t('cancellation_sent_misa')}</p>
            </>
          ) : (
            <>
              <p>{visit.result}</p>
              {visit.resultNotes && <p className="muted">{visit.resultNotes}</p>}
              {visit.dateMismatchNote && (
                <p className="warning-text">{t('completed_different_day', { date: visit.visitDate, note: visit.dateMismatchNote })}</p>
              )}
              <p className="muted">{t('completed_readonly')}</p>
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <h2>{t('complete_visit_title')}</h2>
          <div className="field">
            <label htmlFor="visit-result">{t('result_label')}</label>
            <input id="visit-result" value={result} onChange={(e) => setResult(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="visit-result-notes">{t('notes_label')}</label>
            <textarea id="visit-result-notes" rows={2} value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} />
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={changeStage}
              disabled={!hasEvidence}
              onChange={(e) => setChangeStage(e.target.checked)}
            />
            {t('change_outlet_stage')}
          </label>
          {!hasEvidence && (
            <p className="muted">{t('add_evidence_to_unlock')}</p>
          )}
          {changeStage && (
            <div className="field-group--conditional">
              <div className="field">
                <label htmlFor="visit-new-stage">{t('new_stage_default')}</label>
                <select id="visit-new-stage" value={newStage} onChange={(e) => setNewStage(e.target.value as Stage)}>
                  {STAGES.map((s) => <option key={s} value={s}>{labelFor(STAGE_LABELS, s)}</option>)}
                </select>
              </div>
              {newStage === outlet.currentStage && (
                <p className="warning-text">{t('current_stage_warning')}</p>
              )}
            </div>
          )}
          {completingOnDifferentDay && (
            <div className="field">
              <p className="warning-text">{t('different_day_warning', { date: visit.visitDate })}</p>
              <label htmlFor="visit-date-mismatch-note">{t('reason_date_mismatch_label')}</label>
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
            {saving ? t('completing') : t('complete_visit_button')}
          </button>
        </div>
      )}

      <div className="card">
        <h2>{t('stage_history_title', { name: outlet.name })}</h2>
        {history.length === 0 && <p className="muted">{t('no_transitions_yet')}</p>}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t('when_header')}</th><th>{t('from_header')}</th><th>{t('to_header')}</th><th>{t('by_header')}</th><th>{t('visit_header')}</th></tr></thead>
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