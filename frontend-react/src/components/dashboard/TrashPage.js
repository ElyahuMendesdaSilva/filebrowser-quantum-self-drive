import {
  DeleteForeverOutlined,
  GridView,
  MoreVert,
  RestoreFromTrashOutlined,
  Folder,
  ViewList,
} from "@mui/icons-material";
import { useMemo, useState } from "react";
import FileIcon from "./FileIcon";
import FilePreview from "./FilePreview";

function typeFor(name) {
  const extension = name?.split(".").pop().toLowerCase();
  if (extension === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension))
    return "image";
  if (["doc", "docx", "odt", "txt", "rtf"].includes(extension)) return "doc";
  return "file";
}

function dateFor(value) {
  if (!value) return null;
  const numericValue =
    typeof value === "number" || /^\d+(?:\.\d+)?$/.test(String(value))
      ? Number(value)
      : null;
  const timestamp =
    numericValue === null
      ? value
      : numericValue < 1e12
        ? numericValue * 1000
        : numericValue;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function groupLabel(date) {
  if (!date) return "Data desconhecida";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((today - day) / 86400000);
  if (difference === 0) return "Hoje";
  if (difference === 1) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function TrashCard({ item, onRestore, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const type = typeFor(item.name);
  const preview =
    type === "image" ? "landscape" : type === "zip" ? "zip" : "paper";

  return (
    <article className="file-card trash-card">
      <div className="file-card-title">
        {item.isDir ? (
          <Folder className="file-type" />
        ) : (
          <FileIcon type={type} />
        )}
        <strong title={item.name}>{item.name}</strong>
        <button
          className="file-options"
          type="button"
          aria-label={`Opções de ${item.name}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreVert />
        </button>
      </div>
      {item.isDir ? (
        <div className="trash-folder-preview">
          <Folder />
        </div>
      ) : (
        <FilePreview type={preview} />
      )}
      <div className="file-meta">
        <span>
          Enviado{" "}
          {dateFor(item.trashedAt)?.toLocaleDateString("pt-BR") || "sem data"}
        </span>
      </div>
      {menuOpen && (
        <div className="trash-card-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={!item.originalPath}
            onClick={() => {
              setMenuOpen(false);
              onRestore(item);
            }}
          >
            <RestoreFromTrashOutlined />
            Restaurar
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onDelete(item);
            }}
          >
            <DeleteForeverOutlined />
            Excluir permanentemente
          </button>
        </div>
      )}
    </article>
  );
}

function TrashRow({ item, onRestore, onDelete }) {
  return (
    <div className="trash-row">
      <div className="list-name">
        {item.isDir ? (
          <Folder className="file-type" />
        ) : (
          <FileIcon type={typeFor(item.name)} />
        )}
        <strong title={item.name}>{item.name}</strong>
      </div>
      <span>
        {dateFor(item.trashedAt)?.toLocaleString("pt-BR") ||
          "Data desconhecida"}
      </span>
      <span
        className="trash-original-path"
        title={item.originalPath || "Caminho original desconhecido"}
      >
        {item.originalPath || "Caminho original desconhecido"}
      </span>
      <button
        type="button"
        aria-label={`Restaurar ${item.name}`}
        title="Restaurar"
        disabled={!item.originalPath}
        onClick={() => onRestore(item)}
      >
        <RestoreFromTrashOutlined />
      </button>
      <button
        type="button"
        aria-label={`Excluir ${item.name} permanentemente`}
        title="Excluir permanentemente"
        onClick={() => onDelete(item)}
      >
        <DeleteForeverOutlined />
      </button>
    </div>
  );
}

export default function TrashPage({
  items,
  loading,
  error,
  view,
  onViewChange,
  onEmpty,
  onRestore,
  onDelete,
  onRetry,
}) {
  const groups = useMemo(() => {
    const grouped = new Map();
    const sortedItems = [...items].sort(
      (first, second) =>
        (dateFor(second.trashedAt)?.getTime() || 0) -
        (dateFor(first.trashedAt)?.getTime() || 0),
    );
    for (const item of sortedItems) {
      const label = groupLabel(dateFor(item.trashedAt));
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(item);
    }
    return [...grouped.entries()];
  }, [items]);

  return (
    <section className="trash-page" aria-labelledby="trash-title">
      <header className="trash-heading">
        <h1 id="trash-title">Lixeira</h1>
        <div className="view-toggle">
          <button
            type="button"
            className={view === "list" ? "selected" : ""}
            onClick={() => onViewChange("list")}
            aria-label="Visualização em lista"
            aria-pressed={view === "list"}
          >
            <ViewList />
          </button>
          <button
            type="button"
            className={view === "grid" ? "selected" : ""}
            onClick={() => onViewChange("grid")}
            aria-label="Visualização em grade"
            aria-pressed={view === "grid"}
          >
            <GridView />
          </button>
        </div>
      </header>
      <div className="trash-notice">
        <span>
          Os itens da lixeira serão excluídos permanentemente após 30 dias
        </span>
        <button
          type="button"
          onClick={onEmpty}
          disabled={!items.length || loading}
        >
          Esvaziar lixeira
        </button>
      </div>
      {error && (
        <p className="api-error" role="alert">
          {error}
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </p>
      )}
      {loading ? (
        <p className="empty-state">Carregando lixeira…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">A lixeira está vazia.</p>
      ) : (
        groups.map(([label, groupedItems]) => (
          <section className="trash-date-group" key={label}>
            <h2>{label}</h2>
            {view === "grid" ? (
              <div className="files-grid">
                {groupedItems.map((item) => (
                  <TrashCard
                    key={item.trashPath}
                    item={item}
                    onRestore={onRestore}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            ) : (
              <div className="trash-list">
                <div className="trash-list-header">
                  <span>Nome</span>
                  <span>Data do envio</span>
                  <span>Caminho original</span>
                  <i />
                </div>
                {groupedItems.map((item) => (
                  <TrashRow
                    key={item.trashPath}
                    item={item}
                    onRestore={onRestore}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </section>
  );
}
