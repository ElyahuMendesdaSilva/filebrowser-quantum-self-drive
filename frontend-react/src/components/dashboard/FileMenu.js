import {
  ContentCopyOutlined,
  ContentCutOutlined,
  ContentPasteOutlined,
  DeleteOutlineOutlined,
  DownloadOutlined,
  EditOutlined,
  InfoOutlined,
  IosShareOutlined,
  OpenInNewOutlined,
} from "@mui/icons-material";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

function MenuItem({ icon, children, disabled, shortcut, submenu, onClose, onClick }) {
  return (
    <button
      type="button"
      className={`file-menu-item ${disabled ? "disabled" : ""}`}
      disabled={disabled}
      onClick={onClick || onClose}
    >
      {icon}
      <span>{children}</span>
      {shortcut && <small>{shortcut}</small>}
      {submenu && <b>›</b>}
    </button>
  );
}

export default function FileMenu({ fileName, onClose, onOpen, onDownload, onRename, onDelete, onInfo, onDuplicate, onShare, position, cutFile, onCut, onCopy, onPaste }) {
  const menuRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState(null);

  useLayoutEffect(() => {
    if (!position || !menuRef.current) return;
    const bounds = menuRef.current.getBoundingClientRect();
    setAdjustedPosition({
      left: Math.max(8, Math.min(position.x, window.innerWidth - bounds.width - 8)),
      top: Math.max(8, Math.min(position.y, window.innerHeight - bounds.height - 8)),
    });
  }, [position]);

  useEffect(() => {
    const outside = (event) => {
      if (!menuRef.current?.contains(event.target)) onClose();
    };
    const escape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);
  return (
    <div
      className="file-menu"
      ref={menuRef}
      style={position ? {
        position: "fixed",
        left: `${adjustedPosition?.left ?? position.x}px`,
        top: `${adjustedPosition?.top ?? position.y}px`,
        right: "auto",
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "calc(100vh - 16px)",
        overflowY: "auto",
      } : undefined}
      role="menu"
      aria-label={`Opções de ${fileName}`}
    >
      <MenuItem icon={<OpenInNewOutlined />} onClose={onClose} onClick={onOpen}>
        Abrir
      </MenuItem>
      <MenuItem icon={<DownloadOutlined />} onClose={onClose} onClick={onDownload}>
        Baixar
      </MenuItem>
      <div className="file-menu-divider" />
      <MenuItem icon={<EditOutlined />} onClose={onClose} onClick={onRename}>
        Renomear
      </MenuItem>
      <div className="file-menu-divider" />
      <MenuItem icon={<IosShareOutlined />} onClose={onClose} onClick={onShare}>
        Compartilhar
      </MenuItem>
      <MenuItem
        icon={cutFile ? <ContentPasteOutlined /> : <ContentCutOutlined />}
        onClose={onClose}
        onClick={cutFile ? onPaste : onCut}
      >
        {cutFile ? "Colar" : "Recortar"}
      </MenuItem>
      {!cutFile && <MenuItem icon={<ContentCopyOutlined />} onClose={onClose} onClick={onCopy}>Copiar</MenuItem>}
      <MenuItem icon={<ContentCopyOutlined />} onClose={onClose} onClick={onDuplicate}>
        Duplicar
      </MenuItem>
      <MenuItem icon={<InfoOutlined />} onClose={onClose} onClick={onInfo}>
        Informações sobre o arquivo
      </MenuItem>
      <div className="file-menu-divider" />
      <MenuItem icon={<DeleteOutlineOutlined />} onClose={onClose} onClick={onDelete}>
        Lixeira
      </MenuItem>
    </div>
  );
}
