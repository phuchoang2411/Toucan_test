import { t, type Locale } from '../strings';
import { useLocale } from './LocaleContext';

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <select
      aria-label={t('locale_switcher_aria')}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
    >
      <option value="vi">Tiếng Việt</option>
      <option value="en">English</option>
    </select>
  );
}
