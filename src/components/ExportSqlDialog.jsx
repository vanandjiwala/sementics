import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, FloppyDisk, WarningCircle, X } from '@phosphor-icons/react';
import { DIALECTS, buildScript } from '../lib/sqlExport';

const buttonClass =
  'flex items-center gap-1 rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50';

// Modal that translates the workflow into a SQL script for the chosen dialect.
export default function ExportSqlDialog({ nodes, edges, schemas, onFocusNode, onSaved, onClose }) {
  const dialogRef = useRef(null);
  const [dialectId, setDialectId] = useState(DIALECTS[0].id);
  const [script, setScript] = useState(null); // { sql, warnings } or { error }
  const [copied, setCopied] = useState(false);
  const nameOf = (id) => nodes.find((n) => n.id === id)?.data.name;

  useEffect(() => {
    dialogRef.current.showModal();
  }, []);

  useEffect(() => {
    let stale = false;
    const { label, load } = DIALECTS.find((d) => d.id === dialectId);
    setScript(null);
    load()
      .then((Dialect) => buildScript(nodes, edges, schemas, Dialect, label))
      .catch((err) => ({ error: err.message }))
      .then((result) => !stale && setScript(result));
    return () => {
      stale = true;
    };
  }, [dialectId, nodes, edges, schemas]);

  const copy = async () => {
    await navigator.clipboard.writeText(script.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const save = async () => {
    let result;
    try {
      result = await window.sementics.saveScript(script.sql);
    } catch (err) {
      result = { ok: false, message: err.message };
    }
    if (!result.canceled) onSaved(result);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="export-sql-title"
      className="m-auto h-[80vh] open:flex w-[min(56rem,90vw)] flex-col rounded-xl border border-border bg-card p-0 text-foreground shadow-lg backdrop:bg-background/70"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h2 id="export-sql-title" className="font-mono text-sm font-semibold">Export SQL</h2>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Dialect
            <select
              value={dialectId}
              onChange={(e) => setDialectId(e.target.value)}
              className="rounded border border-border bg-muted px-2 py-1 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {DIALECTS.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-1 font-mono text-xs">
          <button type="button" onClick={copy} disabled={!script?.sql} className={buttonClass}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={save} disabled={!script?.sql} className={buttonClass}>
            <FloppyDisk size={14} /> Save .sql…
          </button>
          <button type="button" onClick={() => dialogRef.current.close()} className={buttonClass} aria-label="Close">
            <X size={14} />
          </button>
        </div>
      </header>

      {script?.warnings?.length > 0 && (
        <ul className="border-b border-border px-4 py-2 font-mono text-xs text-destructive">
          {script.warnings.map((w) => (
            <li key={w.nodeId} className="flex items-start gap-1.5">
              <WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
              <span className="min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    dialogRef.current.close();
                    onFocusNode(w.nodeId);
                  }}
                  className="font-semibold underline underline-offset-2"
                >
                  {nameOf(w.nodeId)}
                </button>{' '}
                kept as DuckDB SQL: {w.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      {script?.error ? (
        <p role="alert" className="p-4 font-mono text-xs text-destructive">{script.error}</p>
      ) : (
        <textarea
          readOnly
          value={script?.sql ?? 'Translating…'}
          aria-label="Generated SQL script"
          spellCheck={false}
          className="min-h-0 flex-1 resize-none bg-background p-4 font-mono text-xs leading-relaxed text-foreground outline-none"
        />
      )}
    </dialog>
  );
}
