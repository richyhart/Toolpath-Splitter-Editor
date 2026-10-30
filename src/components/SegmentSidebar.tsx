/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ToolpathSegment } from "../types";
import { Layers, Edit3, Edit2, Check, X, Scale, Ghost, Download, Plus, Trash2, Copy, ArrowLeftRight } from "lucide-react";
import { exportToCSV, exportToXLSX } from "../utils";

interface SegmentSidebarProps {
  segments: ToolpathSegment[];
  selectedSegmentId: string | null;
  onSelectSegment: (id: string | null) => void;
  onUpdateSegmentZ: (segmentId: string, newZ: number) => void;
  onionSkinSegmentId: string | null;
  onToggleOnionSkin: (id: string | null) => void;
  fileName?: string;
  onAddEmptySegment?: (zValue: number) => void;
  onDeleteSegments?: (ids: string[]) => void;
  onRenameSegment?: (segmentId: string, newName: string) => void;
  onDuplicateSegment?: (segmentId: string, newZ: number, newName?: string) => void;
  onInvertSegment?: (segmentId: string) => void;
  onInvertSegments?: (segmentIds: string[]) => void;
}

export default function SegmentSidebar({
  segments,
  selectedSegmentId,
  onSelectSegment,
  onUpdateSegmentZ,
  onionSkinSegmentId,
  onToggleOnionSkin,
  fileName,
  onAddEmptySegment,
  onDeleteSegments,
  onRenameSegment,
  onDuplicateSegment,
  onInvertSegment,
  onInvertSegments
}: SegmentSidebarProps) {
  const [editingZId, setEditingZId] = useState<string | null>(null);
  const [tempZValue, setTempZValue] = useState<string>("");
  const [newZInput, setNewZInput] = useState<string>("1.000");
  const [withSegmentExportDropdown, setWithSegmentExportDropdown] = useState(false);

  // Segment Rename state
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [tempNameValue, setTempNameValue] = useState<string>("");

  // Duplicate Segment modal state
  const [duplicateModal, setDuplicateModal] = useState<{
    segment: ToolpathSegment;
    segmentNum: number;
    newZ: string;
    newName: string;
  } | null>(null);

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    ids: string[];
    title: string;
    description: string;
  } | null>(null);

  // Update default new Z value when segments content changes
  useEffect(() => {
    if (segments.length > 0) {
      const realSegments = segments.filter(s => !s.id.startsWith("empty-segment-"));
      const referenceSegments = realSegments.length > 0 ? realSegments : segments;
      const maxZ = Math.max(...referenceSegments.map((s) => s.zValue));
      setNewZInput((maxZ + 1.0).toFixed(3));
    } else {
      setNewZInput("1.000");
    }
  }, [segments.length]);

  // Track checked segments for CSV export
  const [checkedSegmentIds, setCheckedSegmentIds] = useState<Set<string>>(new Set());

  // Automatically select all segment checkboxes on segments length/data refresh
  useEffect(() => {
    if (segments && segments.length > 0) {
      setCheckedSegmentIds(new Set(segments.map((s) => s.id)));
    } else {
      setCheckedSegmentIds(new Set());
    }
  }, [segments]);

  // Toggle individual layer checkbox
  const handleToggleCheck = (segmentId: string) => {
    setCheckedSegmentIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(segmentId)) {
        updated.delete(segmentId);
      } else {
        updated.add(segmentId);
      }
      return updated;
    });
  };

  // Toggle all checkboxes
  const handleToggleAll = () => {
    if (checkedSegmentIds.size === segments.length) {
      setCheckedSegmentIds(new Set());
    } else {
      setCheckedSegmentIds(new Set(segments.map((s) => s.id)));
    }
  };

  // Export checked segments to CSV format
  const handleExportSelectedCSV = () => {
    const selectedPoints = segments
      .filter((seg) => checkedSegmentIds.has(seg.id))
      .flatMap((seg) => seg.points);

    if (selectedPoints.length === 0) return;

    const csvContent = exportToCSV(selectedPoints);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const baseName = fileName ? fileName.replace(/\.csv$/i, "") : "helix_spiral_sample";
    link.setAttribute("download", `${baseName}_selected_layers.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSelectedXLSX = () => {
    const selectedPoints = segments
      .filter((seg) => checkedSegmentIds.has(seg.id))
      .flatMap((seg) => seg.points);

    if (selectedPoints.length === 0) return;

    try {
      const excelBuffer = exportToXLSX(selectedPoints);
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.setAttribute("href", url);
      
      const baseName = fileName ? fileName.replace(/\.csv$/i, "") : "helix_spiral_sample";
      link.setAttribute("download", `${baseName}_selected_layers.xlsx`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error generating Excel file: " + err);
    }
  };

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

  const handleDeleteIndividualClick = (segmentId: string, segmentNum: number, segName?: string) => {
    setDeleteConfirmation({
      ids: [segmentId],
      title: "Delete Segment",
      description: `Are you sure you want to delete ${segName || `Segment ${segmentNum}`}? All coordinate points belonging to this Z axis level will be permanently deleted.`
    });
  };

  const handleDeleteBatchClick = () => {
    const selectedIds = Array.from(checkedSegmentIds);
    if (selectedIds.length === 0) return;
    setDeleteConfirmation({
      ids: selectedIds,
      title: "Delete Selected Segments",
      description: `Are you sure you want to delete the ${selectedIds.length} selected Z-axis segments? All coordinate points belonging to these layers will be permanently deleted.`
    });
  };

  const confirmDeleteAction = () => {
    if (!deleteConfirmation) return;
    if (onDeleteSegments) {
      onDeleteSegments(deleteConfirmation.ids);
      // Remove deleted IDs from checked list
      setCheckedSegmentIds((prev) => {
        const next = new Set(prev);
        deleteConfirmation.ids.forEach((id) => next.delete(id));
        return next;
      });
    }
    setDeleteConfirmation(null);
  };

  // Renaming segment handlers
  const startEditingName = (seg: ToolpathSegment, segmentNum: number) => {
    setEditingNameId(seg.id);
    setTempNameValue(seg.name || `Segment ${segmentNum}`);
  };

  const saveEditingName = (segId: string) => {
    const trimmed = tempNameValue.trim();
    if (trimmed && onRenameSegment) {
      onRenameSegment(segId, trimmed);
    }
    setEditingNameId(null);
  };

  // Suggest intelligent next non-colliding Z height for duplicates
  const suggestNextZ = (targetSeg: ToolpathSegment, allSegs: ToolpathSegment[]): string => {
    if (allSegs.length === 0) return "1.000";
    const existingZs = new Set(allSegs.map((s) => parseFloat(s.zValue.toFixed(4))));

    let step = 1.0;
    if (allSegs.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < allSegs.length; i++) {
        diffs.push(allSegs[i].zValue - allSegs[i - 1].zValue);
      }
      const nonZeroDiffs = diffs.filter((d) => Math.abs(d) > 0.0001);
      if (nonZeroDiffs.length > 0) {
        step = nonZeroDiffs[nonZeroDiffs.length - 1];
      }
    }

    let candidate = targetSeg.zValue + step;
    let attempts = 0;
    while (existingZs.has(parseFloat(candidate.toFixed(4))) && attempts < 100) {
      candidate += step;
      attempts++;
    }

    if (existingZs.has(parseFloat(candidate.toFixed(4)))) {
      const maxZ = Math.max(...allSegs.map((s) => s.zValue));
      candidate = maxZ + 1.0;
    }

    return candidate.toFixed(3);
  };

  const handleDuplicateClick = (seg: ToolpathSegment, segmentNum: number) => {
    const suggestedZ = suggestNextZ(seg, segments);
    const currentName = seg.name || `Segment ${segmentNum}`;
    setDuplicateModal({
      segment: seg,
      segmentNum,
      newZ: suggestedZ,
      newName: `${currentName} (Copy)`
    });
  };

  const confirmDuplicateAction = () => {
    if (!duplicateModal || !onDuplicateSegment) return;
    const parsedZ = parseFloat(duplicateModal.newZ);
    if (isNaN(parsedZ)) return;

    onDuplicateSegment(
      duplicateModal.segment.id,
      parsedZ,
      duplicateModal.newName.trim() || `${duplicateModal.segment.name || `Segment ${duplicateModal.segmentNum}`} (Copy)`
    );
    setDuplicateModal(null);
  };

  const isDuplicateZTaken = duplicateModal
    ? segments.some((s) => Math.abs(s.zValue - parseFloat(duplicateModal.newZ)) < 0.0001)
    : false;

  return (
    <div className="relative w-[375px] max-w-full bg-white border border-slate-300 rounded-lg overflow-hidden shadow-lg flex flex-col h-[320px] lg:h-[620px]" id="segment-sidebar">
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

      {/* Add Empty Segment Form */}
      {onAddEmptySegment && (
        <div className="flex items-center gap-2 bg-slate-50 border-b border-slate-200 px-3.5 py-2.5">
          <span className="text-[9px] font-mono font-bold text-slate-500 uppercase flex-shrink-0">Height:</span>
          <div className="relative flex-1 flex gap-1.5 items-center">
            <span className="absolute left-2.5 text-slate-400 font-mono text-[10px] font-bold">Z</span>
            <input
              type="number"
              step="0.1"
              value={newZInput}
              onChange={(e) => setNewZInput(e.target.value)}
              placeholder="0.000"
              className="w-20 pl-6 pr-1.5 py-1 text-[10px] h-7 font-mono border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
              id="new-segment-z-input"
            />
            <button
              onClick={() => {
                const z = parseFloat(newZInput);
                if (!isNaN(z)) {
                  onAddEmptySegment(z);
                }
              }}
              className="flex-1 py-1 px-2.5 h-7 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[9px] font-bold uppercase rounded border border-indigo-700 hover:shadow-sm transition select-none flex-shrink-0 cursor-pointer flex items-center justify-center gap-1.5 leading-none"
              id="add-empty-segment-btn"
              title="Add a new empty Z-axis segment"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Layer</span>
            </button>
          </div>
        </div>
      )}

      {/* Layer List Container - Styled precisely to apply beautiful user focus adjustments */}
      <div 
        className="p-3.5 overflow-y-auto flex-1 space-y-3 bg-slate-100/40 border-y border-slate-200/80 shadow-inner"
        id="layer-list-scroll-view"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#cbd5e1 transparent",
        }}
      >
        {segments.length === 0 ? (
          <div className="text-center py-10 text-slate-400 font-mono text-xs">
            NO LAYER SEGMENTS DETECTED.<br />UPLOAD FILE TO SLICE.
          </div>
        ) : (
          segments.map((seg, idx) => {
            const isSelected = seg.id === selectedSegmentId;
            const isOnionSkin = seg.id === onionSkinSegmentId;
            const isChecked = checkedSegmentIds.has(seg.id);
            const isEmpty = seg.points.length === 0;
            const { travel, bounds } = calculateSegmentStats(seg);

            return (
              <div
                key={seg.id}
                onClick={() => onSelectSegment(seg.id)}
                className={`p-3 rounded-lg transition-all cursor-pointer border flex items-start gap-3 select-none ${
                  isSelected
                    ? "bg-indigo-50/85 border-indigo-200 text-indigo-900 shadow-md ring-1 ring-indigo-200/50"
                    : isEmpty
                    ? "bg-purple-50/30 border-purple-200/95 hover:border-purple-350 hover:bg-purple-50/70 text-slate-505 shadow-sm"
                    : isChecked
                    ? "bg-white border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-slate-800 shadow-sm"
                    : "border-slate-200/40 bg-slate-50 text-slate-400 opacity-60 hover:opacity-90"
                }`}
                id={`segment-row-${seg.id}`}
              >
                {/* Tick Box/Checkbox container on left */}
                <div 
                  className="flex items-center justify-center pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="relative flex items-center justify-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleCheck(seg.id)}
                      className="peer h-4 w-4 rounded border border-slate-300 checked:border-indigo-600 checked:bg-indigo-600 focus:outline-none transition-all duration-150 cursor-pointer appearance-none"
                    />
                    <span className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-all duration-150 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-2.5 w-2.5 stroke-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  </label>
                </div>

                {/* Rest of layer segment details */}
                <div className="flex-1 min-w-0">
                  {/* Top: Name and Points / Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Vertical Segment highlight bar */}
                      <div className={`w-1 h-5 rounded-full shrink-0 ${isSelected ? "bg-indigo-600" : isEmpty ? "bg-purple-400" : isChecked ? "bg-indigo-400" : "bg-slate-300"}`}></div>
                      
                      {editingNameId === seg.id ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={tempNameValue}
                            onChange={(e) => setTempNameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditingName(seg.id);
                              if (e.key === "Escape") setEditingNameId(null);
                            }}
                            className="flex-1 min-w-0 px-1.5 py-0.5 text-xs font-bold border border-indigo-500 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            autoFocus
                            id={`rename-input-${seg.id}`}
                          />
                          <button
                            onClick={() => saveEditingName(seg.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Save name"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingNameId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group/name min-w-0 flex-1">
                          <p
                            className={`text-xs font-bold truncate cursor-pointer hover:underline ${isSelected ? "text-indigo-950" : isEmpty ? "text-purple-950" : "text-slate-800"}`}
                            title={`${seg.name || `Segment ${idx + 1}`} (Click to rename)`}
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingName(seg, idx + 1);
                            }}
                          >
                            {seg.name || `Segment ${idx + 1}`}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingName(seg, idx + 1);
                            }}
                            className="p-0.5 rounded opacity-0 group-hover/name:opacity-100 hover:text-indigo-600 hover:bg-indigo-50 text-slate-400 transition shrink-0 cursor-pointer"
                            title="Rename Segment"
                            id={`rename-btn-${seg.id}`}
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Points count badge and Status on the right of name row */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-slate-500 font-medium bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200/60">
                        {seg.points.length} pts
                      </span>
                      {isSelected ? (
                        <span className="text-[7.5px] uppercase tracking-wider font-bold text-indigo-700 px-1.5 py-0.5 rounded bg-indigo-100/80 leading-none">ACTIVE</span>
                      ) : isEmpty ? (
                        <span className="text-[7.5px] uppercase tracking-wider font-bold text-purple-600 px-1.5 py-0.5 rounded bg-purple-50 leading-none border border-purple-200">EMPTY</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions row: Buttons to edit Z layer height, invert, copy and delete (below segment name) */}
                  <div className="flex items-center justify-between gap-1 text-[11px] mt-2 pt-1.5 border-t border-slate-200/70">
                    {/* Left: Z Coordinate modifier and Onion skin */}
                    <div className="flex items-center gap-1.5">
                      {/* Z Coordinate Modifier */}
                      <div className="flex items-center gap-0.5 font-mono">
                        {editingZId === seg.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-slate-500 font-mono text-[9px]">&Delta;Z:</span>
                            <input
                              type="number"
                              step="0.05"
                              value={tempZValue}
                              onChange={(e) => setTempZValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditingZ(seg.id);
                              }}
                              className="w-14 px-1 py-0.5 border border-indigo-400 rounded bg-white text-slate-800 font-mono text-[10px] text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              autoFocus
                            />
                            <button
                              onClick={() => saveEditingZ(seg.id)}
                              className="p-0.5 text-emerald-600 hover:bg-slate-100 rounded cursor-pointer"
                              title="Save Z height"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 font-mono">
                            <span className="text-[9px] text-slate-400 font-semibold">Z:</span>
                            <strong className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold ${isSelected ? "text-indigo-900 bg-indigo-100/90" : "text-slate-700 bg-slate-100"}`}>
                              {seg.zValue.toFixed(4)}
                            </strong>
                            <button
                              onClick={(e) => startEditingZ(e, seg)}
                              className={`p-1 rounded opacity-70 hover:opacity-100 transition cursor-pointer ${isSelected ? "hover:text-indigo-600 hover:bg-indigo-100" : "hover:text-indigo-500 hover:bg-slate-100"}`}
                              title="Recalibrate Layer Height"
                              id={`edit-z-${seg.id}`}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Onion Skin button (only show for segments with points) */}
                      {!isEmpty && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleOnionSkin(seg.id);
                          }}
                          className={`px-1.5 py-0.5 rounded border text-[8.5px] font-mono font-bold flex items-center gap-0.5 transition-all cursor-pointer ${
                            isOnionSkin
                              ? "bg-fuchsia-50 hover:bg-fuchsia-100 border-fuchsia-300 text-fuchsia-700 shadow-xs"
                              : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700"
                          }`}
                          title={isOnionSkin ? "Turn off Onion Skin Overlay" : "Overlay this segment in fuchsia behind working segment"}
                        >
                          <Ghost className={`w-2.5 h-2.5 ${isOnionSkin ? "stroke-fuchsia-600 animate-pulse" : "stroke-slate-400"}`} />
                          <span>{isOnionSkin ? "OVERLAY" : "SKIN"}</span>
                        </button>
                      )}
                    </div>

                    {/* Right: Invert, Copy (Duplicate), Delete buttons */}
                    <div className="flex items-center gap-0.5">
                      {/* Invert Toolpath Direction Button */}
                      {onInvertSegment && !isEmpty && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInvertSegment(seg.id);
                          }}
                          className="p-1 rounded opacity-70 hover:opacity-100 hover:text-indigo-600 hover:bg-indigo-50 text-slate-500 transition flex-shrink-0 cursor-pointer"
                          title="Invert toolpath direction of this layer (Start ⇄ Finish, Hotkey: I)"
                          id={`invert-segment-${seg.id}`}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Duplicate / Copy Segment Button */}
                      {onDuplicateSegment && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateClick(seg, idx + 1);
                          }}
                          className="p-1 rounded opacity-70 hover:opacity-100 hover:text-indigo-600 hover:bg-indigo-50 text-slate-500 transition flex-shrink-0 cursor-pointer"
                          title="Duplicate / Copy this layer segment"
                          id={`duplicate-segment-${seg.id}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete Individual Segment */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteIndividualClick(seg.id, idx + 1, seg.name);
                        }}
                        className="p-1 rounded opacity-70 hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 text-slate-500 transition flex-shrink-0 cursor-pointer"
                        title="Delete entire layer segment and all its coordinate points"
                        id={`delete-single-segment-${seg.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Sub-stats layout */}
                  <div className="flex items-center justify-between text-[9px] font-mono mt-1 pt-1 text-slate-400">
                    <div>Travel: <strong className={isSelected ? "text-indigo-700" : "text-slate-600"}>{travel}mm</strong></div>
                    {!isEmpty && (
                      <div className="text-[8px] flex items-center gap-1 text-slate-400 leading-none">
                        <Scale className="w-2 h-2 text-slate-400 flex-shrink-0" />
                        <span>X: [{bounds.minX.toFixed(1)}, {bounds.maxX.toFixed(1)}]</span>
                        <span>•</span>
                        <span>Y: [{bounds.minY.toFixed(1)}, {bounds.maxY.toFixed(1)}]</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Segment Action Footer for Batch Export & Batch Delete */}
      <div className="bg-slate-50 border-t border-slate-200 p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono font-bold px-1 select-none">
          <button
            onClick={handleToggleAll}
            className="text-indigo-600 hover:text-indigo-800 transition cursor-pointer hover:underline uppercase text-[9px] tracking-wider font-extrabold"
          >
            {checkedSegmentIds.size === segments.length ? "DESELECT ALL" : "SELECT ALL"}
          </button>
          <span className="bg-slate-200/70 text-slate-600 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold">
            SELECTED: {checkedSegmentIds.size} / {segments.length}
          </span>
        </div>

        {onInvertSegments && checkedSegmentIds.size > 0 && (
          <button
            onClick={() => onInvertSegments(Array.from(checkedSegmentIds))}
            className="w-full py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-mono text-[9px] font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99]"
            title="Invert toolpath direction of all checked layers (Start ⇄ Finish)"
            id="invert-selected-layers-btn"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
            <span>Invert Checked Layers ({checkedSegmentIds.size})</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="relative flex items-center w-full">
            <button
              onClick={handleExportSelectedCSV}
              disabled={checkedSegmentIds.size === 0}
              className="flex-1 py-2 px-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white disabled:text-slate-400 font-mono text-[9.5px] font-bold uppercase tracking-wider rounded-l border-y border-l border-indigo-750 disabled:border-transparent transition-all hover:shadow-md flex items-center justify-center gap-1 cursor-pointer leading-tight"
              id="export-selected-layers-csv-btn"
              title="Export selected layer toolpaths as CSV"
            >
              <Download className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Export ({checkedSegmentIds.size})</span>
            </button>
            <button
              onClick={() => checkedSegmentIds.size > 0 && setWithSegmentExportDropdown(!withSegmentExportDropdown)}
              disabled={checkedSegmentIds.size === 0}
              className="py-2 px-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white disabled:text-slate-400 font-mono text-[9.5px] font-bold uppercase tracking-wider rounded-r border border-l-0 border-indigo-700 disabled:border-transparent transition-all hover:shadow-md flex items-center justify-center cursor-pointer"
              id="export-selected-layers-dropdown-trigger"
              title="Select layers export format"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {withSegmentExportDropdown && checkedSegmentIds.size > 0 && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setWithSegmentExportDropdown(false)}
                />
                <div className="absolute left-0 bottom-full mb-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1.5 animate-fadeIn font-sans">
                  <div className="px-3 py-1 text-[8.5px] font-bold text-slate-400 uppercase tracking-widest select-none">
                    Export Format
                  </div>
                  <button
                    onClick={() => {
                      handleExportSelectedCSV();
                      setWithSegmentExportDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-medium transition flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                    <span>Dispense CSV (.csv)</span>
                  </button>
                  <button
                    onClick={() => {
                      handleExportSelectedXLSX();
                      setWithSegmentExportDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium transition flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Excel Spreadsheet (.xlsx)</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleDeleteBatchClick}
            disabled={checkedSegmentIds.size === 0}
            className="py-2 px-1.5 bg-rose-50 hover:bg-rose-100 disabled:bg-slate-105 disabled:cursor-not-allowed text-rose-600 disabled:text-slate-400 border border-rose-200 disabled:border-transparent font-mono text-[9.5px] font-bold uppercase tracking-wider rounded transition-all hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer leading-tight"
            id="delete-selected-layers-btn"
            title="Permanently remove all checked layers and their respective coordinate data"
          >
            <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Delete ({checkedSegmentIds.size})</span>
          </button>
        </div>
      </div>

      {/* Elegant Translucent Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="absolute inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xl p-4.5 max-w-[280px] sm:max-w-xs w-full animate-in fade-in duration-200">
            <h4 className="text-xs font-bold font-mono text-rose-600 flex items-center gap-2 mb-2.5 uppercase tracking-wide">
              <Trash2 className="w-4 h-4 text-rose-500 animate-pulse" />
              <span>{deleteConfirmation.title}</span>
            </h4>
            <p className="text-[10.5px] text-slate-655 leading-relaxed font-mono font-medium mb-4">
              {deleteConfirmation.description}
            </p>
            <div className="flex items-center justify-end gap-2 text-[10px]">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-mono uppercase font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAction}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded border border-rose-700 font-mono uppercase font-bold shadow-sm transition-all cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Segment Modal */}
      {duplicateModal && (
        <div 
          className="absolute inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDuplicateModal(null)}
        >
          <div 
            className="bg-white border border-slate-200 rounded-lg shadow-2xl p-4.5 max-w-[300px] w-full animate-in fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-xs font-bold font-mono text-indigo-700 flex items-center gap-2 mb-2 uppercase tracking-wide">
              <Copy className="w-4 h-4 text-indigo-600" />
              <span>Duplicate Segment</span>
            </h4>
            <p className="text-[10.5px] text-slate-500 mb-3 leading-relaxed font-sans">
              Create an exact copy of <span className="font-semibold text-slate-800">{duplicateModal.segment.name || `Segment ${duplicateModal.segmentNum}`}</span> ({duplicateModal.segment.points.length} points) at a target Z height.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[9.5px] font-mono font-bold uppercase text-slate-500 mb-1">
                  Duplicate Name:
                </label>
                <input
                  type="text"
                  value={duplicateModal.newName}
                  onChange={(e) => setDuplicateModal(prev => prev ? { ...prev, newName: e.target.value } : null)}
                  className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="Enter segment name"
                  id="duplicate-segment-name-input"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isDuplicateZTaken && !isNaN(parseFloat(duplicateModal.newZ))) {
                      confirmDuplicateAction();
                    }
                    if (e.key === "Escape") setDuplicateModal(null);
                  }}
                />
              </div>

              <div>
                <label className="block text-[9.5px] font-mono font-bold uppercase text-slate-500 mb-1">
                  Target Z Coordinate (mm):
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-slate-400 font-mono text-[11px] font-bold">Z:</span>
                  <input
                    type="number"
                    step="0.05"
                    value={duplicateModal.newZ}
                    onChange={(e) => setDuplicateModal(prev => prev ? { ...prev, newZ: e.target.value } : null)}
                    className="w-full pl-7 pr-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="0.000"
                    id="duplicate-segment-z-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isDuplicateZTaken && !isNaN(parseFloat(duplicateModal.newZ))) {
                        confirmDuplicateAction();
                      }
                      if (e.key === "Escape") setDuplicateModal(null);
                    }}
                  />
                </div>
                {isDuplicateZTaken && (
                  <p className="text-[9px] font-mono text-amber-600 mt-1 flex items-center gap-1">
                    ⚠️ A layer at Z:{parseFloat(duplicateModal.newZ).toFixed(4)} already exists. Choose a unique Z height.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 text-[10px]">
              <button
                onClick={() => setDuplicateModal(null)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-mono uppercase font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDuplicateAction}
                disabled={isDuplicateZTaken || isNaN(parseFloat(duplicateModal.newZ))}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded border border-indigo-700 font-mono uppercase font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                id="confirm-duplicate-segment-btn"
              >
                <Copy className="w-3 h-3" />
                <span>Duplicate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
