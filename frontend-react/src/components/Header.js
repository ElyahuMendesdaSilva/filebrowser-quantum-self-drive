import { useEffect, useRef, useState } from "react";
import {
  AdminPanelSettingsOutlined,
  EditOutlined,
  NotificationsOutlined,
  Search,
  SettingsOutlined,
  LogoutOutlined,
  Close,
  InsertDriveFileOutlined,
} from "@mui/icons-material";
import logo from "../icons/logo.png";
import "../css/header.css";
import { deleteUserAvatar, getCurrentUser, getUserAvatar, uploadUserAvatar } from "../api/fileBrowser";

export default function Header({
  onLogout,
  onOpenSettings,
  uploadNotification,
  onOpenUploadNotification,
  onSearch,
  onSearchSubmit,
  onSearchSelect,
  searchResults = [],
  searchLoading = false,
  searchError = "",
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [user, setUser] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const accountRef = useRef(null);
  const searchRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    getCurrentUser().then(async (currentUser) => {
      if (!alive || !currentUser) return;
      setUser(currentUser);
      if (!currentUser.avatarUrl) return;
      try {
        objectUrl = await getUserAvatar(currentUser.username, currentUser.avatarUrl);
        if (alive) setAvatar(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      } catch {
        // Mostra as iniciais se o usuário ainda não tiver uma foto.
      }
    }).catch(() => {});
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => onSearch?.(query),
      query.trim() ? 300 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [query, onSearch]);

  useEffect(() => {
    if (!searchFocused) return undefined;
    function handleOutside(event) {
      if (!searchRef.current?.contains(event.target)) setSearchFocused(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setSearchFocused(false);
      if (event.key === "Enter" && query.trim()) {
        event.preventDefault();
        onSearchSubmit?.(query.trim());
        setSearchFocused(false);
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [searchFocused, query, onSearchSubmit]);

  useEffect(() => {
    if (!accountOpen) return undefined;

    function handlePointerDown(event) {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setAccountOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen]);

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user?.username) return;
    setAvatarError("");
    setAvatarBusy(true);
    try {
      const result = await uploadUserAvatar(user.username, file);
      const nextAvatar = await getUserAvatar(user.username, result?.avatarUrl);
      setAvatar((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextAvatar;
      });
      setUser((previous) => ({ ...previous, avatarUrl: result?.avatarUrl || "updated" }));
    } catch (error) {
      setAvatarError(error.message || "Não foi possível atualizar a foto.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    if (!user?.username) return;
    setAvatarBusy(true);
    setAvatarError("");
    try {
      await deleteUserAvatar(user.username);
      setAvatar((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      setUser((previous) => ({ ...previous, avatarUrl: "" }));
    } catch (error) {
      setAvatarError(error.message || "Não foi possível remover a foto.");
    } finally {
      setAvatarBusy(false);
    }
  }

  const initials = (user?.username || "U").slice(0, 2).toUpperCase();

  return (
    <header className="header">
      <div className="brand">
        <img src={logo} alt="Self Drive" />
        <span>Self Drive</span>
      </div>
      <div
        className={`search-container ${searchFocused && query.trim() ? "has-suggestions" : ""}`}
        ref={searchRef}
      >
        <div className="search-box">
          <Search />
          <input
            type="search"
            placeholder="Pesquisar no Self Drive"
            aria-label="Pesquisar no Self Drive"
            aria-expanded={Boolean(searchFocused && query.trim())}
            aria-controls="search-suggestions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setSearchFocused(true)}
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              aria-label="Limpar pesquisa"
              onClick={() => setQuery("")}
            >
              <Close />
            </button>
          )}
        </div>
        {searchFocused && query.trim() && (
          <div
            className="search-suggestions"
            id="search-suggestions"
            role="listbox"
            aria-label="Sugestões de pesquisa"
          >
            <button
              type="button"
              className="search-query-suggestion"
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSearchSubmit?.(query.trim());
                setSearchFocused(false);
              }}
            >
              <Search />
              <span>{query.trim()}</span>
            </button>
            {query.trim().length < 2 && (
              <div className="search-message">
                Digite pelo menos 2 caracteres
              </div>
            )}
            {searchLoading && (
              <div className="search-message">
                Pesquisando nos seus arquivos…
              </div>
            )}
            {searchError && (
              <div className="search-message search-error">{searchError}</div>
            )}
            {query.trim().length >= 2 &&
              !searchLoading &&
              !searchError &&
              searchResults.slice(0, 6).map((resource) => {
                const location =
                  resource.path
                    .split("/")
                    .filter(Boolean)
                    .slice(0, -1)
                    .join(" / ") || "Meu Drive";
                return (
                  <button
                    type="button"
                    className="search-result-suggestion"
                    role="option"
                    key={resource.path}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSearchSelect?.(resource);
                      setSearchFocused(false);
                    }}
                  >
                    <InsertDriveFileOutlined />
                    <span className="search-result-name">{resource.name}</span>
                    <small>{location}</small>
                  </button>
                );
              })}
            {query.trim().length >= 2 &&
              !searchLoading &&
              !searchError &&
              searchResults.length === 0 && (
                <div className="search-message">Nenhum arquivo encontrado</div>
              )}
            <div className="search-suggestion-footer">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSearchSubmit?.(query.trim());
                  setSearchFocused(false);
                }}
              >
                Ver todos os resultados 
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="header-actions">
        <div className="notification-anchor">
          <button
            type="button"
            aria-label={
              uploadNotification
                ? `Ver status ${uploadNotification.type === "transfer" ? "da transferência" : "do upload"}`
                : "Notificações"
            }
            aria-expanded={Boolean(uploadNotification?.visible)}
            onClick={() => onOpenUploadNotification?.()}
          >
            <NotificationsOutlined />
            {uploadNotification && !uploadNotification.visible && (
              <span
                className={`notification-indicator ${uploadNotification.status === "uploading" ? "is-active" : "is-complete"}`}
                aria-hidden="true"
              />
            )}
          </button>
        </div>
        <div className="account-anchor" ref={accountRef}>
          <button
            type="button"
            className="profile"
            aria-label="Conta"
            aria-haspopup="dialog"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((open) => !open)}
          >
            {avatar ? <img src={avatar} alt="" /> : initials}
          </button>
          {accountOpen && (
            <section
              className="account-popover"
              role="dialog"
              aria-label="Conta do usuário"
            >
              <div className="account-card">
                <div className="account-avatar-wrap">
                  <div className="account-avatar">
                    {avatar ? <img src={avatar} alt="Foto de perfil" /> : initials}
                  </div>
                  <button
                    type="button"
                    className="account-edit"
                    aria-label="Editar foto"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <EditOutlined />
                  </button>
                  <input
                    ref={fileInputRef}
                    className="account-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Escolher foto de perfil"
                    onChange={handleAvatarChange}
                    disabled={avatarBusy || !user?.username}
                  />
                </div>
                <h2 className="account-name">{user?.username || "Conta"}</h2>
                {user?.email && <p className="account-email">{user.email}</p>}
                {avatarError && <p className="account-avatar-error" role="alert">{avatarError}</p>}
                <button
                  type="button"
                  className="account-option"
                  onClick={() => {
                    setAccountOpen(false);
                    onOpenSettings?.();
                  }}
                >
                  <SettingsOutlined />
                  <span>Configurações da Conta</span>
                </button>
                <button
                  type="button"
                  className="account-option account-option-alt"
                >
                  <AdminPanelSettingsOutlined />
                  <span>Administração</span>
                </button>
                <div className="account-divider" />
                <button
                  type="button"
                  className="account-logout"
                  onClick={() => {
                    setAccountOpen(false);
                    onLogout?.();
                  }}
                >
                  <LogoutOutlined />
                  <span>Sair</span>
                </button>
              </div>
              <div className="account-footer">
                Política de Privacidade • Termos de Serviço
              </div>
            </section>
          )}
        </div>
      </div>
    </header>
  );
}
