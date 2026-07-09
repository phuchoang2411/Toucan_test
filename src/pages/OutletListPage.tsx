import { Link } from 'react-router-dom';
import { useDB } from '../hooks/useDB';
import { StageBadge } from '../components/StageBadge';

export function OutletListPage() {
  const { outlets } = useDB();
  const sorted = [...outlets].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section>
      <header className="page-header">
        <h1>C.A Outlets</h1>
        <Link className="btn btn-primary" to="/outlets/new">+ New outlet</Link>
      </header>
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
    </section>
  );
}