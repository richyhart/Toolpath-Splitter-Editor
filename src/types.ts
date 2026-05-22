/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ToolpathPoint {
  id: string; // Unique identifier for React keys and dragging state
  originalIndex: number; // For keeping track of CSV lines
  type: string;  // Movement type (e.g., "G0", "G1", "RAPID", "FEED")
  x: number;     // X coordinate
  y: number;     // Y coordinate
  z: number;     // Z coordinate
  speed: number; // Tool speed/Feedrate
}

export interface ToolpathSegment {
  id: string;
  zValue: number;
  points: ToolpathPoint[];
  color: string; // Visually group or styled color
}

export interface GridSettings {
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  showPoints: boolean;
  showArrows: boolean;
  showNodeNumbers?: boolean;
  zoom: number;
  offsetX: number;
  offsetY: number;
}
