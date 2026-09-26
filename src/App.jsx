import React, { useCallback, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow';
import NodeConfigPanel from './components/NodeConfigPanel';
import NodePalette from './components/NodePalette';
import TopBar from './components/TopBar';
import WorkflowNode, { LineageContext } from './components/WorkflowNode';
import { NODE_CATALOG_BY_KIND } from './data/nodeCatalog';
import DataPreview from './components/DataPreview';
import CanvasToolbar from './components/CanvasToolbar';
import { buildStatements, quoteIdent, quoteStr } from './lib/pipeline';
import { buildLineage, traceToSources } from './lib/lineage';
import { parseWorkflow, serializeWorkflow } from './lib/workflowFile';

const nodeTypes = { workflowNode: WorkflowNode };
const PREVIEW_ROWS = 10;
// ponytail: "Show all" is capped to keep IPC and the DOM responsive; add paging if 10k isn't enough.
const PREVIEW_MAX_ROWS = 10000;
// Also spread into edges loaded from a file: ReactFlow only applies these to edges created by connecting.
const defaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' } };
const baseName = (filePath) => filePath.split(/[\\/]/).pop();

let nodeIdCounter = 0;
function nextNodeId() {
  nodeIdCounter += 1;
  return `node-${nodeIdCounter}`;
}

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workflowStatus, setWorkflowStatus] = useState('idle');
  const [workflowMode, setWorkflowMode] = useState('run');
  // Outcome of the last run/dry run, shown in the top bar: { mode, ok, count, nodeId?, name? }.
  const [lastResult, setLastResult] = useState(null);
  // Column-level lineage from the last successful dry run; cleared on any graph edit.
  const [lineage, setLineage] = useState(null);
  const [preview, setPreview] = useState(null);
  const wrapperRef = useRef(null);
  const { screenToFlowPosition, fitView, getViewport, setViewport } = useReactFlow();

  // A graph edit makes the last lineage and result stale.
  const invalidate = useCallback(() => {
    setLineage(null);
    setLastResult(null);
  }, []);

  const focusNode = useCallback(
    (id) => {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === id })));
      fitView({ nodes: [{ id }], duration: 300, maxZoom: 1 });
    },
    [setNodes, fitView],
  );

  const onConnect = useCallback(
    (params) => {
      invalidate();
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges, invalidate],
  );

  // Nodes hold data.onRun from creation time, so route it through a ref to always see current state.
  const executeRef = useRef(null);
  const onRun = useCallback((id) => executeRef.current(id), []);

  const setStatuses = useCallback(
    (statusById, errorById = {}) =>
      setNodes((nds) =>
        nds.map((n) =>
          n.id in statusById
            ? { ...n, data: { ...n.data, status: statusById[n.id], error: errorById[n.id] } }
            : n,
        ),
      ),
    [setNodes],
  );

  const execute = useCallback(
    async (targetId, { limit = PREVIEW_ROWS, exportPath, dryRun = false } = {}) => {
      if (workflowStatus === 'running') return;
      const mode = dryRun ? 'dryRun' : 'run';
      const nameOf = (id) => nodes.find((n) => n.id === id)?.data.name;
      setWorkflowMode(mode);
      setLastResult(null);
      if (dryRun) setLineage(null);
      let statements;
      try {
        statements = buildStatements(nodes, edges, targetId, { dryRun });
      } catch (err) {
        setStatuses({ [err.nodeId]: 'error' }, { [err.nodeId]: err.message });
        setWorkflowStatus('error');
        setLastResult({ mode, ok: false, nodeId: err.nodeId, name: nameOf(err.nodeId) });
        return;
      }
      const target = targetId && nodes.find((n) => n.id === targetId);
      // A dry run never reads rows, so no preview or export.
      const previewable = !dryRun && target && NODE_CATALOG_BY_KIND[target.data.kind].category !== 'output';
      let previewSql;
      if (previewable && exportPath) {
        statements.push({
          nodeId: targetId,
          sql: `COPY (SELECT * FROM ${quoteIdent(target.data.name)}) TO ${quoteStr(exportPath)} (FORMAT csv, HEADER)`,
        });
      } else if (previewable) {
        previewSql = `SELECT * FROM ${quoteIdent(target.data.name)} LIMIT ${limit}`;
      }
      const ids = [...new Set(statements.map((s) => s.nodeId))];
      setStatuses(Object.fromEntries(ids.map((id) => [id, 'running'])));
      setWorkflowStatus('running');

      let result;
      try {
        if (dryRun) {
          const views = statements
            .map((s) => nodes.find((n) => n.id === s.nodeId))
            .filter((n) => NODE_CATALOG_BY_KIND[n.data.kind].category !== 'output')
            .map((n) => ({ nodeId: n.id, name: n.data.name }));
          result = await window.sementics.dryRun(statements, views);
        } else {
          result = await window.sementics.runStatements(statements, previewSql);
        }
      } catch (err) {
        result = { ok: false, nodeId: ids[0], message: err.message };
      }
      if (result.schemas) setLineage(buildLineage(nodes, edges, result.schemas));
      if (result.preview) setPreview({ nodeId: targetId, name: target.data.name, limit, ...result.preview });
      else if (!result.ok) setPreview(null);
      const failedAt = result.ok ? ids.length : ids.indexOf(result.nodeId);
      setStatuses(
        Object.fromEntries(ids.map((id, i) => [id, i < failedAt ? 'success' : i === failedAt ? 'error' : 'idle'])),
        result.ok ? {} : { [result.nodeId]: result.message },
      );
      setWorkflowStatus(result.ok ? 'success' : 'error');
      setLastResult(
        result.ok
          ? { mode, ok: true, count: ids.length }
          : { mode, ok: false, nodeId: result.nodeId, name: nameOf(result.nodeId) },
      );
    },
    [workflowStatus, nodes, edges, setStatuses],
  );
  executeRef.current = execute;

  const updateNodeData = useCallback(
    (id, patch) => {
      invalidate();
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch(n.data) } } : n)));
    },
    [setNodes, invalidate],
  );

  const selected = nodes.filter((n) => n.selected);
  const selectedNode = selected.length === 1 ? selected[0] : null;
  const selectedInputNames = selectedNode
    ? edges
        .filter((e) => e.target === selectedNode.id)
        .map((e) => nodes.find((n) => n.id === e.source)?.data.name)
        .filter(Boolean)
    : [];
  const nameOf = (id) => nodes.find((n) => n.id === id)?.data.name;
  const selectedColumns = selectedNode && lineage?.[selectedNode.id]?.map((c) => ({
    ...c,
    sources: traceToSources(lineage, selectedNode.id, c.name)
      ?.filter((s) => s.nodeId !== selectedNode.id)
      .map((s) => `${nameOf(s.nodeId)}.${s.column}`),
  }));

  // Export never touches graph state, so the canvas stays exactly as it was.
  const onExport = async () => {
    let result;
    try {
      result = await window.sementics.saveWorkflow(serializeWorkflow(nodes, edges, getViewport()));
    } catch (err) {
      result = { ok: false, message: err.message };
    }
    if (result.canceled) return;
    setLastResult({ mode: 'export', ok: result.ok, name: result.ok && baseName(result.filePath), message: result.message });
  };

  const onNew = () => {
    if (nodes.length && !window.confirm('Clear the canvas? Unsaved changes will be lost.')) return;
    invalidate();
    setPreview(null);
    setWorkflowStatus('idle');
    setNodes([]);
    setEdges([]);
  };

  const onOpen = async () => {
    if (nodes.length && !window.confirm('Replace the current workflow?')) return;
    let result;
    let workflow;
    try {
      result = await window.sementics.openWorkflow();
      if (result.ok) workflow = parseWorkflow(result.json, NODE_CATALOG_BY_KIND);
    } catch (err) {
      result = { ok: false, message: err.message };
    }
    if (result.canceled) return;
    if (!workflow) {
      setLastResult({ mode: 'open', ok: false, message: result.message });
      return;
    }
    // New drops must not reuse a loaded node id.
    for (const n of workflow.nodes) nodeIdCounter = Math.max(nodeIdCounter, Number(/^node-(\d+)$/.exec(n.id)?.[1] ?? 0));
    invalidate();
    setPreview(null);
    setWorkflowStatus('idle');
    setNodes(workflow.nodes.map((n) => ({ ...n, type: 'workflowNode', data: { ...n.data, status: 'idle', onRun } })));
    setEdges(workflow.edges.map((e) => ({ ...defaultEdgeOptions, ...e })));
    if (workflow.viewport) setViewport(workflow.viewport);
    else requestAnimationFrame(() => fitView());
    setLastResult({ mode: 'open', ok: true, name: baseName(result.filePath) });
  };

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData('application/reactflow');
      if (!kind || !NODE_CATALOG_BY_KIND[kind]) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = nextNodeId();
      const newNode = {
        id,
        type: 'workflowNode',
        position,
        data: {
          kind,
          name: `${NODE_CATALOG_BY_KIND[kind].namePrefix}_${id.split('-')[1]}`,
          config: {},
          status: 'idle',
          onRun,
        },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, onRun],
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <TopBar
        running={workflowStatus === 'running'}
        mode={workflowMode}
        lastResult={lastResult}
        onFocusNode={focusNode}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && <NodePalette />}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={wrapperRef} className="relative min-h-0 flex-1">
            <CanvasToolbar
              running={workflowStatus === 'running'}
              mode={workflowMode}
              onNew={onNew}
              onOpen={onOpen}
              onExport={onExport}
              onDryRun={() => execute(undefined, { dryRun: true })}
              onRun={() => execute()}
            />
            {nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <p className="font-mono text-sm text-muted-foreground">
                  Drag a node from the left to get started
                </p>
              </div>
            )}
            <LineageContext.Provider value={lineage}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={(changes) => {
                  if (changes.some((c) => c.type === 'remove')) invalidate();
                  onNodesChange(changes);
                }}
                onEdgesChange={(changes) => {
                  if (changes.some((c) => c.type === 'remove')) invalidate();
                  onEdgesChange(changes);
                }}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                defaultEdgeOptions={defaultEdgeOptions}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView
              >
                <Background color="#334155" />
                <Controls />
                <MiniMap
                  style={{ backgroundColor: '#1b2336' }}
                  maskColor="rgba(15, 23, 42, 0.6)"
                  nodeColor={(n) => n.data?.kind && NODE_CATALOG_BY_KIND[n.data.kind]?.accent}
                  nodeStrokeColor="#475569"
                />
              </ReactFlow>
            </LineageContext.Provider>
          </div>
          {preview && (
            <DataPreview
              preview={preview}
              capped={preview.limit === PREVIEW_MAX_ROWS && preview.rows.length === PREVIEW_MAX_ROWS}
              busy={workflowStatus === 'running'}
              onShowAll={() => execute(preview.nodeId, { limit: PREVIEW_MAX_ROWS })}
              onDownload={async () => {
                const exportPath = await window.sementics.saveCsv();
                if (exportPath) execute(preview.nodeId, { exportPath });
              }}
              onClose={() => setPreview(null)}
            />
          )}
        </div>
        {selectedNode && (
          <NodeConfigPanel
            key={selectedNode.id}
            node={selectedNode}
            inputNames={selectedInputNames}
            columns={selectedColumns}
            onNameChange={(name) => updateNodeData(selectedNode.id, () => ({ name }))}
            onConfigChange={(key, value) =>
              updateNodeData(selectedNode.id, (d) => ({ config: { ...d.config, [key]: value } }))
            }
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
