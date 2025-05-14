// --- Content from /home/pere/Documents/stamp/js/uiControls.js ---
function setupUIControls() {
    try {
        const extrusionHeightEl = document.getElementById('extrusionHeight');
        if (extrusionHeightEl) { /* ... */ }
        
        const svgScaleEl = document.getElementById('svgScale');
        if (svgScaleEl) { /* ... */ }
        
        const svgAssumeCCWEl = document.getElementById('svgAssumeCCW');
        if (svgAssumeCCWEl) { /* ... */ }
        
        const extrusionXEl = document.getElementById('extrusionX');
        const extrusionYEl = document.getElementById('extrusionY');
        const extrusionZEl = document.getElementById('extrusionZ');
        
        if (extrusionXEl) { /* ... */ }
        if (extrusionYEl) { /* ... */ }
        if (extrusionZEl) { /* ... */ }
        
        const addPositionEventListener = (element, axisName) => { /* ... */ };
        
        addPositionEventListener(extrusionXEl, 'X');
        addPositionEventListener(extrusionYEl, 'Y');
        addPositionEventListener(extrusionZEl, 'Z');
        
        const autoSetYOffsetEl = document.getElementById('autoSetYOffset');
        const extrusionYInputElement = document.getElementById('extrusionY');

        if (autoSetYOffsetEl && extrusionYInputElement) { /* ... */ }
        
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
            // Remove any existing event listeners
            const newConfigBtn = configBtn.cloneNode(true);
            configBtn.parentNode.replaceChild(newConfigBtn, configBtn);
            
            // Add new event listener with error handling
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
        // Load general settings
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

        // Load hole detection settings
        const holeAggressivenessEl = document.getElementById('holeAggressiveness');
        const holeAggressivenessValueEl = document.getElementById('holeAggressivenessValue');
        const holeAreaRatioEl = document.getElementById('holeAreaRatio');
        const holeAreaRatioValueEl = document.getElementById('holeAreaRatioValue');
        const holePointsInsideEl = document.getElementById('holePointsInside');
        const holePointsInsideValueEl = document.getElementById('holePointsInsideValue');
        
        if (holeAggressivenessEl && window.svgHoleDetectionSettings) {
            holeAggressivenessEl.value = window.svgHoleDetectionSettings.aggressiveness;
            if (holeAggressivenessValueEl) holeAggressivenessValueEl.textContent = window.svgHoleDetectionSettings.aggressiveness;
        }
        
        if (holeAreaRatioEl && window.svgHoleDetectionSettings) {
            holeAreaRatioEl.value = window.svgHoleDetectionSettings.areaRatioThreshold;
            if (holeAreaRatioValueEl) holeAreaRatioValueEl.textContent = window.svgHoleDetectionSettings.areaRatioThreshold;
        }
        
        if (holePointsInsideEl && window.svgHoleDetectionSettings) {
            holePointsInsideEl.value = window.svgHoleDetectionSettings.pointsInsideThreshold;
            if (holePointsInsideValueEl) holePointsInsideValueEl.textContent = window.svgHoleDetectionSettings.pointsInsideThreshold;
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
                if (element.type === 'checkbox') {
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
        // Apply general settings
        // ...existing code...
        
        // Apply hole detection settings
        if (window.svgHoleDetectionSettings) {
            const holeAggressiveness = document.getElementById('holeAggressiveness');
            const holeAreaRatio = document.getElementById('holeAreaRatio');
            const holePointsInside = document.getElementById('holePointsInside');
            
            if (holeAggressiveness && holeAreaRatio && holePointsInside) {
                window.svgHoleDetectionSettings.aggressiveness = parseFloat(holeAggressiveness.value);
                window.svgHoleDetectionSettings.areaRatioThreshold = parseFloat(holeAreaRatio.value);
                window.svgHoleDetectionSettings.pointsInsideThreshold = parseFloat(holePointsInside.value);
                
                console.log("Hole detection settings updated:", {
                    aggressiveness: window.svgHoleDetectionSettings.aggressiveness,
                    areaRatioThreshold: window.svgHoleDetectionSettings.areaRatioThreshold,
                    pointsInsideThreshold: window.svgHoleDetectionSettings.pointsInsideThreshold
                });
            } else {
                console.warn("One or more hole detection setting elements not found");
            }
        }
        
        if (typeof window.lastSvgData !== 'undefined' && window.lastSvgData) {
            try {
                console.log("[applyConfigChanges] Config changed. Re-parsing SVG.");
                if (typeof parseSVGForExtrusion === 'function') {
                    parseSVGForExtrusion(window.lastSvgData, false, window.maxInteractiveQuality || 0.7);
                } else {
                    console.error("[applyConfigChanges] parseSVGForExtrusion function not found");
                }
            } catch (parseError) {
                console.error("[applyConfigChanges] Error re-parsing SVG:", parseError);
                alert("An error occurred while updating SVG. Try refreshing the page.");
            }
        } else {
            console.log("[applyConfigChanges] No SVG data to reprocess");
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
    // Reset general settings
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
        while(window.extrudedGroup.children.length > 0) { /* ... */ }
    }
    
    if (window.lastSvgData) { /* ... */ } else { /* ... */ }
}

function updateExtrusionYUI(value) {
    const extrusionYEl = document.getElementById('extrusionY');
    value = parseFloat(value.toFixed(2));
    if (extrusionYEl) { /* ... */ }
}

function applyAutoYOffsetBehavior() {
    console.log(`[applyAutoYOffsetBehavior] Auto-set Y is ${window.autoSetYOffset ? 'ON' : 'OFF'}. Re-parsing to apply automatic Y position.`);
    if (window.autoSetYOffset) { /* ... */ } else { /* ... */ }
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
