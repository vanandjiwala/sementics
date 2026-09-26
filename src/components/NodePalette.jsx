import React from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { NODE_CATALOG, NODE_CATEGORIES } from '../data/nodeCatalog';

function onDragStart(event, kind) {
  event.dataTransfer.setData('application/reactflow', kind);
  event.dataTransfer.effectAllowed = 'move';
}

export default function NodePalette() {
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card p-3 overflow-y-auto">
      <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Data Nodes
      </h2>
      <div className="flex flex-col gap-3">
        {NODE_CATEGORIES.map(({ id, label: categoryLabel }) => (
          <details key={id} open className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <CaretRight size={12} className="transition-transform group-open:rotate-90" />
              {categoryLabel}
            </summary>
            <div className="flex flex-col gap-2">
              {NODE_CATALOG.filter((node) => node.category === id).map(
                ({ kind, label, description, icon: Icon, accent }) => (
                  <div
                    key={kind}
                    draggable
                    onDragStart={(event) => onDragStart(event, kind)}
                    className="cursor-grab rounded-lg border border-border bg-background/40 p-3 transition-colors hover:border-muted-foreground active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={18} weight="regular" color={accent} />
                      <span className="font-mono text-sm font-medium">{label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                  </div>
                ),
              )}
            </div>
          </details>
        ))}
      </div>
    </aside>
  );
}
