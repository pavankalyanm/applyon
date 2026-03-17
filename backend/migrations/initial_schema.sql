-- users: local auth accounts
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NULL,
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  INDEX idx_users_email (email)
);

-- configs: per-user serialized config blobs
CREATE TABLE IF NOT EXISTS configs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL UNIQUE,
  personals   LONGTEXT NULL,
  questions   LONGTEXT NULL,
  search      LONGTEXT NULL,
  settings    LONGTEXT NULL,
  resume      LONGTEXT NULL,
  created_at  DATETIME NOT NULL,
  updated_at  DATETIME NOT NULL,
  CONSTRAINT fk_configs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
);

-- runs: bot executions
CREATE TABLE IF NOT EXISTS runs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at       DATETIME NOT NULL,
  finished_at      DATETIME NULL,
  pid              INT NULL,
  stop_requested_at DATETIME NULL,
  killed_at        DATETIME NULL,
  config_snapshot  LONGTEXT NULL,
  log_excerpt      LONGTEXT NULL,
  error_message    LONGTEXT NULL,
  INDEX idx_runs_user (user_id),
  CONSTRAINT fk_runs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
);

-- job_applications: jobs seen/applied/skipped per run
CREATE TABLE IF NOT EXISTS job_applications (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  run_id          INT NOT NULL,
  user_id         INT NOT NULL,
  job_id          VARCHAR(64) NULL,
  title           VARCHAR(255) NULL,
  company         VARCHAR(255) NULL,
  location        VARCHAR(255) NULL,
  work_style      VARCHAR(255) NULL,
  date_posted     DATETIME NULL,
  date_applied    DATETIME NULL,
  application_type VARCHAR(20) NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'applied',
  pipeline_status VARCHAR(20) NOT NULL DEFAULT 'applied',
  reason_skipped  LONGTEXT NULL,
  job_link        LONGTEXT NULL,
  external_link   LONGTEXT NULL,
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL,
  INDEX idx_jobs_user (user_id),
  INDEX idx_jobs_run (run_id),
  INDEX idx_jobs_jobid (job_id),
  CONSTRAINT fk_jobs_run
    FOREIGN KEY (run_id) REFERENCES runs(id)
      ON DELETE CASCADE,
  CONSTRAINT fk_jobs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
);
