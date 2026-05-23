import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from './context/AuthContext';
import { VaultProvider } from './context/VaultContext';
import SetupPage from './pages/SetupPage';
import UnlockPage from './pages/UnlockPage';
import DashboardPage from './pages/DashboardPage';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="animate-spin" style={{
          display: 'inline-block', width: 40, height: 40,
          border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
          borderRadius: '50%', marginBottom: 16,
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Initializing vault...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { status, lockWarning } = useAuth();

  if (status.loading) return <LoadingScreen />;

  return (
    <>
      {lockWarning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, background: 'var(--yellow)', color: '#000',
          padding: '8px', textAlign: 'center', fontWeight: 'bold', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
        }}>
          <span className="animate-pulse">⚠️ Vault will auto-lock in 30 seconds due to inactivity</span>
        </div>
      )}
      <AnimatePresence mode="wait">
        {!status.initialized ? (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SetupPage />
          </motion.div>
        ) : status.locked ? (
          <motion.div key="unlock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <UnlockPage />
          </motion.div>
        ) : (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <VaultProvider>
              <DashboardPage />
            </VaultProvider>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
