import { Database, Code, FlowArrow, ArrowSquareOut } from '@phosphor-icons/react';

export const NODE_CATALOG = [
  {
    kind: 'source',
    label: 'Data Source',
    description: 'Load a table or file',
    icon: Database,
    accent: '#38bdf8',
  },
  {
    kind: 'sql',
    label: 'SQL Query',
    description: 'Run a query on the data',
    icon: Code,
    accent: '#f59e0b',
  },
  {
    kind: 'transform',
    label: 'Transform',
    description: 'Filter, map, or join data',
    icon: FlowArrow,
    accent: '#a78bfa',
  },
  {
    kind: 'output',
    label: 'Output',
    description: 'Write results somewhere',
    icon: ArrowSquareOut,
    accent: '#34d399',
  },
];

export const NODE_CATALOG_BY_KIND = Object.fromEntries(
  NODE_CATALOG.map((entry) => [entry.kind, entry]),
);
