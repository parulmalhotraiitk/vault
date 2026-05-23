use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaultMeta {
    pub id: i64,
    pub master_hash: String,
    pub salt: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Entry {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub favorite: bool,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub strength_score: Option<u8>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EntryMeta {
    pub id: String,
    pub title: String,
    pub username: String,
    pub url: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub favorite: bool,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub strength_score: Option<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEntryRequest {
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub favorite: Option<bool>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateEntryRequest {
    pub title: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub favorite: Option<bool>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SetupRequest {
    pub master_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnlockRequest {
    pub master_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub expires_in: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusResponse {
    pub initialized: bool,
    pub locked: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditLogEntry {
    pub id: i64,
    pub action: String,
    pub entry_id: Option<String>,
    pub entry_title: Option<String>,
    pub details: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub color: String,
    pub icon: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneratePasswordRequest {
    pub length: Option<usize>,
    pub uppercase: Option<bool>,
    pub lowercase: Option<bool>,
    pub numbers: Option<bool>,
    pub symbols: Option<bool>,
    pub exclude_ambiguous: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneratePasswordResponse {
    pub password: String,
    pub strength_score: u8,
    pub strength_label: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CheckStrengthRequest {
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CheckStrengthResponse {
    pub score: u8,
    pub label: String,
    pub feedback: Vec<String>,
    pub crack_time: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportRequest {
    pub export_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportRequest {
    pub export_password: String,
    pub salt: String,
    pub data: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        ApiResponse {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(msg: &str) -> ApiResponse<()> {
        ApiResponse {
            success: false,
            data: None,
            error: Some(msg.to_string()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
}
