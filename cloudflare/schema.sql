PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  restaurant_id TEXT,
  password_hash TEXT,
  password_plain TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  accent TEXT DEFAULT '#D95F2B',
  template TEXT DEFAULT 'default',
  hero_images_json TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL DEFAULT 0,
  image TEXT DEFAULT '',
  model_glb TEXT DEFAULT '',
  model_usdz TEXT DEFAULT '',
  category TEXT DEFAULT '',
  scans_json TEXT DEFAULT '[]',
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL,
  table_label TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total REAL DEFAULT 0,
  status TEXT DEFAULT 'novo',
  created_at TEXT NOT NULL,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS model_jobs (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  provider TEXT DEFAULT 'manual',
  ai_model TEXT DEFAULT '',
  auto_mode INTEGER DEFAULT 0,
  status TEXT DEFAULT 'enviado',
  notes TEXT DEFAULT '',
  model_glb TEXT DEFAULT '',
  model_usdz TEXT DEFAULT '',
  reference_images_json TEXT DEFAULT '[]',
  provider_task_id TEXT DEFAULT '',
  provider_task_endpoint TEXT DEFAULT '',
  provider_status TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT DEFAULT '',
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  first_failed_at INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_restaurant ON items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_restaurant ON model_jobs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_item ON model_jobs(item_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
