// Create the 3D brick (uses default dimensions and colors)
function createBrick() {
    // Remove existing brick if it exists
    if (typeof brick !== 'undefined' && brick) {
        scene.remove(brick);
        // Also remove associated triangles
        if (triangleMesh) scene.remove(triangleMesh);
        if (mirrorTriangleMesh) scene.remove(mirrorTriangleMesh);
        triangleMesh = null;
        mirrorTriangleMesh = null;
    }
    
    // Remove existing extrusions if they exist
    if (typeof extrudedGroup !== 'undefined' && extrudedGroup) {
        scene.remove(extrudedGroup);
    }
    
    extrudedGroup = new THREE.Group();
    scene.add(extrudedGroup);
    
    // Create default material (uses default brickColor)
    const materials = [
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'right' }),
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'left' }),
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'top' }),
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'bottom' }),
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'front' }),
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'back' })
    ];
    
    // Create brick geometry (uses default brickDimensions)
    const geometry = new THREE.BoxGeometry(
        brickDimensions.width,
        brickDimensions.height,
        brickDimensions.depth
    );
    
    // Create mesh with geometry and materials
    brick = new THREE.Mesh(geometry, materials);
    brick.castShadow = true;
    brick.receiveShadow = true;
    
    // Position the brick so its bottom face sits exactly on the plane (y=0)
    brick.position.y = brickDimensions.height / 2;
    
    scene.add(brick);
    
    // Add the 90-degree triangles to the sides of the brick
    addTriangleToBrick(); // This function now adds both triangles
}

// Function to add 90-degree triangles to both sides of the brick
function addTriangleToBrick() {
    // Remove existing triangles first
    if (triangleMesh) scene.remove(triangleMesh);
    if (mirrorTriangleMesh) scene.remove(mirrorTriangleMesh);

    // Create the triangle shape dimensions using default brickDimensions
    const triangleHeight = brickDimensions.height;
    const triangleWidth = brickDimensions.height; // Base width equals height for 45-45-90 triangle face
    const triangleDepth = brickDimensions.depth; 
    
    // Create triangular prism geometry using BufferGeometry
    const triangleGeometry = new THREE.BufferGeometry();
    
    // Define the vertices of a 3D triangular prism
    const vertices = new Float32Array([
        // Front face (y-z plane at x=0)
         0, 0, 0,             // Bottom-left corner (Origin)
         0, triangleHeight, 0, // Top-left corner
         triangleWidth, 0, 0, // Bottom-right corner (on x-axis)
        
        // Back face (offset by triangleDepth in Z)
         0, 0, -triangleDepth,             // Bottom-left corner
         0, triangleHeight, -triangleDepth, // Top-left corner
         triangleWidth, 0, -triangleDepth  // Bottom-right corner
    ]);
    
    // Define indices for the triangular prism faces
    const indices = [
        // Front face triangle
        0, 1, 2,
        // Back face triangle
        3, 5, 4, // Note the order for correct facing direction
        // Bottom rectangle (0, 2, 5, 3) split into two triangles
        0, 2, 5,  0, 5, 3,
        // Back vertical rectangle (0, 3, 4, 1) split into two triangles
        0, 3, 4,  0, 4, 1,
        // Slanted rectangle (hypotenuse) (1, 4, 5, 2) split into two triangles
        1, 4, 5,  1, 5, 2
    ];
    
    triangleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    triangleGeometry.setIndex(indices);
    triangleGeometry.computeVertexNormals(); // Compute normals for lighting
    
    // Create material for the triangles (use brick color instead of triangle color)
    const triangleMaterial = new THREE.MeshStandardMaterial({
        color: brickColor,
        side: THREE.DoubleSide
    });
    
    // --- Create and position the first triangle (right side) ---
    triangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
    triangleMesh.castShadow = true;
    triangleMesh.receiveShadow = true;
    triangleMesh.position.set(
        -brickDimensions.width / 2,
        0, // Adjust y position to match brick's new position
        brickDimensions.depth / 2
    );
    triangleMesh.rotation.y = -Math.PI / 2;
    scene.add(triangleMesh);

    // --- Create and position the second (mirrored) triangle (left side) ---
    // Clone geometry and material (can share geometry, clone material if colors differ later)
    mirrorTriangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial.clone());
    mirrorTriangleMesh.castShadow = true;
    mirrorTriangleMesh.receiveShadow = true;
    mirrorTriangleMesh.position.set(
        brickDimensions.width / 2,
        0, // Adjust y position to match brick's new position
        -brickDimensions.depth / 2
    );
    mirrorTriangleMesh.rotation.y = Math.PI / 2;
    scene.add(mirrorTriangleMesh);
}

// Helper function to create and position extruded shapes with quality option
function createExtrudedShape(shape, scale, lowQuality = false) {
    // Higher quality settings for export
    const steps = isHighQualityMode ? exportSettings.extrudeSteps : (lowQuality ? 1 : 2);
    
    // Use different extrude settings based on quality mode
    const extrudeSettings = {
        steps: steps,
        depth: extrusionHeight,
        bevelEnabled: isHighQualityMode && exportSettings.enableBevel,
        bevelThickness: exportSettings.bevelThickness,
        bevelSize: exportSettings.bevelSize,
        bevelSegments: exportSettings.bevelSegments,
        curveSegments: isHighQualityMode ? 12 : 5 // Control curve resolution
    };
    
    // Use higher quality materials for export
    const material = new THREE.MeshStandardMaterial({
        color: extrusionColor,
        roughness: isHighQualityMode ? 0.3 : 0.5,
        metalness: isHighQualityMode ? 0.4 : 0.2,
        flatShading: lowQuality && !isHighQualityMode,
        shadowSide: isHighQualityMode || !lowQuality ? THREE.DoubleSide : THREE.FrontSide,
        side: THREE.DoubleSide // Ensure all sides are rendered
    });
    
    // Create extruded geometry with explicit triangulation
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Create mesh with the extruded geometry
    const mesh = new THREE.Mesh(geometry, material);
    
    // Apply transformations to match brick dimensions
    mesh.scale.set(scale * 0.25, -scale * 0.25, 1); // Scale factor
    
    // Rotate to lay flat on top of the brick
    mesh.rotation.x = Math.PI / 2;
    
    // Position exactly on top of the brick's top face with offset
    // Apply the position offset from UI controls
    mesh.position.set(
        extrusionPosition.x, 
        brickDimensions.height + extrusionPosition.y, 
        extrusionPosition.z
    );
    
    // Remove any duplicate geometries that might cause the extra layer
    mesh.updateMatrix();
    
    // Add to the extrusion group
    extrudedGroup.add(mesh);
}

// Update extrusion color based on UI input
function updateExtrusionColor() {
    extrudedGroup.children.forEach(child => {
        if (child.material) {
            child.material.color.set(extrusionColor);
        }
    });
}

// Update extrusion position based on UI inputs
function updateExtrusionPosition() {
    extrusionPosition.x = parseFloat(document.getElementById('extrusionX').value);
    extrusionPosition.z = parseFloat(document.getElementById('extrusionZ').value);
    
    // IMPORTANT: Always force Y position to 0.6
    extrusionPosition.y = 0.6;
    
    // Reposition all extrusions
    if (extrudedGroup && extrudedGroup.children.length > 0) {
        // If we have existing SVG data, regenerate the extrusions using default quality
        if (lastSvgData) {
            parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality);
        }
    }
}

// Optimized position update
function optimizedPositionUpdate() {
    extrusionPosition.x = parseFloat(document.getElementById('extrusionX').value);
    extrusionPosition.z = parseFloat(document.getElementById('extrusionZ').value);
    
    // IMPORTANT: Always force Y position to 0.6
    extrusionPosition.y = 0.6;
    
    renderer.shadowMap.enabled = false;
    
    if (isUserInteracting) {
        pendingUpdate = true;
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
            // Update position directly without re-extrusion for better performance
            extrudedGroup.children.forEach(child => {
                child.position.set(
                    extrusionPosition.x, 
                    brickDimensions.height + extrusionPosition.y, 
                    extrusionPosition.z
                );
            });
        });
    } else {
        scheduleProgressiveRendering();
    }
}
