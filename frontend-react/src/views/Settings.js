import { useEffect, useMemo, useState } from "react";
import {
  ArrowBack,
  CheckCircleOutlineOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
import {
  getCurrentUser,
  getUserAvatar,
  getDiskUsage,
  getQuantumSettings,
  updateCurrentUser,
} from "../api/fileBrowser";
import "../css/settings.css";

const groups = [
  { id: "general", label: "Geral", title: "Preferências gerais" },
  { id: "privacy", label: "Privacidade", title: "Privacidade" },
  { id: "notifications", label: "Notificações", title: "Notificações" },
  { id: "apps", label: "Gerenciar apps", title: "Visualização e arquivos" },
];

const preferences = [
  { key: "darkMode", group: "general", label: "Tema escuro", type: "boolean" },
  {
    key: "locale",
    group: "general",
    label: "Idioma",
    type: "select",
    options: [
      ["pt", "Português"],
      ["en", "English"],
      ["es", "Español"],
    ],
  },
  {
    key: "viewMode",
    group: "general",
    label: "Visualização padrão",
    type: "select",
    options: [
      ["grid", "Grade"],
      ["list", "Lista"],
    ],
  },
  {
    key: "dateFormat",
    group: "general",
    label: "Formato de data",
    type: "select",
    options: [
      ["YYYY-MM-DD", "AAAA-MM-DD"],
      ["DD/MM/YYYY", "DD/MM/AAAA"],
      ["MM/DD/YYYY", "MM/DD/AAAA"],
    ],
  },
  {
    key: "themeColor",
    group: "general",
    label: "Cor de destaque",
    type: "color",
  },
  {
    key: "gallerySize",
    group: "general",
    label: "Tamanho das miniaturas",
    type: "number",
    min: 1,
    max: 10,
  },
  {
    key: "stickySidebar",
    group: "general",
    label: "Manter a barra lateral fixa",
    type: "boolean",
  },
  {
    key: "showHidden",
    group: "privacy",
    label: "Mostrar arquivos ocultos",
    type: "boolean",
  },
  {
    key: "singleClick",
    group: "privacy",
    label: "Abrir arquivos com um clique",
    type: "boolean",
  },
  {
    key: "quickDownload",
    group: "privacy",
    label: "Download rápido",
    type: "boolean",
  },
  {
    key: "showSelectMultiple",
    group: "privacy",
    label: "Permitir seleção múltipla",
    type: "boolean",
  },
  {
    key: "disablePreviewExt",
    group: "privacy",
    label: "Extensões sem miniatura (separadas por vírgula)",
    type: "text",
  },
  {
    key: "disableViewingExt",
    group: "privacy",
    label: "Extensões sem visualização (separadas por vírgula)",
    type: "text",
  },
  {
    key: "preview.image",
    group: "apps",
    label: "Visualizar imagens",
    type: "boolean",
  },
  {
    key: "preview.video",
    group: "apps",
    label: "Visualizar vídeos",
    type: "boolean",
  },
  {
    key: "preview.audio",
    group: "apps",
    label: "Reproduzir áudio",
    type: "boolean",
  },
  {
    key: "preview.office",
    group: "apps",
    label: "Visualizar documentos do Office",
    type: "boolean",
  },
  {
    key: "preview.autoplayMedia",
    group: "apps",
    label: "Reproduzir mídia automaticamente",
    type: "boolean",
  },
  {
    key: "preview.motionVideoPreview",
    group: "apps",
    label: "Pré-visualização de vídeos em movimento",
    type: "boolean",
  },
  {
    key: "preview.popup",
    group: "apps",
    label: "Abrir pré-visualizações em janela",
    type: "boolean",
  },
  {
    key: "preview.models",
    group: "apps",
    label: "Visualizar modelos 3D",
    type: "boolean",
  },
  {
    key: "preview.defaultMediaPlayer",
    group: "apps",
    label: "Player de mídia padrão",
    type: "select",
    options: [
      ["video", "Vídeo"],
      ["audio", "Áudio"],
    ],
  },
  {
    key: "fileLoading.maxConcurrentUpload",
    group: "apps",
    label: "Uploads simultâneos",
    type: "number",
    min: 1,
    max: 32,
  },
  {
    key: "fileLoading.uploadChunkSizeMb",
    group: "apps",
    label: "Tamanho dos blocos de upload (MB)",
    type: "number",
    min: 1,
    max: 1024,
  },
  {
    key: "fileLoading.downloadChunkSizeMb",
    group: "apps",
    label: "Tamanho dos blocos de download (MB)",
    type: "number",
    min: 1,
    max: 1024,
  },
  {
    key: "fileLoading.clearAll",
    group: "apps",
    label: "Limpar fila após concluir transferências",
    type: "boolean",
  },
  {
    key: "preferEditorForMarkdown",
    group: "apps",
    label: "Abrir Markdown no editor",
    type: "boolean",
  },
];

function readPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  const result = { ...object };
  let cursor = result;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
  return result;
}

function formatBytes(bytes) {
  const amount = Number(bytes) || 0;
  if (amount < 1024 ** 3) return `${(amount / 1024 ** 2).toFixed(0)} MB`;
  return `${(amount / 1024 ** 3).toFixed(2)} GB`;
}

export default function Settings({ onBack }) {
  const [section, setSection] = useState("general");
  const [user, setUser] = useState(null);
  const [userAvatar, setUserAvatar] = useState("");
  const [defaults, setDefaults] = useState({});
  const [usage, setUsage] = useState(null);
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [savedKey, setSavedKey] = useState("");

  useEffect(() => {
    let alive = true;
    let objectUrl = "";
    if (user?.username && user.avatarUrl) {
      getUserAvatar(user.username, user.avatarUrl).then((url) => {
        objectUrl = url;
        if (alive) setUserAvatar(url);
        else URL.revokeObjectURL(url);
      }).catch(() => setUserAvatar(""));
    } else {
      setUserAvatar("");
    }
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.username, user?.avatarUrl]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      getCurrentUser(),
      getQuantumSettings("userDefaults"),
      getDiskUsage(),
      getQuantumSettings("sources"),
    ]).then((results) => {
      if (!alive) return;
      const [userResult, defaultsResult, usageResult, sourcesResult] = results;
      if (userResult.status === "fulfilled") setUser(userResult.value || {});
      else
        setError(
          userResult.reason?.message || "Não foi possível carregar seu perfil.",
        );
      if (defaultsResult.status === "fulfilled")
        setDefaults(
          defaultsResult.value?.userDefaults || defaultsResult.value || {},
        );
      if (usageResult.status === "fulfilled") setUsage(usageResult.value);
      if (sourcesResult.status === "fulfilled")
        setSources(sourcesResult.value || {});
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const userPrefs = user?.preferences || user?.settings || user || {};
  const visiblePreferences = useMemo(
    () =>
      preferences.filter(({ key }) => {
        const path = key.startsWith("preview.")
          ? key
          : key.startsWith("fileLoading.")
            ? key
            : key;
        return (
          readPath(userPrefs, path) !== undefined ||
          readPath(defaults, path) !== undefined
        );
      }),
    [userPrefs, defaults],
  );

  async function savePreference(key, value) {
    setError("");
    setSavedKey("");
    setSavingKey(key);
    const base = user?.preferences
      ? "preferences"
      : user?.settings
        ? "settings"
        : "";
    const userPath = base ? `${base}.${key}` : key;
    const payload = setPath({}, userPath, value);
    try {
      const updated = await updateCurrentUser(
        user?.username || "self",
        payload,
      );
      setUser((current) => {
        if (updated && typeof updated === "object")
          return { ...current, ...updated };
        if (base)
          return {
            ...current,
            [base]: setPath(current?.[base] || {}, key, value),
          };
        return setPath(current || {}, key, value);
      });
      setSavedKey(key);
      window.setTimeout(
        () => setSavedKey((current) => (current === key ? "" : current)),
        1800,
      );
    } catch (saveError) {
      setError(
        saveError.message || "Não foi possível salvar esta preferência.",
      );
    } finally {
      setSavingKey("");
    }
  }

  const instanceName =
    typeof sources === "object" && sources
      ? Object.keys(sources).join(", ")
      : "";

  return (
    <div className="settings-page">
      <header className="settings-topbar">
        <button type="button" aria-label="Voltar" onClick={onBack}>
          <ArrowBack />
        </button>
        <h1>Configurações</h1>
        <span className="settings-user-avatar">
          {userAvatar ? <img src={userAvatar} alt="" /> : (user?.username || "U").slice(0, 2).toUpperCase()}
        </span>
      </header>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções de configurações">
          {groups.map((item) => (
            <button
              type="button"
              key={item.id}
              className={section === item.id ? "active" : ""}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <main className="settings-content">
          {loading ? (
            <p className="settings-message">Carregando configurações da API…</p>
          ) : (
            <>
              <h2>{groups.find((item) => item.id === section)?.title}</h2>
              {error && (
                <p className="settings-error" role="alert">
                  {error}
                </p>
              )}
              {section === "general" && (
                <section className="settings-card settings-storage">
                  <h3>Armazenamento</h3>
                  {usage ? (
                    <>
                      <div className="settings-storage-track">
                        <span
                          style={{
                            width: `${usage.total ? Math.min(100, (usage.used / usage.total) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <p>
                        {formatBytes(usage.used)} de {formatBytes(usage.total)}{" "}
                        usados ·{" "}
                        {formatBytes(Math.max(0, usage.total - usage.used))}{" "}
                        livres
                      </p>
                      <small>
                        {instanceName
                          ? `Origem: ${instanceName}`
                          : "Uso informado pela origem ativa da API"}
                      </small>
                    </>
                  ) : (
                    <p>Dados de armazenamento indisponíveis na API.</p>
                  )}
                </section>
              )}
              {visiblePreferences
                .filter((preference) => preference.group === section)
                .map((preference) => {
                  const actual = readPath(userPrefs, preference.key);
                  const fallback = readPath(defaults, preference.key);
                  const value = actual !== undefined ? actual : fallback;
                  const inherited =
                    actual === undefined && fallback !== undefined;
                  const busy = savingKey === preference.key;
                  return (
                    <label className="settings-row" key={preference.key}>
                      <span>
                        <strong>{preference.label}</strong>
                        {inherited && (
                          <small>Usando o padrão atual da instância</small>
                        )}
                        {savedKey === preference.key && (
                          <small className="settings-saved">
                            <CheckCircleOutlineOutlined /> Salvo
                          </small>
                        )}
                      </span>
                      {preference.type === "boolean" ? (
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          disabled={busy}
                          onChange={(event) =>
                            savePreference(preference.key, event.target.checked)
                          }
                        />
                      ) : preference.type === "select" ? (
                        <select
                          value={value ?? ""}
                          disabled={busy}
                          onChange={(event) =>
                            savePreference(preference.key, event.target.value)
                          }
                        >
                          {preference.options.map(([option, label]) => (
                            <option key={option} value={option}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : preference.type === "number" ? (
                        <input
                          type="number"
                          min={preference.min}
                          max={preference.max}
                          defaultValue={value ?? ""}
                          disabled={busy}
                          onBlur={(event) => {
                            if (event.target.value !== "")
                              savePreference(
                                preference.key,
                                Number(event.target.value),
                              );
                          }}
                        />
                      ) : preference.type === "color" ? (
                        <input
                          type="color"
                          value={
                            /^#[0-9a-f]{6}$/i.test(value || "")
                              ? value
                              : "#8ab4f8"
                          }
                          disabled={busy}
                          onChange={(event) =>
                            savePreference(preference.key, event.target.value)
                          }
                        />
                      ) : (
                        <input
                          type="text"
                          defaultValue={value ?? ""}
                          disabled={busy}
                          onBlur={(event) =>
                            savePreference(preference.key, event.target.value)
                          }
                        />
                      )}
                    </label>
                  );
                })}
              {section === "general" && (
                <section className="settings-card settings-instance">
                  <div className="settings-instance-icon">
                    <SettingsOutlined />
                  </div>
                  <div>
                    <h3>Configuração da instância</h3>
                    <p>
                      As preferências abaixo vêm da API e podem ser
                      personalizadas para seu perfil. As configurações globais
                      do servidor são fornecidas em modo de consulta pelo
                      Quantum.
                    </p>
                  </div>
                </section>
              )}
              {visiblePreferences.filter(
                (preference) => preference.group === section,
              ).length === 0 &&
                section !== "general" && (
                  <p className="settings-message">
                    A API não disponibilizou preferências editáveis para esta
                    seção.
                  </p>
                )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
