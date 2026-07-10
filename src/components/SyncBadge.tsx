import type { Visit } from '../domain/types';
import { t, labelFor, SYNC_STATUS_LABELS } from '../strings';
import { syncService } from '../services/syncService';
import { fireToast } from './Toast';
import styles from './SyncBadge.module.css';

export function SyncBadge({ visit }: { visit: Visit }) {
  return (
    <span className={`${styles.badge} ${styles[visit.misaSyncStatus]}`}>
      {labelFor(SYNC_STATUS_LABELS, visit.misaSyncStatus)}
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