import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { OutletListPage } from './pages/OutletListPage';
import { OutletFormPage } from './pages/OutletFormPage';
import { SchedulePage } from './pages/SchedulePage';
import { VisitDetailPage } from './pages/VisitDetailPage';
import { Toast } from './components/Toast';

export default function App() {
  return (
    <div className="app">
      <Toast />
      <nav className="topnav">
        <span className="brand">Magnolia Sales</span>
        <NavLink to="/outlets">Outlets</NavLink>
        <NavLink to="/schedule">Working Schedule</NavLink>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/outlets" replace />} />
          <Route path="/outlets" element={<OutletListPage />} />
          <Route path="/outlets/new" element={<OutletFormPage />} />
          <Route path="/outlets/:id/edit" element={<OutletFormPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/visits/:id" element={<VisitDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}