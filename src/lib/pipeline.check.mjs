// Self-check: node src/lib/pipeline.check.mjs
import assert from 'node:assert/strict';
import { buildStatements, PipelineError } from './pipeline.js';

const node = (id, kind, name, config) => ({ id, data: { kind, name, config } });
const edge = (source, target) => ({ id: `${source}-${target}`, source, target });

const src = node('a', 'csvSource', 'csv_1', { path: "/tmp/o'neil.csv", header: 'true', delim: ';', skip: '2', types: "{'id': 'INTEGER'}", quote: '' });
const sql = node('b', 'sql', 'sql_2', { query: 'SELECT * FROM csv_1;  ' });
const out = node('c', 'csvOutput', 'out_3', { path: '/tmp/out.csv', header: 'false' });

// Order follows edges, not array order; quoting and option formatting.
const stmts = buildStatements([out, sql, src], [edge('b', 'c'), edge('a', 'b')]);
assert.deepEqual(stmts.map((s) => s.nodeId), ['a', 'b', 'c']);
assert.equal(
  stmts[0].sql,
  `CREATE VIEW "csv_1" AS SELECT * FROM read_csv('/tmp/o''neil.csv', header = true, delim = ';', skip = 2, types = {'id': 'INTEGER'})`,
);
assert.equal(stmts[1].sql, 'CREATE VIEW "sql_2" AS SELECT * FROM csv_1');
assert.equal(stmts[2].sql, `COPY (SELECT * FROM "sql_2") TO '/tmp/out.csv' (FORMAT csv, header false)`);

// Dry run only EXPLAINs outputs.
assert.equal(
  buildStatements([out, sql, src], [edge('b', 'c'), edge('a', 'b')], undefined, { dryRun: true })[2].sql,
  `EXPLAIN ${stmts[2].sql}`,
);

// targetId limits to ancestors.
assert.deepEqual(buildStatements([src, sql, out], [edge('a', 'b'), edge('b', 'c')], 'b').map((s) => s.nodeId), ['a', 'b']);

const failsOn = (fn, nodeId, re) =>
  assert.throws(fn, (e) => e instanceof PipelineError && e.nodeId === nodeId && re.test(e.message));

failsOn(() => buildStatements([src, out], []), 'c', /exactly one input/);
failsOn(() => buildStatements([node('x', 'csvSource', 'csv_1', {})], []), 'x', /required/);
failsOn(() => buildStatements([src, node('y', 'sql', 'csv_1', { query: 'SELECT 1' })], []), 'y', /Duplicate/);
failsOn(() => buildStatements([node('z', 'sql', 'bad name', { query: 'SELECT 1' })], []), 'z', /Invalid name/);
failsOn(() => buildStatements([src, node('n', 'csvSource', 'csv_9', { path: 'x', skip: 'abc' })], []), 'n', /number/);
const s1 = node('p', 'sql', 's1', { query: 'SELECT 1' });
const s2 = node('q', 'sql', 's2', { query: 'SELECT 1' });
failsOn(() => buildStatements([s1, s2], [edge('p', 'q'), edge('q', 'p')]), 'p', /cycle/);

console.log('pipeline ok');
