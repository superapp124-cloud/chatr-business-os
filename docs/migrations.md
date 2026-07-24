# Migration Strategy & Principles

Migrations in CHATR must be strictly non-destructive to ensure high availability and zero data loss.

## The Zero-Downtime Lifecycle
1. **Add**: Introduce new tables, columns, or schemas via SQL.
2. **Dual-Write**: Update application services to write to both the old and new structures.
3. **Read Swap**: Switch application reads to the new schema.
4. **Validate**: Monitor production observability logs for error rates.
5. **Deprecate**: Mark old code/columns as legacy.
6. **Drop**: Author a final SQL migration to remove the legacy column ONLY after total validation.

## Rules
- 🚫 **NEVER** drop a column in the same migration where you replace it.
- 🚫 **NEVER** rename a column in production (Add new, copy data, drop old).
- ✅ **ALWAYS** define an `up` and `down` rollback strategy (even if theoretical).
- ✅ **ALWAYS** enforce RLS on new tables immediately.
