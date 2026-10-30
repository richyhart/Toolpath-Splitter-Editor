/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { Upload, Download, CheckCircle, HelpCircle, Undo2, Redo2 } from "lucide-react";
import { parseToolpathCSV, exportToCSV, exportToXLSX } from "../utils";
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
  const [showExportDropdown, setShowExportDropdown] = useState(false);

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
    const baseName = fileName ? fileName.replace(/\.csv$/i, "") : "helix_spiral_sample";
    link.setAttribute("download", `${baseName}_edited.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const triggerDownloadXLSX = () => {
    if (points.length === 0) return;
    try {
      const excelBuffer = exportToXLSX(points);
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      const baseName = fileName ? fileName.replace(/\.csv$/i, "") : "helix_spiral_sample";
      link.setAttribute("download", `${baseName}_edited.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error generating Excel file: " + err);
    }
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
              <span>TOOLPATH <span className="text-indigo-600 font-light">EDITOR</span></span>
            </h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
              Coordinate / Toolpath editor and viewer V1.0 by Richy Hart
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

          <div className="relative flex items-center shrink-0">
            <button
              onClick={triggerDownload}
              disabled={points.length === 0}
              className={`pl-4 pr-3 py-2 rounded-l text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm border-y border-l ${
                points.length === 0
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-550 text-white cursor-pointer border-indigo-600"
              }`}
              id="export-csv-btn"
              title="Export all coordinates as CSV"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => points.length > 0 && setShowExportDropdown(!showExportDropdown)}
              disabled={points.length === 0}
              className={`px-2 py-2 rounded-r text-xs font-bold flex items-center transition-all shadow-sm border border-l-0 ${
                points.length === 0
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed border-l border-l-slate-200"
                  : "bg-indigo-700 hover:bg-indigo-600 text-white cursor-pointer border-indigo-750"
              }`}
              id="export-dropdown-trigger-btn"
              title="Select export format (.csv / .xlsx)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showExportDropdown && points.length > 0 && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setShowExportDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1.5 animate-fadeIn font-sans">
                  <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest select-none">
                    Select Export Format
                  </div>
                  <button
                    onClick={() => {
                      triggerDownload();
                      setShowExportDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-medium transition flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                    <span>Dispense CSV (.csv)</span>
                  </button>
                  <button
                    onClick={triggerDownloadXLSX}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium transition flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Excel Spreadsheet (.xlsx)</span>
                  </button>
                </div>
              </>
            )}
          </div>
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
            <li><strong>Dispensing CMD Types:</strong> Column A defines our three custom status types: <code>Start of Line Dispense</code>, <code>Line Passing</code>, and <code>End of Line Dispense</code>.</li>
            <li><strong>Automatic Z Slices:</strong> The system sequentializer clusters coordinates into segments grouped by Z height values. Changes in Z levels automatically fork consecutive stages.</li>
            <li><strong>Drag to Edit:</strong> Simply select any point on the grid, then click and drag the interactive handles to visually live-tune tool coordinates. Changes reflect instantly in both coordinates and CSV rows!</li>
            <li><strong>Full Modifiers:</strong> Use the lower-left modifiers to mass offset linear tracks or scale whole layers safely.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
