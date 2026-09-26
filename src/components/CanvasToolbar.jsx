import React from 'react';
import { FilePlus, FolderOpen, Export, ListChecks, Play, Spinner } from '@phosphor-icons/react';

// Icon button with an instant tooltip (name + hint) below it on hover or keyboard focus.
function ToolButton({ label, hint, icon, onClick, disabled, busy, tone = 'text-muted-foreground hover:bg-muted hover:text-foreground' }) {
  const Icon = busy ? Spinner : icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      aria-label={label}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
    >
      <Icon size={20} className={busy ? 'animate-spin' : undefined} aria-hidden />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-left text-xs text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <span className="block font-medium">{label}</span>
        <span className="block text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

// Floating "island" over the canvas for workflow actions (Excalidraw-style).
export default function CanvasToolbar({ running, mode, onNew, onOpen, onExport, onDryRun, onRun }) {
  return (
    <div
      role="toolbar"
      aria-label="Workflow"
      className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-lg"
    >
      <ToolButton label="New" hint="Clear the canvas" icon={FilePlus} onClick={onNew} disabled={running} />
      <ToolButton label="Open" hint="Load a workflow from a JSON file" icon={FolderOpen} onClick={onOpen} disabled={running} />
      <ToolButton label="Export" hint="Save the workflow as a JSON file" icon={Export} onClick={onExport} disabled={running} />
      <div className="mx-1 h-6 w-px bg-border" aria-hidden />
      <ToolButton
        label="Dry run"
        hint="Validate SQL and lineage without loading data"
        icon={ListChecks}
        onClick={onDryRun}
        disabled={running}
        busy={running && mode === 'dryRun'}
      />
      <ToolButton
        label="Run workflow"
        hint="Run the workflow and write outputs"
        icon={Play}
        onClick={onRun}
        disabled={running}
        busy={running && mode === 'run'}
        tone="text-accent hover:bg-accent/15"
      />
    </div>
  );
}
