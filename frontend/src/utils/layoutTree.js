/**
 * Tree layout utilities for the learning-journey graph.
 *
 * The module graph is a DAG where every module has at most a handful of
 * prerequisites. For layout purposes each node is attached to its first
 * prerequisite (its "layout parent"); every remaining edge is still drawn,
 * it just doesn't influence positioning.
 */

/**
 * Build the layout tree: children lists keyed by the first parent only, so a
 * node with several prerequisites is positioned (and its width counted) once.
 */
function buildLayoutTree(nodes, edges) {
  const nodeMap = new Map(nodes.map(n => [n.id, { id: n.id, children: [], parent: null }]));

  edges.forEach(edge => {
    const parent = nodeMap.get(edge.source);
    const child = nodeMap.get(edge.target);
    if (parent && child && !child.parent && parent !== child) {
      child.parent = parent;
      parent.children.push(child);
    }
  });

  const roots = Array.from(nodeMap.values()).filter(n => !n.parent);
  return { nodeMap, roots };
}

/**
 * Depth of every node = length of the longest prerequisite chain leading to it.
 * @returns {Map<string, number>}
 */
export function calculateNodeDepths(nodes, edges) {
  const ids = new Set(nodes.map(n => n.id));
  const parents = new Map(nodes.map(n => [n.id, []]));
  edges.forEach(e => {
    if (ids.has(e.source) && ids.has(e.target) && e.source !== e.target) {
      parents.get(e.target).push(e.source);
    }
  });

  const depths = new Map();
  const visiting = new Set();
  const depthOf = (id) => {
    if (depths.has(id)) return depths.get(id);
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const d = parents.get(id).reduce((max, p) => Math.max(max, depthOf(p) + 1), 0);
    visiting.delete(id);
    depths.set(id, d);
    return d;
  };
  nodes.forEach(n => depthOf(n.id));
  return depths;
}

/**
 * Group nodes by depth, preserving the original node order inside each level.
 * @returns {Array<Array<node>>} index = depth
 */
export function groupNodesByDepth(nodes, edges) {
  const depths = calculateNodeDepths(nodes, edges);
  const levels = [];
  nodes.forEach(n => {
    const d = depths.get(n.id) || 0;
    (levels[d] = levels[d] || []).push(n);
  });
  return levels.map(l => l || []);
}

/**
 * Position nodes as a tidy tree, allocating each subtree the span it needs so
 * siblings never overlap.
 *
 * @param {Array} nodes  React Flow nodes
 * @param {Array} edges  {source, target}
 * @param {Object} options
 * @param {'TB'|'LR'} options.direction   top-to-bottom or left-to-right
 * @param {number} options.nodeWidth
 * @param {number} options.nodeHeight
 * @param {number} options.siblingGap     gap between sibling subtrees (cross axis)
 * @param {number} options.levelGap       gap between depth levels (main axis)
 */
export function layoutTreeSubtree(nodes, edges, options = {}) {
  const {
    direction = 'TB',
    nodeWidth = 220,
    nodeHeight = 110,
    siblingGap = options.horizontalSpacing ?? 40,
    levelGap = options.verticalSpacing ?? 100,
  } = options;

  if (!nodes || nodes.length === 0) return nodes;

  const horizontal = direction === 'LR';
  // Size of a node along the cross axis (the axis siblings spread across).
  const crossSize = horizontal ? nodeHeight : nodeWidth;
  const mainSize = horizontal ? nodeWidth : nodeHeight;

  const { nodeMap, roots } = buildLayoutTree(nodes, edges);

  const measure = (node) => {
    if (node.children.length === 0) {
      node.span = crossSize;
      return node.span;
    }
    const childrenSpan = node.children.reduce((sum, c) => sum + measure(c), 0)
      + siblingGap * (node.children.length - 1);
    node.span = Math.max(crossSize, childrenSpan);
    return node.span;
  };

  const place = (node, cross, depth) => {
    const main = depth * (mainSize + levelGap);
    const offset = cross + (node.span - crossSize) / 2;
    node.position = horizontal ? { x: main, y: offset } : { x: offset, y: main };
    let childCross = cross;
    node.children.forEach(child => {
      place(child, childCross, depth + 1);
      childCross += child.span + siblingGap;
    });
  };

  let cursor = 0;
  roots.forEach(root => {
    measure(root);
    place(root, cursor, 0);
    cursor += root.span + siblingGap;
  });

  return nodes.map(n => ({ ...n, position: nodeMap.get(n.id).position }));
}

/** Backwards-compatible alias (top-to-bottom). */
export function layoutTree(nodes, edges, options = {}) {
  return layoutTreeSubtree(nodes, edges, { ...options, direction: 'TB' });
}

export default layoutTree;
