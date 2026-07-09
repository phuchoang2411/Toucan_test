import { useCallback, useEffect, useState } from 'react';
import styles from './Toast.module.css';

export interface ToastMessage {
  id: string;
  text: string;
  variant?: 'success' | 'error' | 'info';
}

let toastListeners: ((msg: ToastMessage) => void)[] = [];

export function fireToast(text: string, variant: ToastMessage['variant'] = 'success') {
  const msg: ToastMessage = { id: crypto.randomUUID(), text, variant };
  toastListeners.forEach((fn) => fn(msg));
}

export function Toast() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  const add = useCallback((msg: ToastMessage) => {
    setItems((prev) => [...prev, msg]);
  }, []);

  useEffect(() => {
    toastListeners.push(add);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== add);
    };
  }, [add]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <div className={styles.container}>
      {items.map((msg) => (
        <ToastItem key={msg.id} msg={msg} onDone={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({ msg, onDone }: { msg: ToastMessage; onDone: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(msg.id), 3000);
    return () => clearTimeout(timer);
  }, [msg.id, onDone]);

  return (
    <div className={`${styles.toast} ${styles[msg.variant ?? 'success']}`} role="status">
      <span>{msg.text}</span>
      <button className={styles.close} onClick={() => onDone(msg.id)} aria-label="Dismiss">&times;</button>
    </div>
  );
}