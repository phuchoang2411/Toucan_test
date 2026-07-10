import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useScopedDB } from '../hooks/useScopedDB';
import { SALES_REPS } from '../domain/types';
import { StageBadge } from '../components/StageBadge';
import { SyncBadge } from '../components/SyncBadge';
import { isOverdue } from '../domain/visits';
import { localISODate, localWeekRange } from '../domain/dates';
import { t, labelFor, VISIT_STATUS_LABELS, CANCEL_REASON_LABELS } from '../strings';
import type { KeyboardEvent } from 'react';

export function SchedulePage() {
  const db = useScopedDB();
  const navigate = useNavigate();
  const outletById = new Map(db.outlets.map((o) => [o.id, o]));

  const [searchParams, setSearchParams] = useSearchParams();
  const rawRep = searchParams.get('rep');
  const rawStatus = searchParams.get('status');
  const rawWhen = searchParams.get('when');
  const repFilter = rawRep && SALES_REPS.includes(rawRep as typeof SALES_REPS[number]) ? rawRep : 'all';
  const statusFilter = rawStatus && ['planned', 'completed', 'cancelled'].includes(rawStatus) ? rawStatus : 'all';
  const whenFilter = rawWhen && ['today', 'week', 'overdue'].includes(rawWhen) ? rawWhen : 'all';

  function setFilter(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === 'all') next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  }

  const today = localISODate();
  const week = localWeekRange();

  const filtered = useMemo(() => {
    let items = [...db.visits];
    if (repFilter !== 'all') items = items.filter((v) => v.salesRep === repFilter);
    if (statusFilter !== 'all') items = items.filter((v) => v.status === statusFilter);
    if (whenFilter === 'today') items = items.filter((v) => v.visitDate === today);
    else if (whenFilter === 'week') items = items.filter((v) => v.visitDate >= week.start && v.visitDate <= week.end);
    else if (whenFilter === 'overdue') items = items.filter((v) => isOverdue(v.status, v.visitDate, today));
    return items.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  }, [db.visits, repFilter, statusFilter, whenFilter, today, week.start, week.end]);

  const hasActiveFilters = repFilter !== 'all' || statusFilter !== 'all' || whenFilter !== 'all';

  function openVisit(id: string) {
    navigate(`/visits/${id}`);
  }

  function handleKeyDown(id: string, e: KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('button')) {
      e.preventDefault();
      openVisit(id);
    }
  }

  return (
    <section>
      <header className="page-header">
        <h1>{t('working_schedule_title')}</h1>
      </header>

      <div className="filters">
        {db.isManager && (
          <div className="field">
            <label htmlFor="filter-rep">{t('rep_filter_label')}</label>
            <select id="filter-rep" value={repFilter} onChange={(e) => setFilter('rep', e.target.value)}>
              <option value="all">{t('all_reps')}</option>
              {SALES_REPS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="filter-status">{t('status_filter_label')}</label>
          <select id="filter-status" value={statusFilter} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="all">{t('all_statuses')}</option>
            <option value="planned">{t('planned_option')}</option>
            <option value="completed">{t('completed_option')}</option>
            <option value="cancelled">{t('cancelled_option')}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-when">{t('when_filter_label')}</label>
          <select id="filter-when" value={whenFilter} onChange={(e) => setFilter('when', e.target.value)}>
            <option value="all">{t('all_dates')}</option>
            <option value="today">{t('today_option')}</option>
            <option value="week">{t('this_week_option')}</option>
            <option value="overdue">{t('overdue_option')}</option>
          </select>
        </div>
        {hasActiveFilters && (
          <button className="btn btn-secondary" onClick={() => setSearchParams({}, { replace: true })} style={{ alignSelf: 'flex-end' }}>
            {t('clear_filters')}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>{hasActiveFilters ? t('no_visits_filter') : t('no_visits_yet')}</p>
          {hasActiveFilters && (
            <button className="btn btn-secondary" onClick={() => setSearchParams({}, { replace: true })}>
              {t('clear_filters')}
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table table-clickable" aria-label={t('schedule_table_aria')}>
            <thead>
              <tr>
                <th>{t('date_header')}</th><th>{t('rep_header')}</th><th>{t('outlet_header')}</th><th>{t('address_header')}</th>
                <th>{t('stage_planning_header')}</th><th>{t('target_header')}</th><th>{t('objective_header')}</th><th>{t('misa_header')}</th><th>{t('status_header')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const outlet = outletById.get(v.outletId);
                return (
                  <tr
                    key={v.id}
                    tabIndex={0}
                    onClick={() => openVisit(v.id)}
                    onKeyDown={(e) => handleKeyDown(v.id, e)}
                  >
                    <td>{v.visitDate}</td>
                    <td>{v.salesRep}</td>
                    <td><Link to={`/visits/${v.id}`} onClick={(e) => e.stopPropagation()}>{outlet?.name ?? '—'}</Link></td>
                    <td>{outlet?.address ?? '—'}</td>
                    <td><StageBadge stage={v.currentStageSnapshot} /></td>
                    <td><StageBadge stage={v.targetStage} /></td>
                    <td>{v.objective}</td>
                    <td><SyncBadge visit={v} /></td>
                    <td>
                      <span className={`badge badge--${v.status}`}>{labelFor(VISIT_STATUS_LABELS, v.status)}</span>
                      {v.status === 'cancelled' && v.cancelReason && (
                        <span className="muted" style={{ marginLeft: 4, fontSize: 11 }}>{labelFor(CANCEL_REASON_LABELS, v.cancelReason)}</span>
                      )}
                      {isOverdue(v.status, v.visitDate, today) && (
                        <span className="badge badge--overdue" style={{ marginLeft: 4 }}>{t('overdue_badge')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}