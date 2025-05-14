// --- Content from /home/pere/Documents/stamp/js/uiControls.js ---
function setupUIControls() {
    try {
        const extrusionHeightEl = document.getElementById('extrusionHeight');
        if (extrusionHeightEl) { /* ... */ }
        
        const svgScaleEl = document.getElementById('svgScale');
        if (svgScaleEl) {
            svgScaleEl.value = window.svgScaleFactor || 1.0;
            
            // Remove existing listeners to avoid duplicates
            const newScaleEl = svgScaleEl.cloneNode(true);
            svgScaleEl.parentNode.replaceChild(newScaleEl, svgScaleEl);
            
            // Add new event listeners
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
            
            console.log(`SVG Scale control initialized with value ${window.svgScaleFactor || 1.0}`);
        }
        
        // Setup position controls with proper event listeners
        const extrusionXEl = document.getElementById('extrusionX');
        const extrusionYEl = document.getElementById('extrusionY');
        const extrusionZEl = document.getElementById('extrusionZ');
        
        // Make sure extrusionPosition is defined
        window.extrusionPosition = window.extrusionPosition || { x: 0, y: 0, z: 0 };
        
        // Set initial values from global state
        if (extrusionXEl) extrusionXEl.value = window.extrusionPosition.x;
        if (extrusionYEl) extrusionYEl.value = window.extrusionPosition.y;
        if (extrusionZEl) extrusionZEl.value = window.extrusionPosition.z;
        
        const addPositionEventListener = (element, axisName) => {
            if (!element) return;
            
            // Clone to remove existing listeners
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
            
            newElement.addEventListener('input', function() {
                const value = parseFloat(this.value);
                if (!isNaN(value)) {
                    window.extrusionPosition[axisName.toLowerCase()] = value;
                    if (window.lastSvgData) {
                        window.optimizedPositionUpdate();
                    }
                }
            });
            
            newElement.addEventListener('change', function() {
                const value = parseFloat(this.value);
                if (!isNaN(value)) {
                    window.extrusionPosition[axisName.toLowerCase()] = value;
                    if (window.lastSvgData) {
                        window.parseSVGForExtrusion(window.lastSvgData, false, window.maxInteractiveQuality);
                    }
                }
            });
        };
        
        addPositionEventListener(extrusionXEl, 'x');
        addPositionEventListener(extrusionYEl, 'y');
        addPositionEventListener(extrusionZEl, 'z');
        
        // Set up auto Y offset checkbox
        const autoSetYOffsetEl = document.getElementById('autoSetYOffset');
        const extrusionYInputElement = document.getElementById('extrusionY');

        if (autoSetYOffsetEl && extrusionYInputElement) {
            // Make sure the global autoSetYOffset is defined
            window.autoSetYOffset = typeof window.autoSetYOffset !== 'undefined' ? window.autoSetYOffset : true;
            
            autoSetYOffsetEl.checked = window.autoSetYOffset;
            extrusionYInputElement.disabled = window.autoSetYOffset;

            // Clone to remove existing listeners
            const newAutoSetYOffsetEl = autoSetYOffsetEl.cloneNode(true);
            autoSetYOffsetEl.parentNode.replaceChild(newAutoSetYOffsetEl, autoSetYOffsetEl);
            
            newAutoSetYOffsetEl.addEventListener('change', function() {
                window.autoSetYOffset = this.checked;
                extrusionYInputElement.disabled = window.autoSetYOffset;
                console.log(`Auto-set Y Offset changed to: ${window.autoSetYOffset}`);
                
                if (window.autoSetYOffset) {
                    window.applyAutoYOffsetBehavior();
                } else {
                    if (window.lastSvgData && typeof window.parseSVGForExtrusion === 'function') {
                        console.log("[AutoYOffset disabled] Re-parsing SVG with current manual Y offset.");
                        const manualYValue = parseFloat(extrusionYInputElement.value);
                        if (!isNaN(manualYValue)) {
                            window.extrusionPosition.y = manualYValue;
                        }
                        window.parseSVGForExtrusion(window.lastSvgData, false, window.maxInteractiveQuality);
                    }
                }
            });
        }
        
        const controlElements = document.querySelectorAll('input[type="number"]');
        controlElements.forEach(element => { /* ... */ });
        
        if (extrusionHeightEl) { /* ... */ }

        const topViewBtn = document.getElementById('topView');
        if (topViewBtn) { /* ... */ }

        const sideViewBtn = document.getElementById('sideView');
        // ... (rest of setupUIControls implementation)
        
        const modal = document.getElementById('configModal');
        const configBtn = document.getElementById('configBtn');
        const closeBtn = document.querySelector('.close');
        const applyBtn = document.getElementById('applyConfigBtn');
        const resetBtn = document.getElementById('resetConfigBtn');
        
        // Add debug logging to help diagnose the issue
        console.log("Config elements:", {
            modal: modal ? "Found" : "Missing",
            configBtn: configBtn ? "Found" : "Missing",
            closeBtn: closeBtn ? "Found" : "Missing",
            applyBtn: applyBtn ? "Found" : "Missing",
            resetBtn: resetBtn ? "Found" : "Missing"
        });
        
        if (configBtn) {
            // Check if the button is disabled via class
            if (configBtn.classList.contains('disabled')) {
                // If button is disabled, replace the click function with a tooltip-only function
                const newConfigBtn = configBtn.cloneNode(true);
                configBtn.parentNode.replaceChild(newConfigBtn, configBtn);
                
                // The tooltip is now handled by CSS, so we just need to prevent the default action
                newConfigBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log("Config button is disabled - Work in Progress");
                    return false;
                });
                
                console.log("Config button is disabled - tooltip only");
            } else {
                // Original behavior for enabled button
                const newConfigBtn = configBtn.cloneNode(true);
                configBtn.parentNode.replaceChild(newConfigBtn, configBtn);
                
                newConfigBtn.addEventListener('click', function() {
                    console.log("Config button clicked");
                    try {
                        if (!modal) {
                            console.error("Config modal element not found");
                            alert("Error: Configuration panel not available");
                            return;
                        }
                        
                        // Load current configuration values
                        if (typeof loadCurrentConfig === 'function') {
                            loadCurrentConfig();
                        } else {
                            console.error("loadCurrentConfig function not found");
                        }
                        
                        // Show the modal
                        modal.style.display = 'block';
                        console.log("Modal display set to 'block'");
                        
                        // Force modal redraw
                        void modal.offsetWidth;
                    } catch (error) {
                        console.error("Error showing config modal:", error);
                    }
                });
                console.log("Config button event listener attached");
            }
        } else {
            console.error("Config button element not found in DOM");
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                console.log("Close button clicked");
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        } else {
            console.warn("Close button for config modal not found");
        }
        
        // Fix the Apply button event listener
        if (applyBtn) {
            // Remove any existing listeners to avoid duplicates
            const newApplyBtn = applyBtn.cloneNode(true);
            applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
            
            newApplyBtn.addEventListener('click', function() {
                console.log("Apply config button clicked");
                try {
                    if (typeof applyConfigChanges === 'function') {
                        applyConfigChanges();
                        console.log("Configuration changes applied successfully");
                    } else {
                        console.error("applyConfigChanges function not found");
                        alert("Error: Could not apply configuration changes");
                    }
                    
                    if (modal) {
                        modal.style.display = 'none';
                        console.log("Modal closed after applying changes");
                    }
                } catch (error) {
                    console.error("Error applying configuration changes:", error);
                    alert("Error applying configuration changes. See console for details.");
                }
            });
            console.log("Apply config button event listener attached");
        } else {
            console.error("Apply config button element not found in DOM");
        }
        
        // Fix the Reset button event listener
        if (resetBtn) {
            // Remove any existing listeners to avoid duplicates
            const newResetBtn = resetBtn.cloneNode(true);
            resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
            
            newResetBtn.addEventListener('click', function() {
                console.log("Reset config button clicked");
                try {
                    if (typeof resetConfigToDefaults === 'function') {
                        resetConfigToDefaults();
                        console.log("Configuration reset to defaults");
                    } else {
                        console.error("resetConfigToDefaults function not found");
                    }
                } catch (error) {
                    console.error("Error resetting configuration:", error);
                }
            });
            console.log("Reset config button event listener attached");
        } else {
            console.warn("Reset config button element not found in DOM");
        }
        
        console.log("UI controls initialized successfully");
    } catch (error) {
        console.error("Error setting up UI controls:", error);
    }
}

function loadCurrentConfig() {
    console.log("Loading current configuration into modal");
    try {
        // Use window.config as the source of truth.
        // Fallback to initialConfig or hardcoded defaults if window.config is not fully populated.
        const currentBrickColor = (window.config && window.config.brickColor !== undefined) ? window.config.brickColor : 0xbc8f8f;
        const currentBrickDims = (window.config && window.config.brickDimensions) ? window.config.brickDimensions : { width: 20, height: 3, depth: 20 };
        const currentMaxQuality = (window.config && window.config.maxInteractiveQuality !== undefined) ? window.config.maxInteractiveQuality : 0.7;
        const currentSvgResolution = (window.config && window.config.svgResolution !== undefined) ? window.config.svgResolution : 1.0;
        const currentExportSettings = (window.config && window.config.exportSettings) ? window.config.exportSettings : { enableBevel: true, extrudeSteps: 6 };
        const currentDefaultOp = (window.config && window.config.defaultShapeOperation) ? window.config.defaultShapeOperation : 'extrude';
        const currentHoleSettings = (window.config && window.config.holeDetectionSettings) ? window.config.holeDetectionSettings : { aggressiveness: 0.7, areaRatioThreshold: 0.5, pointsInsideThreshold: 0.6 };

        document.getElementById('modalBrickColor').value = '#' + currentBrickColor.toString(16).padStart(6, '0');
        
        document.getElementById('brickWidth').value = currentBrickDims.width;
        document.getElementById('brickHeight').value = currentBrickDims.height;
        document.getElementById('brickDepth').value = currentBrickDims.depth;
        
        document.getElementById('maxQuality').value = currentMaxQuality;
        document.getElementById('qualityValue').textContent = currentMaxQuality.toString();
        document.getElementById('svgResolution').value = currentSvgResolution;
        document.getElementById('resolutionValue').textContent = currentSvgResolution.toFixed(1);
        
        document.getElementById('exportBevel').checked = currentExportSettings.enableBevel;
        document.getElementById('exportSteps').value = currentExportSettings.extrudeSteps;

        // Load new shape settings
        const defaultShapeOpEl = document.getElementById('defaultShapeOperation');
        if (defaultShapeOpEl) {
            defaultShapeOpEl.value = currentDefaultOp;
        } else {
            console.warn("defaultShapeOperation element not found in modal");
        }

        // Load hole detection settings
        const holeAggressivenessEl = document.getElementById('holeAggressiveness');
        const holeAggressivenessValueEl = document.getElementById('holeAggressivenessValue');
        const holeAreaRatioEl = document.getElementById('holeAreaRatio');
        const holeAreaRatioValueEl = document.getElementById('holeAreaRatioValue');
        const holePointsInsideEl = document.getElementById('holePointsInside');
        const holePointsInsideValueEl = document.getElementById('holePointsInsideValue');
        
        if (holeAggressivenessEl) {
            holeAggressivenessEl.value = currentHoleSettings.aggressiveness;
            if (holeAggressivenessValueEl) holeAggressivenessValueEl.textContent = currentHoleSettings.aggressiveness;
        }
        
        if (holeAreaRatioEl) {
            holeAreaRatioEl.value = currentHoleSettings.areaRatioThreshold;
            if (holeAreaRatioValueEl) holeAreaRatioValueEl.textContent = currentHoleSettings.areaRatioThreshold;
        }
        
        if (holePointsInsideEl) {
            holePointsInsideEl.value = currentHoleSettings.pointsInsideThreshold;
            if (holePointsInsideValueEl) holePointsInsideValueEl.textContent = currentHoleSettings.pointsInsideThreshold;
        }
        
        // Add input event listeners for hole detection sliders
        if (holeAggressivenessEl && holeAggressivenessValueEl) {
            holeAggressivenessEl.addEventListener('input', function() {
                holeAggressivenessValueEl.textContent = this.value;
            });
        }
        
        if (holeAreaRatioEl && holeAreaRatioValueEl) {
            holeAreaRatioEl.addEventListener('input', function() {
                holeAreaRatioValueEl.textContent = this.value;
            });
        }
        
        if (holePointsInsideEl && holePointsInsideValueEl) {
            holePointsInsideEl.addEventListener('input', function() {
                holePointsInsideValueEl.textContent = this.value;
            });
        }
        
        // Ensure all UI elements are valid before setting values
        const elementsToCheck = [
            'brickColor', 'modalBrickColor', 
            'brickWidth', 'brickHeight', 'brickDepth',
            'maxQuality', 'qualityValue', 
            'svgResolution', 'resolutionValue',
            'exportBevel', 'exportSteps',
            'holeAggressiveness', 'holeAggressivenessValue',
            'holeAreaRatio', 'holeAreaRatioValue',
            'holePointsInside', 'holePointsInsideValue'
        ];
        
        const missingElements = [];
        for (const id of elementsToCheck) {
            if (!document.getElementById(id)) {
                missingElements.push(id);
            }
        }
        
        if (missingElements.length > 0) {
            console.error("Missing UI elements:", missingElements);
        }
        
        // Add default values for UI elements in case they're missing
        const defaults = {
            brickColor: '#bc8f8f',
            modalBrickColor: '#bc8f8f',
            brickWidth: 20,
            brickHeight: 3,
            brickDepth: 20,
            maxQuality: 0.7,
            qualityValue: '0.7',
            svgResolution: 1.0,
            resolutionValue: '1.0',
            exportBevel: true,
            exportSteps: 6,
            defaultShapeOperation: 'extrude', // Default for the new setting
            holeAggressiveness: 0.7,
            holeAggressivenessValue: '0.7',
            holeAreaRatio: 0.5,
            holeAreaRatioValue: '0.5',
            holePointsInside: 0.6,
            holePointsInsideValue: '0.6'
        };
        
        // Set values on UI elements with error handling
        for (const [id, value] of Object.entries(defaults)) {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'defaultShapeOperation' && element.tagName === 'SELECT') {
                    element.value = value;
                } else if (element.type === 'checkbox') {
                    element.checked = typeof value === 'boolean' ? value : Boolean(value);
                } else if (element.tagName === 'SPAN') {
                    element.textContent = String(value);
                } else {
                    element.value = value;
                }
            }
        }
        
        console.log("Configuration values loaded successfully");
    } catch (error) {
        console.error("Error loading configuration values:", error);
    }
}

function applyConfigChanges() {
    console.log("Applying configuration changes");
    try {
        const newConfigValues = {
            brickColor: parseInt(document.getElementById('modalBrickColor').value.substring(1), 16),
            brickDimensions: {
                width: parseFloat(document.getElementById('brickWidth').value),
                height: parseFloat(document.getElementById('brickHeight').value),
                depth: parseFloat(document.getElementById('brickDepth').value)
            },
            maxInteractiveQuality: parseFloat(document.getElementById('maxQuality').value),
            svgResolution: parseFloat(document.getElementById('svgResolution').value),
            exportSettings: {
                enableBevel: document.getElementById('exportBevel').checked,
                extrudeSteps: parseInt(document.getElementById('exportSteps').value)
            },
            defaultShapeOperation: document.getElementById('defaultShapeOperation') ? document.getElementById('defaultShapeOperation').value : (window.config.defaultShapeOperation || 'extrude'),
            holeDetectionSettings: {
                aggressiveness: parseFloat(document.getElementById('holeAggressiveness').value),
                areaRatioThreshold: parseFloat(document.getElementById('holeAreaRatio').value),
                pointsInsideThreshold: parseFloat(document.getElementById('holePointsInside').value)
            }
        };
        
        // Log the new configuration values for debugging
        console.log("New configuration values:", newConfigValues);
        
        // Check if any relevant values have changed compared to the old config
        const brickChanged = 
            newConfigValues.brickColor !== (window.config ? window.config.brickColor : 0) ||
            newConfigValues.brickDimensions.width !== (window.config && window.config.brickDimensions ? window.config.brickDimensions.width : 0) ||
            newConfigValues.brickDimensions.height !== (window.config && window.config.brickDimensions ? window.config.brickDimensions.height : 0) ||
            newConfigValues.brickDimensions.depth !== (window.config && window.config.brickDimensions ? window.config.brickDimensions.depth : 0);
        
        const oldSvgResolution = window.config ? window.config.svgResolution : 1.0;
        const oldDefaultShapeOperation = window.config ? window.config.defaultShapeOperation : 'extrude';

        // Call the centralized applyConfig function from config.js if it exists
        // Otherwise, update window.config directly.
        if (typeof window.applyGlobalConfig === 'function') {
            window.applyGlobalConfig(newConfigValues);
        } else {
            console.warn("applyGlobalConfig function is not defined. Updating window.config directly.");
            // Fallback to updating window.config and relevant globals directly
            window.config = window.config || {};
            Object.assign(window.config, newConfigValues);
            
            // Update legacy globals if they are still used
            window.brickColor = window.config.brickColor;
            window.brickDimensions = window.config.brickDimensions;
            window.maxInteractiveQuality = window.config.maxInteractiveQuality;
            window.svgResolution = window.config.svgResolution;
            window.exportSettings = window.config.exportSettings;
            window.defaultShapeOperation = window.config.defaultShapeOperation;
            window.svgHoleDetectionSettings = window.config.holeDetectionSettings;
        }
        
        // Reparse SVG if relevant settings changed
        if (window.lastSvgData && (
            brickChanged || 
            (window.config && window.config.svgResolution !== oldSvgResolution) ||
            (window.config && window.config.defaultShapeOperation !== oldDefaultShapeOperation)
            )) {
            console.log("[applyConfigChanges] Relevant config changed. Re-parsing SVG.");
            if (typeof parseSVGForExtrusion === 'function') {
                parseSVGForExtrusion(window.lastSvgData, false, window.maxInteractiveQuality || 0.7);
            } else {
                console.error("[applyConfigChanges] parseSVGForExtrusion function not found");
            }
        } else {
            console.log("[applyConfigChanges] No SVG data to reprocess or no relevant changes detected");
        }
        
        console.log("Configuration applied successfully");
        return true;
    } catch (error) {
        console.error("Error applying configuration changes:", error);
        alert("Error applying configuration. See console for details.");
        return false;
    }
}

function resetConfigToDefaults() {
    // Define default values, ideally from a single source like initialConfig in config.js
    const defaults = {
        brickColorHex: '#bc8f8f',
        brickWidth: 20,
        brickHeight: 3,
        brickDepth: 20,
        maxQuality: 0.7,
        svgResolution: 1.0,
        exportBevel: true,
        exportSteps: 6,
        defaultShapeOperation: 'extrude', // Default for the new setting
        holeAggressiveness: 0.7,
        holeAreaRatio: 0.5,
        holePointsInside: 0.6
    };

    document.getElementById('modalBrickColor').value = defaults.brickColorHex;
    
    document.getElementById('brickWidth').value = defaults.brickWidth;
    document.getElementById('brickHeight').value = defaults.brickHeight;
    document.getElementById('brickDepth').value = defaults.brickDepth;
    
    document.getElementById('maxQuality').value = defaults.maxQuality;
    document.getElementById('qualityValue').textContent = defaults.maxQuality.toString();
    document.getElementById('svgResolution').value = defaults.svgResolution;
    document.getElementById('resolutionValue').textContent = defaults.svgResolution.toFixed(1);
    
    document.getElementById('exportBevel').checked = defaults.exportBevel;
    document.getElementById('exportSteps').value = defaults.exportSteps;

    // Reset new shape settings
    const defaultShapeOpEl = document.getElementById('defaultShapeOperation');
    if (defaultShapeOpEl) {
        defaultShapeOpEl.value = defaults.defaultShapeOperation;
    }
    
    // Reset hole detection settings
    document.getElementById('holeAggressiveness').value = 0.7;
    document.getElementById('holeAggressivenessValue').textContent = '0.7';
    document.getElementById('holeAreaRatio').value = 0.5;
    document.getElementById('holeAreaRatioValue').textContent = '0.5';
    document.getElementById('holePointsInside').value = 0.6;
    document.getElementById('holePointsInsideValue').textContent = '0.6';
    
    console.log("Configuration reset to defaults");
}

function updateBrickColor() {
    if (window.stampBase && window.stampBase.material) { /* ... */ } else { /* ... */ }
}

function updateTriangleColor() {
    console.log("Updating triangle color to:", '#' + (window.triangleColor || 0).toString(16));
    if (window.triangleMesh && window.triangleMesh.material) { /* ... */ } else { /* ... */ }

    if (window.mirrorTriangleMesh && window.mirrorTriangleMesh.material) { /* ... */ } else { /* ... */ }
}

function updateExtrusionPosition() {
    console.log(`[updateExtrusionPosition] Final position from globals: (${window.extrusionPosition.x}, ${window.extrusionPosition.y}, ${window.extrusionPosition.z})`);
    
    if (typeof window.lastSvgData !== 'undefined' && window.lastSvgData) { /* ... */ } else { /* ... */ }
}

function optimizedPositionUpdate() {
    console.log(`[optimizedPositionUpdate] Interactive position from globals: (${window.extrusionPosition.x}, ${window.extrusionPosition.y}, ${window.extrusionPosition.z})`);

    if (typeof window.lastSvgData !== 'undefined' && window.lastSvgData) { /* ... */ } else { /* ... */ }
}

function updateScaleFactor(newScale, immediate) {
    window.svgScaleFactor = parseFloat(newScale);
    console.log(`Scale factor updated to: ${window.svgScaleFactor}, immediate: ${immediate}`);

    if (window.extrudedGroup) {
        // Clear existing shapes
        while(window.extrudedGroup.children.length > 0) {
            const child = window.extrudedGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
            window.extrudedGroup.remove(child);
        }
    }
    
    if (window.lastSvgData) {
        const quality = immediate ? 0.3 : (window.maxInteractiveQuality || 0.7);
        console.log(`[updateScaleFactor] Calling parseSVGForExtrusion. SVG Data Length: ${window.lastSvgData.length}, immediate: ${immediate}, quality: ${quality}`);
        window.parseSVGForExtrusion(window.lastSvgData, immediate, quality);
    } else {
        console.warn("[updateScaleFactor] window.lastSvgData is null or empty. Cannot parse SVG.");
    }
}

function updateExtrusionYUI(value) {
    const extrusionYEl = document.getElementById('extrusionY');
    value = parseFloat(value.toFixed(2));
    if (extrusionYEl) { /* ... */ }
}

function applyAutoYOffsetBehavior() {
    console.log(`[applyAutoYOffsetBehavior] Auto-set Y is ${window.autoSetYOffset ? 'ON' : 'OFF'}. Re-parsing to apply automatic Y position.`);
    if (window.autoSetYOffset) {
        const currentExtrusionHeight = (typeof window.extrusionHeight === 'number' && window.extrusionHeight > 0) ? 
            window.extrusionHeight : 1.5;
        const prospectiveY = currentExtrusionHeight / 2;
        
        window.extrusionPosition.y = prospectiveY;
        updateExtrusionYUI(prospectiveY);
        
        if (window.lastSvgData && typeof window.parseSVGForExtrusion === 'function') {
            window.parseSVGForExtrusion(window.lastSvgData, false, window.maxInteractiveQuality);
        }
    } else {
        console.log(`[applyAutoYOffsetBehavior] Auto-set Y is OFF. Manual Y position will be used.`);
    }
}

// --- Content from /home/pere/Documents/stamp/js/ui.js ---
function initDynamicUIElements() {
    const mainColorInput = document.getElementById('brickColor');
    const modalColorInput = document.getElementById('modalBrickColor');
    
    if (mainColorInput && modalColorInput) {
        mainColorInput.addEventListener('change', function() {
            modalColorInput.value = this.value;
            window.brickColor = parseInt(this.value.substring(1), 16);
            if (typeof window.updateStampBaseColor === 'function') { // Assuming updateStampBaseColor is global
                window.updateStampBaseColor();
            } else if (typeof updateBrickColor === 'function') { // or local if defined above
                 updateBrickColor();
            }
        });
        
        const configBtn = document.getElementById('configBtn');
        if (configBtn) {
            configBtn.addEventListener('click', function() {
                modalColorInput.value = mainColorInput.value;
            });
        }
    }

    const accordionHeaderSvg = document.querySelector('.accordion-header-svg');
    if (accordionHeaderSvg) {
        const accordionContentSvg = accordionHeaderSvg.nextElementSibling;

        if (accordionContentSvg && !accordionHeaderSvg.classList.contains('active')) {
            accordionContentSvg.style.maxHeight = "0px";
        }

        accordionHeaderSvg.addEventListener('click', function() {
            this.classList.toggle('active');
            this.setAttribute('aria-expanded', this.classList.contains('active'));

            if (accordionContentSvg) {
                if (accordionContentSvg.style.maxHeight && accordionContentSvg.style.maxHeight !== "0px") {
                    accordionContentSvg.style.maxHeight = "0px";
                } else {
                    accordionContentSvg.style.maxHeight = accordionContentSvg.scrollHeight + "px";
                }
            }
        });
    }
}

// --- Content from /home/pere/Documents/stamp/js/svgUIIntegration.js ---
function showMessage(message, duration = 3000) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.textContent = message;
        loadingElement.classList.remove('hidden');
        setTimeout(() => {
            loadingElement.classList.add('hidden');
        }, duration);
    }
}

function handleSVGUpload(file) {
    if (window.SVGProcessing && window.SVGProcessing.UI && typeof window.SVGProcessing.UI.cleanupSVGResources === 'function') {
        window.SVGProcessing.UI.cleanupSVGResources();
    } else {
        console.warn("cleanupSVGResources function not found under SVGProcessing.UI namespace.");
        // Fallback or direct call if it was global before
        if (typeof window.cleanupSVGResources === 'function') window.cleanupSVGResources();
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        window.lastSvgData = event.target.result;
        
        if (typeof window.parseSVGForExtrusion === 'function') {
            window.parseSVGForExtrusion(window.lastSvgData, false, window.maxInteractiveQuality);
        } else {
            console.error("parseSVGForExtrusion function is not available");
            showMessage("Error: SVG processing functionality is not available");
        }
        
        const downloadButton = document.getElementById('downloadSTL');
        if (downloadButton) {
            downloadButton.disabled = false;
        }
    };

    reader.onerror = function(error) {
        console.error("Error reading file:", error);
        showMessage(`Error reading file: ${file.name}`);
    };

    reader.readAsText(file);
}

// Expose functions to global scope
window.setupUIControls = setupUIControls;
window.loadCurrentConfig = loadCurrentConfig;
window.applyConfigChanges = applyConfigChanges;
window.resetConfigToDefaults = resetConfigToDefaults;
window.updateBrickColor = updateBrickColor;
window.updateTriangleColor = updateTriangleColor;
window.updateExtrusionPosition = updateExtrusionPosition;
window.optimizedPositionUpdate = optimizedPositionUpdate;
window.updateScaleFactor = updateScaleFactor;
window.updateExtrusionYUI = updateExtrusionYUI;
window.applyAutoYOffsetBehavior = applyAutoYOffsetBehavior;
window.initDynamicUIElements = initDynamicUIElements;
window.showMessage = showMessage;
window.handleSVGUpload = handleSVGUpload;
