// Self-check: node src/lib/workflowFile.check.mjs
import assert from 'node:assert/strict';
import { parseWorkflow, serializeWorkflow } from './workflowFile.js';

const catalog = { csvSource: {}, sql: {}, csvOutput: {} };
const onRun = () => {};
const node = (id, kind, name, config = {}) => ({
  id,
  type: 'workflowNode',
  position: { x: 10, y: 20 },
  selected: true,
  width: 200,
  data: { kind, name, config, status: 'success', error: undefined, onRun },
});

const nodes = [node('node-1', 'csvSource', 'csv_1', { path: '/tmp/a.csv' }), node('node-2', 'sql', 'sql_2', { query: 'SELECT 1' })];
const edges = [{ id: 'e1', source: 'node-1', target: 'node-2', markerEnd: { type: 'arrowclosed' } }];
const before = structuredClone({ nodes: nodes.map((n) => ({ ...n, data: { ...n.data, onRun: null } })), edges });

// Round trip keeps authored data, drops runtime fields, and leaves the inputs untouched.
const json = serializeWorkflow(nodes, edges, { x: 1, y: 2, zoom: 0.5 });
assert.ok(!/status|onRun|selected|markerEnd|width/.test(json));
assert.deepEqual(parseWorkflow(json, catalog), {
  nodes: [
    { id: 'node-1', position: { x: 10, y: 20 }, data: { kind: 'csvSource', name: 'csv_1', config: { path: '/tmp/a.csv' } } },
    { id: 'node-2', position: { x: 10, y: 20 }, data: { kind: 'sql', name: 'sql_2', config: { query: 'SELECT 1' } } },
  ],
  edges: [{ id: 'e1', source: 'node-1', target: 'node-2' }],
  viewport: { x: 1, y: 2, zoom: 0.5 },
});
assert.deepEqual({ nodes: nodes.map((n) => ({ ...n, data: { ...n.data, onRun: null } })), edges }, before);

// Rejections.
const file = JSON.parse(json);
const reject = (mutate, msg) => {
  const f = structuredClone(file);
  mutate(f);
  assert.throws(() => parseWorkflow(JSON.stringify(f), catalog), msg);
};
assert.throws(() => parseWorkflow('{nope', catalog), /valid JSON/);
reject((f) => (f.type = 'excalidraw'), /Not a Sementics/);
reject((f) => (f.version = 2), /version 2/);
reject((f) => (f.nodes[0].data.kind = 'toString'), /unknown node type/);
reject((f) => (f.nodes[1].id = 'node-1'), /duplicate id/);
reject((f) => (f.edges[0].target = 'node-9'), /Edge 1/);
reject((f) => (f.nodes[0].data.config = null), /invalid config/);
reject((f) => delete f.nodes, /missing nodes/);

// Missing viewport is fine.
const noViewport = structuredClone(file);
delete noViewport.viewport;
assert.equal(parseWorkflow(JSON.stringify(noViewport), catalog).viewport, null);

console.log('workflowFile ok');
