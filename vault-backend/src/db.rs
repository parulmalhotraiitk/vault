use rusqlite::{Connection, Result, params};
use std::path::Path;

pub fn get_db_path() -> String {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    format!("{}/.vault/vault.db", home)
}

pub fn initialize_db(db_path: &str) -> Result<()> {
    // Ensure directory exists
    if let Some(parent) = Path::new(db_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let conn = Connection::open(db_path)?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS vault_meta (
            id INTEGER PRIMARY KEY,
            master_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS entries (
            id TEXT PRIMARY KEY,
            encrypted_data TEXT NOT NULL,
            category TEXT,
            tags TEXT,
            favorite INTEGER NOT NULL DEFAULT 0,
            expires_at TEXT,
            strength_score INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#7c3aed',
            icon TEXT NOT NULL DEFAULT 'folder',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            entry_id TEXT,
            entry_title TEXT,
            details TEXT,
            timestamp TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
        CREATE INDEX IF NOT EXISTS idx_entries_favorite ON entries(favorite);
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
        ",
    )?;

    // Insert default categories if none exist
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM categories",
        [],
        |row| row.get(0),
    )?;

    if count == 0 {
        let now = chrono::Utc::now().to_rfc3339();
        let defaults = vec![
            (uuid::Uuid::new_v4().to_string(), "Social", "#3b82f6", "users"),
            (uuid::Uuid::new_v4().to_string(), "Finance", "#10b981", "credit-card"),
            (uuid::Uuid::new_v4().to_string(), "Work", "#f59e0b", "briefcase"),
            (uuid::Uuid::new_v4().to_string(), "Email", "#ef4444", "mail"),
            (uuid::Uuid::new_v4().to_string(), "Shopping", "#8b5cf6", "shopping-bag"),
            (uuid::Uuid::new_v4().to_string(), "Other", "#6b7280", "folder"),
        ];
        for (id, name, color, icon) in defaults {
            conn.execute(
                "INSERT OR IGNORE INTO categories (id, name, color, icon, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, name, color, icon, now],
            )?;
        }
    }

    Ok(())
}

pub fn open_connection(db_path: &str) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}
