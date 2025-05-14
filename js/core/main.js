async function init() { 
    try {
        if (typeof loadBaseDesigns === 'function') {
            await loadBaseDesigns();
        } else {
            console.error("loadBaseDesigns function is not available. Default base might not load correctly.");
            window.baseDesigns = window.baseDesigns || [{
                id: "default",
                title: "Default Base",
                file: "models/default_stamp_base.stl",
                config: { width: 20, height: 3, depth: 20, rotation: { x: 0, y: 0, z: 0 } }
            }];
        }

        // Ensure all necessary global variables are initialized from config
        window.svgScaleFactor = window.StampForgeConfig ? window.StampForgeConfig.svg.scale : 1.0;
        window.extrusionPosition = window.StampForgeConfig && window.StampForgeConfig.extrusion ? 
            window.StampForgeConfig.extrusion.position : { x: 0, y: 0, z: 0 };
        window.autoSetYOffset = window.StampForgeConfig && window.StampForgeConfig.extrusion ? 
            window.StampForgeConfig.extrusion.autoSetYOffset : true;
        window.extrusionHeight = window.StampForgeConfig && window.StampForgeConfig.extrusion ? 
            window.StampForgeConfig.extrusion.height : 1.5;
            
        // Log initialized SVG properties for debugging
        console.log("SVG Properties initialized:", {
            svgScaleFactor: window.svgScaleFactor,
            extrusionPosition: window.extrusionPosition,
            autoSetYOffset: window.autoSetYOffset,
            extrusionHeight: window.extrusionHeight
        });
        
        initScene();
        
        // Initialize extrudedGroup for SVG extrusions and assign to window
        window.extrudedGroup = new THREE.Group();
        if (window.scene) { // Ensure scene is available
            window.scene.add(window.extrudedGroup);
        } else {
            console.error("Scene not initialized before adding extrudedGroup.");
        }
        
        // Set initial camera position with 180-degree rotation (negative Z)
        camera.position.set(0, 20, -30);
        camera.lookAt(0, 0, 0);
        controls.update();
        
        const svgUploadElement = document.getElementById('svgUpload');
        if (svgUploadElement) {
            svgUploadElement.addEventListener('change', function(event) { 
                if (event.target.files && event.target.files.length > 0) {
                    const file = event.target.files[0];
                    if (typeof handleSVGUpload === 'function') {
                        handleSVGUpload(file); 
                    } else {
                        console.error("handleSVGUpload function is not defined.");
                        alert("Error: SVG upload functionality is not available.");
                    }
                }
            });
        } else {
            console.error("SVG upload element not found in the DOM");
        }
        
        const resetViewElement = document.getElementById('resetView');
        if (resetViewElement) {
            resetViewElement.addEventListener('click', function() {
                camera.position.set(0, 20, -30);
                camera.lookAt(0, 0, 0);
                controls.update();
            });
        }
        
        const downloadSTLElement = document.getElementById('downloadSTL');
        if (downloadSTLElement) {
            downloadSTLElement.addEventListener('click', exportSTL);
        }
        
        if (typeof setupUIControls === 'function') {
            setupUIControls();
        } else {
            console.error("setupUIControls function not found! Check script loading order");
            window.setupUIControls = function() {
                console.warn("Using fallback UI controls setup");
                const svgScaleEl = document.getElementById('svgScale');
                if (svgScaleEl) {
                    svgScaleEl.value = svgScaleFactor || 1;
                }
            };
            window.setupUIControls();
        }
        
        if (typeof initDynamicUIElements === 'function') {
            initDynamicUIElements();
        } else {
            console.error("initDynamicUIElements function not found! Check script loading order for uiManager.js");
        }
        
        if (typeof showInitialModal === 'function') {
            showInitialModal();
        }
        
        animate();
    } catch (error) {
        console.error("Error initializing application:", error);
        alert("Error initializing 3D view. Please check console for details.");
    }
}

window.addEventListener('DOMContentLoaded', function() {
    init();
});
