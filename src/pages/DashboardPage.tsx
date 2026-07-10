import { Link } from 'react-router-dom';
import { useDB } from '../hooks/useDB';
import { STAGES, STAGE_LABELS, SALES_REPS } from '../domain/types';
import { isOverdue } from '../domain/visits';
import { localISODate, localWeekRange } from '../domain/dates';

export function DashboardPage() {
  const db = useDB();
  const today = localISODate();
  const week = localWeekRange();

  const outletById = new Map(db.outlets.map((o) => [o.id, o]));

  const maxStageCount = Math.max(
    1,
    ...STAGES.map((s) => db.outlets.filter((o) => o.currentStage === s).length),
  );

  const repRows = SALES_REPS.map((rep) => {
    const repOutlets = db.outlets.filter((o) => o.salesRep === rep);
    const repVisits = db.visits.filter((v) => v.salesRep === rep);
    return {
      rep,
      outlets: repOutlets.length,
      planned: repVisits.filter((v) => v.status === 'planned').length,
      overdue: repVisits.filter((v) => isOverdue(v.status, v.visitDate, today)).length,
      completed: repVisits.filter((v) => v.status === 'completed').length,
    };
  });

  const weekVisits = db.visits
    .filter((v) => v.status === 'planned' && v.visitDate >= today && v.visitDate <= week.end)
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate));

  return (
    <section>
      <header className="page-header">
        <h1>Dashboard</h1>
      </header>

      <div className="card">
        <h2>Outlets per stage</h2>
        {STAGES.map((stage) => {
          const count = db.outlets.filter((o) => o.currentStage === stage).length;
          const pct = Math.round((count / maxStageCount) * 100);
          const barContent = (
            <>
              <span className="bar-label">{STAGE_LABELS[stage]}</span>
              <div className="bar-track" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="bar-count">{count}</span>
            </>
          );
          return (
            <div key={stage} className="bar-row">
              {count > 0 ? (
                <Link to={`/outlets?stage=${stage}`} className="bar-row-link">
                  {barContent}
                </Link>
              ) : barContent}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Per-rep breakdown</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Rep</th><th>Outlets</th><th>Planned</th><th>Overdue</th><th>Completed</th></tr>
            </thead>
            <tbody>
              {repRows.map((r) => (
                  <tr key={r.rep}>
                    <td>
                      <Link to={`/schedule?rep=${r.rep}`} className="drill-link">{r.rep}</Link>
                    </td>
                    <td>{r.outlets}</td>
                    <td>
                      {r.planned > 0
                        ? <Link to={`/schedule?rep=${r.rep}&status=planned`} className="drill-link">{r.planned}</Link>
                        : r.planned}
                    </td>
                    <td>
                      {r.overdue > 0
                        ? <Link to={`/schedule?rep=${r.rep}&when=overdue`} className="drill-link"><span className="badge badge--overdue">{r.overdue}</span></Link>
                        : r.overdue}
                    </td>
                    <td>
                      {r.completed > 0
                        ? <Link to={`/schedule?rep=${r.rep}&status=completed`} className="drill-link">{r.completed}</Link>
                        : r.completed}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Upcoming this week ({today} – {week.end})</h2>
        {weekVisits.length === 0 ? (
          <p className="muted">No visits scheduled for this week.</p>
        ) : (
          <ul>
            {weekVisits.map((v) => {
              const outlet = outletById.get(v.outletId);
              return (
                <li key={v.id}>
                  <Link to={`/visits/${v.id}`}>
                    {v.visitDate} — {outlet?.name ?? 'Unknown'} ({v.salesRep})
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
