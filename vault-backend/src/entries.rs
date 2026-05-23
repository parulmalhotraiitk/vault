use actix_web::{web, HttpRequest, HttpResponse};
use rusqlite::params;
use serde_json;

use crate::auth::{validate_token, AppState};
use crate::crypto;
use crate::db;
use crate::models::*;

fn require_auth(req: &HttpRequest, state: &AppState) -> Option<[u8; 32]> {
    let secret_guard = state.jwt_secret.lock().unwrap();
    let key_guard = state.encryption_key.lock().unwrap();
    match (&*secret_guard, &*key_guard) {
        (Some(secret), Some(key)) => {
            if validate_token(req, secret) {
                Some(*key)
            } else {
                None
            }
        }
        _ => None,
    }
}

// GET /api/entries
pub async fn list_entries(data: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
    let enc_key = match require_auth(&req, &data) {
        Some(k) => k,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized")),
    };

    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e.to_string())),
    };

    let mut stmt = conn
        .prepare(
            "SELECT id, encrypted_data, category, tags, favorite, expires_at, strength_score, created_at, updated_at FROM entries ORDER BY favorite DESC, updated_at DESC",
        )
        .unwrap();

    let entries: Vec<EntryMeta> = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let encrypted_data: String = row.get(1)?;
            let category: Option<String> = row.get(2)?;
            let tags_str: Option<String> = row.get(3)?;
            let favorite: i32 = row.get(4)?;
            let expires_at: Option<String> = row.get(5)?;
            let strength_score: Option<i32> = row.get(6)?;
            let created_at: String = row.get(7)?;
            let updated_at: String = row.get(8)?;

            let tags = tags_str.and_then(|s| serde_json::from_str(&s).ok());
            
            let decrypted = crypto::decrypt(&encrypted_data, &enc_key).unwrap_or_default();
            let partial: serde_json::Value = serde_json::from_str(&decrypted).unwrap_or_default();

            Ok(EntryMeta {
                id,
                title: partial["title"].as_str().unwrap_or("").to_string(),
                username: partial["username"].as_str().unwrap_or("").to_string(),
                url: partial["url"].as_str().map(|s| s.to_string()),
                category,
                tags,
                favorite: favorite == 1,
                expires_at,
                strength_score: strength_score.map(|v| v as u8),
                created_at,
                updated_at,
            })
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    HttpResponse::Ok().json(ApiResponse::success(entries))
}

// GET /api/entries/:id
pub async fn get_entry(
    data: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<String>,
) -> HttpResponse {
    let enc_key = match require_auth(&req, &data) {
        Some(k) => k,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized")),
    };

    let id = path.into_inner();
    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e.to_string())),
    };

    let result: rusqlite::Result<(String, String, String, i32, Option<String>, Option<String>, i32, Option<String>)> = conn.query_row(
        "SELECT encrypted_data, created_at, updated_at, favorite, category, tags, strength_score, expires_at FROM entries WHERE id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get::<_, i32>(3)?, row.get(4)?, row.get(5)?, row.get::<_, i32>(6)?, row.get(7)?)),
    );

    let (encrypted_data, created_at, updated_at, favorite, category, tags_str, strength_score, expires_at) = match result {
        Ok(r) => r,
        Err(_) => return HttpResponse::NotFound().json(ApiResponse::<()>::error("Entry not found")),
    };

    let decrypted = match crypto::decrypt(&encrypted_data, &enc_key) {
        Ok(d) => d,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e)),
    };

    let partial: serde_json::Value = match serde_json::from_str(&decrypted) {
        Ok(v) => v,
        Err(_) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error("Corrupted entry data")),
    };

    let tags: Option<Vec<String>> = tags_str.and_then(|s| serde_json::from_str(&s).ok());

    let entry = Entry {
        id: id.clone(),
        title: partial["title"].as_str().unwrap_or("").to_string(),
        username: partial["username"].as_str().unwrap_or("").to_string(),
        password: partial["password"].as_str().unwrap_or("").to_string(),
        url: partial["url"].as_str().map(|s| s.to_string()),
        notes: partial["notes"].as_str().map(|s| s.to_string()),
        category,
        tags,
        favorite: favorite == 1,
        expires_at,
        created_at,
        updated_at,
        strength_score: Some(strength_score as u8),
    };

    // Log access
    conn.execute(
        "INSERT INTO audit_log (action, entry_id, entry_title, timestamp) VALUES (?1, ?2, ?3, ?4)",
        params!["ENTRY_VIEWED", id, entry.title, chrono::Utc::now().to_rfc3339()],
    ).ok();

    HttpResponse::Ok().json(ApiResponse::success(entry))
}

// POST /api/entries
pub async fn create_entry(
    data: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<CreateEntryRequest>,
) -> HttpResponse {
    let enc_key = match require_auth(&req, &data) {
        Some(k) => k,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized")),
    };

    if body.title.is_empty() {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::error("Title is required"));
    }

    let strength_score = calculate_strength(&body.password);
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let sensitive = serde_json::json!({
        "title": body.title,
        "username": body.username,
        "password": body.password,
        "url": body.url,
        "notes": body.notes,
    });

    let encrypted = match crypto::encrypt(&sensitive.to_string(), &enc_key) {
        Ok(e) => e,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e)),
    };

    let tags_json = body.tags.as_ref().map(|t| serde_json::to_string(t).unwrap());
    let favorite = body.favorite.unwrap_or(false) as i32;

    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e.to_string())),
    };

    conn.execute(
        "INSERT INTO entries (id, encrypted_data, category, tags, favorite, expires_at, strength_score, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            id, encrypted, body.category, tags_json,
            favorite, body.expires_at,
            strength_score as i32, now, now
        ],
    ).unwrap();

    conn.execute(
        "INSERT INTO audit_log (action, entry_id, entry_title, timestamp) VALUES (?1, ?2, ?3, ?4)",
        params!["ENTRY_CREATED", id, body.title, now],
    ).ok();

    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": id, "created_at": now})))
}

// PUT /api/entries/:id
pub async fn update_entry(
    data: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<String>,
    body: web::Json<UpdateEntryRequest>,
) -> HttpResponse {
    let enc_key = match require_auth(&req, &data) {
        Some(k) => k,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized")),
    };

    let id = path.into_inner();
    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e.to_string())),
    };

    // Get existing entry
    let result: rusqlite::Result<(String, i32, Option<String>, Option<String>, Option<String>)> = conn.query_row(
        "SELECT encrypted_data, favorite, category, tags, expires_at FROM entries WHERE id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
    );

    let (encrypted_data, old_favorite, old_category, old_tags, old_expires) = match result {
        Ok(r) => r,
        Err(_) => return HttpResponse::NotFound().json(ApiResponse::<()>::error("Entry not found")),
    };

    let decrypted = match crypto::decrypt(&encrypted_data, &enc_key) {
        Ok(d) => d,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e)),
    };

    let mut existing: serde_json::Value = serde_json::from_str(&decrypted).unwrap_or_default();

    if let Some(ref title) = body.title { existing["title"] = serde_json::json!(title); }
    if let Some(ref username) = body.username { existing["username"] = serde_json::json!(username); }
    if let Some(ref password) = body.password { existing["password"] = serde_json::json!(password); }
    if let Some(ref url) = body.url { existing["url"] = serde_json::json!(url); }
    if let Some(ref notes) = body.notes { existing["notes"] = serde_json::json!(notes); }

    let new_password = body.password.as_deref().unwrap_or_else(|| existing["password"].as_str().unwrap_or(""));
    let new_favorite = body.favorite.map(|f| f as i32).unwrap_or(old_favorite);
    let new_category = body.category.as_ref().or(old_category.as_ref()).map(|s| s.clone());
    let new_tags = body.tags.as_ref().map(|t| serde_json::to_string(t).unwrap())
        .or(old_tags);
    let new_expires = body.expires_at.as_ref().or(old_expires.as_ref()).map(|s| s.clone());
    let strength = calculate_strength(new_password);
    
    let new_title = existing["title"].as_str().unwrap_or("").to_string();

    let encrypted = match crypto::encrypt(&existing.to_string(), &enc_key) {
        Ok(e) => e,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e)),
    };

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE entries SET encrypted_data=?1, category=?2, tags=?3, favorite=?4, expires_at=?5, strength_score=?6, updated_at=?7 WHERE id=?8",
        params![encrypted, new_category, new_tags, new_favorite, new_expires, strength as i32, now, id],
    ).unwrap();

    conn.execute(
        "INSERT INTO audit_log (action, entry_id, entry_title, timestamp) VALUES (?1, ?2, ?3, ?4)",
        params!["ENTRY_UPDATED", id, new_title, now],
    ).ok();

    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": id, "updated_at": now})))
}

// DELETE /api/entries/:id
pub async fn delete_entry(
    data: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<String>,
) -> HttpResponse {
    if require_auth(&req, &data).is_none() {
        return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized"));
    }

    let id = path.into_inner();
    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e.to_string())),
    };

    let encrypted_data: Option<String> = conn.query_row(
        "SELECT encrypted_data FROM entries WHERE id = ?1",
        params![id],
        |r| r.get(0),
    ).ok();
    
    let mut title = "Unknown Entry".to_string();
    if let Some(enc) = encrypted_data {
        let secret_guard = data.jwt_secret.lock().unwrap();
        let key_guard = data.encryption_key.lock().unwrap();
        if let Some(k) = &*key_guard {
            if let Ok(dec) = crypto::decrypt(&enc, k) {
                let partial: serde_json::Value = serde_json::from_str(&dec).unwrap_or_default();
                title = partial["title"].as_str().unwrap_or("Unknown Entry").to_string();
            }
        }
    }

    let rows = conn.execute("DELETE FROM entries WHERE id = ?1", params![id]).unwrap_or(0);
    if rows == 0 {
        return HttpResponse::NotFound().json(ApiResponse::<()>::error("Entry not found"));
    }

    conn.execute(
        "INSERT INTO audit_log (action, entry_id, entry_title, timestamp) VALUES (?1, ?2, ?3, ?4)",
        params!["ENTRY_DELETED", id, title, chrono::Utc::now().to_rfc3339()],
    ).ok();

    HttpResponse::Ok().json(ApiResponse::success("Entry deleted"))
}

// GET /api/categories
pub async fn list_categories(data: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
    if require_auth(&req, &data).is_none() {
        return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized"));
    }
    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e.to_string())),
    };

    let mut stmt = conn.prepare(
        "SELECT c.id, c.name, c.color, c.icon, COUNT(e.id) as count FROM categories c LEFT JOIN entries e ON e.category = c.name GROUP BY c.id ORDER BY c.name"
    ).unwrap();

    let cats: Vec<Category> = stmt.query_map([], |row| {
        Ok(Category {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            icon: row.get(3)?,
            count: row.get(4)?,
        })
    }).unwrap().filter_map(|r| r.ok()).collect();

    HttpResponse::Ok().json(ApiResponse::success(cats))
}

// POST /api/categories
pub async fn create_category(
    data: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<CreateCategoryRequest>,
) -> HttpResponse {
    if require_auth(&req, &data).is_none() {
        return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized"));
    }
    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e.to_string())),
    };
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO categories (id, name, color, icon, created_at) VALUES (?1,?2,?3,?4,?5)",
        params![id, body.name, body.color, body.icon, now],
    ).unwrap();
    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": id})))
}

// GET /api/audit
pub async fn get_audit_log(data: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
    if require_auth(&req, &data).is_none() {
        return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized"));
    }
    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e.to_string())),
    };

    let mut stmt = conn.prepare(
        "SELECT id, action, entry_id, entry_title, details, timestamp FROM audit_log ORDER BY timestamp DESC LIMIT 200"
    ).unwrap();

    let logs: Vec<AuditLogEntry> = stmt.query_map([], |row| {
        Ok(AuditLogEntry {
            id: row.get(0)?,
            action: row.get(1)?,
            entry_id: row.get(2)?,
            entry_title: row.get(3)?,
            details: row.get(4)?,
            timestamp: row.get(5)?,
        })
    }).unwrap().filter_map(|r| r.ok()).collect();

    HttpResponse::Ok().json(ApiResponse::success(logs))
}

// GET /api/generate
pub async fn generate_password(
    data: web::Data<AppState>,
    req: HttpRequest,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    if require_auth(&req, &data).is_none() {
        return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized"));
    }

    let length: usize = query.get("length").and_then(|v| v.parse().ok()).unwrap_or(20);
    let uppercase = query.get("uppercase").map(|v| v != "false").unwrap_or(true);
    let lowercase = query.get("lowercase").map(|v| v != "false").unwrap_or(true);
    let numbers = query.get("numbers").map(|v| v != "false").unwrap_or(true);
    let symbols = query.get("symbols").map(|v| v != "false").unwrap_or(true);
    let exclude_ambiguous = query.get("exclude_ambiguous").map(|v| v == "true").unwrap_or(false);

    let password = crate::generator::generate(length, uppercase, lowercase, numbers, symbols, exclude_ambiguous);
    let strength = calculate_strength(&password);
    let label = strength_label(strength);

    HttpResponse::Ok().json(ApiResponse::success(GeneratePasswordResponse {
        password,
        strength_score: strength,
        strength_label: label,
    }))
}

// POST /api/strength
pub async fn check_strength(
    _data: web::Data<AppState>,
    body: web::Json<CheckStrengthRequest>,
) -> HttpResponse {
    let score = calculate_strength(&body.password);
    let feedback = strength_feedback(score, &body.password);
    let crack = crack_time_estimate(score);

    HttpResponse::Ok().json(ApiResponse::success(CheckStrengthResponse {
        score,
        label: strength_label(score),
        feedback,
        crack_time: crack,
    }))
}

// POST /api/export
pub async fn export_vault(
    data: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<ExportRequest>,
) -> HttpResponse {
    let enc_key = match require_auth(&req, &data) {
        Some(k) => k,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized")),
    };

    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e.to_string())),
    };

    let mut stmt = conn.prepare(
        "SELECT id, encrypted_data, category, tags, favorite, expires_at FROM entries"
    ).unwrap();
    let raw_entries: Vec<serde_json::Value> = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let encrypted_data: String = row.get(1)?;
        let category: Option<String> = row.get(2)?;
        let tags_str: Option<String> = row.get(3)?;
        let favorite: i32 = row.get(4)?;
        let expires_at: Option<String> = row.get(5)?;
        Ok((id, encrypted_data, category, tags_str, favorite, expires_at))
    }).unwrap().filter_map(|r| r.ok()).map(|(id, enc, category, tags_str, favorite, expires_at)| {
        let decrypted = crypto::decrypt(&enc, &enc_key).unwrap_or_default();
        let mut entry_data: serde_json::Value = serde_json::from_str(&decrypted).unwrap_or_default();
        entry_data["id"] = serde_json::json!(id);
        entry_data["category"] = serde_json::json!(category);
        let tags_val: serde_json::Value = tags_str
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(serde_json::Value::Null);
        entry_data["tags"] = tags_val;
        entry_data["favorite"] = serde_json::json!(favorite == 1);
        entry_data["expires_at"] = serde_json::json!(expires_at);
        entry_data
    }).collect();

    let export_data = serde_json::json!({
        "version": "1.0",
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "entries": raw_entries,
    });

    // Re-encrypt export with export password
    let export_salt = crypto::generate_salt();
    let export_key = match crypto::derive_encryption_key(&body.export_password, &export_salt) {
        Ok(k) => k,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e)),
    };
    let encrypted_export = match crypto::encrypt(&export_data.to_string(), &export_key) {
        Ok(e) => e,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e)),
    };

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO audit_log (action, details, timestamp) VALUES (?1, ?2, ?3)",
        params!["VAULT_EXPORTED", "Vault exported", now],
    ).ok();

    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
        "salt": export_salt,
        "data": encrypted_export,
        "exported_at": now,
    })))
}

// POST /api/import
pub async fn import_vault(
    data: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<ImportRequest>,
) -> HttpResponse {
    let enc_key = match require_auth(&req, &data) {
        Some(k) => k,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized")),
    };

    // Derive decryption key from export password + salt
    let import_key = match crypto::derive_encryption_key(&body.export_password, &body.salt) {
        Ok(k) => k,
        Err(e) => return HttpResponse::BadRequest().json(ApiResponse::<()>::error(&format!("Key derivation failed: {}", e))),
    };

    // Decrypt the outer export blob
    let decrypted = match crypto::decrypt(&body.data, &import_key) {
        Ok(d) => d,
        Err(_) => return HttpResponse::BadRequest()
            .json(ApiResponse::<()>::error("Invalid export password or corrupted data")),
    };

    let export_data: serde_json::Value = match serde_json::from_str(&decrypted) {
        Ok(v) => v,
        Err(_) => return HttpResponse::BadRequest()
            .json(ApiResponse::<()>::error("Corrupted export data")),
    };

    let entries = match export_data["entries"].as_array() {
        Some(e) => e.clone(),
        None => return HttpResponse::BadRequest()
            .json(ApiResponse::<()>::error("No entries found in export")),
    };

    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::error(&e.to_string())),
    };

    let mut imported = 0u32;
    let mut skipped = 0u32;

    for entry_data in &entries {
        let title = entry_data["title"].as_str().unwrap_or("").to_string();
        let username = entry_data["username"].as_str().unwrap_or("").to_string();
        let password = entry_data["password"].as_str().unwrap_or("").to_string();
        let url = entry_data["url"].as_str().map(|s| s.to_string());
        let notes = entry_data["notes"].as_str().map(|s| s.to_string());
        let category = entry_data["category"].as_str().map(|s| s.to_string());
        let favorite = entry_data["favorite"].as_bool().unwrap_or(false) as i32;
        let expires_at = entry_data["expires_at"].as_str().map(|s| s.to_string());
        let tags = entry_data["tags"].as_array().map(|a| serde_json::to_string(a).unwrap_or_default());

        if title.is_empty() { skipped += 1; continue; }

        let sensitive = serde_json::json!({
            "title": title, "username": username,
            "password": password, "url": url, "notes": notes,
        });

        let encrypted = match crypto::encrypt(&sensitive.to_string(), &enc_key) {
            Ok(e) => e,
            Err(_) => { skipped += 1; continue; }
        };

        let strength = calculate_strength(&password);
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        match conn.execute(
            "INSERT INTO entries (id, encrypted_data, category, tags, favorite, expires_at, strength_score, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![id, encrypted, category, tags, favorite, expires_at, strength as i32, now, now],
        ) {
            Ok(_) => imported += 1,
            Err(_) => skipped += 1,
        }
    }

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO audit_log (action, details, timestamp) VALUES (?1, ?2, ?3)",
        params!["VAULT_IMPORTED", format!("Imported {} entries, skipped {}", imported, skipped), now],
    ).ok();

    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
        "imported": imported, "skipped": skipped,
    })))
}

pub fn calculate_strength(password: &str) -> u8 {
    if password.is_empty() { return 0; }
    let estimate = zxcvbn::zxcvbn(password, &[]);
    estimate.score().into()
}

fn strength_label(score: u8) -> String {
    match score {
        0 => "Very Weak",
        1 => "Weak",
        2 => "Fair",
        3 => "Strong",
        _ => "Very Strong",
    }.to_string()
}

fn strength_feedback(score: u8, _password: &str) -> Vec<String> {
    match score {
        0 | 1 => vec!["Use a longer password".into(), "Add uppercase letters".into(), "Add numbers and symbols".into()],
        2 => vec!["Consider adding more variety".into(), "A longer password would be stronger".into()],
        3 => vec!["Good password! Adding more length helps".into()],
        _ => vec!["Excellent password strength!".into()],
    }
}

fn crack_time_estimate(score: u8) -> String {
    match score {
        0 => "Instantly",
        1 => "Seconds to minutes",
        2 => "Hours to days",
        3 => "Months to years",
        _ => "Centuries",
    }.to_string()
}
