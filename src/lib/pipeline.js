import { NODE_CATALOG_BY_KIND } from '../data/nodeCatalog.js';

export class PipelineError extends Error {
  constructor(nodeId, message) {
    super(message);
    this.nodeId = nodeId;
  }
}

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const quoteStr = (s) => `'${String(s).replaceAll("'", "''")}'`;
export const quoteIdent = (s) => `"${String(s).replaceAll('"', '""')}"`;

// Render the set (non-empty) params as `key<sep>value` pairs, skipping `skipKeys`.
export function formatOpts(params, values = {}, sep, skipKeys = []) {
  const parts = [];
  for (const { key, type } of params) {
    const v = values[key];
    if (skipKeys.includes(key) || v === undefined || v === null || String(v).trim() === '') continue;
    let out;
    if (type === 'bool') out = String(v) === 'true' ? 'true' : 'false';
    else if (type === 'number') {
      if (!Number.isFinite(Number(v))) throw new Error(`"${key}" must be a number`);
      out = String(Number(v));
    } else if (type === 'raw') out = String(v).trim();
    else out = quoteStr(v);
    parts.push(`${key}${sep}${out}`);
  }
  return parts;
}

function nodeSql(node, inputs) {
  const { kind, name, config = {} } = node.data;
  const entry = NODE_CATALOG_BY_KIND[kind];
  for (const p of entry.params) {
    if (p.required && !String(config[p.key] ?? '').trim()) throw new Error(`${p.label} is required`);
  }
  if (kind === 'csvSource') {
    const opts = formatOpts(entry.params, config, ' = ', ['path']);
    return `CREATE VIEW ${quoteIdent(name)} AS SELECT * FROM read_csv(${[quoteStr(config.path), ...opts].join(', ')})`;
  }
  if (kind === 'sql') {
    return `CREATE VIEW ${quoteIdent(name)} AS ${config.query.trim().replace(/;\s*$/, '')}`;
  }
  if (kind === 'csvOutput') {
    if (inputs.length !== 1) throw new Error('Connect exactly one input');
    const opts = formatOpts(entry.params, config, ' ', ['path']);
    return `COPY (SELECT * FROM ${quoteIdent(inputs[0].data.name)}) TO ${quoteStr(config.path)} (${['FORMAT csv', ...opts].join(', ')})`;
  }
  throw new Error(`Unknown node kind "${kind}"`);
}

// Compile the graph into [{ nodeId, sql }] in dependency order.
// With targetId, only that node and its ancestors are included.
export function buildStatements(nodes, edges, targetId) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const liveEdges = edges.filter((e) => byId.has(e.source) && byId.has(e.target));

  let included = nodes;
  if (targetId) {
    const keep = new Set([targetId]);
    const stack = [targetId];
    while (stack.length) {
      const id = stack.pop();
      for (const e of liveEdges) {
        if (e.target === id && !keep.has(e.source)) {
          keep.add(e.source);
          stack.push(e.source);
        }
      }
    }
    included = nodes.filter((n) => keep.has(n.id));
  }

  const seen = new Map();
  for (const n of included) {
    const { name } = n.data;
    if (!NAME_RE.test(name ?? '')) throw new PipelineError(n.id, `Invalid name "${name ?? ''}" (letters, digits, _)`);
    if (seen.has(name)) throw new PipelineError(n.id, `Duplicate name "${name}"`);
    seen.set(name, n.id);
  }

  // Kahn's algorithm over the included subgraph.
  const ids = new Set(included.map((n) => n.id));
  const sub = liveEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const indeg = new Map(included.map((n) => [n.id, 0]));
  for (const e of sub) indeg.set(e.target, indeg.get(e.target) + 1);
  const queue = included.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const e of sub) {
      if (e.source !== id) continue;
      indeg.set(e.target, indeg.get(e.target) - 1);
      if (indeg.get(e.target) === 0) queue.push(e.target);
    }
  }
  if (order.length !== included.length) {
    const stuck = included.find((n) => !order.includes(n.id));
    throw new PipelineError(stuck.id, 'Workflow contains a cycle');
  }

  return order.map((id) => {
    const inputs = sub.filter((e) => e.target === id).map((e) => byId.get(e.source));
    try {
      return { nodeId: id, sql: nodeSql(byId.get(id), inputs) };
    } catch (err) {
      throw new PipelineError(id, err.message);
    }
  });
}
