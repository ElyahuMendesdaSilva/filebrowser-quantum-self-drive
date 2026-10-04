@echo off
rem Self Drive: compila a interface (Vue) e inicia a API (Go), que serve a interface junto.
rem Uso: start.bat  (compila o frontend se necessario e sobe em http://localhost:8080)
set "ROOT=%~dp0"

if not exist "%ROOT%frontend\node_modules" (
  echo Instalando dependencias do frontend ^(primeira execucao^)...
  pushd "%ROOT%frontend"
  call npm install
  popd
)

if not exist "%ROOT%backend\internal\web\embed\index.html" (
  echo Compilando o frontend ^(primeira execucao^)...
  pushd "%ROOT%frontend"
  call npm run build
  popd
)

echo Iniciando Self Drive em http://localhost:8080
pushd "%ROOT%backend"
go run . -c config.yaml
popd
