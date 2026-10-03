import { useState } from "react";
import logo from "../icons/logo.png";
import { listResources, login, setToken } from "../api/fileBrowser";
import "../css/login.css";

export default function Login({ onAuthenticated }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      await login(form.get("username").trim(), form.get("password"));
      await listResources("/");
      window.history.replaceState({}, "", "/dashboard");
      onAuthenticated();
    } catch (requestError) {
      setToken(null);
      setError(requestError.message || "Não foi possível entrar no File Browser.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="filebrowser-login-wrap">
      <form className="filebrowser-login" onSubmit={handleSubmit}>
        <img className="login-logo" src={logo} alt="Self Drive" />
        <h1>Fazer login</h1>
        <p>Acesse seus arquivos pelo File Browser.</p>
        <label htmlFor="filebrowser-username">
          Usuário
          <input
            id="filebrowser-username"
            name="username"
            autoComplete="username"
            required
          />
        </label>
        <label htmlFor="filebrowser-password">
          Senha
          <input
            id="filebrowser-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="api-error" role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Conectando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
