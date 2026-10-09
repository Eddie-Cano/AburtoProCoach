CREATE TABLE IF NOT EXISTS aburto_team.member_app_usage (
 member_id uuid PRIMARY KEY REFERENCES aburto_team.members(id) ON DELETE CASCADE,
 first_opened_at timestamptz NOT NULL DEFAULT now(),
 last_opened_at timestamptz NOT NULL DEFAULT now(),
 last_active_at timestamptz NOT NULL DEFAULT now(),
 open_count bigint NOT NULL DEFAULT 0,
 first_installed_at timestamptz,
 installed_platform text CHECK (installed_platform IS NULL OR installed_platform IN ('ios','android','other')),
 last_install_mode text CHECK (last_install_mode IS NULL OR last_install_mode IN ('standalone','appinstalled'))
);
CREATE INDEX IF NOT EXISTS team_app_usage_active ON aburto_team.member_app_usage(last_active_at DESC);
CREATE TABLE IF NOT EXISTS aburto_team.member_activity_days (
 member_id uuid NOT NULL REFERENCES aburto_team.members(id) ON DELETE CASCADE,
 activity_date date NOT NULL DEFAULT current_date,
 opens integer NOT NULL DEFAULT 0,
 last_active_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(member_id, activity_date)
);
CREATE INDEX IF NOT EXISTS team_member_activity_date ON aburto_team.member_activity_days(activity_date DESC);
