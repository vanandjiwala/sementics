import React from 'react';
import { Spinner, CheckCircle, SidebarSimple, WarningCircle } from '@phosphor-icons/react';

function statusOf(running, mode, lastResult) {
  if (running) {
    return { icon: Spinner, spin: true, text: mode === 'dryRun' ? 'Validating…' : 'Running…', tone: 'text-muted-foreground' };
  }
  if (!lastResult) return null;
  const { mode: m, ok, count, name, message } = lastResult;
  if (m === 'export' || m === 'open') {
    return ok
      ? { icon: CheckCircle, text: `${m === 'export' ? 'Saved' : 'Opened'} ${name}`, tone: 'text-accent' }
      : { icon: WarningCircle, text: `${m === 'export' ? 'Export' : 'Open'} failed: ${message}`, tone: 'text-destructive' };
  }
  if (ok) {
    const text = `${m === 'dryRun' ? 'Dry run passed' : 'Run complete'} · ${count} node${count === 1 ? '' : 's'}`;
    return { icon: CheckCircle, text, tone: 'text-accent' };
  }
  const what = m === 'dryRun' ? 'Dry run' : 'Run';
  return { icon: WarningCircle, text: name ? `${what} failed at ${name}` : `${what} failed`, tone: 'text-destructive' };
}

// Persistent status indicator, separate from the canvas toolbar actions; announced politely to screen readers.
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

export default function TopBar({ running, mode, lastResult, onFocusNode, sidebarOpen, onToggleSidebar }) {
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
      </div>
    </header>
  );
}
