import {
  DeleteOutlineOutlined,
  EditOutlined,
  MoreVert,
  OpenInNew,
} from "@mui/icons-material";
import { useEffect, useState } from "react";
import FileIcon from "../components/dashboard/FileIcon";

function fileType(name = "") {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return "image";
  if (["doc", "docx", "odt", "txt", "rtf"].includes(ext)) return "doc";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "zip";
  return "file";
}

export default function Shared({
  shares,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  onOpen,
  selectedPaths,
  onToggleSelected,
}) {
  const [contextMenu, setContextMenu] = useState(null);
  useEffect(() => {
    if (!contextMenu) return undefined;
    const dismiss = () => setContextMenu(null);
    const escape = (event) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("click", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [contextMenu]);
  const files = shares.map((share) => {
    const name =
      share.name ||
      share.path?.split("/").filter(Boolean).pop() ||
      "Item compartilhado";
    const path = share.path || `/${name}`;
    return { share, name, path, type: fileType(name) };
  });
  const renderItem = ({ share, name, path, type }) => (
    <article
      key={share.hash}
      data-selectable-file="true"
      data-resource-path={path}
      className={`list-row ${selectedPaths?.has(path) ? "selection-selected" : ""}`}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ share, x: event.clientX, y: event.clientY });
      }}
    >
      <div className="list-name">
        <input
          className="shared-select-checkbox"
          type="checkbox"
          aria-label={`Selecionar ${name}`}
          checked={Boolean(selectedPaths?.has(path))}
          onChange={() => onToggleSelected(path)}
        />
        <FileIcon type={type} />
        <strong>{name}</strong>
      </div>
      <span className="list-modified">Compartilhado</span>
      <span className="list-location" title={path}>
        {path}
      </span>
      <button
        className="file-options"
        type="button"
        aria-label={`Ações de ${name}`}
        aria-expanded={contextMenu?.share.hash === share.hash}
        onClick={(event) => {
          event.stopPropagation();
          if (contextMenu?.share.hash === share.hash) {
            setContextMenu(null);
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          setContextMenu({ share, x: rect.right, y: rect.bottom });
        }}
      >
        <MoreVert />
      </button>
    </article>
  );

  return (
    <section
      className="favorites-page shared-page"
      aria-labelledby="shared-title"
    >
      <header className="trash-heading">
        <h1 id="shared-title">Compartilhados</h1>
      </header>
      {error && (
        <p className="api-error" role="alert">
          {error}
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </p>
      )}
      {loading ? (
        <p className="empty-state">Carregando compartilhamentos…</p>
      ) : files.length === 0 ? (
        <p className="empty-state">
          Você ainda não compartilhou nenhum arquivo ou pasta.
        </p>
      ) : (
        <div className="files-list" role="table">
          <div className="list-header" role="row">
            <span>Nome</span>
            <span>Modificado</span>
            <span>Local</span>
            <i />
          </div>
          {files.map(renderItem)}
        </div>
      )}
      {contextMenu && (
        <div
          className="file-menu shared-context-menu"
          role="menu"
          aria-label="Ações do compartilhamento"
          style={{
            position: "fixed",
            left: `${Math.max(8, Math.min(contextMenu.x, window.innerWidth - 220))}px`,
            top: `${Math.max(8, Math.min(contextMenu.y, window.innerHeight - 150))}px`,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="file-menu-item"
            role="menuitem"
            onClick={() => {
              onOpen(contextMenu.share);
              setContextMenu(null);
            }}
          >
            <OpenInNew />
            <span>Abrir o link</span>
          </button>
          <button
            type="button"
            className="file-menu-item"
            role="menuitem"
            onClick={() => {
              onEdit(contextMenu.share);
              setContextMenu(null);
            }}
          >
            <EditOutlined />
            <span>Editar</span>
          </button>
          <button
            type="button"
            className="file-menu-item"
            role="menuitem"
            onClick={() => {
              onDelete(contextMenu.share);
              setContextMenu(null);
            }}
          >
            <DeleteOutlineOutlined />
            <span>Deletar</span>
          </button>
        </div>
      )}
    </section>
  );
}
