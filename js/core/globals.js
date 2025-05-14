/**
 * Simplified Global Configuration
 * Most of these are now managed by js/core/config.js or initialized elsewhere.
 */

// Three.js scene variables - Initialized in rendering.js
// window.scene = null;
// window.camera = null;
// window.renderer = null;
// window.controls = null;

// Core brick objects - Initialized in geometry.js and main.js
// window.stampBase = null;
// window.extrudedGroup = null;

// Basic settings - Mostly covered by js/core/config.js via getters/setters
// window.svgScaleFactor = 1.0; // Access via StampForgeConfig or global getter
// window.svgResolution = 1.0; // Access via StampForgeConfig or global getter
// window.svgAssumeCCW = true; // Access via StampForgeConfig or global getter
// window.brickDimensions = { width: 20, height: 3, depth: 20 }; // Access via StampForgeConfig or global getter
// window.brickColor = 0xbc8f8f; // Access via StampForgeConfig or global getter

window.currentBaseTopSurfaceY = 0; // This seems to be a dynamic state variable.

// Extrusion settings - Covered by js/core/config.js
// window.extrusionHeight = 1.5; // Access via StampForgeConfig or global getter
