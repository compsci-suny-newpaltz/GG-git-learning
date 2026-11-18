import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  Position,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../styles/LearningJourney.css';
import { layoutTreeSubtree, groupNodesByDepth } from '../utils/layoutTree';

// Category color constants
const CATEGORY_COLORS = {
  basics: '#0366d6',        // Blue
  internals: '#28a745',     // Green
  collaboration: '#fd7e14', // Orange
  advanced: '#dc3545',      // Red
};

const CATEGORY_LABELS = {
  basics: 'Basics',
  internals: 'Internals',
  collaboration: 'Collaboration',
  advanced: 'Advanced',
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 60;
// Below this width the graph is unreadable, so a grouped list is shown instead.
const LIST_BREAKPOINT = 720;

const FIT_VIEW_OPTIONS = { padding: 0.08, maxZoom: 1, minZoom: 0.2 };

/**
 * Determine the category of a module based on its ID
 */
export function getModuleCategory(moduleId) {
  if (moduleId.includes('internals') || moduleId.includes('performance') || moduleId.includes('bisect')) {
    return 'internals';
  }
  if (moduleId.includes('rebasing') || moduleId.includes('submodules') || moduleId.includes('custom') || moduleId.includes('advanced-branching') || moduleId.includes('hooks') || moduleId.includes('security')) {
    return 'advanced';
  }
  if (moduleId.includes('remote') || moduleId.includes('collaboration')) {
    return 'collaboration';
  }
  return 'basics';
}

function getCategoryColor(moduleId) {
  return CATEGORY_COLORS[getModuleCategory(moduleId)] || CATEGORY_COLORS.basics;
}

function useViewportWidth() {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

/**
 * Legend - category colours in a single row
 */
const GraphLegend = () => (
  <div className="graph-legend" aria-label="Module categories">
    {Object.keys(CATEGORY_COLORS).map((key) => (
      <div key={key} className="legend-item">
        <span className="legend-color" style={{ backgroundColor: CATEGORY_COLORS[key] }} aria-hidden="true" />
        <span className="legend-label">{CATEGORY_LABELS[key]}</span>
      </div>
    ))}
  </div>
);

/**
 * Compact list used on narrow screens: modules grouped by how deep they sit
 * in the prerequisite chain, each card linking to the module.
 */
const ModuleList = ({ modules, connections }) => {
  const titles = useMemo(() => new Map(modules.map(m => [m.id, m.title])), [modules]);
  const levels = useMemo(() => groupNodesByDepth(modules, connections), [modules, connections]);

  return (
    <div className="module-list">
      {levels.map((level, depth) => (
        <section key={depth} className="module-list-level">
          <h2 className="module-list-heading">
            {depth === 0 ? 'Start here' : `Level ${depth + 1}`}
          </h2>
          {level.map((module) => (
            <Link
              key={module.id}
              to={`/module/${module.id}`}
              className="module-card"
              style={{ borderLeftColor: getCategoryColor(module.id) }}
            >
              <span className="module-card-category" style={{ color: getCategoryColor(module.id) }}>
                {CATEGORY_LABELS[getModuleCategory(module.id)]}
              </span>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              {module.prerequisites?.length > 0 && (
                <p className="module-card-prereqs">
                  After: {module.prerequisites.map(id => titles.get(id) || id).join(', ')}
                </p>
              )}
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
};

const LearningJourney = ({ modules, connections }) => {
  const navigate = useNavigate();
  const reactFlowInstance = useRef(null);
  const viewportWidth = useViewportWidth();
  const useList = viewportWidth < LIST_BREAKPOINT;

  // Convert modules to ReactFlow nodes (positions assigned by the layout below)
  const rawNodes = useMemo(() => {
    if (!modules || modules.length === 0) return [];

    return modules.map((module) => {
      const borderColor = getCategoryColor(module.id);
      const prereqs = module.prerequisites?.length ? module.prerequisites.join(', ') : 'none';

      return {
        id: module.id,
        type: 'default',
        position: { x: 0, y: 0 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          label: (
            <div className="module-node-content">
              <h3>{module.title}</h3>
            </div>
          ),
          module,
          tooltip: `${module.title}: ${module.description}. Prerequisites: ${prereqs}`,
        },
        style: {
          background: 'var(--card-bg, #ffffff)',
          border: `3px solid ${borderColor}`,
          borderRadius: '12px',
          padding: '8px 12px',
          width: NODE_WIDTH,
          minHeight: NODE_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px var(--shadow-color, rgba(0, 0, 0, 0.1))',
        },
        className: 'module-node',
      };
    });
  }, [modules]);

  // Convert connections to ReactFlow edges
  const rawEdges = useMemo(() => {
    if (!connections || connections.length === 0) return [];

    return connections.map((connection, index) => {
      const isCrossTrack = getModuleCategory(connection.source) !== getModuleCategory(connection.target);

      return {
        id: `e${index}-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: isCrossTrack ? 'var(--secondary-color, #6c757d)' : 'var(--primary-color, #0366d6)',
          strokeWidth: isCrossTrack ? 1.5 : 2,
        },
        labelStyle: { fill: 'var(--text-color, #888)', fontSize: 11 },
        labelBgStyle: { fill: 'var(--card-bg, #fff)' },
        label: isCrossTrack ? 'optional' : undefined,
      };
    });
  }, [connections]);

  // Left-to-right tree: prerequisites on the left, what they unlock on the right.
  const layoutedNodes = useMemo(() => {
    if (rawNodes.length === 0) return rawNodes;
    return layoutTreeSubtree(rawNodes, rawEdges, {
      direction: 'LR',
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      siblingGap: 16,
      levelGap: 110,
    });
  }, [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  useEffect(() => { setNodes(layoutedNodes); }, [layoutedNodes, setNodes]);
  useEffect(() => { setEdges(rawEdges); }, [rawEdges, setEdges]);

  const onNodeClick = useCallback((event, node) => {
    navigate(`/module/${node.id}`);
  }, [navigate]);

  const fitView = useCallback(() => {
    reactFlowInstance.current?.fitView(FIT_VIEW_OPTIONS);
  }, []);

  const onInit = useCallback((instance) => {
    reactFlowInstance.current = instance;
    // Nodes are measured a frame after mount; fit once they have real sizes.
    requestAnimationFrame(fitView);
  }, [fitView]);

  // Keep the whole journey in view when the window is resized.
  useEffect(() => {
    if (useList) return undefined;
    let frame = null;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitView);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
    };
  }, [useList, fitView]);

  // Native tooltips with the full description + prerequisites
  useEffect(() => {
    document.querySelectorAll('.react-flow__node').forEach(el => {
      const node = nodes.find(n => n.id === el.getAttribute('data-id'));
      if (node?.data?.tooltip) el.setAttribute('title', node.data.tooltip);
    });
  }, [nodes]);

  if (!modules || modules.length === 0) {
    return (
      <div className="learning-journey">
        <div className="loading-container">
          <p>Loading modules...</p>
        </div>
      </div>
    );
  }

  if (useList) {
    return (
      <div className="learning-journey learning-journey--list">
        <p className="journey-intro">
          Pick a module to start. Each level builds on the one before it.
        </p>
        <ModuleList modules={modules} connections={connections} />
      </div>
    );
  }

  return (
    <div className="learning-journey">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onInit={onInit}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border-color, #e0e0e0)" gap={20} size={1} />
        <Controls showInteractive={false} position="top-right" fitViewOptions={FIT_VIEW_OPTIONS} />
      </ReactFlow>
      <GraphLegend />
    </div>
  );
};

export default LearningJourney;
