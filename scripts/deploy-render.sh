#!/usr/bin/env bash
# Deploy HarvestHub API to Render (Docker free web service) via CLI.
#
# One-time setup:
#   1. Install CLI: https://render.com/docs/cli
#      curl -fsSL https://raw.githubusercontent.com/render-oss/cli/main/install.sh | sh
#      # or download v2+ from https://github.com/render-oss/cli/releases
#   2. Auth (pick one):
#        render login
#      OR create API key at https://dashboard.render.com/u/settings#api-keys
#        export RENDER_API_KEY=rnd_...
#   3. Connect GitHub to Render in the dashboard (Account → Linked Accounts)
#   4. From repo root, with .env filled:
#        chmod +x scripts/deploy-render.sh
#        ./scripts/deploy-render.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v render >/dev/null 2>&1; then
  echo "Render CLI not found. Install from https://render.com/docs/cli"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing .env — copy from .env.example and fill TiDB credentials"
  exit 1
fi

# Load .env (simple KEY=VAL lines)
set -a
# shellcheck disable=SC1091
source .env
set +a

NAME="${RENDER_SERVICE_NAME:-harvesthub-api}"
REPO="${RENDER_REPO:-https://github.com/akash-helium/market-place-app}"
REGION="${RENDER_REGION:-singapore}"
PLAN="${RENDER_PLAN:-free}"
JWT="${JWT_SECRET:-$(openssl rand -hex 24)}"

# APP_URL is set after first deploy; use placeholder then update
APP_URL_VAL="${APP_URL:-https://${NAME}.onrender.com}"

echo "Creating/updating Render web service: $NAME"
echo "Repo: $REPO (Docker)"

# Non-interactive create (CLI v2+)
render services create \
  --name "$NAME" \
  --type web_service \
  --repo "$REPO" \
  --branch main \
  --runtime docker \
  --plan "$PLAN" \
  --region "$REGION" \
  --health-check-path /health \
  --env-var "PORT=3000" \
  --env-var "NODE_ENV=production" \
  --env-var "APP_URL=${APP_URL_VAL}" \
  --env-var "DB_HOST=${DB_HOST}" \
  --env-var "DB_PORT=${DB_PORT}" \
  --env-var "DB_USER=${DB_USER}" \
  --env-var "DB_PASSWORD=${DB_PASSWORD}" \
  --env-var "DB_NAME=${DB_NAME}" \
  --env-var "DB_SSL=true" \
  --env-var "JWT_SECRET=${JWT}" \
  --env-var "JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-30d}" \
  --env-var "SMS_PROVIDER=console" \
  --env-var "OTP_DEV_CODE=000000" \
  --env-var "UPLOAD_DIR=./uploads" \
  --env-var "PAYMENT_PROVIDER=mock" \
  --env-var "ADMIN_API_KEY=${ADMIN_API_KEY:-harvesthub-admin-dev-key}" \
  --output json \
  --confirm

echo ""
echo "Deploy kicked off. Watch logs:"
echo "  render logs -o text"
echo "When live, open https://${NAME}.onrender.com/health"
echo "If the URL differs, update APP_URL in the Render dashboard to match."
