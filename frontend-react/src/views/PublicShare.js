import { useEffect, useState } from "react";
import FileViewer from "../components/dashboard/FileViewer";
import logo from "../icons/logo.png";
import { downloadPublicShareResource, getPublicShareResource, login, setToken } from "../api/fileBrowser";
import "../css/login.css";

export default function PublicShare({ hash }) {
  const [resource, setResource] = useState(null);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setNeedsLogin(false);
    getPublicShareResource(hash)
      .then((file) => {
        if (!active) return;
        setResource({
          name: file.name || "Arquivo compartilhado",
          path: file.path || "/",
          size: file.size,
          viewToken: file.viewToken,
          sharedMode: true,
          shareHash: hash,
        });
      })
      .catch((loadError) => {
        if (!active) return;
        const detail = String(loadError?.detail || "").toLowerCase();
        // Link restrito a pessoas específicas: precisa de login no próprio File Browser.
        if (loadError?.status === 401 || (loadError?.status === 403 && detail.includes("anonymous"))) {
          setNeedsLogin(true);
          return;
        }
        if (loadError?.status === 403 && detail.includes("not available to this user")) {
          setLoginError("Sua conta não tem acesso a este link. Entre com outra conta.");
          setNeedsLogin(true);
          return;
        }
        setError(loadError?.message || "Este link não está disponível.");
      });
    return () => { active = false; };
  }, [hash, attempt]);

  async function submitLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoggingIn(true);
    setLoginError("");
    try {
      setToken(null);
      await login(String(form.get("username") || "").trim(), String(form.get("password") || ""), { requireSource: false });
      setAttempt((count) => count + 1);
    } catch (loginFailure) {
      setLoginError(loginFailure?.message || "Não foi possível entrar.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function download(path) {
    try {
      await downloadPublicShareResource(hash, path, resource.name);
    } catch (downloadError) {
      setError(downloadError?.message || "Não foi possível baixar o arquivo.");
    }
  }

  if (needsLogin) {
    return (
      <main className="filebrowser-login-wrap">
        <form className="filebrowser-login" onSubmit={submitLogin}>
          <img className="login-logo" src={logo} alt="Self Drive" />
          <h1>Entre para abrir o arquivo</h1>
          <p>Este link foi compartilhado com pessoas específicas. Entre com sua conta para continuar.</p>
          <label htmlFor="share-login-username">
            Usuário
            <input id="share-login-username" name="username" autoComplete="username" required />
          </label>
          <label htmlFor="share-login-password">
            Senha
            <input id="share-login-password" name="password" type="password" autoComplete="current-password" required />
          </label>
          {loginError && <p className="api-error" role="alert">{loginError}</p>}
          <button type="submit" disabled={loggingIn}>{loggingIn ? "Conectando…" : "Entrar"}</button>
        </form>
      </main>
    );
  }
  if (error) {
    return <main className="file-viewer file-viewer-shared-mode file-viewer-unavailable-mode" role="alert"><section className="file-viewer-unavailable"><h1>Link indisponível</h1><p>{error}</p></section></main>;
  }
  if (!resource) {
    return <main className="file-viewer file-viewer-shared-mode" aria-label="Carregando arquivo compartilhado"><span className="file-viewer-spinner" aria-label="Carregando arquivo" /></main>;
  }
  return <FileViewer resource={resource} sharedMode shareHash={hash} onClose={() => { window.location.assign(`${window.location.pathname}${window.location.search}`); }} onDownload={download} />;
}
