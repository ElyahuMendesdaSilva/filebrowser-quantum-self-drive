# Avatar e shares restritos

Esta implementação adiciona avatares de usuário, busca enxuta para o seletor de destinatários e allowlist de usuários em shares. Shares com `allowedUsernames` só liberam conteúdo a uma sessão FileBrowser autenticada cujo username esteja na lista (administradores e dono também passam); shares sem lista mantêm o acesso anterior.

## Autenticação

`POST /api/auth/login?username=...` recebe a senha em `X-Password` (URL-encoded) e responde com JWT no corpo e cookie `filebrowser_quantum_jwt` HttpOnly. O frontend pode manter o cookie com `credentials: "include"`; clientes sem cookie podem enviar `Authorization: Bearer <JWT>` ou `?auth=<JWT>`. Não use `?jwt=` para esse login normal. GET/PUT/DELETE de avatar, `GET /api/users?q=...` e as rotas de gerenciamento de shares em `/api/share` exigem usuário autenticado. `GET /public/api/share/info` aceita visitantes anônimos, mas conteúdo público de share restrito exige login próprio do FileBrowser. Rotas públicas do share continuam sob `/public/api/...`.

## Avatares

Todas as rotas abaixo usam `username` na query. A leitura só exige autenticação; alteração e remoção exigem ser o próprio usuário ou administrador. A instância local de validação autenticou `admin`, enviou um JPEG e recebeu os exemplos de sucesso abaixo. Requisições com Bearer e cookie seguem o mesmo handler.

| Método e rota | Parâmetros | Quem pode chamar | Sucesso |
|---|---|---|---|
| `GET /api/users/avatar?username={username}` | Query `username` | Qualquer usuário autenticado | `200 image/jpeg`; `304` se ETag coincide |
| `PUT /api/users/avatar?username={username}` | Multipart `avatar` (arquivo) | Dono ou administrador | `200` JSON |
| `DELETE /api/users/avatar?username={username}` | Query `username` | Dono ou administrador | `200`, corpo vazio |

Upload limita o corpo multipart inteiro a 2 MiB (incluindo seu envelope), imagem até 4096 × 4096 px e formatos JPEG, PNG ou WebP detectados pelo conteúdo. SVG não é aceito. Deixe margem no tamanho do arquivo para o envelope multipart. A API corta um quadrado central, redimensiona para 256 × 256 e codifica JPEG; reduz a qualidade (a partir de 85) até o JPEG final caber em 256 KiB. A resposta não retorna a imagem.

### PUT

```sh
curl -X PUT 'https://files.example/api/users/avatar?username=alice' \
  -H 'Authorization: Bearer <JWT>' \
  -F 'avatar=@./foto.webp'
```

```js
const form = new FormData();
form.append("avatar", file);
const response = await fetch(`/api/users/avatar?username=${encodeURIComponent(username)}`, {
  method: "PUT", credentials: "include", body: form,
});
const result = await response.json();
```

Resposta real `200` da instância (hash específico desta validação):

```json
{"avatarHash":"472969df663f2eedba515a5ab0a7bb782ad7f17b5f03050c048c40f81708f20d","avatarUrl":"/api/users/avatar?username=admin&v=472969df663f2eedba515a5ab0a7bb782ad7f17b5f03050c048c40f81708f20d"}
```

Erros JSON usam `{"status":<código>,"message":"..."}`. Os erros de entrada observados no código do handler são:

| Código | Corpo `message` |
|---|---|
| `400` | `avatar file is required`, `avatar is empty`, `invalid image`, `image dimensions exceed 4096 pixels` ou `processed avatar exceeds 256 KB` |
| `401` | sessão ausente observada: `{"status":401,"message":"no token present in request"}`; sessão inválida pode ter outra mensagem |
| `403` | `you are not allowed to change this avatar` |
| `404` | rota não encontrada; username inexistente no PUT é mapeado pelo handler para `403` com `user not found` |
| `413` | `avatar exceeds 2 MB` |
| `415` | `avatar must be JPEG, PNG, or WebP` |
| `429` | limite de requisições autenticadas excedido: `{"status":429,"message":"too many requests"}`; cabeçalho `Retry-After` informa segundos |
| `500` | `could not save avatar` ou erro interno ao processar/salvar |

`401`/`429` são gerados pelo middleware; os detalhes textuais podem variar conforme causa e limiter. Não há `413` para dimensão: dimensões excedidas retornam `400`.

### GET

```sh
curl -i 'https://files.example/api/users/avatar?username=alice' \
  -H 'Authorization: Bearer <JWT>'
```

```js
const response = await fetch(avatarUrl, { credentials: "include" });
if (response.ok) imageSrc = URL.createObjectURL(await response.blob());
```

A instância respondeu `200` com `Content-Type: image/jpeg`, `Cache-Control: private, max-age=86400` e `ETag: "472969df663f2eedba515a5ab0a7bb782ad7f17b5f03050c048c40f81708f20d"`; o corpo foi o JPEG binário de 1618 bytes. Condicionado com `If-None-Match` igual ao ETag, respondeu `304` sem corpo. Sem avatar, a resposta real foi `404`:

```json
{"status":404,"message":"avatar not found"}
```

Outros erros: `401` sessão ausente/inválida; `404` usuário não existe (`user not found`) ou avatar ausente. Não há autorização por username na leitura: qualquer sessão pode ler avatar de outro usuário conhecido.

### DELETE

```sh
curl -X DELETE 'https://files.example/api/users/avatar?username=alice' \
  -H 'Authorization: Bearer <JWT>'
```

```js
const response = await fetch(`/api/users/avatar?username=${encodeURIComponent(username)}`, {
  method: "DELETE", credentials: "include",
});
```

Resposta real: `200 OK`, corpo vazio. Também é `200` quando não havia foto. Erros possíveis: `401` autenticação, `403` `{"status":403,"message":"you are not allowed to change this avatar"}` (ou `user not found` se o username não existir), `500` erro de persistência.

### Objeto de usuário e cache

O objeto completo de usuário inclui `avatarUrl`; por exemplo, valor observado sem foto: `"avatarUrl":""`. Quando existe foto, é `/api/users/avatar?username=<username>&v=<sha256-do-JPEG-normalizado>`. O GET retorna o mesmo conteúdo para aquela versão e usa o ETag entre aspas. Envie `If-None-Match` em revalidações; `304` significa reutilizar o corpo em cache. `Cache-Control` é privado por um dia. A mudança de hash em `v` cria uma URL nova depois de upload, evitando que a URL antiga permaneça no cache. Ao excluir, o frontend deve limpar seu estado de avatar; não há URL nova.

```json
{"username":"admin","avatarUrl":"/api/users/avatar?username=admin&v=472969df663f2eedba515a5ab0a7bb782ad7f17b5f03050c048c40f81708f20d"}
```

Use a URL no `<img>`; em campo vazio ou erro de imagem (incluindo `404`), mostre iniciais. Em frontend de outra origem, inclua credenciais para enviar o cookie e configure CORS conforme a origem.

## Busca para o seletor

`GET /api/users?q=<substring>` exige login e permissão `share`. A busca ignora caixa, procura substring no username e ordena alfabeticamente. Cada item contém somente `username` e `avatarUrl`; sem avatar, `avatarUrl` é string vazia. A chamada local com `q=admin` respondeu:

```json
[{"username":"admin","avatarUrl":""}]
```

```js
let timer;
async function searchPeople(q) {
  clearTimeout(timer);
  return new Promise((resolve) => {
    timer = setTimeout(async () => {
      const r = await fetch(`/api/users?q=${encodeURIComponent(q)}`, { credentials: "include" });
      resolve(r.ok ? await r.json() : []);
    }, 250);
  });
}
```

Vazio/whitespace não ativa a busca de seletor e segue a listagem normal de usuários; mantenha pelo menos um caractere de busca no cliente.

## Shares restritos

`allowedUsernames` é uma lista JSON de usernames (case-sensitive, usernames atuais). Envie-a no `POST /api/share` ao criar e ao editar um share enviando o objeto atualizado com seu `hash`; `allowedUsernames: []` ou campo omitido remove a restrição. Cada username precisa existir. A resposta da criação local foi `200`:

```json
{"disableSidebar":false,"downloadURL":"http://127.0.0.1:18089/public/api/resources/download?hash=cfT_J1OXY4ZkHZdm-Ui31w","shareURL":"http://127.0.0.1:18089/public/share/cfT_J1OXY4ZkHZdm-Ui31w","shareType":"normal","sidebarLinks":null,"disableLoginOption":false,"sourceURL":"/files/avatar-share-source","canEditShare":true,"allowedUsernames":["admin"],"source":"avatar-share-source","hash":"cfT_J1OXY4ZkHZdm-Ui31w","path":"/","expire":0,"username":"admin","pathExists":true}
```

Exemplo genérico de corpo (demais campos dependem do share que está sendo criado/editado):

```json
{
  "source": "meus-arquivos",
  "path": "/relatorios",
  "shareType": "normal",
  "allowedUsernames": ["alice", "bob"]
}
```

Para editar permissões, repetir os campos editáveis e incluir `"hash":"<hash existente>"`. Shares antigos sem `allowedUsernames` continuam abertos segundo suas configurações anteriores. Listagem (`GET /api/share/list`), detalhe (`GET /api/share?source=...&path=...`) e respostas de criação/edição incluem `allowedUsernames` quando há lista.

`GET /public/api/share/info?hash=<hash>` permanece visitável sem login, mas não revela metadados sensíveis: a resposta local anônima foi `200` `{"restricted":true}`. Depois de autenticar como permitido, devolve detalhes e `restricted: true`; exemplo local:

```json
{"disableSidebar":false,"shareURL":"http://127.0.0.1:18089/public/share/cfT_J1OXY4ZkHZdm-Ui31w","shareType":"normal","sidebarLinks":[{"name":"sourceLocation","category":"custom","target":"/files/avatar-share-source","icon":""}],"disableLoginOption":false,"sourceURL":"/files/avatar-share-source","canEditShare":true,"restricted":true,"username":"admin"}
```

Se autenticado e fora da lista, `/share/info` retorna `403` com `{"status":403,"message":"share is not available to this user"}`. O acesso ao conteúdo em `/public/api/resources` segue a sequência verificada:

| Visitante | Resposta real |
|---|---|
| Sem token | `401` `{"status":401,"message":"authentication is required for this share"}` |
| Logado, fora da lista | `403` `{"status":403,"message":"share is not available to this user"}` |
| Autorizado | `200` para conteúdo existente e demais permissões satisfeitas |

Ao receber `401`, preserve a URL completa de origem ao direcionar para login, por exemplo `/login?redirect=<encodeURIComponent(location.href)>`; após login, retorne ao link. Em `403`, mostre acesso negado e não entre em redirecionamento de login infinito. A validação observada de conteúdo autorizado foi feita como dono/administrador; outros pré-requisitos do share (senha, expiração, permissões de arquivo) ainda podem alterar o resultado.

Corpo real autorizado de `GET /public/api/resources?hash=...&path=/` na validação local:

```json
{"name":"avatar-share-source","size":0,"modified":"2026-09-30T00:55:16.30981835-03:00","type":"directory","hidden":false,"hasPreview":false,"path":"/","source":"cfT_J1OXY4ZkHZdm-Ui31w","hash":"cfT_J1OXY4ZkHZdm-Ui31w"}
```

## Receitas de frontend

### Avatar com fallback

```jsx
function Avatar({ user, size = 32 }) {
  const [failed, setFailed] = React.useState(false);
  const initials = (user.username || "?").slice(0, 2).toUpperCase();
  return user.avatarUrl && !failed
    ? <img width={size} height={size} src={user.avatarUrl} alt={user.username}
        onError={() => setFailed(true)} />
    : <span className="avatar-fallback" style={{ width: size, height: size }}>{initials}</span>;
}
```

### Upload e validação local

```js
async function uploadAvatar(file, username) {
  // Deixe margem para o envelope multipart dentro do limite de 2 MiB do corpo.
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024 - 8192) {
    throw new Error("Escolha JPEG, PNG ou WebP de até 2 MiB.");
  }
  const form = new FormData(); form.append("avatar", file);
  const r = await fetch(`/api/users/avatar?username=${encodeURIComponent(username)}`, {
    method: "PUT", credentials: "include", body: form,
  });
  const body = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error(body?.message || `Falha no upload (${r.status})`);
  return body.avatarUrl;
}
```

A validação cliente é apenas conveniência: dimensões, conteúdo real do arquivo e limite comprimido de saída só são conhecidos pelo servidor. Trate `401` com login, `403` sem permissão, `413` arquivo grande, `415` tipo inválido, `400` imagem vazia/inválida/grande demais e `429` com espera/retry.

### Seletor e lista de shares

```jsx
// Seletor: resultados de GET /api/users?q=...; cada selecionado vira um chip.
{selected.map(u => <span className="chip" key={u.username}>
  {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : <b>{u.username.slice(0, 2).toUpperCase()}</b>}
  {u.username} <button onClick={() => remove(u.username)}>×</button>
</span>)}

// Cartão de share: allowlist não vazia = restrito (ícone de cadeado), vazia = aberto.
{shares.map(s => <div key={s.hash}>
  <span aria-label={s.allowedUsernames?.length ? "Restrito" : "Aberto"}>
    {s.allowedUsernames?.length ? "🔒" : "🌐"}
  </span>
  {s.allowedUsernames?.map(name => {
    const u = usersByName[name];
    return u?.avatarUrl ? <img key={name} src={u.avatarUrl} alt={name} />
      : <span key={name}>{name.slice(0, 2).toUpperCase()}</span>;
  })}
</div>)}
```

### Tela do destinatário

```js
const r = await fetch(resourceUrl, { credentials: "include" });
if (r.status === 401) {
  location.assign(`/login?redirect=${encodeURIComponent(location.href)}`);
} else if (r.status === 403) {
  showAccessDenied();
} else if (r.ok) {
  render(await r.json());
}
```

## Configuração, proxy e limites

Não foi adicionada opção de configuração ao `config.yaml` para avatar ou allowlist.

Se o proxy usa `forward_auth`, não trate a autenticação externa como sessão deste app: para share restrito, o visitante precisa autenticar no FileBrowser e o username FileBrowser precisa estar autorizado. Revise regras de proxy que deixam `/public/api/resources`, `/raw`, downloads ou outros paths públicos; expor o caminho no proxy não remove a verificação da allowlist no backend. `/public/api/share/info` pode ficar público para mostrar o estado `restricted` sem vazar os detalhes.

Limitações atuais: allowlist por username individual; sem grupos, OIDC como identidade da allowlist ou `DisplayName`. Renomear um usuário ajusta as listas persistidas. A busca retorna usernames, não nomes de exibição. A URL de avatar da resposta de upload reflete o username fornecido na query; use URL encoding. A leitura de avatar exige login mesmo quando o avatar aparece em um seletor ou num share; a página pública precisa ter a sessão do FileBrowser para baixar a imagem.

## Swagger

O Swagger regenerado contém as rotas de avatar (`GET`, `PUT`, `DELETE /api/users/avatar`), a busca `GET /api/users` e `/public/api/share/info`; os schemas de usuário incluem `avatarUrl` e os de share incluem `allowedUsernames`. Não encontrei divergência de nomes de rota ou campos. Há divergência de documentação de respostas: no Swagger, GET lista somente `200`, `304`, `404`; PUT somente `200`; DELETE somente `200`. Ele não lista erros de autenticação/permissão, validação, tamanho nem rate limit (`401`, `403`, `400`, `413`, `415`, `429`, `500`) nem documenta limites e processamento da imagem. Para consumo desses erros, use as tabelas desta página e os corpos confirmados no servidor.

## Checklist de integração

1. Implementar login e persistir a sessão via cookie HttpOnly (ou Bearer para cliente que gerencia JWT).
2. Renderizar `avatarUrl` com fallback e tratar `404`/URL vazia.
3. Adicionar upload com validação de tipo/tamanho no cliente e tratamento dos status de erro.
4. Integrar a busca `GET /api/users?q=` com debounce e chips de selecionados.
5. Enviar `allowedUsernames` ao criar/editar share e exibir estado restrito/aberto.
6. No link público, tratar `401` redirecionando ao login com retorno ao link e `403` exibindo acesso negado.
7. Conferir proxy e CORS para que sessão e avatar possam ser enviados ao backend.
