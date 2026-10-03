# Self Drive

Interface web para gerenciar arquivos usando o [File Browser Quantum](https://github.com/gtsteffaniak/filebrowser) como serviço de armazenamento e API. O frontend é feito em React.

## Recursos

- Navegação por arquivos e pastas, pesquisa e visualizações em lista e grade.
- Upload, download, cópia, movimentação, renomeação e lixeira.
- Seleção de vários itens e download conjunto em um arquivo ZIP.
- Favoritos e arquivos recentes.
- Compartilhamento por link, lista de compartilhamentos e gerenciamento dos links.
- Visualização de arquivos compatíveis no navegador.

## Requisitos

- Node.js e npm.
- Uma instância do File Browser Quantum acessível pela interface.
- Uma conta do Quantum com permissões de acesso à API e às origens de arquivos usadas.

## Executar localmente

1. Clone o repositório e entre na pasta:

   ```sh
   git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   cd SEU_REPOSITORIO
   ```

2. Instale as dependências e inicie o servidor de desenvolvimento:

   ```sh
   npm install
   npm start
   ```

3. Abra `http://localhost:3000` e entre com seu usuário e senha do File Browser Quantum.

Em desenvolvimento, o proxy do Create React App encaminha as chamadas de API para `http://127.0.0.1:8080` (configurado em `package.json`). Inicie o Quantum nesse endereço ou altere o campo `proxy` para o endereço correto.

## Configurar o endereço do Quantum

Para uma compilação de produção, defina `REACT_APP_FILEBROWSER_URL` antes de compilar:

```sh
REACT_APP_FILEBROWSER_URL=https://arquivos.exemplo.com npm run build
```

Essa variável é incorporada durante a compilação. Se frontend e API estiverem em origens diferentes, configure CORS no Quantum para permitir a origem do frontend. Em desenvolvimento, o campo `proxy` do `package.json` controla o destino da API.

## Permissões do File Browser Quantum v2

Na versão 2, as permissões de arquivo são configuradas por origem (*source*). Ser administrador não concede automaticamente as permissões `create`, `modify` e `delete`. Para habilitá-las como padrão em uma origem, configure o `config.yaml` do Quantum antes de criar os usuários:

```yaml
server:
  sources:
    - path: "/srv"
      config:
        defaultEnabled: true
        defaultUserScope: "/"
        defaultPermissions:
          view: true
          download: true
          modify: true
          create: true
          delete: true
```

Usuários existentes podem precisar de ajustes na seção **User Management**, expandindo as permissões da origem. A permissão global `share` também é necessária para criar e gerenciar links de compartilhamento.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm start` | Inicia o servidor local de desenvolvimento. |
| `npm run build` | Gera os arquivos de produção na pasta `build/`. |
| `npm test` | Inicia os testes do Create React App em modo interativo. |

## Publicar no GitHub

Use os passos de [`../GITHUB_COMMANDS.md`](../GITHUB_COMMANDS.md) para criar o repositório remoto e enviar o projeto.

## Observações

- A senha é enviada no cabeçalho `X-Password` codificada para URL, conforme esperado pelo Quantum.
- A sessão é mantida no armazenamento local do navegador. Faça logout em dispositivos compartilhados.
- Não coloque senhas, tokens ou arquivos `.env` com credenciais no repositório.
