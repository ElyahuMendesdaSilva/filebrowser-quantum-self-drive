import { useEffect, useState } from "react";
import { Close, DownloadOutlined, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "@mui/icons-material";
import { fetchResourcePreview } from "../../api/fileBrowser";
import "../../css/image-viewer.css";

export default function ImageViewer({ images, index, onClose, onNavigate, onDownload }) {
  const image = images[index];
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    setSrc("");
    setError("");
    setZoom(1);
    fetchResourcePreview(image.path)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError?.message || "Não foi possível carregar esta imagem.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.path]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (images.length > 1 && event.key === "ArrowLeft") onNavigate((index - 1 + images.length) % images.length);
      if (images.length > 1 && event.key === "ArrowRight") onNavigate((index + 1) % images.length);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [images.length, index, onClose, onNavigate]);

  return (
    <div className="image-viewer" role="dialog" aria-modal="true" aria-label={`Visualizador de imagem: ${image.name}`} onClick={onClose}>
      <header className="image-viewer-header" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="image-viewer-close" onClick={onClose} aria-label="Fechar visualizador"><Close /></button>
        <div className="image-viewer-title"><strong>{image.name}</strong><span>Imagem{images.length > 1 ? ` · ${index + 1} de ${images.length}` : ""}</span></div>
        <div className="image-viewer-tools">
          <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))}><ZoomOut /></button>
          <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((value) => Math.min(3, value + 0.25))}><ZoomIn /></button>
          <button type="button" aria-label="Baixar imagem" onClick={() => onDownload(image.path)}><DownloadOutlined /></button>
        </div>
      </header>
      {images.length > 1 && <button type="button" className="image-viewer-arrow previous" aria-label="Imagem anterior" onClick={(event) => { event.stopPropagation(); onNavigate((index - 1 + images.length) % images.length); }}><ChevronLeft /></button>}
      <div className="image-viewer-stage" onClick={(event) => event.stopPropagation()}>
        {error ? <p className="image-viewer-error" role="alert">{error}</p> : src ? <img src={src} alt={image.name} style={{ transform: `scale(${zoom})` }} /> : <span className="image-viewer-loading" aria-label="Carregando imagem" />}
      </div>
      {images.length > 1 && <button type="button" className="image-viewer-arrow next" aria-label="Próxima imagem" onClick={(event) => { event.stopPropagation(); onNavigate((index + 1) % images.length); }}><ChevronRight /></button>}
    </div>
  );
}
