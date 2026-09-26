import React from 'react';
import { Play, Spinner, CheckCircle, SidebarSimple, WarningCircle, ListChecks } from '@phosphor-icons/react';

const ACTIONS = {
  dryRun: {
    label: 'Dry Run',
    icon: ListChecks,
    title: 'Validate SQL and lineage without loading data',
    className: 'border border-border text-foreground hover:bg-muted',
  },
  run: {
    label: 'Run Workflow',
    icon: Play,
    title: 'Run the workflow and write outputs',
    className: 'border border-transparent bg-accent text-accent-foreground hover:opacity-90',
  },
};

// Labels never change; only the icon of the button that started the job becomes a spinner.
function ActionButton({ kind, running, busy, onClick }) {
  const { label, icon, title, className } = ACTIONS[kind];
  const Icon = busy ? Spinner : icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={running}
      aria-busy={busy}
      title={title}
      className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <Icon size={16} className={busy ? 'animate-spin' : undefined} aria-hidden />
      {label}
    </button>
  );
}

function statusOf(running, mode, lastResult) {
  if (running) {
    return { icon: Spinner, spin: true, text: mode === 'dryRun' ? 'Validating…' : 'Running…', tone: 'text-muted-foreground' };
  }
  if (!lastResult) return null;
  const { mode: m, ok, count, name } = lastResult;
  if (ok) {
    const text = `${m === 'dryRun' ? 'Dry run passed' : 'Run complete'} · ${count} node${count === 1 ? '' : 's'}`;
    return { icon: CheckCircle, text, tone: 'text-accent' };
  }
  const what = m === 'dryRun' ? 'Dry run' : 'Run';
  return { icon: WarningCircle, text: name ? `${what} failed at ${name}` : `${what} failed`, tone: 'text-destructive' };
}

// Persistent status indicator, separate from the action buttons; announced politely to screen readers.
function StatusPill({ running, mode, lastResult, onFocusNode }) {
  const status = statusOf(running, mode, lastResult);
  const failedNodeId = !running && lastResult && !lastResult.ok ? lastResult.nodeId : null;
  const pillClass = `flex max-w-80 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-xs ${status?.tone ?? ''}`;
  const content = status && (
    <>
      <status.icon
        size={14}
        weight={status.spin ? 'regular' : 'fill'}
        className={`shrink-0 ${status.spin ? 'animate-spin' : ''}`}
        aria-hidden
      />
      <span className="truncate">{status.text}</span>
    </>
  );

  return (
    <div role="status" aria-live="polite" className="flex min-w-0 items-center">
      {status &&
        (failedNodeId ? (
          <button
            type="button"
            onClick={() => onFocusNode(failedNodeId)}
            title={`${status.text} — show node`}
            className={`${pillClass} transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
          >
            {content}
          </button>
        ) : (
          <span title={status.text} className={pillClass}>
            {content}
          </span>
        ))}
    </div>
  );
}

export default function TopBar({ running, mode, lastResult, onRunAll, onDryRun, onFocusNode, sidebarOpen, onToggleSidebar }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3">
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={sidebarOpen ? 'Hide node palette' : 'Show node palette'}
        >
          <SidebarSimple size={18} />
        </button>
        <span className="font-mono text-sm font-semibold">Sementics</span>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <StatusPill running={running} mode={mode} lastResult={lastResult} onFocusNode={onFocusNode} />
        <ActionButton kind="dryRun" running={running} busy={running && mode === 'dryRun'} onClick={onDryRun} />
        <ActionButton kind="run" running={running} busy={running && mode === 'run'} onClick={onRunAll} />
      </div>
    </header>
  );
}
