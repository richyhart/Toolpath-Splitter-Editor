/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from "react";
import { ToolpathPoint, GridSettings } from "../types";
import { Trash2, Plus, ToggleLeft, ToggleRight, Eye, EyeOff, Navigation } from "lucide-react";

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
  onRearrangePoints
}: PointListSidebarProps) {
  const activeRowRef = useRef<HTMLTableRowElement>(null);

  // HTML5 Drag and Drop sequence re-ordering states
  const [draggedPointId, setDraggedPointId] = React.useState<string | null>(null);
  const [dragOverPointId, setDragOverPointId] = React.useState<string | null>(null);

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

  return (
    <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-lg flex flex-col flex-1">
      {/* Workspace Controls Header */}
      <div className="bg-slate-100 px-4 py-3.5 border-b border-slate-300 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-slate-800 font-semibold font-mono text-[11px] uppercase tracking-widest flex items-center gap-2">
            <Navigation className="w-4 h-4 text-indigo-600" />
            <span>Layer Coordinates ({segmentPoints.length})</span>
          </span>
        </div>

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
      </div>

      {/* Coordinate Table */}
      <div className="overflow-x-auto overflow-y-auto flex-1 max-h-[400px] lg:max-h-[550px] bg-slate-50">
        {segmentPoints.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-400 font-mono text-xs">
            NO LAYER POINTS CHOSEN.<br />CHOOSE SEGMENT AT LEFT.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-[11px] select-none">
            <thead>
              <tr className="bg-slate-200/80 border-b border-slate-300 text-[10px] text-slate-600 uppercase tracking-wider font-mono">
                <th className="py-2.5 px-3 text-center">#</th>
                <th className="py-2.5 px-2">CMD TYPE</th>
                <th className="py-2.5 px-2 text-right">X (mm)</th>
                <th className="py-2.5 px-2 text-right">Y (mm)</th>
                <th className="py-2.5 px-2 text-right">FEED</th>
                <th className="py-2.5 px-3 text-center">ACTIONS</th>
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
                    {/* Index Grab handle column */}
                    <td 
                      draggable
                      onDragStart={(e) => handleDragStart(e, pt.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPoint(pt.id);
                      }}
                      className="py-2 px-1 text-center font-medium text-indigo-600 text-[10px] cursor-grab active:cursor-grabbing hover:bg-indigo-100 hover:text-indigo-800 transition select-none"
                      title="Drag to rearrange sequence of nodes"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="text-slate-400 font-light select-none text-[8px] mr-0.5">⋮⋮</span>
                        <span className="font-bold">{idy + 1}</span>
                      </div>
                    </td>

                    {/* Mode Type dropdown - exactly Start of line dispense, Line passing, End of line dispense */}
                    <td className="py-1.5 px-1.5">
                      <select
                        value={pt.type}
                        onChange={(e) => onUpdatePointDetails(pt.id, { type: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-[10px] text-slate-800 bg-white border border-slate-300 rounded px-1 bg-no-repeat focus:outline-none focus:border-indigo-500 max-w-[140px]"
                        id={`point-type-select-${pt.id}`}
                      >
                        <option value="Start of line dispense">Start of line dispense</option>
                        <option value="Line passing">Line passing</option>
                        <option value="End of line dispense">End of line dispense</option>
                      </select>
                    </td>

                    {/* X input cell */}
                    <td className="py-1.5 px-1">
                      <input
                        type="number"
                        step="0.1"
                        value={pt.x}
                        onChange={(e) => onUpdatePointDetails(pt.id, { x: parseFloat(e.target.value) || 0 })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-14 px-1.5 py-0.5 border border-slate-300 bg-white text-right rounded focus:outline-none focus:border-indigo-500 font-mono text-slate-800"
                        id={`point-x-input-${pt.id}`}
                      />
                    </td>

                    {/* Y input cell */}
                    <td className="py-1.5 px-1">
                      <input
                        type="number"
                        step="0.1"
                        value={pt.y}
                        onChange={(e) => onUpdatePointDetails(pt.id, { y: parseFloat(e.target.value) || 0 })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-14 px-1.5 py-0.5 border border-slate-300 bg-white text-right rounded focus:outline-none focus:border-indigo-500 font-mono text-slate-800"
                        id={`point-y-input-${pt.id}`}
                      />
                    </td>

                    {/* Feed speed cell */}
                    <td className="py-1.5 px-1">
                      <input
                        type="number"
                        step="50"
                        value={pt.speed}
                        onChange={(e) => onUpdatePointDetails(pt.id, { speed: parseFloat(e.target.value) || 0 })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-14 px-1 py-0.5 border border-slate-300 bg-white text-right rounded focus:outline-none focus:border-indigo-500 font-mono text-slate-800"
                        id={`point-speed-input-${pt.id}`}
                      />
                    </td>

                    {/* Add/Delete coordinate node actions */}
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
