/**
 * Central configuration system for StampForge
 * Replaces scattered global variables with a structured approach
 */

// Initialize StampForgeConfig if it doesn't exist
window.StampForgeConfig = window.StampForgeConfig || {};

// Create a global configuration object
window.StampForgeConfig = {
    // SVG processing settings
    svg: {
        scale: 1.0,                  // Scale factor for SVG
        resolution: 1.0,             // Resolution multiplier for curve sampling
        assumeCCW: true,             // Whether to assume counter-clockwise winding for shapes
        holeDetection: {
            areaRatioThreshold: 0.5, // Max ratio of hole area to parent shape area (0-1)
            pointsInsideThreshold: 0.6, // Percentage of points required to be inside (0-1)
            zeroAreaThreshold: 0.0001, // Minimum area to not be considered zero
            aggressiveness: 0.1      // Overall aggressiveness of hole detection (0-1) // Default was 0.7, ensure this is intended
        }
    },
    
    // Rendering settings
    render: {
        maxInteractiveQuality: 0.7,  // Quality factor for interactive updates (0.0 - 1.0)
        isHighQualityMode: false,    // Whether high quality mode is active
    },
    
    // Extrusion settings
    extrusion: {
        height: 1.5,                 // Height of extrusion in mm
        position: {                  // Position offset from center
            x: 0,
            y: 0,
            z: 0
        },
        autoSetYOffset: true,        // Whether to automatically set Y offset
    },
    
    // Brick/base settings
    base: {
        dimensions: {                // Base dimensions in mm
            width: 20,
            height: 3,
            depth: 20
        },
        color: 0xbc8f8f,            // Default brick color (rosewood)
        rotation: {                  // Base rotation in degrees
            x: 0,
            y: 0,
            z: 0
        },
        rotationStep: 90             // Rotation step in degrees
    },
    
    // Export settings
    export: {
        enableBevel: true,          // Whether to bevel edges in exports
        extrudeSteps: 6,            // Number of steps in extrusions
    }
};

// Initialize default global variables for backward compatibility
window.svgScaleFactor = window.StampForgeConfig.svg.scale;
window.extrusionPosition = window.StampForgeConfig.extrusion.position;
window.autoSetYOffset = window.StampForgeConfig.extrusion.autoSetYOffset;
window.extrusionHeight = window.StampForgeConfig.extrusion.height;

// Provide getters/setters for backward compatibility with existing code
// This allows old code to still work while we transition to the new configuration system
Object.defineProperties(window, {
    'svgScaleFactor': {
        get: () => window.StampForgeConfig.svg.scale,
        set: (value) => { window.StampForgeConfig.svg.scale = value; }
    },
    'svgResolution': {
        get: () => window.StampForgeConfig.svg.resolution,
        set: (value) => { window.StampForgeConfig.svg.resolution = value; }
    },
    'svgAssumeCCW': {
        get: () => window.StampForgeConfig.svg.assumeCCW,
        set: (value) => { window.StampForgeConfig.svg.assumeCCW = value; }
    },
    'maxInteractiveQuality': {
        get: () => window.StampForgeConfig.render.maxInteractiveQuality,
        set: (value) => { window.StampForgeConfig.render.maxInteractiveQuality = value; }
    },
    'isHighQualityMode': {
        get: () => window.StampForgeConfig.render.isHighQualityMode,
        set: (value) => { window.StampForgeConfig.render.isHighQualityMode = value; }
    },
    'extrusionHeight': {
        get: () => window.StampForgeConfig.extrusion.height,
        set: (value) => { window.StampForgeConfig.extrusion.height = value; }
    },
    'extrusionPosition': {
        get: () => window.StampForgeConfig.extrusion.position,
        set: (value) => { window.StampForgeConfig.extrusion.position = value; }
    },
    'autoSetYOffset': {
        get: () => window.StampForgeConfig.extrusion.autoSetYOffset,
        set: (value) => { window.StampForgeConfig.extrusion.autoSetYOffset = value; }
    },
    'brickDimensions': {
        get: () => window.StampForgeConfig.base.dimensions,
        set: (value) => { window.StampForgeConfig.base.dimensions = value; }
    },
    'brickColor': {
        get: () => window.StampForgeConfig.base.color,
        set: (value) => { window.StampForgeConfig.base.color = value; }
    },
    'rotationStepDegrees': {
        get: () => window.StampForgeConfig.base.rotationStep,
        set: (value) => { window.StampForgeConfig.base.rotationStep = value; }
    },
    'exportSettings': {
        get: () => ({
            enableBevel: window.StampForgeConfig.export.enableBevel,
            extrudeSteps: window.StampForgeConfig.export.extrudeSteps
        }),
        set: (value) => {
            if (value && typeof value === 'object') {
                if ('enableBevel' in value) window.StampForgeConfig.export.enableBevel = value.enableBevel;
                if ('extrudeSteps' in value) window.StampForgeConfig.export.extrudeSteps = value.extrudeSteps;
            }
        }
    },
    
    // Add accessor for hole detection settings
    'svgHoleDetectionSettings': {
        get: () => {
            // Ensure the path exists
            if (!window.StampForgeConfig.svg) window.StampForgeConfig.svg = {};
            if (!window.StampForgeConfig.svg.holeDetection) {
                 window.StampForgeConfig.svg.holeDetection = { // Default values if not set
                    areaRatioThreshold: 0.5,
                    pointsInsideThreshold: 0.6,
                    zeroAreaThreshold: 0.0001,
                    aggressiveness: 0.1 // Default was 0.7
                };
            }
            return window.StampForgeConfig.svg.holeDetection;
        },
        set: (value) => { 
            if (!window.StampForgeConfig.svg) window.StampForgeConfig.svg = {};
            if (value && typeof value === 'object') {
                window.StampForgeConfig.svg.holeDetection = Object.assign(window.StampForgeConfig.svg.holeDetection || {}, value);
            }
        }
    },
    
    // Update global config with better support for SVG properties
    'applyGlobalConfig': {
        value: function(newConfig) {
            // Merge new config into the global config
            if (newConfig) {
                // Handle special properties that need copying instead of reference assignment
                if (newConfig.extrusion && newConfig.extrusion.position) {
                    window.StampForgeConfig.extrusion.position = {
                        x: newConfig.extrusion.position.x || 0,
                        y: newConfig.extrusion.position.y || 0,
                        z: newConfig.extrusion.position.z || 0
                    };
                }
                
                // Deep merge for other properties
                if (newConfig.svg) {
                    Object.assign(window.StampForgeConfig.svg, newConfig.svg);
                }
                
                if (newConfig.extrusion) {
                    if (newConfig.extrusion.height !== undefined) {
                        window.StampForgeConfig.extrusion.height = newConfig.extrusion.height;
                    }
                    if (newConfig.extrusion.autoSetYOffset !== undefined) {
                        window.StampForgeConfig.extrusion.autoSetYOffset = newConfig.extrusion.autoSetYOffset;
                    }
                }
                
                // Update the global variables for backward compatibility
                window.svgScaleFactor = window.StampForgeConfig.svg.scale;
                window.extrusionPosition = window.StampForgeConfig.extrusion.position;
                window.autoSetYOffset = window.StampForgeConfig.extrusion.autoSetYOffset;
                window.extrusionHeight = window.StampForgeConfig.extrusion.height;
                
                console.log("Global config updated:", window.StampForgeConfig);
            }
        }
    }
});

// The initial setup block for svgHoleDetectionSettings before the main StampForgeConfig object
// is now redundant due to the getter ensuring defaults.
// We can remove the following:
// if (!window.StampForgeConfig) {
//     window.StampForgeConfig = {};
// }
// if (!window.StampForgeConfig.svg) {
//     window.StampForgeConfig.svg = {
//         scale: 1.0,
//         resolution: 1.0,
//         assumeCCW: true
//     };
// }
// if (!window.StampForgeConfig.svg.holeDetection) {
//     window.StampForgeConfig.svg.holeDetection = {
//         areaRatioThreshold: 0.5,
//         pointsInsideThreshold: 0.6,
//         zeroAreaThreshold: 0.0001,
//         aggressiveness: 0.7
//     };
// }
// if (!window.svgHoleDetectionSettings) {
//     Object.defineProperty(window, 'svgHoleDetectionSettings', {
//         get: function() {
//             return window.StampForgeConfig.svg.holeDetection;
//         },
//         set: function(newSettings) {
//             if (newSettings && typeof newSettings === 'object') {
//                 Object.assign(window.StampForgeConfig.svg.holeDetection, newSettings);
//             }
//         },
//         configurable: true
//     });
// }
// console.log("Configuration system initialized with hole detection settings:", window.svgHoleDetectionSettings);
