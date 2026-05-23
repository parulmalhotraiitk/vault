import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function StrengthBar({ password }) {
  const [score, setScore] = useState(0);
  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#10b981'];

  useEffect(() => {
    if (!password) { setScore(0); return; }
    // Simple local estimate
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    setScore(Math.min(4, s));
  }, [password]);

  if (!password) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div className="strength-bar">
        {[0,1,2,3,4].map(i => (
          <div
            key={i}
            className="strength-segment"
            style={{ background: i <= score ? colors[score] : 'var(--border)', transition: 'background 0.3s' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span className="strength-label-text">{labels[score]}</span>
        <span className="strength-label-text">{password.length} chars</span>
      </div>
    </div>
  );
}

export default function SetupPage() {
  const { setup } = useAuth();
  const [step, setStep] = useState(1); // 1=create, 2=confirm, 3=done
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number or symbol', met: /[0-9!@#$%^&*]/.test(password) },
  ];

  const allMet = requirements.every(r => r.met);

  const handleCreate = () => {
    if (!allMet) { setError('Please meet all password requirements'); return; }
    setError('');
    setStep(2);
  };

  const handleConfirm = async () => {
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await setup(password);
    } catch (e) {
      setError(e.response?.data?.error || 'Setup failed');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 60% 0%, rgba(124,58,237,0.15) 0%, transparent 60%), var(--bg-base)',
      padding: 24,
    }}>
      {/* Decorative blobs */}
      <div style={{ position:'fixed', top:'-10%', right:'-5%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:'-10%', left:'-5%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', pointerEvents:'none' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 480 }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <motion.div
            animate={{ boxShadow: ['0 0 20px rgba(124,58,237,0.3)', '0 0 40px rgba(124,58,237,0.5)', '0 0 20px rgba(124,58,237,0.3)'] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 72, height: 72, borderRadius: 20,
              background: 'linear-gradient(135deg, var(--accent), #6d28d9)',
              marginBottom: 20,
            }}
          >
            <Shield size={36} color="white" />
          </motion.div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, background: 'linear-gradient(135deg, #f1f0ff, var(--accent-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Welcome to Vault
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
            {step === 1 ? 'Create your master password to begin' : 'Confirm your master password'}
          </p>
        </div>

        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--accent), var(--blue))' }} />

          {/* Progress steps */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
            {[1, 2].map(s => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? 'linear-gradient(90deg, var(--accent), var(--accent-light))' : 'var(--border)', transition: 'background 0.3s' }} />
            ))}
          </div>

          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Master Password</label>
                <div className="input-with-action" style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Create a strong master password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ paddingRight: 44 }}
                    autoFocus
                  />
                  <button className="btn-icon input-action" onClick={() => setShowPass(!showPass)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)' }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <StrengthBar password={password} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {requirements.map((req, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle size={14} color={req.met ? 'var(--green)' : 'var(--text-muted)'} />
                    <span style={{ fontSize: 13, color: req.met ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{req.label}</span>
                  </div>
                ))}
              </div>

              {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center' }}><AlertCircle size={14} />{error}</div>}

              <button className="btn btn-primary" style={{ width: '100%', padding: '14px' }} onClick={handleCreate} disabled={!password}>
                Continue <ArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="input-group" style={{ marginBottom: 24 }}>
                <label className="input-label">Confirm Master Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-enter your master password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    style={{ paddingRight: 44 }}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                  />
                  <button className="btn-icon" onClick={() => setShowConfirm(!showConfirm)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)' }}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="card" style={{ padding: 16, marginBottom: 24, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertCircle size={16} color="var(--accent-light)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Important:</strong> Your master password cannot be recovered. Store it somewhere safe. All passwords are encrypted with this key.
                  </p>
                </div>
              </div>

              {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center' }}><AlertCircle size={14} />{error}</div>}

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-ghost" onClick={() => { setStep(1); setError(''); setConfirm(''); }} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={handleConfirm} disabled={loading || !confirm} style={{ flex: 2, padding: '14px' }}>
                  {loading ? <span className="animate-spin" style={{ display:'inline-block', width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%' }} /> : <><Lock size={16} /> Create Vault</>}
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
          🔒 All data is encrypted locally and never leaves your device
        </p>
      </motion.div>
    </div>
  );
}
