import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Shield, Lock, Eye, Key, LogIn, LogOut, Plus, Trash2, Download, RefreshCw } from 'lucide-react';
import { utilApi } from '../api';

const ACTION_ICONS = {
  ENTRY_CREATED: <Plus size={14} color="#10b981" />,
  ENTRY_VIEWED:  <Eye size={14} color="#3b82f6" />,
  ENTRY_UPDATED: <Key size={14} color="#f59e0b" />,
  ENTRY_DELETED: <Trash2 size={14} color="#ef4444" />,
  VAULT_UNLOCKED: <LogIn size={14} color="#10b981" />,
  VAULT_LOCKED:   <LogOut size={14} color="#7c3aed" />,
  VAULT_CREATED:  <Shield size={14} color="#10b981" />,
  VAULT_EXPORTED: <Download size={14} color="#3b82f6" />,
  UNLOCK_FAILED:  <Lock size={14} color="#ef4444" />,
};

const ACTION_COLORS = {
  ENTRY_CREATED: '#10b981',
  ENTRY_VIEWED:  '#3b82f6',
  ENTRY_UPDATED: '#f59e0b',
  ENTRY_DELETED: '#ef4444',
  VAULT_UNLOCKED: '#10b981',
  VAULT_LOCKED:   '#7c3aed',
  VAULT_CREATED:  '#10b981',
  VAULT_EXPORTED: '#3b82f6',
  UNLOCK_FAILED:  '#ef4444',
};

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function groupByDate(logs) {
  const groups = {};
  logs.forEach(log => {
    const date = new Date(log.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!groups[date]) groups[date] = [];
    groups[date].push(log);
  });
  return groups;
}

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const res = await utilApi.getAudit();
      setLogs(res.data.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const actionTypes = ['ALL', ...new Set(logs.map(l => l.action))];
  const filtered = filter === 'ALL' ? logs : logs.filter(l => l.action === filter);
  const grouped = groupByDate(filtered);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={22} color="var(--accent-light)" /> Audit Log
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{logs.length} recorded actions</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {actionTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            style={{
              padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: filter === type ? 'var(--accent-dim)' : 'var(--bg-input)',
              border: filter === type ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border)',
              color: filter === type ? 'var(--accent-light)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="animate-spin" style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <ClipboardList size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>No audit events yet</p>
        </div>
      ) : (
        <div>
          {Object.entries(grouped).map(([date, dateLogs]) => (
            <div key={date} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                {date}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {dateLogs.map((log, i) => {
                  const color = ACTION_COLORS[log.action] || 'var(--text-muted)';
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 16px', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        backdropFilter: 'blur(20px)',
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: `${color}18`, border: `1px solid ${color}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {ACTION_ICONS[log.action] || <Shield size={14} />}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          {log.entry_title && (
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              — {log.entry_title}
                            </span>
                          )}
                        </div>
                        {log.details && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{log.details}</div>
                        )}
                      </div>

                      {/* Time */}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {formatTime(log.timestamp)}
                      </span>

                      {/* Color bar */}
                      <div style={{ width: 3, height: 28, borderRadius: 2, background: color, flexShrink: 0 }} />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
