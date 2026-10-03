# Comandos para publicar no GitHub

## 1. Crie o repositório remoto

No GitHub, crie um repositório vazio. Escolha se ele será público ou privado e não marque as opções para adicionar README, `.gitignore` ou licença, pois os arquivos locais já estão neste projeto.

Copie o endereço HTTPS do repositório, que terá este formato:

```text
https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
```

## 2. Revise e envie os arquivos

Execute os comandos no terminal, dentro da pasta do projeto. Confira a lista antes de adicionar os arquivos:

```sh
git status
git add -A
git status
git commit -m "Publica projeto Self Drive"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Substitua `SEU_USUARIO` e `SEU_REPOSITORIO` pelos valores do endereço que copiou do GitHub. O Git pode abrir o navegador para autenticação.

## Se o remoto `origin` já existir

Confira os remotos configurados:

```sh
git remote -v
```

Se `origin` já estiver listado, atualize a URL em vez de adicioná-lo novamente:

```sh
git remote set-url origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

## Enviar alterações futuras

Depois de modificar o projeto, revise e publique as alterações com:

```sh
git status
git add -A
git commit -m "Descreva as alterações"
git push
```

Não adicione credenciais, senhas, tokens ou arquivos locais com segredos ao repositório.
