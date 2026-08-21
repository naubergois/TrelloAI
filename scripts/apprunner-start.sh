#!/bin/sh
# App Runner injects HOSTNAME as the container hostname; Next binds to it and
# health checks fail. Force all interfaces.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"
exec node server.js
