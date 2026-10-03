import { useEffect, useState } from "react";
import { Close, DownloadOutlined, InsertDriveFileOutlined, ZoomIn, ZoomOut } from "@mui/icons-material";
import { fetchPublicShareContent, fetchResourceContent, fetchResourcePreview } from "../../api/fileBrowser";
import "../../css/file-viewer.css";

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "json", "csv", "tsv", "xml", "yaml", "yml", "log", "html", "htm", "css", "js", "jsx", "ts", "tsx", "py", "go", "java", "c", "h", "cpp", "sh"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogv", "mov", "m4v"]);

function previewKind(name) {
  const extension = name.split(".").pop().toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(extension)) return "image";
  if (extension === "pdf") return "pdf";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  return "unavailable";
}

export default function FileViewer({ resource, onClose, onDownload, sharedMode = false, shareHash = "", passwordHash = "" }) {
  const kind = previewKind(resource.name);
  const tooLargeForTextPreview = kind === "text" && Number(resource.size) > 5 * 1024 * 1024;
  const [src, setSrc] = useState("");
  const [text, setText] = useState("");
  const [zoom, setZoom] = useState(1);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [unlocked, setUnlocked] = useState(!passwordHash);
  const [loading, setLoading] = useState(kind !== "unavailable" && !tooLargeForTextPreview);
  const [error, setError] = useState(false);
  const supported = kind !== "unavailable" && !tooLargeForTextPreview;

  useEffect(() => {
    setUnlocked(!passwordHash);
    setPasswordInput("");
    setPasswordError("");
  }, [passwordHash, resource.path]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!supported || (passwordHash && !unlocked)) return undefined;
    let objectUrl = "";
    let cancelled = false;
    setLoading(true);
    setError(false);
    setSrc("");
    setText("");
    (shareHash
      ? fetchPublicShareContent(shareHash, resource.path, resource.viewToken, kind === "audio" || kind === "video")
      : kind === "text" ? fetchResourceContent(resource.path) : fetchResourcePreview(resource.path))
      .then(async (blob) => {
        if (cancelled) return;
        if (kind === "text") {
          if (blob.size > 5 * 1024 * 1024) throw new Error("Arquivo muito grande para visualização");
          const content = await blob.text();
          if (!cancelled) setText(content);
        } else {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resource.path, resource.viewToken, kind, supported, passwordHash, unlocked, shareHash]);

  async function verifyPassword(event) {
    event.preventDefault();
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passwordInput));
      const candidate = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      if (candidate === passwordHash) {
        setPasswordError("");
        setUnlocked(true);
      } else {
        setPasswordError("Senha incorreta. Tente novamente.");
      }
    } catch {
      setPasswordError("Não foi possível validar a senha neste navegador.");
    }
  }

  const showUnavailable = !supported || error;
  if (sharedMode && passwordHash && !unlocked) {
    return <div className="file-viewer file-viewer-shared-mode"><form className="shared-password-dialog" role="dialog" aria-modal="true" aria-labelledby="shared-password-title" onSubmit={verifyPassword}><div className="shared-password-lock"><InsertDriveFileOutlined /></div><h1 id="shared-password-title">Este arquivo está protegido</h1><p>Digite a senha para visualizar “{resource.name}”.</p><input type="password" autoFocus autoComplete="current-password" aria-label="Senha do arquivo" value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} />{passwordError && <span className="shared-password-error" role="alert">{passwordError}</span>}<button type="submit" disabled={!passwordInput}>Continuar</button></form></div>;
  }
  return (
    <div className={`file-viewer ${kind === "text" ? "file-viewer-text-mode" : ""} ${showUnavailable ? "file-viewer-unavailable-mode" : ""} ${sharedMode ? "file-viewer-shared-mode" : ""}`} role="dialog" aria-modal="true" aria-label={`Visualização de ${resource.name}`} onClick={sharedMode ? undefined : onClose}>
      <header className="file-viewer-header" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="file-viewer-close" aria-label="Fechar visualização" onClick={onClose}><Close /></button>
        {kind !== "text" && <InsertDriveFileOutlined className="file-viewer-icon" />}
        <div className="file-viewer-title"><strong title={resource.name}>{resource.name}</strong><span>Arquivo</span></div>
        {kind === "text" && <div className="file-viewer-tools">
          <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}><ZoomOut /></button>
          <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((value) => Math.min(2, value + 0.1))}><ZoomIn /></button>
        </div>}
        {(!sharedMode || !resource.disableDownload) && <button type="button" className="file-viewer-download" onClick={() => onDownload(resource.path)}><DownloadOutlined /><span>Baixar</span></button>}
      </header>
      <main className={`file-viewer-stage ${showUnavailable ? "is-unavailable" : ""}`} onClick={(event) => event.stopPropagation()}>
        {loading && <span className="file-viewer-spinner" aria-label="Carregando visualização" />}
        {!loading && showUnavailable && <section className="file-viewer-unavailable"><h1>Nenhuma visualização disponível</h1>{!sharedMode && <button type="button" onClick={() => onDownload(resource.path)}><DownloadOutlined />Baixar</button>}</section>}
        {!loading && !showUnavailable && kind === "pdf" && src && <iframe title={`Visualização de ${resource.name}`} src={src} />}
        {!loading && !showUnavailable && kind === "image" && src && <img className="file-viewer-image" src={src} alt={resource.name} />}
        {!loading && !showUnavailable && kind === "text" && <pre className="file-viewer-text" style={{ fontSize: `${14 * zoom}px` }}>{text}</pre>}
        {!loading && !showUnavailable && kind === "audio" && src && <audio controls src={src}>Seu navegador não oferece suporte para áudio.</audio>}
        {!loading && !showUnavailable && kind === "video" && src && <video controls src={src}>Seu navegador não oferece suporte para vídeo.</video>}
      </main>
    </div>
  );
}
