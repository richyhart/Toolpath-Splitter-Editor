/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useMemo, useEffect } from "react";
import { ToolpathPoint, GridSettings } from "../types";
import { ZoomIn, ZoomOut, Compass, Info } from "lucide-react";

interface InteractiveGridProps {
  points: ToolpathPoint[];
  onionSkinPoints?: ToolpathPoint[];
  selectedPointId: string | null;
  onSelectPoint: (id: string | null) => void;
  onUpdatePointCoordinates: (id: string, x: number, y: number) => void;
  gridSettings: GridSettings;
  setGridSettings: React.Dispatch<React.SetStateAction<GridSettings>>;
  highlightColor?: string;
  activeSegmentId?: string;
  onDragStart?: () => void;
}

export default function InteractiveGrid({
  points,
  onionSkinPoints,
  selectedPointId,
  onSelectPoint,
  onUpdatePointCoordinates,
  gridSettings,
  setGridSettings,
  highlightColor = "#809fff",
  activeSegmentId,
  onDragStart
}: InteractiveGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Pan and drag states
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ToolpathPoint | null>(null);

  // Hover and cursor tracking states
  const [hoveredGridCoords, setHoveredGridCoords] = useState<{ x: number; y: number } | null>(null);
  const [mouseScreenCoords, setMouseScreenCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // SVG Size state
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });

  // Monitor size of parent block to be responsive
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      const w = containerRef.current?.clientWidth || 600;
      const h = containerRef.current?.clientHeight || 600;
      const squareSize = Math.min(w, h);
      setDimensions({
        width: squareSize,
        height: squareSize,
      });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Compute machine coordinate bounds to automatically scale and frame the view
  const bounds = useMemo(() => {
    if (points.length === 0) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100, width: 100, height: 100, centerX: 50, centerY: 50 };
    }
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(maxX - minX, 1.0); // Prevent divide by 0
    const height = Math.max(maxY - minY, 1.0);

    return {
      minX,
      maxX,
      minY,
      maxY,
      width,
      height,
      centerX: minX + width / 2,
      centerY: minY + height / 2,
    };
  }, [points]);

  // Handle auto-fit of toolpath inside viewport
  const handleAutoFit = () => {
    if (points.length === 0) {
      setGridSettings((prev) => ({ ...prev, zoom: 4.5, offsetX: 50, offsetY: 50 }));
      return;
    }

    const margin = 0.25;
    const usableW = dimensions.width * (1 - margin);
    const usableH = dimensions.height * (1 - margin);

    const scaleX = usableH / bounds.height;
    const scaleY = usableW / bounds.width;
    const baseZoom = Math.min(scaleX, scaleY, 15.0);

    setGridSettings((prev) => ({
      ...prev,
      zoom: baseZoom > 0.1 ? baseZoom : 4.0,
      offsetX: dimensions.width / 2 - bounds.centerX * (baseZoom > 0.1 ? baseZoom : 4.0),
      offsetY: dimensions.height / 2 + bounds.centerY * (baseZoom > 0.1 ? baseZoom : 4.0),
    }));
  };

  // Run auto fit when active segment, dimensions or points count change, but not on coordinate updates
  const pointsLength = points.length;
  useEffect(() => {
    handleAutoFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSegmentId, dimensions.width, dimensions.height, pointsLength]);

  // Map CNC coordinates to screen coordinates
  const project = (x: number, y: number) => {
    const screenX = gridSettings.offsetX + x * gridSettings.zoom;
    const screenY = gridSettings.offsetY - y * gridSettings.zoom;
    return { x: screenX, y: screenY };
  };

  // Map screen mouse position back to CNC coordinates
  const deproject = (screenX: number, screenY: number) => {
    const x = (screenX - gridSettings.offsetX) / gridSettings.zoom;
    const y = (gridSettings.offsetY - screenY) / gridSettings.zoom;
    return { x, y };
  };

  const snapValue = (val: number, step: number) => {
    return Math.round(val / step) * step;
  };

  // Panning/Zooming handlers - updated with non-stale prev context
  const handleZoom = (factor: number) => {
    setGridSettings((prev) => {
      const cX = dimensions.width / 2;
      const cY = dimensions.height / 2;

      const nextZoom = Math.max(Math.min(prev.zoom * factor, 120), 0.1);

      const originalCenterX = (cX - prev.offsetX) / prev.zoom;
      const originalCenterY = (prev.offsetY - cY) / prev.zoom;

      return {
        ...prev,
        zoom: nextZoom,
        offsetX: cX - originalCenterX * nextZoom,
        offsetY: cY + originalCenterY * nextZoom,
      };
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (draggingPointId) return;

    if (e.button === 0) {
      const target = e.target as SVGElement;
      if (target.classList.contains("point-handle")) return;

      // Clicked away from a point handle - deselect
      onSelectPoint(null);

      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Track live coordinate hover position
    const { x, y } = deproject(mouseX, mouseY);
    setHoveredGridCoords({ x, y });
    setMouseScreenCoords({ x: mouseX, y: mouseY });

    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setGridSettings((prev) => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
    } else if (draggingPointId) {
      let calcX = x;
      let calcY = y;

      if (gridSettings.snapToGrid) {
        calcX = snapValue(calcX, gridSettings.gridSize);
        calcY = snapValue(calcY, gridSettings.gridSize);
      }

      calcX = Math.round(calcX * 1000) / 1000;
      calcY = Math.round(calcY * 1000) / 1000;

      onUpdatePointCoordinates(draggingPointId, calcX, calcY);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingPointId(null);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
    setDraggingPointId(null);
    setHoveredGridCoords(null);
  };

  // Generate grid lines
  const gridLines = useMemo(() => {
    if (!gridSettings.showGrid) return [];
    
    const size = gridSettings.gridSize;
    if (size <= 0) return [];

    const leftTop = deproject(0, 0);
    const rightBottom = deproject(dimensions.width, dimensions.height);

    const startX = Math.floor(leftTop.x / size) * size;
    const endX = Math.ceil(rightBottom.x / size) * size;
    const startY = Math.floor(rightBottom.y / size) * size;
    const endY = Math.ceil(leftTop.y / size) * size;

    const lines: Array<{ path: string; isOrigin: boolean }> = [];

    // vertical - elegant dark black/charcoal grid lines for the light theme
    for (let x = startX; x <= endX; x += size) {
      const p1 = project(x, startY);
      const p2 = project(x, endY);
      lines.push({
        path: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
        isOrigin: Math.abs(x) < 0.0001
      });
    }

    // horizontal - elegant dark black/charcoal grid lines for the light theme
    for (let y = startY; y <= endY; y += size) {
      const p1 = project(startX, y);
      const p2 = project(endX, y);
      lines.push({
        path: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
        isOrigin: Math.abs(y) < 0.0001
      });
    }

    return lines;
  }, [gridSettings, dimensions, project, deproject]);

  // Generate paths
  const pathElements = useMemo(() => {
    if (points.length < 2) return [];

    const lines: Array<{
      id: string;
      d: string;
      type: string;
      speed: number;
      ptA: ToolpathPoint;
      ptB: ToolpathPoint;
    }> = [];

    for (let i = 1; i < points.length; i++) {
      const ptA = points[i - 1];
      const ptB = points[i];
      const p1 = project(ptA.x, ptA.y);
      const p2 = project(ptB.x, ptB.y);

      lines.push({
        id: `line-${ptA.id}-${ptB.id}`,
        d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
        type: ptB.type,
        speed: ptB.speed,
        ptA,
        ptB
      });
    }

    return lines;
  }, [points, project]);

  // Generate onion skin paths dynamically
  const onionSkinLines = useMemo(() => {
    if (!onionSkinPoints || onionSkinPoints.length < 2) return [];

    const lines: Array<{
      id: string;
      d: string;
    }> = [];

    for (let i = 1; i < onionSkinPoints.length; i++) {
      const ptA = onionSkinPoints[i - 1];
      const ptB = onionSkinPoints[i];
      const p1 = project(ptA.x, ptA.y);
      const p2 = project(ptB.x, ptB.y);

      lines.push({
        id: `onion-line-${ptA.id}-${ptB.id}`,
        d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`
      });
    }

    return lines;
  }, [onionSkinPoints, project]);

  return (
    <div 
      className="relative w-full h-full flex flex-col bg-[#f7f5e1] border border-slate-300 rounded-lg overflow-hidden self-stretch shadow-lg" 
      ref={containerRef}
    >
      {/* Black grid background lines overlay */}
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none z-0"></div>

      {/* Overlays top-left: Controller buttons with strict event separation */}
      <div 
        className="absolute top-4 left-4 z-30 flex gap-2 flex-wrap bg-white/90 backdrop-blur-md p-1.5 rounded border border-slate-300 shadow-md"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => handleZoom(1.15)}
          className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-800 transition-all font-mono text-xs font-semibold flex items-center gap-1 cursor-pointer"
          title="Zoom In"
          id="zoom-in-btn"
        >
          <ZoomIn className="w-3.5 h-3.5 text-indigo-600" />
          <span>IN</span>
        </button>
        <button
          onClick={() => handleZoom(0.85)}
          className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-800 transition-all font-mono text-xs font-semibold flex items-center gap-1 cursor-pointer"
          title="Zoom Out"
          id="zoom-out-btn"
        >
          <ZoomOut className="w-3.5 h-3.5 text-indigo-600" />
          <span>OUT</span>
        </button>
        <button
          onClick={handleAutoFit}
          className="p-1 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded transition-all flex items-center gap-1.5 text-xs font-mono font-medium tracking-tight cursor-pointer"
          title="Recalibrate View Envelope"
          id="auto-fit-btn"
        >
          <Compass className="w-3.5 h-3.5 text-indigo-600" />
          <span>FIT VIEW</span>
        </button>
      </div>

      {/* Top right Legend panel with pinned live cursor coordinate display */}
      <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2 pointer-events-none select-none">
        {/* Toolpath Info Card */}
        <div className="flex items-center gap-3.5 text-[10px] bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded border border-slate-300 font-mono text-slate-700 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 bg-[#809fff] inline-block rounded-sm"></span>
            <span className="text-[#809fff] uppercase font-bold">TOOLPATH</span>
          </div>
          <div className="border-l border-slate-300 pl-3 text-slate-500 font-semibold">
            S:{gridSettings.gridSize}mm
          </div>
        </div>

        {/* Pinned Live Cursor Coordinates HUD */}
        <div 
          className="bg-slate-900/90 text-[10px] font-mono text-slate-100 px-2.5 py-1.5 rounded-md shadow-md flex items-center gap-1.5 border border-slate-700/50 backdrop-blur-sm"
          id="pinned-coords-indicator"
        >
          <span className="text-indigo-400 font-bold uppercase tracking-wider text-[8px]">Live Cursor:</span>
          {hoveredGridCoords ? (
            <>
              <span>X: {hoveredGridCoords.x.toFixed(2)}</span>
              <span className="text-slate-500">|</span>
              <span>Y: {hoveredGridCoords.y.toFixed(2)}</span>
            </>
          ) : (
            <span className="text-slate-400 italic">Grid: Hover to track</span>
          )}
        </div>
      </div>

      {/* Coordinates status console */}
      <div className="absolute bottom-4 left-4 z-30 text-[9px] font-mono bg-white/95 text-slate-800 p-3 rounded border border-slate-300 shadow-lg space-y-1 max-w-[280px] pointer-events-none select-none">
        <div className="font-semibold text-indigo-700 border-b border-slate-200 pb-1 flex justify-between gap-4">
          <span>ACTIVE WORKING SPACE</span>
          <span className="text-indigo-600">DISPENSE 2D</span>
        </div>
        <div className="flex justify-between gap-4 text-slate-600">
          <span>X LIMITS:</span>
          <span>{bounds.minX.toFixed(3)} to {bounds.maxX.toFixed(3)} mm</span>
        </div>
        <div className="flex justify-between gap-4 text-slate-600">
          <span>Y LIMITS:</span>
          <span>{bounds.minY.toFixed(3)} to {bounds.maxY.toFixed(3)} mm</span>
        </div>
        {hoveredPoint && (
          <div className="text-slate-800 pt-1.5 border-t border-slate-200 mt-1.5 flex flex-col">
            <span className="font-bold text-indigo-600 font-sans text-[8px] uppercase tracking-wider mb-0.5">Coordinate Info:</span>
            <span className="font-semibold truncate">CMD: {hoveredPoint.type}</span>
            <span>X: {hoveredPoint.x.toFixed(3)} • Y: {hoveredPoint.y.toFixed(3)}</span>
            <span>Feed speed: {hoveredPoint.speed} mm/min</span>
          </div>
        )}
      </div>

      {/* Main SVG Layout Canvas */}
      <svg
        ref={svgRef}
        className={`w-full h-full select-none outline-none z-10 relative ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        id="toolpath-svg"
      >
        <defs>
          <marker
            id="g1-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 2 L 8 5 L 0 8 z" fill="#809fff" />
          </marker>
        </defs>

        {/* Dynamic Coordinate Axes Gridlines - styled in crisp black / dark-charcoal */}
        <g id="grid-lines-layer">
          {gridLines.map((line, idx) => (
            <path
              key={`grid-line-${idx}`}
              d={line.path}
              fill="none"
              stroke={line.isOrigin ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.1)"}
              strokeWidth={line.isOrigin ? 2.0 : 0.75}
            />
          ))}
        </g>

        {/* Onion Skin Overlay Layer */}
        {onionSkinPoints && onionSkinPoints.length > 0 && (
          <g id="onion-skin-layer" className="opacity-45">
            {onionSkinLines.map((line) => (
              <path
                key={line.id}
                d={line.d}
                fill="none"
                stroke="#d946ef"
                strokeWidth={2.5}
                strokeDasharray="4,4"
                className="pointer-events-none"
              />
            ))}

            {onionSkinPoints.map((pt, index) => {
              const { x, y } = project(pt.x, pt.y);
              const isStart = index === 0;
              const isEnd = index === onionSkinPoints.length - 1;

              return (
                <g key={`onion-node-${pt.id}-${index}`} className="pointer-events-none">
                  {/* Small outer halos for precision snapping line-up visual aid */}
                  {(isStart || isEnd) && (
                    <circle
                      cx={x}
                      cy={y}
                      r={7.5}
                      fill="none"
                      stroke="#d946ef"
                      strokeWidth={1.25}
                      strokeDasharray="2,2"
                    />
                  )}
                  {/* Node point marker */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isStart || isEnd ? 4.5 : 2.5}
                    fill={isStart ? "#10b981" : isEnd ? "#ef4444" : "#d946ef"}
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                  {/* Layer matching index help flag */}
                  {(isStart || isEnd) && (
                    <text
                      x={x + 7}
                      y={y + 3}
                      fill="#d946ef"
                      fontSize="7.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {isStart ? "ONION START" : "ONION END"}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* Toolpath lines in bright #809fff color */}
        <g id="toolpath-lines-layer">
          {pathElements.map((line) => {
            const isSelected = selectedPointId && (line.ptA.id === selectedPointId || line.ptB.id === selectedPointId);
            return (
              <path
                key={line.id}
                d={line.d}
                fill="none"
                stroke={isSelected ? "#f59e0b" : "#809fff"}
                strokeWidth={isSelected ? 4.5 : 2.75}
                markerEnd={
                  gridSettings.showArrows
                    ? `url(#g1-arrow)`
                    : undefined
                }
                className="hover:stroke-[#3b82f6] hover:stroke-[3.5px] cursor-crosshair transition-[stroke,stroke-width] duration-150"
                title={`${line.type} Step: Feed Speed ${line.speed}`}
              />
            );
          })}
        </g>

        {/* Interactive nodes */}
        {gridSettings.showPoints && (
          <g id="points-handles-layer">
            {points.map((pt, index) => {
              const { x, y } = project(pt.x, pt.y);
              const isSelected = pt.id === selectedPointId;

              return (
                <g key={`node-group-${pt.id}`}>
                  {/* Invisible drag-handle cushion for easier click target */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 11 : 8}
                    fill="transparent"
                    className="point-handle cursor-move hover:fill-indigo-500/10 transition-[fill] duration-150"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onSelectPoint(pt.id);
                      setDraggingPointId(pt.id);
                      if (onDragStart) onDragStart();
                    }}
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />

                  {/* Visual Circle outer ring - customizable color based on node position in segment */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 6.5 : 4.5}
                    fill={
                      isSelected
                        ? "#ea580c" // Selected Orange
                        : index === 0
                        ? "#10b981" // Start node color of Z segment (Green)
                        : index === points.length - 1
                        ? "#ef4444" // End node color of Z segment (Red)
                        : "#2563eb" // Intermediate node color of Z segment (Royal Blue)
                    }
                    stroke={isSelected ? "#ffffff" : "rgba(0, 0, 0, 0.25)"}
                    strokeWidth={isSelected ? 2 : 1}
                    className="pointer-events-none"
                  />

                  {/* Start / End flags */}
                  {index === 0 && (
                    <g transform={`translate(${x - 14}, ${y - 14})`} className="pointer-events-none opacity-90">
                      <rect width="28" height="10" rx="2" fill="#10b981" />
                      <text x="14" y="8" fill="white" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                        START
                      </text>
                    </g>
                  )}

                  {index === points.length - 1 && (
                    <g transform={`translate(${x - 14}, ${y - 14})`} className="pointer-events-none opacity-90">
                      <rect width="28" height="10" rx="2" fill="#ef4444" />
                      <text x="14" y="8" fill="white" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                        REACH
                      </text>
                    </g>
                  )}

                  {/* Optional Node Dot sequence numbers */}
                  {gridSettings.showNodeNumbers && (
                    <text
                      x={x + 7}
                      y={y - 8}
                      fill={isSelected ? "#ea580c" : "#1e293b"}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      paintOrder="stroke"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                      className="pointer-events-none select-none"
                    >
                      {index + 1}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}
      </svg>

    </div>
  );
}
