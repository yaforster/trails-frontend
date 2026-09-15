#!/bin/sh
set -eu

: "${TRAILS_API_BASE_URL:?TRAILS_API_BASE_URL is required}"
: "${TRAILS_KEYCLOAK_TOKEN_URL:?TRAILS_KEYCLOAK_TOKEN_URL is required}"

escape_js_string() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > /usr/share/nginx/html/trails-frontend-config.js <<EOF
window.__TRAILS_FRONTEND_CONFIG__ = {
  "trailsApiBaseUrl": "$(escape_js_string "$TRAILS_API_BASE_URL")",
  "keycloakTokenUrl": "$(escape_js_string "$TRAILS_KEYCLOAK_TOKEN_URL")"
};
EOF
