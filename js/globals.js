// Global variables for the 3D scene
let scene, camera, renderer, controls;

// Global variable for the 3D objects
let brick, texture;
let extrudedGroup; 
let triangleMesh, mirrorTriangleMesh;

// Dimensions and properties (with defaults)
const brickDimensions = { width: 20, height: 3, depth: 20 };
let extrusionHeight = 3; // Default extrusion height in mm
let extrusionPosition = { x: -10, y: 1.5, z: 10 }; // Position offset for extrusions
let extrusionColor = 0x2a75f3;
let brickColor = 0xbc8f8f;
let triangleColor = 0xbc8f8f; // Default triangle color

// SVG and interaction state
let svgScaleFactor = 4; // SVG scale factor
let lastSvgData = null; // Last loaded SVG data
let isUserInteracting = false; // Flag to track user interaction
let pendingUpdate = false; // Flag to track pending updates
let updateTimeout = null; // Timeout reference for debouncing

// Quality control
let isHighQualityMode = false; // Track if we're in high quality mode
let progressiveQuality = 0.2; // Start with low quality and gradually increase
let qualityTransitionTimeout = null; // Track quality transition
let maxInteractiveQuality = 0.7; // Cap the quality for interactive view
let svgResolution = 1.0; // Resolution multiplier for SVG processing

// Add variable to store current SVG filename for export
let currentSvgFilename = "model"; // Default filename if none is specified

// Export settings
const exportSettings = {
    extrudeSteps: 6,
    segmentDivisor: 3,
    minSegments: 20,
    enableBevel: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 3,
    progressCallback: null
};

// Function to clean up the previous SVG objects from the scene
function cleanupPreviousSVG() {
    // Remove the extruded group from the scene if it exists
    if (extrudedGroup) {
        scene.remove(extrudedGroup);
        extrudedGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach((material) => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        extrudedGroup = null;
    }
}
