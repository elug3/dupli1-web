#!/usr/bin/env bash
# Re-wire the live dupli1-web ECS task to inject registration credentials from
# AWS Secrets Manager (same secret dupli1-auth uses to seed the machine user).
#
# Source of truth: dupli1/production/web-service-account
# Do not inject DUPLI1_WEB_SERVICE_* as plain environment from GitHub secrets —
# that drifts from auth and causes "login: invalid credentials" on register.
#
# Prerequisites: AWS CLI + jq; permissions for secretsmanager:DescribeSecret,
# ecs:Describe*, RegisterTaskDefinition, UpdateService.
#
# Usage:
#   bash scripts/configure-web-service-ecs.sh
#
# After rotating the secret password, also force-redeploy dupli1-auth:
#   aws ecs update-service --cluster production --service dupli1-auth --force-new-deployment

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ECS_CLUSTER="${ECS_CLUSTER:-production}"
ECS_SERVICE="${ECS_SERVICE:-dupli1-web}"
CONTAINER_NAME="${CONTAINER_NAME:-web}"
WEB_SERVICE_SECRET_ID="${WEB_SERVICE_SECRET_ID:-dupli1/production/web-service-account}"

if ! command -v aws >/dev/null 2>&1; then
  echo "error: aws CLI is required" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required" >&2
  exit 1
fi

echo "Resolving Secrets Manager ARN for ${WEB_SERVICE_SECRET_ID}..."
SECRET_ARN="$(aws secretsmanager describe-secret \
  --region "$AWS_REGION" \
  --secret-id "$WEB_SERVICE_SECRET_ID" \
  --query ARN \
  --output text)"

EMAIL_FROM="${SECRET_ARN}:DUPLI1_WEB_SERVICE_EMAIL::"
PASSWORD_FROM="${SECRET_ARN}:DUPLI1_WEB_SERVICE_PASSWORD::"

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

echo "Fetching ${TASK_ARN}..."
TASK_JSON="$(aws ecs describe-task-definition \
  --region "$AWS_REGION" \
  --task-definition "$TASK_ARN" \
  --query taskDefinition)"

NEW_TASK="$(jq \
  --arg container "$CONTAINER_NAME" \
  --arg email_from "$EMAIL_FROM" \
  --arg password_from "$PASSWORD_FROM" \
  '
    del(.taskDefinitionArn, .revision, .status, .requiresAttributes,
        .compatibilities, .registeredAt, .registeredBy)
    | .containerDefinitions |= map(
        if .name == $container then
          .environment = (
            (.environment // [])
            | map(select(
                .name != "DUPLI1_WEB_SERVICE_EMAIL"
                and .name != "DUPLI1_WEB_SERVICE_PASSWORD"
                and .name != "DUPLI1_WEB_SERVICE_TOKEN"
              ))
          )
          | .secrets = [
              {name: "DUPLI1_WEB_SERVICE_EMAIL", valueFrom: $email_from},
              {name: "DUPLI1_WEB_SERVICE_PASSWORD", valueFrom: $password_from}
            ]
        else . end
      )
  ' <<<"$TASK_JSON")"

TMP="$(mktemp)"
printf '%s\n' "$NEW_TASK" >"$TMP"

echo "Registering new task definition revision..."
NEW_ARN="$(aws ecs register-task-definition \
  --region "$AWS_REGION" \
  --cli-input-json "file://${TMP}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)"
rm -f "$TMP"

echo "Registered ${NEW_ARN}"
echo "Updating service ${ECS_SERVICE}..."
aws ecs update-service \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --task-definition "$NEW_ARN" \
  --force-new-deployment \
  >/dev/null

echo "Waiting for service stability..."
aws ecs wait services-stable \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE"

echo "Done. Web task now reads DUPLI1_WEB_SERVICE_* from ${WEB_SERVICE_SECRET_ID}."
echo "If you rotated the password, also: aws ecs update-service --cluster ${ECS_CLUSTER} --service dupli1-auth --force-new-deployment"
