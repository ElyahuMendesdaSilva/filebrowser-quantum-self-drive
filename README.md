# File Browser Quantum — Self Drive

Versão personalizada do [File Browser Quantum](https://github.com/gtsteffaniak/filebrowser), preparada para funcionar como servidor do aplicativo [Self Drive](https://github.com/ElyahuMendesdaSilva/self-drive).

Este repositório mantém o backend em Go e a interface web em Vue do projeto-base. A interface é compilada e incorporada ao executável da API, que serve ambos na mesma porta.

## Alterações para o Self Drive

- **Avatares de usuário:** consulta e atualização de fotos de perfil, com validação e armazenamento no banco de dados.
- **Links de compartilhamento restritos:** permite limitar um link a usuários autenticados selecionados; administradores e a pessoa proprietária do compartilhamento mantêm acesso.
- **Busca de usuários para compartilhamento:** fornece os dados necessários para selecionar destinatários.

Detalhes de rotas, permissões, formatos e exemplos estão em [`backend/docs/avatar-e-share-restrito.md`](backend/docs/avatar-e-share-restrito.md). A documentação completa da API também fica disponível em `/swagger` para usuários com permissão de API.

## Requisitos

- Go conforme a versão declarada em [`backend/go.mod`](backend/go.mod).
- Node.js e npm compatíveis com [`frontend/package.json`](frontend/package.json).
- Para execução com Docker: Docker e o plugin Docker Compose.

## Executar localmente

Na raiz do repositório:

```bash
./start.sh
```

Na primeira execução, o script instala as dependências do frontend, compila a interface e inicia o backend. Abra [http://localhost:8080](http://localhost:8080).

Para desenvolver a interface com Vite e hot reload:

```bash
./start.sh dev
```

O script usa `backend/config.yaml`. Revise a configuração antes de iniciar e ajuste a origem de arquivos (`server.sources`) para uma pasta apropriada no seu ambiente. A configuração incluída aponta para `../files`, relativa à pasta `backend`.

Também é possível preparar e compilar as partes separadamente:

```bash
make setup
make build
```

`make setup` instala dependências de desenvolvimento. `make build` compila o frontend e o backend.

## Executar com Docker Compose

Na raiz do repositório, crie a pasta que será compartilhada e um arquivo `.env`:

```bash
mkdir -p files
cat > .env <<'EOF'
ADMIN_USER=admin
ADMIN_PASSWORD=troque-por-uma-senha-forte
FILES_DIR=./files
WEB_PORT=3000
TZ=America/Fortaleza
EOF
chmod 600 .env
```

Edite `ADMIN_PASSWORD` e escolha uma senha forte antes de iniciar os containers. O arquivo `.env` é ignorado pelo Git; não o publique. Suba o serviço com:

```bash
docker compose up --build -d
```

Confira se iniciou e veja os logs:

```bash
docker compose ps
docker compose logs -f api
```

Abra [http://localhost:3000](http://localhost:3000). O Compose mapeia a porta local `3000` para a porta `8080` do container e monta `./files` como origem de arquivos.

Variáveis disponíveis em `docker-compose.yml`:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `ADMIN_PASSWORD` | obrigatória | Senha do administrador aplicada pelo container na inicialização. Mantenha o valor do `.env` para não perder acesso após reiniciar. |
| `ADMIN_USER` | `admin` | Nome do usuário administrador. |
| `FILES_DIR` | `./files` | Pasta local de arquivos montada em `/srv` no container. |
| `WEB_PORT` | `3000` | Porta publicada na máquina host. |
| `TZ` | `UTC` | Fuso horário do container. |

Para parar o serviço e manter os dados:

```bash
docker compose down
```

O banco de dados fica no volume `api-data`. **Não use `docker compose down -v`** se quiser manter contas, avatares e compartilhamentos: essa opção remove o volume e apaga os dados persistidos.

### Adicionar usuários pelo terminal

Com o container `api` em execução, crie um usuário comum. O comando solicitará a senha sem exibi-la no terminal:

```bash
docker compose exec api ./filebrowser user set alice --password
```

Para criar um administrador, acrescente `--admin`:

```bash
docker compose exec api ./filebrowser user set bob --password --admin
```

Para promover a administrador uma conta existente que usa login por senha:

```bash
docker compose exec api ./filebrowser user promote alice
```

`user set` também atualiza a senha de uma conta existente. O argumento `--admin` concede permissão administrativa; sem ele, o comando não remove uma permissão administrativa que a conta já tenha. Para consultar as opções disponíveis:

```bash
docker compose exec api ./filebrowser user --help
```

## Estrutura do repositório

- `backend/`: servidor HTTP e API em Go.
- `frontend/`: interface web Vue.
- `deploy/`: Dockerfile e configurações de container.
- `_docker/`: ambientes de integração e testes do projeto-base.
- `docker-compose.yml`: execução local com Docker Compose.
- `start.sh` e `start.bat`: scripts de inicialização local.

## Projeto-base e licença

Este projeto é derivado do [File Browser Quantum](https://github.com/gtsteffaniak/filebrowser). Consulte [`LICENSE`](LICENSE) para a licença Apache-2.0 e mantenha os avisos de copyright e atribuição exigidos ao redistribuir o código.
