import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { OutletListPage } from './pages/OutletListPage';
import { OutletFormPage } from './pages/OutletFormPage';
import { SchedulePage } from './pages/SchedulePage';
import { VisitDetailPage } from './pages/VisitDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Toast } from './components/Toast';
import { RouteFocus } from './components/RouteFocus';
import { UserSwitcher } from './components/UserSwitcher';
import { LocaleProvider } from './components/LocaleContext';
import { t } from './strings';

export default function App() {
  return (
    <LocaleProvider>
      <div className="app">
      <Toast />
      <RouteFocus />
      <nav className="topnav">
        <span className="brand">Magnolia Sales</span>
        <NavLink to="/outlets">{t('nav_outlets')}</NavLink>
        <NavLink to="/schedule">{t('nav_working_schedule')}</NavLink>
        <NavLink to="/dashboard">{t('nav_dashboard')}</NavLink>
        <UserSwitcher />
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/outlets" replace />} />
          <Route path="/outlets" element={<OutletListPage />} />
          <Route path="/outlets/new" element={<OutletFormPage />} />
          <Route path="/outlets/:id/edit" element={<OutletFormPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/visits/:id" element={<VisitDetailPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      </div>
    </LocaleProvider>
  );
}