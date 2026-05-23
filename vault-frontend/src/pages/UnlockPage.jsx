import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UnlockPage() {
  const { unlock } = useAuth();
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const handleUnlock = async (e) => {
    e?.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      await unlock(password);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid master password');
      setShakeKey(k => k + 1);
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 40% 30%, rgba(124,58,237,0.15) 0%, transparent 60%), var(--bg-base)',
      padding: 24,
    }}>
      <div style={{ position:'fixed', top:'20%', left:'10%', width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:'15%', right:'10%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', pointerEvents:'none' }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ width: '100%', maxWidth: 420 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <motion.div
            key={shakeKey}
            animate={shakeKey > 0 ? { x: [-8, 8, -8, 8, 0] } : {}}
            transition={{ duration: 0.4 }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 80, height: 80, borderRadius: 22,
              background: 'linear-gradient(135deg, var(--accent), #6d28d9)',
              marginBottom: 20,
              boxShadow: '0 0 40px rgba(124,58,237,0.4)',
            }}
          >
            <Lock size={40} color="white" />
          </motion.div>

          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, background: 'linear-gradient(135deg, #f1f0ff, var(--accent-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Vault Locked
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Enter your master password to unlock</p>
        </div>

        <motion.div key={shakeKey > 0 ? `shake-${shakeKey}` : 'normal'} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--accent), var(--blue))' }} />

          <form onSubmit={handleUnlock}>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label className="input-label">Master Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your master password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingRight: 44, fontSize: 16 }}
                  autoFocus
                />
                <button type="button" className="btn-icon" onClick={() => setShowPass(!showPass)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', border:'none' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, marginBottom: 20 }}
              >
                <AlertCircle size={14} color="var(--red)" />
                <span style={{ fontSize: 13, color: 'var(--red)' }}>{error}</span>
              </motion.div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }} disabled={loading || !password}>
              {loading
                ? <span className="animate-spin" style={{ display:'inline-block', width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%' }} />
                : <><Lock size={16} /> Unlock Vault</>
              }
            </button>
          </form>
        </motion.div>

        <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Shield size={13} color="var(--text-muted)" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Protected with AES-256-GCM + Argon2id</span>
        </div>
      </motion.div>
    </div>
  );
}
