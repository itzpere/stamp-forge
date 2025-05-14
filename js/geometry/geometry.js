let defaultBaseLoaded = false;

function createBrick() {
    clearExistingObjects();
    
    window.extrudedGroup = new THREE.Group(); // Ensure it's assigned to window
    scene.add(window.extrudedGroup);
    
    if (window.stampBase) { // Use window.stampBase
        scene.add(window.stampBase);
        console.log("Using custom STL stamp base");
    } else {
        loadDefaultStampBase();
    }
}

function clearExistingObjects() {
    const objectsToRemove = [
        { obj: 'brick', global: window.brick },
        { obj: 'triangleMesh', global: window.triangleMesh },
        { obj: 'mirrorTriangleMesh', global: window.mirrorTriangleMesh },
        { obj: 'extrudedGroup', global: window.extrudedGroup },
        { obj: 'slotGroup', global: window.slotGroup },
        { obj: 'stampBase', global: window.stampBase }
    ];
    
    objectsToRemove.forEach(item => {
        if (typeof item.global !== 'undefined' && item.global) {
            scene.remove(item.global);
            if (window[item.obj] === item.global) { // Ensure we only nullify if it's the exact same object
                 window[item.obj] = null;
            }
        }
    });
}

function loadDefaultStampBase() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.classList.remove('hidden');
        loadingElement.textContent = 'Loading default stamp base...';
    }
    
    const loader = new THREE.STLLoader();
    loader.load(
        './models/default_stamp_base.stl',
        function (geometry) {
            const material = new THREE.MeshStandardMaterial({ 
                color: brickColor,
                roughness: 0.5,
                metalness: 0.2,
                side: THREE.DoubleSide
            });
            
            window.stampBase = new THREE.Mesh(geometry, material); // Assign to window.stampBase
            
            geometry.computeBoundingBox();
            const boundingBox = geometry.boundingBox;
            const center = new THREE.Vector3();
            boundingBox.getCenter(center);
            geometry.translate(-center.x, -boundingBox.min.y, -center.z);

            // Recompute bounding box AFTER translation for accurate size
            geometry.computeBoundingBox();
            const size = new THREE.Vector3();
            geometry.boundingBox.getSize(size); // Use updated boundingBox
            
            brickDimensions.height = size.y > 0 ? size.y : 3;
            brickDimensions.width = size.x > 0 ? size.x : 20;
            brickDimensions.depth = size.z > 0 ? size.z : 20;
            
            if (typeof applyAutoYOffsetBehavior === 'function') {
                applyAutoYOffsetBehavior();
            }
            
            scene.add(window.stampBase); // Use window.stampBase
            defaultBaseLoaded = true;
            
            updateAndApplyBaseTopSurface();
            
            setTimeout(fitCameraToObject, 100);
            
            if (loadingElement) {
                loadingElement.classList.add('hidden');
            }
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.error('Error loading default stamp base:', error);
            alert('Error loading default stamp base. Please reload the page.');
            
            if (loadingElement) {
                loadingElement.classList.add('hidden');
            }
        }
    );
}

function updateAndApplyBaseTopSurface() {
    if (!window.stampBase) { // Use window.stampBase
        console.warn("updateAndApplyBaseTopSurface: stampBase is null");
        currentBaseTopSurfaceY = brickDimensions.height || 3.0;
        return;
    }

    window.stampBase.updateMatrixWorld(true); // Use window.stampBase
    const worldBox = new THREE.Box3().setFromObject(window.stampBase); // Use window.stampBase
    
    if (worldBox.isEmpty()) {
        console.warn("Stamp base bounding box is empty. Using height from dimensions.");
        currentBaseTopSurfaceY = brickDimensions.height || 3.0;
    } else {
        currentBaseTopSurfaceY = worldBox.max.y;
    }
    
    // console.log(`[updateAndApplyBaseTopSurface] Updated surface Y to: ${currentBaseTopSurfaceY.toFixed(2)}`);

    if (autoSetYOffset === true) {
        // Add check for face components before repositioning any objects
        if (window.extrudedGroup) { // Use window.extrudedGroup
            // Lock face component positions to prevent overriding during updates
            window.extrudedGroup.traverse(child => { // Use window.extrudedGroup
                if (child.isMesh && child.userData && child.userData.isFaceComponent) {
                    // Store current position in userData for reference
                    if (!child.userData.lockedPosition) {
                        child.userData.lockedPosition = {
                            x: child.position.x,
                            y: child.position.y,
                            z: child.position.z
                        };
                    }
                }
            });
        }
    }
}
