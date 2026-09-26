import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Play, Spinner, CheckCircle, Trash, WarningCircle } from '@phosphor-icons/react';
import { NODE_CATALOG_BY_KIND } from '../data/nodeCatalog';

const STATUS_ICON = {
  idle: Play,
  running: Spinner,
  success: CheckCircle,
  error: WarningCircle,
};

const STATUS_COLOR = { success: 'var(--color-accent)', error: 'var(--color-destructive)' };

function summary({ kind, config = {} }) {
  if (kind === 'sql') return config.query?.trim().split('\n')[0];
  return config.path?.split(/[\\/]/).pop();
}

export default function WorkflowNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow();
  const status = data.status ?? 'idle';
  const catalogEntry = NODE_CATALOG_BY_KIND[data.kind];
  const Icon = catalogEntry.icon;
  const StatusIcon = STATUS_ICON[status];

  return (
    <div
      className={`min-w-48 rounded-lg border border-border bg-card font-mono text-sm shadow-lg ${selected ? 'ring-2 ring-accent' : ''}`}
    >
      {catalogEntry.category !== 'input' && <Handle type="target" position={Position.Left} />}
      <div
        className="flex items-center justify-between gap-2 rounded-t-lg border-b-2 px-3 py-2"
        style={{ borderBottomColor: catalogEntry.accent }}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} weight="regular" color={catalogEntry.accent} />
          <span className="font-medium">{data.label ?? catalogEntry.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => data.onRun?.(id)}
            className="nodrag flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={{ idle: 'Run node', running: 'Running', success: 'Ran successfully — run again', error: 'Failed — run again' }[status]}
          >
            <StatusIcon
              size={14}
              weight={status in STATUS_COLOR ? 'fill' : 'regular'}
              color={STATUS_COLOR[status]}
              className={status === 'running' ? 'animate-spin' : undefined}
            />
          </button>
          <button
            type="button"
            onClick={() => deleteElements({ nodes: [{ id }] })}
            className="nodrag flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            aria-label="Delete node"
          >
            <Trash size={14} />
          </button>
        </div>
      </div>
      <div className="flex max-w-64 flex-col gap-1 px-3 py-2 text-xs">
        <span className="text-foreground">{data.name}</span>
        <span className="truncate text-muted-foreground">{summary(data) || catalogEntry.description}</span>
        {data.error && <span className="whitespace-pre-wrap break-words text-destructive">{data.error}</span>}
      </div>
      {catalogEntry.category !== 'output' && <Handle type="source" position={Position.Right} />}
    </div>
  );
}
