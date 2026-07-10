import type { Stage } from '../domain/types';
import { labelFor, STAGE_LABELS } from '../strings';
import styles from './StageBadge.module.css';

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={`${styles.badge} ${styles[stage]}`}>{labelFor(STAGE_LABELS, stage)}</span>;
}