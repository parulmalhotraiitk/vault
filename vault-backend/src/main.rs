mod models;
mod crypto;
mod db;
mod auth;
mod entries;
mod generator;

use actix_cors::Cors;
use actix_web::{middleware, web, App, HttpServer};
use auth::AppState;
use std::sync::Mutex;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("🔐 Vault Backend starting on http://127.0.0.1:8080");

    let db_path = db::get_db_path();
    println!("📦 Database: {}", db_path);

    db::initialize_db(&db_path).expect("Failed to initialize database");

    let state = web::Data::new(AppState {
        db_path: db_path.clone(),
        encryption_key: Mutex::new(None),
        jwt_secret: Mutex::new(None),
    });

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("http://localhost:5173")
            .allowed_origin("http://127.0.0.1:5173")
            .allowed_origin("http://localhost:5174")
            .allowed_origin("http://127.0.0.1:5174")
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::CONTENT_TYPE,
            ])
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(state.clone())
            .app_data(web::JsonConfig::default().error_handler(|err, _req| {
                let response = actix_web::HttpResponse::BadRequest()
                    .json(models::ApiResponse::<()>::error(&format!("JSON error: {}", err)));
                actix_web::error::InternalError::from_response(err, response).into()
            }))
            // Auth routes
            .route("/api/auth/status", web::get().to(auth::get_status))
            .route("/api/auth/setup", web::post().to(auth::setup))
            .route("/api/auth/unlock", web::post().to(auth::unlock))
            .route("/api/auth/lock", web::post().to(auth::lock))
            // Entry routes
            .route("/api/entries", web::get().to(entries::list_entries))
            .route("/api/entries", web::post().to(entries::create_entry))
            .route("/api/entries/{id}", web::get().to(entries::get_entry))
            .route("/api/entries/{id}", web::put().to(entries::update_entry))
            .route("/api/entries/{id}", web::delete().to(entries::delete_entry))
            // Category routes
            .route("/api/categories", web::get().to(entries::list_categories))
            .route("/api/categories", web::post().to(entries::create_category))
            // Utility routes
            .route("/api/generate", web::get().to(entries::generate_password))
            .route("/api/strength", web::post().to(entries::check_strength))
            .route("/api/audit", web::get().to(entries::get_audit_log))
            .route("/api/export", web::post().to(entries::export_vault))
            .route("/api/import", web::post().to(entries::import_vault))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
