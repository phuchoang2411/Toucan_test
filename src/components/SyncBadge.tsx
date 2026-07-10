import type { Visit } from '../domain/types';
import { t, SYNC_STATUS_LABELS } from '../strings';
import { syncService } from '../services/syncService';
import { fireToast } from './Toast';
import styles from './SyncBadge.module.css';

export function SyncBadge({ visit }: { visit: Visit }) {
  const label = SYNC_STATUS_LABELS[visit.misaSyncStatus]?.vi ?? visit.misaSyncStatus;
  return (
    <span className={`${styles.badge} ${styles[visit.misaSyncStatus]}`}>
      {label}
      {visit.misaSyncStatus === 'Failed' && (
        <button
          className={styles.retry}
          aria-label={t('retry_sync_aria', { id: visit.id.slice(0, 8) })}
          onClick={(e) => {
            e.stopPropagation();
            syncService.retry(visit.id);
            fireToast(t('sync_retry_queued'), 'info');
          }}
        >
          {t('retry_button')}
        </button>
      )}
    </span>
  );
}