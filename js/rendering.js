// Initialize the Three.js scene
function initScene() {
    // Create scene with proper background
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0); // Light gray background
    
    // Create camera with improved settings
    camera = new THREE.PerspectiveCamera(
        60, // Field of view
        window.innerWidth / window.innerHeight,
        0.1, // Near plane (avoid too small values)
        1000
    );
    
    // Set initial camera position to a safe default
    camera.position.set(0, 20, 30); // Position that should show the scene
    camera.lookAt(0, 0, 0);
    
    // Create renderer with proper settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    });
    
    const container = document.getElementById('three-container');
    if (!container) {
        console.error("Could not find three-container element!");
        return;
    }
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add renderer to DOM
    container.appendChild(renderer.domElement);
    
    // Add lights - CRITICAL FOR VISIBILITY
    setupLights();
    
    // Set up orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.rotateSpeed = 0.8;
    controls.panSpeed = 0.8;
    controls.screenSpacePanning = true;
    controls.minDistance = 5;
    controls.maxDistance = 100;
    
    // Add a grid helper for reference
    const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0x444444);
    scene.add(gridHelper);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Log successful initialization
    console.log("Three.js scene initialized successfully");
}

// Set up scene lighting
function setupLights() {
    // Clear any existing lights
    scene.children.forEach(child => {
        if (child.isLight) scene.remove(child);
    });
    
    // Ambient light - essential for overall visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Main directional light (like sunlight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 35, 25);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    
    scene.add(directionalLight);
    
    // Additional fill light for better visibility
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4); // Increased intensity
    fillLight.position.set(-20, 15, -15);
    scene.add(fillLight);
    
    console.log("Lights set up successfully");
}

// Animation loop with error handling
function animate() {
    try {
        requestAnimationFrame(animate);
        
        // Update controls for smooth damping effect
        if (controls) controls.update();
        
        // Render scene with camera
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    } catch (error) {
        console.error("Error in animation loop:", error);
    }
}

// Enhanced window resize handler
function onWindowResize() {
    const container = document.getElementById('three-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// New function: Move camera to view the entire scene safely
function fitCameraToObject() {
    try {
        // Check if we have objects to fit
        if (!brick) {
            console.warn("No brick found for camera fitting");
            // Use default position as fallback
            camera.position.set(0, 20, 30);
            camera.lookAt(0, 0, 0);
            controls.target.set(0, 0, 0);
            controls.update();
            return;
        }
        
        // Calculate bounding box of all objects
        const boundingBox = new THREE.Box3();
        
        // Add brick and triangles to bounding calculation
        boundingBox.expandByObject(brick);
        if (triangleMesh) boundingBox.expandByObject(triangleMesh);
        if (mirrorTriangleMesh) boundingBox.expandByObject(mirrorTriangleMesh);
        
        // Add all extrusions to bounding calculation
        if (extrudedGroup && extrudedGroup.children.length > 0) {
            boundingBox.expandByObject(extrudedGroup);
        }
        
        // Get bounding sphere
        const boundingSphere = new THREE.Sphere();
        boundingBox.getBoundingSphere(boundingSphere);
        
        // Get center and radius
        const center = boundingSphere.center;
        const radius = boundingSphere.radius || 10; // Fallback radius if bounding calculation fails
        
        // Position camera based on object size, with a minimum distance
        const offset = Math.max(radius * 2.5, 15);
        camera.position.set(
            0,
            center.y + offset,
            center.z - offset
        );
        
        // Look at center of objects
        camera.lookAt(center);
        controls.target.copy(center);
        
        // Update controls
        controls.update();
        
        console.log("Camera positioned to fit objects:", {
            center: center.toArray(),
            radius,
            cameraPosition: camera.position.toArray()
        });
    } catch (error) {
        console.error("Error fitting camera to object:", error);
        // Use default position as fallback
        camera.position.set(0, 20, 30);
        camera.lookAt(0, 0, 0);
        controls.update();
    }
}
