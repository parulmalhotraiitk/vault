import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, Clock, Download, Key, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { utilApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';

export default function SettingsPage() {
  const { lockVault, autoLockMins, setAutoLockMins } = useAuth();
  const { loadEntries, loadCategories } = useVault();
  
  const [exportPassword, setExportPassword] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);

  const [importFile, setImportFile] = useState(null);
  const [importPassword, setImportPassword] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  const handleExport = async () => {
    if (!exportPassword) return;
    setExportLoading(true);
    setExportMsg(null);
    try {
      const res = await utilApi.exportVault(exportPassword);
      const data = res.data.data;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg({ type: 'success', text: 'Vault exported successfully!' });
      setExportPassword('');
    } catch (e) {
      setExportMsg({ type: 'error', text: e.response?.data?.error || 'Export failed' });
    }
    setExportLoading(false);
  };

  const handleImport = async () => {
    if (!importFile || !importPassword) return;
    setImportLoading(true);
    setImportMsg(null);
    try {
      const text = await importFile.text();
      const parsed = JSON.parse(text);
      if (!parsed.salt || !parsed.data) throw new Error('Invalid backup file format');
      
      const res = await utilApi.importVault({
        export_password: importPassword,
        salt: parsed.salt,
        data: parsed.data,
      });
      const { imported, skipped } = res.data.data;
      setImportMsg({ type: 'success', text: `Imported ${imported} entries (skipped ${skipped})` });
      setImportFile(null);
      setImportPassword('');
      await loadEntries();
      await loadCategories();
    } catch (e) {
      setImportMsg({ type: 'error', text: e.response?.data?.error || e.message || 'Import failed' });
    }
    setImportLoading(false);
  };

  const sections = [
    {
      title: 'Security',
      icon: <Shield size={16} color="var(--accent-light)" />,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>Encryption</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>AES-256-GCM with per-entry nonces</div>
            </div>
            <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>Active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>Key Derivation</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Argon2id (64MB memory, 3 iterations)</div>
            </div>
            <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>Active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>Session Tokens</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>JWT HS256, 1-hour expiry</div>
            </div>
            <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>Active</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Auto-Lock',
      icon: <Clock size={16} color="var(--accent-light)" />,
      content: (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Automatically lock the vault after a period of inactivity.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <input
              type="range" min={1} max={60} value={autoLockMins}
              onChange={e => setAutoLockMins(+e.target.value)}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', minWidth: 80 }}>
              {autoLockMins} {autoLockMins === 1 ? 'minute' : 'minutes'}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Note: The inactivity timeout is set to 5 minutes by default in the app.
          </p>
        </div>
      ),
    },
    {
      title: 'Export Backup',
      icon: <Download size={16} color="var(--accent-light)" />,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '12px 16px', background: 'rgba(124,58,237,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle size={15} color="var(--accent-light)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              The export will be encrypted with your chosen password. Store it securely. You can use it to restore your vault.
            </p>
          </div>
          <div className="input-group">
            <label className="input-label">Export Password</label>
            <input
              className="input" type="password"
              placeholder="Choose a password for the backup file"
              value={exportPassword}
              onChange={e => setExportPassword(e.target.value)}
            />
          </div>
          {exportMsg && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: exportMsg.type === 'success' ? 'var(--green)' : 'var(--red)' }}>
              {exportMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {exportMsg.text}
            </div>
          )}
          <button className="btn btn-primary" onClick={handleExport} disabled={!exportPassword || exportLoading} style={{ alignSelf: 'flex-start' }}>
            {exportLoading ? '...' : <><Download size={14} /> Export Encrypted Backup</>}
          </button>
        </div>
      ),
    },
    {
      title: 'Import Backup',
      icon: <Download size={16} color="var(--green)" style={{ transform: 'rotate(180deg)' }} />,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Select an encrypted JSON backup file and provide its password to restore your entries.
          </p>
          <div className="input-group">
            <label className="input-label">Backup File</label>
            <input
              type="file"
              accept=".json"
              className="input"
              style={{ padding: '8px' }}
              onChange={e => setImportFile(e.target.files[0])}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Backup Password</label>
            <input
              className="input" type="password"
              placeholder="Password used during export"
              value={importPassword}
              onChange={e => setImportPassword(e.target.value)}
            />
          </div>
          {importMsg && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: importMsg.type === 'success' ? 'var(--green)' : 'var(--red)' }}>
              {importMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {importMsg.text}
            </div>
          )}
          <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, var(--green), #059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)', alignSelf: 'flex-start' }} onClick={handleImport} disabled={!importFile || !importPassword || importLoading}>
            {importLoading ? '...' : <><Download size={14} style={{ transform: 'rotate(180deg)' }} /> Import Vault</>}
          </button>
        </div>
      ),
    },
    {
      title: 'Danger Zone',
      icon: <Lock size={16} color="var(--red)" />,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Lock the vault immediately and return to the login screen.</p>
          <button className="btn btn-danger" onClick={lockVault} style={{ alignSelf: 'flex-start' }}>
            <Lock size={14} /> Lock Vault Now
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 700, width: '100%', margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={22} color="var(--accent-light)" /> Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Manage your vault configuration and security</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="card"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              {section.icon}
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{section.title}</h2>
            </div>
            {section.content}
          </motion.div>
        ))}
      </div>

      {/* Version info */}
      <div style={{ marginTop: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        <Shield size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Vault v1.0.0 — AES-256-GCM + Argon2id — All data stored locally
      </div>
    </div>
  );
}
