-- Migration: 0026 - Enable agent by default for all users
-- Description: Flip enabled=TRUE for every existing agent_config row.
-- The column already defaults to TRUE (migration 0021), so new inserts are
-- unaffected; this backfills users who landed on FALSE before we decided
-- autopilot should be on out of the box.
--
-- Safe to re-run: UPDATE is idempotent.

UPDATE agent_config
SET enabled = TRUE, updated_at = NOW()
WHERE enabled = FALSE;
