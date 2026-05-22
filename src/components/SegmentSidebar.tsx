/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ToolpathSegment } from "../types";
import { Layers, Edit3, Check, Scale, Ghost } from "lucide-react";

interface SegmentSidebarProps {
  segments: ToolpathSegment[];
  selectedSegmentId: string | null;
  onSelectSegment: (id: string | null) => void;
  onUpdateSegmentZ: (segmentId: string, newZ: number) => void;
  onionSkinSegmentId: string | null;
  onToggleOnionSkin: (id: string | null) => void;
}

export default function SegmentSidebar({
  segments,
  selectedSegmentId,
  onSelectSegment,
  onUpdateSegmentZ,
  onionSkinSegmentId,
  onToggleOnionSkin
}: SegmentSidebarProps) {
  const [editingZId, setEditingZId] = useState<string | null>(null);
  const [tempZValue, setTempZValue] = useState<string>("");

  // Calculate Euclidean total length of path movements inside a segment
  const calculateSegmentStats = (seg: ToolpathSegment) => {
    let length = 0;
    const pts = seg.points;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }

    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const bounds = pts.length > 0 
      ? {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys)
        }
      : { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    return {
      travel: Math.round(length * 10) / 10,
      bounds
    };
  };

  const startEditingZ = (e: React.MouseEvent, seg: ToolpathSegment) => {
    e.stopPropagation();
    setEditingZId(seg.id);
    setTempZValue(seg.zValue.toString());
  };

  const saveEditingZ = (segId: string) => {
    const val = parseFloat(tempZValue);
    if (!isNaN(val)) {
      onUpdateSegmentZ(segId, val);
    }
    setEditingZId(null);
  };

  return (
    <div className="w-full bg-white border border-slate-300 rounded-lg overflow-hidden shadow-lg flex flex-col h-[320px] lg:h-[620px]">
      {/* Sidebar Header */}
      <div className="bg-slate-100 px-4 py-3.5 border-b border-slate-300 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800 font-semibold font-mono text-[11px] uppercase tracking-widest">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>Z-Axis Segments (Layers)</span>
        </div>
        <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 font-mono px-2 py-0.5 rounded-full font-bold">
          TOTAL: {segments.length}
        </span>
      </div>

      {/* Layer List */}
      <div className="p-3 overflow-y-auto divide-y divide-slate-100 flex-1 space-y-2.5 bg-slate-50/50">
        {segments.length === 0 ? (
          <div className="text-center py-10 text-slate-400 font-mono text-xs">
            NO LAYER SEGMENTS DETECTED.<br />UPLOAD FILE TO SLICE.
          </div>
        ) : (
          segments.map((seg, idx) => {
            const isSelected = seg.id === selectedSegmentId;
            const isOnionSkin = seg.id === onionSkinSegmentId;
            const { travel, bounds } = calculateSegmentStats(seg);

            return (
              <div
                key={seg.id}
                onClick={() => onSelectSegment(seg.id)}
                className={`p-3 rounded transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-indigo-50/90 border-indigo-200 text-indigo-900 shadow-sm"
                    : "border-transparent bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800"
                }`}
                id={`segment-row-${seg.id}`}
              >
                {/* Segment Title and Color Node Indicator */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    {/* Vertical Segment highlight bar matching instructions */}
                    <div className={`w-1 h-8 rounded-full ${isSelected ? "bg-indigo-600" : "bg-slate-200"}`}></div>
                    <div>
                      <p className={`text-xs font-bold ${isSelected ? "text-indigo-900" : "text-slate-700"}`}>
                        Segment #{idx + 1}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 pt-0.5">
                        Points: {seg.points.length}
                      </p>
                    </div>
                  </div>

                  {/* Actions area with Onion skin overlay toggle & Z coordinate modifier */}
                  <div className="flex items-center gap-2">
                    {/* Onion Skin button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleOnionSkin(seg.id);
                      }}
                      className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold flex items-center gap-1 transition-all ${
                        isOnionSkin
                          ? "bg-fuchsia-50 hover:bg-fuchsia-100 border-fuchsia-300 text-fuchsia-700 shadow-sm"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600"
                      }`}
                      title={isOnionSkin ? "Turn off Onion Skin Overlay" : "Overlay this segment in fuchsia behind working segment"}
                    >
                      <Ghost className={`w-3 h-3 ${isOnionSkin ? "stroke-fuchsia-600 animate-pulse" : "stroke-slate-400"}`} />
                      <span>{isOnionSkin ? "OVERLAY" : "SKIN"}</span>
                    </button>

                    {/* Z Coordinate Modifier */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {editingZId === seg.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-slate-500 font-mono text-[10px]">&Delta;Z:</span>
                          <input
                            type="number"
                            step="0.05"
                            value={tempZValue}
                            onChange={(e) => setTempZValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditingZ(seg.id);
                            }}
                            className="w-14 px-1.5 py-0.5 border border-indigo-400 rounded bg-white text-slate-800 font-mono text-[11px] text-right focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEditingZ(seg.id)}
                            className="p-1 text-emerald-600 hover:bg-slate-100 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 font-mono">
                          <span className="text-[10px] text-slate-400">Z:</span>
                          <strong className={`px-1.5 py-0.5 rounded font-mono text-[10.5px] font-bold ${isSelected ? "text-indigo-700 bg-indigo-100/60" : "text-slate-700 bg-slate-100"}`}>
                            {seg.zValue.toFixed(4)}
                          </strong>
                          <button
                            onClick={(e) => startEditingZ(e, seg)}
                            className={`p-1 rounded opacity-60 hover:opacity-100 transition ${isSelected ? "hover:text-indigo-600 hover:bg-indigo-100" : "hover:text-indigo-500 hover:bg-slate-100"}`}
                            title="Recalibrate Layer Height"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-stats layout */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono mt-2 pt-2 border-t border-slate-100 text-slate-400">
                  <div>Travel distance: <strong className={isSelected ? "text-indigo-700" : "text-slate-600"}>{travel}mm</strong></div>
                  <div className="text-right">
                    {isSelected && (
                      <span className="text-[8px] uppercase tracking-wider font-bold text-indigo-700 px-1.5 py-0.5 rounded bg-indigo-100">ACTIVE</span>
                    )}
                  </div>
                  <div className="col-span-2 text-[8.5px] flex items-center gap-1 mt-1 text-slate-400">
                    <Scale className="w-2.5 h-2.5 text-slate-400" />
                    <span>X: [{bounds.minX.toFixed(1)}, {bounds.maxX.toFixed(1)}]</span>
                    <span>•</span>
                    <span>Y: [{bounds.minY.toFixed(1)}, {bounds.maxY.toFixed(1)}]</span>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
