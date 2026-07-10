import { Link, useSearchParams } from 'react-router-dom';
import { STAGES, STAGE_LABELS } from '../domain/types';
import { useScopedDB } from '../hooks/useScopedDB';
import { StageBadge } from '../components/StageBadge';

export function OutletListPage() {
  const { outlets } = useScopedDB();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStage = searchParams.get('stage');
  const stageFilter = rawStage && STAGES.includes(rawStage as typeof STAGES[number]) ? rawStage : 'all';

  const filtered = stageFilter === 'all'
    ? outlets
    : outlets.filter((o) => o.currentStage === stageFilter);

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  function clearStageFilter() {
    setSearchParams({}, { replace: true });
  }

  return (
    <section>
      <header className="page-header">
        <h1>C.A Outlets</h1>
        <Link className="btn btn-primary" to="/outlets/new">+ New outlet</Link>
      </header>

      {stageFilter !== 'all' && (
        <div className="filters" style={{ marginBottom: 12 }}>
          <span className="badge badge--active-filter">
            Stage: {STAGE_LABELS[stageFilter as typeof STAGES[number]]}
            <button className="btn-clear-chip" onClick={clearStageFilter} aria-label="Clear stage filter">&times;</button>
          </span>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <p>{stageFilter !== 'all' ? 'No outlets match this stage filter.' : 'No outlets yet. Add your first outlet to get started.'}</p>
          {stageFilter !== 'all' && (
            <button className="btn btn-secondary" onClick={clearStageFilter}>Clear filter</button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Channel</th><th>Tier</th><th>Sales rep</th><th>Stage</th></tr>
            </thead>
            <tbody>
              {sorted.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/outlets/${o.id}/edit`}>{o.name}</Link></td>
                  <td>{o.channel}</td>
                  <td>{o.tier}</td>
                  <td>{o.salesRep}</td>
                  <td><StageBadge stage={o.currentStage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
