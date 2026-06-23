'use client';

import React, { useState, useEffect } from 'react';
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
}: BoardIsometricProps) {
  const [localHoveredCell, setLocalHoveredCell] = useState<{ x: number; y: number } | null>(null);

  // View rotation angle in radians
  const [theta, setTheta] = useState(0);
  const [targetTheta, setTargetTheta] = useState(0);

  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  // Smooth rotation animation loop
  useEffect(() => {
    if (Math.abs(targetTheta - theta) < 0.001) {
      setTheta(targetTheta);
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
      // Snap to nearest 90 degrees
      const snapped = Math.round(theta / (Math.PI / 2)) * (Math.PI / 2);
      setTargetTheta(snapped);
    }
  };

  const handleContainerClickCapture = (e: React.MouseEvent) => {
    if (hasDragged) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const L = 30; // Side length
  const halfW = L * Math.sqrt(3) / 2;
  const halfH = L / 2;
  const centerX = 192;
  const centerY = 210;

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
  const getTopFaceStyle = (baseColor: string, isPreview?: boolean, isHovered?: boolean) => ({
    fill: baseColor,
    filter: isHovered ? 'brightness(1.3)' : 'brightness(1.15)',
    stroke: isPreview ? 'rgba(255, 255, 255, 0.4)' : isHovered ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
    strokeWidth: isPreview || isHovered ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });
  const getLeftFaceStyle = (baseColor: string, isPreview?: boolean, isHovered?: boolean) => ({
    fill: baseColor,
    filter: isHovered ? 'brightness(0.9)' : 'brightness(0.75)',
    stroke: isPreview ? 'rgba(255, 255, 255, 0.4)' : isHovered ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
    strokeWidth: isPreview || isHovered ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });
  const getRightFaceStyle = (baseColor: string, isPreview?: boolean, isHovered?: boolean) => ({
    fill: baseColor,
    filter: isHovered ? 'brightness(1.05)' : 'brightness(0.9)',
    stroke: isPreview ? 'rgba(255, 255, 255, 0.4)' : isHovered ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
    strokeWidth: isPreview || isHovered ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });

  const getGridTopFaceStyle = (isHovered?: boolean) => ({
    fill: isHovered ? '#2c2c35' : '#1e1e24',
    stroke: isHovered ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
    strokeWidth: isHovered ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });
  const getGridLeftFaceStyle = (isHovered?: boolean) => ({
    fill: isHovered ? '#16161a' : '#0c0c10',
    stroke: isHovered ? '#3b82f6' : 'rgba(255, 255, 255, 0.04)',
    strokeWidth: isHovered ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });
  const getGridRightFaceStyle = (isHovered?: boolean) => ({
    fill: isHovered ? '#1c1c20' : '#121216',
    stroke: isHovered ? '#3b82f6' : 'rgba(255, 255, 255, 0.04)',
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
    ...sideFacesDef.map((face, index) => ({
      d: buildPath(face.indices),
      getStyle: index === 0 ? getGridLeftFaceStyle : getGridRightFaceStyle
    }))
  ] : [];

  // 5. Project world coordinates
  const projectCoord = (x: number, y: number, z: number) => {
    const dx = x - 2;
    const dy = y - 2;
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
  }[] = [];

  board.forEach((c) => {
    const proj = projectCoord(c.x, c.y, c.z);
    cubesToRender.push({ x: c.x, y: c.y, z: c.z, color: getPlayerColor(c.playerId), ...proj });
  });

  previewCells.forEach((c) => {
    const proj = projectCoord(c.x, c.y, c.z);
    cubesToRender.push({ x: c.x, y: c.y, z: c.z, color: previewColor || (isPreviewValid ? '#a1a1aa' : '#f43f5e'), isPreview: true, ...proj });
  });

  predictedCells.forEach((c) => {
    const proj = projectCoord(c.x, c.y, c.z);
    cubesToRender.push({ x: c.x, y: c.y, z: c.z, color: c.color, isPrediction: true, ...proj });
  });

  cubesToRender.sort((a, b) => {
    const depthA = a.rx + a.ry + a.z;
    const depthB = b.rx + b.ry + b.z;
    if (Math.abs(depthA - depthB) > 0.01) return depthA - depthB;
    if (a.z !== b.z) return b.z - a.z;
    return a.rx - b.rx;
  });

  const gridCellsData: { x: number; y: number; cx: number; cy: number; rx: number; ry: number }[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      gridCellsData.push({ x, y, ...projectCoord(x, y, -1) });
    }
  }
  gridCellsData.sort((a, b) => (a.rx + a.ry) - (b.rx + b.ry));

  return (
    <div className="flex flex-col items-center select-none overflow-hidden py-4 w-full">
      <div 
        className="relative flex items-center justify-center max-w-full select-none cursor-grab active:cursor-grabbing border border-zinc-800/40 rounded-[28px] overflow-hidden"
        style={{ width: '384px', aspectRatio: '384/390' }}
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
            className="w-8 h-8 bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center shadow-lg transition-all hover:bg-zinc-900 active:scale-95 cursor-pointer"
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
            className="w-8 h-8 bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center shadow-lg transition-all hover:bg-zinc-900 active:scale-95 cursor-pointer"
            title="Rotate View Right"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <svg viewBox="0 0 384 390" width="100%" height="100%" className="overflow-visible select-none drop-shadow-2xl">
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
                    y={-L + 3}
                    textAnchor="middle"
                    className="text-[9px] font-mono fill-zinc-400 opacity-60 pointer-events-none select-none"
                  >
                    {cell.x},{cell.y}
                  </text>
                </g>
              );
            })}
          </g>
          <g>
            {cubesToRender.map((cube) => {
              const isHovered = currentHoveredCell?.x === cube.x && currentHoveredCell?.y === cube.y;
              const typeStr = cube.isPreview ? 'preview' : cube.isPrediction ? 'predict' : 'placed';
              const key = `${cube.x}-${cube.y}-${cube.z}-${typeStr}-${cube.color}`;

              return (
                <g
                  key={key}
                  style={{
                    transform: `translate(${cube.cx}px, ${cube.cy}px)`,
                    opacity: cube.isPreview ? 0.75 : cube.isPrediction ? 0.4 : 1,
                    transition: 'none'
                  }}
                  className={cube.isPreview ? 'pointer-events-none animate-pulse' : cube.isPrediction ? 'pointer-events-none' : 'cursor-pointer pointer-events-auto'}
                  onClick={cube.isPreview || cube.isPrediction ? undefined : () => onCellClick?.(cube.x, cube.y)}
                  onMouseEnter={cube.isPreview || cube.isPrediction ? undefined : () => handleMouseEnter(cube.x, cube.y)}
                  onMouseLeave={cube.isPreview || cube.isPrediction ? undefined : () => handleMouseLeave(cube.x)}
                >
                  {cubeFacePaths.map((face, i) => (
                    <path key={i} d={face.d} style={{ ...face.getStyle(cube.color, cube.isPreview, isHovered), transition: 'fill 0.15s, filter 0.15s, stroke 0.15s' }} />
                  ))}
                </g>
              );
            })}
          </g>
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
        <div className="flex items-center gap-1.5 animate-pulse">
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
