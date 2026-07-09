import type { Stage } from '../domain/types';
import { STAGE_LABELS } from '../domain/types';
import styles from './StageBadge.module.css';

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={`${styles.badge} ${styles[stage]}`}>{STAGE_LABELS[stage]}</span>;
}