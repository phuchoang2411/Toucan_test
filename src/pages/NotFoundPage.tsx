import { Link } from 'react-router-dom';
import { t } from '../strings';

export function NotFoundPage() {
  return (
    <section>
      <header className="page-header">
        <h1>{t('page_not_found')}</h1>
      </header>
      <div className="empty-state">
        <p>{t('page_not_exist')}</p>
        <Link className="btn btn-primary" to="/outlets">{t('back_to_outlets_nav')}</Link>
      </div>
    </section>
  );
}
