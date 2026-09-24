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
import NodePalette from './components/NodePalette';
import TopBar from './components/TopBar';
import WorkflowNode from './components/WorkflowNode';
import { NODE_CATALOG_BY_KIND } from './data/nodeCatalog';

const nodeTypes = { workflowNode: WorkflowNode };

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
  const wrapperRef = useRef(null);
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const runNode = useCallback(
    (id) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, status: 'running' } } : n)),
      );
      setTimeout(() => {
        setNodes((nds) =>
          nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, status: 'success' } } : n)),
        );
      }, 1000);
    },
    [setNodes],
  );

  const runAll = useCallback(() => {
    if (workflowStatus === 'running') return;
    setWorkflowStatus('running');
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: 'running' } })));
    setTimeout(() => {
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: 'success' } })));
      setWorkflowStatus('success');
    }, 1000);
  }, [workflowStatus, setNodes]);

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
      const newNode = {
        id: nextNodeId(),
        type: 'workflowNode',
        position,
        data: { kind, status: 'idle', onRun: runNode },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, runNode],
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <TopBar
        status={workflowStatus}
        onRunAll={runAll}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && <NodePalette />}
        <div ref={wrapperRef} className="relative min-w-0 flex-1">
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <p className="font-mono text-sm text-muted-foreground">
                Drag a node from the left to get started
              </p>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' } }}
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
        </div>
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
