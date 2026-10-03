import { MoreVert, Star, StarBorder } from "@mui/icons-material";
import { useState } from "react";
import FileIcon from "./FileIcon";
import FileMenu from "./FileMenu";

function folderPathFor(path) {
  if (!path) return "/";
  return path.slice(0, path.lastIndexOf("/")) || "/";
}

export default function FilesList({
  files,
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
  selectedPaths,
  cutPaths,
  favoritePaths,
  onToggleFavorite,
  cutPath,
  cutFile,
  onCut,
  onPaste,
}) {
  const [contextMenu, setContextMenu] = useState(null);
  return (
    <div className="files-list" role="table">
      <div className="list-header" role="row">
        <span>Nome</span>
        <span>Modificado</span>
        <span>Local</span>
        <i />
      </div>
      {files.map(([name, type, , date, path, resource], index) => {
        const menuId = `list-${index}`;
        const folderPath = folderPathFor(path);
        const isFavorite = favoritePaths?.has(path);
        return (
          <article
            data-selectable-file="true"
            data-resource-path={path}
            className={`list-row ${selectedPaths?.has(path) ? "selection-selected" : ""} ${openMenu === menuId ? "menu-open" : ""} ${cutPath === path || cutPaths?.has(path) ? "cut-pending" : ""}`}
            role="row"
            key={path || `${name}-${index}`}
            onDoubleClick={(event) => {
              if (event.target.closest("button")) return;
              onOpen(resource);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({
                id: menuId,
                position: { x: event.clientX, y: event.clientY },
              });
              onShowMenu(menuId);
            }}
          >
            <div className="list-name">
              <FileIcon type={type} />
              <strong>{name}</strong>
            </div>
            <span className="list-modified">
              <span>{date}</span>
              <button
                className={`favorite-toggle ${isFavorite ? "is-favorite" : ""}`}
                type="button"
                aria-label={
                  isFavorite
                    ? `Remover ${name} dos favoritos`
                    : `Adicionar ${name} aos favoritos`
                }
                aria-pressed={Boolean(isFavorite)}
                title={
                  isFavorite
                    ? "Remover dos favoritos"
                    : "Adicionar aos favoritos"
                }
                onContextMenu={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite(resource, date);
                }}
              >
                {isFavorite ? <Star /> : <StarBorder />}
              </button>
            </span>
            <span className="list-location" title={folderPath}>
              {folderPath}
            </span>
            <button
              className="file-options"
              type="button"
              aria-label={`Opções de ${name}`}
              aria-expanded={openMenu === menuId}
              onClick={() => {
                setContextMenu(null);
                onToggleMenu(menuId);
              }}
            >
              <MoreVert />
            </button>
            {openMenu === menuId && (
              <FileMenu
                fileName={name}
                position={
                  contextMenu?.id === menuId ? contextMenu.position : undefined
                }
                onClose={onCloseMenu}
                onOpen={() => onOpen(resource)}
                cutFile={cutFile?.path === path ? cutFile : null}
                onCut={() => onCut(resource)}
                onPaste={onPaste}
                onCopy={() => onCopy(resource)}
                onDuplicate={() => onDuplicate(path, name)}
                onDownload={() => onDownload(path)}
                onRename={() => onRename(path, name)}
                onDelete={() => onDelete(path, name, false)}
                onInfo={() => onInfo(resource)}
                onShare={() => onShare(resource)}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}
