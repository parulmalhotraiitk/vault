use actix_web::{web, HttpRequest, HttpResponse};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rusqlite::params;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::crypto;
use crate::db;
use crate::models::*;

pub struct AppState {
    pub db_path: String,
    pub encryption_key: Mutex<Option<[u8; 32]>>,
    pub jwt_secret: Mutex<Option<Vec<u8>>>,
}

fn now_secs() -> usize {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize
}

pub fn make_token(jwt_secret: &[u8]) -> Result<String, String> {
    let claims = Claims {
        sub: "vault_user".to_string(),
        iat: now_secs(),
        exp: now_secs() + 3600, // 1 hour
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret),
    )
    .map_err(|e| format!("Token creation failed: {}", e))
}

pub fn validate_token(req: &HttpRequest, jwt_secret: &[u8]) -> bool {
    let auth_header = match req.headers().get("Authorization") {
        Some(h) => h,
        None => return false,
    };
    let auth_str = match auth_header.to_str() {
        Ok(s) => s,
        Err(_) => return false,
    };
    if !auth_str.starts_with("Bearer ") {
        return false;
    }
    let token = &auth_str[7..];
    let validation = Validation::default();
    decode::<Claims>(token, &DecodingKey::from_secret(jwt_secret), &validation).is_ok()
}

// GET /api/auth/status
pub async fn get_status(data: web::Data<AppState>) -> HttpResponse {
    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::Ok().json(StatusResponse {
                initialized: false,
                locked: true,
            })
        }
    };

    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM vault_meta", [], |r| r.get(0))
        .unwrap_or(0);

    let initialized = count > 0;
    let locked = data.jwt_secret.lock().unwrap().is_none();

    HttpResponse::Ok().json(StatusResponse { initialized, locked })
}

// POST /api/auth/setup
pub async fn setup(
    data: web::Data<AppState>,
    body: web::Json<SetupRequest>,
) -> HttpResponse {
    // Ensure DB tables exist in case the file was deleted while running
    let _ = db::initialize_db(&data.db_path);

    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::error(&format!("DB error: {}", e)))
        }
    };

    // Check if already set up
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM vault_meta", [], |r| r.get(0))
        .unwrap_or(0);
    if count > 0 {
        return HttpResponse::BadRequest()
            .json(ApiResponse::<()>::error("Vault already initialized"));
    }

    if body.master_password.len() < 8 {
        return HttpResponse::BadRequest()
            .json(ApiResponse::<()>::error("Master password must be at least 8 characters"));
    }

    let salt = crypto::generate_salt();
    let master_hash = match crypto::hash_master_password(&body.master_password) {
        Ok(h) => h,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e)),
    };

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO vault_meta (master_hash, salt, created_at) VALUES (?1, ?2, ?3)",
        params![master_hash, salt, now],
    )
    .unwrap();

    // Unlock immediately after setup
    let enc_key = match crypto::derive_encryption_key(&body.master_password, &salt) {
        Ok(k) => k,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e)),
    };
    let jwt_secret = crypto::generate_jwt_secret();
    let token = match make_token(&jwt_secret) {
        Ok(t) => t,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e)),
    };

    *data.encryption_key.lock().unwrap() = Some(enc_key);
    *data.jwt_secret.lock().unwrap() = Some(jwt_secret);

    // Log setup
    conn.execute(
        "INSERT INTO audit_log (action, details, timestamp) VALUES (?1, ?2, ?3)",
        params!["VAULT_CREATED", "Vault initialized with master password", now],
    ).ok();

    HttpResponse::Ok().json(ApiResponse::success(AuthResponse {
        token,
        expires_in: 3600,
    }))
}

// POST /api/auth/unlock
pub async fn unlock(
    data: web::Data<AppState>,
    body: web::Json<UnlockRequest>,
) -> HttpResponse {
    let conn = match db::open_connection(&data.db_path) {
        Ok(c) => c,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::error(&format!("DB error: {}", e)))
        }
    };

    let result: rusqlite::Result<(String, String)> = conn.query_row(
        "SELECT master_hash, salt FROM vault_meta LIMIT 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    );

    let (master_hash, salt) = match result {
        Ok(r) => r,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(ApiResponse::<()>::error("Vault not initialized"))
        }
    };

    if !crypto::verify_master_password(&body.master_password, &master_hash) {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO audit_log (action, details, timestamp) VALUES (?1, ?2, ?3)",
            params!["UNLOCK_FAILED", "Invalid master password attempt", now],
        ).ok();
        return HttpResponse::Unauthorized()
            .json(ApiResponse::<()>::error("Invalid master password"));
    }

    let enc_key = match crypto::derive_encryption_key(&body.master_password, &salt) {
        Ok(k) => k,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e)),
    };
    let jwt_secret = crypto::generate_jwt_secret();
    let token = match make_token(&jwt_secret) {
        Ok(t) => t,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&e)),
    };

    *data.encryption_key.lock().unwrap() = Some(enc_key);
    *data.jwt_secret.lock().unwrap() = Some(jwt_secret);

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO audit_log (action, details, timestamp) VALUES (?1, ?2, ?3)",
        params!["VAULT_UNLOCKED", "Vault unlocked successfully", now],
    ).ok();

    HttpResponse::Ok().json(ApiResponse::success(AuthResponse {
        token,
        expires_in: 3600,
    }))
}

// POST /api/auth/lock
pub async fn lock(data: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
    let secret_guard = data.jwt_secret.lock().unwrap();
    if let Some(ref secret) = *secret_guard {
        if !validate_token(&req, secret) {
            drop(secret_guard);
            return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized"));
        }
    }
    drop(secret_guard);

    *data.encryption_key.lock().unwrap() = None;
    *data.jwt_secret.lock().unwrap() = None;

    let conn = db::open_connection(&data.db_path).ok();
    if let Some(c) = conn {
        let now = chrono::Utc::now().to_rfc3339();
        c.execute(
            "INSERT INTO audit_log (action, details, timestamp) VALUES (?1, ?2, ?3)",
            params!["VAULT_LOCKED", "Vault locked", now],
        ).ok();
    }

    HttpResponse::Ok().json(ApiResponse::success("Vault locked"))
}
