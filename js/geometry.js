// Create the 3D brick (uses default dimensions and colors)
function createBrick() {
    // Remove existing brick if it exists
    if (typeof brick !== 'undefined' && brick) {
        scene.remove(brick);
        // Also remove associated triangles
        if (triangleMesh) scene.remove(triangleMesh);
        if (mirrorTriangleMesh) scene.remove(mirrorTriangleMesh);
        if (slotMesh) scene.remove(slotMesh);
        triangleMesh = null;
        mirrorTriangleMesh = null;
        slotMesh = null;
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
    
    // Adjust brick height and position
    const reducedHeight = brickDimensions.height - 0.6; // Reduce height by slot height
    const geometry = new THREE.BoxGeometry(
        brickDimensions.width,
        reducedHeight,
        brickDimensions.depth
    );
    
    // Create mesh with geometry and materials
    brick = new THREE.Mesh(geometry, materials);
    brick.castShadow = true;
    brick.receiveShadow = true;
    
    // Position the brick so its bottom face sits exactly above the slot bricks
    brick.position.y = reducedHeight / 2 + 0.6; // Move up by slot height
    
    scene.add(brick);
    
    // Add the 90-degree triangles to the sides of the brick
    addTriangleToBrick();
    
    // Add the slot bricks at the bottom
    addSlotBricks();
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

// Function to add slot bricks at the bottom of the brick
function addSlotBricks() {
    const slotBrickHeight = 0.7; // Slot height
    const slotBrickWidth = 10; // Slot width
    const slotBrickDepth = 9; // Slot depth

    const smallBrickMaterial = new THREE.MeshStandardMaterial({
        color: brickColor,
        side: THREE.DoubleSide
    });

    // Create a new group for slot bricks
    if (typeof slotGroup === 'undefined' || !slotGroup) {
        slotGroup = new THREE.Group();
        slotGroup.name = "slotGroup"; // Add a name for easier debugging
        scene.add(slotGroup);
    }

    // Clear existing slot bricks from the group
    while (slotGroup.children.length > 0) {
        slotGroup.remove(slotGroup.children[0]);
    }

    // Create left and right slot bricks
    const leftRightBrickWidth = (brickDimensions.width - slotBrickWidth) / 2;
    const leftRightBrickGeometry = new THREE.BoxGeometry(leftRightBrickWidth, slotBrickHeight, brickDimensions.depth);

    const leftBrick = new THREE.Mesh(leftRightBrickGeometry, smallBrickMaterial);
    leftBrick.position.set(
        -(slotBrickWidth / 2 + leftRightBrickWidth / 2), 
        -(brickDimensions.height / 2 - slotBrickHeight / 2) + 1.5, // Move up by 1 mm
        0
    );
    slotGroup.add(leftBrick);

    const rightBrick = new THREE.Mesh(leftRightBrickGeometry, smallBrickMaterial);
    rightBrick.position.set(
        slotBrickWidth / 2 + leftRightBrickWidth / 2, 
        -(brickDimensions.height / 2 - slotBrickHeight / 2) + 1.5, // Move up by 1 mm
        0
    );
    slotGroup.add(rightBrick);

    // Create front and back slot bricks
    const frontBackBrickDepth = (brickDimensions.depth - slotBrickDepth) / 2;
    const frontBackBrickGeometry = new THREE.BoxGeometry(slotBrickWidth, slotBrickHeight, frontBackBrickDepth);

    const frontBrick = new THREE.Mesh(frontBackBrickGeometry, smallBrickMaterial);
    frontBrick.position.set(
        0, 
        -(brickDimensions.height / 2 - slotBrickHeight / 2) + 1.5, // Move up by 1 mm
        -(slotBrickDepth / 2 + frontBackBrickDepth / 2)
    );
    slotGroup.add(frontBrick);

    const backBrick = new THREE.Mesh(frontBackBrickGeometry, smallBrickMaterial);
    backBrick.position.set(
        0, 
        -(brickDimensions.height / 2 - slotBrickHeight / 2) + 1.5, // Move up by 1 mm
        slotBrickDepth / 2 + frontBackBrickDepth / 2
    );
    slotGroup.add(backBrick);

    console.log("Slot bricks added visually and included in the slot group.");
}

// Create a custom geometry for a brick with a slot cut out of the bottom
function createBrickWithSlotGeometry(width, height, depth, slotWidth, slotHeight, slotDepth) {
    // Skip trying to use ThreeCSG since it's undefined in the global scope
    // Directly create a custom brick geometry with the slot manually defined
    return createCustomBrickWithSlotGeometry(width, height, depth, slotWidth, slotHeight, slotDepth);
}

// Helper function to create a custom brick geometry with a slot manually defined
function createCustomBrickWithSlotGeometry(width, height, depth, slotWidth, slotHeight, slotDepth) {
    // Create a BufferGeometry
    const geometry = new THREE.BufferGeometry();
    
    // Half dimensions for convenience
    const hw = width / 2, hh = height / 2, hd = depth / 2;
    const shw = slotWidth / 2, shh = slotHeight / 2, shd = slotDepth / 2;
    
    // Ensure the slot doesn't exceed the brick dimensions
    const actualShw = Math.min(shw, hw);
    const actualShd = Math.min(shd, hd);
    
    // Calculate the corners of the brick and the slot
    const vertices = [
        // Brick vertices - bottom layer
        -hw, -hh, -hd,  // 0: bottom-left-back
        hw, -hh, -hd,   // 1: bottom-right-back
        hw, -hh, hd,    // 2: bottom-right-front
        -hw, -hh, hd,   // 3: bottom-left-front
        
        // Brick vertices - top layer
        -hw, hh, -hd,   // 4: top-left-back
        hw, hh, -hd,    // 5: top-right-back
        hw, hh, hd,     // 6: top-right-front
        -hw, hh, hd,    // 7: top-left-front
        
        // Slot vertices - top layer (y = -hh + slotHeight)
        -actualShw, -hh + slotHeight, -actualShd, // 8: slot-top-left-back
        actualShw, -hh + slotHeight, -actualShd,  // 9: slot-top-right-back
        actualShw, -hh + slotHeight, actualShd,   // 10: slot-top-right-front
        -actualShw, -hh + slotHeight, actualShd,  // 11: slot-top-left-front
        
        // Slot vertices - bottom layer (y = -hh)
        -actualShw, -hh, -actualShd, // 12: slot-bottom-left-back
        actualShw, -hh, -actualShd,  // 13: slot-bottom-right-back
        actualShw, -hh, actualShd,   // 14: slot-bottom-right-front
        -actualShw, -hh, actualShd   // 15: slot-bottom-left-front
    ];
    
    // Define faces (triangles)
    const indices = [
        // Top face
        4, 5, 6, 4, 6, 7,
        
        // Side faces
        0, 4, 7, 0, 7, 3, // Left
        1, 2, 6, 1, 6, 5, // Right
        0, 1, 5, 0, 5, 4, // Back
        3, 7, 6, 3, 6, 2, // Front
        
        // Bottom face with cutout
        // Left of slot
        0, 3, 15, 0, 15, 12,
        // Right of slot
        1, 13, 14, 1, 14, 2,
        // Front of slot
        3, 2, 14, 3, 14, 15,
        // Back of slot
        0, 12, 13, 0, 13, 1,
        
        // Slot inner faces
        // Slot top face
        8, 10, 9, 8, 11, 10,
        // Slot left face
        8, 12, 15, 8, 15, 11,
        // Slot right face
        9, 10, 14, 9, 14, 13,
        // Slot front face
        11, 15, 14, 11, 14, 10,
        // Slot back face
        8, 9, 13, 8, 13, 12
    ];
    
    // Set attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
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

    // Ensure slot bricks remain static (no updates here)
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

            // Ensure slot bricks remain static (no updates here)
        });
    } else {
        scheduleProgressiveRendering();
    }
}

// Ensure slotGroup is initialized globally and is accessible
let slotGroup; // Moved to ensure it's properly declared

// Export STL function
function exportSTL() {
    const exporter = new THREE.STLExporter();
    const combinedGroup = new THREE.Group();

    // Count objects for logging
    let objectCount = 0;
    
    // Add the brick with error checking
    if (brick) {
        combinedGroup.add(brick.clone());
        objectCount++;
        console.log("Added brick to export");
    }
    
    // Add triangles with error checking
    if (triangleMesh) {
        combinedGroup.add(triangleMesh.clone());
        objectCount++;
        console.log("Added triangle mesh to export");
    }
    
    if (mirrorTriangleMesh) {
        combinedGroup.add(mirrorTriangleMesh.clone());
        objectCount++;
        console.log("Added mirror triangle mesh to export");
    }
    
    // Add extruded group with error checking
    if (extrudedGroup && extrudedGroup.children.length > 0) {
        combinedGroup.add(extrudedGroup.clone());
        objectCount += extrudedGroup.children.length;
        console.log(`Added extruded group with ${extrudedGroup.children.length} children to export`);
    }
    
    // Add slot group with better error checking
    if (slotGroup && slotGroup.children.length > 0) {
        // Clone the slot group to avoid modifying the original
        const slotGroupClone = slotGroup.clone();
        combinedGroup.add(slotGroupClone);
        objectCount += slotGroup.children.length;
        console.log(`Added slot group with ${slotGroup.children.length} children to export`);
    } else {
        console.warn("Slot group is missing or empty - recreating slots for export");
        // Recreate slot bricks if missing
        addSlotBricks();
        if (slotGroup && slotGroup.children.length > 0) {
            combinedGroup.add(slotGroup.clone());
            objectCount += slotGroup.children.length;
            console.log(`Added newly created slot group with ${slotGroup.children.length} children to export`);
        }
    }

    console.log(`Exporting ${objectCount} total objects (in ${combinedGroup.children.length} groups) to STL`);

    const stlString = exporter.parse(combinedGroup);
    downloadSTL(stlString, 'brick.stl');
}
