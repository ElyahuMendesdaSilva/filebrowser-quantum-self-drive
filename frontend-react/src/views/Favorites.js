import { useMemo } from "react";
import { GridView, ViewList } from "@mui/icons-material";
import FileCard from "../components/dashboard/FileCard";
import FilesList from "../components/dashboard/FilesList";

function fileType(name) {
  const extension = name?.split(".").pop().toLowerCase();
  if (extension === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension))
    return "image";
  if (["doc", "docx", "odt", "txt", "rtf"].includes(extension)) return "doc";
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "zip";
  return "file";
}

export default function Favorites({
  items,
  title = "Com estrela",
  emptyMessage,
  favoritePaths,
  openMenu,
  view,
  onViewChange,
  onToggleMenu,
  onShowMenu,
  onCloseMenu,
  onOpen,
  onDownload,
  onRename,
  onDelete,
  onInfo,
  onShare,
  onDuplicate,
  onCopy,
  selectedPaths,
  cutPaths,
  onToggleFavorite,
  cutPath,
  cutFile,
  onCut,
  onPaste,
}) {
  const files = useMemo(
    () =>
      items.map((item) => [
        item.name,
        fileType(item.name),
        fileType(item.name) === "image"
          ? "landscape"
          : fileType(item.name) === "zip"
            ? "zip"
            : "paper",
        item.displayModified || "Sem data",
        item.path,
        item,
      ]),
    [items],
  );

  return (
    <section className="favorites-page" aria-labelledby="favorites-title">
      <header className="trash-heading">
        <h1 id="favorites-title">{title}</h1>
        <div className="view-toggle">
          <button type="button" className={view === "list" ? "selected" : ""} onClick={() => onViewChange("list")} aria-label="Visualização em lista" aria-pressed={view === "list"}><ViewList /></button>
          <button type="button" className={view === "grid" ? "selected" : ""} onClick={() => onViewChange("grid")} aria-label="Visualização em grade" aria-pressed={view === "grid"}><GridView /></button>
        </div>
      </header>
      {files.length === 0 ? (
        <p className="empty-state">{emptyMessage || (title === "Recentes" ? "Os arquivos que você abrir aparecerão aqui." : "Você ainda não favoritou nenhum arquivo. Use a estrela ao lado da data de modificação para adicionar um arquivo.")}</p>
      ) : (
        view === "grid" ? (
          <div className="files-grid">
            {files.map((file, index) => <FileCard key={file[4]} file={file} index={index} openMenu={openMenu} onToggleMenu={onToggleMenu} onShowMenu={onShowMenu} onCloseMenu={onCloseMenu} onOpen={onOpen} onDownload={onDownload} onRename={onRename} onDelete={onDelete} onInfo={onInfo} onShare={onShare} onDuplicate={onDuplicate} onCopy={onCopy} isFavorite={favoritePaths.has(file[4])} onToggleFavorite={onToggleFavorite} isCut={cutPath === file[4] || cutPaths?.has(file[4])} cutFile={cutFile} onCut={onCut} onPaste={onPaste} isSelected={selectedPaths?.has(file[4])} />)}
          </div>
        ) : <FilesList
          files={files}
          favoritePaths={favoritePaths}
          openMenu={openMenu}
          onToggleMenu={onToggleMenu}
          onShowMenu={onShowMenu}
          onCloseMenu={onCloseMenu}
          onOpen={onOpen}
          onDownload={onDownload}
          onRename={onRename}
          onDelete={onDelete}
          onInfo={onInfo}
          onShare={onShare}
          onDuplicate={onDuplicate}
          onCopy={onCopy}
          selectedPaths={selectedPaths}
          cutPaths={cutPaths}
          onToggleFavorite={onToggleFavorite}
          cutPath={cutPath}
          cutFile={cutFile}
          onCut={onCut}
          onPaste={onPaste}
        />
      )}
    </section>
  );
}
