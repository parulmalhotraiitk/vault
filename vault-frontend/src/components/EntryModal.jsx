import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, RefreshCw, Copy, CheckCircle, Sliders } from 'lucide-react';
import { utilApi } from '../api';

function StrengthMeter({ score }) {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#10b981'];
  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display:'flex', gap:4 }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{ flex:1, height:4, borderRadius:2, background: i <= score ? colors[score] : 'var(--border)', transition:'background 0.3s' }} />
        ))}
      </div>
      <div style={{ fontSize:11, color: colors[score], marginTop:4 }}>{labels[score]}</div>
    </div>
  );
}

export default function EntryModal({ onClose, onSave, initialData }) {
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    title: initialData?.title || '',
    username: initialData?.username || '',
    password: initialData?.password || '',
    url: initialData?.url || '',
    notes: initialData?.notes || '',
    category: initialData?.category || '',
    tags: initialData?.tags?.join(', ') || '',
    favorite: initialData?.favorite || false,
    expires_at: initialData?.expires_at ? initialData.expires_at.split('T')[0] : '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [strengthScore, setStrengthScore] = useState(initialData?.strength_score ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);

  // Generator state
  const [genOpts, setGenOpts] = useState({ length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true, exclude_ambiguous: false });
  const [generatedPwd, setGeneratedPwd] = useState('');
  const [genStrength, setGenStrength] = useState(0);
  const [copied, setCopied] = useState(false);

  const checkStrength = useCallback(async (pwd) => {
    if (!pwd) { setStrengthScore(0); return; }
    try {
      const res = await utilApi.checkStrength(pwd);
      setStrengthScore(res.data.data.score);
    } catch {
      let s = 0;
      if (pwd.length >= 8) s++;
      if (pwd.length >= 12) s++;
      if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
      if (/[0-9]/.test(pwd)) s++;
      if (/[^A-Za-z0-9]/.test(pwd)) s++;
      setStrengthScore(Math.min(4, s));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => checkStrength(form.password), 300);
    return () => clearTimeout(timer);
  }, [form.password, checkStrength]);

  const generatePassword = useCallback(async () => {
    try {
      const res = await utilApi.generate(genOpts);
      const pwd = res.data.data.password;
      setGeneratedPwd(pwd);
      setGenStrength(res.data.data.strength_score);
    } catch {}
  }, [genOpts]);

  useEffect(() => { if (showGenerator) generatePassword(); }, [showGenerator, generatePassword]);

  const useGeneratedPassword = () => {
    setForm(f => ({ ...f, password: generatedPwd }));
    setShowGenerator(false);
  };

  const handleCopyGenerated = async () => {
    await navigator.clipboard.writeText(generatedPwd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.password.trim()) { setError('Password is required'); return; }
    setLoading(true);
    setError('');
    try {
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      await onSave({
        ...form,
        tags,
        expires_at: form.expires_at || null,
      });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save entry');
    }
    setLoading(false);
  };

  const categories = ['Social', 'Finance', 'Work', 'Email', 'Shopping', 'Other'];

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal-container"
      >
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h2 style={{ fontSize:18, fontWeight:700 }}>{isEdit ? 'Edit Entry' : 'New Password Entry'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {!showGenerator ? (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Title */}
            <div className="input-group">
              <label className="input-label">Title *</label>
              <input className="input" placeholder="e.g. Gmail, GitHub..." value={form.title} onChange={e => setForm(f=>({...f, title:e.target.value}))} autoFocus />
            </div>

            {/* Username */}
            <div className="input-group">
              <label className="input-label">Username / Email</label>
              <input className="input" placeholder="username@email.com" value={form.username} onChange={e => setForm(f=>({...f, username:e.target.value}))} />
            </div>

            {/* Password */}
            <div className="input-group">
              <label className="input-label" style={{ display:'flex', justifyContent:'space-between' }}>
                <span>Password *</span>
                <button style={{ color:'var(--accent-light)', fontSize:11, background:'none', border:'none', cursor:'pointer', fontWeight:600 }} onClick={() => setShowGenerator(true)}>
                  <Sliders size={11} style={{verticalAlign:'middle', marginRight:4}} />Generate
                </button>
              </label>
              <div style={{ position:'relative' }}>
                <input
                  className="input password-text"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter or generate a password"
                  value={form.password}
                  onChange={e => setForm(f=>({...f, password:e.target.value}))}
                  style={{ paddingRight: 44 }}
                />
                <button className="btn-icon" onClick={() => setShowPassword(!showPassword)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)' }}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              {form.password && <StrengthMeter score={strengthScore} />}
            </div>

            {/* URL */}
            <div className="input-group">
              <label className="input-label">Website URL</label>
              <input className="input" placeholder="https://example.com" value={form.url} onChange={e => setForm(f=>({...f, url:e.target.value}))} />
            </div>

            {/* Category */}
            <div className="input-group">
              <label className="input-label">Category</label>
              <select className="input" value={form.category} onChange={e => setForm(f=>({...f, category:e.target.value}))} style={{ cursor:'pointer' }}>
                <option value="">— None —</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Tags */}
            <div className="input-group">
              <label className="input-label">Tags (comma separated)</label>
              <input className="input" placeholder="personal, important, 2fa..." value={form.tags} onChange={e => setForm(f=>({...f, tags:e.target.value}))} />
            </div>

            {/* Expiry */}
            <div className="input-group">
              <label className="input-label">Expires On</label>
              <input className="input" type="date" value={form.expires_at} onChange={e => setForm(f=>({...f, expires_at:e.target.value}))} />
            </div>

            {/* Notes */}
            <div className="input-group">
              <label className="input-label">Notes</label>
              <textarea className="input" placeholder="Any additional notes..." value={form.notes} onChange={e => setForm(f=>({...f, notes:e.target.value}))} style={{ minHeight:80, resize:'vertical' }} />
            </div>

            {/* Favorite */}
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'10px 14px', background:'var(--bg-input)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
              <input type="checkbox" checked={form.favorite} onChange={e => setForm(f=>({...f, favorite:e.target.checked}))} />
              <span style={{ fontSize:14, color:'var(--text-secondary)' }}>⭐ Mark as favorite</span>
            </label>

            {error && <div style={{ color:'var(--red)', fontSize:13, display:'flex', gap:6, alignItems:'center' }}>⚠ {error}</div>}

            <div style={{ display:'flex', gap:12, marginTop:8 }}>
              <button className="btn btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ flex:2 }}>
                {loading ? '...' : isEdit ? '✓ Save Changes' : '+ Add Entry'}
              </button>
            </div>
          </div>
        ) : (
          /* Password Generator Panel */
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:16, fontWeight:600 }}>Password Generator</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowGenerator(false)}>← Back</button>
            </div>

            {/* Generated password display */}
            <div style={{ padding:'16px 20px', background:'var(--bg-input)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <span className="password-text" style={{ fontSize:15, color:'var(--text-primary)', wordBreak:'break-all', flex:1 }}>{generatedPwd}</span>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button className="btn-icon" onClick={handleCopyGenerated}>{copied ? <CheckCircle size={16} color="var(--green)" /> : <Copy size={16} />}</button>
                <button className="btn-icon" onClick={generatePassword}><RefreshCw size={16} /></button>
              </div>
            </div>

            <StrengthMeter score={genStrength} />

            <div style={{ display:'flex', flexDirection:'column', gap:14, margin:'20px 0' }}>
              {/* Length */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <label className="input-label" style={{ textTransform:'none', fontSize:14, fontWeight:500, color:'var(--text-secondary)' }}>Length: <strong style={{ color:'var(--text-primary)' }}>{genOpts.length}</strong></label>
                <input type="range" min={8} max={64} value={genOpts.length} onChange={e => setGenOpts(g=>({...g, length:+e.target.value}))} style={{ width:200, accentColor:'var(--accent)' }} />
              </div>

              {[
                ['uppercase', 'A–Z Uppercase'],
                ['lowercase', 'a–z Lowercase'],
                ['numbers', '0–9 Numbers'],
                ['symbols', '!@# Symbols'],
                ['exclude_ambiguous', 'Exclude ambiguous (0,O,l,I)'],
              ].map(([key, label]) => (
                <label key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                  <span style={{ fontSize:14, color:'var(--text-secondary)' }}>{label}</span>
                  <input type="checkbox" checked={genOpts[key]} onChange={e => setGenOpts(g=>({...g, [key]:e.target.checked}))} style={{ width:16, height:16, accentColor:'var(--accent)', cursor:'pointer' }} />
                </label>
              ))}
            </div>

            <div style={{ display:'flex', gap:12 }}>
              <button className="btn btn-ghost" onClick={generatePassword} style={{ flex:1 }}>
                <RefreshCw size={14} /> Regenerate
              </button>
              <button className="btn btn-primary" onClick={useGeneratedPassword} style={{ flex:2 }}>
                Use This Password
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
