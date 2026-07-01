#!/usr/bin/env bash
# RESTORE del DB da un backup su R2 verso un DB TARGET. ⚠️ DISTRUTTIVO.
# Ripristina di norma su un progetto Supabase NUOVO/scratch, non su produzione.
# Il target deve avere l'estensione pgvector (Supabase: `create extension if not
# exists vector;` prima, oppure è già presente).
#
# Env richiesti: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
# Uso:
#   scripts/restore-db.sh <key-R2> <TARGET_DSN>
#   es. scripts/restore-db.sh weekly/monferrino-db-2026-07-06_0300.sql.gz \
#         "postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres"
set -euo pipefail

KEY="${1:?path R2 del backup, es. weekly/monferrino-db-….sql.gz}"
TARGET="${2:?connection string psql del DB target}"

echo "⚠️  RESTORE del backup '${KEY}' sul target — 5s per annullare (Ctrl-C)…"
sleep 5

TMP="$(mktemp -t restore-XXXX.sql.gz)"
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION="auto" \
AWS_REQUEST_CHECKSUM_CALCULATION="when_required" \
AWS_RESPONSE_CHECKSUM_VALIDATION="when_required" \
aws s3 cp "s3://${R2_BUCKET}/${KEY}" "$TMP" \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

echo "applico il dump con psql…"
gunzip -c "$TMP" | psql "$TARGET"
rm -f "$TMP"
echo "✅ restore completato"
