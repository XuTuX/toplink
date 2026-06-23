'use client';

import React, { useState } from 'react';
import { PlacedCell, Coord, Player } from '@/lib/rules';

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
  // Local hover state in case parent doesn't provide it
  const [localHoveredCell, setLocalHoveredCell] = useState<{ x: number; y: number } | null>(null);

  const L = 30; // Side length of the regular hexagon
  const halfW = L * Math.sqrt(3) / 2; // ~25.98px
  const halfH = L / 2; // 15px

  const centerX = 192;
  const centerY = 210;

  // Use props if provided, otherwise fallback to local state
  const currentHoveredCell = hoveredCell !== null ? hoveredCell : localHoveredCell;

  const handleMouseEnter = (x: number, y: number) => {
    if (onCellHover) {
      onCellHover(x, y);
    }
    setLocalHoveredCell({ x, y });
  };

  const handleMouseLeave = (x: number) => {
    if (onCellHover) {
      onCellHover(x, null);
    }
    setLocalHoveredCell(null);
  };

  // Find player color helper
  const getPlayerColor = (playerId: string) => {
    return players.find((p) => p.id === playerId)?.color || '#52525b';
  };

  // Group all placed cells and preview cells to render them in correct order.
  // We sort them back-to-front (Z ascending, X ascending, Y ascending).
  const cubesToRender: {
    x: number;
    y: number;
    z: number;
    color: string;
    isPreview?: boolean;
    isPrediction?: boolean;
  }[] = [];

  // 1. Add board cells
  board.forEach((c) => {
    cubesToRender.push({
      x: c.x,
      y: c.y,
      z: c.z,
      color: getPlayerColor(c.playerId),
    });
  });

  // 2. Add preview cells
  previewCells.forEach((c) => {
    cubesToRender.push({
      x: c.x,
      y: c.y,
      z: c.z,
      color: previewColor || (isPreviewValid ? '#a1a1aa' : '#f43f5e'),
      isPreview: true,
    });
  });

  // 3. Add predicted cells
  predictedCells.forEach((c) => {
    cubesToRender.push({
      x: c.x,
      y: c.y,
      z: c.z,
      color: c.color,
      isPrediction: true,
    });
  });

  // Sort cubes back-to-front:
  // 1. Sort by depth (x + y + z) ascending.
  // 2. Break ties by z descending so higher elements in the same diagonal are rendered first.
  // 3. Break ties by x ascending.
  cubesToRender.sort((a, b) => {
    const depthA = a.x + a.y + a.z;
    const depthB = b.x + b.y + b.z;
    if (depthA !== depthB) return depthA - depthB;
    if (a.z !== b.z) return b.z - a.z;
    return a.x - b.x;
  });

  // Shading helpers for cube faces
  const getTopFaceStyle = (baseColor: string, isPreview?: boolean, isHovered?: boolean) => ({
    fill: baseColor,
    filter: isHovered ? 'brightness(1.3)' : 'brightness(1.15)',
    stroke: isPreview 
      ? 'rgba(255, 255, 255, 0.4)' 
      : isHovered 
        ? '#3b82f6' 
        : 'rgba(255, 255, 255, 0.2)',
    strokeWidth: isPreview ? 1.5 : isHovered ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });

  const getLeftFaceStyle = (baseColor: string, isPreview?: boolean, isHovered?: boolean) => ({
    fill: baseColor,
    filter: isHovered ? 'brightness(0.9)' : 'brightness(0.75)',
    stroke: isPreview 
      ? 'rgba(255, 255, 255, 0.4)' 
      : isHovered 
        ? '#3b82f6' 
        : 'rgba(255, 255, 255, 0.2)',
    strokeWidth: isPreview ? 1.5 : isHovered ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });

  const getRightFaceStyle = (baseColor: string, isPreview?: boolean, isHovered?: boolean) => ({
    fill: baseColor,
    filter: isHovered ? 'brightness(1.05)' : 'brightness(0.9)',
    stroke: isPreview 
      ? 'rgba(255, 255, 255, 0.4)' 
      : isHovered 
        ? '#3b82f6' 
        : 'rgba(255, 255, 255, 0.2)',
    strokeWidth: isPreview ? 1.5 : isHovered ? 1.5 : 0.8,
    strokeLinejoin: 'round' as const,
  });

  // Shading helpers for grid base cell cubes (at z = -1)
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

  // Render Grid base cells loop (as 3D cubes at z = -1)
  const gridCells = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const isHovered = currentHoveredCell?.x === x && currentHoveredCell?.y === y;
      const xPos = centerX + (x - y) * halfW;
      const yPos = centerY + (x + y) * halfH + L; // translated down since z = -1

      gridCells.push(
        <g
          key={`cell-${x}-${y}`}
          className="cursor-pointer"
          onClick={() => onCellClick?.(x, y)}
          onMouseEnter={() => handleMouseEnter(x, y)}
          onMouseLeave={() => handleMouseLeave(x)}
          style={{
            transform: `translate(${xPos}px, ${yPos}px)`,
          }}
        >
          {/* TOP FACE */}
          <path
            d={`M 0 ${- L - halfH} L ${-halfW} ${-L} L 0 ${- L + halfH} L ${halfW} ${-L} Z`}
            style={getGridTopFaceStyle(isHovered)}
            className="transition-colors duration-150"
          />

          {/* LEFT FACE */}
          <path
            d={`M 0 ${- L + halfH} L ${-halfW} ${-L} L ${-halfW} 0 L 0 ${halfH} Z`}
            style={getGridLeftFaceStyle(isHovered)}
            className="transition-colors duration-150"
          />

          {/* RIGHT FACE */}
          <path
            d={`M 0 ${- L + halfH} L ${halfW} ${-L} L ${halfW} 0 L 0 ${halfH} Z`}
            style={getGridRightFaceStyle(isHovered)}
            className="transition-colors duration-150"
          />

          {/* Coordinates text centered on top face */}
          <text
            x={0}
            y={-L + 3}
            textAnchor="middle"
            className="text-[9px] font-mono fill-zinc-400 opacity-60 pointer-events-none select-none"
          >
            {x},{y}
          </text>
        </g>
      );
    }
  }

  return (
    <div className="flex flex-col items-center select-none overflow-hidden py-4 w-full">
      {/* 3D SVG Area */}
      <div 
        className="relative flex items-center justify-center max-w-full"
        style={{
          width: '384px',
          aspectRatio: '384/390',
        }}
      >
        <svg
          viewBox="0 0 384 390"
          width="100%"
          height="100%"
          className="overflow-visible select-none drop-shadow-2xl"
        >
          {/* 1. Board Slab Base (Deprecated, grid cells are now 3D cubes) */}

          {/* 2. Grid base cells (rhombuses) */}
          <g>
            {gridCells}
          </g>

          {/* 3. Cubes (Placed & Preview) */}
          <g>
            {cubesToRender.map((cube, index) => {
              const xPos = centerX + (cube.x - cube.y) * halfW;
              const yPos = centerY + (cube.x + cube.y) * halfH - cube.z * L;
              const isHovered = currentHoveredCell?.x === cube.x && currentHoveredCell?.y === cube.y;

              return (
                <g
                  key={index}
                  style={{
                    transform: `translate(${xPos}px, ${yPos}px)`,
                    transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease',
                    opacity: cube.isPreview ? 0.75 : cube.isPrediction ? 0.4 : 1,
                  }}
                  className={cube.isPreview ? 'pointer-events-none animate-pulse' : cube.isPrediction ? 'pointer-events-none' : 'cursor-pointer pointer-events-auto'}
                  onClick={cube.isPreview || cube.isPrediction ? undefined : () => onCellClick?.(cube.x, cube.y)}
                  onMouseEnter={cube.isPreview || cube.isPrediction ? undefined : () => handleMouseEnter(cube.x, cube.y)}
                  onMouseLeave={cube.isPreview || cube.isPrediction ? undefined : () => handleMouseLeave(cube.x)}
                >
                  {/* TOP FACE */}
                  <path
                    d={`M 0 ${- L - halfH} L ${-halfW} ${-L} L 0 ${- L + halfH} L ${halfW} ${-L} Z`}
                    style={getTopFaceStyle(cube.color, cube.isPreview, isHovered)}
                  />

                  {/* LEFT FACE */}
                  <path
                    d={`M 0 ${- L + halfH} L ${-halfW} ${-L} L ${-halfW} 0 L 0 ${halfH} Z`}
                    style={getLeftFaceStyle(cube.color, cube.isPreview, isHovered)}
                  />

                  {/* RIGHT FACE */}
                  <path
                    d={`M 0 ${- L + halfH} L ${halfW} ${-L} L ${halfW} 0 L 0 ${halfH} Z`}
                    style={getRightFaceStyle(cube.color, cube.isPreview, isHovered)}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Legend / Info */}
      <div className="flex items-center gap-6 mt-4 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-zinc-900 border border-zinc-800 rounded shadow-sm" />
          <span>Base Grid</span>
        </div>
        <div className="flex items-center gap-1.5 animate-pulse">
          <div 
            className="w-3 h-3 rounded border border-white/20" 
            style={{
              backgroundColor: previewColor || '#a1a1aa',
              opacity: 0.6
            }}
          />
          <span>Placement Preview</span>
        </div>
      </div>
    </div>
  );
}
