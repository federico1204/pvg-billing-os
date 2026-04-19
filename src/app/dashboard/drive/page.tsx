"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, CheckCircle, AlertCircle, SkipForward, Download, ExternalLink } from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
}

interface ImportResult {
  fileId: string;
  name: string;
  status: "imported" | "duplicate" | "skipped" | "failed" | "error" | "not_found";
  invoiceRef?: string;
  id?: number;
  reason?: string;
  existingId?: number;
}

const STATUS_ICON = {
  imported: <CheckCircle size={16} className="text-green-400" />,
  duplicate: <SkipForward size={16} className="text-yellow-400" />,
  skipped: <SkipForward size={16} className="text-zinc-500" />,
  failed: <AlertCircle size={16} className="text-red-400" />,
  error: <AlertCircle size={16} className="text-red-400" />,
  not_found: <AlertCircle size={16} className="text-red-400" />,
};

const STATUS_LABEL = {
  imported: "Imported",
  duplicate: "Already exists",
  skipped: "Skipped",
  failed: "Failed",
  error: "Error",
  not_found: "Not found",
};

export default function DriveImportPage() {
  const router = useRouter();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState("");

  async function loadFiles() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/drive/import");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to list Drive files");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setFiles(data);
      setSelected(new Set(data.map((f: DriveFile) => f.id)));
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => { loadFiles(); }, []);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(files.map(f => f.id))); }
  function selectNone() { setSelected(new Set()); }

  async function runImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setResults([]);
    const res = await fetch("/api/drive/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: [...selected] }),
    });
    const data = await res.json();
    setResults(data.results ?? []);
    setImporting(false);
  }

  const importedCount = results.filter(r => r.status === "imported").length;
  const supportedFiles = files.filter(f =>
    f.mimeType === "application/pdf" ||
    f.mimeType.startsWith("application/vnd.google-apps.")
  );

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Download size={20} className="text-green-400" />
          <h1 className="text-2xl font-bold text-white">Import from Google Drive</h1>
        </div>
        <p className="text-zinc-400 text-sm">
          Claude AI reads each PDF and extracts invoice data automatically. Bilingual detection included.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
          <p className="font-medium mb-1">Could not connect to Google Drive</p>
          <p>{error}</p>
          <p className="mt-2 text-xs text-red-400">
            Make sure the Drive folder is shared with:{" "}
            <code className="bg-red-900/40 px-1 rounded">pvg-mission-control@pvg-mission-control.iam.gserviceaccount.com</code>
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-sm font-medium text-white mb-3">
            Import complete — {importedCount} of {results.length} imported
          </p>
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.fileId} className="flex items-center gap-3 text-sm">
                {STATUS_ICON[r.status]}
                <span className="text-zinc-300 flex-1 truncate">{r.name}</span>
                <span className={`text-xs ${r.status === "imported" ? "text-green-400" : r.status === "duplicate" ? "text-yellow-400" : "text-zinc-500"}`}>
                  {STATUS_LABEL[r.status]}
                </span>
                {r.invoiceRef && (
                  <span className="text-xs font-mono text-zinc-400">{r.invoiceRef}</span>
                )}
                {r.id && (
                  <button onClick={() => router.push(`/dashboard/invoices/${r.id}`)} className="text-green-400 hover:text-green-300">
                    <ExternalLink size={12} />
                  </button>
                )}
                {r.reason && <span className="text-xs text-red-400">{r.reason}</span>}
              </div>
            ))}
          </div>
          {importedCount > 0 && (
            <div className="mt-4">
              <Button size="sm" onClick={() => router.push("/dashboard/invoices")}>View all invoices →</Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500">
          <RefreshCw size={16} className="animate-spin mr-2" />
          Connecting to Google Drive...
        </div>
      ) : !error && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-400">
              {supportedFiles.length} file{supportedFiles.length !== 1 ? "s" : ""} found · {selected.size} selected
            </p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-zinc-400 hover:text-white">Select all</button>
              <span className="text-zinc-700">·</span>
              <button onClick={selectNone} className="text-xs text-zinc-400 hover:text-white">None</button>
              <span className="text-zinc-700">·</span>
              <button onClick={loadFiles} className="text-xs text-zinc-400 hover:text-white">Refresh</button>
            </div>
          </div>

          <div className="border border-zinc-800 rounded-xl overflow-hidden mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="w-10 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">File Name</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Type</th>
                  <th className="text-right px-4 py-3 text-zinc-400 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {files.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-12 text-zinc-500">No files found in the Drive folder</td></tr>
                ) : files.map((f) => {
                  const isSupported = f.mimeType === "application/pdf" || f.mimeType.startsWith("application/vnd.google-apps.");
                  const isPDF = f.mimeType === "application/pdf";
                  return (
                    <tr key={f.id} className={`border-b border-zinc-800 ${isSupported ? "hover:bg-zinc-900 cursor-pointer" : "opacity-40"}`}
                      onClick={() => isSupported && toggle(f.id)}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(f.id)}
                          disabled={!isSupported}
                          onChange={() => toggle(f.id)}
                          onClick={e => e.stopPropagation()}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className={isPDF ? "text-red-400" : "text-blue-400"} />
                          <span className="text-white">{f.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">
                        {isPDF ? "PDF" : f.mimeType.includes("spreadsheet") ? "Google Sheet" : f.mimeType.includes("document") ? "Google Doc" : "Other"}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 text-xs">
                        {new Date(f.createdTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button
            onClick={runImport}
            disabled={importing || selected.size === 0}
            className="w-full"
          >
            {importing ? (
              <><RefreshCw size={14} className="animate-spin" />Importing {selected.size} file{selected.size !== 1 ? "s" : ""} with AI...</>
            ) : (
              <><Download size={14} />Import {selected.size} Selected File{selected.size !== 1 ? "s" : ""}</>
            )}
          </Button>
          <p className="text-xs text-zinc-600 text-center mt-2">Claude AI reads each PDF and extracts invoice data. This may take 10–30 seconds.</p>
        </>
      )}
    </div>
  );
}
