import { Link, useSearchParams } from 'react-router-dom';
import { STAGES } from '../domain/types';
import { useScopedDB } from '../hooks/useScopedDB';
import { StageBadge } from '../components/StageBadge';
import { t, labelFor, STAGE_LABELS, CHANNEL_LABELS } from '../strings';

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
        <h1>{t('outlets_title')}</h1>
        <Link className="btn btn-primary" to="/outlets/new">{t('new_outlet')}</Link>
      </header>

      {stageFilter !== 'all' && (
        <div className="filters" style={{ marginBottom: 12 }}>
          <span className="badge badge--active-filter">
            {t('stage_filter_chip', { label: labelFor(STAGE_LABELS, stageFilter) })}
            <button className="btn-clear-chip" onClick={clearStageFilter} aria-label={t('clear_stage_filter_aria')}>&times;</button>
          </span>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <p>{stageFilter !== 'all' ? t('no_outlets_stage_filter') : t('no_outlets_yet')}</p>
          {stageFilter !== 'all' && (
            <button className="btn btn-secondary" onClick={clearStageFilter}>{t('clear_filter')}</button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>{t('name_header')}</th><th>{t('channel_header')}</th><th>{t('tier_header')}</th><th>{t('sales_rep_header')}</th><th>{t('stage_header')}</th></tr>
            </thead>
            <tbody>
              {sorted.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/outlets/${o.id}/edit`}>{o.name}</Link></td>
                  <td>{labelFor(CHANNEL_LABELS, o.channel)}</td>
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
