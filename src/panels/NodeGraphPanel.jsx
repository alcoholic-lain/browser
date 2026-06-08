import { useRef, useState, useCallback, useEffect } from 'react'

// ── Layout: Force-directed graph simulation ──────────────────────────────────
function forceDirectedLayout(nodes, iterations = 100) {
  if (nodes.length === 0) return []

  // Initialize positions randomly in a circle
  const positioned = nodes.map(n => ({
    ...n,
    x: 150 + 120 * Math.cos((n.id * 2 * Math.PI) / Math.max(nodes.length, 1)),
    y: 150 + 120 * Math.sin((n.id * 2 * Math.PI) / Math.max(nodes.length, 1)),
    vx: 0,
    vy: 0,
  }))

  const posMap = Object.fromEntries(positioned.map(n => [n.id, n]))

  // Build adjacency
  const edges = nodes
    .filter(n => n.parentId != null)
    .map(n => [n.parentId, n.id])
    .filter(([p, c]) => posMap[p])

  // Simulation iterations
  for (let iter = 0; iter < iterations; iter++) {
    const damping = 0.9

    // Clear velocities
    positioned.forEach(n => { n.vx = 0; n.vy = 0 })

    // Repulsive forces (all nodes push away from each other)
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i]
        const b = positioned[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const repel = 5000 / (dist * dist)
        const fx = (dx / dist) * repel
        const fy = (dy / dist) * repel
        a.vx -= fx
        a.vy -= fy
        b.vx += fx
        b.vy += fy
      }
    }

    // Attractive forces (connected nodes pull toward each other)
    edges.forEach(([parentId, childId]) => {
      const parent = posMap[parentId]
      const child = posMap[childId]
      if (!parent || !child) return
      const dx = child.x - parent.x
      const dy = child.y - parent.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const targetDist = 120
      const attract = (dist - targetDist) * 0.1
      const fx = (dx / dist) * attract
      const fy = (dy / dist) * attract
      child.vx -= fx
      child.vy -= fy
      parent.vx += fx
      parent.vy += fy
    })

    // Update positions
    positioned.forEach(n => {
      n.vx *= damping
      n.vy *= damping
      n.x += n.vx
      n.y += n.vy
    })
  }

  return positioned.map(n => ({ id: n.id, title: n.title, url: n.url, tabId: n.tabId, parentId: n.parentId, x: n.x, y: n.y }))
}

function shortHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url.slice(0, 20) }
}

// ── Component ──────────────────────────────────────────────────────────────
// Props:
//   nodes      – array of nav nodes, managed in App.jsx
//   onClear    – callback to clear all nodes
//   tabs       – current tabs (for favicon / title sync)
//   activeTabId
//   onClose
export default function NodeGraphPanel({ nodes, onClear, tabs, activeTabId, onClose }) {
  const [tooltip, setTooltip] = useState(null)
  const svgRef = useRef(null)
  const [saveStatus, setSaveStatus] = useState(null) // 'saving' | 'ok' | 'err'

  // pan/zoom
  const [transform, setTransform] = useState({ x: 20, y: 20, scale: 1 })
  const dragging = useRef(null)

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    dragging.current = { startX: e.clientX - transform.x, startY: e.clientY - transform.y }
    e.currentTarget.style.cursor = 'grabbing'
  }, [transform])

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return
    setTransform(t => ({
      ...t,
      x: e.clientX - dragging.current.startX,
      y: e.clientY - dragging.current.startY,
    }))
  }, [])

  const onMouseUp = useCallback((e) => {
    dragging.current = null
    e.currentTarget.style.cursor = 'grab'
  }, [])

  const onWheel = useCallback((e) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    setTransform(t => {
      const rect = svgRef.current.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const newScale = Math.min(4, Math.max(0.2, t.scale * factor))
      return {
        x: px - (px - t.x) * (newScale / t.scale),
        y: py - (py - t.y) * (newScale / t.scale),
        scale: newScale,
      }
    })
  }, [])

  async function handleSave() {
    if (!window.electron?.saveTree) return
    setSaveStatus('saving')
    try {
      const result = await window.electron.saveTree(nodes)
      setSaveStatus(result?.ok ? 'ok' : 'err')
    } catch {
      setSaveStatus('err')
    }
    setTimeout(() => setSaveStatus(null), 2000)
  }

  function handleClear() {
    onClear()
    setTransform({ x: 20, y: 20, scale: 1 })
  }

  const positioned = forceDirectedLayout(nodes)
  const nodeMap = Object.fromEntries(positioned.map(n => [n.id, n]))

  return (
    <div className="panel panel-wide">
      <div className="panel-header">
        <span>Navigation Tree ({nodes.length})</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className={`pill-btn${saveStatus === 'ok' ? ' accent' : saveStatus === 'err' ? ' danger' : ''}`}
            onClick={handleSave}
            disabled={nodes.length === 0 || saveStatus === 'saving'}
            title="Save tree as JSON"
          >
            {saveStatus === 'saving' ? '…' : saveStatus === 'ok' ? '✓ Saved' : saveStatus === 'err' ? '✗ Error' : '⬇ Save JSON'}
          </button>
          <button className="pill-btn" onClick={handleClear}>Clear</button>
          <button className="panel-close" onClick={onClose}>×</button>
        </div>
      </div>

      <div
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        {nodes.length === 0 && (
          <div className="graph-empty">Navigate somewhere to build your tree</div>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: tooltip.x + 14,
            top: tooltip.y - 10,
            background: '#1a1a24',
            border: '1px solid #2a2a38',
            borderRadius: 7,
            padding: '7px 10px',
            fontSize: 11,
            color: '#e2e2f0',
            zIndex: 100,
            maxWidth: 260,
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            fontFamily: 'JetBrains Mono, monospace',
            lineHeight: 1.6,
          }}>
            <div style={{
              fontWeight: 500,
              marginBottom: 3,
              color: '#aaaacc',
              fontFamily: 'DM Sans, sans-serif',
            }}>
              {tooltip.node.title !== tooltip.node.url
                ? tooltip.node.title
                : shortHost(tooltip.node.url)}
            </div>
            <div style={{ color: '#5b6af0', wordBreak: 'break-all' }}>
              {tooltip.node.url}
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ display: 'block', userSelect: 'none' }}
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
            {/* Edges */}
            {nodes.map(n => {
              if (n.parentId == null) return null
              const from = nodeMap[n.parentId]
              const to   = nodeMap[n.id]
              if (!from || !to) return null
              const mx = (from.x + to.x) / 2
              return (
                <path
                  key={`e-${n.id}`}
                  d={`M${from.x},${from.y} C${mx},${from.y} ${mx},${to.y} ${to.x},${to.y}`}
                  fill="none"
                  stroke="#2a2a38"
                  strokeWidth={1.5 / transform.scale}
                />
              )
            })}

            {/* Nodes */}
            {positioned.map(n => {
              const isActive = n.tabId === activeTabId
              const tab = tabs.find(t => t.id === n.tabId)
              const r = isActive ? 9 : 6

              return (
                <g
                  key={n.id}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => {
                    const rect = svgRef.current.getBoundingClientRect()
                    setTooltip({
                      x: n.x * transform.scale + transform.x - rect.left,
                      y: n.y * transform.scale + transform.y - rect.top,
                      node: n,
                    })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseDown={e => e.stopPropagation()}
                >
                  {isActive && (
                    <circle cx={n.x} cy={n.y} r={r + 5} fill="#5b6af0" fillOpacity={0.15} />
                  )}
                  <circle
                    cx={n.x} cy={n.y} r={r}
                    fill={isActive ? '#5b6af0' : '#1a1a24'}
                    stroke={isActive ? '#5b6af0' : '#3a3a52'}
                    strokeWidth={1.5 / transform.scale}
                  />
                  {tab?.favicon && (
                    <image
                      href={tab.favicon}
                      x={n.x + r + 5}
                      y={n.y - 7}
                      width={14}
                      height={14}
                    />
                  )}
                  <text
                    x={n.x + r + (tab?.favicon ? 22 : 7)}
                    y={n.y}
                    dominantBaseline="middle"
                    fill={isActive ? '#c8c8e8' : '#666680'}
                    fontSize={10}
                    fontFamily="DM Sans, sans-serif"
                  >
                    {shortHost(n.title !== n.url ? n.title : n.url)}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {nodes.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 10,
            right: 12,
            fontSize: 10,
            color: '#44445a',
            pointerEvents: 'none',
          }}>
            scroll to zoom · drag to pan
          </div>
        )}
      </div>
    </div>
  )
}
