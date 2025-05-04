// Debounce function to limit frequent updates
function debounce(callback, delay = 300) {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
        callback();
    }, delay);
}

// Schedule progressive rendering to avoid freezing
function scheduleProgressiveRendering() {
    cancelProgressiveRendering(); // Cancel any previous rendering
    
    // Start with low quality
    progressiveQuality = 0.2;
    
    // Schedule the first progressive rendering
    if (lastSvgData) {
        // Run immediate low-quality update
        renderer.shadowMap.enabled = false;
        parseSVGForExtrusion(lastSvgData, true, progressiveQuality);
        
        // Schedule progressively higher quality updates
        progressiveRenderingStep();
    }
}

// Cancel progressive rendering
function cancelProgressiveRendering() {
    if (qualityTransitionTimeout) {
        clearTimeout(qualityTransitionTimeout);
        qualityTransitionTimeout = null;
    }
}

// Step up the quality gradually to avoid freezing
function progressiveRenderingStep() {
    cancelProgressiveRendering();
    
    qualityTransitionTimeout = setTimeout(() => {
        if (!isUserInteracting && lastSvgData) {
            // Gradually increase quality up to the max interactive quality
            progressiveQuality = Math.min(progressiveQuality + 0.2, maxInteractiveQuality);
            
            // Update with current quality level
            parseSVGForExtrusion(lastSvgData, progressiveQuality < maxInteractiveQuality, progressiveQuality);
            
            // If we haven't reached max interactive quality, schedule another update
            if (progressiveQuality < maxInteractiveQuality) {
                progressiveRenderingStep();
            } else {
                // Enable shadows at max interactive quality
                renderer.shadowMap.enabled = true;
                renderer.render(scene, camera);
            }
        }
    }, 100);
}

// Schedule a low-quality update for the initial SVG parsing
function scheduleInitialSVGParsing(svgData) {
    cancelProgressiveRendering(); // Cancel any previous rendering
    
    // Run immediate low-quality update
    renderer.shadowMap.enabled = false;
    parseSVGForExtrusion(svgData, true, 0.2);
}

// Handle window resize
function onWindowResize() {
    const container = document.getElementById('three-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}
