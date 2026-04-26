/* ============================================================
   graph.js — Asset Graph Page
   ============================================================ */

let network = null;
let graphNodes = null;
let graphEdges = null;
let allNodes = [];
let allEdges = [];

document.addEventListener('DOMContentLoaded', () => {
  loadGraph();
});

function getApiUrl() {
  return (localStorage.getItem('dap_api_url') || 'http://localhost:8000').replace(/\/$/, '');
}

async function authFetch(url, opts = {}) {
  const session = getSession();
  const headers = { ...(opts.headers || {}) };
  if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;
  return fetch(url, { ...opts, headers });
}

function cleanLabel(label) {
  if (!label) return 'Unknown';
  return label
    .replace(/_wm\.png$/, '')
    .replace(/^[a-z0-9]+_[a-z0-9]+_[a-z0-9]+_/i, '')
    || label;
}

function extractOwner(label) {
  if (!label) return 'Unknown';
  const parts = label.split('_');
  if (parts.length >= 3) {
    return `${parts[0]}@${parts[1]}.${parts[2]}`;
  }
  return 'Unknown';
}

async function loadGraph() {
  document.getElementById('loading-card').style.display = 'flex';
  document.getElementById('empty-card').style.display   = 'none';
  document.getElementById('error-card').style.display   = 'none';
  document.getElementById('graph-container').style.display = 'none';
  document.getElementById('graph-stats').style.display  = 'none';
  document.getElementById('graph-legend').style.display = 'none';
  closeDetail();

  try {
    const res  = await authFetch(`${getApiUrl()}/graph`);
    const data = await res.json();

    allNodes = data.nodes || [];
    allEdges = data.edges || [];

    document.getElementById('loading-card').style.display = 'none';

    if (allNodes.length === 0) {
      document.getElementById('empty-card').style.display = 'block';
      return;
    }

    renderStats();
    renderGraph();

    document.getElementById('graph-stats').style.display  = 'flex';
    document.getElementById('graph-legend').style.display = 'flex';
    document.getElementById('graph-container').style.display = 'block';

  } catch(e) {
    document.getElementById('loading-card').style.display = 'none';
    document.getElementById('error-card').style.display   = 'flex';
    document.getElementById('error-text').textContent = 'Could not load graph. Is the server running?';
  }
}

function renderStats() {
  const copiedIds = new Set(allEdges.map(e => e.to));
  const originals = allNodes.filter(n => !copiedIds.has(n.id)).length;
  const copies    = copiedIds.size;

  document.getElementById('gs-total').textContent     = allNodes.length;
  document.getElementById('gs-originals').textContent = originals;
  document.getElementById('gs-copies').textContent    = copies;
  document.getElementById('gs-edges').textContent     = allEdges.length;
}

function renderGraph() {
  const copiedIds = new Set(allEdges.map(e => e.to));

  // Build vis nodes
  const nodes = allNodes.map(n => {
    const isCopy  = copiedIds.has(n.id);
    const label   = cleanLabel(n.label);
    const owner   = extractOwner(n.label);

    return {
      id:    n.id,
      label: label.length > 18 ? label.substring(0, 18) + '…' : label,
      title: `${label}\nOwner: ${owner}\nType: ${isCopy ? 'Copy' : 'Original'}`,
      color: {
        background: isCopy ? 'rgba(247,95,95,0.15)'  : 'rgba(46,204,138,0.15)',
        border:     isCopy ? '#f75f5f'                : '#2ecc8a',
        highlight: {
          background: isCopy ? 'rgba(247,95,95,0.3)' : 'rgba(46,204,138,0.3)',
          border:     isCopy ? '#f75f5f'              : '#2ecc8a',
        }
      },
      font: {
        color: isCopy ? '#f75f5f' : '#2ecc8a',
        size: 11,
        face: 'DM Sans',
      },
      shape: isCopy ? 'box' : 'ellipse',
      size: isCopy ? 18 : 22,
      borderWidth: 1.5,
      shadow: {
        enabled: true,
        color: isCopy ? 'rgba(247,95,95,0.2)' : 'rgba(46,204,138,0.2)',
        size: 8,
      },
      // Store full data for detail panel
      _fullLabel: cleanLabel(n.label),
      _owner: owner,
      _isCopy: isCopy,
      _originalId: n.id,
    };
  });

  // Build vis edges
  const edges = allEdges.map(e => ({
    from: e.from,
    to:   e.to,
    arrows: { to: { enabled: true, scaleFactor: 0.7 } },
    color: { color: '#4f8ef7', opacity: 0.6 },
    width: 1.5,
    smooth: { type: 'curvedCW', roundness: 0.2 },
    dashes: true,
  }));

  const container = document.getElementById('graph-canvas');

  graphNodes = new vis.DataSet(nodes);
  graphEdges = new vis.DataSet(edges);

  const options = {
    nodes: { margin: 10 },
    edges: { selectionWidth: 2 },
    physics: {
      enabled: true,
      stabilization: { iterations: 150 },
      barnesHut: {
        gravitationalConstant: -3000,
        springLength: 160,
        springConstant: 0.04,
      }
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      zoomView: true,
      dragView: true,
    },
    layout: { randomSeed: 42 },
  };

  network = new vis.Network(container, { nodes: graphNodes, edges: graphEdges }, options);

  // Click node → show detail panel
  network.on('click', params => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      const node   = graphNodes.get(nodeId);
      showDetail(node);
    } else {
      closeDetail();
    }
  });

  // After stabilization stop physics
  network.once('stabilizationIterationsDone', () => {
    network.setOptions({ physics: false });
  });
}

function showDetail(node) {
  if (!node) return;
  const panel = document.getElementById('node-detail');
  const body  = document.getElementById('node-detail-body');

  // Find parent if copy
  const parentEdge = allEdges.find(e => e.to === node._originalId);
  const parentNode = parentEdge ? allNodes.find(n => n.id === parentEdge.from) : null;
  const parentLabel = parentNode ? cleanLabel(parentNode.label) : null;

  body.innerHTML = `
    <div class="detail-row">
      <span class="detail-key">Filename</span>
      <span class="detail-val">${node._fullLabel}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Owner</span>
      <span class="detail-val">${node._owner}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Type</span>
      <span class="detail-val" style="color:${node._isCopy ? 'var(--danger)' : 'var(--success)'};">
        ${node._isCopy ? '📋 Copy / Derived' : '📁 Original Asset'}
      </span>
    </div>
    ${parentLabel ? `
    <div class="detail-row">
      <span class="detail-key">Copied From</span>
      <span class="detail-val" style="color:var(--warn);">${parentLabel}</span>
    </div>` : ''}
  `;

  panel.style.display = 'block';
}

function closeDetail() {
  const panel = document.getElementById('node-detail');
  if (panel) panel.style.display = 'none';
}