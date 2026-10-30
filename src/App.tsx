/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from "react";
import { ToolpathPoint, GridSettings, ToolpathSegment } from "./types";
import { generateSampleSpiral, splitToolpathByZ, generateId, reverseToolpathPoints, reorderLayerPoints } from "./utils";
import Toolbar from "./components/Toolbar";
import InteractiveGrid from "./components/InteractiveGrid";
import SegmentSidebar from "./components/SegmentSidebar";
import PointListSidebar from "./components/PointListSidebar";
import { Sliders, ArrowLeftRight, X } from "lucide-react";

export default function App() {
  // Central Coordinate Raw Points Dataset
  const [rawPoints, setRawPoints] = useState<ToolpathPoint[]>([]);
  const [emptySegments, setEmptySegments] = useState<ToolpathSegment[]>([]);
  const [lastSelectedZ, setLastSelectedZ] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string>("helix_spiral_sample.csv");
  const [fitViewTrigger, setFitViewTrigger] = useState<number>(0);
  const [notification, setNotification] = useState<{ message: string } | null>(null);

  // Hover Reordering Toolpath State
  const [isHoverReorderActive, setIsHoverReorderActive] = useState<boolean>(false);
  const [hoverReorderStartNum, setHoverReorderStartNum] = useState<number>(1);
  const [hoverSequencedIds, setHoverSequencedIds] = useState<string[]>([]);
  const [hoverReorderRequireClick, setHoverReorderRequireClick] = useState<boolean>(false);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Default offset values for inserting coordinates
  const [insertOffset, setInsertOffset] = useState<{ x: number; y: number }>({ x: 5.0, y: 5.0 });
  const [insertMode, setInsertMode] = useState<"before" | "after">("after");
  const [isArrowDrawingEnabled, setIsArrowDrawingEnabled] = useState<boolean>(false);
  const [arrowDrawDistance, setArrowDrawDistance] = useState<number>(5.0);

  // Undo / Redo history state stacks
  const [history, setHistory] = useState<ToolpathPoint[][]>([]);
  const [future, setFuture] = useState<ToolpathPoint[][]>([]);

  // Selection states
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [onionSkinSegmentId, setOnionSkinSegmentId] = useState<string | null>(null);
  const [segmentNames, setSegmentNames] = useState<Record<string, string>>({});

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


  // Load spiral on mount
  useEffect(() => {
    const sample = generateSampleSpiral();
    setRawPoints(sample);
    setFitViewTrigger((prev) => prev + 1);
  }, []);

  // Compute layers/segments dynamically grouped by sequential Z coordinates
  const segments = useMemo(() => {
    return splitToolpathByZ(rawPoints);
  }, [rawPoints]);

  // Combine real segments with custom empty ones and apply custom segment names
  const combinedSegments = useMemo(() => {
    return [...segments, ...emptySegments].map((seg, idx) => {
      const firstPtId = seg.points.length > 0 ? seg.points[0].id : null;
      const customName =
        segmentNames[seg.id] ||
        (firstPtId ? segmentNames[firstPtId] : undefined) ||
        seg.name;
      return {
        ...seg,
        name: customName || `Segment ${idx + 1}`
      };
    });
  }, [segments, emptySegments, segmentNames]);

  // Handle auto-selection of first layer segment after loading
  useEffect(() => {
    if (combinedSegments.length > 0 && !selectedSegmentId) {
      setSelectedSegmentId(combinedSegments[0].id);
    }
  }, [combinedSegments, selectedSegmentId]);

  // Track last known Z coordinate of selected segment to handle transitions from empty to real
  useEffect(() => {
    const active = combinedSegments.find((s) => s.id === selectedSegmentId);
    if (active) {
      setLastSelectedZ(active.zValue);
    } else if (lastSelectedZ !== null) {
      const matching = combinedSegments.find((s) => Math.abs(s.zValue - lastSelectedZ) < 0.0001);
      if (matching) {
        setSelectedSegmentId(matching.id);
      }
    }
  }, [selectedSegmentId, combinedSegments, lastSelectedZ]);

  // Find currently active segment
  const activeSegment = useMemo(() => {
    return combinedSegments.find((s) => s.id === selectedSegmentId) || null;
  }, [combinedSegments, selectedSegmentId]);

  const handleArrowKeyDraw = (dx: number, dy: number) => {
    const activePoints = activeSegment ? activeSegment.points : [];
    if (activePoints.length === 0) {
      pushToHistory();
      const zVal = activeSegment ? activeSegment.zValue : 0;
      const newPoint: ToolpathPoint = {
        id: generateId(),
        originalIndex: rawPoints.length,
        type: "Line Passing",
        x: dx,
        y: dy,
        z: zVal,
        speed: 1000
      };
      setEmptySegments((prev) => prev.filter((s) => s.id !== selectedSegmentId));
      setRawPoints((prev) => [...prev, newPoint]);
      setSelectedPointId(newPoint.id);
      return;
    }

    const refPoint = activePoints.find((p) => p.id === selectedPointId) || activePoints[activePoints.length - 1];
    if (!refPoint) return;

    pushToHistory();
    const index = rawPoints.findIndex((p) => p.id === refPoint.id);
    if (index === -1) return;

    const newPt: ToolpathPoint = {
      id: generateId(),
      originalIndex: rawPoints.length,
      type: "Line Passing",
      x: Math.round((refPoint.x + dx) * 1000) / 1000,
      y: Math.round((refPoint.y + dy) * 1000) / 1000,
      z: refPoint.z,
      speed: refPoint.speed
    };

    const newPoints = [...rawPoints];
    const spliceIndex = insertMode === "before" ? index : index + 1;
    newPoints.splice(spliceIndex, 0, newPt);
    setRawPoints(newPoints);
    setSelectedPointId(newPt.id);
  };

  // Keyboard shortcut listener to handle arrow drawing triggers
  useEffect(() => {
    if (!isArrowDrawingEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut actions if any text/form input is active to avoid disrupting typing
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        if (
          tagName === "INPUT" ||
          tagName === "SELECT" ||
          tagName === "TEXTAREA" ||
          activeEl.hasAttribute("contenteditable") ||
          activeEl.getAttribute("contenteditable") === "true"
        ) {
          return;
        }
      }

      let dx = 0;
      let dy = 0;
      let handled = false;

      if (e.key === "ArrowUp") {
        dy = arrowDrawDistance;
        handled = true;
      } else if (e.key === "ArrowDown") {
        dy = -arrowDrawDistance;
        handled = true;
      } else if (e.key === "ArrowLeft") {
        dx = -arrowDrawDistance;
        handled = true;
      } else if (e.key === "ArrowRight") {
        dx = arrowDrawDistance;
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        handleArrowKeyDraw(dx, dy);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isArrowDrawingEnabled, rawPoints, selectedSegmentId, selectedPointId, insertMode, activeSegment, arrowDrawDistance]);

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
    setEmptySegments([]);
    setSegmentNames({});
    setLastSelectedZ(null);
    setSelectedSegmentId(null);
    setSelectedPointId(null);
    setIsHoverReorderActive(false);
    setHoverSequencedIds([]);
    setFitViewTrigger((prev) => prev + 1);
  };

  const handleSelectSegment = (id: string | null) => {
    setSelectedSegmentId(id);
    setSelectedPointId(null);
    setHoverSequencedIds([]);
  };

  const handleAddEmptySegment = (zValue: number) => {
    const id = `empty-segment-${generateId()}`;
    const existsInPoints = rawPoints.some((p) => Math.abs(p.z - zValue) < 0.0001);
    const existsInEmpty = emptySegments.some((s) => Math.abs(s.zValue - zValue) < 0.0001);
    
    if (existsInPoints || existsInEmpty) {
      console.warn(`Layer height Z:${zValue} already exists.`);
      return;
    }

    const newEmptySegment: ToolpathSegment = {
      id,
      zValue,
      points: [],
      color: "#a855f7"
    };

    setEmptySegments((prev) => [...prev, newEmptySegment]);
    setSelectedSegmentId(id);
    setSelectedPointId(null);
  };

  const handleAddFirstPointToSegment = () => {
    const emptySeg = emptySegments.find((s) => s.id === selectedSegmentId);
    if (!emptySeg) return;

    pushToHistory();
    const newPoint: ToolpathPoint = {
      id: generateId(),
      originalIndex: rawPoints.length,
      type: "Line Passing",
      x: 0,
      y: 0,
      z: emptySeg.zValue,
      speed: 1000
    };

    setEmptySegments((prev) => prev.filter((s) => s.id !== selectedSegmentId));
    setRawPoints((prev) => [...prev, newPoint]);
    setSelectedPointId(newPoint.id);
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
    const pointToDelete = rawPoints.find((p) => p.id === id);
    if (pointToDelete) {
      const remainingWithZ = rawPoints.filter((p) => Math.abs(p.z - pointToDelete.z) < 0.0001 && p.id !== id);
      if (remainingWithZ.length === 0) {
        // This was the last point in this Z layer! Convert it into an empty segment
        const id = `empty-segment-${generateId()}`;
        const newEmptySegment: ToolpathSegment = {
          id,
          zValue: pointToDelete.z,
          points: [],
          color: "#a855f7"
        };
        setEmptySegments((prev) => [...prev, newEmptySegment]);
        setSelectedSegmentId(id);
      }
    }

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
      type: "Line Passing", // Insert standard dispensing movement type 
      x: base.x + insertOffset.x,
      y: base.y + insertOffset.y,
      z: base.z,
      speed: base.speed
    };

    const newPoints = [...rawPoints];
    const spliceIndex = insertMode === "before" ? index : index + 1;
    newPoints.splice(spliceIndex, 0, offsetPt);
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

    // Check if it is an empty segment and update its zValue directly
    const emptySeg = emptySegments.find((s) => s.id === segmentId);
    if (emptySeg) {
      setEmptySegments((prev) =>
        prev.map((s) => (s.id === segmentId ? { ...s, zValue: newZ } : s))
      );
      return;
    }

    const targetSegment = segments.find((s) => s.id === segmentId);
    if (!targetSegment) return;

    const idsToUpdate = new Set(targetSegment.points.map((p) => p.id));
    setRawPoints((prev) =>
      prev.map((p) => (idsToUpdate.has(p.id) ? { ...p, z: newZ } : p))
    );
  };

  const handleDeleteSegments = (segmentIds: string[]) => {
    pushToHistory();
    const idsSet = new Set(segmentIds);

    // Filter out any matching custom empty segments
    setEmptySegments((prev) => prev.filter((s) => !idsSet.has(s.id)));

    // Find the real segments being deleted 
    const deletedRealSegments = segments.filter((s) => idsSet.has(s.id));

    // Filter raw points to remove coordinates belonging to the deleted levels
    setRawPoints((prev) =>
      prev.filter((p) => {
        const shouldDelete = deletedRealSegments.some(
          (s) => Math.abs(p.z - s.zValue) < 0.0001
        );
        return !shouldDelete;
      })
    );

    // Clean up selections if they belonged to deleted items
    if (selectedSegmentId && idsSet.has(selectedSegmentId)) {
      setSelectedSegmentId(null);
      setSelectedPointId(null);
    }

    // Clean up cached custom names
    setSegmentNames((prev) => {
      const next = { ...prev };
      segmentIds.forEach((id) => delete next[id]);
      return next;
    });
  };

  const handleRenameSegment = (segmentId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    pushToHistory();

    const seg = combinedSegments.find((s) => s.id === segmentId);
    const firstPtId = seg && seg.points.length > 0 ? seg.points[0].id : null;

    setSegmentNames((prev) => {
      const next = { ...prev, [segmentId]: trimmed };
      if (firstPtId) {
        next[firstPtId] = trimmed;
      }
      return next;
    });

    setEmptySegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, name: trimmed } : s))
    );
  };

  const handleDuplicateSegment = (sourceSegmentId: string, newZ: number, newName?: string) => {
    pushToHistory();

    const sourceSeg = combinedSegments.find((s) => s.id === sourceSegmentId);
    if (!sourceSeg) return;

    const resolvedName = newName?.trim() || `${sourceSeg.name || "Segment"} (Copy)`;

    if (sourceSeg.points.length === 0) {
      const newEmptyId = `empty-segment-${generateId()}`;
      const newEmptySeg: ToolpathSegment = {
        id: newEmptyId,
        name: resolvedName,
        zValue: newZ,
        points: [],
        color: "#a855f7"
      };
      setEmptySegments((prev) => [...prev, newEmptySeg]);
      setSegmentNames((prev) => ({ ...prev, [newEmptyId]: resolvedName }));
      setSelectedSegmentId(newEmptyId);
      setSelectedPointId(null);
      return;
    }

    const clonedPoints: ToolpathPoint[] = sourceSeg.points.map((pt, i) => ({
      id: generateId(),
      originalIndex: rawPoints.length + i,
      type: pt.type,
      x: pt.x,
      y: pt.y,
      z: newZ,
      speed: pt.speed
    }));

    const firstClonedId = clonedPoints[0].id;
    setSegmentNames((prev) => ({
      ...prev,
      [firstClonedId]: resolvedName
    }));

    setRawPoints((prev) => [...prev, ...clonedPoints]);
    setLastSelectedZ(newZ);
    setSelectedSegmentId(null);
    setSelectedPointId(null);
  };

  /**
   * Invert the toolpath direction start-to-finish of a whole layer
   */
  const handleInvertSegment = (segmentId: string) => {
    const targetSeg = combinedSegments.find((s) => s.id === segmentId);
    if (!targetSeg || targetSeg.points.length <= 1) return;

    pushToHistory();

    const reversedSegmentPoints = reverseToolpathPoints(targetSeg.points);
    const targetIds = new Set(targetSeg.points.map((p) => p.id));

    // Find all indices of target segment in rawPoints
    const indices: number[] = [];
    rawPoints.forEach((p, idx) => {
      if (targetIds.has(p.id)) {
        indices.push(idx);
      }
    });

    const updated = [...rawPoints];
    indices.forEach((rawIdx, i) => {
      updated[rawIdx] = reversedSegmentPoints[i];
    });

    // Re-index originalIndex for continuous sequence tracking
    updated.forEach((p, idx) => {
      p.originalIndex = idx;
    });

    setRawPoints(updated);

    setNotification({
      message: `Inverted toolpath direction for ${targetSeg.name || "Layer"} (${targetSeg.points.length} points: Start ⇄ Finish reversed)`
    });
  };

  /**
   * Batch invert multiple selected layers
   */
  const handleInvertSegments = (segmentIds: string[]) => {
    if (segmentIds.length === 0) return;
    pushToHistory();

    const updated = [...rawPoints];
    let totalPointsInverted = 0;

    segmentIds.forEach((segId) => {
      const targetSeg = combinedSegments.find((s) => s.id === segId);
      if (!targetSeg || targetSeg.points.length <= 1) return;

      const reversedSegmentPoints = reverseToolpathPoints(targetSeg.points);
      const targetIds = new Set(targetSeg.points.map((p) => p.id));

      const indices: number[] = [];
      updated.forEach((p, idx) => {
        if (targetIds.has(p.id)) {
          indices.push(idx);
        }
      });

      indices.forEach((rawIdx, i) => {
        updated[rawIdx] = reversedSegmentPoints[i];
      });

      totalPointsInverted += targetSeg.points.length;
    });

    updated.forEach((p, idx) => {
      p.originalIndex = idx;
    });

    setRawPoints(updated);

    setNotification({
      message: `Inverted toolpath direction for ${segmentIds.length} layer${segmentIds.length > 1 ? "s" : ""} (${totalPointsInverted} points reversed)`
    });
  };

  /**
   * Hover Reordering handlers
   */
  const handleToggleHoverReorder = () => {
    setIsHoverReorderActive((prev) => {
      const next = !prev;
      if (!next) {
        setHoverSequencedIds([]);
      } else {
        setNotification({
          message: `Hover Reorder activated for ${activeSegment?.name || "Layer"}. Hover points in order to sequence.`
        });
      }
      return next;
    });
  };

  const handleResetHoverSequence = () => {
    setHoverSequencedIds([]);
    setNotification({
      message: `Reset hover sequence for ${activeSegment?.name || "Layer"}. Hover points to order starting from #${hoverReorderStartNum}.`
    });
  };

  const handleToggleHoverReorderRequireClick = () => {
    setHoverReorderRequireClick((prev) => {
      const next = !prev;
      setNotification({
        message: next
          ? `Hover Reorder: Mouse click is now REQUIRED to register each point into toolpath.`
          : `Hover Reorder: Mouse click disabled (points register automatically on hover).`
      });
      return next;
    });
  };

  const handleHoverReorderPoint = (pointId: string) => {
    if (!activeSegment || activeSegment.points.length <= 1) return;
    if (hoverSequencedIds.includes(pointId)) return;

    pushToHistory();

    const nextSequencedIds = [...hoverSequencedIds, pointId];
    setHoverSequencedIds(nextSequencedIds);

    const reorderedSegmentPoints = reorderLayerPoints(
      activeSegment.points,
      nextSequencedIds,
      hoverReorderStartNum
    );

    const targetIds = new Set(activeSegment.points.map((p) => p.id));
    const indices: number[] = [];
    rawPoints.forEach((p, idx) => {
      if (targetIds.has(p.id)) {
        indices.push(idx);
      }
    });

    const updated = [...rawPoints];
    indices.forEach((rawIdx, i) => {
      updated[rawIdx] = reorderedSegmentPoints[i];
    });

    updated.forEach((p, idx) => {
      p.originalIndex = idx;
    });

    setRawPoints(updated);

    if (nextSequencedIds.length >= activeSegment.points.length) {
      setNotification({
        message: `Hover Reordering Complete: All ${activeSegment.points.length} points reordered for ${activeSegment.name || "Layer"}!`
      });
    }
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

  // Global Keyboard Shortcuts:
  // - R: Toggle Hover reorder toolpath
  // - I: Invert toolpath direction of active layer
  // - A: Toggle Arrow draw mode
  // - Enter: Finish hover reordering if active
  // - Ctrl+Z / Cmd+Z: Undo
  // - Ctrl+Y / Cmd+Y / Ctrl+Shift+Z: Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger hotkeys if typing inside form inputs
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

      // Undo / Redo
      if (modifierKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      } else if (modifierKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Single-key hotkeys (without Ctrl, Meta, or Alt modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();

        // R: Hover reorder toolpath
        if (key === "r") {
          e.preventDefault();
          if (isHoverReorderActive) {
            handleToggleHoverReorder();
          } else {
            if (!activeSegment || activeSegment.points.length < 2) {
              setNotification({
                message: "Select a layer with at least 2 points to use Hover Reorder (Hotkey: R)"
              });
            } else {
              handleToggleHoverReorder();
            }
          }
          return;
        }

        // I: Invert Path
        if (key === "i") {
          e.preventDefault();
          if (activeSegment && activeSegment.points.length > 1) {
            handleInvertSegment(activeSegment.id);
          } else {
            setNotification({
              message: "Select a layer with at least 2 points to invert path (Hotkey: I)"
            });
          }
          return;
        }

        // A: Arrow draw mode
        if (key === "a") {
          e.preventDefault();
          setIsArrowDrawingEnabled((prev) => {
            const next = !prev;
            setNotification({
              message: next
                ? "Arrow Draw Mode: Activated (use ↑ ↓ ← → to draw coordinates, Hotkey: A)"
                : "Arrow Draw Mode: Deactivated (Hotkey: A)"
            });
            return next;
          });
          return;
        }

        // Enter: Commit / exit hover reordering when active
        if (e.key === "Enter" && isHoverReorderActive) {
          e.preventDefault();
          handleToggleHoverReorder();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    history,
    future,
    rawPoints,
    isHoverReorderActive,
    activeSegment,
    handleToggleHoverReorder,
    handleInvertSegment
  ]);

  return (
    <div className="min-h-screen bg-[#f7f5e1] flex flex-col font-sans text-slate-800">
      
      {/* Floating Action Feedback Notification */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-mono flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <ArrowLeftRight className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium text-slate-100">{notification.message}</span>
          <button
            onClick={() => {
              handleUndo();
              setNotification(null);
            }}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 border border-slate-600 rounded text-[10px] uppercase font-bold cursor-pointer transition select-none"
            id="toast-undo-btn"
          >
            Undo
          </button>
          <button
            onClick={() => setNotification(null)}
            className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
            id="toast-dismiss-btn"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
            segments={combinedSegments}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={handleSelectSegment}
            onUpdateSegmentZ={handleUpdateSegmentZ}
            onionSkinSegmentId={onionSkinSegmentId}
            onToggleOnionSkin={handleToggleOnionSkin}
            fileName={fileName}
            onAddEmptySegment={handleAddEmptySegment}
            onDeleteSegments={handleDeleteSegments}
            onRenameSegment={handleRenameSegment}
            onDuplicateSegment={handleDuplicateSegment}
            onInvertSegment={handleInvertSegment}
            onInvertSegments={handleInvertSegments}
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
        <div className="lg:col-span-6 w-full flex flex-col items-center justify-start min-h-[600px] overflow-visible">
          <InteractiveGrid
            points={activeSegment ? activeSegment.points : []}
            allPoints={rawPoints}
            fitViewTrigger={fitViewTrigger}
            onionSkinPoints={onionSkinSegment ? onionSkinSegment.points : undefined}
            selectedPointId={selectedPointId}
            onSelectPoint={handleSelectPoint}
            onUpdatePointCoordinates={handleUpdatePointCoordinates}
            gridSettings={gridSettings}
            setGridSettings={setGridSettings}
            highlightColor={activeSegment ? activeSegment.color : undefined}
            activeSegmentId={selectedSegmentId || undefined}
            onDragStart={() => pushToHistory()}
            fileName={fileName}
            onInvertToolpath={handleInvertSegment}
            isHoverReorderActive={isHoverReorderActive}
            onToggleHoverReorder={handleToggleHoverReorder}
            hoverReorderStartNum={hoverReorderStartNum}
            onUpdateHoverReorderStartNum={setHoverReorderStartNum}
            hoverSequencedIds={hoverSequencedIds}
            onHoverReorderPoint={handleHoverReorderPoint}
            onResetHoverSequence={handleResetHoverSequence}
            hoverReorderRequireClick={hoverReorderRequireClick}
            onToggleHoverReorderRequireClick={handleToggleHoverReorderRequireClick}
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
            insertOffset={insertOffset}
            onUpdateInsertOffset={setInsertOffset}
            insertMode={insertMode}
            onUpdateInsertMode={setInsertMode}
            onAddFirstPointToSegment={handleAddFirstPointToSegment}
            isArrowDrawingEnabled={isArrowDrawingEnabled}
            onToggleArrowDrawing={() => setIsArrowDrawingEnabled((prev) => !prev)}
            arrowDrawDistance={arrowDrawDistance}
            onUpdateArrowDrawDistance={setArrowDrawDistance}
            onInvertToolpath={() => selectedSegmentId && handleInvertSegment(selectedSegmentId)}
            isHoverReorderActive={isHoverReorderActive}
            onToggleHoverReorder={handleToggleHoverReorder}
            hoverReorderStartNum={hoverReorderStartNum}
            onUpdateHoverReorderStartNum={setHoverReorderStartNum}
            hoverSequencedIds={hoverSequencedIds}
            onResetHoverSequence={handleResetHoverSequence}
            hoverReorderRequireClick={hoverReorderRequireClick}
            onToggleHoverReorderRequireClick={handleToggleHoverReorderRequireClick}
          />
        </div>

      </div>
    </div>
  );
}
