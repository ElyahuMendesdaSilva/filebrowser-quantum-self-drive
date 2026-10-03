import { useMemo } from "react";
import {
  AssessmentOutlined,
  InsertDriveFileOutlined,
  StorageOutlined,
} from "@mui/icons-material";
import StorageChart from "../components/dashboard/StorageChart";

function formatGigabytes(bytes) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Number(bytes) || 0) / 1024 ** 3);
}

const TYPE_GROUPS = [
  {
    name: "Imagens",
    extensions: [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "heic",
      "bmp",
      "tiff",
    ],
  },
  {
    name: "Vídeos",
    extensions: ["mp4", "mov", "avi", "mkv", "webm", "m4v", "mpeg"],
  },
  {
    name: "Áudio",
    extensions: ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"],
  },
  {
    name: "Documentos",
    extensions: [
      "pdf",
      "doc",
      "docx",
      "odt",
      "txt",
      "rtf",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
      "csv",
    ],
  },
  { name: "Compactados", extensions: ["zip", "rar", "7z", "tar", "gz", "bz2"] },
  {
    name: "Código",
    extensions: [
      "js",
      "jsx",
      "ts",
      "tsx",
      "html",
      "css",
      "json",
      "py",
      "go",
      "java",
      "c",
      "cpp",
      "sh",
      "md",
    ],
  },
];

function groupTypes(types) {
  const groups = new Map();
  for (const type of types) {
    const group =
      TYPE_GROUPS.find((candidate) => candidate.extensions.includes(type.name))
        ?.name ||
      (type.name === "Sem extensão" ? "Sem extensão" : "Outros arquivos");
    const current = groups.get(group) || { name: group, size: 0, count: 0 };
    current.size += type.size;
    current.count += type.count;
    groups.set(group, current);
  }
  return [...groups.values()].sort((a, b) => b.size - a.size);
}

export default function Statistics({
  usage,
  breakdown,
  loading,
  progress,
  error,
  onRetry,
}) {
  const groupedTypes = useMemo(
    () => groupTypes(breakdown?.types || []),
    [breakdown],
  );
  const used = usage?.used || 0;
  const total = usage?.total || 0;
  const free = Math.max(0, total - used);
  const percent = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  return (
    <section className="statistics-page" aria-labelledby="statistics-title">
      <header className="statistics-heading">
        <div>
          <h1 id="statistics-title">Estatísticas de armazenamento</h1>
        </div>
        <button
          type="button"
          className="stats-refresh"
          onClick={onRetry}
          disabled={loading}
        >
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      {error && (
        <div className="stats-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      )}
      {loading && (
        <p className="stats-progress" role="status">
          Analisando arquivos… {progress?.filesScanned || 0} arquivos em{" "}
          {progress?.foldersScanned || 0} pastas
        </p>
      )}

      <div className="stats-summary-grid">
        <article className="stats-card stats-capacity-card">
          <div className="stats-summary-icon">
            <StorageOutlined />
          </div>
          <span className="stats-eyebrow">Espaço utilizado</span>
          <div className="total">
            <strong className="stats-big-number">
              {formatGigabytes(used)} GB
            </strong>
            <span className="stats-secondary">
              de {formatGigabytes(total)} GB
            </span>
          </div>
          <div
            className="stats-capacity-meter"
            role="progressbar"
            aria-label="Armazenamento utilizado"
            aria-valuenow={Math.round(percent)}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <i style={{ width: `${percent}%`, marginTop: "10px" }} />
          </div>
          <span className="stats-secondary">
            {percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            utilizado
          </span>
        </article>
        <article className="stats-card stats-free-card">
          <div className="stats-summary-icon">
            <AssessmentOutlined />
          </div>
          <span className="stats-eyebrow">Espaço livre</span>
          <strong className="stats-big-number">
            {formatGigabytes(free)} GB
          </strong>
          <span className="stats-secondary">
            disponível para novos arquivos
          </span>
        </article>
        <article className="stats-card stats-file-count-card">
          <div className="stats-summary-icon">
            <InsertDriveFileOutlined />
          </div>
          <span className="stats-eyebrow">Arquivos analisados</span>
          <strong className="stats-big-number">
            {new Intl.NumberFormat("pt-BR").format(
              breakdown?.filesScanned || 0,
            )}
          </strong>
          <span className="stats-secondary">
            em{" "}
            {new Intl.NumberFormat("pt-BR").format(
              breakdown?.foldersScanned || 0,
            )}{" "}
            pastas
          </span>
        </article>
      </div>

      <StorageChart used={used} total={total} types={groupedTypes} />
      {!loading && !error && groupedTypes.length > 0 && (
        <p className="stats-data-note">
          Os valores por tipo são calculados somando os tamanhos dos arquivos
          acessíveis. O total da unidade vem do FileBrowser Quantum.
        </p>
      )}
    </section>
  );
}
