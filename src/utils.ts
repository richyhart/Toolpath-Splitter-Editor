/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToolpathPoint, ToolpathSegment } from "./types";

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

    let rawType = columns[0] || "Line passing";
    let type = "Line passing";

    // Gracefully map conventional G-code or arbitrary types to the requested three CMD types
    const lowerType = rawType.toLowerCase().trim();
    if (lowerType === "start of line dispense") {
      type = "Start of line dispense";
    } else if (lowerType === "end of line dispense") {
      type = "End of line dispense";
    } else if (lowerType === "line passing") {
      type = "Line passing";
    } else if (lowerType === "g0" || lowerType === "rapid") {
      type = "Start of line dispense";
    } else if (lowerType === "g1" || lowerType === "feed") {
      type = "Line passing";
    } else if (lowerType.includes("start")) {
      type = "Start of line dispense";
    } else if (lowerType.includes("end")) {
      type = "End of line dispense";
    } else {
      type = "Line passing";
    }

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
      type: "Start of line dispense",
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
        
        let pointType = "Line passing";
        if (s === numSteps) {
          pointType = "End of line dispense";
        } else if (s === 0) {
          pointType = "Start of line dispense";
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
      type: "Start of line dispense",
      x: 20,
      y: 20,
      z,
      speed: 2000.0,
    });

    // Square travel
    const perimeter = [
      { x: 80, y: 20, type: "Line passing" },
      { x: 80, y: 80, type: "Line passing" },
      { x: 20, y: 80, type: "Line passing" },
      { x: 20, y: 20, type: "End of line dispense" }
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
      type: "Start of line dispense",
      x: 35,
      y: 35,
      z,
      speed: 2000.0,
    });
    points.push({
      id: generateId(),
      originalIndex: originalIndex++,
      type: "End of line dispense",
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

      let pointType = "Line passing";
      if (i === 0) {
        pointType = "Start of line dispense";
      } else if (i === numPoints * 2) {
        pointType = "End of line dispense";
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
