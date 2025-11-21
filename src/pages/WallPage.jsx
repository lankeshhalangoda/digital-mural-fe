import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSubmissions } from '../api/client.js';

const POLL_INTERVAL_MS = 5000;
const categoryMeta = {
  challenge: {
    label: 'Challenge a harmful norm',
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)'
  },
  promote: {
    label: 'Promote a safe practice',
    color: '#A855F7',
    gradient: 'linear-gradient(135deg, #A855F7 0%, #D8B4FE 100%)'
  },
  share: {
    label: 'Share a positive message',
    color: '#22C55E',
    gradient: 'linear-gradient(135deg, #22C55E 0%, #4ADE80 100%)'
  }
};

const fallbackViewport = { width: 1920, height: 1080 };

function WallPage() {
  const [submissions, setSubmissions] = useState([]);
  const [highlightedTiles, setHighlightedTiles] = useState({});
  const [enteringTiles, setEnteringTiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewport, setViewport] = useState(() => {
    if (typeof window === 'undefined') return fallbackViewport;
    return { width: window.innerWidth, height: window.innerHeight };
  });
  const layoutMap = useRef({});
  const gridConfigRef = useRef({ columns: 6, rows: 4 });
  const highlightTimeouts = useRef({});
  const enteringTimeouts = useRef({});
  const lastSeenIds = useRef(new Set());
  const tileRefs = useRef({});

  const triggerHighlight = (id) => {
    if (highlightTimeouts.current[id]) clearTimeout(highlightTimeouts.current[id]);
    setHighlightedTiles((prev) => ({ ...prev, [id]: true }));
    highlightTimeouts.current[id] = setTimeout(() => {
      setHighlightedTiles((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    }, 1800);
  };

  const triggerEntryAnimation = (id) => {
    const duration = 6 + Math.random() * 1;
    const randomY = `${Math.random() * 200 - 100}px`;

    setEnteringTiles((prev) => ({
      ...prev,
      [id]: { duration, randomY, ready: false }
    }));

    if (enteringTimeouts.current[id]) clearTimeout(enteringTimeouts.current[id]);
    enteringTimeouts.current[id] = setTimeout(() => {
      setEnteringTiles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, (duration + 0.5) * 1000);
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadSubmissions = async () => {
      try {
        const { submissions: payload = [] } = await fetchSubmissions(controller.signal);
        const sorted = [...payload].sort(
          (a, b) => new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf()
        );
        setSubmissions(sorted);

        const nextIds = new Set(sorted.map((entry) => entry.id));
        sorted.forEach((entry) => {
          if (!lastSeenIds.current.has(entry.id)) {
            triggerHighlight(entry.id);
            triggerEntryAnimation(entry.id);
          }
        });
        lastSeenIds.current = nextIds;

        setLoading(false);
        setError('');
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err.message || 'Failed to load wall data.');
        setLoading(false);
      }
    };

    loadSubmissions();
    const interval = setInterval(loadSubmissions, POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(interval);
      Object.values(highlightTimeouts.current).forEach(clearTimeout);
      Object.values(enteringTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const pendingMeasurements = Object.values(enteringTiles).some((meta) => !meta.ready);
    if (!pendingMeasurements) return undefined;

    const raf = requestAnimationFrame(() => {
      setEnteringTiles((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.entries(prev).forEach(([id, meta]) => {
          if (meta.ready) return;
          const element = tileRefs.current[id];
          if (!element) return;

          const rect = element.getBoundingClientRect();
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          const tileCenterX = rect.left + rect.width / 2;
          const tileCenterY = rect.top + rect.height / 2;

          next[id] = {
            ...meta,
            centerShiftX: centerX - tileCenterX,
            centerShiftY: centerY - tileCenterY,
            ready: true
          };
          changed = true;
        });
        return changed ? next : prev;
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [enteringTiles]);

  const ensure80Chars = (text = '') => {
    const normalized = String(text ?? '');
    return normalized.slice(0, 80);
  };

  const tiles = useMemo(() => {
    const arranged = [...submissions];
    const tileCount = Math.max(arranged.length, 1);

    // Smart grid calculation based on count
    let columns, rows;
    if (tileCount === 1) {
      columns = 1;
      rows = 1;
    } else if (tileCount === 2) {
      columns = 1;
      rows = 2;
    } else if (tileCount === 3) {
      columns = 2;
      rows = 2; // 1 up spanning both, 2 down
    } else if (tileCount === 4) {
      columns = 2;
      rows = 2;
    } else {
      // For 5+, calculate optimal grid that fits all tiles
      const aspectRatio = viewport.width / Math.max(viewport.height, 1);
      // Start with a square-ish grid and adjust
      const baseCols = Math.ceil(Math.sqrt(tileCount * aspectRatio));
      columns = Math.max(2, Math.min(20, baseCols));
      rows = Math.ceil(tileCount / columns);
    }

    // Calculate scale based on tile count - more tiles = smaller cards
    // Scale gradually decreases from 1 card onwards
    const sizeScale = tileCount === 1
      ? 1.0
      : tileCount === 2
        ? 0.95
        : tileCount === 3
          ? 0.85
          : tileCount === 4
            ? 0.75
            : Math.max(0.3, Math.min(0.7, Math.sqrt(4 / tileCount)));

    if (
      gridConfigRef.current.columns !== columns ||
      gridConfigRef.current.rows !== rows
    ) {
      gridConfigRef.current = { columns, rows };
      layoutMap.current = {};
    }

    // Sequential placement for predictable layout
    const usedCells = new Set();
    arranged.forEach((submission, index) => {
      let cell = null;
      
      if (tileCount === 1) {
        cell = { key: '1-1', column: 1, row: 1 };
      } else if (tileCount === 2) {
        cell = { key: `1-${index + 1}`, column: 1, row: index + 1 };
      } else if (tileCount === 3) {
        if (index === 0) {
          cell = { key: '1-1', column: 1, row: 1 }; // First card spans both columns
          // Mark both columns in row 1 as used since it spans
          usedCells.add('1-1');
          usedCells.add('2-1');
        } else {
          cell = { key: `${index}-2`, column: index, row: 2 }; // Next two in row 2
        }
      } else if (tileCount === 4) {
        const col = (index % 2) + 1;
        const row = Math.floor(index / 2) + 1;
        cell = { key: `${col}-${row}`, column: col, row };
      } else {
        // For 5+, use sequential grid placement
        const col = (index % columns) + 1;
        const row = Math.floor(index / columns) + 1;
        cell = { key: `${col}-${row}`, column: col, row };
      }

      // Check if cell is already used, if so find next available
      const cellKey = `${cell.column}-${cell.row}`;
      if (usedCells.has(cellKey) && !(tileCount === 3 && index === 0)) {
        // Find next available cell
        for (let r = 1; r <= rows; r++) {
          for (let c = 1; c <= columns; c++) {
            const checkKey = `${c}-${r}`;
            if (!usedCells.has(checkKey)) {
              cell = { key: checkKey, column: c, row: r };
              break;
            }
          }
          if (!usedCells.has(`${cell.column}-${cell.row}`)) break;
        }
      }

      if (!(tileCount === 3 && index === 0)) {
        usedCells.add(`${cell.column}-${cell.row}`);
      }
      
      layoutMap.current[submission.id] = {
        orderValue: index,
        offsetX: '0px',
        offsetY: '0px',
        column: cell.column,
        row: cell.row,
        cellKey: cell.key
      };
    });

    arranged.sort(
      (a, b) => layoutMap.current[a.id].orderValue - layoutMap.current[b.id].orderValue
    );
    return {
      columns,
      rows,
      scale: sizeScale,
      tiles: arranged.map((submission) => ({
        ...submission,
        layout: layoutMap.current[submission.id]
      }))
    };
  }, [submissions, viewport.height, viewport.width]);

  const renderOverlayMessage = () => {
    if (loading) return 'Booting up the mosaic...';
    if (error) return error;
    if (!submissions.length) return 'No tiles yet — submissions will appear live here.';
    return '';
  };

  const overlayMessage = renderOverlayMessage();

  const wallColumns = tiles.columns;
  const tileList = tiles.tiles;
  const densityScale = tiles.scale ?? 1;
  const hasEnteringTiles = Object.keys(enteringTiles).length > 0;

  const getTileRef = (id) => (node) => {
    if (node) {
      tileRefs.current[id] = node;
    } else {
      delete tileRefs.current[id];
    }
  };

  return (
    <section className={`wall-stage${hasEnteringTiles ? ' wall-stage--dimmed' : ''}`}>
      <div className="wall-backdrop" />
      <div className="wall-gradient-1" />
      <div className="wall-gradient-2" />

      {!!overlayMessage && submissions.length === 0 && (
        <div className="wall-overlay">{overlayMessage}</div>
      )}

      <div
        className="immersive-grid"
        aria-live="polite"
        style={{
          '--wall-columns': wallColumns,
          '--wall-rows': tiles.rows,
          '--tile-size-scale': densityScale,
          '--tile-font-scale': densityScale
        }}
      >
        {tileList.map((tile) => {
          const meta = categoryMeta[tile.category] || { label: tile.category, color: tile.color };
          const isHighlighted = highlightedTiles[tile.id];
          const entryMeta = enteringTiles[tile.id];
          const isEntering = Boolean(entryMeta && entryMeta.ready);
          const orderIndex = tile.layout.orderValue ?? 0;
          const isSingleTile = tileList.length === 1;
          const isThreeTileLayout = tileList.length === 3;
          const gridColumnValue =
            isSingleTile || (isThreeTileLayout && orderIndex === 0)
              ? '1 / -1'
              : tile.layout.column;
          const gridRowValue = isSingleTile ? '1 / -1' : tile.layout.row;
          const formattedMessage = ensure80Chars(tile.message || '');
          return (
            <article
              key={tile.id}
              ref={getTileRef(tile.id)}
              className={`wall-tile${isHighlighted ? ' wall-tile--glow' : ''}${
                isEntering ? ' wall-tile--entering' : ''
              }`}
              style={{
                '--tile-color': meta.color || '#ffffff',
                '--tile-gradient': meta.gradient || meta.color || '#ffffff',
                order: tile.layout.orderValue,
                gridColumn: gridColumnValue,
                gridRow: gridRowValue,
                '--spawn-x': tile.layout.offsetX,
                '--spawn-y': tile.layout.offsetY,
                '--enter-duration': entryMeta ? `${entryMeta.duration}s` : '0s',
                '--enter-random-y': entryMeta ? entryMeta.randomY : '0px',
                '--enter-center-shift-x':
                  entryMeta && entryMeta.centerShiftX !== undefined
                    ? `${entryMeta.centerShiftX}px`
                    : '0px',
                '--enter-center-shift-y':
                  entryMeta && entryMeta.centerShiftY !== undefined
                    ? `${entryMeta.centerShiftY}px`
                    : '0px',
                opacity: entryMeta && !isEntering ? 0 : undefined
              }}
            >
              <p className="tile-message">{formattedMessage}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default WallPage;

