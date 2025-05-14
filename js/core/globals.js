/**
 * Simplified Global Configuration
 */

// Three.js scene variables
window.scene = null;
window.camera = null;
window.renderer = null;
window.controls = null;

// Core brick objects
window.stampBase = null;
window.extrudedGroup = null;

// Basic settings
window.svgScaleFactor = 1.0;
window.svgResolution = 1.0;
window.svgAssumeCCW = true;
window.brickDimensions = { width: 20, height: 3, depth: 20 };
window.brickColor = 0xbc8f8f; // Rosewood color
window.currentBaseTopSurfaceY = 0;

// Extrusion settings
window.extrusionHeight = 1.5;
window.extrusionPosition = { x: 0, y: 0, z: 0 };
window.autoSetYOffset = true;

// SVG processing
window.shapeRenderInfo = [];
window.shapeColorCounter = 0;
window.lastSvgData = null;

// Quality settings
window.maxInteractiveQuality = 0.7;
window.isHighQualityMode = false;

// Export settings
window.exportSettings = { enableBevel: true, extrudeSteps: 6 };

// UI state
window.isUserInteracting = false;
window.pendingUpdate = false;
