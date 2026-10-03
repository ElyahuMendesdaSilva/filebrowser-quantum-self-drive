const API_BASE = process.env.NODE_ENV === "development"
? ""
: (process.env.REACT_APP_FILEBROWSER_URL ?? "http://localhost:8080").replace(/\/$/, "");
const TOKEN_KEY = "self-drive-filebrowser-token";
const USERNAME_KEY = "self-drive-filebrowser-username";
const SOURCE_KEY = "self-drive-filebrowser-source";
const TRASH_DIRECTORY = "/.self-drive-trash/";
const TRASH_MANIFEST_KEY = "self-drive-trash-manifest";
const FAVORITES_KEY = "self-drive-favorites";

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USERNAME_KEY);
  }
}

function getSource() {
  return window.localStorage.getItem(SOURCE_KEY);
}

function setSource(source) {
  if (source) window.localStorage.setItem(SOURCE_KEY, source);
  else window.localStorage.removeItem(SOURCE_KEY);
}

function readFavoriteRecords() {
  try {
    const records = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function writeFavoriteRecords(records) {
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(records));
}

export function getFavorites() {
  const source = getSource();
  return readFavoriteRecords().filter((item) => item.source === source);
}

export function toggleFavorite(resource, displayModified) {
  const source = getSource();
  const records = readFavoriteRecords();
  const exists = records.some((item) => item.source === source && item.path === resource.path);
  const updated = exists
  ? records.filter((item) => item.source !== source || item.path !== resource.path)
  : [...records, { ...resource, source, displayModified, isDir: false }];
  writeFavoriteRecords(updated);
  return updated.filter((item) => item.source === source);
}

export function removeFavoritesForPath(path) {
  const source = getSource();
  const updated = readFavoriteRecords().filter((item) => item.source !== source || (item.path !== path && !item.path.startsWith(`${path.replace(/\/$/, "")}/`)));
  writeFavoriteRecords(updated);
  return updated.filter((item) => item.source === source);
}

export function renameFavorite(oldPath, newPath, newName, isDir = false) {
  const source = getSource();
  const oldPrefix = `${oldPath.replace(/\/$/, "")}/`;
  const newPrefix = `${newPath.replace(/\/$/, "")}/`;
  const updated = readFavoriteRecords().map((item) => {
    if (item.source !== source) return item;
    if (item.path === oldPath) return { ...item, path: newPath, name: newName };
    if (isDir && item.path.startsWith(oldPrefix)) return { ...item, path: `${newPrefix}${item.path.slice(oldPrefix.length)}` };
    return item;
  });
  writeFavoriteRecords(updated);
  return updated.filter((item) => item.source === source);
}

function resourceUrl(path, extras = {}) {
  const query = new URLSearchParams({ path: path || "/", source: getSource() || "", ...extras });
  return `/api/resources?${query}`;
}

function errorDetail(text) {
  const raw = (text || "").trim();
  if (!raw) return "";
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === "object") {
      if (data.message) return String(data.message);
      const failed = Array.isArray(data.failed) ? data.failed.find((item) => item && item.message) : null;
      if (failed) return String(failed.message);
    }
  } catch {
    // Corpo não é JSON: usa o texto puro.
  }
  return raw;
}

function apiError(message, status, detail) {
  const error = new Error(message);
  error.status = status;
  if (detail) error.detail = detail;
  return error;
}

async function request(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE}${url}`, { ...options, headers });
  } catch (cause) {
    const where = API_BASE ? ` em ${API_BASE}` : " (porta 8080)";
    const error = new Error(`Não foi possível conectar ao File Browser Quantum${where}. Verifique se ele está em execução.`);
    error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    const detail = errorDetail(await response.text());
    if (response.status === 401) {
      throw apiError("Sua sessão expirou ou as credenciais são inválidas.", 401, detail);
    }
    if (response.status === 403) {
      throw apiError(`Você não tem permissão para esta ação${detail ? ` (${detail})` : ""}.`, 403, detail);
    }
    if (response.status === 409) {
      throw apiError("Já existe um item com esse nome neste local.", 409, detail);
    }
    throw apiError(detail || `Erro do File Browser Quantum (${response.status}).`, response.status, detail);
  }
  return response;
}

// O Quantum responde 202 (em vez de erro) quando falta permissão de download.
function assertDownloadAllowed(response) {
  if (response.status === 202) {
    throw apiError("Você não tem permissão de download neste local.", 403);
  }
  return response;
}

export async function login(username, password, { requireSource = true } = {}) {
  const query = new URLSearchParams({ username });
  let response;
  try {
    // O Quantum exige a senha URL-encoded no header X-Password (suporta ^, %, é, € etc.).
    response = await request(`/api/auth/login?${query}`, {
      method: "POST",
      headers: { "X-Password": encodeURIComponent(password) },
    });
  } catch (error) {
    if (error.status === 401) throw apiError("Usuário ou senha inválidos.", 401);
    if (error.status === 429) throw apiError("Muitas tentativas de login. Aguarde um pouco e tente novamente.", 429);
    throw error;
  }
  const token = (await response.text()).trim().replace(/^"|"$/g, "");
  if (!token) throw new Error("O File Browser Quantum não retornou um token de sessão.");
  window.localStorage.setItem(USERNAME_KEY, username);
  setToken(token);
  try {
    const sources = await getSources();
    const savedSource = getSource();
    const source = savedSource && sources[savedSource] ? savedSource : Object.keys(sources)[0];
    if (!source) throw new Error("Nenhuma origem de arquivos está disponível para este usuário.");
    setSource(source);
  } catch (error) {
    // Quem só abre links compartilhados pode não ter origem própria de arquivos.
    if (requireSource) {
      setToken(null);
      throw error;
    }
  }
}

async function getSources() {
  const response = await request("/api/settings/sources");
  const result = await response.json();
  return result && typeof result === "object" ? result : {};
}

export async function getQuantumSettings(property) {
  const query = property ? `?${new URLSearchParams({ property })}` : "";
  const response = await request(`/api/settings${query}`);
  return response.json();
}

export async function getCurrentUser() {
  let response;
  const username = window.localStorage.getItem(USERNAME_KEY);
  if (username) {
    response = await request(`/api/users?${new URLSearchParams({ username })}`);
  } else {
    try {
      response = await request("/api/users?username=self");
    } catch (error) {
      if (![400, 404, 405].includes(error.status)) throw error;
      response = await request("/api/users/self");
    }
  }
  const value = await response.json();
  const user = Array.isArray(value) ? value[0] || null : (value?.user || value?.data || value);
  if (!username && user?.username) window.localStorage.setItem(USERNAME_KEY, user.username);
  return user;
}

export async function updateCurrentUser(username, changes) {
  const target = encodeURIComponent(username || "self");
  const response = await request(`/api/users/${target}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function getUserAvatar(username, avatarUrl = "") {
  const query = new URLSearchParams({ username });
  const url = avatarUrl.startsWith("/api/users/avatar")
  ? avatarUrl
  : `/api/users/avatar?${query}`;
  const response = await request(url);
  return URL.createObjectURL(await response.blob());
}

export async function uploadUserAvatar(username, file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("Escolha uma imagem JPEG, PNG ou WebP.");
  }
  if (file.size > 2 * 1024 * 1024 - 8192) {
    throw new Error("A imagem deve ter menos de 2 MiB.");
  }
  const form = new FormData();
  form.append("avatar", file);
  const query = new URLSearchParams({ username });
  const response = await request(`/api/users/avatar?${query}`, {
    method: "PUT",
    body: form,
  });
  return response.json();
}

export async function deleteUserAvatar(username) {
  const query = new URLSearchParams({ username });
  await request(`/api/users/avatar?${query}`, { method: "DELETE" });
}

async function ensureSource() {
  if (getSource()) return getSource();
  const sources = await getSources();
  const source = Object.keys(sources)[0];
  if (!source) throw new Error("Nenhuma origem de arquivos está disponível para este usuário.");
  setSource(source);
  return source;
}

export async function listResources(path = "/") {
  await ensureSource();
  const response = await request(resourceUrl(path));
  const result = await response.json();
  const items = Array.isArray(result)
  ? result
  : [...(result.folders || []).map((item) => ({ ...item, isDir: true })), ...(result.files || []).map((item) => ({ ...item, isDir: false })), ...(result.items || [])];
  const trashName = TRASH_DIRECTORY.replace(/\//g, "");
  const insideTrash = path.replace(/^\/+/, "").startsWith(trashName);
  const visible = insideTrash ? items : items.filter((item) => !(item.isDir && item.name === trashName));
  return { ...result, path, items: visible };
}

let resourceSearchCache = null;
let resourceSearchCacheAt = 0;
let resourceSearchIndexPromise = null;

export function invalidateResourceSearchCache() {
  resourceSearchCache = null;
  resourceSearchCacheAt = 0;
}

async function getResourceSearchIndex() {
  if (resourceSearchCache && Date.now() - resourceSearchCacheAt < 60_000) return resourceSearchCache;
  if (resourceSearchIndexPromise) return resourceSearchIndexPromise;

  resourceSearchIndexPromise = (async () => {
    const queue = ["/"];
    const resources = [];
    while (queue.length) {
      const paths = queue.splice(0, 4);
      const results = await Promise.all(paths.map(async (path) => {
        try {
          return { path, result: await listResources(path) };
        } catch (error) {
          if (path === "/") throw error;
          return { path, result: null };
        }
      }));
      for (const { path, result } of results) {
        if (!result) continue;
        for (const item of result.items) {
          const itemPath = `${path.replace(/\/$/, "")}/${item.name}${item.isDir ? "/" : ""}`;
          const resource = { ...item, path: itemPath };
          resources.push(resource);
          if (item.isDir) queue.push(itemPath);
        }
      }
    }
    resourceSearchCache = resources;
    resourceSearchCacheAt = Date.now();
    return resources;
  })();

  try {
    return await resourceSearchIndexPromise;
  } finally {
    resourceSearchIndexPromise = null;
  }
}

export async function searchResources(query) {
  const term = String(query || "").trim().toLocaleLowerCase();
  if (!term) return [];
  const resources = await getResourceSearchIndex();
  return resources
  .filter((item) => !item.isDir && item.name?.toLocaleLowerCase().includes(term))
  .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
}

export async function getDiskUsage() {
  await ensureSource();
  const sources = await getSources();
  const usage = sources[getSource()] || {};
  return { used: usage.usedAlt ?? usage.used ?? 0, total: usage.total ?? 0 };
}

// Soma os tamanhos dos arquivos acessíveis, percorrendo a árvore da origem atual.
export async function getStorageBreakdown(onProgress) {
  await ensureSource();
  const queue = ["/"];
  let cursor = 0;
  let filesScanned = 0;
  let foldersScanned = 0;
  const types = new Map();

  async function worker() {
    while (cursor < queue.length) {
      const path = queue[cursor++];
      const result = await listResources(path);
      foldersScanned += 1;
      for (const item of result.items) {
        if (item.isDir) {
          queue.push(`${path.replace(/\/$/, "")}/${item.name}/`);
          continue;
        }
        const size = Number(item.size) || 0;
        const extension = item.name?.includes(".") ? item.name.split(".").pop().toLowerCase() : "";
        const key = extension || "Sem extensão";
        const current = types.get(key) || { name: key, size: 0, count: 0 };
        current.size += Math.max(0, size);
        current.count += 1;
        types.set(key, current);
        filesScanned += 1;
      }
      onProgress?.({ filesScanned, foldersScanned, pendingFolders: queue.length - cursor });
    }
  }

  await Promise.all(Array.from({ length: 4 }, () => worker()));
  return {
    types: [...types.values()].sort((a, b) => b.size - a.size),
    filesScanned,
    foldersScanned,
  };
}

export async function createFolder(parentPath, name) {
  await request(resourceUrl(`${parentPath.replace(/\/$/, "")}/${name}/`, { isDir: "true" }), { method: "POST" });
}

export async function uploadFiles(parentPath, files, onProgress) {
  const failures = [];
  for (const [index, file] of files.entries()) {
    const relativePath = file.webkitRelativePath || file.name;
    const parts = relativePath.split("/").filter(Boolean);
    onProgress?.({ index, total: files.length, name: relativePath, status: "uploading", completed: index });
    try {
      let destination = parentPath;
      for (const directory of parts.slice(0, -1)) {
        destination = `${destination.replace(/\/$/, "")}/${directory}/`;
        try {
          await request(resourceUrl(destination, { isDir: "true" }), { method: "POST" });
        } catch (error) {
          if (error.status !== 409) throw error;
        }
      }
      const path = `${destination.replace(/\/$/, "")}/${parts[parts.length - 1]}`;
      await request(resourceUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      onProgress?.({ index, total: files.length, name: relativePath, status: "complete", completed: index + 1 });
    } catch (error) {
      if (error.status === 401) throw error;
      failures.push(`${relativePath}: ${error.message}`);
      onProgress?.({ index, total: files.length, name: relativePath, status: "error", completed: index + 1, error: error.message });
    }
  }
  if (failures.length) {
    throw new Error(`Não foi possível enviar ${failures.length} de ${files.length} arquivo(s). ${failures.join(" | ")}`);
  }
}

function fileUrl(path) {
  const query = new URLSearchParams({ source: getSource() || "", file: path });
  return `/api/resources/download?${query}`;
}

export function downloadResource(path, isDir = false) {
  return request(fileUrl(path)).then(async (response) => {
    assertDownloadAllowed(response);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    const name = path.split("/").filter(Boolean).pop() || "download";
    link.download = isDir && !name.toLowerCase().endsWith(".zip") ? `${name}.zip` : name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipHeader(size, nameLength, checksum, offset = 0, central = false) {
  const header = new Uint8Array(central ? 46 : 30);
  const view = new DataView(header.buffer);
  if (central) {
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint32(16, checksum, true);
    view.setUint32(20, size, true);
    view.setUint32(24, size, true);
    view.setUint16(28, nameLength, true);
    view.setUint32(42, offset, true);
  } else {
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameLength, true);
  }
  return header;
}

export async function downloadResourcesAsZip(resources, filename = "arquivos-selecionados.zip") {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const resource of resources) {
    const response = assertDownloadAllowed(await request(fileUrl(resource.path)));
    const data = new Uint8Array(await response.arrayBuffer());
    const rawName = resource.name || resource.path.split("/").filter(Boolean).pop() || "arquivo";
    const entryName = resource.isDir && !rawName.toLowerCase().endsWith(".zip") ? `${rawName}.zip` : rawName;
    const name = encoder.encode(entryName);
    const checksum = crc32(data);
    const local = zipHeader(data.length, name.length, checksum);
    localParts.push(local, name, data);
    const central = zipHeader(data.length, name.length, checksum, offset, true);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, resources.length, true);
  endView.setUint16(10, resources.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  const blob = new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}

export async function fetchResourcePreview(path) {
  const query = new URLSearchParams({ source: getSource() || "", path, size: "original" });
  const response = assertDownloadAllowed(await request(`/api/resources/preview?${query}`));
  return response.blob();
}

export async function fetchResourceContent(path) {
  const response = assertDownloadAllowed(await request(fileUrl(path)));
  return response.blob();
}

export async function getPublicShareResource(hash) {
  const query = new URLSearchParams({ hash, path: "/" });
  const response = await request(`/public/api/resources?${query}`);
  return response.json();
}

export async function fetchPublicShareContent(hash, path, viewToken, media = false) {
  const query = new URLSearchParams({ hash, file: path || "/", viewToken });
  const endpoint = media ? "/public/api/media/stream" : "/public/api/resources/view";
  const response = assertDownloadAllowed(await request(`${endpoint}?${query}`));
  return response.blob();
}

// Baixa via fetch para enviar o token de login: links restritos a pessoas específicas
// recusam o download direto por <a href>, porque o navegador não envia o header Authorization.
export async function downloadPublicShareResource(hash, path, filename = "arquivo") {
  const query = new URLSearchParams({ hash, file: path || "/" });
  const response = assertDownloadAllowed(await request(`/public/api/resources/download?${query}`));
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || path?.split("/").filter(Boolean).pop() || "arquivo";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}

export async function createResourceShare(path, { password = "", expires = "0", unit = "days", disableAnonymous = false, allowedUsernames = [] } = {}) {
  const response = await request("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, source: getSource() || "", password, expires, unit, disableAnonymous, allowedUsernames: [...new Set(allowedUsernames)] }),
  });
  return response.json();
}

export async function listResourceShares() {
  const response = await request("/api/share/list");
  const result = await response.json();
  return Array.isArray(result) ? result : (result?.shares || result?.data || []);
}

export async function deleteResourceShare(hash) {
  await request(`/api/share?${new URLSearchParams({ hash })}`, { method: "DELETE" });
}

export async function updateResourceShare(share) {
  const response = await request("/api/share", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(share),
  });
  return response.status === 204 ? share : response.json();
}

// Busca pessoas para o link restrito: GET /api/users?q= devolve só { username, avatarUrl } e exige a permissão "share".
export async function searchShareUsers(query) {
  const term = String(query || "").trim();
  if (!term) return [];
  const response = await request(`/api/users?${new URLSearchParams({ q: term })}`);
  const result = await response.json();
  if (!Array.isArray(result)) return [];
  return result.filter((user) => user?.username).map((user) => ({ username: user.username, avatarUrl: user.avatarUrl || "" }));
}

export function getPublicShareUrl(share) {
  const restrictedToPeople = Boolean(share?.allowedUsernames?.length);
  if (share?.hash && share.singleFileShare && !share.hasPassword && (!share.disableAnonymous || restrictedToPeople) && !share.disableDownload && share.shareType !== "upload") {
    const url = new URL(window.location.href);
    url.hash = `share?hash=${encodeURIComponent(share.hash)}`;
    return url.toString();
  }
  if (share?.shareURL) return share.shareURL;
  const origin = API_BASE || window.location.origin;
  return `${origin}/public/share/${encodeURIComponent(share.hash)}`;
}

export async function deleteResource(path) {
  await request(resourceUrl(path), { method: "DELETE" });
}

export async function moveResource(path, destination, action = "move") {
  await request("/api/resources", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      items: [{ fromSource: getSource(), fromPath: path, toSource: getSource(), toPath: destination }],
                         overwrite: false,
                         rename: false,
    }),
  });
}

function readTrashManifest() {
  try { return JSON.parse(window.localStorage.getItem(TRASH_MANIFEST_KEY) || "[]"); } catch { return []; }
}

function writeTrashManifest(entries) {
  window.localStorage.setItem(TRASH_MANIFEST_KEY, JSON.stringify(entries));
}

async function ensureTrashDirectory() {
  try {
    await listResources(TRASH_DIRECTORY);
  } catch (error) {
    if (error.status !== 404) throw error;
    await createFolder("/", TRASH_DIRECTORY.replace(/^\//, "").replace(/\/$/, ""));
  }
}

export async function listTrash() {
  let result;
  try { result = await listResources(TRASH_DIRECTORY); } catch (error) { if (error.status === 404) return []; throw error; }
  const manifest = readTrashManifest();
  const manifestByPath = new Map(manifest.map((entry) => [entry.trashPath, entry]));
  return result.items.map((item) => {
    const trashPath = `${TRASH_DIRECTORY}${item.name}${item.isDir ? "/" : ""}`;
    const metadata = manifestByPath.get(trashPath);
    return { ...item, ...metadata, name: metadata?.name || item.name, trashPath, trashedAt: metadata?.trashedAt || item.modified, managed: Boolean(metadata) };
  });
}

export async function moveToTrash(path, name, isDir = false) {
  await ensureTrashDirectory();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const trashPath = `${TRASH_DIRECTORY}${id}__${name}${isDir ? "/" : ""}`;
  await moveResource(path, trashPath);
  const manifest = readTrashManifest();
  manifest.push({ name, originalPath: path, trashPath, isDir, trashedAt: new Date().toISOString() });
  writeTrashManifest(manifest);
}

export async function restoreFromTrash(entry) {
  if (!entry.originalPath) throw new Error("O caminho original não está disponível para este item.");
  await moveResource(entry.trashPath, entry.originalPath);
  writeTrashManifest(readTrashManifest().filter((item) => item.trashPath !== entry.trashPath));
}

export async function permanentlyDeleteTrashItem(entry) {
  await deleteResource(entry.trashPath);
  writeTrashManifest(readTrashManifest().filter((item) => item.trashPath !== entry.trashPath));
}

export async function emptyTrash(entries) {
  for (const entry of entries) await deleteResource(entry.trashPath);
  const paths = new Set(entries.map((entry) => entry.trashPath));
  writeTrashManifest(readTrashManifest().filter((item) => !paths.has(item.trashPath)));
}

export async function renameResource(path, newName) {
  const isDir = path.endsWith("/");
  const parent = path.replace(/\/+$/, "").split("/").slice(0, -1).join("/");
  await moveResource(path, `${parent}/${newName}${isDir ? "/" : ""}`, "rename");
}
