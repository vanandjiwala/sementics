import { lineage } from 'sqlingo';
import { DuckDB } from 'sqlingo/duckdb';
import { NODE_CATALOG_BY_KIND } from '../data/nodeCatalog.js';

// Column-level lineage from a dry run's schemas ({ [nodeId]: [{ name, type }] }).
// Returns { [nodeId]: [{ name, type, from }] }, where `from` lists immediate upstream
// columns as [{ nodeId, column }] ([] = origin, null = couldn't be resolved).
export function buildLineage(nodes, edges, schemas) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const inputsOf = (id) => edges.filter((e) => e.target === id && byId.has(e.source)).map((e) => byId.get(e.source));
  const result = {};

  for (const node of nodes) {
    const { kind, config = {} } = node.data;
    if (NODE_CATALOG_BY_KIND[kind]?.category === 'output') {
      const [input] = inputsOf(node.id);
      const cols = input && schemas[input.id];
      if (cols) result[node.id] = cols.map((c) => ({ ...c, from: [{ nodeId: input.id, column: c.name }] }));
      continue;
    }
    const cols = schemas[node.id];
    if (!cols) continue;
    if (kind !== 'sql') {
      result[node.id] = cols.map((c) => ({ ...c, from: [] }));
      continue;
    }

    const inputs = inputsOf(node.id).filter((n) => schemas[n.id]);
    const schema = Object.fromEntries(
      inputs.map((n) => [n.data.name, Object.fromEntries(schemas[n.id].map((c) => [c.name, c.type]))]),
    );
    const nodeIdByName = new Map(inputs.map((n) => [n.data.name.toLowerCase(), n.id]));
    const query = config.query.trim().replace(/;\s*$/, '');

    // ponytail: sqlingo's coverage of DuckDB-only syntax is best effort (unresolved → from: null);
    // fall back to DuckDB's json_serialize_sql AST if the gaps matter.
    result[node.id] = cols.map((c) => {
      try {
        const leaves = [];
        const walk = (l) => (l.downstream?.length ? l.downstream.forEach(walk) : leaves.push(l));
        walk(lineage(c.name, query, { schema, dialect: DuckDB }));
        const from = [];
        for (const leaf of leaves) {
          // leaf.name is `alias."normalized col"`; leaf.source is the real table.
          const nodeId = nodeIdByName.get(String(leaf.source?.name ?? '').toLowerCase());
          if (!nodeId) continue; // constants and literals have no upstream column
          const raw = leaf.name.slice(leaf.name.indexOf('.') + 1).replace(/^"(.*)"$/, '$1').replaceAll('""', '"');
          const column = schemas[nodeId].find((s) => s.name.toLowerCase() === raw.toLowerCase())?.name ?? raw;
          if (!from.some((f) => f.nodeId === nodeId && f.column === column)) from.push({ nodeId, column });
        }
        return { ...c, from };
      } catch {
        return { ...c, from: null };
      }
    });
  }
  return result;
}

// Follow `from` back to origin columns: [{ nodeId, column }], or null if any hop is unresolved.
export function traceToSources(lin, nodeId, column, seen = new Set()) {
  const key = `${nodeId}\0${column}`;
  if (seen.has(key)) return [];
  seen.add(key);
  const col = lin[nodeId]?.find((c) => c.name.toLowerCase() === column.toLowerCase());
  if (!col || col.from === null) return null;
  if (col.from.length === 0) return [{ nodeId, column: col.name }];
  const out = [];
  for (const f of col.from) {
    const up = traceToSources(lin, f.nodeId, f.column, seen);
    if (up === null) return null;
    for (const u of up) if (!out.some((o) => o.nodeId === u.nodeId && o.column === u.column)) out.push(u);
  }
  return out;
}
