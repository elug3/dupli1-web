#!/usr/bin/env bash
# Update the live dupli1-web ECS task definition with service-account credentials
# used for customer registration (BFF → POST /api/v1/auth/register).
#
# Prefer EMAIL + PASSWORD (the app mints/refreshes access tokens at runtime).
# DUPLI1_WEB_SERVICE_TOKEN is a short-lived (~15 min) access token fallback.
#
# Prerequisites: AWS CLI credentials that can ecs:Describe*, RegisterTaskDefinition,
# and UpdateService on cluster "production" / service "dupli1-web".
#
# Usage:
#   export DUPLI1_WEB_SERVICE_EMAIL=dupli1-web@web.dupli1.com
#   export DUPLI1_WEB_SERVICE_PASSWORD='...'
#   bash scripts/configure-web-service-ecs.sh
#
# Or with a static token:
#   export DUPLI1_WEB_SERVICE_TOKEN='...'
#   bash scripts/configure-web-service-ecs.sh

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ECS_CLUSTER="${ECS_CLUSTER:-production}"
ECS_SERVICE="${ECS_SERVICE:-dupli1-web}"
CONTAINER_NAME="${CONTAINER_NAME:-web}"

EMAIL="${DUPLI1_WEB_SERVICE_EMAIL:-}"
PASSWORD="${DUPLI1_WEB_SERVICE_PASSWORD:-}"
TOKEN="${DUPLI1_WEB_SERVICE_TOKEN:-}"

if [[ -z "$TOKEN" && ( -z "$EMAIL" || -z "$PASSWORD" ) ]]; then
  echo "error: set DUPLI1_WEB_SERVICE_EMAIL + DUPLI1_WEB_SERVICE_PASSWORD, or DUPLI1_WEB_SERVICE_TOKEN" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "error: aws CLI is required" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required" >&2
  exit 1
fi

echo "Resolving current task definition for ${ECS_CLUSTER}/${ECS_SERVICE}..."
TASK_ARN="$(aws ecs describe-services \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --query 'services[0].taskDefinition' \
  --output text)"

if [[ -z "$TASK_ARN" || "$TASK_ARN" == "None" ]]; then
  echo "error: could not resolve task definition for ${ECS_SERVICE}" >&2
  exit 1
fi

echo "Current task definition: ${TASK_ARN}"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

aws ecs describe-task-definition \
  --region "$AWS_REGION" \
  --task-definition "$TASK_ARN" \
  --query taskDefinition \
  --output json \
| jq --arg container "$CONTAINER_NAME" \
     --arg email "$EMAIL" \
     --arg password "$PASSWORD" \
     --arg token "$TOKEN" '
  .containerDefinitions |= map(
    if .name == $container then
      .environment = (
        (.environment // [])
        | map(select(.name != "DUPLI1_WEB_SERVICE_EMAIL"
                   and .name != "DUPLI1_WEB_SERVICE_PASSWORD"
                   and .name != "DUPLI1_WEB_SERVICE_TOKEN"))
        + (
            if ($email != "" and $password != "") then
              [
                {name: "DUPLI1_WEB_SERVICE_EMAIL", value: $email},
                {name: "DUPLI1_WEB_SERVICE_PASSWORD", value: $password}
              ]
            else
              [{name: "DUPLI1_WEB_SERVICE_TOKEN", value: $token}]
            end
          )
      )
    else . end
  )
  | {
      family,
      networkMode,
      requiresCompatibilities,
      cpu,
      memory,
      executionRoleArn,
      taskRoleArn,
      containerDefinitions,
      volumes,
      placementConstraints,
      runtimePlatform
    }
  | with_entries(select(.value != null))
' > "$TMP"

NEW_ARN="$(aws ecs register-task-definition \
  --region "$AWS_REGION" \
  --cli-input-json "file://${TMP}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)"

echo "Registered ${NEW_ARN}"
echo "Updating service ${ECS_SERVICE}..."

aws ecs update-service \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --task-definition "$NEW_ARN" \
  --force-new-deployment \
  --query 'service.{status:status,taskDefinition:taskDefinition,desiredCount:desiredCount}' \
  --output json

echo "Waiting for service stability..."
aws ecs wait services-stable \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE"

echo "Done. Customer registration should accept DUPLI1_WEB_SERVICE_* on new tasks."
