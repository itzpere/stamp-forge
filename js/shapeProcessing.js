/**
 * Shape processing utility for StampForge
 * Handles processing of SVG shapes for extrusion with XY as ground plane
 */

window.SVGProcessing = window.SVGProcessing || {};
window.SVGProcessing.Shapes = window.SVGProcessing.Shapes || {};

// Create a function to transform SVG coordinates to 3D space
// with XY as the ground plane (Z up)
window.SVGProcessing.Shapes.transformSVGToXYPlane = function(point, svgCenterX, svgCenterY, effectiveScale) {
    return new THREE.Vector2(
        (point.x - svgCenterX) * effectiveScale,
        (point.y - svgCenterY) * -effectiveScale
    );
};

// Create a standard function for determining shape height based on new coordinate system
window.SVGProcessing.Shapes.getShapeHeight = function(extrusionHeight) {
    // Z axis represents height in the new coordinate system
    return typeof extrusionHeight === 'number' && extrusionHeight > 0 ? extrusionHeight : 1.5;
};

console.log("Shape processing utilities initialized for XY ground plane");
