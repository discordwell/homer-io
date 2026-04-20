-- Email-link verification tokens (for work-email → tenant migration flow).
-- Moved out of users.email_verification_token so that:
--   1. Atomic single-use consumption is possible (UPDATE ... WHERE used_at IS NULL RETURNING ...)
--   2. Multiple outstanding tokens per user are safe
--   3. Password reset can invalidate all outstanding tokens cleanly
CREATE TABLE IF NOT EXISTS email_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(255) NOT NULL,
  work_email varchar(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_link_tokens_token_hash ON email_link_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_link_tokens_user_id ON email_link_tokens(user_id);
