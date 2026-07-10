import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDB } from '../hooks/useDB';
import { SALES_REPS } from '../domain/types';
import { StageBadge } from '../components/StageBadge';
import { SyncBadge } from '../components/SyncBadge';
import { isOverdue } from '../domain/visits';
import { localISODate, localWeekRange } from '../domain/dates';
import type { KeyboardEvent } from 'react';
import type { VisitStatus } from '../domain/types';

export function SchedulePage() {
  const db = useDB();
  const navigate = useNavigate();
  const outletById = new Map(db.outlets.map((o) => [o.id, o]));

  const [repFilter, setRepFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [whenFilter, setWhenFilter] = useState<string>('all');

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
        <h1>Working Schedule</h1>
      </header>

      <div className="filters">
        <div className="field">
          <label htmlFor="filter-rep">Rep</label>
          <select id="filter-rep" value={repFilter} onChange={(e) => setRepFilter(e.target.value)}>
            <option value="all">All reps</option>
            {SALES_REPS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-status">Status</label>
          <select id="filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-when">When</label>
          <select id="filter-when" value={whenFilter} onChange={(e) => setWhenFilter(e.target.value)}>
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        {hasActiveFilters && (
          <button className="btn btn-secondary" onClick={() => { setRepFilter('all'); setStatusFilter('all'); setWhenFilter('all'); }} style={{ alignSelf: 'flex-end' }}>
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>{hasActiveFilters ? 'No visits match the current filters.' : 'No visits scheduled yet. Create a visit from the outlet form.'}</p>
          {hasActiveFilters && (
            <button className="btn btn-secondary" onClick={() => { setRepFilter('all'); setStatusFilter('all'); setWhenFilter('all'); }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table table-clickable" aria-label="Working schedule, click a row or the outlet name to open a visit">
            <thead>
              <tr>
                <th>Date</th><th>Rep</th><th>Outlet</th><th>Address</th>
                <th>Stage (at planning)</th><th>Target</th><th>Objective</th><th>MISA</th><th>Status</th>
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
                      <span className={`badge badge--${v.status}`}>{v.status}</span>
                      {isOverdue(v.status, v.visitDate, today) && (
                        <span className="badge badge--overdue" style={{ marginLeft: 4 }}>overdue</span>
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