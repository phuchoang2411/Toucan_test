import { USERS } from '../domain/types';
import { session } from '../store/session';
import { useSession } from '../hooks/useSession';
import { t } from '../strings';

export function UserSwitcher() {
  const user = useSession();

  return (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
      <label htmlFor="user-switcher" className="muted" style={{ fontSize: 13 }}>{t('signed_in_as')}</label>
      <select
        id="user-switcher"
        value={user.name}
        onChange={(e) => {
          const next = USERS.find((u) => u.name === e.target.value);
          if (next) session.setUser(next);
        }}
      >
        {USERS.map((u) => (
          <option key={u.name} value={u.name}>{u.name} — {u.role === 'manager' ? t('manager_role') : t('rep_role')}</option>
        ))}
      </select>
    </div>
  );
}
