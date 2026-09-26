import React from 'react';
import { Play, Spinner, CheckCircle, SidebarSimple, WarningCircle } from '@phosphor-icons/react';

const STATUS_ICON = {
  idle: Play,
  running: Spinner,
  success: CheckCircle,
  error: WarningCircle,
};

const STATUS_LABEL = {
  idle: 'Run Workflow',
  running: 'Running…',
  success: 'Done',
  error: 'Failed — Retry',
};

export default function TopBar({ status, onRunAll, sidebarOpen, onToggleSidebar }) {
  const StatusIcon = STATUS_ICON[status];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-3">
      <div className="flex items-center gap-2">
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

      <button
        type="button"
        onClick={onRunAll}
        disabled={status === 'running'}
        className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <StatusIcon size={16} weight={status === 'success' ? 'fill' : 'regular'} className={status === 'running' ? 'animate-spin' : undefined} />
        {STATUS_LABEL[status]}
      </button>
    </header>
  );
}
