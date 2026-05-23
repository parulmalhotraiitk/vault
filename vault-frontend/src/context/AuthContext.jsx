import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState({ initialized: false, locked: true, loading: true });
  const [token, setToken] = useState(() => localStorage.getItem('vault_token'));
  const [autoLockMins, setAutoLockMinsState] = useState(
    () => parseInt(localStorage.getItem('vault_autolock_mins') || '5')
  );
  const [lockWarning, setLockWarning] = useState(false);

  const inactivityTimer = useRef(null);
  const warningTimer = useRef(null);
  // Ref so the timer callback always calls the latest lockVault, never stale
  const lockVaultRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await authApi.status();
      setStatus({ ...res.data, loading: false });
    } catch {
      setStatus({ initialized: false, locked: true, loading: false });
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const lockVault = useCallback(async () => {
    try { await authApi.lock(); } catch {}
    localStorage.removeItem('vault_token');
    setToken(null);
    setStatus(s => ({ ...s, locked: true }));
    setLockWarning(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
  }, []);

  // Keep ref in sync — this is what the timer calls to avoid stale closures
  useEffect(() => { lockVaultRef.current = lockVault; }, [lockVault]);

  const setAutoLockMins = useCallback((mins) => {
    setAutoLockMinsState(mins);
    localStorage.setItem('vault_autolock_mins', String(mins));
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    setLockWarning(false);

    if (!token) return;

    const timeoutMs = autoLockMins * 60 * 1000;
    const warningMs = timeoutMs - 30_000;

    if (warningMs > 0) {
      warningTimer.current = setTimeout(() => setLockWarning(true), warningMs);
    }
    inactivityTimer.current = setTimeout(() => {
      lockVaultRef.current?.();
    }, timeoutMs);
  }, [token, autoLockMins]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };
  }, [resetInactivityTimer]);

  const setup = async (password) => {
    const res = await authApi.setup(password);
    const tok = res.data.data.token;
    localStorage.setItem('vault_token', tok);
    setToken(tok);
    await fetchStatus();
    return res.data;
  };

  const unlock = async (password) => {
    const res = await authApi.unlock(password);
    const tok = res.data.data.token;
    localStorage.setItem('vault_token', tok);
    setToken(tok);
    await fetchStatus();
    return res.data;
  };

  return (
    <AuthContext.Provider value={{
      status, token, setup, unlock, lockVault, fetchStatus,
      autoLockMins, setAutoLockMins,
      lockWarning, setLockWarning,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
