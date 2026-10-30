/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToolpathPoint, ToolpathSegment } from "./types";
import * as XLSX from "xlsx";

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Parse a 5-column toolpath CSV file.
 * Columns: A=Movement Type, B=X, C=Y, D=Z, E=Speed
 */
export function parseToolpathCSV(csvContent: string): ToolpathPoint[] {
  const points: ToolpathPoint[] = [];
  const lines = csvContent.split(/\r?\n/);
  let originalIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Use a simple, robust split that accounts for possible quotes
    const columns = line.split(",").map(val => {
      // Remove double quotes or single quotes from boundaries
      let cleaned = val.trim();
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
          (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.substring(1, cleaned.length - 1).trim();
      }
      return cleaned;
    });

    if (columns.length < 3) continue; // Need at least type, X, Y details

    const type = columns[0] || "Line Passing";

    const x = parseFloat(columns[1]);
    const y = parseFloat(columns[2]);
    const z = columns[3] !== undefined ? parseFloat(columns[3]) : 0.0;
    const speed = columns[4] !== undefined ? parseFloat(columns[4]) : 1000.0;

    // Skip the line if essential coordinates are not valid numbers (could be header)
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      continue;
    }

    points.push({
      id: generateId(),
      originalIndex: originalIndex++,
      type,
      x,
      y,
      z,
      speed: isNaN(speed) ? 1000.0 : speed
    });
  }

  return points;
}

/**
 * Exports edited toolpath points back to a 5-column CSV format.
 */
export function exportToCSV(points: ToolpathPoint[]): string {
  const header = "Movement,X,Y,Z,Speed\n";
  const rows = points.map(p => {
    // Format coordinates to 4 decimal places for CNC precision
    const xStr = p.x.toFixed(4);
    const yStr = p.y.toFixed(4);
    const zStr = p.z.toFixed(4);
    const speedStr = p.speed.toFixed(1);
    return `${p.type},${xStr},${yStr},${zStr},${speedStr}`;
  });
  return header + rows.join("\n");
}

/**
 * Export edited toolpath points back to a styled Excel (.xlsx) sheet representation.
 */
export function exportToXLSX(points: ToolpathPoint[]): ArrayBuffer {
  const rows = points.map(p => ({
    "Movement": p.type,
    "X (mm)": parseFloat(p.x.toFixed(4)),
    "Y (mm)": parseFloat(p.y.toFixed(4)),
    "Z (mm)": parseFloat(p.z.toFixed(4)),
    "Speed (mm/s)": parseFloat(p.speed.toFixed(1))
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set explicit column widths for neat spacing
  worksheet["!cols"] = [
    { wch: 24 }, // Movement type
    { wch: 12 }, // X (mm)
    { wch: 12 }, // Y (mm)
    { wch: 12 }, // Z (mm)
    { wch: 12 }  // Speed (mm/s)
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "DispenseToolpath");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

/**
 * Splits toolpath points into consecutive segments grouped by their Z-axis coordinate.
 * When Z-axis value changes, we start a new segment.
 */
export function splitToolpathByZ(points: ToolpathPoint[]): ToolpathSegment[] {
  if (points.length === 0) return [];

  const segments: ToolpathSegment[] = [];
  let currentGroupPoints: ToolpathPoint[] = [];
  let currentZ = points[0].z;
  
  // Custom styled colors for paths
  const colors = [
    "#809fff", // Soft toolpath blue
    "#3b82f6", 
    "#6366f1",
    "#10b981",
    "#f59e0b",
    "#ec4899"
  ];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    
    if (pt.z !== currentZ && currentGroupPoints.length > 0) {
      // Z changed, commit previous segment
      segments.push({
        id: `segment-${segments.length}`,
        zValue: currentZ,
        points: currentGroupPoints,
        color: colors[segments.length % colors.length]
      });
      // Start new group
      currentGroupPoints = [pt];
      currentZ = pt.z;
    } else {
      currentGroupPoints.push(pt);
    }
  }

  // Commit last group
  if (currentGroupPoints.length > 0) {
    segments.push({
      id: `segment-${segments.length}`,
      zValue: currentZ,
      points: currentGroupPoints,
      color: colors[segments.length % colors.length]
    });
  }

  return segments;
}

/**
 * Inverts the toolpath direction of a list of points from start to finish.
 * Reverses the coordinate sequence and intelligently updates Start/End dispense types.
 */
export function reverseToolpathPoints(points: ToolpathPoint[]): ToolpathPoint[] {
  if (points.length <= 1) return [...points];

  const hadStartAtBeginning = /^start of line dispense$/i.test(points[0].type.trim());
  const hadEndAtFinish = /^end of line dispense$/i.test(points[points.length - 1].type.trim());

  // Clone and reverse the points sequence
  const reversed = [...points].reverse();

  const transformed = reversed.map((pt, idx) => {
    let nextType = pt.type;
    const trimmed = pt.type.trim();

    // Swap Start and End dispense types
    if (/^start of line dispense$/i.test(trimmed)) {
      nextType = "End of Line Dispense";
    } else if (/^end of line dispense$/i.test(trimmed)) {
      nextType = "Start of Line Dispense";
    }

    return {
      ...pt,
      type: nextType,
      originalIndex: idx
    };
  });

  // If the original path started with a Start command, ensure the new starting point has it
  if (hadStartAtBeginning && !/^start of line dispense$/i.test(transformed[0].type.trim())) {
    transformed[0].type = "Start of Line Dispense";
  }

  // If the original path had a defined Start or End command, ensure the new terminating point has End
  if ((hadStartAtBeginning || hadEndAtFinish) && !/^end of line dispense$/i.test(transformed[transformed.length - 1].type.trim())) {
    transformed[transformed.length - 1].type = "End of Line Dispense";
  }

  return transformed;
}

/**
 * Reorders layer points by placing sequenced points starting at startNumber (1-based index),
 * keeping points before startNumber intact, then placing sequenced points in their hovered order,
 * followed by remaining unsequenced points.
 * Also intelligently standardizes Start/End of Line Dispense types.
 */
export function reorderLayerPoints(
  currentPoints: ToolpathPoint[],
  sequencedIds: string[],
  startNumber: number = 1
): ToolpathPoint[] {
  if (currentPoints.length <= 1 || sequencedIds.length === 0) return [...currentPoints];

  const startIndex = Math.max(0, Math.min(startNumber - 1, currentPoints.length - 1));
  const sequencedIdSet = new Set(sequencedIds);
  const pointMap = new Map(currentPoints.map((p) => [p.id, p]));

  // 1. Prefix points: points before startIndex that are NOT in sequencedIds
  const prefixPoints = currentPoints
    .slice(0, startIndex)
    .filter((p) => !sequencedIdSet.has(p.id));

  // 2. The sequenced points in their hovered order
  const orderedSequencedPoints = sequencedIds
    .map((id) => pointMap.get(id))
    .filter((p): p is ToolpathPoint => Boolean(p));

  // 3. Remaining unsequenced points (excluding prefix and sequenced)
  const prefixIdSet = new Set(prefixPoints.map((p) => p.id));
  const remainingPoints = currentPoints.filter(
    (p) => !prefixIdSet.has(p.id) && !sequencedIdSet.has(p.id)
  );

  const reordered = [...prefixPoints, ...orderedSequencedPoints, ...remainingPoints];

  // Preserve Start / End of Line Dispense intent
  const hadStart = currentPoints.some((p) => /^start of line dispense$/i.test(p.type.trim()));
  const hadEnd = currentPoints.some((p) => /^end of line dispense$/i.test(p.type.trim()));

  return reordered.map((pt, idx) => {
    let nextType = pt.type;
    const isFirst = idx === 0;
    const isLast = idx === reordered.length - 1;

    if (hadStart && isFirst) {
      nextType = "Start of Line Dispense";
    } else if (hadEnd && isLast) {
      nextType = "End of Line Dispense";
    } else if (/^start of line dispense$/i.test(pt.type.trim()) && !isFirst) {
      nextType = "Line Passing";
    } else if (/^end of line dispense$/i.test(pt.type.trim()) && !isLast) {
      nextType = "Line Passing";
    }

    return {
      ...pt,
      type: nextType,
      originalIndex: idx
    };
  });
}

/**
 * Re-collates a list of segments into a flat array of ToolpathPoints,
 * preserving or rebuilding originalIndexes.
 */
export function flattenSegments(segments: ToolpathSegment[]): ToolpathPoint[] {
  const result: ToolpathPoint[] = [];
  let index = 0;
  for (const seg of segments) {
    for (const pt of seg.points) {
      result.push({
        ...pt,
        z: seg.zValue, // Guarantee consistency with segment level
        originalIndex: index++
      });
    }
  }
  return result;
}

/**
 * Generate Sample Toolpaths
 */
export function generateSampleSpiral(): ToolpathPoint[] {
  const points: ToolpathPoint[] = [];
  let originalIndex = 0;
  
  // A spiral cylinder: 4 layers, each at constant Z
  const layers = [0.0, -1.0, -2.0, -3.0];
  const center = { x: 50, y: 50 };
  
  for (const z of layers) {
    // Lead-in movement
    points.push({
      id: generateId(),
      originalIndex: originalIndex++,
      type: "Start of Line Dispense",
      x: center.x,
      y: center.y,
      z: z,
      speed: 1500.0,
    });

    // Generate concentric circle
    const numSteps = 24;
    for (let r = 10; r <= 35; r += 8) {
      for (let s = 0; s <= numSteps; s++) {
        const theta = (s / numSteps) * Math.PI * 2;
        const x = center.x + Math.cos(theta) * r;
        const y = center.y + Math.sin(theta) * r;
        
        let pointType = "Line Passing";
        if (s === numSteps) {
          pointType = "End of Line Dispense";
        } else if (s === 0) {
          pointType = "Start of Line Dispense";
        }

        points.push({
          id: generateId(),
          originalIndex: originalIndex++,
          type: pointType,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          z: z,
          speed: s === 0 ? 1500.0 : 800.0,
        });
      }
    }
  }
  return points;
}

export function generateSampleCalibrationCube(): ToolpathPoint[] {
  const points: ToolpathPoint[] = [];
  let originalIndex = 0;

  // Draw standard 3D calibration square perimeters
  const heights = [0.0, 1.0, 2.0, 3.0, 4.0];
  
  for (const z of heights) {
    // Move to start point of square
    points.push({
      id: generateId(),
      originalIndex: originalIndex++,
      type: "Start of Line Dispense",
      x: 20,
      y: 20,
      z,
      speed: 2000.0,
    });

    // Square travel
    const perimeter = [
      { x: 80, y: 20, type: "Line Passing" },
      { x: 80, y: 80, type: "Line Passing" },
      { x: 20, y: 80, type: "Line Passing" },
      { x: 20, y: 20, type: "End of Line Dispense" }
    ];

    for (const node of perimeter) {
      points.push({
        id: generateId(),
        originalIndex: originalIndex++,
        type: node.type,
        x: node.x,
        y: node.y,
        z,
        speed: 1200.0,
      });
    }

    // Small infill cross at this layer
    points.push({
      id: generateId(),
      originalIndex: originalIndex++,
      type: "Start of Line Dispense",
      x: 35,
      y: 35,
      z,
      speed: 2000.0,
    });
    points.push({
      id: generateId(),
      originalIndex: originalIndex++,
      type: "End of Line Dispense",
      x: 65,
      y: 65,
      z,
      speed: 900.0,
    });
  }

  return points;
}

export function generateSampleStar(): ToolpathPoint[] {
  const points: ToolpathPoint[] = [];
  let originalIndex = 0;
  const layers = [0.0, -1.5, -3.0];
  const center = { x: 50, y: 50 };

  for (const z of layers) {
    const numPoints = 5;
    const outerRadius = 35;
    const innerRadius = 15;

    for (let i = 0; i <= numPoints * 2; i++) {
      const isOuter = i % 2 === 0;
      const angle = (i * Math.PI) / numPoints - Math.PI / 2;
      const radius = isOuter ? outerRadius : innerRadius;
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);

      let pointType = "Line Passing";
      if (i === 0) {
        pointType = "Start of Line Dispense";
      } else if (i === numPoints * 2) {
        pointType = "End of Line Dispense";
      }

      points.push({
        id: generateId(),
        originalIndex: originalIndex++,
        type: pointType,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        z,
        speed: i === 0 ? 2500.0 : 1000.0,
      });
    }
  }

  return points;
}
