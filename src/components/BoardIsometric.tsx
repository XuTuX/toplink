'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PlacedCell, Coord, Player } from '@/lib/rules';
import { RotateCw, RotateCcw } from 'lucide-react';

interface BoardIsometricProps {
  board: PlacedCell[];
  players: Player[];
  previewCells?: Coord[];
  isPreviewValid?: boolean;
  onCellClick?: (x: number, y: number) => void;
  hoveredCell?: { x: number; y: number } | null;
  onCellHover?: (x: number, y: number | null) => void;
  previewColor?: string;
  predictedCells?: { x: number; y: number; z: number; color: string }[];
  highlightedCube?: { x: number; y: number; z: number } | null;
  isHistoryPreview?: boolean;
  effectEvent?: { id: string; type: 'stopped' | 'disappear'; cells: Coord[]; color: string } | null;
}

const CUBE_LOCAL_VERTICES = [
  { x: -0.5, y: -0.5, z: 0 }, // 0: Bottom-Left
  { x: 0.5, y: -0.5, z: 0 },  // 1: Bottom-Right
  { x: 0.5, y: 0.5, z: 0 },   // 2: Bottom Bottom-Right
  { x: -0.5, y: 0.5, z: 0 },  // 3: Bottom Bottom-Left
  { x: -0.5, y: -0.5, z: 1 }, // 4: Top Top-Left
  { x: 0.5, y: -0.5, z: 1 },  // 5: Top Top-Right
  { x: 0.5, y: 0.5, z: 1 },   // 6: Top Bottom-Right
  { x: -0.5, y: 0.5, z: 1 },  // 7: Top Bottom-Left
];

const FACES = [
  { id: 'top', indices: [4, 7, 6, 5] },
  { id: 'front-left', indices: [2, 6, 7, 3] }, // +Y
  { id: 'front-right', indices: [1, 5, 6, 2] }, // +X
  { id: 'back-right', indices: [0, 4, 5, 1] }, // -Y
  { id: 'back-left', indices: [3, 7, 4, 0] }, // -X
];

export default function BoardIsometric({
  board,
  players,
  previewCells = [],
  isPreviewValid = true,
  onCellClick,
  hoveredCell = null,
  onCellHover,
  previewColor,
  predictedCells = [],
  highlightedCube = null,
  isHistoryPreview = false,
  effectEvent = null,
}: BoardIsometricProps) {
  const [localHoveredCell, setLocalHoveredCell] = useState<{ x: number; y: number } | null>(null);

  // View rotation angle in radians
  const [theta, setTheta] = useState(0);
  const [targetTheta, setTargetTheta] = useState(0);

  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  const [newCubeKeys, setNewCubeKeys] = useState<Set<string>>(new Set());
  const renderedCubeKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentKeys = new Set(board.map(c => `${c.x}-${c.y}-${c.z}-placed-${getPlayerColor(c.playerId)}`));
    const newlyAdded = new Set([...currentKeys].filter(x => !renderedCubeKeys.current.has(x)));
    
    if (newlyAdded.size > 0 && renderedCubeKeys.current.size > 0) {
      setNewCubeKeys(newlyAdded);
      setTimeout(() => {
        setNewCubeKeys(new Set());
      }, 600);
    }
    renderedCubeKeys.current = currentKeys;
  }, [board, players]);

  // Smooth rotation animation loop
  useEffect(() => {
    if (Math.abs(targetTheta - theta) < 0.001) {
      return;
    }
    let animId: number;
    const update = () => {
      setTheta((prev) => {
        const diff = targetTheta - prev;
        if (Math.abs(diff) < 0.005) return targetTheta;
        return prev + diff * 0.15; // lerp
      });
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [targetTheta, theta]);

  const handleDragStart = (clientX: number) => {
    setIsMouseDown(true);
    setDragStartX(clientX);
    setHasDragged(false);
  };

  const handleDragMove = (clientX: number) => {
    if (!isMouseDown) return;
    const deltaX = clientX - dragStartX;
    if (Math.abs(deltaX) > 5) setHasDragged(true);

    const sensitivity = 0.007;
    const newTheta = theta + deltaX * sensitivity;
    setTheta(newTheta);
    setTargetTheta(newTheta);
    setDragStartX(clientX);
  };

  const handleDragEnd = () => {
    setIsMouseDown(false);
    if (hasDragged) {
      // Snap to nearest 45 degrees (8 directions)
      const snapped = Math.round(theta / (Math.PI / 4)) * (Math.PI / 4);
      setTargetTheta(snapped);
    }
  };

  const handleContainerClickCapture = (e: React.MouseEvent) => {
    if (hasDragged) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const L = 28; // Side length
  const halfW = L * Math.sqrt(3) / 2;
  const halfH = L / 2;
  const centerX = 280;
  const centerY = 420;

  const currentHoveredCell = hoveredCell !== null ? hoveredCell : localHoveredCell;

  const handleMouseEnter = (x: number, y: number) => {
    if (onCellHover) onCellHover(x, y);
    setLocalHoveredCell({ x, y });
  };

  const handleMouseLeave = (x: number) => {
    if (onCellHover) onCellHover(x, null);
    setLocalHoveredCell(null);
  };

  const getPlayerColor = (playerId: string) => players.find((p) => p.id === playerId)?.color || '#52525b';

  // --- 3D Projection Engine ---
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);

  // 1. Project local vertices of a unit cube
  const localProjectedVertices = CUBE_LOCAL_VERTICES.map(v => {
    const lx_rot = v.x * cosT - v.y * sinT;
    const ly_rot = v.x * sinT + v.y * cosT;
    return {
      sx: (lx_rot - ly_rot) * halfW,
      sy: (lx_rot + ly_rot) * halfH - v.z * L
    };
  });

  // 2. Determine visible faces using 2D cross product
  const visibleFaces = FACES.filter(face => {
    const pts = face.indices.map(idx => localProjectedVertices[idx]);
    const cross = (pts[1].sx - pts[0].sx) * (pts[2].sy - pts[1].sy) - (pts[1].sy - pts[0].sy) * (pts[2].sx - pts[1].sx);
    return cross < -0.01;
  });

  const topFaceDef = visibleFaces.find(f => f.id === 'top');
  const sideFacesDef = visibleFaces.filter(f => f.id !== 'top');
  
  // Sort side faces from left to right on screen
  sideFacesDef.sort((a, b) => {
    const centerA = a.indices.reduce((sum, idx) => sum + localProjectedVertices[idx].sx, 0);
    const centerB = b.indices.reduce((sum, idx) => sum + localProjectedVertices[idx].sx, 0);
    return centerA - centerB;
  });

  // 3. Shading helpers
  const getTopFaceStyle = (baseColor: string, isPreview?: boolean, isHovered?: boolean, isHighlighted?: boolean, isHistoryPreview?: boolean) => ({
    fill: baseColor,
    filter: isHovered || isHighlighted ? 'brightness(1.3)' : isHistoryPreview && isPreview ? 'brightness(1.25)' : 'brightness(1.15)',
    stroke: isPreview ? (isHistoryPreview ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.4)') : isHighlighted ? '#fde047' : isHovered ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
    strokeWidth: isPreview ? (isHistoryPreview ? 2.5 : 1.5) : isHovered || isHighlighted ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });
  const getLeftFaceStyle = (baseColor: string, isPreview?: boolean, isHovered?: boolean, isHighlighted?: boolean, isHistoryPreview?: boolean) => ({
    fill: baseColor,
    filter: isHovered || isHighlighted ? 'brightness(0.9)' : isHistoryPreview && isPreview ? 'brightness(0.85)' : 'brightness(0.75)',
    stroke: isPreview ? (isHistoryPreview ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.4)') : isHighlighted ? '#fde047' : isHovered ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
    strokeWidth: isPreview ? (isHistoryPreview ? 2.5 : 1.5) : isHovered || isHighlighted ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });
  const getRightFaceStyle = (baseColor: string, isPreview?: boolean, isHovered?: boolean, isHighlighted?: boolean, isHistoryPreview?: boolean) => ({
    fill: baseColor,
    filter: isHovered || isHighlighted ? 'brightness(1.05)' : isHistoryPreview && isPreview ? 'brightness(1.0)' : 'brightness(0.9)',
    stroke: isPreview ? (isHistoryPreview ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.4)') : isHighlighted ? '#fde047' : isHovered ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
    strokeWidth: isPreview ? (isHistoryPreview ? 2.5 : 1.5) : isHovered || isHighlighted ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });

  const getGridTopFaceStyle = (isHovered?: boolean) => ({
    fill: isHovered ? '#eef2ff' : '#f8fafc',
    stroke: isHovered ? '#6366f1' : '#d1d5db',
    strokeWidth: isHovered ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });
  const getGridLeftFaceStyle = (isHovered?: boolean) => ({
    fill: isHovered ? '#dfe5f2' : '#e5e7eb',
    stroke: isHovered ? '#6366f1' : '#d1d5db',
    strokeWidth: isHovered ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });
  const getGridRightFaceStyle = (isHovered?: boolean) => ({
    fill: isHovered ? '#e8ebf4' : '#eef0f3',
    stroke: isHovered ? '#6366f1' : '#d1d5db',
    strokeWidth: isHovered ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });

  // 4. Generate SVG path strings
  const buildPath = (indices: number[]) => `M ` + indices.map(idx => `${localProjectedVertices[idx].sx} ${localProjectedVertices[idx].sy}`).join(' L ') + ' Z';

  const cubeFacePaths = topFaceDef ? [
    { d: buildPath(topFaceDef.indices), getStyle: getTopFaceStyle },
    ...sideFacesDef.map((face, index) => ({
      d: buildPath(face.indices),
      getStyle: index === 0 ? getLeftFaceStyle : getRightFaceStyle
    }))
  ] : [];

  const gridFacePaths = topFaceDef ? [
    { d: buildPath(topFaceDef.indices), getStyle: getGridTopFaceStyle },
  ] : [];

  // 5. Project world coordinates
  const projectCoord = (x: number, y: number, z: number) => {
    const dx = x - 2.5;
    const dy = y - 2.5;
    const rx = dx * cosT - dy * sinT;
    const ry = dx * sinT + dy * cosT;
    const cx = centerX + (rx - ry) * halfW;
    const cy = centerY + (rx + ry) * halfH - z * L;
    return { cx, cy, rx, ry };
  };

  // --- Prepare Render Lists ---
  const cubesToRender: {
    x: number; y: number; z: number;
    cx: number; cy: number; rx: number; ry: number;
    color: string;
    isPreview?: boolean;
    isPrediction?: boolean;
    isHighlighted?: boolean;
  }[] = [];

  board.forEach((c) => {
    const proj = projectCoord(c.x, c.y, c.z);
    const isHighlighted = highlightedCube?.x === c.x && highlightedCube?.y === c.y && highlightedCube?.z === c.z;
    cubesToRender.push({ x: c.x, y: c.y, z: c.z, color: getPlayerColor(c.playerId), isHighlighted, ...proj });
  });

  previewCells.forEach((c) => {
    const proj = projectCoord(c.x, c.y, c.z);
    cubesToRender.push({ x: c.x, y: c.y, z: c.z, color: previewColor || (isPreviewValid ? '#a1a1aa' : '#f43f5e'), isPreview: true, ...proj });
  });

  predictedCells.forEach((c) => {
    const proj = projectCoord(c.x, c.y, c.z);
    cubesToRender.push({ x: c.x, y: c.y, z: c.z, color: c.color, isPrediction: true, ...proj });
  });

  let stoppedEffectTarget: { cx: number, cy: number } | null = null;
  if (effectEvent) {
    if (effectEvent.type === 'disappear') {
      effectEvent.cells.forEach(c => {
        const proj = projectCoord(c.x, c.y, c.z);
        // use isPreview=true so it doesn't have drop-in animation, we will add disappear class
        cubesToRender.push({ x: c.x, y: c.y, z: c.z, color: effectEvent.color, isPreview: true, isDisappear: true, ...proj } as any);
      });
    } else if (effectEvent.type === 'stopped') {
      const avgX = effectEvent.cells.reduce((s, c) => s + c.x, 0) / effectEvent.cells.length;
      const avgY = effectEvent.cells.reduce((s, c) => s + c.y, 0) / effectEvent.cells.length;
      const maxZ = Math.max(...effectEvent.cells.map(c => c.z));
      stoppedEffectTarget = projectCoord(avgX, avgY, maxZ);
    }
  }

  cubesToRender.sort((a, b) => {
    // 1. Sort by horizontal plane depth (back to front)
    const planeA = a.rx + a.ry;
    const planeB = b.rx + b.ry;
    if (Math.abs(planeA - planeB) > 0.01) {
      return planeA - planeB;
    }
    // 2. Sort by height (bottom to top)
    if (a.z !== b.z) {
      return a.z - b.z;
    }
    // 3. Sort preview blocks to be drawn on top if at same position
    if (a.isPreview !== b.isPreview) {
      return a.isPreview ? 1 : -1;
    }
    return 0;
  });

  const gridCellsData: { x: number; y: number; cx: number; cy: number; rx: number; ry: number }[] = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      gridCellsData.push({ x, y, ...projectCoord(x, y, 0) });
    }
  }
  gridCellsData.sort((a, b) => (a.rx + a.ry) - (b.rx + b.ry));

  return (
    <div className="flex flex-col items-center select-none overflow-hidden py-4 w-full">
      <style>{`
        @keyframes dropInCube {
          0% {
            transform: translateY(-250px);
            opacity: 0.5;
          }
          60% {
            transform: translateY(15px);
            opacity: 1;
          }
          80% {
            transform: translateY(-5px);
          }
          100% {
            transform: translateY(0);
          }
        }
        .animate-drop-in-cube {
          animation: dropInCube 0.5s ease-out both;
        }
        @keyframes disappearCube {
          0% { transform: translateY(0); opacity: 0.8; }
          40% { transform: translateY(-10px) scale(1.05); opacity: 1; }
          100% { transform: translateY(10px) scale(0); opacity: 0; }
        }
        .animate-disappear-cube {
          animation: disappearCube 0.8s ease-in forwards;
          transform-origin: center;
          transform-box: fill-box;
        }
        @keyframes popupText {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          15% { transform: translateY(-15px) scale(1.2); opacity: 1; }
          80% { transform: translateY(-25px) scale(1); opacity: 1; }
          100% { transform: translateY(-35px) scale(0.8); opacity: 0; }
        }
        .animate-popup-text {
          animation: popupText 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
      <div 
        className="relative flex items-center justify-center max-w-full select-none cursor-grab active:cursor-grabbing border border-zinc-800/40 rounded-[28px] overflow-hidden"
        style={{ width: '560px', aspectRatio: '560/650' }}
        onMouseDown={(e) => handleDragStart(e.clientX)}
        onMouseMove={(e) => handleDragMove(e.clientX)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={(e) => { if (e.touches.length > 0) handleDragStart(e.touches[0].clientX); }}
        onTouchMove={(e) => { if (e.touches.length > 0) handleDragMove(e.touches[0].clientX); }}
        onTouchEnd={handleDragEnd}
        onClickCapture={handleContainerClickCapture}
      >
        {/* Control Buttons */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setTargetTheta((prev) => prev - Math.PI / 2);
            }}
            className="w-8 h-8 bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center shadow-sm transition-colors hover:bg-zinc-900"
            title="Rotate View Left"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setTargetTheta((prev) => prev + Math.PI / 2);
            }}
            className="w-8 h-8 bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center shadow-sm transition-colors hover:bg-zinc-900"
            title="Rotate View Right"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <svg viewBox="0 0 560 650" width="100%" height="100%" className="select-none drop-shadow-sm">
          <g>
            {gridCellsData.map((cell) => {
              const isHovered = currentHoveredCell?.x === cell.x && currentHoveredCell?.y === cell.y;
              return (
                <g
                  key={`cell-${cell.x}-${cell.y}`}
                  className="cursor-pointer"
                  onClick={() => onCellClick?.(cell.x, cell.y)}
                  onMouseEnter={() => handleMouseEnter(cell.x, cell.y)}
                  onMouseLeave={() => handleMouseLeave(cell.x)}
                  style={{ transform: `translate(${cell.cx}px, ${cell.cy}px)`, transition: 'none' }}
                >
                  {gridFacePaths.map((face, i) => (
                    <path key={i} d={face.d} style={{ ...face.getStyle(isHovered), transition: 'fill 0.15s, stroke 0.15s' }} />
                  ))}
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    className="text-[11px] font-mono fill-zinc-500 pointer-events-none select-none font-semibold tracking-wider"
                  >
                    {String.fromCharCode(97 + cell.x)}{cell.y + 1}
                  </text>
                </g>
              );
            })}
          </g>
          <g>
            {cubesToRender.map((cube) => {
              const isHovered = currentHoveredCell?.x === cube.x && currentHoveredCell?.y === cube.y;
              const isDisappear = (cube as any).isDisappear;
              const typeStr = isDisappear ? 'disappear' : cube.isPreview ? 'preview' : cube.isPrediction ? 'predict' : 'placed';
              const key = isDisappear ? `${cube.x}-${cube.y}-${cube.z}-disappear-${effectEvent?.id}` : `${cube.x}-${cube.y}-${cube.z}-${typeStr}-${cube.color}`;

              const isNew = newCubeKeys.has(key);

              let opacity = 1.0;
              if (cube.isPreview) {
                opacity = 1.0;
              } else if (cube.isPrediction) {
                opacity = isHistoryPreview ? 0.15 : 0.4;
              } else {
                opacity = isHistoryPreview ? 0.35 : 1.0;
              }

              return (
                <g
                  key={key}
                  style={{
                    transform: `translate(${cube.cx}px, ${cube.cy}px)`,
                    opacity,
                    transition: 'opacity 0.3s ease, transform 0s'
                  }}
                  className={cube.isPreview || isDisappear ? 'pointer-events-none' : cube.isPrediction ? 'pointer-events-none' : 'cursor-pointer pointer-events-auto'}
                  onClick={cube.isPreview || cube.isPrediction || isDisappear ? undefined : () => onCellClick?.(cube.x, cube.y)}
                  onMouseEnter={cube.isPreview || cube.isPrediction || isDisappear ? undefined : () => handleMouseEnter(cube.x, cube.y)}
                  onMouseLeave={cube.isPreview || cube.isPrediction || isDisappear ? undefined : () => handleMouseLeave(cube.x)}
                >
                  <g className={isDisappear ? 'animate-disappear-cube' : cube.isPreview || cube.isPrediction ? '' : (isNew ? 'animate-drop-in-cube' : '')}>
                    {/* 2. Cube Faces */}
                    {cubeFacePaths.map((face, faceIdx) => (
                      <path
                        key={faceIdx}
                        d={face.d}
                        {...face.getStyle(cube.color, cube.isPreview, isHovered, cube.isHighlighted, isHistoryPreview)}
                        className="transition-all duration-300 pointer-events-none"
                      />
                    ))}
                  </g>
                </g>
              );
            })}
          </g>
          {stoppedEffectTarget && (
            <g style={{ transform: `translate(${stoppedEffectTarget.cx}px, ${stoppedEffectTarget.cy - 10}px)` }} key={`stopped-${effectEvent?.id}`}>
              <text className="animate-popup-text fill-rose-400 font-black text-sm pointer-events-none select-none text-center" textAnchor="middle" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
                💥 충돌!
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="mt-3 text-[10px] text-zinc-500 font-bold bg-zinc-950/80 border border-zinc-850 px-3 py-1 rounded-full select-none tracking-wide shadow-sm">
        드래그 또는 버튼으로 보드 회전
      </div>

      <div className="flex items-center gap-6 mt-3 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-zinc-900 border border-zinc-800 rounded shadow-sm" />
          <span>Base Grid</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div 
            className="w-3 h-3 rounded border border-white/20" 
            style={{ backgroundColor: previewColor || '#a1a1aa', opacity: 0.6 }}
          />
          <span>Placement Preview</span>
        </div>
      </div>
    </div>
  );
}
