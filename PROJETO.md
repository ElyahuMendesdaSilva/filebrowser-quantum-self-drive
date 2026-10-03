# Self Drive — projeto unificado

| Pasta | O que é |
| --- | --- |
| `backend/` | API em Go (File Browser Quantum customizado: avatares, shares restritos). Porta 8080. |
| `frontend-react/` | **Self Drive**, a interface em React (Create React App) que consome a API. |
| `frontend/` | Interface Vue original do Quantum. Mantida intacta: o build do Go (`go:embed`), o Docker e os testes Playwright dependem dela. |
| `_docker/` | Dockerfiles e compose do projeto original (Vue). |
| `deploy/` + `docker-compose.yml` | Docker do Self Drive: API + React com nginx. |

## Iniciar tudo com um comando

```sh
./start.sh        # Linux/macOS
start.bat         # Windows (duas janelas)
```

Sobe a API em http://localhost:8080 e a interface em http://localhost:3000. Na primeira execução instala as dependências do React. No `start.sh`, Ctrl+C encerra os dois.

## Rodar manualmente (dois terminais)

Terminal 1 — backend:

```sh
cd backend
go run . -c config.yaml
```

Terminal 2 — interface React:

```sh
cd frontend-react
npm install
npm start
```

Abra http://localhost:3000. O `proxy` do `frontend-react/package.json` já aponta para `http://127.0.0.1:8080`.

## Rodar com Docker (API + interface juntas)

Requer Docker com o plugin Compose. Na raiz do projeto:

```sh
cp .env.example .env     # edite o .env: ADMIN_USER, ADMIN_PASSWORD e FILES_DIR
docker compose up --build
```

Abra http://localhost:3000. Quem sobe é o nginx (porta 3000), que serve o React e encaminha `/api` e `/public` para a API (porta 8080, interna ao Docker).

- **Configuração no `.env`:** `ADMIN_USER` e `ADMIN_PASSWORD` definem o administrador; `FILES_DIR` é a pasta de arquivos no seu computador (montada em `/srv` na API); `WEB_PORT` muda a porta. Sem `ADMIN_PASSWORD` o `docker compose` se recusa a subir.
- **Senha do admin:** com `ADMIN_PASSWORD` definida, a API redefine a senha desse usuário a cada start. Para trocar, mude no `.env` e rode `docker compose up -d`. A senha `admin` é ignorada pela API, que gera uma aleatória e a mostra no log (`docker compose logs api`).
- **Pasta de arquivos:** precisa existir e ser gravável pelo usuário 1000 do container (no Linux, `sudo chown -R 1000:1000 sua-pasta` resolve).
- **Criar outro administrador:** `docker compose exec api ./filebrowser user set NOME --admin --password`.
- **Usar o banco que você já tem:** pare o backend local (para o SQLite fechar limpo), rode `docker compose up --no-start api`, depois `docker cp backend/filebrowser.sqlite self-drive-api-1:/home/filebrowser/data/database.sqlite` e por fim `docker compose run --rm --user root --entrypoint chown api 1000:1000 /home/filebrowser/data/database.sqlite` (sem o `chown` o arquivo fica de root e a API não consegue gravar nele).
- **Parar:** `docker compose down` (os dados ficam no volume). `docker compose down -v` apaga o volume.
- A imagem da API é leve: não inclui ffmpeg nem MuPDF, então não gera miniaturas de vídeo nem de PDF.

## Build de produção do React

```sh
cd frontend-react
REACT_APP_FILEBROWSER_URL=https://seu-servidor npm run build
```

## Antes de publicar no GitHub

Siga `GITHUB_COMMANDS.md` a partir da **raiz** deste projeto. O `.gitignore` já exclui o banco SQLite do backend.
Confira `backend/config.yaml`: o caminho em `sources.path` é da sua máquina local.
