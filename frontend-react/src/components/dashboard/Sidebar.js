import {
  Add,
  AssessmentOutlined,
  Computer,
  ContentPasteOutlined,
  DeleteOutlined,
  DriveFolderUploadOutlined,
  FolderOutlined,
  HomeRounded,
  PeopleOutlined,
  Schedule,
  StarBorder,
  UploadFileOutlined,
} from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      className={`sidebar-item ${active ? "active" : ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const amount = bytes / 1024 ** unitIndex;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(amount)} ${units[unitIndex]}`;
}

function NewMenuContents({ onCreateFolder, onUploadFile, onUploadFolder, showPaste, onPaste }) {
  return (
    <>
      <button type="button" role="menuitem" onClick={onCreateFolder}>
        <FolderOutlined />
        <span>Nova pasta</span>
      </button>
      <button type="button" role="menuitem" onClick={onUploadFile}>
        <UploadFileOutlined />
        <span>Upload de arquivo</span>
      </button>
      <button type="button" role="menuitem" onClick={onUploadFolder}>
        <DriveFolderUploadOutlined />
        <span>Upload de pasta</span>
      </button>
      {showPaste && (
        <button type="button" role="menuitem" onClick={onPaste}>
          <ContentPasteOutlined />
          <span>Colar</span>
        </button>
      )}
    </>
  );
}

export default function Sidebar({
  onCreateFolder,
  onUpload,
  page = "drive",
  onNavigate,
  diskUsage,
  diskUsageError,
  contextMenu,
  onCloseContextMenu,
  cutFile,
  onPaste,
}) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef(null);
  const contextMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    if (!newMenuOpen) return undefined;

    function handlePointerDown(event) {
      if (!newMenuRef.current?.contains(event.target)) setNewMenuOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setNewMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [newMenuOpen]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    function handlePointerDown(event) {
      if (!contextMenuRef.current?.contains(event.target)) onCloseContextMenu?.();
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") onCloseContextMenu?.();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu, onCloseContextMenu]);

  function closeMenus() {
    setNewMenuOpen(false);
    onCloseContextMenu?.();
  }

  function startFolderUpload() {
    folderInputRef.current?.click();
    closeMenus();
  }

  function startFileUpload() {
    fileInputRef.current?.click();
    closeMenus();
  }

  function createFolder() {
    closeMenus();
    onCreateFolder?.();
  }

  function paste() {
    closeMenus();
    onPaste?.();
  }

  function contextMenuStyle() {
    if (!contextMenu) return undefined;
    return {
      position: "fixed",
      left: `${Math.max(8, Math.min(contextMenu.x, window.innerWidth - 258))}px`,
      top: `${Math.max(8, Math.min(contextMenu.y, window.innerHeight - 150))}px`,
      maxWidth: "calc(100vw - 16px)",
      zIndex: 80,
    };
  }

  return (
    <aside className={`sidebar ${contextMenu ? "context-menu-open" : ""}`}>
      <div className="new-menu-anchor" ref={newMenuRef}>
        <button
          type="button"
          className="new-button"
          aria-haspopup="menu"
          aria-expanded={newMenuOpen}
          onClick={() => setNewMenuOpen((open) => !open)}
        >
          <Add />
          <span>Novo</span>
        </button>
        {newMenuOpen && (
          <div className="new-menu" role="menu" aria-label="Criar ou enviar">
            <NewMenuContents onCreateFolder={createFolder} onUploadFile={startFileUpload} onUploadFolder={startFolderUpload} />
          </div>
        )}
        <input
          ref={fileInputRef}
          className="upload-input"
          type="file"
          multiple
          aria-label="Selecionar arquivos para upload"
          onChange={(event) => {
            onUpload?.(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          className="upload-input"
          type="file"
          multiple
          webkitdirectory=""
          aria-label="Selecionar pasta para upload"
          onChange={(event) => {
            onUpload?.(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {contextMenu && (
        <div className="new-menu context-new-menu" ref={contextMenuRef} style={contextMenuStyle()} role="menu" aria-label="Criar ou enviar">
          <NewMenuContents onCreateFolder={createFolder} onUploadFile={startFileUpload} onUploadFolder={startFolderUpload} showPaste={Boolean(cutFile)} onPaste={paste} />
        </div>
      )}
      <nav style={{gap:3}}>
        <SidebarItem
          active={page === "drive"}
          onClick={() => onNavigate?.("drive")}
          icon={<HomeRounded />}
          label="Pessoal"
        />
        <SidebarItem active={page === "shared"} onClick={() => onNavigate?.("shared")} icon={<PeopleOutlined />} label="Compartilhados" />
        <SidebarItem active={page === "recent"} onClick={() => onNavigate?.("recent")} icon={<Schedule />} label="Recentes" />
        <SidebarItem
          active={page === "favorites"}
          onClick={() => onNavigate?.("favorites")}
          icon={<StarBorder />}
          label="Com estrela"
        />
        <SidebarItem
          active={page === "trash"}
          onClick={() => onNavigate?.("trash")}
          icon={<DeleteOutlined />}
          label="Lixeira"
        />
        <SidebarItem
          active={page === "statistics"}
          onClick={() => onNavigate?.("statistics")}
          icon={<AssessmentOutlined />}
          label="Estatísticas"
        />
      </nav>
      <div className="storage" aria-label="Uso do disco">
        <div>
          <i style={{ width: `${diskUsage?.percentage || 0}%` }} />
        </div>
        <span>
          {diskUsage
            ? `${formatBytes(diskUsage.used)} ${diskUsage.total > 0 ? ` de ${formatBytes(diskUsage.total)}` : ""} usados`
            : diskUsageError || "Carregando armazenamento…"}
        </span>
      </div>
      {/* Creditos */}
      <div className="sidebar-credit">
        <a href="#" style={{textDecoration:"none",color:"#797985"}}>@elyahumendes</a>
      </div>
    </aside>
  );
}
