import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { syncService } from './services/syncService';
import './index.css';

// Resume sync for visits still Queued from a previous session (M1): the 1.5s
// resolution timer is in-memory, but `Queued` is persisted to localStorage, so a
// reload mid-sync would otherwise leave rows stuck forever.
syncService.resumePending();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);