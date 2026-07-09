import { useNavigate } from 'react-router-dom';
import { useDB } from '../hooks/useDB';
import { StageBadge } from '../components/StageBadge';
import { SyncBadge } from '../components/SyncBadge';
import type { KeyboardEvent } from 'react';

export function SchedulePage() {
  const db = useDB();
  const navigate = useNavigate();
  const visits = [...db.visits].sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  const outletById = new Map(db.outlets.map((o) => [o.id, o]));

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
      {visits.length === 0 ? (
        <div className="empty-state">
          <p>No visits scheduled yet. Create a visit from the outlet form.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table table-clickable">
            <thead>
              <tr>
                <th>Date</th><th>Rep</th><th>Outlet</th><th>Address</th>
                <th>Stage (at planning)</th><th>Target</th><th>Objective</th><th>MISA</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => {
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
                    <td>{outlet?.name ?? '—'}</td>
                    <td>{outlet?.address ?? '—'}</td>
                    <td><StageBadge stage={v.currentStageSnapshot} /></td>
                    <td><StageBadge stage={v.targetStage} /></td>
                    <td>{v.objective}</td>
                    <td><SyncBadge visit={v} /></td>
                    <td>{v.status}</td>
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