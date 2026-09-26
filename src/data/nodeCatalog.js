import { FileCsv, Code, FloppyDisk } from '@phosphor-icons/react';

export const NODE_CATEGORIES = [
  { id: 'input', label: 'Input' },
  { id: 'transformation', label: 'Transformation' },
  { id: 'output', label: 'Output' },
];

// Param types: text (quoted string), number, bool, select (quoted string), raw (inserted verbatim).
// Unset params are omitted so DuckDB defaults (incl. auto-detection) apply.
const COMPRESSION = { key: 'compression', label: 'Compression', type: 'select', options: ['auto', 'none', 'gzip', 'zstd'] };

export const NODE_CATALOG = [
  {
    kind: 'csvSource',
    category: 'input',
    label: 'CSV Source',
    description: 'Read CSV file(s) with DuckDB',
    icon: FileCsv,
    accent: '#38bdf8',
    namePrefix: 'csv',
    params: [
      { key: 'path', label: 'File path (globs allowed)', type: 'text', required: true, browse: 'open' },
      { key: 'header', label: 'Header', type: 'bool' },
      { key: 'delim', label: 'Delimiter', type: 'text' },
      { key: 'quote', label: 'Quote', type: 'text' },
      { key: 'escape', label: 'Escape', type: 'text' },
      { key: 'skip', label: 'Skip lines', type: 'number' },
      { key: 'comment', label: 'Comment char', type: 'text' },
      { key: 'nullstr', label: 'NULL string', type: 'text' },
      { key: 'dateformat', label: 'Date format', type: 'text' },
      { key: 'timestampformat', label: 'Timestamp format', type: 'text' },
      { key: 'decimal_separator', label: 'Decimal separator', type: 'text' },
      { key: 'thousands', label: 'Thousands separator', type: 'text' },
      { key: 'new_line', label: 'New line', type: 'text' },
      { key: 'encoding', label: 'Encoding', type: 'select', options: ['utf-8', 'utf-16', 'latin-1'] },
      COMPRESSION,
      { key: 'sample_size', label: 'Sample size', type: 'number' },
      { key: 'max_line_size', label: 'Max line size', type: 'number' },
      { key: 'auto_detect', label: 'Auto detect', type: 'bool' },
      { key: 'all_varchar', label: 'All VARCHAR', type: 'bool' },
      { key: 'ignore_errors', label: 'Ignore errors', type: 'bool' },
      { key: 'null_padding', label: 'NULL padding', type: 'bool' },
      { key: 'normalize_names', label: 'Normalize names', type: 'bool' },
      { key: 'union_by_name', label: 'Union by name', type: 'bool' },
      { key: 'filename', label: 'Add filename column', type: 'bool' },
      { key: 'hive_partitioning', label: 'Hive partitioning', type: 'bool' },
      { key: 'strict_mode', label: 'Strict mode', type: 'bool' },
      { key: 'allow_quoted_nulls', label: 'Allow quoted NULLs', type: 'bool' },
      { key: 'parallel', label: 'Parallel', type: 'bool' },
      { key: 'columns', label: "Columns (e.g. {'id': 'INTEGER'})", type: 'raw' },
      { key: 'types', label: "Types (e.g. {'id': 'INTEGER'})", type: 'raw' },
      { key: 'names', label: "Names (e.g. ['a', 'b'])", type: 'raw' },
    ],
  },
  {
    kind: 'sql',
    category: 'transformation',
    label: 'SQL Query',
    description: 'Query upstream nodes by name',
    icon: Code,
    accent: '#f59e0b',
    namePrefix: 'sql',
    params: [{ key: 'query', label: 'Query', type: 'sql', required: true }],
  },
  {
    kind: 'csvOutput',
    category: 'output',
    label: 'CSV Output',
    description: 'Write the input to a CSV file',
    icon: FloppyDisk,
    accent: '#34d399',
    namePrefix: 'out',
    params: [
      { key: 'path', label: 'File path', type: 'text', required: true, browse: 'save' },
      { key: 'header', label: 'Header', type: 'bool' },
      { key: 'delim', label: 'Delimiter', type: 'text' },
      { key: 'quote', label: 'Quote', type: 'text' },
      { key: 'escape', label: 'Escape', type: 'text' },
      { key: 'nullstr', label: 'NULL string', type: 'text' },
      { key: 'dateformat', label: 'Date format', type: 'text' },
      { key: 'timestampformat', label: 'Timestamp format', type: 'text' },
      { key: 'force_quote', label: 'Force quote (e.g. * or (a, b))', type: 'raw' },
      COMPRESSION,
    ],
  },
];

export const NODE_CATALOG_BY_KIND = Object.fromEntries(
  NODE_CATALOG.map((entry) => [entry.kind, entry]),
);
