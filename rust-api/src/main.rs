use std::{env, net::SocketAddr, time::Duration};

use anyhow::Context;
use axum::{
    extract::{Path, Query, State},
    http::{Method, StatusCode},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions, PgSslMode},
    FromRow, PgPool,
};
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db: PgPool,
    strawberry_base_url: String,
    client: reqwest::Client,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<ErrorResponse>)>;

const TMDB_IMAGE_BASE: &str = "https://image.tmdb.org/t/p/w185";

#[derive(FromRow)]
struct ListRow {
    id: Uuid,
    title: String,
    slug: String,
    visibility: String,
    movies: Vec<i32>,
    created_at: DateTime<Utc>,
    color: Option<String>,
    user_email: String,
    username: Option<String>,
}

#[derive(Serialize)]
struct ListResponse {
    id: Uuid,
    title: String,
    slug: String,
    visibility: String,
    movies: Vec<i32>,
    #[serde(rename = "createdAt")]
    created_at: String,
    color: Option<String>,
    #[serde(rename = "userEmail")]
    user_email: String,
    username: Option<String>,
}

impl From<ListRow> for ListResponse {
    fn from(row: ListRow) -> Self {
        Self {
            id: row.id,
            title: row.title,
            slug: row.slug,
            visibility: row.visibility,
            movies: row.movies,
            created_at: row.created_at.to_rfc3339(),
            color: row.color,
            user_email: normalize_email(&row.user_email),
            username: row.username,
        }
    }
}

#[derive(Serialize)]
struct ListEnvelope {
    list: ListResponse,
}

#[derive(Serialize)]
struct ListsEnvelope {
    lists: Vec<ListResponse>,
}

#[derive(FromRow)]
struct RatingRow {
    user_email: String,
    tmdb_id: i32,
    rating: i32,
    source: String,
    updated_at: DateTime<Utc>,
}

#[derive(Serialize)]
struct RatingResponse {
    #[serde(rename = "tmdbId")]
    tmdb_id: i32,
    rating: i32,
    source: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

impl From<RatingRow> for RatingResponse {
    fn from(row: RatingRow) -> Self {
        Self {
            tmdb_id: row.tmdb_id,
            rating: row.rating,
            source: row.source,
            updated_at: row.updated_at.to_rfc3339(),
        }
    }
}

#[derive(Serialize)]
struct RatingsEnvelope {
    ratings: Vec<RatingResponse>,
}

#[derive(Serialize)]
struct RatingValueEnvelope {
    rating: Option<i32>,
}

#[derive(FromRow)]
struct ProfileRow {
    user_email: String,
    username: String,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
struct ProfileResponse {
    #[serde(rename = "userEmail")]
    user_email: String,
    username: String,
    #[serde(rename = "createdAt")]
    created_at: String,
}

impl From<ProfileRow> for ProfileResponse {
    fn from(row: ProfileRow) -> Self {
        Self {
            user_email: normalize_email(&row.user_email),
            username: row.username,
            created_at: row.created_at.to_rfc3339(),
        }
    }
}

#[derive(Serialize)]
struct ProfileEnvelope {
    profile: Option<ProfileResponse>,
}

#[derive(Serialize)]
struct SimplifiedMovieDto {
    #[serde(rename = "tmdbId")]
    tmdb_id: i32,
    title: String,
    overview: Option<String>,
    #[serde(rename = "releaseYear")]
    release_year: Option<i32>,
    rating: Option<f32>,
    #[serde(rename = "imdbRating")]
    imdb_rating: Option<f32>,
    #[serde(rename = "letterboxdRating")]
    letterboxd_rating: Option<f32>,
    #[serde(rename = "imdbId")]
    imdb_id: Option<String>,
    #[serde(rename = "posterUrl")]
    poster_url: Option<String>,
    runtime: Option<i32>,
    genres: Option<Vec<String>>,
    tagline: Option<String>,
}

#[derive(Serialize)]
struct TmdbSearchEnvelope {
    query: String,
    results: Vec<SimplifiedMovieDto>,
}

#[derive(Serialize)]
struct TmdbMovieEnvelope {
    detail: SimplifiedMovieDto,
}

#[derive(Deserialize)]
struct TmdbSearchParams {
    query: Option<String>,
    year: Option<String>,
}

#[derive(Deserialize, Clone)]
struct TmdbMovieResult {
    id: i32,
    title: Option<String>,
    name: Option<String>,
    overview: Option<String>,
    #[serde(rename = "release_date")]
    release_date: Option<String>,
    #[serde(rename = "vote_average")]
    vote_average: Option<f32>,
    #[serde(rename = "poster_path")]
    poster_path: Option<String>,
    #[serde(rename = "imdb_rating")]
    imdb_rating: Option<f32>,
    #[serde(rename = "letterboxd_rating")]
    letterboxd_rating: Option<f32>,
}

#[derive(Deserialize, Clone)]
struct TmdbGenre {
    id: i32,
    name: Option<String>,
}

#[derive(Deserialize, Clone)]
struct TmdbMovieDetailsResult {
    id: i32,
    title: Option<String>,
    name: Option<String>,
    overview: Option<String>,
    #[serde(rename = "release_date")]
    release_date: Option<String>,
    #[serde(rename = "vote_average")]
    vote_average: Option<f32>,
    #[serde(rename = "poster_path")]
    poster_path: Option<String>,
    runtime: Option<i32>,
    genres: Option<Vec<TmdbGenre>>,
    tagline: Option<String>,
    #[serde(rename = "imdb_rating")]
    imdb_rating: Option<f32>,
    #[serde(rename = "letterboxd_rating")]
    letterboxd_rating: Option<f32>,
    #[serde(rename = "imdb_id")]
    imdb_id: Option<String>,
}

#[derive(Deserialize)]
struct TmdbSearchResponse {
    results: Vec<TmdbMovieResult>,
}

#[derive(Deserialize)]
struct CreateListBody {
    title: Option<String>,
    movies: Option<Vec<i32>>,
    color: Option<String>,
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
    #[serde(rename = "tmdbId")]
    tmdb_id: Option<i32>,
}

#[derive(Deserialize)]
struct ImportListBody {
    title: Option<String>,
    data: Option<String>,
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
}

#[derive(Deserialize)]
struct UpdateListBody {
    title: Option<String>,
    slug: Option<String>,
    color: Option<String>,
    visibility: Option<String>,
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
}

#[derive(Deserialize)]
struct AddMovieBody {
    #[serde(rename = "tmdbId")]
    tmdb_id: Option<i32>,
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
}

#[derive(Deserialize)]
struct RemoveMovieBody {
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
}

#[derive(Deserialize)]
struct DeleteListBody {
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
}

#[derive(Deserialize)]
struct FavoriteBody {
    #[serde(rename = "listId")]
    list_id: Option<Uuid>,
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
}

#[derive(Deserialize)]
struct SetUsernameBody {
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
    username: Option<String>,
}

#[derive(Deserialize)]
struct RatingEntry {
    #[serde(rename = "tmdbId")]
    tmdb_id: Option<i32>,
    rating: Option<i32>,
    source: Option<String>,
}

#[derive(Deserialize)]
struct SaveRatingsBody {
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
    ratings: Option<Vec<RatingEntry>>,
}

#[derive(Clone)]
struct ParsedEntry {
    title: String,
    year: Option<String>,
    rating: Option<i32>,
    source: String,
    tmdb_id: Option<i32>,
}

#[derive(Clone)]
struct RatingInput {
    tmdb_id: i32,
    rating: i32,
    source: String,
}

#[derive(Deserialize)]
struct ListsQuery {
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
}

#[derive(Deserialize)]
struct OwnerQuery {
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
}

#[derive(Deserialize)]
struct PublicListQuery {
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
}

#[derive(Deserialize)]
struct PublicListsQuery {
    limit: Option<i64>,
}

#[derive(Deserialize)]
struct ProfileQuery {
    #[serde(rename = "userEmail")]
    user_email: Option<String>,
}

const DEFAULT_COLOR: &str = "sky";
const ALLOWED_COLORS: &[&str] = &["sky", "emerald", "amber", "violet", "rose", "indigo", "slate"];

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    dotenvy::dotenv().ok();

    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let ssl_mode = parse_ssl_mode(env::var("DB_SSLMODE").unwrap_or_default());
    let strawberry_base_url = env::var("STRAWBERRY_BASE_URL")
        .map(|value| value.trim().to_string())
        .ok()
        .filter(|value| !value.is_empty())
        .context("STRAWBERRY_BASE_URL must be set to route TMDB lookups through Strawberry")?;

    let mut db_options: PgConnectOptions = db_url
        .parse()
        .context("DATABASE_URL must be a valid Postgres URL")?;
    db_options = db_options.ssl_mode(ssl_mode);

    let max_conns: u32 = env::var("DB_MAX_CONNECTIONS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(5);

    info!(
        "Connecting to Postgres with sslmode={:?} and max_connections={}",
        ssl_mode, max_conns
    );

    let pool = PgPoolOptions::new()
        .max_connections(max_conns)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Some(Duration::from_secs(300)))
        .test_before_acquire(true)
        .connect_with(db_options)
        .await?;

    ensure_schema(&pool).await?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;

    let state = AppState {
        db: pool,
        strawberry_base_url,
        client,
    };
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers(Any)
        .allow_origin(Any);
    let app = Router::new()
        .route("/health/live", get(live))
        .route("/health/ready", get(ready))
        .route("/profiles", get(get_profile))
        .route("/profiles/username", post(set_username))
        .route("/lists", get(list_lists).post(create_list))
        .route("/lists/:id", get(get_list).patch(update_list).delete(delete_list))
        .route("/lists/by-slug/:slug", get(get_list_by_slug))
        .route("/lists/public", get(list_public_lists))
        .route("/lists/public/:username/:slug", get(get_public_list))
        .route("/lists/:id/items", post(add_movie_to_list))
        .route("/lists/:id/items/:tmdb_id", delete(remove_movie_from_list))
        .route("/lists/import", post(import_list))
        .route("/favorites", get(list_favorites).post(add_favorite))
        .route("/favorites/:list_id", delete(remove_favorite))
        .route("/ratings", post(save_ratings))
        .route("/ratings/:user_email/:tmdb_id", get(get_rating))
        .route("/ratings/:user_email", get(list_ratings_for_user))
        .route("/tmdb/search", get(tmdb_search))
        .route("/tmdb/movie/:tmdb_id", get(tmdb_movie))
        .layer(cors)
        .with_state(state);

    let host = env::var("APP_HOST").unwrap_or_else(|_| "0.0.0.0".into());
    let port: u16 = env::var("APP_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);

    let addr: SocketAddr = if host.contains(':') {
        host.parse()
            .context("APP_HOST must be a host or host:port")?
    } else {
        format!("{host}:{port}")
            .parse()
            .context("APP_HOST/APP_PORT did not form a valid socket address")?
    };
    info!("Listening on https://{}", addr);

    axum::serve(tokio::net::TcpListener::bind(addr).await?, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn ensure_schema(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS lists (
            id uuid PRIMARY KEY,
            title text NOT NULL,
            slug text NOT NULL,
            visibility text NOT NULL DEFAULT 'private',
            movies integer[] NOT NULL DEFAULT '{}',
            created_at timestamptz NOT NULL DEFAULT NOW(),
            color text,
            user_email text NOT NULL DEFAULT ''
        )
        "#,
    )
    .execute(pool)
    .await?;
    sqlx::query("ALTER TABLE lists DROP CONSTRAINT IF EXISTS lists_slug_key")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE lists ADD COLUMN IF NOT EXISTS color text")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE lists ADD COLUMN IF NOT EXISTS user_email text")
        .execute(pool)
        .await?;
    sqlx::query("UPDATE lists SET user_email = '' WHERE user_email IS NULL")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE lists ALTER COLUMN user_email SET DEFAULT ''")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE lists ALTER COLUMN user_email SET NOT NULL")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE lists ALTER COLUMN visibility SET DEFAULT 'private'")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_lists_user_email ON lists(user_email)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_user_slug ON lists(user_email, slug)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_lists_visibility ON lists(visibility)")
        .execute(pool)
        .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS profiles (
            user_email text PRIMARY KEY,
            username text NOT NULL UNIQUE,
            created_at timestamptz NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS user_favorites (
            user_email text NOT NULL,
            list_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_email, list_id)
        )
        "#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS user_ratings (
            user_email text NOT NULL,
            tmdb_id integer NOT NULL,
            rating integer NOT NULL,
            source text NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_email, tmdb_id)
        )
        "#,
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn shutdown_signal() {
    use tokio::signal::unix::{signal, SignalKind};

    let mut sigint = signal(SignalKind::interrupt()).unwrap();
    let mut sigterm = signal(SignalKind::terminate()).unwrap();

    tokio::select! {
        _ = sigint.recv() => {}
        _ = sigterm.recv() => {}
    }

    info!("Shutdown signal received, draining...");
}

async fn live() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

async fn ready(State(state): State<AppState>) -> Json<HealthResponse> {
    if let Err(e) = sqlx::query_scalar::<_, i32>("select 1")
        .fetch_one(&state.db)
        .await
    {
        error!("readiness check failed: {}", e);
        return Json(HealthResponse { status: "degraded" });
    }

    Json(HealthResponse { status: "ok" })
}

async fn tmdb_search(
    State(state): State<AppState>,
    Query(params): Query<TmdbSearchParams>,
) -> ApiResult<TmdbSearchEnvelope> {
    let query = params.query.unwrap_or_default().trim().to_string();
    if query.is_empty() {
        return Err(bad_request("Missing query parameter"));
    }

    let results = fetch_tmdb_search(&state, &query, params.year.as_deref()).await?;
    Ok(Json(TmdbSearchEnvelope { query, results }))
}

async fn tmdb_movie(
    Path(tmdb_id): Path<i32>,
    State(state): State<AppState>,
) -> ApiResult<TmdbMovieEnvelope> {
    let detail = fetch_tmdb_movie(&state, tmdb_id).await?;
    Ok(Json(TmdbMovieEnvelope { detail }))
}

async fn list_lists(State(state): State<AppState>, Query(params): Query<ListsQuery>) -> ApiResult<ListsEnvelope> {
    let user_email = params
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;

    let rows = sqlx::query_as::<_, ListRow>(
        r#"
        SELECT lists.*, profiles.username
        FROM lists
        LEFT JOIN profiles ON lists.user_email = profiles.user_email
        WHERE lists.user_email = $1
        ORDER BY lists.created_at DESC
        "#,
    )
    .bind(&user_email)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;
    let lists = rows.into_iter().map(ListResponse::from).collect();
    Ok(Json(ListsEnvelope { lists }))
}

async fn create_list(
    State(state): State<AppState>,
    Json(payload): Json<CreateListBody>,
) -> ApiResult<ListEnvelope> {
    let title = payload.title.unwrap_or_default().trim().to_string();
    if title.is_empty() {
        return Err(bad_request("Title is required"));
    }
    let email = payload
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;
    let mut movies = payload.movies.unwrap_or_default();
    if let Some(tmdb_id) = payload.tmdb_id {
        if !movies.contains(&tmdb_id) {
            movies.insert(0, tmdb_id);
        }
    }
    let row = insert_list(&state, &title, &movies, payload.color, &email).await?;

    Ok(Json(ListEnvelope { list: row.into() }))
}

async fn import_list(
    State(state): State<AppState>,
    Json(payload): Json<ImportListBody>,
) -> ApiResult<ListEnvelope> {
    let title = payload.title.unwrap_or_default().trim().to_string();
    let raw = payload.data.unwrap_or_default();
    let user_email = payload.user_email.unwrap_or_default().trim().to_lowercase();

    if title.is_empty() || raw.trim().is_empty() {
        return Err(bad_request("Title and data are required"));
    }
    if user_email.is_empty() {
        return Err(bad_request("userEmail is required"));
    }

    let entries = parse_imported_titles(&raw);
    if entries.is_empty() {
        return Err(bad_request("No movies could be parsed from the import data"));
    }

    let mut ids: Vec<i32> = Vec::new();
    let mut ratings: Vec<RatingInput> = Vec::new();

    for entry in entries {
        let tmdb_id = if let Some(id) = entry.tmdb_id {
            Some(id)
        } else {
            search_tmdb_id(&state, &entry.title, entry.year.as_deref()).await?
        };

        let Some(tmdb_id) = tmdb_id else {
            continue;
        };

        ids.push(tmdb_id);
        if let Some(rating) = entry.rating {
            ratings.push(RatingInput {
                tmdb_id,
                rating,
                source: entry.source.clone(),
            });
        }
    }

    if ids.is_empty() {
        return Err(bad_request("No movies could be matched"));
    }

    let row = insert_list(&state, &title, &ids, None, &user_email).await?;
    if !ratings.is_empty() {
        upsert_ratings(&state.db, &user_email, &ratings).await?;
    }

    Ok(Json(ListEnvelope { list: row.into() }))
}

async fn get_list(
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
    Query(params): Query<OwnerQuery>,
) -> ApiResult<ListEnvelope> {
    let user_email = params
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;

    let row = fetch_list_by_id(id, &state.db).await?;
    let Some(list) = row else {
        return Err(not_found("List not found"));
    };
    if list.user_email != user_email {
        return Err(not_found("List not found"));
    }
    Ok(Json(ListEnvelope { list: list.into() }))
}

async fn get_list_by_slug(
    Path(slug): Path<String>,
    State(state): State<AppState>,
    Query(params): Query<OwnerQuery>,
) -> ApiResult<ListEnvelope> {
    let user_email = params
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;

    let row = sqlx::query_as::<_, ListRow>(
        r#"
        SELECT lists.*, profiles.username
        FROM lists
        LEFT JOIN profiles ON lists.user_email = profiles.user_email
        WHERE lists.slug = $1 AND lists.user_email = $2
        "#,
    )
    .bind(&slug)
    .bind(&user_email)
    .fetch_optional(&state.db)
    .await
    .map_err(internal_error)?;
    let Some(list) = row else {
        return Err(not_found("List not found"));
    };
    Ok(Json(ListEnvelope { list: list.into() }))
}

async fn update_list(
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<UpdateListBody>,
) -> ApiResult<ListEnvelope> {
    let requestor = payload
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;

    let current = fetch_list_by_id(id, &state.db).await?;
    let Some(existing) = current else {
        return Err(not_found("List not found"));
    };
    if existing.user_email != requestor {
        return Err(not_found("List not found"));
    }

    let mut next_title = existing.title.clone();
    if let Some(title) = payload.title {
        let trimmed = title.trim();
        if !trimmed.is_empty() {
            next_title = trimmed.to_string();
        }
    }

    let mut next_slug = existing.slug.clone();
    if let Some(slug) = payload.slug {
        let candidate = slugify(&slug);
        if candidate != existing.slug {
            next_slug = ensure_slug_available(&candidate, id, &state.db, &existing.user_email)
                .await
                .map_err(internal_error)?;
        }
    }

    let next_color = normalize_color(payload.color.or(existing.color.clone()));
    let next_visibility = match payload.visibility {
        Some(value) => normalize_visibility(&value)?,
        None => existing.visibility.clone(),
    };

    if next_visibility == "public" {
        ensure_user_has_username(&state.db, &existing.user_email).await?;
    }

    sqlx::query(
        r#"
        UPDATE lists
        SET title = $2, slug = $3, color = $4, visibility = $5
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(&next_title)
    .bind(&next_slug)
    .bind(&next_color)
    .bind(&next_visibility)
    .execute(&state.db)
    .await
    .map_err(internal_error)?;

    let row = fetch_list_by_id(id, &state.db).await?.ok_or_else(|| not_found("List not found"))?;
    Ok(Json(ListEnvelope { list: row.into() }))
}

async fn add_movie_to_list(
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<AddMovieBody>,
) -> ApiResult<ListEnvelope> {
    let tmdb_id = payload.tmdb_id.ok_or_else(|| bad_request("tmdbId is required"))?;
    let user_email = payload
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;

    let current = fetch_list_by_id(id, &state.db).await?;
    let Some(mut list) = current else {
        return Err(not_found("List not found"));
    };
    if list.user_email != user_email {
        return Err(not_found("List not found"));
    }

    if !list.movies.contains(&tmdb_id) {
        list.movies.insert(0, tmdb_id);
    }

    sqlx::query("UPDATE lists SET movies = $2 WHERE id = $1")
        .bind(id)
        .bind(&list.movies)
        .execute(&state.db)
        .await
        .map_err(internal_error)?;

    let row = fetch_list_by_id(id, &state.db).await?.ok_or_else(|| not_found("List not found"))?;
    Ok(Json(ListEnvelope { list: row.into() }))
}

async fn remove_movie_from_list(
    Path((id, tmdb_id)): Path<(Uuid, i32)>,
    State(state): State<AppState>,
    Json(payload): Json<RemoveMovieBody>,
) -> ApiResult<ListEnvelope> {
    let user_email = payload
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;

    let current = fetch_list_by_id(id, &state.db).await?;
    let Some(mut list) = current else {
        return Err(not_found("List not found"));
    };
    if list.user_email != user_email {
        return Err(not_found("List not found"));
    }

    list.movies.retain(|movie_id| *movie_id != tmdb_id);

    sqlx::query("UPDATE lists SET movies = $2 WHERE id = $1")
        .bind(id)
        .bind(&list.movies)
        .execute(&state.db)
        .await
        .map_err(internal_error)?;

    let row = fetch_list_by_id(id, &state.db).await?.ok_or_else(|| not_found("List not found"))?;
    Ok(Json(ListEnvelope { list: row.into() }))
}

async fn delete_list(
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<DeleteListBody>,
) -> ApiResult<serde_json::Value> {
    let user_email = payload
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;

    let existing = fetch_list_by_id(id, &state.db).await?;
    let Some(list) = existing else {
        return Err(not_found("List not found"));
    };
    if list.user_email != user_email {
        return Err(not_found("List not found"));
    }

    let deleted = sqlx::query_scalar::<_, Uuid>("DELETE FROM lists WHERE id = $1 RETURNING id")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(internal_error)?;
    if deleted.is_none() {
        return Err(not_found("List not found"));
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn get_profile(
    State(state): State<AppState>,
    Query(params): Query<ProfileQuery>,
) -> ApiResult<ProfileEnvelope> {
    let user_email = params
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;

    let row = sqlx::query_as::<_, ProfileRow>("SELECT * FROM profiles WHERE user_email = $1")
        .bind(&user_email)
        .fetch_optional(&state.db)
        .await
        .map_err(internal_error)?;

    Ok(Json(ProfileEnvelope {
        profile: row.map(ProfileResponse::from),
    }))
}

async fn set_username(
    State(state): State<AppState>,
    Json(payload): Json<SetUsernameBody>,
) -> ApiResult<ProfileEnvelope> {
    let user_email = payload
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;
    let raw_username = payload
        .username
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("username is required"))?;
    let username = normalize_username(raw_username)?;

    let existing_owner = sqlx::query_scalar::<_, String>("SELECT user_email FROM profiles WHERE username = $1")
        .bind(&username)
        .fetch_optional(&state.db)
        .await
        .map_err(internal_error)?;
    if let Some(owner_email) = existing_owner {
        if normalize_email(&owner_email) != user_email {
            return Err(conflict("Username is already taken"));
        }
    }

    let profile = sqlx::query_as::<_, ProfileRow>(
        r#"
        INSERT INTO profiles (user_email, username)
        VALUES ($1, $2)
        ON CONFLICT (user_email)
        DO UPDATE SET username = EXCLUDED.username
        RETURNING *
        "#,
    )
    .bind(&user_email)
    .bind(&username)
    .fetch_one(&state.db)
    .await
    .map_err(internal_error)?;

    Ok(Json(ProfileEnvelope {
        profile: Some(profile.into()),
    }))
}

async fn list_public_lists(
    State(state): State<AppState>,
    Query(params): Query<PublicListsQuery>,
) -> ApiResult<ListsEnvelope> {
    let limit = params.limit.unwrap_or(24).clamp(1, 100);
    let rows = sqlx::query_as::<_, ListRow>(
        r#"
        SELECT lists.*, profiles.username
        FROM lists
        JOIN profiles ON lists.user_email = profiles.user_email
        WHERE lists.visibility = 'public'
        ORDER BY lists.created_at DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;
    let lists = rows.into_iter().map(ListResponse::from).collect();
    Ok(Json(ListsEnvelope { lists }))
}

async fn get_public_list(
    Path((username, slug)): Path<(String, String)>,
    State(state): State<AppState>,
    Query(params): Query<PublicListQuery>,
) -> ApiResult<ListEnvelope> {
    let normalized_username = normalize_username(&username)?;
    let viewer_email = params
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty());

    let owner_email = sqlx::query_scalar::<_, String>("SELECT user_email FROM profiles WHERE username = $1")
        .bind(&normalized_username)
        .fetch_optional(&state.db)
        .await
        .map_err(internal_error)?
        .ok_or_else(|| not_found("List not found"))?;

    let row = sqlx::query_as::<_, ListRow>(
        r#"
        SELECT lists.*, profiles.username
        FROM lists
        LEFT JOIN profiles ON lists.user_email = profiles.user_email
        WHERE lists.user_email = $1 AND lists.slug = $2
        "#,
    )
    .bind(&owner_email)
    .bind(&slug)
    .fetch_optional(&state.db)
    .await
    .map_err(internal_error)?;
    let Some(list) = row else {
        return Err(not_found("List not found"));
    };

    let is_owner = viewer_email
        .as_ref()
        .map(|email| email == &normalize_email(&list.user_email))
        .unwrap_or(false);
    if list.visibility != "public" && !is_owner {
        return Err(not_found("List not found"));
    }

    Ok(Json(ListEnvelope { list: list.into() }))
}

async fn list_favorites(
    State(state): State<AppState>,
    Query(params): Query<ListsQuery>,
) -> ApiResult<ListsEnvelope> {
    let user_email = params
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;

    let rows = sqlx::query_as::<_, ListRow>(
        r#"
        SELECT lists.*, profiles.username
        FROM user_favorites
        JOIN lists ON lists.id = user_favorites.list_id
        LEFT JOIN profiles ON lists.user_email = profiles.user_email
        WHERE user_favorites.user_email = $1
          AND (lists.visibility = 'public' OR lists.user_email = $1)
        ORDER BY user_favorites.created_at DESC
        "#,
    )
    .bind(&user_email)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;
    let lists = rows.into_iter().map(ListResponse::from).collect();
    Ok(Json(ListsEnvelope { lists }))
}

async fn add_favorite(
    State(state): State<AppState>,
    Json(payload): Json<FavoriteBody>,
) -> ApiResult<serde_json::Value> {
    let user_email = payload
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;
    let list_id = payload.list_id.ok_or_else(|| bad_request("listId is required"))?;

    let list = fetch_list_by_id(list_id, &state.db).await?.ok_or_else(|| not_found("List not found"))?;
    if list.visibility != "public" && list.user_email != user_email {
        return Err(not_found("List not found"));
    }

    sqlx::query(
        r#"
        INSERT INTO user_favorites (user_email, list_id)
        VALUES ($1, $2)
        ON CONFLICT (user_email, list_id) DO NOTHING
        "#,
    )
    .bind(&user_email)
    .bind(list_id)
    .execute(&state.db)
    .await
    .map_err(internal_error)?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn remove_favorite(
    Path(list_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<FavoriteBody>,
) -> ApiResult<serde_json::Value> {
    let user_email = payload
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;

    sqlx::query("DELETE FROM user_favorites WHERE user_email = $1 AND list_id = $2")
        .bind(&user_email)
        .bind(list_id)
        .execute(&state.db)
        .await
        .map_err(internal_error)?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn insert_list(
    state: &AppState,
    title: &str,
    movies: &[i32],
    color: Option<String>,
    user_email: &str,
) -> Result<ListRow, (StatusCode, Json<ErrorResponse>)> {
    let slug = generate_slug(title, user_email, &state.db).await.map_err(internal_error)?;
    let normalized_color = normalize_color(color);

    let created_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO lists (id, title, slug, visibility, movies, color, user_email)
        VALUES ($1, $2, $3, 'private', $4, $5, $6)
        "#,
    )
    .bind(created_id)
    .bind(title)
    .bind(&slug)
    .bind(movies)
    .bind(&normalized_color)
    .bind(user_email)
    .execute(&state.db)
    .await
    .map_err(internal_error)?;

    fetch_list_by_id(created_id, &state.db)
        .await?
        .ok_or_else(|| internal_error("List not found"))
}

async fn fetch_tmdb_search(
    state: &AppState,
    query: &str,
    year: Option<&str>,
) -> Result<Vec<SimplifiedMovieDto>, (StatusCode, Json<ErrorResponse>)> {
    let mut params: Vec<(&str, &str)> = vec![
        ("query", query),
        ("include_adult", "false"),
        ("language", "en-US"),
        ("page", "1"),
    ];
    if let Some(year) = year {
        params.push(("year", year));
    }

    let payload = fetch_from_strawberry::<TmdbSearchResponse>(state, "/search/movie", &params).await?;
    let results = payload
        .results
        .into_iter()
        .filter_map(map_tmdb_movie)
        .take(8)
        .collect();
    Ok(results)
}

async fn fetch_tmdb_movie(
    state: &AppState,
    tmdb_id: i32,
) -> Result<SimplifiedMovieDto, (StatusCode, Json<ErrorResponse>)> {
    let params = [("language", "en-US"), ("append_to_response", "external_ids")];

    let payload =
        fetch_from_strawberry::<TmdbMovieDetailsResult>(state, &format!("/movie/{tmdb_id}"), &params).await?;
    let mut movie = map_tmdb_movie_details(payload.clone());

    if let Some(imdb_id) = payload
        .imdb_id
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        if let Some((imdb_rating, letterboxd_rating)) = fetch_external_ratings(state, imdb_id).await {
            movie.imdb_rating = imdb_rating;
            movie.letterboxd_rating = letterboxd_rating;
        }
    }

    Ok(movie)
}

async fn search_tmdb_id(
    state: &AppState,
    title: &str,
    year: Option<&str>,
) -> Result<Option<i32>, (StatusCode, Json<ErrorResponse>)> {
    let results = fetch_tmdb_search(state, title, year).await?;
    Ok(results.first().map(|movie| movie.tmdb_id))
}

async fn fetch_from_strawberry<T>(
    state: &AppState,
    path: &str,
    query: &[(&str, &str)],
) -> Result<T, (StatusCode, Json<ErrorResponse>)>
where
    T: DeserializeOwned,
{
    let url = format!("{}/tmdb{}", state.strawberry_base_url.trim_end_matches('/'), path);
    let response = state
        .client
        .get(url)
        .query(query)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| internal_error(error.to_string()))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        warn!("Strawberry TMDB returned {}: {}", status, body);
        return Err(internal_error("Unable to fetch TMDB data from Strawberry"));
    }

    response
        .json::<T>()
        .await
        .map_err(|error| internal_error(error.to_string()))
}

async fn fetch_external_ratings(
    state: &AppState,
    imdb_id: &str,
) -> Option<(Option<f32>, Option<f32>)> {
    let url = format!("{}/ratings/{}", state.strawberry_base_url.trim_end_matches('/'), imdb_id);
    let response = state
        .client
        .get(url)
        .header("Accept", "application/json")
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    let body: serde_json::Value = response.json().await.ok()?;
    let imdb_rating = body
        .get("imdbRating")
        .and_then(|value| value.as_f64())
        .map(|value| value as f32);
    let letterboxd_rating = body
        .get("letterboxdRating")
        .and_then(|value| value.as_f64())
        .map(|value| value as f32);
    Some((imdb_rating, letterboxd_rating))
}

fn map_tmdb_movie(result: TmdbMovieResult) -> Option<SimplifiedMovieDto> {
    let title = result
        .title
        .or(result.name)
        .unwrap_or_else(|| "Untitled film".to_string());
    let release_year = parse_release_year(&result.release_date);
    let rating = result.vote_average.map(|value| (value * 10.0).round() / 10.0);
    let poster_url = result
        .poster_path
        .map(|path| format!("{TMDB_IMAGE_BASE}{path}"));

    Some(SimplifiedMovieDto {
        tmdb_id: result.id,
        title,
        overview: result.overview,
        release_year,
        rating,
        imdb_rating: result.imdb_rating,
        letterboxd_rating: result.letterboxd_rating,
        imdb_id: None,
        poster_url,
        runtime: None,
        genres: None,
        tagline: None,
    })
}

fn map_tmdb_movie_details(result: TmdbMovieDetailsResult) -> SimplifiedMovieDto {
    let genres = result.genres.map(|items| {
        items
            .into_iter()
            .filter_map(|genre| genre.name)
            .collect::<Vec<_>>()
    });
    let release_year = parse_release_year(&result.release_date);
    let rating = result.vote_average.map(|value| (value * 10.0).round() / 10.0);
    let poster_url = result
        .poster_path
        .map(|path| format!("{TMDB_IMAGE_BASE}{path}"));
    let title = result
        .title
        .or(result.name)
        .unwrap_or_else(|| "Untitled film".to_string());

    SimplifiedMovieDto {
        tmdb_id: result.id,
        title,
        overview: result.overview,
        release_year,
        rating,
        imdb_rating: result.imdb_rating,
        letterboxd_rating: result.letterboxd_rating,
        imdb_id: result.imdb_id,
        poster_url,
        runtime: result.runtime,
        genres,
        tagline: result.tagline,
    }
}

fn parse_release_year(date: &Option<String>) -> Option<i32> {
    date.as_ref()
        .and_then(|value| value.get(0..4))
        .and_then(|year| year.parse::<i32>().ok())
}

fn parse_imported_titles(raw: &str) -> Vec<ParsedEntry> {
    let lines: Vec<String> = raw
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();
    if lines.is_empty() {
        return Vec::new();
    }

    let first_line = lines[0].to_lowercase();
    let default_source = if first_line.contains("your rating") {
        "import"
    } else if first_line.contains("imdb") {
        "imdb"
    } else if first_line.contains("letterboxd") {
        "letterboxd"
    } else {
        "imdb"
    }
    .to_string();

    if first_line.contains("title") || first_line.contains("name") {
        let headers = parse_csv_line(&lines[0])
            .into_iter()
            .map(|cell| cell.to_lowercase())
            .collect::<Vec<_>>();
        let title_index = headers.iter().position(|cell| {
            cell == "title"
                || cell == "primarytitle"
                || cell == "name"
                || cell == "movie title"
                || cell == "film title"
                || (cell.contains("title") && !cell.contains("list"))
        });
        if title_index.is_none() {
            return Vec::new();
        }
        let year_index = headers
            .iter()
            .position(|cell| cell == "year" || cell == "release year" || cell == "startyear");
        let tmdb_id_index = headers
            .iter()
            .position(|cell| cell == "tmdb id" || cell == "tmdbid" || cell == "tmdb_id");
        let rating_index = headers
            .iter()
            .position(|cell| cell == "your rating" || cell == "rating");

        return lines
            .iter()
            .skip(1)
            .filter_map(|line| {
                let cells = parse_csv_line(line);
                let title = title_index.and_then(|idx| cells.get(idx)).map(|value| value.trim().to_string());
                let title = title.filter(|value| !value.is_empty())?;
                let year = year_index
                    .and_then(|idx| cells.get(idx))
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty());
                let tmdb_id = tmdb_id_index
                    .and_then(|idx| cells.get(idx))
                    .and_then(|value| value.trim().parse::<i32>().ok());
                let rating = rating_index
                    .and_then(|idx| cells.get(idx))
                    .and_then(|value| normalize_import_rating(Some(value.as_str())));
                Some(ParsedEntry {
                    title,
                    year,
                    rating,
                    source: default_source.clone(),
                    tmdb_id,
                })
            })
            .collect();
    }

    lines
        .into_iter()
        .filter_map(|line| {
            let trimmed = line.trim().trim_matches('"').to_string();
            if trimmed.is_empty() {
                return None;
            }
            if let Some((title, year_part)) = trimmed.rsplit_once('(') {
                let year_candidate = year_part.trim_end_matches(')').trim();
                if year_candidate.len() == 4 && year_candidate.chars().all(|c| c.is_ascii_digit()) {
                    return Some(ParsedEntry {
                        title: title.trim().to_string(),
                        year: Some(year_candidate.to_string()),
                        rating: None,
                        source: default_source.clone(),
                        tmdb_id: None,
                    });
                }
            }
            Some(ParsedEntry {
                title: trimmed,
                year: None,
                rating: None,
                source: default_source.clone(),
                tmdb_id: None,
            })
        })
        .collect()
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut cells = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(char) = chars.next() {
        match char {
            '"' => {
                if in_quotes && chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
                    in_quotes = !in_quotes;
                }
            }
            ',' if !in_quotes => {
                cells.push(current.trim().to_string());
                current.clear();
            }
            _ => current.push(char),
        }
    }

    cells.push(current.trim().to_string());
    cells
        .into_iter()
        .map(|cell| cell.trim_matches('"').to_string())
        .collect()
}

fn normalize_import_rating(raw: Option<&str>) -> Option<i32> {
    let value = raw?.trim();
    if value.is_empty() {
        return None;
    }
    let parsed: f32 = value.parse().ok()?;
    if parsed <= 0.0 {
        return None;
    }
    let rounded = if parsed <= 5.0 {
        (parsed * 2.0).round() as i32
    } else {
        parsed.round() as i32
    };
    if (1..=10).contains(&rounded) {
        Some(rounded)
    } else {
        None
    }
}

fn slugify(input: &str) -> String {
    let lowered = input.to_lowercase().trim().to_string();
    let mut slug: String = lowered
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    while slug.contains("--") {
        slug = slug.replace("--", "-");
    }
    let trimmed = slug.trim_matches('-').to_string();
    let truncated: String = trimmed.chars().take(60).collect();
    if truncated.is_empty() {
        "list".into()
    } else {
        truncated
    }
}

fn normalize_color(color: Option<String>) -> String {
    let Some(value) = color else {
        return DEFAULT_COLOR.to_string();
    };
    let trimmed = value.trim().to_lowercase();
    if trimmed.is_empty() {
        return DEFAULT_COLOR.to_string();
    }
    if ALLOWED_COLORS.iter().any(|option| option == &trimmed) {
        trimmed
    } else {
        DEFAULT_COLOR.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_exported_csv_with_tmdb_ids() {
        let raw = "List Name,Movie Title,TMDB ID,Release Year,Your Rating,TMDB Rating,IMDb Rating,Letterboxd Rating\nSaturday Double Feature,Memento,77,2000,10,8.2,8.4,4.18";
        let entries = parse_imported_titles(raw);
        assert_eq!(entries.len(), 1);
        let entry = &entries[0];
        assert_eq!(entry.title, "Memento");
        assert_eq!(entry.tmdb_id, Some(77));
        assert_eq!(entry.year.as_deref(), Some("2000"));
        assert_eq!(entry.rating, Some(10));
        assert_eq!(entry.source, "import");
    }
}

async fn generate_slug(title: &str, user_email: &str, pool: &PgPool) -> Result<String, sqlx::Error> {
    let base = slugify(title);
    let mut slug = base.clone();
    let mut counter = 1;
    loop {
        let existing = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM lists WHERE user_email = $1 AND slug = $2 LIMIT 1",
        )
        .bind(user_email)
        .bind(&slug)
        .fetch_optional(pool)
        .await?;
        if existing.is_none() {
            return Ok(slug);
        }
        slug = format!("{base}-{counter}");
        counter += 1;
    }
}

async fn ensure_slug_available(
    slug: &str,
    id: Uuid,
    pool: &PgPool,
    user_email: &str,
) -> Result<String, sqlx::Error> {
    let base = slugify(slug);
    let mut candidate = base.clone();
    let mut counter = 1;
    loop {
        let existing = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM lists WHERE user_email = $1 AND slug = $2 AND id <> $3 LIMIT 1",
        )
        .bind(user_email)
        .bind(&candidate)
        .bind(id)
        .fetch_optional(pool)
        .await?;
        if existing.is_none() {
            return Ok(candidate);
        }
        candidate = format!("{base}-{counter}");
        counter += 1;
    }
}

async fn fetch_list_by_id(
    id: Uuid,
    pool: &PgPool,
) -> Result<Option<ListRow>, (StatusCode, Json<ErrorResponse>)> {
    sqlx::query_as::<_, ListRow>(
        r#"
        SELECT lists.*, profiles.username
        FROM lists
        LEFT JOIN profiles ON lists.user_email = profiles.user_email
        WHERE lists.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(internal_error)
}

async fn ensure_user_has_username(
    pool: &PgPool,
    user_email: &str,
) -> Result<(), (StatusCode, Json<ErrorResponse>)> {
    let username = sqlx::query_scalar::<_, String>("SELECT username FROM profiles WHERE user_email = $1")
        .bind(user_email)
        .fetch_optional(pool)
        .await
        .map_err(internal_error)?;
    if username.is_none() {
        return Err(bad_request("Set a username before making lists public"));
    }
    Ok(())
}

fn normalize_visibility(raw: &str) -> Result<String, (StatusCode, Json<ErrorResponse>)> {
    let trimmed = raw.trim().to_lowercase();
    if trimmed.is_empty() {
        return Ok("private".to_string());
    }
    match trimmed.as_str() {
        "public" | "private" => Ok(trimmed),
        _ => Err(bad_request("visibility must be public or private")),
    }
}

fn normalize_username(raw: &str) -> Result<String, (StatusCode, Json<ErrorResponse>)> {
    let trimmed = raw.trim().to_lowercase();
    if trimmed.len() < 3 {
        return Err(bad_request("username must be at least 3 characters"));
    }
    if !trimmed.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(bad_request("username must be alphanumeric only"));
    }
    Ok(trimmed)
}

fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

async fn save_ratings(
    State(state): State<AppState>,
    Json(payload): Json<SaveRatingsBody>,
) -> ApiResult<serde_json::Value> {
    let email = payload
        .user_email
        .as_ref()
        .map(|value| normalize_email(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| bad_request("userEmail is required"))?;

    let entries = payload.ratings.unwrap_or_default();
    if entries.is_empty() {
        return Ok(Json(serde_json::json!({ "updated": 0 })));
    }

    let mut normalized: Vec<RatingInput> = Vec::new();
    for entry in entries {
        let tmdb_id = entry.tmdb_id.ok_or_else(|| bad_request("tmdbId is required"))?;
        let rating = entry.rating.ok_or_else(|| bad_request("rating is required"))?;
        if !(1..=10).contains(&rating) {
            return Err(bad_request("rating must be between 1 and 10"));
        }
        let source = entry.source.unwrap_or_else(|| "tmdb".to_string());
        normalized.push(RatingInput {
            tmdb_id,
            rating,
            source,
        });
    }

    let updated = upsert_ratings(&state.db, &email, &normalized).await?;

    Ok(Json(serde_json::json!({ "updated": updated })))
}

async fn upsert_ratings(
    db: &PgPool,
    user_email: &str,
    ratings: &[RatingInput],
) -> Result<usize, (StatusCode, Json<ErrorResponse>)> {
    let mut updated = 0usize;
    for entry in ratings {
        sqlx::query(
            r#"
            INSERT INTO user_ratings (user_email, tmdb_id, rating, source)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_email, tmdb_id)
            DO UPDATE SET rating = EXCLUDED.rating, source = EXCLUDED.source, updated_at = NOW()
            "#,
        )
        .bind(user_email)
        .bind(entry.tmdb_id)
        .bind(entry.rating)
        .bind(&entry.source)
        .execute(db)
        .await
        .map_err(internal_error)?;
        updated += 1;
    }
    Ok(updated)
}

async fn get_rating(
    Path((user_email, tmdb_id)): Path<(String, i32)>,
    State(state): State<AppState>,
) -> ApiResult<RatingValueEnvelope> {
    let email = normalize_email(&user_email);
    if email.is_empty() {
        return Err(bad_request("userEmail is required"));
    }
    let rating = sqlx::query_scalar::<_, i32>(
        "SELECT rating FROM user_ratings WHERE user_email = $1 AND tmdb_id = $2",
    )
    .bind(&email)
    .bind(tmdb_id)
    .fetch_optional(&state.db)
    .await
    .map_err(internal_error)?;

    Ok(Json(RatingValueEnvelope { rating }))
}

async fn list_ratings_for_user(
    Path(user_email): Path<String>,
    State(state): State<AppState>,
) -> ApiResult<RatingsEnvelope> {
    let email = normalize_email(&user_email);
    if email.is_empty() {
        return Err(bad_request("userEmail is required"));
    }

    let rows = sqlx::query_as::<_, RatingRow>(
        "SELECT * FROM user_ratings WHERE user_email = $1 ORDER BY updated_at DESC",
    )
    .bind(&email)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    let ratings = rows.into_iter().map(RatingResponse::from).collect();
    Ok(Json(RatingsEnvelope { ratings }))
}

fn bad_request(message: &str) -> (StatusCode, Json<ErrorResponse>) {
    (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: message.into() }))
}

fn conflict(message: &str) -> (StatusCode, Json<ErrorResponse>) {
    (StatusCode::CONFLICT, Json(ErrorResponse { error: message.into() }))
}

fn not_found(message: &str) -> (StatusCode, Json<ErrorResponse>) {
    (StatusCode::NOT_FOUND, Json(ErrorResponse { error: message.into() }))
}

fn internal_error(error: impl std::fmt::Display) -> (StatusCode, Json<ErrorResponse>) {
    error!("Internal error: {error}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            error: "Internal server error".into(),
        }),
    )
}

fn parse_ssl_mode(raw: String) -> PgSslMode {
    match raw.to_lowercase().as_str() {
        "disable" => PgSslMode::Disable,
        "prefer" => PgSslMode::Prefer,
        "require" => PgSslMode::Require,
        "verify-ca" => PgSslMode::VerifyCa,
        "verify-full" => PgSslMode::VerifyFull,
        _ => PgSslMode::Require,
    }
}
