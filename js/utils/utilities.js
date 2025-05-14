function debounce(callback, delay = 300) {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(callback, delay);
}

function scheduleProgressiveRendering() {
    cancelProgressiveRendering();
    
    progressiveQuality = 0.2;
    
    if (lastSvgData) {
        renderer.shadowMap.enabled = false;
        parseSVGForExtrusion(lastSvgData, true, progressiveQuality);
        
        progressiveRenderingStep();
    }
}

function cancelProgressiveRendering() {
    if (qualityTransitionTimeout) {
        clearTimeout(qualityTransitionTimeout);
        qualityTransitionTimeout = null;
    }
}

function progressiveRenderingStep() {
    cancelProgressiveRendering();
    
    qualityTransitionTimeout = setTimeout(() => {
        if (!isUserInteracting && lastSvgData) {
            progressiveQuality = Math.min(progressiveQuality + 0.2, maxInteractiveQuality);
            parseSVGForExtrusion(lastSvgData, progressiveQuality < maxInteractiveQuality, progressiveQuality);
            
            if (progressiveQuality < maxInteractiveQuality) {
                progressiveRenderingStep();
            } else {
                renderer.shadowMap.enabled = true;
                renderer.render(scene, camera);
            }
        }
    }, 100);
}

function onWindowResize() {
    const container = document.getElementById('three-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}
