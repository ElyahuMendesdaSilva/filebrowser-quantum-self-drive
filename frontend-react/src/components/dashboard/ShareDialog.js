import { useEffect, useRef, useState } from "react";
import {
  Close,
  Link as LinkIcon,
  LockOutlined,
  PersonAddAlt1Outlined,
  PasswordOutlined,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import {
  createResourceShare,
  getCurrentUser,
  getPublicShareUrl,
  getUserAvatar,
  searchShareUsers,
} from "../../api/fileBrowser";
import logo from "../../icons/logo.png";
import { QRCodeSVG } from "qrcode.react";
import "../../css/share-dialog.css";

// Foto de quem foi convidado (ou iniciais, se não houver foto).
function PersonAvatar({ username, avatarUrl }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setSrc("");
    if (username && avatarUrl) {
      getUserAvatar(username, avatarUrl)
        .then((url) => {
          objectUrl = url;
          if (active) setSrc(url);
          else URL.revokeObjectURL(url);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [username, avatarUrl]);
  return (
    <span className="share-avatar invited">
      {src ? <img src={src} alt="" /> : username.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function ShareDialog({ resource, onClose }) {
  const dialogRef = useRef(null);
  const [access, setAccess] = useState("anyone");
  const [invite, setInvite] = useState("");
  const [people, setPeople] = useState([]);
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [duration, setDuration] = useState("never");
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareCreating, setShareCreating] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (resource && dialogRef.current && !dialogRef.current.open)
      dialogRef.current.showModal();
    if (!resource && dialogRef.current?.open) dialogRef.current.close();
    setAccess("anyone");
    setInvite("");
    setPeople([]);
    setMessage("");
    setCurrentUser(null);
    setAvatarUrl("");
    setDuration("never");
    setPasswordEnabled(false);
    setPassword("");
    setOptionsExpanded(false);
    setShareLink("");
    setShareCreating(false);
    setResults([]);
    setSearching(false);
    if (!resource) return undefined;

    let active = true;
    let objectUrl = "";
    getCurrentUser()
      .then(async (user) => {
        if (!active) return;
        setCurrentUser(user || null);
        if (user?.username && user.avatarUrl) {
          objectUrl = await getUserAvatar(user.username, user.avatarUrl);
          if (active) setAvatarUrl(objectUrl);
          else URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resource]);

  // Busca pessoas na API enquanto o usuário digita (precisa da permissão "share").
  useEffect(() => {
    const term = invite.trim();
    if (!resource || !term) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchShareUsers(term);
        if (active) setResults(found);
      } catch (searchError) {
        if (!active) return;
        setResults([]);
        const detail = String(searchError?.detail || "");
        setMessage(
          detail.includes("share permission required")
            ? "Seu usuário precisa da permissão “share” para buscar pessoas."
            : searchError?.message || "Não foi possível buscar pessoas agora.",
        );
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [invite, resource]);

  if (!resource) return <dialog ref={dialogRef} className="share-dialog" />;

  const owner =
    currentUser?.name ||
    currentUser?.displayName ||
    currentUser?.fullName ||
    currentUser?.username ||
    (typeof resource.owner === "string"
      ? resource.owner
      : resource.owner?.name || resource.owner?.username) ||
    "Você";
  const ownerEmail =
    currentUser?.email ||
    currentUser?.emailAddress ||
    "Proprietário do arquivo";

  const availableResults = results.filter(
    (user) =>
      user.username !== currentUser?.username &&
      !people.some((person) => person.username === user.username),
  );

  function addPerson(user) {
    setPeople((current) =>
      current.some((person) => person.username === user.username)
        ? current
        : [...current, user],
    );
    setInvite("");
    setResults([]);
    setAccess("restricted");
    setMessage("Pessoa adicionada. Crie o link para salvar o acesso.");
  }

  function removePerson(username) {
    setPeople((current) =>
      current.filter((person) => person.username !== username),
    );
  }

  function addInvite(event) {
    event.preventDefault();
    if (!invite.trim()) return;
    if (availableResults[0]) addPerson(availableResults[0]);
    else
      setMessage(
        searching
          ? "Buscando…"
          : "Nenhuma pessoa encontrada com esse nome de usuário.",
      );
  }

  async function copyLink() {
    if (passwordEnabled && !password) {
      setOptionsExpanded(true);
      setMessage("Digite uma senha ou desative a proteção por senha.");
      return;
    }
    if (access === "restricted" && people.length === 0) {
      setMessage(
        "Adicione pelo menos uma pessoa ou escolha “Qualquer pessoa com o link”.",
      );
      return;
    }
    if (shareCreating) return;
    setShareCreating(true);
    setMessage("Criando link de compartilhamento…");
    try {
      const created = await createResourceShare(
        resource.path || resource.name,
        {
          password: passwordEnabled ? password : "",
          // Empty expiration is treated as permanent by older backend builds too.
          expires: duration === "never" ? "" : duration,
          unit: "days",
          disableAnonymous: access === "restricted",
          allowedUsernames:
            access === "restricted"
              ? people.map((person) => person.username)
              : [],
        },
      );
      if (!created?.hash)
        throw new Error("O File Browser não retornou o identificador do link.");
      const value = getPublicShareUrl(created);
      setShareLink(value);
      try {
        await navigator.clipboard.writeText(value);
        setMessage(
          "Link criado e copiado. O QR code está pronto para compartilhar.",
        );
      } catch {
        setMessage(
          "Link criado. Copie-o no painel; não foi possível copiar automaticamente.",
        );
      }
    } catch (error) {
      const missingUser = /allowed username "(.+)" does not exist/.exec(
        error?.detail || "",
      );
      const details = missingUser
        ? `O usuário “${missingUser[1]}” não existe mais. Remova-o da lista e tente de novo.`
        : String(error?.detail || "").includes("share permission required")
          ? "Seu usuário precisa da permissão global “share” no File Browser Quantum. Peça a um administrador para habilitá-la em User Management."
          : error?.message || "Verifique sua conexão e tente novamente.";
      setMessage(`Não foi possível criar o link. ${details}`);
    } finally {
      setShareCreating(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="share-dialog"
      aria-labelledby="share-dialog-title"
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current.close();
      }}
      onClose={onClose}
    >
      <header className="share-dialog-header">
        <img className="share-brand" src={logo} alt="" />
        <h2 id="share-dialog-title">Compartilhar “{resource.name}”</h2>
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => dialogRef.current?.close()}
        >
          <Close />
        </button>
      </header>
      <form className={`share-invite-form ${invite.trim() ? "has-results" : "no-results"}`} onSubmit={addInvite}>
        <PersonAddAlt1Outlined />
        <input
          aria-label="Adicionar participantes"
          placeholder="Adicionar pessoas pelo nome de usuário"
          value={invite}
          onChange={(event) => setInvite(event.target.value)}
        />
        {invite.trim() && <button type="submit">Convidar</button>}
      </form>
      {invite.trim() && (
        <ul
          className="share-results"
          role="listbox"
          aria-label="Pessoas encontradas"
        >
          {availableResults.map((user) => (
            <li key={user.username}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => addPerson(user)}
              >
                <PersonAvatar
                  username={user.username}
                  avatarUrl={user.avatarUrl}
                />
                <span>{user.username}</span>
              </button>
            </li>
          ))}
          {!availableResults.length && (
            <li className="share-results-empty">
              {searching
                ? "Buscando…"
                : results.some(
                      (user) => user.username === currentUser?.username,
                    )
                  ? "Este é o seu próprio usuário. Escolha outra pessoa."
                  : "Nenhuma pessoa encontrada."}
            </li>
          )}
        </ul>
      )}
      <section className="share-people">
        <h3>Pessoas com acesso</h3>
        <div className="share-person">
          <span className="share-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              owner.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="share-person-info">
            <strong>
              {owner}
              {currentUser ? " (você)" : ""}
            </strong>
            <span>{ownerEmail}</span>
          </div>
          <span className="share-role">Proprietário</span>
        </div>
        {people.map((person) => (
          <div className="share-person" key={person.username}>
            <PersonAvatar
              username={person.username}
              avatarUrl={person.avatarUrl}
            />
            <div className="share-person-info">
              <strong>{person.username}</strong>
              <span>
                {access === "restricted"
                  ? "Precisa entrar para abrir"
                  : "Só vale com acesso restrito"}
              </span>
            </div>
            <span className="share-role">Leitor</span>
            <button
              type="button"
              className="share-person-remove"
              aria-label={`Remover ${person.username}`}
              onClick={() => removePerson(person.username)}
            >
              <Close />
            </button>
          </div>
        ))}
      </section>
      <section className="share-general">
        <h3>Acesso geral</h3>
        <div className="share-access-row">
          <span className="share-access-icon">
            {access === "restricted" ? <LockOutlined /> : <LinkIcon />}
          </span>
          <div className="share-access-detail">
            <select
              aria-label="Acesso geral"
              value={access}
              onChange={(event) => setAccess(event.target.value)}
            >
              <option value="restricted">Restrito</option>
              <option value="anyone">Qualquer pessoa com o link</option>
            </select>
            <p>
              {access === "restricted"
                ? "Só as pessoas com acesso podem abrir usando o link."
                : "Qualquer pessoa com o link pode abrir."}
            </p>
          </div>
        </div>
      </section>
      <section className="share-options">
        <button
          type="button"
          className="share-options-toggle"
          aria-expanded={optionsExpanded}
          onClick={() => setOptionsExpanded((expanded) => !expanded)}
        >
          {optionsExpanded ? <ExpandLess /> : <ExpandMore />}
          <span>Opções de compartilhamento</span>
        </button>
        {optionsExpanded && (
          <div className="share-options-content">
            <label className="share-option-row">
              <span className="share-option-icon">
                <LockOutlined />
              </span>
              <span className="share-option-label">
                Duração do compartilhamento
              </span>
              <select
                aria-label="Duração do compartilhamento"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              >
                <option value="never">Sem prazo de validade</option>
                <option value="1">1 dia</option>
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
              </select>
            </label>
            <div className="share-password-option">
              <label className="share-password-toggle">
                <span className="share-option-icon">
                  <PasswordOutlined />
                </span>
                <span className="share-option-label">
                  Adicionar senha (opcional)
                </span>
                <input
                  type="checkbox"
                  checked={passwordEnabled}
                  onChange={(event) => setPasswordEnabled(event.target.checked)}
                />
              </label>
              {passwordEnabled && (
                <input
                  className="share-password-input"
                  type="password"
                  autoComplete="new-password"
                  aria-label="Senha do compartilhamento"
                  placeholder="Digite uma senha"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
            </div>
          </div>
        )}
      </section>
      {shareLink && (
        <section
          className="share-link-panel"
          aria-label="Link para compartilhamento"
        >
          <div className="share-qr">
            <QRCodeSVG
              value={shareLink}
              size={156}
              level="M"
              marginSize={2}
              title={`QR code para compartilhar ${resource.name}`}
            />
          </div>
          <div className="share-link-details">
            <h3>Link para compartilhamento</h3>
            <p className="share-link-value" title={shareLink}>
              {shareLink}
            </p>
            <button
              type="button"
              className="share-copy-again"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareLink);
                  setMessage("Link copiado");
                } catch {
                  setMessage("Não foi possível copiar automaticamente");
                }
              }}
            >
              <LinkIcon />
              Copiar link
            </button>
            <ul>
              <li>
                Acesso:{" "}
                {access === "restricted"
                  ? "Restrito"
                  : "Qualquer pessoa com o link"}
              </li>
              <li>
                Duração:{" "}
                {duration === "never"
                  ? "Sem prazo de validade"
                  : `${duration} dia${duration === "1" ? "" : "s"}`}
              </li>
              <li>
                Senha:{" "}
                {passwordEnabled && password
                  ? "Configurada"
                  : "Não configurada"}
              </li>
            </ul>
            <small>O acesso e a senha são verificados pelo File Browser.</small>
          </div>
        </section>
      )}
      <footer className="share-dialog-footer">
        <span role="status">{message}</span>
        <button
          type="button"
          className="share-copy-link"
          disabled={shareCreating}
          onClick={copyLink}
        >
          <LinkIcon />
          {shareCreating
            ? "Criando…"
            : shareLink
              ? "Criar novo link"
              : "Criar e copiar link"}
        </button>
        <button
          type="button"
          className="share-done"
          onClick={() => dialogRef.current?.close()}
        >
          Concluído
        </button>
      </footer>
    </dialog>
  );
}
