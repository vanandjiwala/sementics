import React from 'react';
import { DownloadSimple, Rows, X } from '@phosphor-icons/react';

const buttonClass =
  'flex items-center gap-1 rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50';

export default function DataPreview({ preview, capped, busy, onShowAll, onDownload, onClose }) {
  const { name, columns, rows, limit } = preview;
  const label = capped
    ? `first ${rows.length.toLocaleString()} rows (capped)`
    : rows.length < limit
      ? `${rows.length.toLocaleString()} rows`
      : `first ${rows.length.toLocaleString()} rows`;

  return (
    <section className="flex h-64 shrink-0 flex-col border-t border-border bg-card font-mono text-xs">
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{name}</span>
          <span className="text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          {rows.length === limit && !capped && (
            <button type="button" onClick={onShowAll} disabled={busy} className={buttonClass}>
              <Rows size={14} /> Show all
            </button>
          )}
          <button type="button" onClick={onDownload} disabled={busy} className={buttonClass}>
            <DownloadSimple size={14} /> Download CSV
          </button>
          <button type="button" onClick={onClose} className={buttonClass} aria-label="Close preview">
            <X size={14} />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse whitespace-nowrap">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {columns.map((c, i) => (
                <th key={i} className="border-b border-r border-border px-2 py-1 text-left font-semibold text-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="hover:bg-muted/50">
                {row.map((v, i) => (
                  <td key={i} className="border-b border-r border-border px-2 py-0.5">
                    {v === null || v === undefined ? (
                      <span className="text-muted-foreground">NULL</span>
                    ) : v instanceof Date ? (
                      v.toISOString()
                    ) : typeof v === 'object' && !(v instanceof Uint8Array) ? (
                      JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))
                    ) : (
                      String(v)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-3 text-muted-foreground">No rows</p>}
      </div>
    </section>
  );
}
