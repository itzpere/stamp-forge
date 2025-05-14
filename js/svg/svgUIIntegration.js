window.SVGProcessing = window.SVGProcessing || {};
window.SVGProcessing.UI = {};

function cleanupSVGResources() {
    if (window.extrudedGroup) { // Ensure extrudedGroup is accessed via window if it's global
        while (window.extrudedGroup.children.length > 0) {
            const child = window.extrudedGroup.children[0];
            window.extrudedGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }
    }
    window.shapeColorCounter = 0; // Ensure shapeColorCounter is accessed via window if it's global
}
window.cleanupSVGResources = cleanupSVGResources; // Keep global for direct access if needed
window.SVGProcessing.UI.cleanupSVGResources = cleanupSVGResources;

function resetShapeCounter() {
    window.shapeCounter = 0; // Ensure shapeCounter is accessed via window if it's global
}
window.resetShapeCounter = resetShapeCounter; // Keep global for direct access if needed
window.SVGProcessing.UI.resetShapeCounter = resetShapeCounter;
