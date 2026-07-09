import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.addEventListener('blur', () => h1.removeAttribute('tabindex'), { once: true });
      h1.focus();
    }
  }, [pathname]);
  return null;
}
