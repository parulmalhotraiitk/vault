# 🔐 Vault: Your Personal, Self-Hosted Password Manager

Welcome to **Vault**, a highly secure, privacy-first password manager designed to run entirely on your local machine.

Unlike commercial cloud-based password managers (like LastPass or 1Password), Vault ensures that your sensitive data never leaves your computer. Your passwords, notes, and metadata are encrypted and stored in a local SQLite database, giving you 100% ownership and control over your digital security.

---

## ✨ Features

- **Zero-Cloud Architecture:** Your vault is stored locally (`~/.vault/vault.db`). No third-party servers, no subscriptions, no cloud breaches.
- **State-of-the-Art Encryption:** Utilizes AES-256-GCM for data encryption and Argon2id for key derivation and master password hashing.
- **Zero Metadata Leakage:** All entry metadata (titles, usernames, URLs) is fully encrypted. Even if your database file is stolen, attackers cannot see what services you use.
- **Password Generator:** Create complex, impossible-to-guess passwords customized by length and character types.
- **Strength Analyzer:** Real-time feedback on password strength using `zxcvbn`.
- **Dynamic Session Security:** Session tokens are cryptographically randomized upon every unlock, ensuring old tokens are instantly invalidated upon locking.
- **Export Capabilities:** Securely export your entire vault (encrypted) for backups.

---

## 🛠 Tech Stack

- **Backend (Rust):** Built with [Actix-Web](https://actix.rs/), offering blazing fast performance and memory safety.
  - `rusqlite`: SQLite database interaction.
  - `aes-gcm` & `argon2`: Cryptographic primitives.
  - `jsonwebtoken`: Secure API authentication.
- **Frontend (React + Vite):** A modern, responsive user interface communicating seamlessly with the Rust backend.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) & `npm`
- [Rust](https://rustup.rs/) (`cargo` and `rustc`)

### 1. Start the Backend
The backend runs on `http://127.0.0.1:8080`.

```bash
cd vault-backend
cargo run
```

### 2. Start the Frontend
The frontend runs on `http://localhost:5173`. Open a new terminal window:

```bash
cd vault-frontend
npm install
npm run dev
```

### 3. Setup Your Vault
Open your browser to `http://localhost:5173`. You will be prompted to create your **Master Password**.
> **Warning:** Make sure you remember your Master Password! Because everything is encrypted locally, there is no "Forgot Password" feature. If you lose it, your data is gone forever.

---

## 🔒 Security Architecture

Vault was designed with a focus on mitigating common password manager vulnerabilities:

1. **Authentication:** 
   Your Master Password is hashed using Argon2id with a randomly generated 32-byte salt before being stored in the database.
2. **Encryption:** 
   An AES-256-GCM encryption key is derived dynamically in-memory when you unlock the vault (also using Argon2id).
3. **Data Storage:** 
   The database never stores plaintext identifiers for your passwords. When the backend fetches your list of passwords, it decrypts them securely in-memory using Rust's high-speed cryptographic libraries before sending them to the authenticated frontend.
4. **Stateless Tokens:** 
   When the vault is locked, the AES encryption key and the JWT signing secret are immediately wiped from the backend's memory, securing the vault instantly.

---

## 🤝 Contributing
Since this is a self-hosted personal project, feel free to fork, modify the UI, or add new backend features to suit your workflow!
