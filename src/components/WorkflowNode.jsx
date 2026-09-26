import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Play, Spinner, CheckCircle, Trash } from '@phosphor-icons/react';
import { NODE_CATALOG_BY_KIND } from '../data/nodeCatalog';

const STATUS_ICON = {
  idle: Play,
  running: Spinner,
  success: CheckCircle,
};

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
      <Handle type="target" position={Position.Left} />
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
            aria-label={status === 'idle' ? 'Run node' : status === 'running' ? 'Running' : 'Ran successfully'}
          >
            <StatusIcon
              size={14}
              weight={status === 'success' ? 'fill' : 'regular'}
              color={status === 'success' ? 'var(--color-accent)' : undefined}
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
      <div className="px-3 py-2 text-xs text-muted-foreground">{catalogEntry.description}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
