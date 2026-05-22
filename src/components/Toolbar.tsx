/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { Upload, Download, CheckCircle, HelpCircle, Undo2, Redo2 } from "lucide-react";
import { parseToolpathCSV, exportToCSV } from "../utils";
import { ToolpathPoint } from "../types";

interface ToolbarProps {
  onLoadPoints: (points: ToolpathPoint[], filename: string) => void;
  points: ToolpathPoint[];
  fileName: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export default function Toolbar({ 
  onLoadPoints, 
  points, 
  fileName,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Parse files
  const handleFileProcess = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        try {
          const parsed = parseToolpathCSV(text);
          if (parsed.length > 0) {
            onLoadPoints(parsed, file.name);
          } else {
            alert("No valid numerical coordinate lines found. Double check your CSV has CMD Type, X, Y, Z, and Speed columns.");
          }
        } catch (err) {
          alert("Error parsing CSV: Make sure it's valid CSV text.");
        }
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
 
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const triggerDownload = () => {
    if (points.length === 0) return;
    const csvContent = exportToCSV(points);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName.replace(".csv", "") + "_edited.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border-b border-slate-300 py-4 px-6 space-y-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Immersive UI Brand Title Block */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center shadow-md shrink-0">
            <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2" id="app-title">
              <span>DISPENSE<span className="text-indigo-600 font-light">GRID</span></span>
            </h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
              Dispensing Toolpath Orchestrator & Slicer v4.2
            </p>
          </div>
        </div>

        {/* Action Button Controls */}
        <div className="flex items-center gap-2">
          {points.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-slate-100 border border-slate-200 text-xs text-slate-700 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="truncate max-w-[200px] font-semibold">Active: {fileName}</span>
            </div>
          )}

          {/* Undo / Redo Buttons */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-md border border-slate-200">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-2 rounded flex items-center justify-center transition cursor-pointer ${
                !canUndo
                  ? "text-slate-300 cursor-not-allowed"
                  : "text-slate-700 hover:bg-slate-200 hover:text-indigo-600"
              }`}
              id="toolbar-undo-btn"
              title="Undo last action (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-slate-200"></div>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-2 rounded flex items-center justify-center transition cursor-pointer ${
                !canRedo
                  ? "text-slate-300 cursor-not-allowed"
                  : "text-slate-700 hover:bg-slate-200 hover:text-indigo-600"
              }`}
              id="toolbar-redo-btn"
              title="Redo action (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowHelp(!showHelp)}
            className="px-3.5 py-2 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            id="help-toggle-btn"
          >
            <HelpCircle className="w-4 h-4 text-indigo-500" />
            <span>How it works</span>
          </button>

          <button
            onClick={triggerDownload}
            disabled={points.length === 0}
            className={`px-4.5 py-2 rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm border ${
              points.length === 0
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer border-indigo-600"
            }`}
            id="export-csv-btn"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Grid file input and Drag zone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="lg:col-span-12 border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all border-slate-300 hover:border-indigo-400 bg-slate-50 text-slate-600"
          id="upload-drag-zone"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <Upload className={`w-5 h-5 ${isDragActive ? "text-indigo-600 animate-bounce" : "text-slate-400"}`} />
            <div className="text-left">
              <p className="text-xs font-bold text-slate-800">
                {isDragActive ? "Drop your toolpath CSV here..." : "Drag & Drop CSV toolpath or Click to browse"}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                5 columns (CMD Type, X, Y, Z, Speed)
              </p>
            </div>
            {points.length > 0 && (
              <div className="ml-2 pl-3 border-l border-slate-200 flex items-center gap-1.5 text-[11px] text-indigo-600 font-mono font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="truncate max-w-[200px]">{fileName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructional Details Panel */}
      {showHelp && (
        <div className="bg-slate-50 border border-slate-300 p-4 rounded-lg text-xs text-slate-700 space-y-2 animate-fadeIn" id="instructions-help-panel">
          <p className="font-bold text-indigo-700 flex items-center gap-1.5 font-mono text-xs uppercase">
            <span>⚙️ CALIBRATOR CONTROL PANEL INSTRUCTIONS</span>
          </p>
          <ul className="list-disc pl-5 space-y-1 font-sans text-slate-600">
            <li><strong>Dispensing CMD Types:</strong> Column A defines our three custom status types: <code>Start of line dispense</code>, <code>Line passing</code>, and <code>End of line dispense</code>.</li>
            <li><strong>Automatic Z Slices:</strong> The system sequentializer clusters coordinates into segments grouped by Z height values. Changes in Z levels automatically fork consecutive stages.</li>
            <li><strong>Drag to Edit:</strong> Simply select any point on the grid, then click and drag the interactive handles to visually live-tune tool coordinates. Changes reflect instantly in both coordinates and CSV rows!</li>
            <li><strong>Full Modifiers:</strong> Use the lower-left modifiers to mass offset linear tracks or scale whole layers safely.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
