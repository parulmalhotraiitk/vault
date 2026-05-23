import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Star, Lock, Shield, Key, LayoutDashboard,
  ClipboardList, Settings, ChevronDown, LogOut, Zap, Grid,
  Bell, X, Download, Upload, Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import EntryCard from '../components/EntryCard';
import EntryModal from '../components/EntryModal';
import AuditPage from './AuditPage';
import SettingsPage from './SettingsPage';
import HealthPage from './HealthPage';

function Sidebar({ activeView, setActiveView, categories }) {
  const { lockVault } = useAuth();
  const { selectedCategory, setSelectedCategory, showFavoritesOnly, setShowFavoritesOnly, entries } = useVault();

  const navItems = [
    { id: 'vault', icon: <Key size={16} />, label: 'All Passwords', count: entries.length },
    { id: 'favorites', icon: <Star size={16} />, label: 'Favorites', count: entries.filter(e => e.favorite).length },
    { id: 'health', icon: <Shield size={16} />, label: 'Security Health' },
    { id: 'audit', icon: <ClipboardList size={16} />, label: 'Audit Log' },
    { id: 'settings', icon: <Settings size={16} />, label: 'Settings' },
  ];

  return (
    <div style={{
      width: 240, flexShrink: 0, height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', padding: '20px 12px',
      position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px', marginBottom: 28 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'linear-gradient(135deg, var(--accent), #6d28d9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px var(--accent-glow)',
        }}>
          <Shield size={18} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Vault</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: -2 }}>SECURE & LOCAL</div>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 8px', marginBottom: 6 }}>Navigation</div>
        {navItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveView(item.id);
              if (item.id === 'favorites') { setShowFavoritesOnly(true); setSelectedCategory(null); }
              else if (item.id === 'vault') { setShowFavoritesOnly(false); setSelectedCategory(null); }
            }}
          >
            {item.icon}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.count !== undefined && (
              <span style={{ fontSize: 11, background: 'var(--bg-input)', padding: '1px 7px', borderRadius: 999, color: 'var(--text-muted)' }}>
                {item.count}
              </span>
            )}
          </button>
        ))}

        {/* Categories */}
        {categories.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '12px 8px 6px' }}>Categories</div>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`sidebar-item ${selectedCategory === cat.name && activeView === 'vault' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(cat.name === selectedCategory ? null : cat.name);
                  setShowFavoritesOnly(false);
                  setActiveView('vault');
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{cat.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.count}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Lock button */}
      <button
        className="btn btn-ghost"
        style={{ width: '100%', marginTop: 16, color: 'var(--red)', borderColor: 'rgba(239,68,68,0.2)', gap: 8 }}
        onClick={lockVault}
      >
        <Lock size={15} /> Lock Vault
      </button>
    </div>
  );
}

function ExpiryBanner({ entries }) {
  const [dismissed, setDismissed] = useState(false);
  const now = Date.now();
  const expiring = entries.filter(e => {
    if (!e.expires_at) return false;
    const diff = new Date(e.expires_at) - now;
    return diff < 30 * 24 * 60 * 60 * 1000;
  });

  if (dismissed || expiring.length === 0) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
      style={{
        background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <Bell size={15} color="var(--yellow)" />
      <span style={{ fontSize: 13, color: 'var(--yellow)', flex: 1 }}>
        <strong>{expiring.length}</strong> password{expiring.length > 1 ? 's are' : ' is'} expiring soon
      </span>
      <button className="btn-icon" onClick={() => setDismissed(true)} style={{ width: 24, height: 24 }}><X size={13} /></button>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { entries, categories, loading, filteredEntries, searchQuery, setSearchQuery, loadEntries, loadCategories, createEntry, showFavoritesOnly, selectedCategory } = useVault();
  const [activeView, setActiveView] = useState('vault');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [sortBy, setSortBy] = useState('updated');

  useEffect(() => {
    loadEntries();
    loadCategories();
  }, []);

  const handleAddEntry = async (data) => {
    await createEntry(data);
    setShowAddModal(false);
  };

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortBy === 'updated') return new Date(b.updated_at) - new Date(a.updated_at);
    if (sortBy === 'name') return a.title.localeCompare(b.title);
    if (sortBy === 'strength') return (b.strength_score ?? 0) - (a.strength_score ?? 0);
    return 0;
  });

  const strongCount = entries.filter(e => (e.strength_score ?? 0) >= 3).length;
  const weakCount = entries.filter(e => (e.strength_score ?? 0) <= 1).length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar activeView={activeView} setActiveView={setActiveView} categories={categories} />

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {activeView === 'audit' && <AuditPage />}
        {activeView === 'settings' && <SettingsPage />}
        {activeView === 'health' && <HealthPage />}

        {(activeView === 'vault' || activeView === 'favorites') && (
          <div style={{ padding: '28px 32px', maxWidth: 900, width: '100%', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
                  {showFavoritesOnly ? '⭐ Favorites' : selectedCategory ? `📁 ${selectedCategory}` : '🔐 All Passwords'}
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
                  {searchQuery && ` matching "${searchQuery}"`}
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                <Plus size={16} /> New Entry
              </button>
            </div>

            {/* Stats bar */}
            {entries.length > 0 && !searchQuery && !selectedCategory && !showFavoritesOnly && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Total', value: entries.length, color: 'var(--accent)', icon: <Key size={14} />, onClick: () => setActiveView('vault') },
                  { label: 'Strong', value: strongCount, color: 'var(--green)', icon: <Shield size={14} />, onClick: () => setActiveView('health') },
                  { label: 'Weak', value: weakCount, color: weakCount > 0 ? 'var(--red)' : 'var(--text-muted)', icon: <Zap size={14} />, onClick: () => setActiveView('health') },
                ].map(stat => (
                  <div key={stat.label} onClick={stat.onClick} style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10,
                    backdropFilter: 'blur(20px)', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
                  }} className="card-hover">
                    <div style={{ color: stat.color }}>{stat.icon}</div>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ExpiryBanner entries={entries} />

            {/* Search + Sort */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  className="input"
                  placeholder="Search passwords, usernames, URLs..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 42, borderRadius: 'var(--radius-md)' }}
                />
                {searchQuery && (
                  <button className="btn-icon" onClick={() => setSearchQuery('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <select
                className="input"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ width: 160, cursor: 'pointer', paddingRight: 12 }}
              >
                <option value="updated">Recently Updated</option>
                <option value="name">Name A–Z</option>
                <option value="strength">Strongest First</option>
              </select>
            </div>

            {/* Entry list */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <div className="animate-spin" style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', marginBottom: 16 }} />
                <p>Loading vault...</p>
              </div>
            ) : sortedEntries.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                  {searchQuery ? 'No matching passwords' : 'No passwords yet'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
                  {searchQuery ? 'Try a different search term' : 'Add your first password to get started'}
                </p>
                {!searchQuery && (
                  <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={16} /> Add First Password
                  </button>
                )}
              </motion.div>
            ) : (
              <AnimatePresence>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sortedEntries.map(entry => (
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
        )}
      </div>

      {showAddModal && (
        <EntryModal onClose={() => setShowAddModal(false)} onSave={handleAddEntry} />
      )}
    </div>
  );
}
