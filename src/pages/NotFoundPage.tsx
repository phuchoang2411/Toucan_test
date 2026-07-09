import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section>
      <header className="page-header">
        <h1>Page not found</h1>
      </header>
      <div className="empty-state">
        <p>The page you're looking for doesn't exist.</p>
        <Link className="btn btn-primary" to="/outlets">Back to Outlets</Link>
      </div>
    </section>
  );
}
