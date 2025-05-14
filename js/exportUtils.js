function prepareExportGroup() {
    console.log("Starting export preparation with direct geometry export...");
    
    const exportGroup = new THREE.Group();
    
    if (stampBase) {
        const baseGeo = stampBase.geometry.clone();
        baseGeo.applyMatrix4(stampBase.matrixWorld); 
        
        const baseMaterial = new THREE.MeshStandardMaterial({ 
            color: brickColor || 0xbc8f8f,
            roughness: 0.5,
            metalness: 0.2
        });
        
        const baseMesh = new THREE.Mesh(baseGeo, baseMaterial);
        exportGroup.add(baseMesh);
        console.log("Added base mesh to export group");
    }

    if (extrudedGroup && extrudedGroup.children.length > 0) {
        extrudedGroup.updateMatrixWorld(true); 
        
        extrudedGroup.children.forEach((childMesh) => {
            if (childMesh.isMesh && childMesh.visible) {
                const childGeo = childMesh.geometry.clone();
                childGeo.applyMatrix4(childMesh.matrixWorld);
                
                const material = new THREE.MeshStandardMaterial({
                    color: childMesh.material ? childMesh.material.color.clone() : 0xcccccc,
                    roughness: 0.5,
                    metalness: 0.2
                });
                
                const newMesh = new THREE.Mesh(childGeo, material);
                exportGroup.add(newMesh);
            }
        });
        
        console.log(`Added ${exportGroup.children.length - (stampBase ? 1 : 0)} extrusion shapes to export group`);
    }

    // Check if triangleMesh and triangleColor are defined before trying to use them
    if (typeof triangleMesh !== 'undefined' && triangleMesh && triangleMesh.visible) {
        const defaultColor = 0xbc8f8f;
        const meshColor = (typeof triangleColor !== 'undefined') ? triangleColor : defaultColor;
        
        const triangleGeo = triangleMesh.geometry.clone();
        triangleGeo.applyMatrix4(triangleMesh.matrixWorld);
        
        const triangleMaterial = new THREE.MeshStandardMaterial({
            color: meshColor,
            roughness: 0.5,
            metalness: 0.2
        });
        
        const triangleMeshForExport = new THREE.Mesh(triangleGeo, triangleMaterial);
        exportGroup.add(triangleMeshForExport);
        console.log("Added triangle mesh to export group");
    }
    
    // Similarly check for mirrorTriangleMesh
    if (typeof mirrorTriangleMesh !== 'undefined' && mirrorTriangleMesh && mirrorTriangleMesh.visible) {
        const defaultColor = 0xbc8f8f;
        const meshColor = (typeof triangleColor !== 'undefined') ? triangleColor : defaultColor;
        
        const mirrorGeo = mirrorTriangleMesh.geometry.clone();
        mirrorGeo.applyMatrix4(mirrorTriangleMesh.matrixWorld);
        
        const mirrorMaterial = new THREE.MeshStandardMaterial({
            color: meshColor,
            roughness: 0.5,
            metalness: 0.2
        });
        
        const mirrorMeshForExport = new THREE.Mesh(mirrorGeo, mirrorMaterial);
        exportGroup.add(mirrorMeshForExport);
        console.log("Added mirror triangle mesh to export group");
    }
    
    if (typeof slotGroup !== 'undefined' && slotGroup && slotGroup.children.length > 0) {
        slotGroup.updateMatrixWorld(true);
        slotGroup.children.forEach((slotBrick) => {
            if (slotBrick.isMesh && slotBrick.visible) {
                const slotGeo = slotBrick.geometry.clone();
                slotGeo.applyMatrix4(slotBrick.matrixWorld);
                
                const slotMaterial = new THREE.MeshStandardMaterial({
                    color: brickColor || 0xbc8f8f,
                    roughness: 0.5,
                    metalness: 0.2
                });
                
                const slotMeshForExport = new THREE.Mesh(slotGeo, slotMaterial);
                exportGroup.add(slotMeshForExport);
            }
        });
    }
    
    // Create a rotation matrix for 90 degrees around X axis
    const rotationMatrix = new THREE.Matrix4().makeRotationX(Math.PI/2);
    
    exportGroup.children.forEach(child => {
        if (child.isMesh && child.geometry) {
            // Apply rotation directly to the geometry
            child.geometry.applyMatrix4(rotationMatrix);
        }
    });
    
    console.log(`Export group prepared with ${exportGroup.children.length} meshes (rotated 90° for printing)`);
    return exportGroup;
}

function exportSTL() {
    try {
        const loadingElement = document.getElementById('loading');
        loadingElement.classList.remove('hidden');
        loadingElement.textContent = 'Preparing model for export...';
        
        // Store original position values to restore later
        const originalPosition = {
            x: extrusionPosition.x,
            y: extrusionPosition.y,
            z: extrusionPosition.z
        };
        
        isHighQualityMode = true;
        
        setTimeout(() => {
            if (typeof lastSvgData !== 'undefined' && lastSvgData) {
                try {
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
                    
                    // Always use the original position values, not the UI values which might have changed
                    extrusionPosition.x = originalPosition.x;
                    extrusionPosition.y = originalPosition.y;
                    extrusionPosition.z = originalPosition.z;
                    
                    parseSVGForExtrusion(lastSvgData, false, 1.0, true);
                    
                    setTimeout(() => {
                        try {
                            loadingElement.textContent = 'Generating STL file...';
                            
                            const exportGroup = prepareExportGroup();
                            
                            if (!exportGroup || exportGroup.children.length === 0) {
                                throw new Error("Failed to prepare export object, or export object is empty.");
                            }
                            
                            const exporter = new THREE.STLExporter();
                            const result = exporter.parse(exportGroup, { binary: true });
                            
                            const sanitizedName = typeof currentSvgFilename !== 'undefined' ? 
                                currentSvgFilename.replace(/[^\w\-\.]/g, '_') : 'stampforge';
                            const filename = `stampForge_${sanitizedName}.stl`;
                            
                            const blob = new Blob([result], { type: 'application/octet-stream' });
                            const link = document.createElement('a');
                            link.style.display = 'none';
                            document.body.appendChild(link);
                            link.href = URL.createObjectURL(blob);
                            link.download = filename;
                            link.click();
                            
                            setTimeout(() => {
                                URL.revokeObjectURL(link.href);
                                if (link.parentNode) link.parentNode.removeChild(link);
                                
                                isHighQualityMode = false;
                                if (typeof lastSvgData !== 'undefined' && lastSvgData) {
                                    // Restore original position before re-rendering
                                    extrusionPosition.x = originalPosition.x;
                                    extrusionPosition.y = originalPosition.y;
                                    extrusionPosition.z = originalPosition.z;
                                    
                                    setTimeout(() => parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality), 200);
                                }
                                
                                loadingElement.textContent = 'Loading...';
                                loadingElement.classList.add('hidden');
                            }, 100);
                        } catch (exportError) {
                            console.error('Error during STL generation:', exportError);
                            alert(`Error generating STL file: ${exportError.message}`);
                            isHighQualityMode = false;
                            loadingElement.textContent = 'Loading...';
                            loadingElement.classList.add('hidden');
                        }
                    }, 100);
                } catch (renderError) {
                    console.error('Error during high-quality rendering for export:', renderError);
                    alert(`Error preparing model for export: ${renderError.message}`);
                    isHighQualityMode = false;
                    loadingElement.textContent = 'Loading...';
                    loadingElement.classList.add('hidden');
                    // Reset back to original position
                    extrusionPosition.x = originalPosition.x;
                    extrusionPosition.y = originalPosition.y;
                    extrusionPosition.z = originalPosition.z;
                }
            } else {
                try {
                    loadingElement.textContent = 'Generating STL file...';
                    const exportGroup = prepareExportGroup();

                    if (!exportGroup || exportGroup.children.length === 0) {
                        throw new Error("Failed to prepare model for export or result is empty.");
                    }

                    const exporter = new THREE.STLExporter();
                    const result = exporter.parse(exportGroup, { binary: true });

                    const blob = new Blob([result], { type: 'application/octet-stream' });
                    const link = document.createElement('a');
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.href = URL.createObjectURL(blob);
                    link.download = 'stampForge_base.stl';
                    link.click();

                    setTimeout(() => {
                        URL.revokeObjectURL(link.href);
                        if (link.parentNode) link.parentNode.removeChild(link);
                        isHighQualityMode = false;
                        loadingElement.textContent = 'Loading...';
                        loadingElement.classList.add('hidden');
                    }, 100);
                } catch(error) {
                    console.error('Error exporting base:', error);
                    alert(`Error exporting base: ${error.message}`);
                    isHighQualityMode = false;
                    loadingElement.textContent = 'Loading...';
                    loadingElement.classList.add('hidden');
                }
            }
        }, 100);
    } catch (error) {
        console.error('Error setting up STL export:', error);
        alert(`Error setting up export: ${error.message}`);
        document.getElementById('loading').textContent = 'Loading...';
        document.getElementById('loading').classList.add('hidden');
        isHighQualityMode = false;
    }
}
