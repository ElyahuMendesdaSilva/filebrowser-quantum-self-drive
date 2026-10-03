import { Close, InsertDriveFileOutlined } from "@mui/icons-material";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchResourcePreview } from "../../api/fileBrowser";
import FileIcon from "./FileIcon";

function formatSize(size) {
  if (size === undefined || size === null || Number.isNaN(Number(size))) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { style: "unit", unit: "byte", unitDisplay: "narrow", notation: "compact", maximumFractionDigits: 1 }).format(Number(size));
}

function formatDate(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não informado" : date.toLocaleString("pt-BR");
}

function extensionOf(name) {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index + 1).toUpperCase() : "Arquivo";
}

function Preview({ resource, url, error }) {
  const extension = extensionOf(resource.name).toLowerCase();
  if (error) return <div className="file-info-preview-message">Não foi possível carregar a prévia.</div>;
  if (!url) return <div className="file-info-preview-message"><span className="file-info-skeleton" />Carregando prévia…</div>;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(extension)) {
    return <img className="file-info-preview-content" src={url} alt={`Prévia de ${resource.name}`} />;
  }
  if (extension === "pdf") return <iframe className="file-info-preview-content" src={url} title={`Prévia de ${resource.name}`} />;
  return <div className="file-info-preview-message"><InsertDriveFileOutlined />Prévia indisponível para este tipo de arquivo.</div>;
}

export default function FileInfoDialog({ resource, onClose, onDownload }) {
  const dialogRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const path = resource?.path || resource?.name || "";
  const fileType = useMemo(() => extensionOf(resource?.name || ""), [resource?.name]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (resource && dialog && !dialog.open) dialog.showModal();
    if (!resource && dialog?.open) dialog.close();
  }, [resource]);

  useEffect(() => {
    let objectUrl;
    let active = true;
    setPreviewUrl("");
    setPreviewError(false);
    setCopyMessage("");
    if (!resource) return undefined;

    const extension = extensionOf(resource.name).toLowerCase();
    if (!["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "pdf"].includes(extension)) return undefined;

    fetchResourcePreview(path)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setPreviewError(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resource, path]);

  if (!resource) return <dialog ref={dialogRef} className="file-info-modal" />;

  const owner = typeof resource.owner === "string"
    ? resource.owner
    : resource.owner?.username || resource.owner?.name || "Não informado";

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(path);
      setCopyMessage("Caminho copiado");
    } catch {
      setCopyMessage("Não foi possível copiar");
    }
    window.setTimeout(() => setCopyMessage(""), 1800);
  }

  return (
    <dialog
      ref={dialogRef}
      className="file-info-modal"
      aria-labelledby="file-info-title"
      onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }}
      onClose={onClose}
    >
      <header className="file-info-head">
        <span className={`file-info-icon ${fileType.toLowerCase()}`}><FileIcon type={fileType.toLowerCase()} /></span>
        <h2 id="file-info-title" title={resource.name}>{resource.name}</h2>
        <button type="button" className="file-info-close" aria-label="Fechar" onClick={() => dialogRef.current?.close()}><Close /></button>
      </header>
      <div className="file-info-body">
        <div className="file-info-preview"><Preview resource={resource} url={previewUrl} error={previewError} /></div>
        <dl className="file-info-meta">
          <div><dt>Tipo</dt><dd><span className="file-info-chip">{fileType}</span></dd></div>
          <div><dt>Tamanho</dt><dd>{formatSize(resource.size)}</dd></div>
          <div><dt>Proprietário</dt><dd>{owner}</dd></div>
          <div><dt>Criado em</dt><dd>{formatDate(resource.created || resource.createdAt)}</dd></div>
          <div><dt>Modificado em</dt><dd>{formatDate(resource.modified || resource.modifiedAt)}</dd></div>
          <div><dt>Localização</dt><dd>{path.includes("/") ? path.slice(0, path.lastIndexOf("/")) || "/" : "/"}</dd></div>
          <div><dt>Descrição</dt><dd>{resource.description || "Sem descrição"}</dd></div>
        </dl>
      </div>
      <footer className="file-info-foot">
        <span role="status">{copyMessage}</span>
        <button type="button" className="file-info-button" onClick={copyPath}>Copiar caminho</button>
        <button type="button" className="file-info-button primary" onClick={() => onDownload(path)}>Baixar</button>
      </footer>
    </dialog>
  );
}
