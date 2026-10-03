export default function FilePreview({ type }) {
  const title = type === "essay" ? "A Teoria Crítica da Escola de Frankfurt" : type === "summary" ? "Resumo de Português" : "Documento";
  return <div className={`file-preview ${type}`}>
    {type === "portrait" && <div className="portrait-face"><i /><b /></div>}
    {type === "landscape" && <div className="landscape-face" />}
    {type === "certificate" && <><strong>INTERNATIONAL CERTIFICATE</strong><small>OF MASTER CREATIVE</small><em>Self Drive</em></>}
    {type === "zip" && <div className="zip-symbol">⌁</div>}
    {["yoga", "summary", "essay", "paper"].includes(type) && <div className="page-lines"><b>{title}</b><i /><i /><i /><i /><i /></div>}
  </div>;
}
