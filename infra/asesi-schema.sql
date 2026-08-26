-- Schema dedicado do Jangada no banco h_asesi (não usa o schema farol).
-- Aplicado automaticamente na primeira conexão; este arquivo é o contrato DBA.

CREATE SCHEMA IF NOT EXISTS trelloai;

CREATE TABLE IF NOT EXISTS trelloai.board_snapshots (
  board_id TEXT PRIMARY KEY,
  snapshot JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trelloai.board_memberships (
  email TEXT NOT NULL,
  board_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (email, board_id)
);

CREATE TABLE IF NOT EXISTS trelloai.users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role TEXT NOT NULL DEFAULT 'user',
  username TEXT
);

ALTER TABLE trelloai.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE trelloai.users ADD COLUMN IF NOT EXISTS username TEXT;
UPDATE trelloai.users SET username = split_part(email, '@', 1) WHERE username IS NULL OR btrim(username) = '';
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON trelloai.users (lower(username));

CREATE TABLE IF NOT EXISTS trelloai.invites (
  token TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  board_title TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  invitee_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_email TEXT,
  accepted_emails JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS invites_board_id_idx ON trelloai.invites (board_id);
CREATE INDEX IF NOT EXISTS memberships_board_id_idx ON trelloai.board_memberships (board_id);

CREATE TABLE IF NOT EXISTS trelloai.user_board_visibility (
  email TEXT PRIMARY KEY,
  board_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
