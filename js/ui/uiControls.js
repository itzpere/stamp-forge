function setupUIControls() {
    try {
        const extrusionHeightEl = document.getElementById('extrusionHeight');
        if (extrusionHeightEl) {
            extrusionHeightEl.value = extrusionHeight;
            extrusionHeightEl.addEventListener('change', function() {
                const newHeight = parseFloat(this.value);
                if (!isNaN(newHeight) && newHeight > 0) {
                    extrusionHeight = newHeight;
                    console.log(`Height changed to ${newHeight} - rebuilding SVG`);
                    
                    if (window.autoSetYOffset) {
                        // Update Y position based on new height
                        extrusionPosition.y = extrusionHeight / 2;
                        const extrusionYEl = document.getElementById('extrusionY');
                        if (extrusionYEl) {
                            extrusionYEl.value = extrusionPosition.y.toFixed(1);
                        }
                    }
                    
                    if (window.lastSvgData) {
                        parseSVGForExtrusion(window.lastSvgData, false, window.maxInteractiveQuality);
                    }
                }
            });
        }
        
        const svgScaleEl = document.getElementById('svgScale');
        if (svgScaleEl) {
            svgScaleEl.value = svgScaleFactor;

            const newScaleEl = svgScaleEl.cloneNode(true);
            svgScaleEl.parentNode.replaceChild(newScaleEl, svgScaleEl);

            newScaleEl.addEventListener('input', function() {
                const newValue = parseFloat(this.value);
                if (!isNaN(newValue) && newValue > 0) {
                    updateScaleFactor(newValue, true);
                }
            });

            newScaleEl.addEventListener('change', function() {
                const finalValue = parseFloat(this.value);
                if (!isNaN(finalValue) && finalValue > 0) {
                    updateScaleFactor(finalValue, false);
                }
            });
            
            console.log(`SVG Scale control initialized with value ${svgScaleFactor}`);
        }
        
        const svgAssumeCCWEl = document.getElementById('svgAssumeCCW');
        if (svgAssumeCCWEl) {
            svgAssumeCCWEl.checked = svgAssumeCCW;

            svgAssumeCCWEl.addEventListener('change', function() {
                svgAssumeCCW = this.checked;
                console.log(`SVG winding order assumption (assume CCW exteriors) changed to: ${svgAssumeCCW}`);
                if (window.lastSvgData && typeof parseSVGForExtrusion === 'function') {
                    parseSVGForExtrusion(window.lastSvgData, false, maxInteractiveQuality);
                }
            });
        }
        
        const extrusionXEl = document.getElementById('extrusionX');
        const extrusionYEl = document.getElementById('extrusionY');
        const extrusionZEl = document.getElementById('extrusionZ');
        
        if (extrusionXEl) extrusionXEl.value = extrusionPosition.x;
        if (extrusionYEl) extrusionYEl.value = extrusionPosition.y;
        if (extrusionZEl) extrusionZEl.value = extrusionPosition.z;
        
        const addPositionEventListener = (element, axisName) => {
            if (!element) return;
            
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
            
            newElement.addEventListener('input', function() {
                const value = parseFloat(this.value);
                if (!isNaN(value)) {
                    extrusionPosition[axisName.toLowerCase()] = value;
                    if (window.lastSvgData) {
                        optimizedPositionUpdate();
                    }
                }
            });
            
            newElement.addEventListener('change', function() {
                const value = parseFloat(this.value);
                 if (!isNaN(value)) {
                    extrusionPosition[axisName.toLowerCase()] = value;
                    if (window.lastSvgData) {
                        parseSVGForExtrusion(window.lastSvgData, false, maxInteractiveQuality);
                    }
                }
            });
        };
        
        addPositionEventListener(extrusionXEl, 'X');
        addPositionEventListener(extrusionYEl, 'Y');
        addPositionEventListener(extrusionZEl, 'Z');
        
        const autoSetYOffsetEl = document.getElementById('autoSetYOffset');
        const extrusionYInputElement = document.getElementById('extrusionY');

        if (autoSetYOffsetEl && extrusionYInputElement) {
            autoSetYOffsetEl.checked = autoSetYOffset;
            extrusionYInputElement.disabled = autoSetYOffset;

            autoSetYOffsetEl.addEventListener('change', function() {
                autoSetYOffset = this.checked;
                extrusionYInputElement.disabled = autoSetYOffset;
                console.log(`Auto-set Y Offset changed to: ${autoSetYOffset}`);
                
                if (autoSetYOffset) {
                    applyAutoYOffsetBehavior();
                } else {
                    if (window.lastSvgData && typeof parseSVGForExtrusion === 'function') {
                         console.log("[AutoYOffset disabled] Re-parsing SVG with current manual Y offset.");
                         const manualYValue = parseFloat(extrusionYInputElement.value);
                         if (!isNaN(manualYValue)) {
                             extrusionPosition.y = manualYValue;
                         }
                         parseSVGForExtrusion(window.lastSvgData, false, maxInteractiveQuality);
                    }
                }
            });
        }
        
        const controlElements = document.querySelectorAll('input[type="number"]');
        controlElements.forEach(element => {
            element.addEventListener('focus', () => {
                isUserInteracting = true;
                cancelProgressiveRendering();
            });
            
            element.addEventListener('blur', () => {
                isUserInteracting = false;
                if (pendingUpdate) {
                    pendingUpdate = false;
                    scheduleProgressiveRendering();
                }
            });
        });
        
        if (extrusionHeightEl) {
            extrusionHeightEl.addEventListener('change', function() {
                const newHeight = parseFloat(this.value);
                console.log(`Height changed to ${newHeight} via change event`);
                
                extrusionHeight = newHeight;
                
                if (lastSvgData) {
                    console.log("Forcing complete rebuild due to height change (final).");
                    parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality);
                }
            });
            
            extrusionHeightEl.addEventListener('input', function() {
                const newHeight = parseFloat(this.value);
                console.log(`Height changed to ${newHeight} via input event`);
                
                extrusionHeight = newHeight;
                
                if (lastSvgData) {
                    parseSVGForExtrusion(lastSvgData, true, 0.5);
                }
            });
        }

        const topViewBtn = document.getElementById('topView');
        if (topViewBtn) {
            topViewBtn.addEventListener('click', function() {
                camera.position.set(0, 50, 0.1);
                camera.lookAt(0, 0, 0);
                controls.update();
            });
        }

        const sideViewBtn = document.getElementById('sideView');
        if (sideViewBtn) {
            sideViewBtn.addEventListener('click', function() {
                camera.position.set(50, (brickDimensions.height / 2) + 5, 0);
                camera.lookAt(0, (brickDimensions.height / 2), 0);
                controls.update();
            });
        }
        
        const modal = document.getElementById('configModal');
        const configBtn = document.getElementById('configBtn');
        const closeBtn = document.querySelector('.close');
        const applyBtn = document.getElementById('applyConfigBtn');
        const resetBtn = document.getElementById('resetConfigBtn');
        
        const qualitySlider = document.getElementById('maxQuality');
        const qualityValue = document.getElementById('qualityValue');
        
        const resolutionSlider = document.getElementById('svgResolution');
        const resolutionValue = document.getElementById('resolutionValue');
        
        if (configBtn) {
            configBtn.addEventListener('click', () => {
                loadCurrentConfig();
                modal.style.display = 'block';
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        if (qualitySlider && qualityValue) {
            qualitySlider.addEventListener('input', () => {
                qualityValue.textContent = qualitySlider.value;
            });
        }
        
        if (resolutionSlider && resolutionValue) {
            resolutionSlider.addEventListener('input', () => {
                resolutionValue.textContent = parseFloat(resolutionSlider.value).toFixed(1);
            });
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                applyConfigChanges();
                modal.style.display = 'none';
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', resetConfigToDefaults);
        }
        
        console.log("UI controls initialized successfully");
    } catch (error) {
        console.error("Error setting up UI controls:", error);
    }
}

function loadCurrentConfig() {
    try {
        const brickColorEl = document.getElementById('brickColor');
        const modalBrickColorEl = document.getElementById('modalBrickColor');
        
        if (brickColorEl) {
            const colorHex = '#' + brickColor.toString(16).padStart(6, '0');
            brickColorEl.value = colorHex;
            
            if (modalBrickColorEl) modalBrickColorEl.value = colorHex;
        }
        
        const widthEl = document.getElementById('brickWidth');
        const heightEl = document.getElementById('brickHeight');
        const depthEl = document.getElementById('brickDepth');
        
        if (widthEl) widthEl.value = brickDimensions.width;
        if (heightEl) heightEl.value = brickDimensions.height;
        if (depthEl) depthEl.value = brickDimensions.depth;
        
        const maxQualityEl = document.getElementById('maxQuality');
        const qualityValueEl = document.getElementById('qualityValue');
        const svgResolutionEl = document.getElementById('svgResolution');
        const resolutionValueEl = document.getElementById('resolutionValue');
        
        if (maxQualityEl) maxQualityEl.value = maxInteractiveQuality;
        if (qualityValueEl) qualityValueEl.textContent = maxInteractiveQuality;
        if (svgResolutionEl) svgResolutionEl.value = svgResolution;
        if (resolutionValueEl) resolutionValueEl.textContent = svgResolution.toFixed(1);
        
        const exportBevelEl = document.getElementById('exportBevel');
        const exportStepsEl = document.getElementById('exportSteps');
        
        if (exportBevelEl) exportBevelEl.checked = exportSettings.enableBevel;
        if (exportStepsEl) exportStepsEl.value = exportSettings.extrudeSteps;
        
        console.log("Configuration values loaded successfully");
    } catch (error) {
        console.error("Error loading configuration values:", error);
    }
}

function applyConfigChanges() {
    try {
        const originalBrickDims = {...brickDimensions};
        const originalColors = {
            brick: brickColor
        };
        const originalExtrusionY = extrusionPosition.y;
        const originalResolution = svgResolution;
        
        const brickColorInput = document.getElementById('brickColor');
        if (brickColorInput) {
            brickColor = parseInt(brickColorInput.value.substring(1), 16);
            console.log("Color values updated:", {
                brick: '#' + brickColor.toString(16)
            });
        }
        
        const newWidth = parseFloat(document.getElementById('brickWidth').value);
        const newHeight = parseFloat(document.getElementById('brickHeight').value);
        const newDepth = parseFloat(document.getElementById('brickDepth').value);

        brickDimensions.width = !isNaN(newWidth) && newWidth > 0 ? newWidth : originalBrickDims.width;
        brickDimensions.height = !isNaN(newHeight) && newHeight > 0 ? newHeight : originalBrickDims.height;
        brickDimensions.depth = !isNaN(newDepth) && newDepth > 0 ? newDepth : originalBrickDims.depth;

        if (isNaN(brickDimensions.width) || brickDimensions.width <= 0) brickDimensions.width = 20;
        if (isNaN(brickDimensions.height) || brickDimensions.height <= 0) brickDimensions.height = 3;
        if (isNaN(brickDimensions.depth) || brickDimensions.depth <= 0) brickDimensions.depth = 20;

        console.log("Brick dimensions updated:", brickDimensions);

        if (originalBrickDims.height !== brickDimensions.height) {
            console.log(`[applyConfigChanges] brickDimensions.height changed. Base will be rebuilt, and currentBaseTopSurfaceY updated accordingly.`);
        }

        maxInteractiveQuality = parseFloat(document.getElementById('maxQuality').value);
        
        const newResolution = parseFloat(document.getElementById('svgResolution').value);
        if (!isNaN(newResolution) && newResolution > 0) {
            svgResolution = newResolution;
            console.log(`SVG Resolution updated to: ${svgResolution}`);
        }
        
        exportSettings.enableBevel = document.getElementById('exportBevel').checked;
        exportSettings.extrudeSteps = parseInt(document.getElementById('exportSteps').value);
        
        const brickChanged = 
            originalBrickDims.width !== brickDimensions.width ||
            originalBrickDims.height !== brickDimensions.height ||
            originalBrickDims.depth !== brickDimensions.depth ||
            originalColors.brick !== brickColor;
        
        if (brickChanged) {
            createBrick();
        } else {
            updateBrickColor();
        }
        
        if (typeof window.lastSvgData !== 'undefined' && window.lastSvgData && (brickChanged || svgResolution !== originalResolution)) {
            try {
                console.log("[applyConfigChanges] SVG Resolution or brick dimensions changed. Re-parsing SVG.");
                parseSVGForExtrusion(window.lastSvgData, false, maxInteractiveQuality);
            } catch (parseError) {
                console.error("[applyConfigChanges] Error re-parsing SVG:", parseError);
                alert("An error occurred while updating SVG. Try refreshing the page.");
            }
        } else if (typeof window.lastSvgData !== 'undefined' && window.lastSvgData && autoSetYOffset && originalBrickDims.height !== brickDimensions.height) {
            try {
                console.log("[applyConfigChanges] Brick height changed and autoSetYOffset is ON. Applying auto Y offset behavior.");
                applyAutoYOffsetBehavior();
            } catch (offsetError) {
                console.error("[applyConfigChanges] Error applying Y offset:", offsetError);
            }
        }
        
        console.log("Configuration applied");
    } catch (error) {
        console.error("Error applying configuration changes:", error);
        alert("Error applying configuration. See console for details.");
    }
}

function resetConfigToDefaults() {
    document.getElementById('brickColor').value = '#bc8f8f';
    
    document.getElementById('brickWidth').value = 20;
    document.getElementById('brickHeight').value = 3;
    document.getElementById('brickDepth').value = 20;
    
    document.getElementById('maxQuality').value = 0.7;
    document.getElementById('qualityValue').textContent = 0.7;
    document.getElementById('svgResolution').value = 1.0;
    document.getElementById('resolutionValue').textContent = '1.0';
    
    document.getElementById('exportBevel').checked = true;
    document.getElementById('exportSteps').value = 6;
    
    console.log("Configuration reset to defaults");
}

function updateBrickColor() {
    if (stampBase && stampBase.material) {
        if (Array.isArray(stampBase.material)) {
            stampBase.material.forEach(mat => {
                mat.color.set(brickColor);
            });
        } else {
            stampBase.material.color.set(brickColor);
        }
        stampBase.material.needsUpdate = true;
    } else {
        if (brick && brick.material) {
            if (Array.isArray(brick.material)) {
                brick.material.forEach(mat => {
                    if (mat.name !== 'top-textured') {
                        mat.color.set(brickColor);
                    }
                });
            } else {
                brick.material.color.set(brickColor);
            }
        }
    }
}

function updateTriangleColor() {
    console.log("Updating triangle color to:", '#' + triangleColor.toString(16));
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

function updateExtrusionPosition() {
    console.log(`[updateExtrusionPosition] Final position from globals: (${extrusionPosition.x}, ${extrusionPosition.y}, ${extrusionPosition.z})`);
    
    if (typeof window.lastSvgData !== 'undefined' && window.lastSvgData) {
        parseSVGForExtrusion(window.lastSvgData, false, maxInteractiveQuality);
    } else {
        if (typeof updateDesignPosition === 'function') {
            updateDesignPosition();
        }
    }
}

function optimizedPositionUpdate() {
    console.log(`[optimizedPositionUpdate] Interactive position from globals: (${extrusionPosition.x}, ${extrusionPosition.y}, ${extrusionPosition.z})`);

    if (typeof window.lastSvgData !== 'undefined' && window.lastSvgData) {
        parseSVGForExtrusion(window.lastSvgData, true, 0.3);
    } else {
         if (typeof updateDesignPosition === 'function') {
            updateDesignPosition();
        }
    }
}

function updateScaleFactor(newScale, immediate) {
    svgScaleFactor = parseFloat(newScale);
    console.log(`Scale factor updated to: ${svgScaleFactor}, immediate: ${immediate}`);

    if (extrudedGroup) {
        while(extrudedGroup.children.length > 0) {
            const child = extrudedGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
            extrudedGroup.remove(child);
        }
    }
    
    if (window.lastSvgData) {
        const quality = immediate ? 0.3 : maxInteractiveQuality;
        console.log(`[updateScaleFactor] Calling parseSVGForExtrusion. SVG Data Length: ${window.lastSvgData.length}, immediate: ${immediate}, quality: ${quality}`);
        parseSVGForExtrusion(window.lastSvgData, immediate, quality);
    } else {
        console.warn("[updateScaleFactor] window.lastSvgData is null or empty. Cannot parse SVG.");
    }
}

function updateExtrusionYUI(value) {
    const extrusionYEl = document.getElementById('extrusionY');
    value = parseFloat(value.toFixed(2));
    if (extrusionYEl) {
        extrusionYEl.value = parseFloat(value.toFixed(2));
    }
}

function applyAutoYOffsetBehavior() {
    console.log(`[applyAutoYOffsetBehavior] Auto-set Y is ON. Re-parsing to apply automatic Y position.`);
    if (autoSetYOffset) {
        const prospectiveY = (typeof extrusionHeight === 'number' && extrusionHeight > 0) ? extrusionHeight / 2 : 0;
        updateExtrusionYUI(prospectiveY);
        if (typeof window.lastSvgData !== 'undefined' && window.lastSvgData && typeof parseSVGForExtrusion === 'function') {
            parseSVGForExtrusion(window.lastSvgData, false, maxInteractiveQuality);
        }
    } else {
        console.log(`[applyAutoYOffsetBehavior] Auto-set Y is OFF. Manual Y position will be used.`);
    }
}