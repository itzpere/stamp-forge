// Set up UI controls and their event listeners with performance optimizations
function setupUIControls() {
    try {
        // Extrusion height control
        const extrusionHeightEl = document.getElementById('extrusionHeight');
        if (extrusionHeightEl) {
            extrusionHeightEl.value = extrusionHeight;
            extrusionHeightEl.addEventListener('change', function() {
                extrusionHeight = parseFloat(this.value);
                if (texture) {
                    // Use default quality for non-interactive changes
                    parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality);
                }
            });
        }
        
        // SVG scale factor control
        const svgScaleEl = document.getElementById('svgScale');
        if (svgScaleEl) {
            svgScaleEl.value = svgScaleFactor;
            svgScaleEl.addEventListener('change', function() {
                svgScaleFactor = parseFloat(this.value);
                if (texture) {
                    // Use default quality for non-interactive changes
                    parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality);
                }
            });
        }
        
        // REMOVED: Color controls for extrusion - no longer in HTML
        
        // Extrusion position controls
        const extrusionXEl = document.getElementById('extrusionX');
        const extrusionYEl = document.getElementById('extrusionY');
        const extrusionZEl = document.getElementById('extrusionZ');
        
        if (extrusionXEl) extrusionXEl.value = extrusionPosition.x;
        if (extrusionYEl) extrusionYEl.value = extrusionPosition.y;
        if (extrusionZEl) extrusionZEl.value = extrusionPosition.z;
        
        if (extrusionXEl) extrusionXEl.addEventListener('change', updateExtrusionPosition);
        if (extrusionYEl) extrusionYEl.addEventListener('change', updateExtrusionPosition);
        if (extrusionZEl) extrusionZEl.addEventListener('change', updateExtrusionPosition);
        
        // Add performance optimization - track interaction state for number inputs
        const controlElements = document.querySelectorAll('input[type="number"]');
        controlElements.forEach(element => {
            element.addEventListener('focus', () => {
                isUserInteracting = true;
                cancelProgressiveRendering(); // Cancel any ongoing progressive rendering
            });
            
            element.addEventListener('blur', () => {
                isUserInteracting = false;
                if (pendingUpdate) {
                    pendingUpdate = false;
                    // Instead of immediately running full quality, schedule progressive rendering
                    scheduleProgressiveRendering();
                }
            });
        });
        
        // Replace 'change' with 'input' + debounce for immediate feedback
        if (extrusionHeightEl) {
            // CRITICAL FIX 1: Add direct 'change' handler that forces rebuild
            extrusionHeightEl.addEventListener('change', function() {
                const newHeight = parseFloat(this.value);
                console.log(`Height changed to ${newHeight} via change event`);
                
                // Update the global height value
                extrusionHeight = newHeight;
                
                // Always force a complete rebuild on direct change events
                if (lastSvgData) {
                    console.log("Forcing complete rebuild due to height change");
                    parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality);
                }
            });
            
            // CRITICAL FIX 2: Handle height change in input event with full rebuild
            extrusionHeightEl.addEventListener('input', function() {
                const newHeight = parseFloat(this.value);
                console.log(`Height changed to ${newHeight} via input event`);
                
                // Update global variable immediately
                extrusionHeight = newHeight;
                
                // Force clear of existing extrusions
                if (extrudedGroup) {
                    while(extrudedGroup.children.length > 0) {
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
                }
                
                // Force rebuild immediately with new height
                renderer.shadowMap.enabled = false;
                if (lastSvgData) {
                    parseSVGForExtrusion(lastSvgData, true, 0.5);
                }
            });
        }

        // Add debouncing for SVG Scale
        if (svgScaleEl) {
            svgScaleEl.addEventListener('input', function() {
                svgScaleFactor = parseFloat(this.value);
                renderer.shadowMap.enabled = false;
                if (isUserInteracting) {
                    pendingUpdate = true;
                    debounce(() => {
                        if (lastSvgData) parseSVGForExtrusion(lastSvgData, true); // Low quality during interaction
                    });
                } else if (lastSvgData) {
                    // If not interacting, trigger progressive rendering after debounce
                    debounce(() => scheduleProgressiveRendering());
                }
            });
        }
        
        // Add debouncing to position controls
        if (extrusionXEl) extrusionXEl.addEventListener('input', optimizedPositionUpdate);
        if (extrusionYEl) extrusionYEl.addEventListener('input', optimizedPositionUpdate);
        if (extrusionZEl) extrusionZEl.addEventListener('input', optimizedPositionUpdate);
        
        // Reset view button
        const resetViewBtn = document.getElementById('resetView');
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', function() {
                // Call the new fit-to-view function
                fitCameraToObject();
            });
        }
        
        // Top view button
        const topViewBtn = document.getElementById('topView');
        if (topViewBtn) {
            topViewBtn.addEventListener('click', function() {
                // Top view
                camera.position.set(0, 50, 0);
                camera.lookAt(0, 0, 0);
                controls.update();
            });
        }
        
        // Configuration modal
        const modal = document.getElementById('configModal');
        const configBtn = document.getElementById('configBtn');
        const closeBtn = document.querySelector('.close');
        const applyBtn = document.getElementById('applyConfigBtn');
        const resetBtn = document.getElementById('resetConfigBtn');
        
        // Quality slider value display
        const qualitySlider = document.getElementById('maxQuality');
        const qualityValue = document.getElementById('qualityValue');
        
        // Resolution slider value display
        const resolutionSlider = document.getElementById('svgResolution');
        const resolutionValue = document.getElementById('resolutionValue');
        
        // Open modal
        if (configBtn) {
            configBtn.addEventListener('click', () => {
                loadCurrentConfig();
                modal.style.display = 'block';
            });
        }
        
        // Close modal via X button
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Update quality slider value display
        if (qualitySlider && qualityValue) {
            qualitySlider.addEventListener('input', () => {
                qualityValue.textContent = qualitySlider.value;
            });
        }
        
        // Update resolution slider value display
        if (resolutionSlider && resolutionValue) {
            resolutionSlider.addEventListener('input', () => {
                resolutionValue.textContent = parseFloat(resolutionSlider.value).toFixed(1);
            });
        }
        
        // Apply config changes
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                applyConfigChanges();
                modal.style.display = 'none';
            });
        }
        
        // Reset config to defaults
        if (resetBtn) {
            resetBtn.addEventListener('click', resetConfigToDefaults);
        }
        
        console.log("UI controls initialized successfully");
    } catch (error) {
        console.error("Error setting up UI controls:", error);
    }
}

// Load current configuration values into the modal
function loadCurrentConfig() {
    // Color settings
    document.getElementById('brickColor').value = '#' + brickColor.toString(16).padStart(6, '0');
    
    // Brick dimensions
    document.getElementById('brickWidth').value = brickDimensions.width;
    document.getElementById('brickHeight').value = brickDimensions.height;
    document.getElementById('brickDepth').value = brickDimensions.depth;
    
    // Quality settings
    document.getElementById('maxQuality').value = maxInteractiveQuality;
    document.getElementById('qualityValue').textContent = maxInteractiveQuality;
    document.getElementById('svgResolution').value = svgResolution;
    document.getElementById('resolutionValue').textContent = svgResolution.toFixed(1);
    
    // Export settings
    document.getElementById('exportBevel').checked = exportSettings.enableBevel;
    document.getElementById('exportSteps').value = exportSettings.extrudeSteps;
}

// Apply configuration changes
function applyConfigChanges() {
    // Store original values to detect changes
    const originalBrickDims = {...brickDimensions};
    const originalColors = {
        brick: brickColor
    };
    
    // Update colors
    brickColor = parseInt(document.getElementById('brickColor').value.substring(1), 16);
    
    console.log("Color values updated:", {
        brick: '#' + brickColor.toString(16)
    });
    
    // Update brick dimensions
    brickDimensions.width = parseFloat(document.getElementById('brickWidth').value);
    brickDimensions.height = parseFloat(document.getElementById('brickHeight').value);
    brickDimensions.depth = parseFloat(document.getElementById('brickDepth').value);
    
    // Update quality settings
    maxInteractiveQuality = parseFloat(document.getElementById('maxQuality').value);
    svgResolution = parseFloat(document.getElementById('svgResolution').value);
    
    // Update export settings
    exportSettings.enableBevel = document.getElementById('exportBevel').checked;
    exportSettings.extrudeSteps = parseInt(document.getElementById('exportSteps').value);
    
    // Check if we need to rebuild the brick
    const brickChanged = 
        originalBrickDims.width !== brickDimensions.width ||
        originalBrickDims.height !== brickDimensions.height ||
        originalBrickDims.depth !== brickDimensions.depth ||
        originalColors.brick !== brickColor;
    
    // Rebuild brick if dimensions changed
    if (brickChanged) {
        createBrick();
    } else {
        // Update colors without rebuilding
        updateBrickColor();
    }
    
    // If we had SVG data and something changed, update the rendering
    if (lastSvgData && brickChanged) {
        parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality);
    }
    
    console.log("Configuration applied");
}

// Reset configuration to defaults
function resetConfigToDefaults() {
    // Default colors
    document.getElementById('brickColor').value = '#bc8f8f';
    
    // Default brick dimensions
    document.getElementById('brickWidth').value = 20;
    document.getElementById('brickHeight').value = 3;
    document.getElementById('brickDepth').value = 20;
    
    // Default quality
    document.getElementById('maxQuality').value = 0.7;
    document.getElementById('qualityValue').textContent = 0.7;
    document.getElementById('svgResolution').value = 1.0;
    document.getElementById('resolutionValue').textContent = '1.0';
    
    // Default export settings
    document.getElementById('exportBevel').checked = true;
    document.getElementById('exportSteps').value = 6;
    
    console.log("Configuration reset to defaults");
}

// Update brick color
function updateBrickColor() {
    if (brick && brick.material) {
        if (Array.isArray(brick.material)) {
            brick.material.forEach(mat => {
                if (mat.name !== 'top-textured') { // Don't change textured face
                    mat.color.set(brickColor);
                }
            });
        } else {
            brick.material.color.set(brickColor);
        }
    }
}

// Update triangle color
function updateTriangleColor() {
    console.log("Updating triangle color to:", '#' + triangleColor.toString(16));
    
    // Update both triangles
    if (triangleMesh && triangleMesh.material) {
        if (Array.isArray(triangleMesh.material)) {
            triangleMesh.material.forEach(mat => mat.color.set(triangleColor));
        } else {
            triangleMesh.material.color.set(triangleColor);
        }
        triangleMesh.material.needsUpdate = true;
    } else {
        console.warn("triangleMesh or its material not found");
    }
    
    if (mirrorTriangleMesh && mirrorTriangleMesh.material) {
        if (Array.isArray(mirrorTriangleMesh.material)) {
            mirrorTriangleMesh.material.forEach(mat => mat.color.set(triangleColor));
        } else {
            mirrorTriangleMesh.material.color.set(triangleColor);
        }
        mirrorTriangleMesh.material.needsUpdate = true;
    } else {
        console.warn("mirrorTriangleMesh or its material not found");
    }
}
