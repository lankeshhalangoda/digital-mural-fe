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

    // Dynamic grid system: base 6×4 (24 cards), then expand
    // 1-24 cards: 6×4 grid
    // 25-35 cards: 7×5 grid
    // 36-48 cards: 8×6 grid
    // 49-63 cards: 9×7 grid
    // Pattern: baseCols=6, baseRows=4, increment both by 1 each expansion
    
    const baseCols = 6;
    const baseRows = 4;
    const baseCapacity = baseCols * baseRows; // 24
    
    let gridLevel = 0;
    let currentCapacity = baseCapacity;
    
    // Find which grid level we need
    while (tileCount > currentCapacity && gridLevel < 20) {
      gridLevel++;
      currentCapacity = (baseCols + gridLevel) * (baseRows + gridLevel);
    }
    
    const columns = baseCols + gridLevel;
    const rows = baseRows + gridLevel;
    
    // Calculate scale: base scale is 1.0 for first grid (6×4)
    // Each grid level reduces scale proportionally
    // Scale = baseCols / currentCols (maintains aspect ratio)
    const sizeScale = baseCols / columns;

    // Check if grid dimensions changed - if so, reshuffle all cards
    const gridChanged = 
      gridConfigRef.current.columns !== columns ||
      gridConfigRef.current.rows !== rows;

    // Clean up removed cards from layoutMap
    const currentIds = new Set(arranged.map(s => s.id));
    Object.keys(layoutMap.current).forEach(id => {
      if (!currentIds.has(id)) {
        delete layoutMap.current[id];
      }
    });

    if (gridChanged) {
      gridConfigRef.current = { columns, rows };
      layoutMap.current = {};
    }

    // Generate all possible grid positions
    const allPositions = [];
    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= columns; col++) {
        allPositions.push({ col, row });
      }
    }

    // Shuffle positions using Fisher-Yates algorithm
    const shuffleArray = (array) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // If grid changed or layout is empty, reshuffle all cards
    if (gridChanged || Object.keys(layoutMap.current).length === 0) {
      const shuffledPositions = shuffleArray(allPositions);
      
      // Assign random positions to cards (allowing gaps)
      arranged.forEach((submission, index) => {
        const position = shuffledPositions[index % shuffledPositions.length];
        const cellKey = `${position.col}-${position.row}`;
        
        layoutMap.current[submission.id] = {
          orderValue: index,
          offsetX: '0px',
          offsetY: '0px',
          column: position.col,
          row: position.row,
          cellKey: cellKey
        };
      });
    } else {
      // For new cards, assign random available positions
      const usedPositions = new Set(
        Object.values(layoutMap.current).map(layout => layout.cellKey)
      );
      const availablePositions = allPositions.filter(
        pos => !usedPositions.has(`${pos.col}-${pos.row}`)
      );
      const shuffledAvailable = shuffleArray(availablePositions);
      
      arranged.forEach((submission, index) => {
        if (!layoutMap.current[submission.id]) {
          // New card - assign random available position
          const position = shuffledAvailable.length > 0
            ? shuffledAvailable.pop()
            : allPositions[Math.floor(Math.random() * allPositions.length)];
          const cellKey = `${position.col}-${position.row}`;
          
          layoutMap.current[submission.id] = {
            orderValue: Object.keys(layoutMap.current).length,
            offsetX: '0px',
            offsetY: '0px',
            column: position.col,
            row: position.row,
            cellKey: cellKey
          };
        } else {
          // Update order value for existing cards
          layoutMap.current[submission.id].orderValue = index;
        }
      });
    }

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
          const gridColumnValue = tile.layout.column;
          const gridRowValue = tile.layout.row;
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
              {isEntering && (
                <>
                  <div className="stardust-particle" />
                  <div className="stardust-particle" />
                  <div className="stardust-particle" />
                  <div className="stardust-particle" />
                  <div className="stardust-particle" />
                </>
              )}
              <p className="tile-message">{formattedMessage}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default WallPage;

