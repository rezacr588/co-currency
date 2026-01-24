package repository

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

const uniqueViolationCode = "23505"

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == uniqueViolationCode
}

// isDuplicateKeyError is kept for backward compatibility with existing call sites.
func isDuplicateKeyError(err error) bool {
	return isUniqueViolation(err)
}
