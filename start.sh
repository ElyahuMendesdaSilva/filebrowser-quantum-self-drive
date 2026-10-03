#!/usr/bin/env bash
# Inicia a API (Go) e a interface React juntas. Ctrl+C encerra as duas.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

trap 'trap - INT TERM EXIT; kill 0' INT TERM EXIT

if [ ! -d "$ROOT/frontend-react/node_modules" ]; then
  echo ">> Instalando dependências do React (primeira execução)..."
  (cd "$ROOT/frontend-react" && npm install)
fi

echo ">> Iniciando API em http://localhost:8080"
(cd "$ROOT/backend" && go run . -c config.yaml) &

echo ">> Iniciando interface em http://localhost:3000"
(cd "$ROOT/frontend-react" && npm start) &

wait
