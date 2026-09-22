CREATE TABLE hazel_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)