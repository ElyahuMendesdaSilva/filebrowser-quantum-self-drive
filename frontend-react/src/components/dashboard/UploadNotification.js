import { CheckCircle, Close, ExpandLess, ExpandMore, InsertDriveFileOutlined, ReportProblemOutlined } from "@mui/icons-material";

function titleFor(notification) {
  const total = notification.entries.length;
  if (notification.type === "transfer") {
    const operation = notification.operation === "copy" ? "cópia" : "movimento";
    if (notification.status === "uploading") return `${notification.operation === "copy" ? "Copiando" : "Movendo"} ${total} ${total === 1 ? "item" : "itens"}`;
    if (notification.status === "error") return `Falha ao ${notification.operation === "copy" ? "copiar" : "mover"} ${total === 1 ? "item" : "itens"}`;
    return `${total} ${total === 1 ? "item" : "itens"} ${operation === "cópia" ? "copiados" : "movidos"}`;
  }
  if (notification.status === "uploading") return `Fazendo upload de ${total} ${total === 1 ? "item" : "itens"}`;
  if (notification.status === "error") {
    const failed = notification.entries.filter((entry) => entry.status === "error").length;
    return `${failed} de ${total} ${failed === 1 ? "upload falhou" : "uploads falharam"}`;
  }
  return `${total} ${total === 1 ? "upload concluído" : "uploads concluídos"}`;
}

export default function UploadNotification({ notification, onToggle, onClose }) {
  if (!notification || !notification.visible) return null;
  const completed = notification.entries.filter((entry) => entry.status === "complete" || entry.status === "error").length;
  const percent = notification.entries.length ? (completed / notification.entries.length) * 100 : 0;
  const activeEntry = notification.entries.find((entry) => entry.status === "uploading");

  return (
    <section className="upload-notification" aria-label={notification.type === "transfer" ? "Status da transferência" : "Status do upload"}>
      <header className="upload-notification-header">
        <strong>{titleFor(notification)}</strong>
        <button type="button" aria-label={notification.expanded ? "Recolher detalhes" : "Expandir detalhes"} onClick={onToggle}>
          {notification.expanded ? <ExpandMore /> : <ExpandLess />}
        </button>
        <button type="button" aria-label="Fechar notificação" onClick={onClose}><Close /></button>
      </header>
      {notification.status === "uploading" && <div className="upload-notification-progress"><i style={{ width: `${percent}%` }} /></div>}
      {notification.expanded && (
        <div className="upload-notification-body">
          {notification.status === "uploading" && <div className="upload-notification-status">{activeEntry ? `${notification.type === "transfer" ? (notification.operation === "copy" ? "Copiando" : "Movendo") : "Enviando"} ${activeEntry.name.split("/").filter(Boolean).pop()}…` : "Iniciando upload…"}</div>}
          {notification.entries.map((entry, index) => (
            <div className="upload-notification-file" key={`${entry.name}-${index}`}>
              <InsertDriveFileOutlined className="upload-file-icon" />
              <div className="upload-file-name" title={entry.name}>
                <span>{entry.name.split("/").filter(Boolean).join(" / ")}</span>
                {entry.error && <small>{entry.error}</small>}
              </div>
              {entry.status === "complete" ? <CheckCircle className="upload-file-success" aria-label="Upload concluído" /> : entry.status === "error" ? <ReportProblemOutlined className="upload-file-error" aria-label="Falha no upload" /> : <span className={`upload-file-spinner ${entry.status === "pending" ? "pending" : ""}`} aria-label={entry.status === "pending" ? "Na fila" : "Enviando"} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
