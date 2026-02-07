-- Enforce category uniqueness and clean up existing duplicates

-- Normalize category names first
UPDATE categories
SET name = TRIM(name)
WHERE name <> TRIM(name);

-- Remove invalid user categories with empty names
DELETE FROM categories
WHERE is_default = FALSE
  AND user_id IS NOT NULL
  AND TRIM(name) = '';

-- Deduplicate default categories by normalized name, keep earliest created record
WITH ranked_defaults AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(name))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM categories
  WHERE is_default = TRUE
)
DELETE FROM categories c
USING ranked_defaults r
WHERE c.id = r.id
  AND r.rn > 1;

-- Deduplicate user categories by user + normalized name, keep earliest created record
WITH ranked_user_categories AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, LOWER(TRIM(name))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM categories
  WHERE is_default = FALSE
    AND user_id IS NOT NULL
)
DELETE FROM categories c
USING ranked_user_categories r
WHERE c.id = r.id
  AND r.rn > 1;

-- Enforce unique default category names (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_default_name_unique
ON categories ((LOWER(TRIM(name))))
WHERE is_default = TRUE;

-- Enforce unique user category names per user (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name_unique
ON categories (user_id, (LOWER(TRIM(name))))
WHERE is_default = FALSE
  AND user_id IS NOT NULL;
