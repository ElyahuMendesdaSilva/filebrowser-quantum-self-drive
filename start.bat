@echo off
rem Inicia a API (Go) e a interface React, cada uma em sua janela.
set "ROOT=%~dp0"

if not exist "%ROOT%frontend-react\node_modules" (
  echo Instalando dependencias do React ^(primeira execucao^)...
  pushd "%ROOT%frontend-react"
  call npm install
  popd
)

start "Self Drive - API" /d "%ROOT%backend" cmd /k go run . -c config.yaml
start "Self Drive - Interface" /d "%ROOT%frontend-react" cmd /k npm start
