import { ChevronRight, GridView, ViewList, Folder, MoreVert, PeopleOutlined, CloudUploadOutlined, ContentCopyOutlined, ContentCutOutlined, Close, DeleteOutlineOutlined, DownloadOutlined, IosShareOutlined, EditOutlined } from "@mui/icons-material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FileCard from "../components/dashboard/FileCard";
import FileInfoDialog from "../components/dashboard/FileInfoDialog";
import TrashPage from "../components/dashboard/TrashPage";
import RenameDialog from "../components/dashboard/RenameDialog";
import FilesList from "../components/dashboard/FilesList";
import Sidebar from "../components/dashboard/Sidebar";
import Header from "../components/Header";
import Statistics from "./Statistics";
import Settings from "./Settings";
import Favorites from "./Favorites";
import Shared from "./Shared";
import UploadNotification from "../components/dashboard/UploadNotification";
import ImageViewer from "../components/dashboard/ImageViewer";
import FileViewer from "../components/dashboard/FileViewer";
import ShareDialog from "../components/dashboard/ShareDialog";
import {
  createFolder,
  downloadResource,
  downloadResourcesAsZip,
  emptyTrash as emptyTrashApi,
  getDiskUsage,
  getStorageBreakdown,
  getFavorites,
  getToken,
  listResources,
  searchResources,
  invalidateResourceSearchCache,
  listTrash,
  login,
  moveResource,
  moveToTrash,
  removeFavoritesForPath,
  renameFavorite,
  permanentlyDeleteTrashItem,
  renameResource,
  restoreFromTrash,
  setToken,
  toggleFavorite,
  uploadFiles,
  listResourceShares,
  deleteResourceShare,
  updateResourceShare,
  getPublicShareUrl,
} from "../api/fileBrowser";
import "../css/dashboard.css";

const RECENT_FILES_KEY = "self-drive-recent-files";

function readRecentFiles() {
  try {
    const items = JSON.parse(window.localStorage.getItem(RECENT_FILES_KEY) || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function readSharedLink() {
  const hash = window.location.hash;
  if (!hash.startsWith("#share?")) return null;
  const params = new URLSearchParams(hash.slice("#share?".length));
  try {
    const encoded = params.get("data");
    if (!encoded) return null;
    const data = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    return data?.path && data?.name ? data : null;
  } catch {
    return null;
  }
}

function fileType(name) {
  const extension = name.split(".").pop().toLowerCase();
  if (extension === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) return "image";
  if (["doc", "docx", "odt", "txt", "rtf"].includes(extension)) return "doc";
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "zip";
  return "file";
}

function parseFileDate(value) {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const [, year, month, day] = dateOnly;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const legacyDate = value.match(/^\/Date\((-?\d+)\)\/$/);
    if (legacyDate) value = Number(legacyDate[1]);
  }

  const numericValue = typeof value === "number" || /^-?\d+(?:\.\d+)?$/.test(String(value))
    ? Number(value)
    : null;
  let date;
  if (numericValue !== null) {
    const magnitude = Math.abs(numericValue);
    const milliseconds = magnitude >= 1e17
      ? numericValue / 1e6
      : magnitude >= 1e14
        ? numericValue / 1e3
        : magnitude >= 1e11
          ? numericValue
          : numericValue * 1000;
    date = new Date(milliseconds);
  } else {
    date = new Date(value);
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

function modifiedLabel(resource) {
  const value = resource.modified
    ?? resource.modTime
    ?? resource.mod_time
    ?? resource.mtime
    ?? resource.updatedAt
    ?? resource.lastModified;
  const date = parseFileDate(value);
  return date ? `Modificado em ${date.toLocaleDateString("pt-BR")}` : "Sem data";
}

function resourcePath(parent, name, isDir = false) {
  const path = `${parent.replace(/\/$/, "")}/${name}`;
  return isDir ? `${path}/` : path;
}

function FolderCard({ folder, onOpen, onRename, onDelete, onCopy, onCut, onShare, onDownload, isSelected }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <article data-selectable-file="true" data-resource-path={folder.path} className={`folder-card ${isSelected ? "selection-selected" : ""} ${menuOpen ? "folder-card-menu-open" : ""}`} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setMenuOpen(true); }}>
      {folder.shared ? <PeopleOutlined /> : <Folder />}
      <div><strong>{folder.name}</strong>{folder.shared && <small>Compartilhado</small>}</div>
      <div className="folder-menu-anchor" ref={menuRef}>
        <button className="file-options" type="button" aria-label={`Opções de ${folder.name}`} aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); }}><MoreVert /></button>
        {menuOpen && <div className="folder-options-menu" role="menu" onClick={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDownload(folder.path); }}><DownloadOutlined />Baixar (.zip)</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onCopy({ ...folder, isDir: true }); }}><ContentCopyOutlined />Copiar</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onCut({ ...folder, isDir: true }); }}><ContentCutOutlined />Recortar</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(folder.path, folder.name, true); }}><DeleteOutlineOutlined />Deletar</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onShare({ ...folder, isDir: true }); }}><IosShareOutlined />Compartilhar</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRename(folder.path, folder.name); }}><EditOutlined />Renomear</button>
        </div>}
      </div>
    </article>
  );
}

function LoginPanel({ error, busy, onSubmit }) {
  return (
    <main className="filebrowser-login-wrap">
      <form className="filebrowser-login" onSubmit={onSubmit}>
        <h1>Conectar ao File Browser</h1>
        <p>Entre com seu usuário e senha do File Browser.</p>
        <label>Usuário<input name="username" autoComplete="username" required /></label>
        <label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className="api-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Conectando…" : "Entrar"}</button>
      </form>
    </main>
  );
}

export default function Dashboard({ onLogout }) {
  const [filesView, setFilesView] = useState("grid");
  const [activePage, setActivePage] = useState("drive");
  const [trashItems, setTrashItems] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageViewer, setImageViewer] = useState(null);
  const [fileViewer, setFileViewer] = useState(null);
  const [shareResource, setShareResource] = useState(null);
  const [sharedItems, setSharedItems] = useState([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState("");
  const [sharedLinkExpired, setSharedLinkExpired] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState(() => new Set());
  const [marqueeRect, setMarqueeRect] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("/");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [apiError, setApiError] = useState("");
  const [diskUsage, setDiskUsage] = useState(null);
  const [diskUsageError, setDiskUsageError] = useState("");
  const [statisticsUsage, setStatisticsUsage] = useState(null);
  const [statisticsBreakdown, setStatisticsBreakdown] = useState(null);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsProgress, setStatisticsProgress] = useState(null);
  const [statisticsError, setStatisticsError] = useState("");
  const [favorites, setFavorites] = useState(() => getFavorites());
  const [recentFiles, setRecentFiles] = useState(readRecentFiles);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [cutFile, setCutFile] = useState(null);
  const [copiedFile, setCopiedFile] = useState(null);
  const [clipboardBatch, setClipboardBatch] = useState(null);
  const [uploadNotification, setUploadNotification] = useState(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [newContextMenu, setNewContextMenu] = useState(null);
  const currentPathRef = useRef("/");
  const dragDepthRef = useRef(0);
  const contentPanelRef = useRef(null);
  const selectionOriginRef = useRef(null);
  const searchRequestRef = useRef(0);

  useEffect(() => {
    const shared = readSharedLink();
    if (!shared) return;
    if (shared.expiresAt && Number(shared.expiresAt) <= Date.now()) {
      setSharedLinkExpired(true);
      return;
    }
    setFileViewer({
      name: shared.name,
      path: shared.path,
      sharedMode: true,
      passwordHash: shared.passwordHash || "",
    });
  }, []);

  useEffect(() => {
    function updateMarquee(event) {
      const origin = selectionOriginRef.current;
      if (!origin) return;
      event.preventDefault();
      setMarqueeRect({
        left: Math.min(origin.x, event.clientX),
        top: Math.min(origin.y, event.clientY),
        width: Math.abs(event.clientX - origin.x),
        height: Math.abs(event.clientY - origin.y),
      });
    }

    function finishMarquee(event) {
      const origin = selectionOriginRef.current;
      if (!origin) return;
      selectionOriginRef.current = null;
      const left = Math.min(origin.x, event.clientX);
      const top = Math.min(origin.y, event.clientY);
      const right = Math.max(origin.x, event.clientX);
      const bottom = Math.max(origin.y, event.clientY);
      setMarqueeRect(null);
      if (right - left < 4 && bottom - top < 4) {
        setSelectedPaths(new Set());
        return;
      }

      const selected = Array.from(contentPanelRef.current?.querySelectorAll("[data-selectable-file='true']") || [])
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < right && bounds.right > left && bounds.top < bottom && bounds.bottom > top;
        })
        .map((element) => element.dataset.resourcePath);
      setSelectedPaths(new Set(selected));
    }

    window.addEventListener("pointermove", updateMarquee);
    window.addEventListener("pointerup", finishMarquee);
    return () => {
      window.removeEventListener("pointermove", updateMarquee);
      window.removeEventListener("pointerup", finishMarquee);
    };
  }, []);

  // 401 = sessão expirada (volta ao login). 403 e demais são mensagens normais de erro.
  const reportError = useCallback((error, setter = setApiError) => {
    if (error?.status === 401) {
      if (getToken()) setToken(null);
      setLoginRequired(true);
      return;
    }
    setter(error?.message || "Erro inesperado ao falar com o File Browser.");
  }, []);

  const handleSearchQuery = useCallback(async (query) => {
    const term = query.trim();
    const requestId = ++searchRequestRef.current;
    setSearchQuery(term);
    setSearchError("");
    if (term.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const results = await searchResources(term);
      if (requestId !== searchRequestRef.current) return;
      setSearchResults(results.map((item) => ({ ...item, displayModified: modifiedLabel(item) })));
    } catch (error) {
      if (requestId !== searchRequestRef.current) return;
      setSearchResults([]);
      setSearchError(error.message || "Não foi possível pesquisar os arquivos.");
      if (error.status === 401) reportError(error);
    } finally {
      if (requestId === searchRequestRef.current) setSearchLoading(false);
    }
  }, [reportError]);

  function handleSearchSubmit(query) {
    const term = query.trim();
    if (!term) return;
    setSearchQuery(term);
    setActivePage("search");
    setOpenMenu(null);
    handleSearchQuery(term);
  }

  const refreshDiskUsage = useCallback(async () => {
    try {
      const result = await getDiskUsage();
      const used = Number(result?.used);
      const total = Number(result?.total);
      if (!Number.isFinite(used) || used < 0) throw new Error("A API retornou um uso de disco inválido.");
      setDiskUsage({
        used,
        total: Number.isFinite(total) && total > 0 ? total : 0,
        percentage: Number.isFinite(total) && total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0,
      });
      setDiskUsageError("");
    } catch {
      setDiskUsage(null);
      setDiskUsageError("Armazenamento indisponível");
    }
  }, []);

  const refresh = useCallback(async (path = currentPathRef.current) => {
    setLoading(true);
    setApiError("");
    setSelectedPaths(new Set());
    invalidateResourceSearchCache();
    try {
      const result = await listResources(path);
      setItems(result.items || []);
      const loadedPath = result.path || path;
      currentPathRef.current = loadedPath;
      setCurrentPath(loadedPath);
      setLoginRequired(false);
    } catch (error) {
      reportError(error);
    } finally {
      setLoading(false);
    }
  }, [reportError]);

  useEffect(() => { refresh("/"); }, [refresh]);
  useEffect(() => { refreshDiskUsage(); }, [refreshDiskUsage]);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    setTrashError("");
    try {
      const entries = await listTrash();
      const expiration = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const expired = entries.filter((entry) => entry.managed && new Date(entry.trashedAt).getTime() <= expiration);
      if (expired.length) await emptyTrashApi(expired);
      setTrashItems(entries.filter((entry) => !expired.includes(entry)));
    } catch (error) {
      reportError(error, setTrashError);
    } finally {
      setTrashLoading(false);
    }
  }, [reportError]);

  const loadShares = useCallback(async () => {
    setSharedLoading(true);
    setSharedError("");
    try { setSharedItems(await listResourceShares()); }
    catch (error) { reportError(error, setSharedError); }
    finally { setSharedLoading(false); }
  }, [reportError]);

  const loadStatistics = useCallback(async () => {
    setStatisticsLoading(true);
    setStatisticsError("");
    setStatisticsProgress(null);
    try {
      const usage = await getDiskUsage();
      setStatisticsUsage({ used: Number(usage.used) || 0, total: Number(usage.total) || 0 });
      const breakdown = await getStorageBreakdown(setStatisticsProgress);
      setStatisticsBreakdown(breakdown);
    } catch (error) {
      reportError(error, setStatisticsError);
    } finally {
      setStatisticsLoading(false);
    }
  }, [reportError]);

  const orderedItems = useMemo(
    () => [...items].sort((first, second) => Number(second.isDir) - Number(first.isDir)),
    [items]
  );
  const folders = useMemo(() => orderedItems.filter((item) => item.isDir).map((item) => ({
    ...item,
    path: resourcePath(currentPath, item.name, true),
  })), [orderedItems, currentPath]);
  const files = useMemo(() => orderedItems.filter((item) => !item.isDir).map((item) => {
    const path = resourcePath(currentPath, item.name);
    return [
      item.name,
      fileType(item.name),
      fileType(item.name) === "image" ? "landscape" : fileType(item.name) === "zip" ? "zip" : "paper",
      modifiedLabel(item),
      path,
      { ...item, path },
    ];
  }), [orderedItems, currentPath]);
  const favoritePaths = useMemo(() => new Set(favorites.map((item) => item.path)), [favorites]);
  const clipboardFile = clipboardBatch?.items[0] || cutFile || copiedFile;
  const selectedResources = useMemo(() => [
    ...files.filter((file) => selectedPaths.has(file[4])).map((file) => file[5]),
    ...folders.filter((folder) => selectedPaths.has(folder.path)),
  ], [files, folders, selectedPaths]);
  const cutPaths = useMemo(() => new Set(clipboardBatch?.action === "move" ? clipboardBatch.items.map((item) => item.path) : cutFile ? [cutFile.path] : []), [clipboardBatch, cutFile]);

  function handleToggleFavorite(resource, displayModified) {
    setFavorites(toggleFavorite(resource, displayModified));
  }

  function handleOpenResource(resource) {
    const openedAt = new Date().toISOString();
    const recent = {
      ...resource,
      path: resource.path,
      displayModified: `Aberto em ${new Date(openedAt).toLocaleDateString("pt-BR")}`,
      openedAt,
    };
    setRecentFiles((current) => {
      const updated = [recent, ...current.filter((item) => item.path !== resource.path)].slice(0, 100);
      try { window.localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(updated)); } catch { /* armazenamento local indisponível */ }
      return updated;
    });
    if (fileType(resource.name) === "image") {
      const folderImages = files
        .filter((file) => file[1] === "image")
        .map((file) => ({ name: file[0], path: file[4] }));
      let images = folderImages;
      let index = images.findIndex((item) => item.path === resource.path);
      if (index < 0) {
        images = [{ name: resource.name, path: resource.path }];
        index = 0;
      }
      setImageViewer({ images, index });
      setOpenMenu(null);
      return;
    }
    setFileViewer(resource);
    setOpenMenu(null);
  }

  function handleCut(resource) {
    setCutFile(resource);
    setCopiedFile(null);
    setClipboardBatch(null);
    setOpenMenu(null);
  }

  function handleCopy(resource) {
    setCopiedFile(resource);
    setCutFile(null);
    setClipboardBatch(null);
    setOpenMenu(null);
  }

  function handleCutSelection() {
    if (selectedResources.length < 2) return;
    setClipboardBatch({ action: "move", items: selectedResources });
    setCutFile(null);
    setCopiedFile(null);
    setOpenMenu(null);
  }

  function handleCopySelection() {
    if (selectedResources.length < 2) return;
    setClipboardBatch({ action: "copy", items: selectedResources });
    setCutFile(null);
    setCopiedFile(null);
    setOpenMenu(null);
  }

  function handleDownloadSelection() {
    if (selectedResources.length < 2) return;
    runAction(() => downloadResourcesAsZip(selectedResources));
  }

  function handleDeleteSelection() {
    if (selectedResources.length < 2) return;
    const count = selectedResources.length;
    if (!window.confirm(`Mover ${count} itens para a lixeira?`)) return;
    runAction(async () => {
      for (const resource of selectedResources) {
        await moveToTrash(resource.path, resource.name, Boolean(resource.isDir));
        setFavorites(removeFavoritesForPath(resource.path));
      }
      const selectedPathsSet = new Set(selectedResources.map((resource) => resource.path));
      const clipboardItems = clipboardBatch?.items || [cutFile || copiedFile].filter(Boolean);
      if (clipboardItems.some((item) => selectedPathsSet.has(item.path))) {
        setClipboardBatch(null);
        setCutFile(null);
        setCopiedFile(null);
      }
      setSelectedPaths(new Set());
    });
  }

  async function handlePaste() {
    const clipboardItems = clipboardBatch?.items || [cutFile || copiedFile].filter(Boolean);
    if (!clipboardItems.length) return;
    const isCopy = clipboardBatch ? clipboardBatch.action === "copy" : Boolean(copiedFile);
    const transferId = `${Date.now()}-${Math.random()}`;
    const entries = clipboardItems.map((item, index) => ({ name: item.name, status: index === 0 ? "uploading" : "pending" }));
    setBusy(true);
    setApiError("");
    setUploadNotification({
      id: transferId,
      type: "transfer",
      operation: isCopy ? "copy" : "move",
      status: "uploading",
      visible: true,
      expanded: true,
      entries,
    });
    try {
      for (let index = 0; index < clipboardItems.length; index += 1) {
        const item = clipboardItems[index];
        let destination = resourcePath(currentPath, item.name);
        if (isCopy && destination === item.path) {
          const dot = item.name.lastIndexOf(".");
          const stem = dot > 0 ? item.name.slice(0, dot) : item.name;
          const extension = dot > 0 ? item.name.slice(dot) : "";
          destination = resourcePath(currentPath, `${stem} (cópia)${extension}`);
        }
        if (destination !== item.path) {
          await moveResource(item.path, destination, isCopy ? "copy" : "move");
          if (!isCopy) setFavorites(renameFavorite(item.path, destination, item.name));
        }
        setUploadNotification((current) => current?.id === transferId ? {
          ...current,
          entries: current.entries.map((entry, entryIndex) => ({
            ...entry,
            status: entryIndex <= index ? "complete" : entryIndex === index + 1 ? "uploading" : "pending",
          })),
        } : current);
      }
      setCutFile(null);
      setCopiedFile(null);
      setClipboardBatch(null);
      setOpenMenu(null);
      await refresh(currentPath);
      await refreshDiskUsage();
      setUploadNotification((current) => current?.id === transferId ? {
        ...current,
        status: "complete",
        entries: current.entries.map((entry) => ({ ...entry, status: "complete" })),
      } : current);
    } catch (error) {
      reportError(error);
      setUploadNotification((current) => current?.id === transferId ? {
        ...current,
        status: "error",
        entries: current.entries.map((entry) => entry.status === "complete" ? entry : ({ ...entry, status: "error", error: error.message })),
      } : current);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action) {
    setBusy(true);
    setApiError("");
    try {
      await action();
      await refresh(currentPath);
      await refreshDiskUsage();
      setOpenMenu(null);
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  function handleDuplicate(path, name) {
    const slash = path.lastIndexOf("/");
    const parent = path.slice(0, slash);
    const extensionIndex = name.lastIndexOf(".");
    const stem = extensionIndex > 0 ? name.slice(0, extensionIndex) : name;
    const extension = extensionIndex > 0 ? name.slice(extensionIndex) : "";
    const destination = `${parent}/${stem} (cópia)${extension}`;
    runAction(() => moveResource(path, destination, "copy"));
  }

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("username")).trim(), form.get("password"));
      setFavorites(getFavorites());
      await refresh("/");
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setBusy(false);
    }
  }

  function handleCreateFolder() {
    setCreateFolderOpen(true);
  }

  async function confirmCreateFolder(name) {
    if (/[\\/]/.test(name)) throw new Error("O nome da pasta não pode conter barras.");
    setBusy(true);
    setApiError("");
    try {
      await createFolder(currentPath, name);
      setCreateFolderOpen(false);
      await refresh(currentPath);
      await refreshDiskUsage();
    } catch (error) {
      reportError(error);
      throw error;
    } finally {
      setBusy(false);
    }
  }

  function handleUpload(fileList) {
    if (!fileList?.length) return;
    const filesToUpload = Array.from(fileList);
    const uploadId = `${Date.now()}-${Math.random()}`;
    setUploadNotification({
      id: uploadId,
      status: "uploading",
      visible: true,
      expanded: true,
      entries: filesToUpload.map((file) => ({ name: file.webkitRelativePath || file.name, status: "pending" })),
    });
    uploadFiles(currentPath, filesToUpload, (progress) => {
      setUploadNotification((current) => {
        if (!current || current.id !== uploadId) return current;
        const entries = [...current.entries];
        entries[progress.index] = { name: progress.name, status: progress.status, error: progress.error };
        return { ...current, entries };
      });
    }).then(async () => {
      await refresh(currentPath);
      await refreshDiskUsage();
      setUploadNotification((current) => current?.id === uploadId ? { ...current, status: "complete" } : current);
    }).catch((error) => {
      reportError(error);
      setUploadNotification((current) => {
        if (current?.id !== uploadId) return current;
        return {
          ...current,
          status: "error",
          entries: current.entries.map((entry) => entry.status === "uploading" || entry.status === "pending"
            ? { ...entry, status: "error", error: error.message }
            : entry),
        };
      });
    });
  }

  function handleFileDragEnter(event) {
    if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }

  function handleFileDragOver(event) {
    if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  function handleFileDragLeave(event) {
    if (dragDepthRef.current === 0) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  }

  function handleFileDrop(event) {
    if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    handleUpload(event.dataTransfer.files);
  }

  function openRenameDialog(path, name, isDir = false) {
    setRenameTarget({ path, name, isDir });
  }

  function closeUploadNotification() {
    setUploadNotification((current) => {
      if (!current) return null;
      return current.status === "uploading" ? { ...current, visible: false } : null;
    });
  }

  function showUploadNotification() {
    setUploadNotification((current) => current ? { ...current, visible: true, expanded: true } : current);
  }

  async function confirmRename(name) {
    if (/[\\/]/.test(name)) throw new Error("O nome não pode conter barras.");
    setBusy(true);
    setApiError("");
    try {
      await renameResource(renameTarget.path, name);
      const oldPath = renameTarget.path;
      const newPath = `${oldPath.split("/").slice(0, -1).join("/")}/${name}${renameTarget.isDir ? "/" : ""}`;
      setFavorites(renameFavorite(oldPath, newPath, name, renameTarget.isDir));
      if (cutFile?.path === oldPath) setCutFile({ ...cutFile, path: newPath, name });
      setRenameTarget(null);
      setOpenMenu(null);
      await refresh(currentPath);
      await refreshDiskUsage();
    } catch (error) {
      reportError(error);
      throw error;
    } finally {
      setBusy(false);
    }
  }

  function handleDelete(path, name, isDir = false) {
    if (window.confirm("Mover este item para a lixeira?")) runAction(async () => {
      await moveToTrash(path, name, isDir);
      setFavorites(removeFavoritesForPath(path));
      if (cutFile && (cutFile.path === path || (isDir && cutFile.path.startsWith(`${path.replace(/\/$/, "")}/`)))) setCutFile(null);
    });
  }

  function navigate(page) {
    setSelectedPaths(new Set());
    setActivePage(page);
    if (page === "trash") loadTrash();
    else if (page === "shared") loadShares();
    else if (page === "statistics") loadStatistics();
    else if (page === "favorites" || page === "recent" || page === "search") setOpenMenu(null);
    else refresh("/");
  }

  function handleShareDelete(share) {
    runAction(async () => { await deleteResourceShare(share.hash); await loadShares(); });
  }

  function handleDeleteSelectedShares() {
    const selected = sharedItems.filter((share) => selectedPaths.has(share.path || `/${share.name || "Item compartilhado"}`));
    if (!selected.length) return;
    runAction(async () => {
      for (const share of selected) await deleteResourceShare(share.hash);
      setSelectedPaths(new Set());
      await loadShares();
    });
  }

  function handleShareEdit(share) {
    const value = window.prompt("Nova validade do link em dias (0 para não expirar):", String(share.expires || share.expiration || 0));
    if (value === null) return;
    const days = Number(value);
    if (!Number.isFinite(days) || days < 0) { setSharedError("Informe um número de dias válido."); return; }
    runAction(async () => { await updateResourceShare({ ...share, expires: String(days), unit: "days" }); await loadShares(); });
  }

  function handleShareOpen(share) {
    const url = getPublicShareUrl(share);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleContentContextMenu(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".drive-toolbar, article, .file-menu, button, input, a, [role='menu']")) return;
    event.preventDefault();
    setNewContextMenu({ x: event.clientX, y: event.clientY });
  }

  function handleSelectionStart(event) {
    if (event.button !== 0) return;
    if (event.target.closest("article, button, input, a, [role='menu'], .drive-toolbar")) return;
    event.preventDefault();
    selectionOriginRef.current = { x: event.clientX, y: event.clientY };
    setSelectedPaths(new Set());
    setMarqueeRect({ left: event.clientX, top: event.clientY, width: 0, height: 0 });
  }

  async function runTrashAction(action) {
    setBusy(true);
    setTrashError("");
    try {
      await action();
      await loadTrash();
      await refresh(currentPath);
      await refreshDiskUsage();
    } catch (error) {
      reportError(error, setTrashError);
    } finally {
      setBusy(false);
    }
  }

  function handleEmptyTrash() {
    if (trashItems.length && window.confirm(`Excluir permanentemente ${trashItems.length} ${trashItems.length === 1 ? "item" : "itens"} da lixeira?`)) {
      runTrashAction(() => emptyTrashApi(trashItems));
    }
  }

  function handlePermanentDelete(item) {
    if (window.confirm(`Excluir "${item.name}" permanentemente?`)) {
      runTrashAction(() => permanentlyDeleteTrashItem(item));
    }
  }

  function handleRestore(item) {
    runTrashAction(() => restoreFromTrash(item));
  }

  function handleLogout() {
    setToken(null);
    setCutFile(null);
    if (onLogout) {
      onLogout();
      return;
    }
    setLoginRequired(true);
    setItems([]);
  }

  if (loginRequired) return <LoginPanel error={loginError} busy={busy} onSubmit={handleLogin} />;

  const pathSegments = currentPath.split("/").filter(Boolean);
  const breadcrumbPath = (segmentIndex) => `/${pathSegments.slice(0, segmentIndex + 1).join("/")}/`;

  if (activePage === "settings") return <div className="drive-app"><Settings onBack={() => navigate("drive")} /></div>;

  return (
    <div className="drive-app" onDragEnter={handleFileDragEnter} onDragOver={handleFileDragOver} onDragLeave={handleFileDragLeave} onDrop={handleFileDrop}>
      <Header onLogout={handleLogout} onOpenSettings={() => navigate("settings")} uploadNotification={uploadNotification} onOpenUploadNotification={showUploadNotification} onSearch={handleSearchQuery} onSearchSubmit={handleSearchSubmit} onSearchSelect={handleOpenResource} searchResults={searchResults} searchLoading={searchLoading} searchError={searchError} />
      <div className="row-2">
        <Sidebar page={activePage} onNavigate={navigate} onCreateFolder={handleCreateFolder} onUpload={handleUpload} diskUsage={diskUsage} diskUsageError={diskUsageError} contextMenu={newContextMenu} onCloseContextMenu={() => setNewContextMenu(null)} cutFile={clipboardFile} onPaste={handlePaste} />
        <main className="drive-content">
          <div className="content-panel" ref={contentPanelRef} onPointerDown={handleSelectionStart} onContextMenu={handleContentContextMenu}>
            {marqueeRect && <div className="selection-marquee" style={{ left: marqueeRect.left, top: marqueeRect.top, width: marqueeRect.width, height: marqueeRect.height }} />}
            {activePage === "trash" ? (
              <TrashPage items={trashItems} loading={trashLoading} error={trashError} view={filesView} onViewChange={setFilesView} onEmpty={handleEmptyTrash} onRestore={handleRestore} onDelete={handlePermanentDelete} onRetry={loadTrash} />
            ) : activePage === "favorites" ? (
              <Favorites items={favorites} title="Com estrela" favoritePaths={favoritePaths} openMenu={openMenu} view={filesView} onViewChange={setFilesView} onToggleMenu={(id) => setOpenMenu((current) => current === id ? null : id)} onShowMenu={(id) => setOpenMenu(id)} onCloseMenu={() => setOpenMenu(null)} onOpen={handleOpenResource} onDownload={(path) => runAction(() => downloadResource(path))} onRename={openRenameDialog} onDelete={handleDelete} onInfo={(resource) => { setSelectedFile(resource); setOpenMenu(null); }} onShare={(resource) => { setShareResource(resource); setOpenMenu(null); }} onDuplicate={handleDuplicate} onToggleFavorite={handleToggleFavorite} cutPath={cutFile?.path} cutFile={clipboardFile} onCut={handleCut} onPaste={handlePaste} onCopy={handleCopy} selectedPaths={selectedPaths} cutPaths={cutPaths} />
            ) : activePage === "recent" ? (
              <Favorites items={recentFiles} title="Recentes" favoritePaths={favoritePaths} openMenu={openMenu} view={filesView} onViewChange={setFilesView} onToggleMenu={(id) => setOpenMenu((current) => current === id ? null : id)} onShowMenu={(id) => setOpenMenu(id)} onCloseMenu={() => setOpenMenu(null)} onOpen={handleOpenResource} onDownload={(path) => runAction(() => downloadResource(path))} onRename={openRenameDialog} onDelete={handleDelete} onInfo={(resource) => { setSelectedFile(resource); setOpenMenu(null); }} onShare={(resource) => { setShareResource(resource); setOpenMenu(null); }} onDuplicate={handleDuplicate} onToggleFavorite={handleToggleFavorite} cutPath={cutFile?.path} cutFile={clipboardFile} onCut={handleCut} onPaste={handlePaste} onCopy={handleCopy} selectedPaths={selectedPaths} cutPaths={cutPaths} />
            ) : activePage === "search" ? (
              <Favorites items={searchResults} title={`Resultados para “${searchQuery}”`} emptyMessage={searchLoading ? "Pesquisando nos seus arquivos…" : `Nenhum arquivo encontrado para “${searchQuery}”.`} favoritePaths={favoritePaths} openMenu={openMenu} view={filesView} onViewChange={setFilesView} onToggleMenu={(id) => setOpenMenu((current) => current === id ? null : id)} onShowMenu={(id) => setOpenMenu(id)} onCloseMenu={() => setOpenMenu(null)} onOpen={handleOpenResource} onDownload={(path) => runAction(() => downloadResource(path))} onRename={openRenameDialog} onDelete={handleDelete} onInfo={(resource) => { setSelectedFile(resource); setOpenMenu(null); }} onShare={(resource) => { setShareResource(resource); setOpenMenu(null); }} onDuplicate={handleDuplicate} onToggleFavorite={handleToggleFavorite} cutPath={cutFile?.path} cutFile={clipboardFile} onCut={handleCut} onPaste={handlePaste} onCopy={handleCopy} selectedPaths={selectedPaths} cutPaths={cutPaths} />
            ) : activePage === "statistics" ? (
              <Statistics usage={statisticsUsage} breakdown={statisticsBreakdown} loading={statisticsLoading} progress={statisticsProgress} error={statisticsError} onRetry={loadStatistics} />
            ) : activePage === "shared" ? (
              <>
                {selectedPaths.size > 1 && <div className="selection-toolbar" role="toolbar" aria-label="Ações para compartilhamentos selecionados">
                  <button type="button" className="selection-clear" aria-label="Limpar seleção" onClick={() => setSelectedPaths(new Set())}><Close /></button>
                  <span>{selectedPaths.size} itens selecionados</span>
                  <i aria-hidden="true" />
                  <button type="button" onClick={handleDeleteSelectedShares}><DeleteOutlineOutlined /><span>Deletar selecionados</span></button>
                </div>}
                <Shared shares={sharedItems} loading={sharedLoading} error={sharedError} selectedPaths={selectedPaths} onToggleSelected={(path) => setSelectedPaths((current) => { const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next; })} onRetry={loadShares} onEdit={handleShareEdit} onDelete={handleShareDelete} onOpen={handleShareOpen} />
              </>
            ) : (
              <>
            <div className={`drive-toolbar ${selectedPaths.size > 1 ? "with-selection" : ""}`}>
              <nav className="breadcrumbs" aria-label="Caminho da pasta">
                <button type="button" className={pathSegments.length === 0 ? "current" : ""} onClick={() => refresh("/")}>Meu Self Drive</button>
                {pathSegments.map((segment, index) => (
                  <span className="breadcrumb-part" key={breadcrumbPath(index)}>
                    <ChevronRight aria-hidden="true" />
                    {index === pathSegments.length - 1 ? (
                      <span className="current" aria-current="page">{segment}</span>
                    ) : (
                      <button type="button" onClick={() => refresh(breadcrumbPath(index))}>{segment}</button>
                    )}
                  </span>
                ))}
              </nav>
              <div className="view-toggle">
                <button type="button" className={filesView === "list" ? "selected" : ""} onClick={() => setFilesView("list")} aria-label="Visualização em lista" aria-pressed={filesView === "list"}><ViewList /></button>
                <button type="button" className={filesView === "grid" ? "selected" : ""} onClick={() => setFilesView("grid")} aria-label="Visualização em grade" aria-pressed={filesView === "grid"}><GridView /></button>
              </div>
            </div>
            {selectedPaths.size > 1 && <div className="selection-toolbar" role="toolbar" aria-label="Ações para os arquivos selecionados">
              <button type="button" className="selection-clear" aria-label="Limpar seleção" onClick={() => setSelectedPaths(new Set())}><Close /></button>
              <span>{selectedPaths.size} itens selecionados</span>
              <i aria-hidden="true" />
              <button type="button" onClick={handleDownloadSelection}><DownloadOutlined /><span>Baixar</span></button>
              <button type="button" onClick={handleCopySelection}><ContentCopyOutlined /><span>Copiar</span></button>
              <button type="button" onClick={handleCutSelection}><ContentCutOutlined /><span>Recortar</span></button>
              <button type="button" onClick={handleDeleteSelection}><DeleteOutlineOutlined /><span>Excluir</span></button>
            </div>}
            {apiError && <p className="api-error" role="alert">{apiError}<button type="button" onClick={() => refresh()}>Tentar novamente</button></p>}
            {loading ? <p className="empty-state">Carregando…</p> : orderedItems.length === 0 ? <p className="empty-state">Esta pasta está vazia.</p> : (
              <div className="drive-items">
                {folders.length > 0 && <div className="drive-folder-row">{folders.map((folder) => <FolderCard key={folder.name} folder={folder} isSelected={selectedPaths.has(folder.path)} onOpen={() => refresh(folder.path)} onRename={(path, name) => openRenameDialog(path, name, true)} onDelete={handleDelete} onCopy={handleCopy} onCut={handleCut} onShare={(resource) => setShareResource(resource)} onDownload={(path) => runAction(() => downloadResource(path, true))} />)}</div>}
                {files.length > 0 && (filesView === "grid" ? (
                  <div className="files-grid">{files.map((file, index) => <FileCard key={file[4]} file={file} index={index} openMenu={openMenu} onToggleMenu={(id) => setOpenMenu((current) => current === id ? null : id)} onShowMenu={(id) => setOpenMenu(id)} onCloseMenu={() => setOpenMenu(null)} onOpen={handleOpenResource} onDownload={(path) => runAction(() => downloadResource(path))} onRename={openRenameDialog} onDelete={handleDelete} onInfo={(resource) => { setSelectedFile(resource); setOpenMenu(null); }} onShare={(resource) => { setShareResource(resource); setOpenMenu(null); }} onDuplicate={handleDuplicate} isFavorite={favoritePaths.has(file[4])} onToggleFavorite={handleToggleFavorite} isCut={cutPaths.has(file[4])} isSelected={selectedPaths.has(file[4])} cutFile={clipboardFile} onCut={handleCut} onPaste={handlePaste} onCopy={handleCopy} />)}</div>
                ) : <FilesList files={files} openMenu={openMenu} onToggleMenu={(id) => setOpenMenu((current) => current === id ? null : id)} onShowMenu={(id) => setOpenMenu(id)} onCloseMenu={() => setOpenMenu(null)} onOpen={handleOpenResource} onDownload={(path) => runAction(() => downloadResource(path))} onRename={openRenameDialog} onDelete={handleDelete} onInfo={(resource) => { setSelectedFile(resource); setOpenMenu(null); }} onShare={(resource) => { setShareResource(resource); setOpenMenu(null); }} onDuplicate={handleDuplicate} favoritePaths={favoritePaths} selectedPaths={selectedPaths} cutPaths={cutPaths} onToggleFavorite={handleToggleFavorite} cutPath={cutFile?.path} cutFile={clipboardFile} onCut={handleCut} onPaste={handlePaste} onCopy={handleCopy} />)}
              </div>
            )}
              </>
            )}
          </div>
        </main>
      </div>
      {busy && <div className="operation-status" role="status">Sincronizando com o File Browser…</div>}
      <UploadNotification notification={uploadNotification} onToggle={() => setUploadNotification((current) => current ? { ...current, expanded: !current.expanded } : current)} onClose={closeUploadNotification} />
      {selectedFile && <FileInfoDialog resource={selectedFile} onClose={() => setSelectedFile(null)} onDownload={(path) => runAction(() => downloadResource(path))} />}
      <ShareDialog resource={shareResource} onClose={() => setShareResource(null)} />
      {imageViewer && <ImageViewer images={imageViewer.images} index={imageViewer.index} onNavigate={(index) => setImageViewer((current) => current ? { ...current, index } : current)} onClose={() => setImageViewer(null)} onDownload={(path) => runAction(() => downloadResource(path))} />}
      {fileViewer && <FileViewer key={fileViewer.path} resource={fileViewer} sharedMode={fileViewer.sharedMode} passwordHash={fileViewer.passwordHash} onClose={() => { setFileViewer(null); if (fileViewer.sharedMode) window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`); }} onDownload={(path) => runAction(() => downloadResource(path))} />}
      {sharedLinkExpired && <div className="shared-link-expired" role="alert"><section><h1>Este link expirou</h1><p>Peça ao proprietário um novo link de compartilhamento.</p></section></div>}
      {renameTarget && <RenameDialog itemName={renameTarget.name} onCancel={() => setRenameTarget(null)} onConfirm={confirmRename} />}
      {createFolderOpen && <RenameDialog title="Nova pasta" onCancel={() => setCreateFolderOpen(false)} onConfirm={confirmCreateFolder} />}
      {isDraggingFiles && <div className="file-drop-overlay" aria-live="polite"><div className="file-drop-frame" /><div className="file-drop-prompt"><CloudUploadOutlined /><span>Solte os arquivos para fazer upload</span></div></div>}
    </div>
  );
}
