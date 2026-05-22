/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from "react";
import { ToolpathPoint, GridSettings } from "./types";
import { generateSampleSpiral, splitToolpathByZ, generateId } from "./utils";
import Toolbar from "./components/Toolbar";
import InteractiveGrid from "./components/InteractiveGrid";
import SegmentSidebar from "./components/SegmentSidebar";
import PointListSidebar from "./components/PointListSidebar";
import { Sliders, Sparkles, Terminal, Cpu } from "lucide-react";

export default function App() {
  // Central Coordinate Raw Points Dataset
  const [rawPoints, setRawPoints] = useState<ToolpathPoint[]>([]);
  const [fileName, setFileName] = useState<string>("helix_spiral_sample.csv");

  // Undo / Redo history state stacks
  const [history, setHistory] = useState<ToolpathPoint[][]>([]);
  const [future, setFuture] = useState<ToolpathPoint[][]>([]);

  // Selection states
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [onionSkinSegmentId, setOnionSkinSegmentId] = useState<string | null>(null);

  // Global Grid controls - initial grid values
  const [gridSettings, setGridSettings] = useState<GridSettings>({
    showGrid: true,
    gridSize: 1.0, // Set grid size to 1.0mm
    snapToGrid: false,
    showPoints: true,
    showArrows: true,
    zoom: 4.5,
    offsetX: 100,
    offsetY: 400
  });

  // Helper to push a snapshot of current rawPoints to history
  const pushToHistory = (customBeforeState?: ToolpathPoint[]) => {
    const pointsToPush = customBeforeState || rawPoints;
    if (history.length > 0) {
      const last = history[history.length - 1];
      if (JSON.stringify(last) === JSON.stringify(pointsToPush)) {
        return;
      }
    }
    setHistory((prev) => [...prev, pointsToPush]);
    setFuture([]); // Clear future stack on new action
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [rawPoints, ...prev]);
    setRawPoints(previous);
    setSelectedPointId(null);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, rawPoints]);
    setRawPoints(next);
    setSelectedPointId(null);
  };

  // Global Keyboard Shortcuts for Undo (Ctrl+Z / Cmd+Z) and Redo (Ctrl+Y / Cmd+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger undo/redo if typing inside inputs
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (modifierKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (modifierKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, future, rawPoints]);

  // Load spiral on mount
  useEffect(() => {
    const sample = generateSampleSpiral();
    setRawPoints(sample);
  }, []);

  // Compute layers/segments dynamically grouped by sequential Z coordinates
  const segments = useMemo(() => {
    return splitToolpathByZ(rawPoints);
  }, [rawPoints]);

  // Handle auto-selection of first layer segment after loading
  useEffect(() => {
    if (segments.length > 0 && !selectedSegmentId) {
      setSelectedSegmentId(segments[0].id);
    }
  }, [segments, selectedSegmentId]);

  // Find currently active segment
  const activeSegment = useMemo(() => {
    return segments.find((s) => s.id === selectedSegmentId) || null;
  }, [segments, selectedSegmentId]);

  // Find currently active onion skin segment
  const onionSkinSegment = useMemo(() => {
    if (!onionSkinSegmentId) return null;
    return segments.find((s) => s.id === onionSkinSegmentId) || null;
  }, [segments, onionSkinSegmentId]);

  const handleToggleOnionSkin = (id: string | null) => {
    setOnionSkinSegmentId((prev) => (prev === id ? null : id));
  };

  const handleLoadPoints = (points: ToolpathPoint[], filename: string) => {
    pushToHistory();
    setRawPoints(points);
    setFileName(filename);
    setSelectedSegmentId(null);
    setSelectedPointId(null);
  };

  const handleSelectSegment = (id: string | null) => {
    setSelectedSegmentId(id);
    setSelectedPointId(null);
  };

  const handleSelectPoint = (id: string | null) => {
    setSelectedPointId(id);
  };

  const handleUpdatePointCoordinates = (id: string, x: number, y: number) => {
    setRawPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, x, y } : p))
    );
  };

  const handleUpdatePointDetails = (id: string, updatedFields: Partial<ToolpathPoint>) => {
    pushToHistory();
    setRawPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updatedFields } : p))
    );
  };

  const handleDeletePoint = (id: string) => {
    pushToHistory();
    setRawPoints((prev) => prev.filter((p) => p.id !== id));
    if (selectedPointId === id) {
      setSelectedPointId(null);
    }
  };

  const handleInsertPointAfter = (id: string) => {
    pushToHistory();
    const index = rawPoints.findIndex((p) => p.id === id);
    if (index === -1) return;
    const base = rawPoints[index];

    const offsetPt: ToolpathPoint = {
      id: generateId(),
      originalIndex: rawPoints.length,
      type: "Line passing", // Insert standard dispensing movement type 
      x: base.x + 5.0,
      y: base.y + 5.0,
      z: base.z,
      speed: base.speed
    };

    const newPoints = [...rawPoints];
    newPoints.splice(index + 1, 0, offsetPt);
    setRawPoints(newPoints);
    setSelectedPointId(offsetPt.id);
  };

  const handleRearrangePoints = (sourceId: string, targetId: string) => {
    pushToHistory();
    const sourceIndex = rawPoints.findIndex((p) => p.id === sourceId);
    const targetIndex = rawPoints.findIndex((p) => p.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

    const updated = [...rawPoints];
    const [removed] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, removed);
    setRawPoints(updated);
  };

  const handleUpdateSegmentZ = (segmentId: string, newZ: number) => {
    pushToHistory();
    const targetSegment = segments.find((s) => s.id === segmentId);
    if (!targetSegment) return;

    const idsToUpdate = new Set(targetSegment.points.map((p) => p.id));
    setRawPoints((prev) =>
      prev.map((p) => (idsToUpdate.has(p.id) ? { ...p, z: newZ } : p))
    );
  };

  // General manipulations
  const [shiftX, setShiftX] = useState<number>(0);
  const [shiftY, setShiftY] = useState<number>(0);
  const [scalePct, setScalePct] = useState<number>(100);

  const applyWorkspaceTweak = (type: "offset" | "scale") => {
    pushToHistory();
    if (type === "offset") {
      setRawPoints((prev) =>
        prev.map((p) => ({
          ...p,
          x: Math.round((p.x + shiftX) * 1000) / 1000,
          y: Math.round((p.y + shiftY) * 1000) / 1000
        }))
      );
      setShiftX(0);
      setShiftY(0);
    } else if (type === "scale") {
      const factor = scalePct / 100;
      setRawPoints((prev) =>
        prev.map((p) => ({
          ...p,
          x: Math.round(p.x * factor * 1000) / 1000,
          y: Math.round(p.y * factor * 1000) / 1000
        }))
      );
      setScalePct(100);
    }
  };

  // Global Toolpath stats calculation
  const globalStats = useMemo(() => {
    let length = 0;
    for (let i = 1; i < rawPoints.length; i++) {
      const dx = rawPoints[i].x - rawPoints[i - 1].x;
      const dy = rawPoints[i].y - rawPoints[i - 1].y;
      const dz = rawPoints[i].z - rawPoints[i - 1].z;
      length += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    const uniqueZs = Array.from(new Set(rawPoints.map((p) => p.z)));

    // Extract feed boundary limits
    const speeds = rawPoints.map((p) => p.speed);
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
    const minSpeed = speeds.length > 0 ? Math.min(...speeds) : 0;

    return {
      totalDistance: Math.round(length * 10) / 10,
      layerCount: uniqueZs.length,
      pointCount: rawPoints.length,
      maxSpeed,
      minSpeed
    };
  }, [rawPoints]);

  return (
    <div className="min-h-screen bg-[#f7f5e1] flex flex-col font-sans text-slate-800">
      
      {/* Header & upper system controls */}
      <Toolbar
        onLoadPoints={handleLoadPoints}
        points={rawPoints}
        fileName={fileName}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Main dashboard content workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-[1600px] w-full mx-auto" id="main-workspace-grid">
        
        {/* Left Section: Layer Selector and modifiers */}
        <div className="lg:col-span-3 space-y-6 flex flex-col h-full">
          
          <SegmentSidebar
            segments={segments}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={handleSelectSegment}
            onUpdateSegmentZ={handleUpdateSegmentZ}
            onionSkinSegmentId={onionSkinSegmentId}
            onToggleOnionSkin={handleToggleOnionSkin}
          />

          {/* CNC Modifiers tool card with bright styling */}
          <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-md space-y-4">
            <h3 className="font-semibold font-mono text-[11px] text-slate-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>Full Workpiece Modifiers</span>
            </h3>

            {/* Translate Shifter Offset */}
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Workpiece G-Code Offset</span>
                <button
                  onClick={() => applyWorkspaceTweak("offset")}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition text-[10px] font-mono font-bold cursor-pointer"
                  id="apply-offset-btn"
                >
                  APPLY OFFSET
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>
                  <label className="text-[9px] text-slate-500 block mb-0.5 font-semibold">X Shift (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={shiftX || ""}
                    onChange={(e) => setShiftX(parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                    className="w-full px-2 py-1 border border-slate-300 bg-white text-right text-slate-800 text-xs rounded focus:outline-none focus:border-indigo-500 font-mono"
                    id="offset-x-input"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 block mb-0.5 font-semibold">Y Shift (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={shiftY || ""}
                    onChange={(e) => setShiftY(parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                    className="w-full px-2 py-1 border border-slate-300 bg-white text-right text-slate-800 text-xs rounded focus:outline-none focus:border-indigo-500 font-mono"
                    id="offset-y-input"
                  />
                </div>
              </div>
            </div>

            {/* Resize Toolpath scale representation */}
            <div className="space-y-3.5 pt-3.5 border-t border-dashed border-slate-200 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Workpiece Scale factor</span>
                <button
                  onClick={() => applyWorkspaceTweak("scale")}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition text-[10px] font-mono font-bold cursor-pointer"
                  id="apply-scale-btn"
                >
                  APPLY SCALE
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="5"
                  value={scalePct}
                  onChange={(e) => setScalePct(parseInt(e.target.value) || 100)}
                  className="flex-1 accent-indigo-600 cursor-ew-resize opacity-90 hover:opacity-100"
                  id="scale-slider"
                />
                <span className="w-12 text-right font-mono text-[11px] font-bold text-indigo-600">{scalePct}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section: Active 2D SVG canvas graph viewport */}
        <div className="lg:col-span-6 aspect-square w-full h-auto max-w-full flex flex-col">
          <InteractiveGrid
            points={activeSegment ? activeSegment.points : []}
            onionSkinPoints={onionSkinSegment ? onionSkinSegment.points : undefined}
            selectedPointId={selectedPointId}
            onSelectPoint={handleSelectPoint}
            onUpdatePointCoordinates={handleUpdatePointCoordinates}
            gridSettings={gridSettings}
            setGridSettings={setGridSettings}
            highlightColor={activeSegment ? activeSegment.color : undefined}
            activeSegmentId={selectedSegmentId || undefined}
            onDragStart={() => pushToHistory()}
          />
        </div>

        {/* Right Section: Interactive coordinate spreadsheet */}
        <div className="lg:col-span-3 space-y-6 flex flex-col h-full">
          
          <PointListSidebar
            segmentPoints={activeSegment ? activeSegment.points : []}
            selectedPointId={selectedPointId}
            onSelectPoint={handleSelectPoint}
            onUpdatePointDetails={handleUpdatePointDetails}
            onDeletePoint={handleDeletePoint}
            onInsertPointAfter={handleInsertPointAfter}
            gridSettings={gridSettings}
            setGridSettings={setGridSettings}
            onRearrangePoints={handleRearrangePoints}
          />

          {/* Telemetry and Stats Console Container formatted precisely per design specs */}
          <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-md">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-700 font-bold mb-4 flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Dispensing Telemetry</span>
            </h4>
            
            {/* 2x2 grid stats */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="p-3 rounded border border-slate-200 bg-slate-50/50">
                <p className="text-[9px] font-mono uppercase text-slate-500 mb-1 font-bold">TOTAL NODES</p>
                <p className="text-xl font-bold text-slate-800 font-mono">{globalStats.pointCount}</p>
              </div>
              <div className="p-3 rounded border border-slate-200 bg-slate-50/50">
                <p className="text-[9px] font-mono uppercase text-slate-500 mb-1 font-bold">Z-LAYERS</p>
                <p className="text-xl font-bold text-indigo-700 font-mono">{globalStats.layerCount}</p>
              </div>
              <div className="p-3 rounded border border-slate-200 bg-slate-50/50">
                <p className="text-[9px] font-mono uppercase text-slate-500 mb-1 font-bold">FEED MAX</p>
                <p className="text-base font-bold text-emerald-700 font-mono">F{globalStats.maxSpeed}</p>
              </div>
              <div className="p-3 rounded border border-slate-200 bg-slate-50/50">
                <p className="text-[9px] font-mono uppercase text-slate-500 mb-1 font-bold">FEED MIN</p>
                <p className="text-base font-bold text-indigo-700 font-mono font-semibold">F{globalStats.minSpeed || 300}</p>
              </div>
            </div>

            {/* Total linear Euclidean machining track travel length stats */}
            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded flex items-center justify-between text-xs font-mono">
              <span className="text-indigo-800 font-semibold uppercase tracking-tight">Active Job Travel:</span>
              <span className="text-indigo-900 font-bold text-sm tracking-wide">{globalStats.totalDistance} mm</span>
            </div>
          </div>
        </div>

      </div>

      {/* Aesthetic Footer container */}
      <footer className="h-12 border-t border-slate-300 bg-white flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-8 text-[10px] font-mono text-slate-600 uppercase tracking-widest font-semibold">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            <span>CRITICAL PATH EDITOR</span>
          </div>
          <div className="hidden md:block">Toolhead: <span className="text-indigo-700 ml-1 font-bold">N02 Precision Dispenser</span></div>
          <div className="hidden sm:block">Status: <span className="text-emerald-700 ml-1 font-bold">Ready</span></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">MODE: ACTIVE</span>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
        </div>
      </footer>
    </div>
  );
}
