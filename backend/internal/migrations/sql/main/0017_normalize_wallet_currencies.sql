-- Normalize wallet currency codes to trimmed uppercase and merge duplicate balances.

WITH normalized_balances AS (
    SELECT
        MIN(id::text)::uuid AS keep_id,
        user_id,
        UPPER(TRIM(currency)) AS normalized_currency,
        SUM(balance) AS total_balance,
        MAX(updated_at) AS latest_updated_at
    FROM wallet_balances
    GROUP BY user_id, UPPER(TRIM(currency))
)
UPDATE wallet_balances wb
SET balance = nb.total_balance,
    updated_at = nb.latest_updated_at
FROM normalized_balances nb
WHERE wb.id = nb.keep_id
  AND (
      wb.balance IS DISTINCT FROM nb.total_balance
      OR wb.updated_at IS DISTINCT FROM nb.latest_updated_at
  );

WITH normalized_balances AS (
    SELECT
        MIN(id::text)::uuid AS keep_id,
        user_id,
        UPPER(TRIM(currency)) AS normalized_currency
    FROM wallet_balances
    GROUP BY user_id, UPPER(TRIM(currency))
)
DELETE FROM wallet_balances wb
USING normalized_balances nb
WHERE wb.user_id = nb.user_id
  AND UPPER(TRIM(wb.currency)) = nb.normalized_currency
  AND wb.id <> nb.keep_id;

WITH normalized_balances AS (
    SELECT
        MIN(id::text)::uuid AS keep_id,
        user_id,
        UPPER(TRIM(currency)) AS normalized_currency
    FROM wallet_balances
    GROUP BY user_id, UPPER(TRIM(currency))
)
UPDATE wallet_balances wb
SET currency = nb.normalized_currency
FROM normalized_balances nb
WHERE wb.id = nb.keep_id
  AND wb.currency IS DISTINCT FROM nb.normalized_currency;

UPDATE transactions
SET currency = UPPER(TRIM(currency))
WHERE currency IS DISTINCT FROM UPPER(TRIM(currency));

UPDATE transactions
SET to_currency = UPPER(TRIM(to_currency))
WHERE to_currency IS NOT NULL
  AND to_currency IS DISTINCT FROM UPPER(TRIM(to_currency));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'wallet_balances_currency_canonical'
    ) THEN
        ALTER TABLE wallet_balances
        ADD CONSTRAINT wallet_balances_currency_canonical
        CHECK (currency = UPPER(BTRIM(currency)));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_currency_canonical'
    ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_currency_canonical
        CHECK (currency = UPPER(BTRIM(currency)));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_to_currency_canonical'
    ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_to_currency_canonical
        CHECK (to_currency IS NULL OR to_currency = UPPER(BTRIM(to_currency)));
    END IF;
END $$;
