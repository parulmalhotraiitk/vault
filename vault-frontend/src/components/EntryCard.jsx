import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Eye, EyeOff, Edit2, Trash2, Star, StarOff, Globe, User, Key,
  FileText, Tag, Calendar, CheckCircle, Clock, ExternalLink, ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import EntryModal from './EntryModal';

function isExpiringSoon(expiresAt) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - Date.now();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= 30) return `${days}d`;
  return null;
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button className="btn-icon tooltip-wrap" onClick={handleCopy} title={`Copy ${label}`}>
      {copied ? <CheckCircle size={14} color="var(--green)" /> : <Copy size={14} />}
      <span className="tooltip">{copied ? 'Copied!' : `Copy ${label}`}</span>
    </button>
  );
}

export default function EntryCard({ entry, onSelect, isSelected }) {
  const { updateEntry, deleteEntry, getEntry } = useVault();
  const [fullEntry, setFullEntry] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const expiryStatus = isExpiringSoon(entry.expires_at);

  const handleExpand = async () => {
    if (isSelected) { onSelect(null); return; }
    onSelect(entry.id);
    if (!fullEntry) {
      setLoading(true);
      try {
        const data = await getEntry(entry.id);
        setFullEntry(data);
      } catch {}
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (e) => {
    e.stopPropagation();
    await updateEntry(entry.id, { favorite: !entry.favorite });
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
    await deleteEntry(entry.id);
  };

  const strengthColors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#10b981'];
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const score = entry.strength_score ?? 0;

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        style={{
          background: isSelected ? 'rgba(124,58,237,0.08)' : 'var(--bg-card)',
          border: isSelected ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
          backdropFilter: 'blur(20px)',
        }}
        onClick={handleExpand}
      >
        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 14 }}>
          {/* Category color dot / icon */}
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: `linear-gradient(135deg, ${strengthColors[score]}22, ${strengthColors[score]}11)`,
            border: `1px solid ${strengthColors[score]}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {entry.title.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {entry.title}
              </span>
              {entry.favorite && <Star size={12} color="var(--yellow)" fill="var(--yellow)" />}
              {expiryStatus && (
                <span style={{ fontSize: 11, color: expiryStatus === 'expired' ? 'var(--red)' : 'var(--yellow)', display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>
                  <AlertTriangle size={11} />
                  {expiryStatus === 'expired' ? 'Expired' : `Exp ${expiryStatus}`}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <User size={11} /> {entry.username || '—'}
              </span>
              {entry.url && (
                <span style={{ display:'flex', alignItems:'center', gap:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  <Globe size={11} /> {entry.url.replace(/^https?:\/\//, '').split('/')[0]}
                </span>
              )}
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {entry.category && (
              <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent-light)', border:'1px solid rgba(124,58,237,0.2)', fontSize:10 }}>
                {entry.category}
              </span>
            )}
            {/* Strength dot */}
            <div title={strengthLabels[score]} style={{ width:8, height:8, borderRadius:'50%', background:strengthColors[score], flexShrink:0 }} />
            <ChevronRight size={16} color="var(--text-muted)" style={{ transform: isSelected ? 'rotate(90deg)' : 'none', transition:'transform 0.2s' }} />
          </div>
        </div>

        {/* Expanded section */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
                {loading ? (
                  <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)', fontSize:14 }}>
                    <div className="animate-spin" style={{ display:'inline-block', width:20, height:20, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%' }} />
                  </div>
                ) : fullEntry ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {/* Username */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <User size={14} color="var(--text-muted)" />
                        <span style={{ fontSize:13, color:'var(--text-secondary)' }}>Username</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:14, color:'var(--text-primary)', fontWeight:500 }}>{fullEntry.username}</span>
                        <CopyButton text={fullEntry.username} label="username" />
                      </div>
                    </div>

                    {/* Password */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Key size={14} color="var(--text-muted)" />
                        <span style={{ fontSize:13, color:'var(--text-secondary)' }}>Password</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span className="password-text" style={{ fontSize:14, color:'var(--text-primary)', letterSpacing: showPassword ? '1px' : '4px' }}>
                          {showPassword ? fullEntry.password : '••••••••'}
                        </span>
                        <button className="btn-icon" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <CopyButton text={fullEntry.password} label="password" />
                      </div>
                    </div>

                    {/* URL */}
                    {fullEntry.url && (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <Globe size={14} color="var(--text-muted)" />
                          <span style={{ fontSize:13, color:'var(--text-secondary)' }}>Website</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:13, color:'var(--accent-light)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>{fullEntry.url}</span>
                          <a href={fullEntry.url.startsWith('http') ? fullEntry.url : `https://${fullEntry.url}`} target="_blank" rel="noopener noreferrer" className="btn-icon">
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {fullEntry.notes && (
                      <div style={{ padding:'10px 14px', background:'var(--bg-input)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                          <FileText size={12} color="var(--text-muted)" />
                          <span style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Notes</span>
                        </div>
                        <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{fullEntry.notes}</p>
                      </div>
                    )}

                    {/* Tags */}
                    {fullEntry.tags && fullEntry.tags.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {fullEntry.tags.map(t => <span key={t} className="tag">{t}</span>)}
                      </div>
                    )}

                    {/* Strength */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>Password Strength</span>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ display:'flex', gap:3 }}>
                          {[0,1,2,3,4].map(i => (
                            <div key={i} style={{ width:16, height:4, borderRadius:2, background: i <= score ? strengthColors[score] : 'var(--border)' }} />
                          ))}
                        </div>
                        <span style={{ fontSize:11, color:strengthColors[score] }}>{strengthLabels[score]}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleToggleFavorite({ stopPropagation: () => {} })}>
                        {entry.favorite ? <><StarOff size={14}/> Unfavorite</> : <><Star size={14}/> Favorite</>}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                        <Trash2 size={14} /> {confirmDelete ? 'Confirm Delete?' : 'Delete'}
                      </button>
                    </div>

                    <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', gap:16 }}>
                      <span><Clock size={10} style={{verticalAlign:'middle', marginRight:3}} />Created {new Date(entry.created_at).toLocaleDateString()}</span>
                      <span>Updated {new Date(entry.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {showEdit && fullEntry && (
        <EntryModal
          initialData={fullEntry}
          onClose={() => setShowEdit(false)}
          onSave={async (data) => {
            await updateEntry(entry.id, data);
            setFullEntry(null);
            setShowEdit(false);
          }}
        />
      )}
    </>
  );
}
