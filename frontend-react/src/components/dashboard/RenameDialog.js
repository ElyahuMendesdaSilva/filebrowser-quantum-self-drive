import { useEffect, useRef, useState } from "react";

export default function RenameDialog({ itemName = "", title = "Renomear", onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [name, setName] = useState(itemName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function submit(event) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || cleanName === itemName) return;
    setSaving(true);
    setError("");
    try {
      await onConfirm(cleanName);
    } catch (requestError) {
      setError(requestError.message || "Não foi possível renomear este item.");
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="rename-dialog"
      aria-labelledby="rename-dialog-title"
      onClick={(event) => { if (event.target === dialogRef.current) onCancel(); }}
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
    >
      <form onSubmit={submit}>
        <h2 id="rename-dialog-title">{title}</h2>
        <input
          ref={inputRef}
          aria-label="Novo nome"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={255}
          autoComplete="off"
          spellCheck="false"
        />
        {error && <p className="rename-error" role="alert">{error}</p>}
        <div className="rename-actions">
          <button type="button" className="rename-cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button type="submit" className="rename-confirm" disabled={saving || !name.trim() || name.trim() === itemName}>
            {saving ? "Salvando…" : "OK"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
