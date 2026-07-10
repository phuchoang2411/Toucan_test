import type { Visit } from '../domain/types';
import { isOverdue } from '../domain/visits';
import { t, labelFor, VISIT_STATUS_LABELS, CANCEL_REASON_LABELS } from '../strings';

/** Status badge + cancel-reason chip + overdue badge, shared by any table row that lists a Visit. */
export function VisitStatusCell({ visit, today }: { visit: Visit; today: string }) {
  return (
    <>
      <span className={`badge badge--${visit.status}`}>{labelFor(VISIT_STATUS_LABELS, visit.status)}</span>
      {visit.status === 'cancelled' && visit.cancelReason && (
        <span className="muted" style={{ marginLeft: 4, fontSize: 11 }}>{labelFor(CANCEL_REASON_LABELS, visit.cancelReason)}</span>
      )}
      {isOverdue(visit.status, visit.visitDate, today) && (
        <span className="badge badge--overdue" style={{ marginLeft: 4 }}>{t('overdue_badge')}</span>
      )}
    </>
  );
}
