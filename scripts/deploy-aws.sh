#!/usr/bin/env bash
# Deploy TrelloAI to AWS App Runner (ECR + Docker).
set -euo pipefail

# Avoid broken local proxy from IDE sandboxes
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy || true

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REPO_NAME="${ECR_REPO:-trelloai}"
SERVICE_NAME="${APP_RUNNER_SERVICE:-trelloai}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}:${IMAGE_TAG}"
ROLE_NAME="AppRunnerECRAccessRole"

echo "==> Region: ${REGION}  Account: ${ACCOUNT_ID}"

if ! aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "==> Creating ECR repository ${REPO_NAME}"
  aws ecr create-repository --repository-name "$REPO_NAME" --region "$REGION" >/dev/null
fi

if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "==> Creating IAM role ${ROLE_NAME}"
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://${ROOT}/infra/apprunner-ecr-trust.json" >/dev/null
  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
  echo "==> Waiting for IAM role propagation..."
  sleep 12
fi

ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)"

echo "==> Logging into ECR"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "==> Building image (linux/amd64)"
docker build --platform linux/amd64 -t "${REPO_NAME}:${IMAGE_TAG}" .

echo "==> Pushing ${ECR_URI}"
docker tag "${REPO_NAME}:${IMAGE_TAG}" "$ECR_URI"
docker push "$ECR_URI"

ENV_FILE="${ROOT}/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env.local — copy from .env.example and fill Auth/Google values." >&2
  exit 1
fi

# Parse .env.local safely (supports quoted values; does not print secrets)
eval "$(python3 - <<'PY' "$ENV_FILE"
from pathlib import Path
import shlex, sys
path = Path(sys.argv[1])
for raw in path.read_text().splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, val = line.split("=", 1)
    key = key.strip()
    val = val.strip()
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1]
    if key:
        print(f"{key}={shlex.quote(val)}")
PY
)"

: "${AUTH_SECRET:?AUTH_SECRET required in .env.local}"

# If AUTH_URL still points to localhost, leave blank for first create; we'll patch after URL is known
if [[ "${AUTH_URL:-}" == http://localhost* || "${AUTH_URL:-}" == https://localhost* ]]; then
  AUTH_URL=""
fi

RUNTIME_ENV=$(jq -n \
  --arg node "production" \
  --arg secret "$AUTH_SECRET" \
  --arg auth_url "${AUTH_URL:-}" \
  --arg gid "${AUTH_GOOGLE_ID:-}" \
  --arg gsecret "${AUTH_GOOGLE_SECRET:-}" \
  --arg oai "${OPENAI_API_KEY:-}" \
  --arg model "${OPENAI_MODEL:-gpt-4o-mini}" \
  --arg deepseek "${DEEPSEEK_API_KEY:-}" \
  --arg deepseek_model "${DEEPSEEK_MODEL:-deepseek-chat}" \
  '[
    {Name:"NODE_ENV", Value:$node},
    {Name:"AUTH_SECRET", Value:$secret},
    {Name:"AUTH_URL", Value:$auth_url},
    {Name:"AUTH_GOOGLE_ID", Value:$gid},
    {Name:"AUTH_GOOGLE_SECRET", Value:$gsecret},
    {Name:"OPENAI_API_KEY", Value:$oai},
    {Name:"OPENAI_MODEL", Value:$model},
    {Name:"DEEPSEEK_API_KEY", Value:$deepseek},
    {Name:"DEEPSEEK_MODEL", Value:$deepseek_model}
  ]')

SOURCE_CONFIG=$(jq -n \
  --arg uri "$ECR_URI" \
  --arg role "$ROLE_ARN" \
  --argjson env "$RUNTIME_ENV" \
  '{
    ImageRepository: {
      ImageIdentifier: $uri,
      ImageRepositoryType: "ECR",
      ImageConfiguration: {
        Port: "3000",
        RuntimeEnvironmentVariables: (
          reduce $env[] as $e ({}; . + {($e.Name): $e.Value})
        )
      }
    },
    AutoDeploymentsEnabled: false,
    AuthenticationConfiguration: {
      AccessRoleArn: $role
    }
  }')

INSTANCE='{"Cpu":"1024","Memory":"2048"}'

EXISTING="$(aws apprunner list-services --region "$REGION" \
  --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn | [0]" \
  --output text 2>/dev/null || true)"

if [[ "$EXISTING" != "None" && -n "${EXISTING:-}" && "$EXISTING" != "null" ]]; then
  echo "==> Updating App Runner service ${SERVICE_NAME}"
  aws apprunner update-service \
    --region "$REGION" \
    --service-arn "$EXISTING" \
    --source-configuration "$SOURCE_CONFIG" \
    --instance-configuration "$INSTANCE" >/tmp/trelloai-apprunner.json
  SERVICE_ARN="$EXISTING"
else
  echo "==> Creating App Runner service ${SERVICE_NAME}"
  aws apprunner create-service \
    --region "$REGION" \
    --service-name "$SERVICE_NAME" \
    --source-configuration "$SOURCE_CONFIG" \
    --instance-configuration "$INSTANCE" \
    --health-check-configuration Protocol=HTTP,Path=/api/health,Interval=10,Timeout=5,HealthyThreshold=1,UnhealthyThreshold=5 \
    >/tmp/trelloai-apprunner.json
  SERVICE_ARN="$(jq -r '.Service.ServiceArn' /tmp/trelloai-apprunner.json)"
fi

echo "==> Waiting for service to become RUNNING..."
for i in $(seq 1 80); do
  DESC="$(aws apprunner describe-service --region "$REGION" --service-arn "$SERVICE_ARN")"
  STATUS="$(echo "$DESC" | jq -r '.Service.Status')"
  URL="$(echo "$DESC" | jq -r '.Service.ServiceUrl')"
  echo "   [${i}] ${STATUS}  ${URL}"
  if [[ "$STATUS" == "RUNNING" ]]; then
    echo ""
    echo "Deploy OK"
    echo "URL: https://${URL}"
    echo ""
    echo "Next steps:"
    echo "1) Update AUTH_URL=https://${URL} in App Runner env and in .env.local"
    echo "2) Google Console redirect: https://${URL}/api/auth/callback/google"
    echo "3) Google JS origin: https://${URL}"
    echo "https://${URL}" > /tmp/trelloai-url.txt
    exit 0
  fi
  if [[ "$STATUS" == "CREATE_FAILED" || "$STATUS" == "UPDATE_FAILED" || "$STATUS" == "DELETE_FAILED" ]]; then
    echo "Deploy failed with status ${STATUS}" >&2
    echo "$DESC" | jq '.Service' >&2
    exit 1
  fi
  sleep 15
done

echo "Timed out waiting for RUNNING" >&2
exit 1
