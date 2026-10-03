#!/bin/sh
set -e

ADMIN_USER="${ADMIN_USER:-admin}"

# O usuário vai para dentro de um YAML entre aspas: proíbe caracteres que quebrariam o arquivo.
case "$ADMIN_USER" in
  *'"'*|*'\'*|*'|'*|*'&'*)
    echo "ERRO: ADMIN_USER não pode conter aspas, barra invertida, | ou &." >&2
    exit 1
    ;;
esac

sed "s|__ADMIN_USER__|${ADMIN_USER}|" /home/filebrowser/config.template.yaml > /home/filebrowser/config.yaml

# A senha (ADMIN_PASSWORD) chega pela variável FILEBROWSER_ADMIN_PASSWORD, definida no docker-compose.yml.
exec /home/filebrowser/filebrowser "$@"
