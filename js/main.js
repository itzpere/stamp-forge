// Initialize the Three.js scene
function init() {
    try {
        // Create scene
        initScene();
        
        // Create initial brick without texture
        createBrick(); // This initializes extrudedGroup
        
        // Use a safer camera position first
        camera.position.set(0, 20, 30);
        camera.lookAt(0, 0, 0);
        controls.update();
        
        // Then fit camera to objects with a delay
        setTimeout(() => {
            try {
                fitCameraToObject();
            } catch (e) {
                console.error("Error in fitCameraToObject:", e);
            }
        }, 500); // Longer delay to ensure objects are created
        
        // Set up event listeners
        const svgUploadElement = document.getElementById('svgUpload');
        if (svgUploadElement) {
            svgUploadElement.addEventListener('change', handleSVGUpload);
        } else {
            console.error("SVG upload element not found in the DOM");
        }
        
        const resetViewElement = document.getElementById('resetView');
        if (resetViewElement) {
            resetViewElement.addEventListener('click', function() {
                // Use safer default position
                camera.position.set(0, 20, 30);
                camera.lookAt(0, 0, 0);
                controls.update();
            });
        }
        
        const downloadSTLElement = document.getElementById('downloadSTL');
        if (downloadSTLElement) {
            downloadSTLElement.addEventListener('click', exportSTL);
        }
        
        // Set up UI controls event listeners
        setupUIControls();
        
        // Start animation loop
        animate();
        
        console.log("Application initialized successfully");
    } catch (error) {
        console.error("Error initializing application:", error);
        alert("Error initializing 3D view. Please check console for details.");
    }
}

// Initialize the application when the page loads
window.addEventListener('DOMContentLoaded', function() {
    init();
});
