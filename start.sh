#!/usr/bin/env bash
# Self Drive: compila a interface (Vue) e inicia a API (Go), que serve a interface junto.
# Uso:
#   ./start.sh        compila o frontend (se ainda não foi compilado) e sobe tudo em http://localhost:8080
#   ./start.sh dev    sobe a API + Vite com hot-reload (interface em http://localhost:8080)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
EMBED="$ROOT/backend/internal/web/embed"

trap 'trap - INT TERM EXIT; kill 0' INT TERM EXIT

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo ">> Instalando dependências do frontend (primeira execução)..."
  (cd "$ROOT/frontend" && npm install)
fi

if [ "$1" = "dev" ]; then
  echo ">> Modo dev: API em http://localhost:8080 e Vite com hot-reload"
  (cd "$ROOT/frontend" && npm run dev) &
  (cd "$ROOT/backend" && go run . -c config.yaml) &
else
  if [ ! -f "$EMBED/index.html" ]; then
    echo ">> Compilando o frontend (primeira execução)..."
    (cd "$ROOT/frontend" && npm run build)
  fi
  echo ">> Iniciando Self Drive em http://localhost:8080"
  (cd "$ROOT/backend" && go run . -c config.yaml) &
fi

wait
