import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldAlert, ShieldCheck, Key, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import EntryCard from '../components/EntryCard';

export default function HealthPage() {
  const { entries } = useVault();
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [activeTab, setActiveTab] = useState('weak'); // weak, reused, expiring

  const { score, weak, reused, expiring } = useMemo(() => {
    if (entries.length === 0) return { score: 100, weak: [], reused: [], expiring: [] };

    let totalScore = 0;
    const weakList = [];
    const passwordCounts = {};
    const expiringList = [];
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    entries.forEach(entry => {
      // 1. Calculate Score & Weak
      const s = entry.strength_score ?? 0;
      totalScore += (s / 4) * 100;
      if (s <= 1) weakList.push(entry);

      // 2. Count Reused
      if (entry.password) {
        passwordCounts[entry.password] = (passwordCounts[entry.password] || 0) + 1;
      }

      // 3. Expiring
      if (entry.expires_at) {
        const diff = new Date(entry.expires_at).getTime() - now;
        if (diff < thirtyDays) expiringList.push(entry);
      }
    });

    const avgScore = Math.round(totalScore / entries.length);
    const reusedList = entries.filter(e => e.password && passwordCounts[e.password] > 1);

    return { score: avgScore, weak: weakList, reused: reusedList, expiring: expiringList };
  }, [entries]);

  let activeList = [];
  if (activeTab === 'weak') activeList = weak;
  if (activeTab === 'reused') activeList = reused;
  if (activeTab === 'expiring') activeList = expiring;

  const scoreColor = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--yellow)' : 'var(--red)';
  const ScoreIcon = score >= 80 ? ShieldCheck : score >= 50 ? Shield : ShieldAlert;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, width: '100%', margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={22} color="var(--accent-light)" /> Security Health
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Monitor and improve the security of your vault</p>
      </div>

      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          No passwords in your vault yet to analyze.
        </div>
      ) : (
        <>
          {/* Top Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 32 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
              <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="54" fill="none" stroke="var(--bg-input)" strokeWidth="12" />
                  <motion.circle
                    cx="60" cy="60" r="54" fill="none"
                    stroke={scoreColor} strokeWidth="12" strokeLinecap="round"
                    strokeDasharray="339.29"
                    initial={{ strokeDashoffset: 339.29 }}
                    animate={{ strokeDashoffset: 339.29 - (339.29 * score) / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ 100</div>
                </div>
              </div>
              <div style={{ marginTop: 16, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ScoreIcon size={16} color={scoreColor} /> Overall Score
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateRows: 'repeat(3, 1fr)', gap: 10 }}>
              <div
                className={`card ${activeTab === 'weak' ? 'active' : ''}`}
                style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: activeTab === 'weak' ? '1px solid var(--accent)' : '' }}
                onClick={() => setActiveTab('weak')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={18} color="var(--red)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Weak Passwords</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Passwords that are easy to crack</div>
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: weak.length > 0 ? 'var(--red)' : 'var(--green)' }}>{weak.length}</div>
              </div>

              <div
                className={`card ${activeTab === 'reused' ? 'active' : ''}`}
                style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: activeTab === 'reused' ? '1px solid var(--accent)' : '' }}
                onClick={() => setActiveTab('reused')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RefreshCw size={18} color="var(--yellow)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Reused Passwords</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Same password used multiple times</div>
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: reused.length > 0 ? 'var(--yellow)' : 'var(--green)' }}>{reused.length}</div>
              </div>

              <div
                className={`card ${activeTab === 'expiring' ? 'active' : ''}`}
                style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: activeTab === 'expiring' ? '1px solid var(--accent)' : '' }}
                onClick={() => setActiveTab('expiring')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertCircle size={18} color="var(--blue)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Expiring Soon</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Passwords reaching their expiration date</div>
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: expiring.length > 0 ? 'var(--blue)' : 'var(--green)' }}>{expiring.length}</div>
              </div>
            </div>
          </div>

          {/* List Section */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, textTransform: 'capitalize' }}>
              {activeTab} Passwords ({activeList.length})
            </h2>
            
            {activeList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
                <ShieldCheck size={32} color="var(--green)" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>All good here!</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No {activeTab} passwords found.</p>
              </div>
            ) : (
              <AnimatePresence>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeList.map(entry => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      isSelected={selectedEntryId === entry.id}
                      onSelect={setSelectedEntryId}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>
        </>
      )}
    </div>
  );
}
