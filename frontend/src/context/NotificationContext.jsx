import { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '../components/shared/Toast';

const NotificationContext = createContext(null);

let nextId = 0;

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef({});

  const removeNotification = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, removing: true } : n))
    );
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 200);
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const addNotification = useCallback((type, title, message) => {
    const id = ++nextId;
    setNotifications((prev) => [...prev, { id, type, title, message, removing: false }]);
    timersRef.current[id] = setTimeout(() => removeNotification(id), 5000);
    return id;
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ addNotification, removeNotification }}>
      {children}
      <Toast notifications={notifications} onClose={removeNotification} />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
