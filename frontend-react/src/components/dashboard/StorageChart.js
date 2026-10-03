import { useMemo } from "react";

const COLORS = [
  "#8ab4f8",
  "#81c995",
  "#fdd663",
  "#f28b82",
  "#c58af9",
  "#78d9ec",
  "#ffb86c",
  "#bdc1c6",
];

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024 ** 3)
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value / 1024 ** 2)} MB`;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value / 1024 ** 3)} GB`;
}

export default function StorageChart({ used, total, types }) {
  const free = Math.max(0, total - used);
  const colors = useMemo(
    () => types.map((_, index) => COLORS[index % COLORS.length]),
    [types],
  );
  const occupied = types.reduce((sum, type) => sum + type.size, 0);
  let currentPercent = 0;
  const slices = types
    .filter((type) => type.size > 0 && occupied > 0)
    .map((type, index) => {
      const start = currentPercent;
      currentPercent += (type.size / occupied) * 100;
      return `${colors[index]} ${start}% ${currentPercent}%`;
    });
  const chartStyle = slices.length
    ? { background: `conic-gradient(${slices.join(", ")})` }
    : undefined;

  return (
    <section
      className="stats-card stats-breakdown"
      aria-labelledby="file-types-title"
    >
      <div className="stats-card-heading">
        <div>
          <h2 id="file-types-title">Uso por tipo de arquivo</h2>
          <p>Espaço ocupado pelos arquivos encontrados</p>
        </div>
      </div>
      {types.length === 0 ? (
        <p className="stats-empty">Nenhum arquivo foi encontrado.</p>
      ) : (
        <div className="stats-chart-layout">
          <div
            className="stats-donut"
            style={chartStyle}
            role="img"
            aria-label={`Arquivos ocupam ${formatBytes(occupied)}`}
          >
            <div className="stats-donut-center">
              <strong>{formatBytes(occupied)}</strong>
              <span>ocupados</span>
            </div>
          </div>
          <ul className="stats-legend">
            {types.map((type, index) => (
              <li key={type.name}>
                <span
                  className="stats-legend-dot"
                  style={{ backgroundColor: colors[index] }}
                />
                <span className="stats-legend-name">{type.name}</span>
                <strong>{formatBytes(type.size)}</strong>
                <small>
                  {type.count} {type.count === 1 ? "arquivo" : "arquivos"}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="stats-capacity-footnote">
        Capacidade disponível: {formatBytes(free)} livres de{" "}
        {formatBytes(total)}.
      </div>
    </section>
  );
}
