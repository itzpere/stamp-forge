window.scene = window.scene || null;
window.camera = window.camera || null;
window.renderer = window.renderer || null;
window.controls = window.controls || null;

window.initScene = function() {
    try {
        window.scene = new THREE.Scene();
        window.scene.background = new THREE.Color(0xf0f0f0);
        
        window.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        window.camera.position.set(0, 20, 30);
        window.camera.lookAt(0, 0, 0);
        
        const container = document.getElementById('three-container');
        if (!container) {
            console.error("Could not find three-container element");
            return;
        }
        
        window.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        window.renderer.setPixelRatio(window.devicePixelRatio);
        window.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(window.renderer.domElement);
        
        window.controls = new THREE.OrbitControls(window.camera, window.renderer.domElement);
        window.controls.addEventListener('change', window.render);
        window.controls.enableDamping = true;
        window.controls.dampingFactor = 0.25;
        
        setupLights();
        
        // Create a proper resize handler to fix stretching
        window.addEventListener('resize', function() {
            updateRendererSize();
        });

        // Initial size setup
        updateRendererSize();
        
        animate();
    } catch (error) {
        console.error("Error initializing Three.js scene:", error);
    }
};

function setupLights() {
    if (!window.scene) {
        console.error("Scene not initialized");
        return;
    }
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 15);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(-5, 10, -10);
    
    window.scene.add(ambientLight);
    window.scene.add(directionalLight);
    window.scene.add(backLight);
}

function onWindowResize() {
    if (!window.camera || !window.renderer) {
        console.error("Camera or renderer not initialized");
        return;
    }
    
    const container = document.getElementById('three-container');
    if (!container) {
        console.error("Could not find three-container element");
        return;
    }
    
    window.camera.aspect = container.clientWidth / container.clientHeight;
    window.camera.updateProjectionMatrix();
    
    window.renderer.setSize(container.clientWidth, container.clientHeight);
    
    window.render();
}

function updateRendererSize() {
    if (!renderer || !camera) return;
    
    const container = document.getElementById('three-container');
    if (!container) return;
    
    // Get the container dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Update renderer size
    renderer.setSize(width, height);
    
    // Update camera aspect ratio
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    // Force a render
    if (scene) renderer.render(scene, camera);
}

// Make updateRendererSize globally available
window.updateRendererSize = updateRendererSize;

// Schedule periodic checks to ensure correct aspect ratio
function scheduleAspectRatioChecks() {
    // Initial check
    setTimeout(updateRendererSize, 500);
    
    // Additional checks in case layout changes affect the container size
    setTimeout(updateRendererSize, 1000);
    setTimeout(updateRendererSize, 2000);
}

// Call this after initializing the scene
function onSceneInitialized() {
    // Schedule aspect ratio checks
    scheduleAspectRatioChecks();
    
    // Ensure renderer size is updated
    updateRendererSize();
}

window.render = function() {
    if (window.renderer && window.scene && window.camera) {
        window.renderer.render(window.scene, window.camera);
    }
};

window.animate = function() {
    requestAnimationFrame(window.animate);
    
    if (window.controls) window.controls.update();
    
    if (window.controls && window.controls.enabled) {
        window.render();
    }
    
    protectFaceComponentPositions();
};

function protectFaceComponentPositions() {
    if (window.extrudedGroup) {
        window.extrudedGroup.traverse(child => {
            if (child.isMesh && child.userData && child.userData.isPositionLocked) {
                // Only fix if position was changed and targetPosition exists
                if (child.userData.targetPosition) {
                    const target = child.userData.targetPosition;
                    const current = child.position;
                    
                    // Check if position was changed
                    if (!current.equals(target)) {
                        console.log(`Face component position reset from (${current.x.toFixed(2)}, ${current.y.toFixed(2)}, ${current.z.toFixed(2)}) to (${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)})`);
                        child.position.copy(target);
                        child.updateMatrix();
                    }
                }
            }
        });
    }
}

window.fitCameraToObject = function(offset = 1.5) {
    if (!window.scene || !window.camera) return;

    const boundingBox = new THREE.Box3().setFromObject(window.scene);

    if (boundingBox.isEmpty()) {
        console.warn('Cannot fit camera to empty bounding box');
        return;
    }

    const center = new THREE.Vector3();
    boundingBox.getCenter(center);

    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    const radius = Math.max(size.x, size.y, size.z) * 0.7;

    const direction = new THREE.Vector3(0.5, 0.5, 1).normalize();
    const distance = radius / Math.sin(window.camera.fov * Math.PI / 360);
    const cameraPosition = center.clone().add(direction.multiplyScalar(distance));

    window.camera.position.copy(cameraPosition);
    window.camera.lookAt(center);
    window.controls.target.copy(center);

    window.controls.update();

    window.render();
};

// Add global camera view functions
window.setCameraTopView = function() {
    // Position camera above but rotated 180 degrees (negative Z)
    camera.position.set(0, 50, -0.1);
    camera.lookAt(0, 0, 0);
    controls.update();
    renderer.render(scene, camera);
}

window.setCameraSideView = function() {
    // Get current brick height for proper positioning
    const baseHeight = (window.brickDimensions && window.brickDimensions.height) ? 
        window.brickDimensions.height : 3;
    
    camera.position.set(50, baseHeight/2 + 5, 0);
    camera.lookAt(0, baseHeight/2, 0);
    controls.update();
    renderer.render(scene, camera);
}

// Attach to buttons when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const topViewBtn = document.getElementById('topView');
    const sideViewBtn = document.getElementById('sideView');
    
    if (topViewBtn) {
        topViewBtn.addEventListener('click', window.setCameraTopView);
    }
    
    if (sideViewBtn) {
        sideViewBtn.addEventListener('click', window.setCameraSideView);
    }
});

// Remove stub functions as full implementations are in js/utils/utilities.js

window.isUserInteracting = false;
window.pendingUpdate = false;
