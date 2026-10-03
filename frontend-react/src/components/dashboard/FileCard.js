import { MoreVert, Star, StarBorder } from "@mui/icons-material";
import FileIcon from "./FileIcon";
import FileMenu from "./FileMenu";
import FilePreview from "./FilePreview";

export default function FileCard({
  file,
  index,
  openMenu,
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
  isFavorite,
  onToggleFavorite,
  isCut,
  cutFile,
  onCut,
  onPaste,
  isSelected,
}) {
  const [name, type, preview, date, path, resource] = file;
  const menuId = `grid-${index}`;
  return (
    <article
      data-selectable-file="true"
      data-resource-path={path}
      className={`file-card ${isSelected ? "selection-selected" : ""} ${openMenu === menuId ? "menu-open" : ""} ${isCut ? "cut-pending" : ""}`}
      onDoubleClick={(event) => {
        if (event.target.closest("button")) return;
        onOpen(resource);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onShowMenu(menuId);
      }}
    >
      <div className="file-card-title">
        <FileIcon type={type} />
        <strong>{name}</strong>
        <button
          className="file-options"
          type="button"
          aria-label={`Opções de ${name}`}
          aria-expanded={openMenu === menuId}
          onClick={() => onToggleMenu(menuId)}
        >
          <MoreVert />
        </button>
      </div>
      <FilePreview type={preview} />
      <div className="file-meta">
        <div className="avatar">E</div>
        <span>{date}</span>
        <button
          className={`favorite-toggle ${isFavorite ? "is-favorite" : ""}`}
          type="button"
          aria-label={
            isFavorite
              ? `Remover ${name} dos favoritos`
              : `Adicionar ${name} aos favoritos`
          }
          aria-pressed={isFavorite}
          title={
            isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"
          }
          onContextMenu={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(resource, date);
          }}
        >
          {isFavorite ? <Star /> : <StarBorder />}
        </button>
      </div>
      {openMenu === menuId && (
        <FileMenu
          fileName={name}
          cutFile={cutFile?.path === path ? cutFile : null}
          onOpen={() => onOpen(resource)}
          onCut={() => onCut(resource)}
          onPaste={onPaste}
          onCopy={() => onCopy(resource)}
          onDuplicate={() => onDuplicate(path, name)}
          onClose={onCloseMenu}
          onDownload={() => onDownload(path)}
          onRename={() => onRename(path, name)}
          onDelete={() => onDelete(path, name, false)}
          onInfo={() => onInfo(resource)}
          onShare={() => onShare(resource)}
        />
      )}
    </article>
  );
}
