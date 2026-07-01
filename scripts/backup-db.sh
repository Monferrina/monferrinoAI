#!/usr/bin/env bash
# Backup del DB Supabase (schema public) → Cloudflare R2 (S3-compatibile).
# Free tier Supabase = NESSUN backup automatico → questo è il nostro backup.
# pg_dump gira sul pooler in SESSION mode (5432): il transaction mode (6543) non
# regge un dump coerente (vedi wiki supabase). Password raw (contiene '#').
#
# Env richiesti: SUPABASE_DB_HOST/NAME/USER/PASSWORD, SUPABASE_PROJECT_REGION,
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
# Uso: scripts/backup-db.sh [prefix]      (prefix default: manual)
#
# Retention: gestita dalle lifecycle rule di R2 (per prefisso), non qui.
set -euo pipefail

PREFIX="${1:-manual}"
REF="$(printf '%s' "$SUPABASE_DB_HOST" | cut -d. -f2)"          # db.<ref>.supabase.co → <ref>
HOST="aws-0-${SUPABASE_PROJECT_REGION}.pooler.supabase.com"
STAMP="$(date -u +%Y-%m-%d_%H%M)"
FILE="monferrino-db-${STAMP}.sql.gz"

echo "pg_dump ${SUPABASE_DB_NAME} (schema public) via ${HOST}:5432 …"
PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
  -h "$HOST" -p 5432 -U "${SUPABASE_DB_USER}.${REF}" -d "$SUPABASE_DB_NAME" \
  --schema=public --no-owner --no-privileges \
  | gzip -9 > "$FILE"
echo "dump creato: ${FILE} ($(du -h "$FILE" | cut -f1))"

# aws-cli v2.23+ aggiunge checksum CRC32 che R2 rifiuta → when_required li disattiva.
echo "upload → r2://${R2_BUCKET}/${PREFIX}/${FILE}"
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION="auto" \
AWS_REQUEST_CHECKSUM_CALCULATION="when_required" \
AWS_RESPONSE_CHECKSUM_VALIDATION="when_required" \
aws s3 cp "$FILE" "s3://${R2_BUCKET}/${PREFIX}/${FILE}" \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

rm -f "$FILE"
echo "✅ backup ok: ${PREFIX}/${FILE}"
