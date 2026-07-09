import type { Visit } from '../domain/types';
import { syncService } from '../services/syncService';
import { fireToast } from './Toast';
import styles from './SyncBadge.module.css';

export function SyncBadge({ visit }: { visit: Visit }) {
  return (
    <span className={`${styles.badge} ${styles[visit.misaSyncStatus]}`}>
      {visit.misaSyncStatus}
      {visit.misaSyncStatus === 'Failed' && (
        <button
          className={styles.retry}
          aria-label={`Retry sync for ${visit.id.slice(0, 8)}`}
          onClick={(e) => {
            e.stopPropagation();
            syncService.retry(visit.id);
            fireToast('Sync retry queued', 'info');
          }}
        >
          Retry
        </button>
      )}
    </span>
  );
}