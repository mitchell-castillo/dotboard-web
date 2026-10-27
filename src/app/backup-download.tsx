import { apiRequest } from "../lib/api-client";
"use client";
import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";

export default function BackupDownload({ compact = false, disabled = false }: { compact?: boolean; disabled?: boolean }) {
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  async function download() {
    if (lock.current || disabled) return;
    lock.current = true; setDownloading(true); setMessage(""); setFailed(false);
    try {
      const response = await apiRequest("/api/workspace/backup", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error ?? "No se pudo descargar el respaldo. Vuelve a intentarlo.");
      }
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("El servidor no respondió con un respaldo JSON.");
      const blob = await response.blob();
      const parsed = JSON.parse(await blob.text()) as { format?: string; formatVersion?: number; workspace?: unknown };
      if (parsed.format !== "dot-board-local-backup" || parsed.formatVersion !== 1 || !parsed.workspace) throw new Error("El respaldo no se pudo verificar. Tus datos no se han modificado.");
      const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "dot-board-backup.json";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename; link.hidden = true;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("Descarga iniciada. Comprueba que el archivo JSON esté en tus descargas.");
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : "No se pudo descargar el respaldo. Vuelve a intentarlo.");
    } finally { lock.current = false; setDownloading(false); }
  }
  return <div className={compact ? "backup-control backup-control-compact" : "backup-control"} lang="es">
    <button type="button" className={compact ? "button secondary backup-download-button" : "button primary"} onClick={() => void download()} disabled={disabled || downloading} aria-busy={downloading}>
      {downloading ? <Loader2 size={17} className="animate-spin" aria-hidden="true"/> : <Download size={17} aria-hidden="true"/>}
      <span>{downloading ? "Preparando…" : "Export backup"}</span>
    </button>
    {message && <p className={failed ? "backup-feedback backup-error" : "backup-feedback"} role={failed ? "alert" : "status"}>{message}</p>}
  </div>;
}
