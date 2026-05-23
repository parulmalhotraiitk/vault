use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2, Params,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};

pub const NONCE_SIZE: usize = 12;

/// Hash the master password using Argon2id (for verification storage)
pub fn hash_master_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("Failed to hash password: {}", e))
}

/// Verify the master password against stored hash
pub fn verify_master_password(password: &str, hash: &str) -> bool {
    let parsed = match PasswordHash::new(hash) {
        Ok(p) => p,
        Err(_) => return false,
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

/// Derive a 32-byte encryption key from master password + salt using Argon2id
pub fn derive_encryption_key(password: &str, salt: &str) -> Result<[u8; 32], String> {
    let salt_bytes = hex::decode(salt).map_err(|e| format!("Invalid salt: {}", e))?;
    let params = Params::new(65536, 3, 4, Some(32)).map_err(|e| e.to_string())?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);
    let mut output = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), &salt_bytes, &mut output)
        .map_err(|e| format!("Key derivation failed: {}", e))?;
    Ok(output)
}

/// Generate a random 32-byte hex salt
pub fn generate_salt() -> String {
    let mut salt = [0u8; 32];
    OsRng.fill_bytes(&mut salt);
    hex::encode(salt)
}

/// Encrypt plaintext using AES-256-GCM. Returns base64(nonce || ciphertext)
pub fn encrypt(plaintext: &str, key_bytes: &[u8; 32]) -> Result<String, String> {
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(BASE64.encode(&combined))
}

/// Decrypt base64(nonce || ciphertext) using AES-256-GCM
pub fn decrypt(encoded: &str, key_bytes: &[u8; 32]) -> Result<String, String> {
    let combined = BASE64
        .decode(encoded)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;
    if combined.len() < NONCE_SIZE {
        return Err("Ciphertext too short".to_string());
    }
    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_SIZE);
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed — wrong master password or corrupted data".to_string())?;
    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 decode failed: {}", e))
}

/// Generate a random 32-byte JWT signing secret
pub fn generate_jwt_secret() -> Vec<u8> {
    let mut secret = [0u8; 32];
    OsRng.fill_bytes(&mut secret);
    secret.to_vec()
}
