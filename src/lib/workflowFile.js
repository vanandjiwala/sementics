// Workflow file format: only what the user authored. Runtime fields (status, onRun, selection) are rebuilt on load.
const TYPE = 'sementics-workflow';
const VERSION = 1;

export function serializeWorkflow(nodes, edges, viewport) {
  return JSON.stringify(
    {
      type: TYPE,
      version: VERSION,
      viewport,
      nodes: nodes.map(({ id, position, data: { kind, name, config } }) => ({
        id,
        position: { x: position.x, y: position.y },
        data: { kind, name, config },
      })),
      edges: edges.map(({ id, source, target }) => ({ id, source, target })),
    },
    null,
    2,
  );
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Parse and validate a workflow file; throws an Error with a user-facing message.
// `catalog` is NODE_CATALOG_BY_KIND (passed in so this stays importable from plain node).
export function parseWorkflow(json, catalog) {
  let file;
  try {
    file = JSON.parse(json);
  } catch {
    throw new Error('Not a valid JSON file');
  }
  if (!isObject(file) || file.type !== TYPE) throw new Error('Not a Sementics workflow file');
  if (file.version !== VERSION) throw new Error(`Unsupported workflow version ${file.version}`);
  if (!Array.isArray(file.nodes) || !Array.isArray(file.edges)) throw new Error('Workflow is missing nodes or edges');

  const ids = new Set();
  const nodes = file.nodes.map((n, i) => {
    const bad = (why) => new Error(`Node ${i + 1}: ${why}`);
    if (!isObject(n) || typeof n.id !== 'string') throw bad('missing id');
    if (ids.has(n.id)) throw bad(`duplicate id "${n.id}"`);
    ids.add(n.id);
    if (!isObject(n.position) || !isNum(n.position.x) || !isNum(n.position.y)) throw bad('invalid position');
    const { kind, name, config } = isObject(n.data) ? n.data : {};
    if (typeof kind !== 'string' || !Object.hasOwn(catalog, kind)) throw bad(`unknown node type "${kind}"`);
    if (typeof name !== 'string') throw bad('missing name');
    if (!isObject(config)) throw bad('invalid config');
    return { id: n.id, position: { x: n.position.x, y: n.position.y }, data: { kind, name, config } };
  });

  const edges = file.edges.map((e, i) => {
    if (!isObject(e) || !ids.has(e.source) || !ids.has(e.target)) {
      throw new Error(`Edge ${i + 1}: must connect two nodes in the file`);
    }
    return { id: typeof e.id === 'string' ? e.id : `e-${e.source}-${e.target}`, source: e.source, target: e.target };
  });

  const v = file.viewport;
  const viewport = isObject(v) && isNum(v.x) && isNum(v.y) && isNum(v.zoom) ? { x: v.x, y: v.y, zoom: v.zoom } : null;
  return { nodes, edges, viewport };
}
