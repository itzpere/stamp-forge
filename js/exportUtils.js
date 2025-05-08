// Function to prepare export group with proper geometry, including both triangles
// Modified to use CSG for union
function prepareExportGroup() {
    console.log("Starting export preparation with baked transformations...");
    
    // Create a new group for exported objects
    const exportGroup = new THREE.Group();
    
    // Add brick with baked transformations
    if (brick) {
        const brickGeo = brick.geometry.clone();
        brickGeo.applyMatrix4(brick.matrixWorld);
        const brickMesh = new THREE.Mesh(
            brickGeo,
            Array.isArray(brick.material) ? brick.material.map(m => m.clone()) : brick.material.clone()
        );
        // Reset transformations since they're now baked into the geometry
        brickMesh.position.set(0, 0, 0);
        brickMesh.rotation.set(0, 0, 0);
        brickMesh.scale.set(1, 1, 1);
        exportGroup.add(brickMesh);
        console.log("Added brick with baked transformations");
    }
    
    // Add first triangle with baked transformations
    if (triangleMesh) {
        const triangleGeo = triangleMesh.geometry.clone();
        triangleGeo.applyMatrix4(triangleMesh.matrixWorld);
        const triangleMeshClone = new THREE.Mesh(
            triangleGeo,
            triangleMesh.material.clone()
        );
        // Reset transformations
        triangleMeshClone.position.set(0, 0, 0);
        triangleMeshClone.rotation.set(0, 0, 0);
        triangleMeshClone.scale.set(1, 1, 1);
        exportGroup.add(triangleMeshClone);
        console.log("Added triangle 1 with baked transformations");
    }
    
    // Add second triangle with baked transformations
    if (mirrorTriangleMesh) {
        const mirrorGeo = mirrorTriangleMesh.geometry.clone();
        mirrorGeo.applyMatrix4(mirrorTriangleMesh.matrixWorld);
        const mirrorMeshClone = new THREE.Mesh(
            mirrorGeo,
            mirrorTriangleMesh.material.clone()
        );
        // Reset transformations
        mirrorMeshClone.position.set(0, 0, 0);
        mirrorMeshClone.rotation.set(0, 0, 0);
        mirrorMeshClone.scale.set(1, 1, 1);
        exportGroup.add(mirrorMeshClone);
        console.log("Added triangle 2 with baked transformations");
    }
    
    // Add slot bricks with baked transformations
    if (typeof slotGroup !== 'undefined' && slotGroup && slotGroup.children.length > 0) {
        console.log(`Processing ${slotGroup.children.length} slot bricks for export...`);
        
        // Ensure matrix world is updated for all slot bricks
        slotGroup.updateMatrixWorld(true);
        
        // Process each slot brick
        slotGroup.children.forEach((slotBrick, index) => {
            if (slotBrick.isMesh) {
                try {
                    // Clone the geometry
                    const slotGeo = slotBrick.geometry.clone();
                    
                    // Apply world matrix directly to the vertices
                    slotGeo.applyMatrix4(slotBrick.matrixWorld);
                    
                    // Create a new mesh with transformed geometry
                    const slotMaterial = slotBrick.material.clone();
                    const slotMeshClone = new THREE.Mesh(slotGeo, slotMaterial);
                    
                    // Reset transformations
                    slotMeshClone.position.set(0, 0, 0);
                    slotMeshClone.rotation.set(0, 0, 0);
                    slotMeshClone.scale.set(1, 1, 1);
                    
                    // Add to export group
                    exportGroup.add(slotMeshClone);
                    console.log(`Added slot brick ${index+1} with baked transformations`);
                } catch (err) {
                    console.error(`Error processing slot brick ${index+1}:`, err);
                }
            }
        });
    } else {
        console.warn("No slot bricks found to export. Attempting to re-create slot bricks...");
        // Try to recreate slot bricks if they're missing
        if (typeof addSlotBricks === 'function') {
            addSlotBricks();
            if (slotGroup && slotGroup.children.length > 0) {
                console.log("Successfully recreated slot bricks, now adding to export...");
                
                slotGroup.updateMatrixWorld(true);
                
                slotGroup.children.forEach((slotBrick, index) => {
                    if (slotBrick.isMesh) {
                        try {
                            const slotGeo = slotBrick.geometry.clone();
                            slotGeo.applyMatrix4(slotBrick.matrixWorld);
                            const slotMeshClone = new THREE.Mesh(
                                slotGeo,
                                slotBrick.material.clone()
                            );
                            slotMeshClone.position.set(0, 0, 0);
                            slotMeshClone.rotation.set(0, 0, 0);
                            slotMeshClone.scale.set(1, 1, 1);
                            exportGroup.add(slotMeshClone);
                            console.log(`Added recreated slot brick ${index+1}`);
                        } catch (err) {
                            console.error(`Error processing recreated slot brick ${index+1}:`, err);
                        }
                    }
                });
            }
        }
    }
    
    // Add extrusions - THIS IS THE CRITICAL PART
    if (extrudedGroup && extrudedGroup.children.length > 0) {
        console.log(`Processing ${extrudedGroup.children.length} extrusions for export...`);
        
        // First ensure matrix world is updated for all extrusions
        extrudedGroup.updateMatrixWorld(true);
        
        // Process each extrusion
        extrudedGroup.children.forEach((child, index) => {
            if (child.isMesh) {
                console.log(`Processing extrusion ${index+1}...`);
                console.log(`  Original position: [${child.position.x}, ${child.position.y}, ${child.position.z}]`);
                console.log(`  Original rotation: [${child.rotation.x}, ${child.rotation.y}, ${child.rotation.z}]`);
                console.log(`  Original scale: [${child.scale.x}, ${child.scale.y}, ${child.scale.z}]`);
                
                try {
                    // Clone the geometry
                    const clonedGeo = child.geometry.clone();
                    
                    // Apply world matrix directly to the vertices
                    clonedGeo.applyMatrix4(child.matrixWorld);
                    
                    // Create a new mesh with transformed geometry
                    const newMaterial = child.material.clone();
                    const newMesh = new THREE.Mesh(clonedGeo, newMaterial);
                    
                    // Reset position, rotation, and scale since it's baked into the geometry now
                    newMesh.position.set(0, 0, 0);
                    newMesh.rotation.set(0, 0, 0);
                    newMesh.scale.set(1, 1, 1);
                    
                    // Add to export group
                    exportGroup.add(newMesh);
                    console.log(`  Added extrusion ${index+1} with baked transformations`);
                } catch (err) {
                    console.error(`  Error processing extrusion ${index+1}:`, err);
                }
            }
        });
    } else {
        console.warn("No extrusions found to export!");
    }
    
    // IMPORTANT: Apply 90-degree rotation around X-axis for export
    if (exportGroup.children.length > 0) {
        // Apply rotation to each child for better geometry handling
        exportGroup.children.forEach(child => {
            const rotationMatrix = new THREE.Matrix4().makeRotationX(Math.PI/2);
            child.geometry.applyMatrix4(rotationMatrix);
            // Reset transformations since they're now baked into the geometry
            child.position.set(0, 0, 0);
            child.rotation.set(0, 0, 0);
            child.scale.set(1, 1, 1);
        });
        console.log("Applied 90-degree X-axis rotation to export group");
    }
    
    console.log(`Export group prepared with ${exportGroup.children.length} objects`);
    return exportGroup;
}

// Export brick as STL file
function exportSTL() {
    try {
        // Show loading message with progress bar structure
        const loadingElement = document.getElementById('loading');
        loadingElement.classList.remove('hidden');
        // Initialize progress bar HTML
        loadingElement.innerHTML = `
            <div class="progress-container" style="width: 80%; background-color: #ddd; margin: 10px auto; border-radius: 5px;">
                <div class="progress-bar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; text-align: center; line-height: 20px; color: white;"></div>
            </div>
            <span class="progress-text" style="display: block; text-align: center;">Preparing model for export: 0%</span>
        `;
        
        const progressBar = loadingElement.querySelector('.progress-bar');
        const progressText = loadingElement.querySelector('.progress-text');
        
        // Setup progress callback
        exportSettings.progressCallback = (progress) => {
            if (progressBar && progressText) {
                const clampedProgress = Math.min(100, Math.max(0, progress)); // Ensure progress is between 0 and 100
                progressBar.style.width = clampedProgress + '%';
                progressText.textContent = `Preparing model for export: ${clampedProgress}%`;
            }
        };
        
        // Set high quality flag
        isHighQualityMode = true;
        
        // Store original shadow setting at function scope level
        let originalShadowSetting = renderer.shadowMap.enabled;
        
        // Use a worker or timer to avoid blocking the UI
        setTimeout(() => {
            // Force a full-quality render if SVG exists
            if (lastSvgData) {
                try {
                    // Show clearer progress indicators
                    if (progressText) progressText.textContent = 'Regenerating high-quality SVG extrusions...';
                    
                    // Store original shadow setting
                    renderer.shadowMap.enabled = true;
                    
                    // Force regeneration of extrusions for accurate export
                    console.log("Clearing existing extrusions before export...");
                    while(extrudedGroup && extrudedGroup.children.length > 0) {
                        const child = extrudedGroup.children[0];
                        extrudedGroup.remove(child);
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    }
                    
                    // Get the current extrusion position values from UI
                    const xInput = document.getElementById('extrusionX');
                    const yInput = document.getElementById('extrusionY');
                    const zInput = document.getElementById('extrusionZ');
                    
                    if (xInput && yInput && zInput) {
                        extrusionPosition.x = parseFloat(xInput.value);
                        extrusionPosition.y = parseFloat(yInput.value);
                        extrusionPosition.z = parseFloat(zInput.value);
                        
                        console.log(`Using position values from UI: [${extrusionPosition.x}, ${extrusionPosition.y}, ${extrusionPosition.z}]`);
                    }
                    
                    // Parse SVG with export quality settings
                    console.log("Parsing SVG with export quality settings...");
                    parseSVGForExtrusion(lastSvgData, false, 1.0, true); // isExporting = true
                    
                    // Verify that extrusions have been created
                    console.log(`Created ${extrudedGroup.children.length} extrusions for export`);
                    if (extrudedGroup.children.length > 0) {
                        extrudedGroup.children.forEach((child, idx) => {
                            if (child.isMesh) {
                                console.log(`Extrusion ${idx+1}: position=[${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)}]`);
                            }
                        });
                        
                        // Update matrices for all extrusions
                        extrudedGroup.updateMatrixWorld(true);
                    }
                    
                    // Wait for extrusions to be fully processed and added to the scene
                    if (progressText) progressText.textContent = 'Creating export model...';
                    exportSettings.progressCallback(50);
                    
                    // Use setTimeout to allow UI update
                    setTimeout(() => {
                        try {
                            // Create the export group with all objects
                            const exportObject = prepareExportGroup();
                            console.log("Export object prepared. Generating STL...");
                            
                            if (!exportObject) {
                                throw new Error("Failed to prepare export object.");
                            }
                            
                            // Update progress
                            exportSettings.progressCallback(80);
                            if (progressText) progressText.textContent = 'Generating STL file...';
                            
                            // Create the STL
                            const exporter = new THREE.STLExporter();
                            const result = exporter.parse(exportObject, { binary: true });
                            console.log("STL generated. Creating download link...");
                            
                            // Create sanitized filename
                            const sanitizedName = currentSvgFilename.replace(/[^\w\-\.]/g, '_');
                            const filename = `stampForge_${sanitizedName}.stl`;
                            
                            // Create download link
                            const blob = new Blob([result], { type: 'application/octet-stream' });
                            const link = document.createElement('a');
                            link.style.display = 'none';
                            document.body.appendChild(link);
                            link.href = URL.createObjectURL(blob);
                            link.download = filename; // Use dynamic filename
                            link.click();
                            
                            // Clean up
                            setTimeout(() => {
                                URL.revokeObjectURL(link.href);
                                if (link.parentNode) link.parentNode.removeChild(link);
                                
                                // Cleanup resources
                                exportObject.traverse((child) => {
                                    if (child.geometry) child.geometry.dispose();
                                    if (child.material) {
                                        if (Array.isArray(child.material)) {
                                            child.material.forEach(m => m.dispose());
                                        } else {
                                            child.material.dispose();
                                        }
                                    }
                                });
                                
                                // Reset state
                                isHighQualityMode = false;
                                if (!isUserInteracting && lastSvgData) {
                                    console.log("Returning to interactive quality rendering...");
                                    setTimeout(() => parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality), 200);
                                }
                                renderer.shadowMap.enabled = originalShadowSetting;
                                
                                // Hide loading
                                loadingElement.innerHTML = 'Loading...';
                                loadingElement.classList.add('hidden');
                                
                                // Final progress update
                                exportSettings.progressCallback(100);
                            }, 100);
                        } catch (exportError) {
                            console.error('Error during CSG/STL generation or download:', exportError);
                            alert(`Error generating combined STL file: ${exportError.message}. Please check console for details.`);
                            isHighQualityMode = false;
                            renderer.shadowMap.enabled = originalShadowSetting; // Ensure shadow settings are restored
                            loadingElement.innerHTML = 'Loading...';
                            loadingElement.classList.add('hidden');
                            THREE.Cache.clear();
                        }
                    }, 100);
                } catch (renderError) {
                    console.error('Error during high-quality rendering for export:', renderError);
                    alert(`Error preparing model for export: ${renderError.message}. Please check console for details.`);
                    isHighQualityMode = false;
                    renderer.shadowMap.enabled = originalShadowSetting; // Ensure shadow settings are restored
                    loadingElement.innerHTML = 'Loading...';
                    loadingElement.classList.add('hidden');
                    THREE.Cache.clear();
                }
            } else {
                // No SVG data, just export the brick and triangles (CSG still preferred)
                if (progressText) progressText.textContent = 'Performing CSG Union (Brick/Triangles)...';
                try {
                    console.log("Preparing export group for brick/triangles only (CSG)...");
                    const exportObject = prepareExportGroup(); // Will attempt CSG on brick+triangles

                    if (!exportObject) {
                        throw new Error("Failed to prepare brick/triangle model for export.");
                    }

                    if (progressText) progressText.textContent = 'Generating STL file...';
                    console.log("Generating STL for combined brick/triangles...");
                    const exporter = new THREE.STLExporter();
                    const result = exporter.parse(exportObject, { binary: true });
                    console.log("STL generated. Creating download link...");

                    // Create and trigger download
                    const blob = new Blob([result], { type: 'application/octet-stream' });
                    const link = document.createElement('a');
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.href = URL.createObjectURL(blob);
                    link.download = 'stampForge_base.stl'; // Changed filename
                    link.click();
                    console.log("Download triggered.");

                    // Clean up
                    setTimeout(() => {
                        URL.revokeObjectURL(link.href);
                        if (link.parentNode) link.parentNode.removeChild(link);
                        console.log("Blob URL revoked and link removed.");
                        // Dispose resources
                        exportObject.traverse((child) => {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(m => m.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        });
                        if (exportObject.isMesh && exportObject.geometry) exportObject.geometry.dispose();
                        if (exportObject.isMesh && exportObject.material) exportObject.material.dispose();
                    }, 100);

                    isHighQualityMode = false;
                    loadingElement.innerHTML = 'Loading...';
                    loadingElement.classList.add('hidden');
                } catch(brickExportError) {
                    console.error('Error exporting combined brick only:', brickExportError);
                    alert(`Error exporting combined brick: ${brickExportError.message}.`);
                    isHighQualityMode = false;
                    loadingElement.innerHTML = 'Loading...';
                    loadingElement.classList.add('hidden');
                }
            }
        }, 100); // Timeout before high-quality render/CSG
    } catch (error) {
        console.error('Error setting up STL export:', error);
        alert(`Error setting up export: ${error.message}.`);
        document.getElementById('loading').innerHTML = 'Loading...';
        document.getElementById('loading').classList.add('hidden');
        isHighQualityMode = false;
        renderer.shadowMap.enabled = renderer.shadowMap.enabled; // Default back to current setting
        THREE.Cache.clear();
    }
}
