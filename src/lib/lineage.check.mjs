// Self-check: node src/lib/lineage.check.mjs
import assert from 'node:assert/strict';
import { buildLineage, traceToSources } from './lineage.js';

const node = (id, kind, name, config = {}) => ({ id, data: { kind, name, config } });
const edge = (source, target) => ({ source, target });
const col = (name, type = 'BIGINT') => ({ name, type });

const nodes = [
  node('a', 'csvSource', 'csv_1'),
  node('b', 'csvSource', 'csv_2'),
  // Alias, table aliases, join, mixed-case/quoted column, constant.
  node('j', 'sql', 'sql_3', { query: 'SELECT a.id, upper(a."First Name") AS n, b.Amt * 2 AS amt2, 1 AS k FROM csv_1 a JOIN csv_2 b USING (id);' }),
  node('s', 'sql', 'sql_4', { query: 'SELECT * FROM sql_3' }),
  node('o', 'csvOutput', 'out_5', { path: '/tmp/x.csv' }),
];
const edges = [edge('a', 'j'), edge('b', 'j'), edge('j', 's'), edge('s', 'o')];
const schemas = {
  a: [col('id'), col('First Name', 'VARCHAR')],
  b: [col('id'), col('Amt', 'DOUBLE')],
  j: [col('id'), col('n', 'VARCHAR'), col('amt2', 'DOUBLE'), col('k', 'INTEGER')],
  s: [col('id'), col('n', 'VARCHAR'), col('amt2', 'DOUBLE'), col('k', 'INTEGER')],
};

const lin = buildLineage(nodes, edges, schemas);
const fromOf = (id) => Object.fromEntries(lin[id].map((c) => [c.name, c.from]));

assert.deepEqual(fromOf('a'), { id: [], 'First Name': [] });
assert.deepEqual(fromOf('j'), {
  id: [{ nodeId: 'a', column: 'id' }],
  n: [{ nodeId: 'a', column: 'First Name' }],
  amt2: [{ nodeId: 'b', column: 'Amt' }],
  k: [],
});
assert.deepEqual(fromOf('s').n, [{ nodeId: 'j', column: 'n' }]); // SELECT * expands
assert.deepEqual(fromOf('o').amt2, [{ nodeId: 's', column: 'amt2' }]); // output passes through
assert.equal(lin.o[0].type, 'BIGINT');

// Traces through sql → sql → output back to the CSV sources.
assert.deepEqual(traceToSources(lin, 'o', 'amt2'), [{ nodeId: 'b', column: 'Amt' }]);
assert.deepEqual(traceToSources(lin, 'o', 'n'), [{ nodeId: 'a', column: 'First Name' }]);

// Unparseable SQL degrades to "unknown" instead of throwing.
const bad = buildLineage([node('a', 'csvSource', 'csv_1'), node('x', 'sql', 'sql_9', { query: 'SELEC oops' })], [edge('a', 'x')], {
  a: [col('id')],
  x: [col('id')],
});
assert.equal(bad.x[0].from, null);
assert.equal(traceToSources(bad, 'x', 'id'), null);

console.log('lineage ok');
