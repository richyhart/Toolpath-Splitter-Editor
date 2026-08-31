/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from "react";
import { ToolpathPoint, GridSettings } from "../types";
import { Trash2, Plus, ToggleLeft, ToggleRight, Eye, EyeOff, Navigation, Keyboard } from "lucide-react";

interface CoordinateInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  id?: string;
}

function CoordinateInput({ value, onChange, className, id }: CoordinateInputProps) {
  const [tempValue, setTempValue] = React.useState<string>("");
  const [isFocused, setIsFocused] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isFocused) {
      setTempValue(value.toFixed(3));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempValue(e.target.value);
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(tempValue);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else {
      onChange(0);
      setTempValue((0).toFixed(3));
    }
  };

  return (
    <input
      type="number"
      step="0.001"
      value={tempValue}
      onChange={handleChange}
      onFocus={() => {
        setIsFocused(true);
        setTempValue(value.toString());
      }}
      onBlur={handleBlur}
      className={className}
      id={id}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

interface PointListSidebarProps {
  segmentPoints: ToolpathPoint[];
  selectedPointId: string | null;
  onSelectPoint: (id: string | null) => void;
  onUpdatePointDetails: (id: string, updatedFields: Partial<ToolpathPoint>) => void;
  onDeletePoint: (id: string) => void;
  onInsertPointAfter: (id: string) => void;
  gridSettings: GridSettings;
  setGridSettings: React.Dispatch<React.SetStateAction<GridSettings>>;
  onRearrangePoints?: (sourceId: string, targetId: string) => void;
  insertOffset: { x: number; y: number };
  onUpdateInsertOffset: (offset: { x: number; y: number }) => void;
  insertMode: "before" | "after";
  onUpdateInsertMode: (mode: "before" | "after") => void;
  onAddFirstPointToSegment?: () => void;
  isArrowDrawingEnabled: boolean;
  onToggleArrowDrawing: () => void;
  arrowDrawDistance: number;
  onUpdateArrowDrawDistance: (distance: number) => void;
}

export default function PointListSidebar({
  segmentPoints,
  selectedPointId,
  onSelectPoint,
  onUpdatePointDetails,
  onDeletePoint,
  onInsertPointAfter,
  gridSettings,
  setGridSettings,
  onRearrangePoints,
  insertOffset,
  onUpdateInsertOffset,
  insertMode,
  onUpdateInsertMode,
  onAddFirstPointToSegment,
  isArrowDrawingEnabled,
  onToggleArrowDrawing,
  arrowDrawDistance,
  onUpdateArrowDrawDistance
}: PointListSidebarProps) {
  const activeRowRef = useRef<HTMLTableRowElement>(null);

  // HTML5 Drag and Drop sequence re-ordering states
  const [draggedPointId, setDraggedPointId] = React.useState<string | null>(null);
  const [dragOverPointId, setDragOverPointId] = React.useState<string | null>(null);

  // Manual key-in point number index re-ordering
  const [editingIndexId, setEditingIndexId] = React.useState<string | null>(null);
  const [tempIndexValue, setTempIndexValue] = React.useState<string>("");

  const handleSavePointNumber = (pointId: string, currentIndex: number) => {
    setEditingIndexId(null);
    const parsed = parseInt(tempIndexValue, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > segmentPoints.length) {
      return;
    }
    const targetIndex = parsed - 1;
    if (targetIndex === currentIndex) {
      return;
    }
    const targetPoint = segmentPoints[targetIndex];
    if (targetPoint && onRearrangePoints) {
      onRearrangePoints(pointId, targetPoint.id);
    }
  };

  const handleDragStart = (e: React.DragEvent, pointId: string) => {
    e.dataTransfer.setData("text/plain", pointId);
    setDraggedPointId(pointId);
  };

  const handleDragOver = (e: React.DragEvent, pointId: string) => {
    e.preventDefault();
    if (pointId !== draggedPointId) {
      setDragOverPointId(pointId);
    }
  };

  const handleDragLeave = () => {
    setDragOverPointId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain") || draggedPointId;
    if (sourceId && sourceId !== targetId) {
      if (onRearrangePoints) {
        onRearrangePoints(sourceId, targetId);
      }
    }
    setDraggedPointId(null);
    setDragOverPointId(null);
  };

  const handleDragEnd = () => {
    setDraggedPointId(null);
    setDragOverPointId(null);
  };

  // Auto-scroll the active selected point coordinate row into view
  useEffect(() => {
    if (selectedPointId && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedPointId]);

  // Keyboard shortcut listener to Add Point (+) and Delete Point (Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut actions if any text/form input is active to avoid disrupting typing
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        if (
          tagName === "INPUT" ||
          tagName === "SELECT" ||
          tagName === "TEXTAREA" ||
          activeEl.hasAttribute("contenteditable")
        ) {
          return;
        }
      }

      if (e.key === "+") {
        e.preventDefault();
        if (selectedPointId) {
          onInsertPointAfter(selectedPointId);
        } else if (segmentPoints.length > 0) {
          onInsertPointAfter(segmentPoints[segmentPoints.length - 1].id);
        }
      } else if (e.key === "Delete") {
        e.preventDefault();
        if (selectedPointId) {
          onDeletePoint(selectedPointId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPointId, segmentPoints, onInsertPointAfter, onDeletePoint]);

  return (
    <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-lg flex flex-col flex-1">
      {/* Workspace Controls Header */}
      <div className="bg-slate-100 px-4 py-3.5 border-b border-slate-300 space-y-3">
        <div className="flex items-center justify-between gap-1">
          <span className="text-slate-800 font-semibold font-mono text-[11px] uppercase tracking-widest flex items-center gap-2">
            <Navigation className="w-4 h-4 text-indigo-600" />
            <span>Layer Coordinates ({segmentPoints.length})</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Step size input box designed precisely for space-efficient integration */}
            <div className="flex items-center bg-white border border-slate-300 rounded px-1.5 py-0.5" title="Arrow Key Step Distance (mm)">
              <input
                type="number"
                step="0.5"
                min="0.1"
                max="50"
                value={arrowDrawDistance}
                onChange={(e) => onUpdateArrowDrawDistance(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="w-10 border-none bg-transparent text-right font-mono text-[10px] text-slate-800 font-bold focus:outline-none p-0"
              />
              <span className="text-slate-400 text-[8px] font-bold uppercase font-mono ml-0.5">mm</span>
            </div>
            <button
              onClick={onToggleArrowDrawing}
              className={`py-1 px-2.5 rounded border font-mono text-[9px] font-bold uppercase transition flex items-center gap-1.5 cursor-pointer select-none ${
                isArrowDrawingEnabled
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 font-extrabold shadow-sm"
                  : "bg-white hover:bg-slate-50 text-slate-600 border-slate-300 hover:text-slate-800"
              }`}
              id="toggle-arrow-draw-btn"
              title="Enable using arrow keys (↑ ↓ ← →) to draw new points"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>{isArrowDrawingEnabled ? "KEYBOARD ON" : "Arrow Draw"}</span>
            </button>
          </div>
        </div>

        {isArrowDrawingEnabled && (
          <div className="bg-amber-50 border border-amber-200 p-2 rounded text-[10px] text-amber-950 font-mono flex flex-col gap-0.5 shadow-sm animate-pulse-subtle">
            <div className="font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              <span>ARROW DRAWING MODE ON</span>
            </div>
            <p className="text-slate-600 leading-normal">
              Press <span className="font-bold text-slate-800 bg-amber-100 px-0.5 rounded">↑</span> / <span className="font-bold text-slate-800 bg-amber-100 px-0.5 rounded">↓</span> / <span className="font-bold text-slate-800 bg-amber-100 px-0.5 rounded">←</span> / <span className="font-bold text-slate-800 bg-amber-100 px-0.5 rounded">→</span> on your keyboard to instantly add coordinates <span className="font-bold text-slate-900 bg-amber-150 px-0.5 rounded">{arrowDrawDistance}mm</span> away!
            </p>
          </div>
        )}

        {/* Snapping and Visibility Settings card */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded border border-slate-200 text-[11px] text-slate-600">
          <div className="flex items-center justify-between border-r border-slate-200 pr-2.5">
            <span className="font-mono text-[10px] uppercase font-semibold text-slate-700">Snap Grid</span>
            <button
              onClick={() => setGridSettings(prev => ({ ...prev, snapToGrid: !prev.snapToGrid }))}
              className="hover:text-indigo-600 transition cursor-pointer"
              id="snap-toggle-btn"
            >
              {gridSettings.snapToGrid ? (
                <ToggleRight className="w-7 h-7 text-indigo-600" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-slate-400" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between pl-2">
            <span className="font-mono text-[10px] uppercase font-semibold text-slate-700">Pitch</span>
            <select
              value={gridSettings.gridSize}
              onChange={(e) => setGridSettings(prev => ({ ...prev, gridSize: parseFloat(e.target.value) }))}
              className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-slate-800 text-[10px] focus:outline-none focus:border-indigo-500 font-mono"
              id="grid-size-select"
            >
              <option value="1">1.0 mm</option>
              <option value="2.5">2.5 mm</option>
              <option value="5">5.0 mm</option>
              <option value="10">10 mm</option>
            </select>
          </div>

          <div className="flex items-center justify-between border-r border-slate-200 pr-2.5 pt-2 mt-1.5 border-t border-dashed border-slate-200">
            <span className="font-mono text-[10px] uppercase font-semibold text-slate-700">Node dots</span>
            <button
              onClick={() => setGridSettings(prev => ({ ...prev, showPoints: !prev.showPoints }))}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors cursor-pointer"
              title="Show Point Handles"
              id="points-visibility-toggle"
            >
              {gridSettings.showPoints ? <Eye className="w-4 h-4 text-indigo-600" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between pl-2 pt-2 mt-1.5 border-t border-dashed border-slate-200">
            <span className="font-mono text-[10px] uppercase font-semibold text-slate-700">vectors</span>
            <button
              onClick={() => setGridSettings(prev => ({ ...prev, showArrows: !prev.showArrows }))}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors cursor-pointer"
              title="Show Motion Vectors"
              id="vectors-visibility-toggle"
            >
              {gridSettings.showArrows ? <Eye className="w-4 h-4 text-indigo-500" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between border-r border-slate-200 pr-2.5 pt-2 mt-1.5 border-t border-dashed border-slate-200">
            <span className="font-mono text-[10px] uppercase font-semibold text-slate-700">Dot numbers</span>
            <button
              onClick={() => setGridSettings(prev => ({ ...prev, showNodeNumbers: !prev.showNodeNumbers }))}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors cursor-pointer"
              title="Show Numerical Labels on Grid Points"
              id="node-numbers-visibility-toggle"
            >
              {gridSettings.showNodeNumbers ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between pl-2 pt-2 mt-1.5 border-t border-dashed border-slate-200 text-slate-400 font-mono text-[8px] uppercase font-semibold">
            <span>Drag '#' to order</span>
          </div>
        </div>

        {/* Default Coordinate Insertion Offset Card */}
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] text-slate-600 flex flex-col gap-2">
          <div className="font-mono text-[9px] uppercase font-semibold text-slate-700 tracking-wider flex items-center justify-between">
            <span>New Coordinate Default Offset</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-1.5 bg-white border border-slate-200 rounded px-2 py-1">
              <span className="font-mono text-[10px] text-slate-500 font-semibold">X (mm)</span>
              <input
                type="number"
                step="0.001"
                value={insertOffset.x}
                onChange={(e) => onUpdateInsertOffset({ ...insertOffset, x: parseFloat(e.target.value) || 0 })}
                className="w-14 text-right rounded focus:outline-none focus:border-indigo-500 font-mono text-slate-800 text-[10px] p-0"
                id="insert-offset-x-input"
              />
            </div>
            <div className="flex items-center justify-between gap-1.5 bg-white border border-slate-200 rounded px-2 py-1">
              <span className="font-mono text-[10px] text-slate-500 font-semibold">Y (mm)</span>
              <input
                type="number"
                step="0.001"
                value={insertOffset.y}
                onChange={(e) => onUpdateInsertOffset({ ...insertOffset, y: parseFloat(e.target.value) || 0 })}
                className="w-14 text-right rounded focus:outline-none focus:border-indigo-500 font-mono text-slate-800 text-[10px] p-0"
                id="insert-offset-y-input"
              />
            </div>
          </div>

          {/* Insertion Mode Select Toggle */}
          <div className="border-t border-dashed border-slate-200 pt-2 mt-1 flex flex-col gap-1.5">
            <div className="font-mono text-[8.5px] uppercase font-semibold text-slate-500 tracking-wider">
              Insertion Direction Mode
            </div>
            <div className="grid grid-cols-2 p-0.5 bg-slate-200/80 border border-slate-300 rounded text-center">
              <button
                onClick={() => onUpdateInsertMode("before")}
                className={`py-1 text-center font-bold rounded text-[9px] uppercase tracking-wide transition-all duration-150 cursor-pointer ${
                  insertMode === "before"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-800 hover:bg-slate-300/45"
                }`}
                id="insert-mode-before-btn"
              >
                Before Selected
              </button>
              <button
                onClick={() => onUpdateInsertMode("after")}
                className={`py-1 text-center font-bold rounded text-[9px] uppercase tracking-wide transition-all duration-150 cursor-pointer ${
                  insertMode === "after"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-800 hover:bg-slate-300/45"
                }`}
                id="insert-mode-after-btn"
              >
                After Selected
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Coordinate Table */}
      <div className="overflow-x-auto overflow-y-auto flex-1 max-h-[400px] lg:max-h-[550px] bg-slate-50">
        {segmentPoints.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-400 font-mono text-xs flex flex-col items-center justify-center gap-3">
            <span>
              NO LAYER POINTS DETECTED ON THIS SEGMENT.<br />
              THIS SEGMENT IS CURRENTLY EMPTY.
            </span>
            {onAddFirstPointToSegment && (
              <button
                onClick={() => onAddFirstPointToSegment()}
                className="mt-2 py-1.5 px-3 bg-indigo-650 hover:bg-indigo-700 text-white font-mono text-[10px] font-bold uppercase rounded border border-indigo-700 hover:shadow-md transition duration-150 flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                id="add-first-point-btn"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Coordinate</span>
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-[11px] select-none">
            <thead>
              <tr className="bg-slate-200/80 border-b border-slate-300 text-[10px] text-slate-600 uppercase tracking-wider font-mono">
                <th className="py-2.5 px-3 text-center">ACTIONS</th>
                <th className="py-2.5 px-3 text-center">#</th>
                <th className="py-2.5 px-2 text-right">X (mm)</th>
                <th className="py-2.5 px-2 text-right">Y (mm)</th>
                <th className="py-2.5 px-2 text-right">SPEED</th>
                <th className="py-2.5 px-2">CMD TYPE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
              {segmentPoints.map((pt, idy) => {
                const isSelected = pt.id === selectedPointId;
                const isDragOver = pt.id === dragOverPointId;
                const isDragged = pt.id === draggedPointId;

                return (
                  <tr
                     key={pt.id}
                     ref={isSelected ? activeRowRef : null}
                     onClick={() => onSelectPoint(pt.id)}
                     onDragOver={(e) => handleDragOver(e, pt.id)}
                     onDragLeave={handleDragLeave}
                     onDrop={(e) => handleDrop(e, pt.id)}
                     className={`transition duration-150 cursor-pointer ${
                       isSelected 
                         ? "bg-indigo-50 border-y border-indigo-200 text-indigo-900 font-medium" 
                         : "hover:bg-slate-100/80"
                     } ${
                       isDragOver ? "border-t-[3px] border-indigo-600 bg-indigo-50/70" : ""
                     } ${
                       isDragged ? "opacity-40 bg-slate-200/50" : ""
                     }`}
                     id={`point-row-${pt.id}`}
                  >
                    {/* Add/Delete coordinate node actions column first */}
                    <td className="py-1.5 px-3 text-center flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInsertPointAfter(pt.id);
                        }}
                        className="p-1 hover:bg-indigo-100 text-indigo-600 rounded transition-all cursor-pointer"
                        title="Insert Point After This Node"
                        id={`insert-point-btn-${pt.id}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePoint(pt.id);
                        }}
                        className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-all cursor-pointer"
                        title="Remove Coordinate Node"
                        id={`delete-point-btn-${pt.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>

                    {/* Index Grab handle column second with inline click-to-edit index resequence */}
                    <td 
                      draggable={editingIndexId !== pt.id}
                      onDragStart={(e) => handleDragStart(e, pt.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPoint(pt.id);
                      }}
                      className="py-2 px-1 text-center font-medium text-indigo-600 text-[10px] cursor-grab active:cursor-grabbing hover:bg-opacity-95 hover:bg-indigo-100/40 transition select-none"
                      title="Click directly on the point number to manually type/edit its order index, or drag to reorder"
                    >
                      {editingIndexId === pt.id ? (
                        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            min="1"
                            max={segmentPoints.length}
                            value={tempIndexValue}
                            onChange={(e) => setTempIndexValue(e.target.value)}
                            onBlur={() => handleSavePointNumber(pt.id, idy)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSavePointNumber(pt.id, idy);
                              } else if (e.key === "Escape") {
                                setEditingIndexId(null);
                              }
                            }}
                            className="w-11 h-6 px-1 text-center font-bold font-mono text-[11px] bg-white text-indigo-950 border border-indigo-500 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-sm"
                            autoFocus
                            id={`point-index-input-${pt.id}`}
                          />
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-center gap-0.5 group cursor-pointer h-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingIndexId(pt.id);
                            setTempIndexValue((idy + 1).toString());
                          }}
                        >
                          <span className="text-slate-400 font-light select-none text-[8px] mr-0.5 group-hover:text-indigo-600">⋮⋮</span>
                          <span className="font-bold underline decoration-dotted decoration-indigo-400/75 group-hover:decoration-solid group-hover:text-indigo-800 text-indigo-650" title="Click to edit point order index">
                            {idy + 1}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* X input cell */}
                    <td className="py-1.5 px-1 pr-2">
                      <CoordinateInput
                        value={pt.x}
                        onChange={(val) => onUpdatePointDetails(pt.id, { x: val })}
                        className="w-[75px] px-1 py-0.5 border border-slate-300 bg-white text-right rounded focus:outline-none focus:border-indigo-500 font-mono text-slate-800 text-[11px] ml-auto block"
                        id={`point-x-input-${pt.id}`}
                      />
                    </td>

                    {/* Y input cell */}
                    <td className="py-1.5 px-1 pr-2">
                      <CoordinateInput
                        value={pt.y}
                        onChange={(val) => onUpdatePointDetails(pt.id, { y: val })}
                        className="w-[75px] px-1 py-0.5 border border-slate-300 bg-white text-right rounded focus:outline-none focus:border-indigo-500 font-mono text-slate-800 text-[11px] ml-auto block"
                        id={`point-y-input-${pt.id}`}
                      />
                    </td>

                    {/* Speed input cell */}
                    <td className="py-1.5 px-1 pr-2">
                       <input
                         type="number"
                         step="50"
                         value={pt.speed}
                         onChange={(e) => onUpdatePointDetails(pt.id, { speed: parseFloat(e.target.value) || 0 })}
                         onClick={(e) => e.stopPropagation()}
                         className="w-full max-w-[175px] px-1 py-0.5 border border-slate-300 bg-white text-right rounded focus:outline-none focus:border-indigo-500 font-mono text-slate-800 text-[11px] ml-auto block"
                         id={`point-speed-input-${pt.id}`}
                       />
                    </td>
                    {/* CMD Type dropdown - furthest right side of the tab after speed */}
                    <td className="py-1.5 px-1.5 text-left">
                      <select
                        value={pt.type}
                        onChange={(e) => onUpdatePointDetails(pt.id, { type: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-[10px] text-slate-800 bg-white border border-slate-300 rounded px-1 bg-no-repeat focus:outline-none focus:border-indigo-500 max-w-[140px]"
                        id={`point-type-select-${pt.id}`}
                      >
                        <option value="Start of Line Dispense">Start of Line Dispense</option>
                        <option value="Line Passing">Line Passing</option>
                        <option value="End of Line Dispense">End of Line Dispense</option>
                        {!["Start of Line Dispense", "Line Passing", "End of Line Dispense"].includes(pt.type) && (
                          <option value={pt.type}>{pt.type}</option>
                        )}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
