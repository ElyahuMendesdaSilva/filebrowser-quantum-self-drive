import { ChevronRight } from "@mui/icons-material";

export default function SectionToggle({ label, open, onToggle }) {
  return <button type="button" className="section-toggle" onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Retrair" : "Expandir"} ${label}`}>
    <ChevronRight className={open ? "expanded" : ""} /><h2>{label}</h2>
  </button>;
}
