/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useMemo, useEffect } from "react";
import { ToolpathPoint, GridSettings } from "../types";
import { ZoomIn, ZoomOut, Compass, Info, RefreshCw, Grid, Ruler } from "lucide-react";

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
  fileName?: string;
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
  onDragStart,
  fileName
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

  // Axis swapping toggle (X <=> Y)
  const [swapXY, setSwapXY] = useState(false);

  // Measurement Tool States
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoint1, setMeasurePoint1] = useState<ToolpathPoint | null>(null);
  const [measurePoint2, setMeasurePoint2] = useState<ToolpathPoint | null>(null);

  const handleMeasureSelect = (pt: ToolpathPoint) => {
    if (!measurePoint1) {
      setMeasurePoint1(pt);
    } else if (!measurePoint2) {
      if (pt.id !== measurePoint1.id) {
        setMeasurePoint2(pt);
      } else {
        setMeasurePoint1(null);
      }
    } else {
      if (pt.id === measurePoint1.id) {
        setMeasurePoint1(measurePoint2);
        setMeasurePoint2(null);
      } else if (pt.id === measurePoint2.id) {
        setMeasurePoint2(null);
      } else {
        setMeasurePoint1(pt);
        setMeasurePoint2(null);
      }
    }
  };

  // SVG Size state
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });

  // User custom resize dimensions state
  const [customSize, setCustomSize] = useState<{ width: number; height: number } | null>(null);
  const [isResizing, setIsResizing] = useState<"width" | "height" | "both" | null>(null);
  const resizeStart = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMoveGlobal = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      
      let nextW = resizeStart.current.w;
      let nextH = resizeStart.current.h;

      if (isResizing === "width" || isResizing === "both") {
        nextW = Math.max(300, resizeStart.current.w + dx);
      }
      if (isResizing === "height" || isResizing === "both") {
        nextH = Math.max(350, resizeStart.current.h + dy);
      }

      setCustomSize({ width: nextW, height: nextH });
    };

    const handleMouseUpGlobal = () => {
      setIsResizing(null);
    };

    window.addEventListener("mousemove", handleMouseMoveGlobal);
    window.addEventListener("mouseup", handleMouseUpGlobal);

    return () => {
      window.removeEventListener("mousemove", handleMouseMoveGlobal);
      window.removeEventListener("mouseup", handleMouseUpGlobal);
    };
  }, [isResizing]);

  // Monitor size of parent block to be responsive
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (customSize) {
        setDimensions({
          width: customSize.width,
          height: customSize.height,
        });
      } else {
        const w = containerRef.current?.clientWidth || 600;
        const h = containerRef.current?.clientHeight || 600;
        const squareSize = Math.min(w, h);
        setDimensions({
          width: squareSize,
          height: squareSize,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [customSize]);

  // Update control for scroll wheel + CTRL key zoom, bypassing passive listener limits to prevent browser-wide zoom scaling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault(); // Strongly prevent default page-scaling behavior

        // Zoom-in for wheel scroll up (deltaY < 0), Zoom-out for wheel scroll down
        const factor = e.deltaY < 0 ? 1.12 : 0.88;

        // Obtain cursor coordinates relative to the SVG boundaries
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setGridSettings((prev) => {
          // Keep zoom state within safe operational bounds (max 120, min 0.1)
          const nextZoom = Math.max(Math.min(prev.zoom * factor, 120), 0.1);

          // Find the CNC/machine coordinates under the cursor before applying zoom
          const rawX = (mouseX - prev.offsetX) / prev.zoom;
          const rawY = (prev.offsetY - mouseY) / prev.zoom;

          // Align the same coordinate with the current mouse position in the expanded zoom coordinate space
          return {
            ...prev,
            zoom: nextZoom,
            offsetX: mouseX - rawX * nextZoom,
            offsetY: mouseY + rawY * nextZoom,
          };
        });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [setGridSettings, swapXY]);

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

    const currentBoundW = swapXY ? bounds.height : bounds.width;
    const currentBoundH = swapXY ? bounds.width : bounds.height;

    const scaleX = usableH / currentBoundH;
    const scaleY = usableW / currentBoundW;
    const baseZoom = Math.min(scaleX, scaleY, 15.0);

    const cx = swapXY ? bounds.centerY : bounds.centerX;
    const cy = swapXY ? bounds.centerX : bounds.centerY;

    setGridSettings((prev) => ({
      ...prev,
      zoom: baseZoom > 0.1 ? baseZoom : 4.0,
      offsetX: dimensions.width / 2 - cx * (baseZoom > 0.1 ? baseZoom : 4.0),
      offsetY: dimensions.height / 2 + cy * (baseZoom > 0.1 ? baseZoom : 4.0),
    }));
  };

  // Run auto fit ONLY on initial mount, window resize, coordinate flip/swap, or when a completely new file is loaded
  useEffect(() => {
    handleAutoFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName, dimensions.width, dimensions.height, swapXY]);

  // Map CNC coordinates to screen coordinates
  const project = (x: number, y: number) => {
    const px = swapXY ? y : x;
    const py = swapXY ? x : y;
    const screenX = gridSettings.offsetX + px * gridSettings.zoom;
    const screenY = gridSettings.offsetY - py * gridSettings.zoom;
    return { x: screenX, y: screenY };
  };

  // Map screen mouse position back to CNC coordinates
  const deproject = (screenX: number, screenY: number) => {
    const rawX = (screenX - gridSettings.offsetX) / gridSettings.zoom;
    const rawY = (gridSettings.offsetY - screenY) / gridSettings.zoom;
    const x = swapXY ? rawY : rawX;
    const y = swapXY ? rawX : rawY;
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

      const rawCenterX = (cX - prev.offsetX) / prev.zoom;
      const rawCenterY = (prev.offsetY - cY) / prev.zoom;

      return {
        ...prev,
        zoom: nextZoom,
        offsetX: cX - rawCenterX * nextZoom,
        offsetY: cY + rawCenterY * nextZoom,
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

    const xCoords = [leftTop.x, rightBottom.x];
    const yCoords = [leftTop.y, rightBottom.y];
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    const startX = Math.floor(minX / size) * size;
    const endX = Math.ceil(maxX / size) * size;
    const startY = Math.floor(minY / size) * size;
    const endY = Math.ceil(maxY / size) * size;

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
  }, [gridSettings, dimensions, project, deproject, swapXY]);

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
      className="relative flex flex-col bg-[#f7f5e1] border border-slate-300 rounded-lg overflow-hidden self-stretch shadow-lg" 
      ref={containerRef}
      style={{
        width: customSize ? `${customSize.width}px` : "100%",
        height: customSize ? `${customSize.height}px` : "100%",
        minWidth: "300px",
        minHeight: "350px",
        maxWidth: "100%",
      }}
    >

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
        <div className="w-px h-5 bg-slate-200 self-center mx-0.5"></div>
        <button
          onClick={() => setSwapXY((prev) => !prev)}
          className={`p-1 px-2.5 border rounded transition-all font-mono text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
            swapXY
              ? "bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700"
              : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800"
          }`}
          style={{ width: "120px", height: "26px" }}
          title="Flip X to Y axis and vice versa"
          id="swap-xy-btn"
        >
          <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-300 ${swapXY ? "text-white rotate-180" : "text-indigo-600"}`} />
          <span>FLIP X ⇋ Y</span>
        </button>
        <button
          onClick={() => setGridSettings((prev) => ({ ...prev, showGrid: !prev.showGrid }))}
          className={`p-1 px-2.5 border rounded transition-all font-mono text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
            gridSettings.showGrid
              ? "bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700"
              : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800"
          }`}
          style={{ height: "26px" }}
          title="Toggle Gridlines Visibility"
          id="toggle-gridlines-btn"
        >
          <Grid className={`w-3.5 h-3.5 ${gridSettings.showGrid ? "text-white" : "text-indigo-600"}`} />
          <span>GRID: {gridSettings.showGrid ? "ON" : "OFF"}</span>
        </button>
        <button
          onClick={() => {
            setIsMeasuring(!isMeasuring);
            if (!isMeasuring) {
              setMeasurePoint1(null);
              setMeasurePoint2(null);
            }
          }}
          className={`p-1 px-2.5 border rounded transition-all font-mono text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
            isMeasuring
              ? "bg-rose-600 border-rose-700 text-white hover:bg-rose-700"
              : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800"
          }`}
          style={{ height: "26px" }}
          title="Measure shortest straight line / component distance between 2 points"
          id="measure-btn"
        >
          <Ruler className={`w-3.5 h-3.5 ${isMeasuring ? "text-white" : "text-rose-600"}`} />
          <span>MEASURE: {isMeasuring ? "ON" : "OFF"}</span>
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
              <span>X: {hoveredGridCoords.x.toFixed(3)}</span>
              <span className="text-slate-500">|</span>
              <span>Y: {hoveredGridCoords.y.toFixed(3)}</span>
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
            <path d="M 0 2 L 8 5 L 0 8 z" fill="#1f4b6e" />
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
                      r={3.75}
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
                    r={isStart || isEnd ? 2.25 : 1.25}
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

        {/* Toolpath lines in custom dark `#1f4b6e` color */}
        <g id="toolpath-lines-layer">
          {pathElements.map((line) => {
            const isSelected = selectedPointId && (line.ptA.id === selectedPointId || line.ptB.id === selectedPointId);
            return (
              <path
                key={line.id}
                d={line.d}
                fill="none"
                stroke={isSelected ? "#f59e0b" : "#1f4b6e"}
                strokeWidth={isSelected ? 2.5 : 1.5}
                markerEnd={
                  gridSettings.showArrows
                    ? `url(#g1-arrow)`
                    : undefined
                }
                className="hover:stroke-[#3b82f6] hover:stroke-[2.2px] cursor-crosshair transition-[stroke,stroke-width] duration-150"
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
                    className={`point-handle hover:fill-indigo-500/10 transition-[fill] duration-150 ${isMeasuring ? "cursor-crosshair" : "cursor-move"}`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (isMeasuring) {
                        handleMeasureSelect(pt);
                      } else {
                        onSelectPoint(pt.id);
                        setDraggingPointId(pt.id);
                        if (onDragStart) onDragStart();
                      }
                    }}
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />

                  {/* Visual Circle outer ring - customizable color based on node position in segment */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 3.25 : 2.25}
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
                    strokeWidth={isSelected ? 1.5 : 0.75}
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

        {/* Measurement Layer overlay */}
        {isMeasuring && (
          <g id="measurement-layer" className="pointer-events-none">
            {/* Draw highlights around selected measure nodes */}
            {measurePoint1 && (() => {
              const p = project(measurePoint1.x, measurePoint1.y);
              return (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={8}
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth={2.5}
                  className="animate-pulse"
                />
              );
            })()}
            {measurePoint2 && (() => {
              const p = project(measurePoint2.x, measurePoint2.y);
              return (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={8}
                  fill="none"
                  stroke="#db2777"
                  strokeWidth={2.5}
                  className="animate-pulse"
                />
              );
            })()}

            {/* If both points are selected, construct the ruler visualizer */}
            {measurePoint1 && measurePoint2 && (() => {
              const p1 = project(measurePoint1.x, measurePoint1.y);
              const p2 = project(measurePoint2.x, measurePoint2.y);
              
              // Determine corner for right angle
              const pCorner = project(measurePoint2.x, measurePoint1.y);

              // Distances
              const dx = measurePoint2.x - measurePoint1.x;
              const dy = measurePoint2.y - measurePoint1.y;
              const dz = measurePoint2.z - measurePoint1.z;
              const directDist2D = Math.sqrt(dx * dx + dy * dy);
              const directDist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

              return (
                <g>
                  {/* Direct connection diagonal (shortest straight path) */}
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#ec4899"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />

                  {/* Horizontal Leg component */}
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={pCorner.x}
                    y2={pCorner.y}
                    stroke="#8b5cf6"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    opacity={0.85}
                  />

                  {/* Vertical Leg component */}
                  <line
                    x1={pCorner.x}
                    y1={pCorner.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    opacity={0.85}
                  />

                  {/* Nodes on corner to anchor the components visually */}
                  <circle cx={pCorner.x} cy={pCorner.y} r={3} fill="#a78bfa" stroke="#ffffff" strokeWidth={1} />

                  {/* Label for Direct distance (Shortest Straight Path) */}
                  <g transform={`translate(${(p1.x + p2.x) / 2}, ${(p1.y + p2.y) / 2 - 12})`}>
                    <rect
                      x={-50}
                      y={-9}
                      width={100}
                      height={16}
                      rx={3}
                      fill="rgba(236, 72, 153, 0.95)"
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                    <text
                      fill="#ffffff"
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                      y={2}
                    >
                      D: {directDist3D.toFixed(3)} mm
                    </text>
                  </g>

                  {/* Label for horizontal offset ΔX */}
                  {Math.abs(dx) > 0.01 && (
                    <g transform={`translate(${(p1.x + pCorner.x) / 2}, ${(p1.y + pCorner.y) / 2 + 12})`}>
                      <rect
                        x={-42}
                        y={-8}
                        width={84}
                        height={14}
                        rx={3}
                        fill="rgba(139, 92, 246, 0.95)"
                        stroke="#ffffff"
                        strokeWidth={0.75}
                      />
                      <text
                        fill="#ffffff"
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                        y={2}
                      >
                        ΔX: {Math.abs(dx).toFixed(3)} mm
                      </text>
                    </g>
                  )}

                  {/* Label for vertical offset ΔY */}
                  {Math.abs(dy) > 0.01 && (
                    <g transform={`translate(${(pCorner.x + p2.x) / 2 + (p2.x > pCorner.x ? 45 : -45)}, ${(pCorner.y + p2.y) / 2})`}>
                      <rect
                        x={-42}
                        y={-8}
                        width={84}
                        height={14}
                        rx={3}
                        fill="rgba(6, 182, 212, 0.95)"
                        stroke="#ffffff"
                        strokeWidth={0.75}
                      />
                      <text
                        fill="#ffffff"
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                        y={2}
                      >
                        ΔY: {Math.abs(dy).toFixed(3)} mm
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}
          </g>
        )}
      </svg>

      {/* Measuring Tool HUD panel */}
      {isMeasuring && (
        <div 
          className="absolute bottom-4 left-[200px] z-30 text-[10px] font-mono bg-white/95 text-slate-800 p-3.5 rounded border border-rose-300 shadow-xl space-y-2 w-[240px] transition-all animate-fadeIn pointer-events-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-bold text-rose-600 border-b border-rose-200 pb-1.5 flex justify-between items-center">
            <div className="flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5" />
              <span>MEASUREMENT SENSOR</span>
            </div>
            <button 
              onClick={() => {
                setIsMeasuring(false);
                setMeasurePoint1(null);
                setMeasurePoint2(null);
              }}
              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded text-[9px] font-semibold cursor-pointer border border-slate-200"
            >
              EXIT
            </button>
          </div>

          <div className="space-y-1.5 text-slate-600">
            {/* Pt 1 Info */}
            <div className="flex flex-col border-b border-slate-100 pb-1">
              <span className="font-semibold text-rose-500 text-[8px] uppercase tracking-wider">POINT 1 (A):</span>
              {measurePoint1 ? (
                <span className="text-slate-800 font-medium">
                  X: {measurePoint1.x.toFixed(3)} • Y: {measurePoint1.y.toFixed(3)} • Z: {measurePoint1.z.toFixed(2)}
                </span>
              ) : (
                <span className="text-slate-400 italic">Select node from toolpaths...</span>
              )}
            </div>

            {/* Pt 2 Info */}
            <div className="flex flex-col border-b border-slate-100 pb-1">
              <span className="font-semibold text-rose-500 text-[8px] uppercase tracking-wider">POINT 2 (B):</span>
              {measurePoint2 ? (
                <span className="text-slate-800 font-medium">
                  X: {measurePoint2.x.toFixed(3)} • Y: {measurePoint2.y.toFixed(3)} • Z: {measurePoint2.z.toFixed(2)}
                </span>
              ) : (
                <span className="text-slate-400 italic">Select second node...</span>
              )}
            </div>

            {/* Calculations results */}
            {measurePoint1 && measurePoint2 ? (() => {
              const dx = measurePoint2.x - measurePoint1.x;
              const dy = measurePoint2.y - measurePoint1.y;
              const dz = measurePoint2.z - measurePoint1.z;
              const dist2D = Math.sqrt(dx*dx + dy*dy);
              const dist3D = Math.sqrt(dx*dx + dy*dy + dz*dz);
              const sumXY = Math.abs(dx) + Math.abs(dy);

              return (
                <div className="space-y-1.5 pt-1 text-slate-800">
                  <div className="flex justify-between font-bold text-rose-700 bg-rose-50/50 p-1 px-1.5 rounded border border-rose-100 mt-1">
                    <span>STRAIGHT LINE 3D:</span>
                    <span>{dist3D.toFixed(3)} mm</span>
                  </div>
                  <div className="flex justify-between font-semibold text-indigo-700 bg-indigo-50/30 p-1 px-1.5 rounded border border-indigo-100/50">
                    <span>STRAIGHT LINE 2D:</span>
                    <span>{dist2D.toFixed(3)} mm</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[9px]">
                    <div className="flex flex-col bg-slate-50 p-1 rounded border border-slate-100">
                      <span className="text-slate-400 font-semibold uppercase">DX (Horizontal)</span>
                      <span className="font-bold text-slate-700">{Math.abs(dx).toFixed(3)} mm</span>
                    </div>
                    <div className="flex flex-col bg-slate-50 p-1 rounded border border-slate-100">
                      <span className="text-slate-400 font-semibold uppercase">DY (Vertical)</span>
                      <span className="font-bold text-slate-700">{Math.abs(dy).toFixed(3)} mm</span>
                    </div>
                  </div>

                  <div className="flex justify-between text-[9px] text-slate-500 font-medium pt-0.5 px-0.5">
                    <span>ABS DX + DY SUM:</span>
                    <span className="font-bold text-slate-700">{sumXY.toFixed(3)} mm</span>
                  </div>

                  <div className="flex justify-between text-[9px] text-slate-500 font-medium px-0.5">
                    <span>DZ OFFSET:</span>
                    <span className="font-bold text-slate-700">{Math.abs(dz).toFixed(3)} mm</span>
                  </div>
                </div>
              );
            })() : null}
          </div>

          {(measurePoint1 || measurePoint2) && (
            <button
              onClick={() => {
                setMeasurePoint1(null);
                setMeasurePoint2(null);
              }}
              className="w-full py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[9.5px] border border-slate-300 transition-all cursor-pointer text-center"
            >
              CLEAR SELECTION
            </button>
          )}
        </div>
      )}

      {/* Dynamic X-Y Axis Orientation HUD Reference */}
      <div 
        className="absolute bottom-4 right-4 z-30 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-md border border-slate-300 shadow-lg flex flex-col items-center gap-1.5 pointer-events-none select-none w-28"
        id="axis-orientation-indicator"
      >
        <div className="font-mono text-[8.5px] font-bold text-indigo-700 tracking-wider uppercase">
          ORIENTATION
        </div>
        
        {/* Compact visual axis compass */}
        <div className="relative w-12 h-12 bg-slate-50 border border-slate-200/60 rounded flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 40 40" className="overflow-visible">
            {/* Origin node center */}
            <circle cx="10" cy="30" r="2.5" fill="#6366f1" />
            
            {/* Horizontal Axis arrow direction */}
            <line x1="10" y1="30" x2="28" y2="30" stroke="#475569" strokeWidth="1.75" strokeLinecap="round" />
            <polygon points="28,27.5 33,30 28,32.5" fill="#475569" />
            
            {/* Vertical Axis arrow direction */}
            <line x1="10" y1="30" x2="10" y2="12" stroke="#475569" strokeWidth="1.75" strokeLinecap="round" />
            <polygon points="7.5,12 10,7 12.5,12" fill="#475569" />
            
            {/* Horizontal Axis label (swaps if axis is swapped) */}
            <text 
              x="34" 
              y="38" 
              fill="#4f46e5" 
              fontSize="8" 
              fontWeight="bold" 
              fontFamily="monospace" 
              textAnchor="middle"
            >
              {swapXY ? "Y" : "X"}
            </text>

            {/* Vertical Axis label (swaps if axis is swapped) */}
            <text 
              x="18" 
              y="9" 
              fill="#2563eb" 
              fontSize="8" 
              fontWeight="bold" 
              fontFamily="monospace" 
              textAnchor="middle"
            >
              {swapXY ? "X" : "Y"}
            </text>
          </svg>
        </div>
        
        <div className="font-mono text-[8px] text-slate-500 font-bold leading-none tracking-tight">
          {swapXY ? "Y ➔ HORIZ" : "X ➔ HORIZ"}
        </div>
      </div>

      {/* Manual Drag Resize Handles (Right edge, Bottom edge, Bottom-right corner) */}
      <div
        className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize z-50 hover:bg-slate-300/30 bg-transparent transition-colors group"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          const w = containerRef.current?.clientWidth || 600;
          const h = containerRef.current?.clientHeight || 600;
          resizeStart.current = { x: e.clientX, y: e.clientY, w, h };
          setIsResizing("width");
        }}
        title="Drag right edge to resize width"
      >
        <div className="w-[2px] h-full mx-auto bg-slate-400/0 group-hover:bg-indigo-500/50 transition-colors" />
      </div>

      <div
        className="absolute bottom-0 left-0 h-1.5 w-full cursor-ns-resize z-50 hover:bg-slate-300/30 bg-transparent transition-colors group"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          const w = containerRef.current?.clientWidth || 600;
          const h = containerRef.current?.clientHeight || 600;
          resizeStart.current = { x: e.clientX, y: e.clientY, w, h };
          setIsResizing("height");
        }}
        title="Drag bottom edge to resize height"
      >
        <div className="h-[2px] w-full my-auto bg-slate-400/0 group-hover:bg-indigo-500/50 transition-colors" />
      </div>

      <div
        className="absolute bottom-1 right-1 w-4 h-4 cursor-nwse-resize z-50 flex items-end justify-end p-0.5 hover:bg-slate-300/70 bg-white/40 border border-slate-300 rounded shadow-sm opacity-65 hover:opacity-100 transition-opacity"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          const w = containerRef.current?.clientWidth || 600;
          const h = containerRef.current?.clientHeight || 600;
          resizeStart.current = { x: e.clientX, y: e.clientY, w, h };
          setIsResizing("both");
        }}
        title="Drag corner to resize width and height"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-slate-600 fill-none overflow-visible">
          <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <line x1="8" y1="5" x2="5" y2="8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </div>

    </div>
  );
}
