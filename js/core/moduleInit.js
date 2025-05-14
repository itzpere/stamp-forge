(function() {
    window.SVG = window.SVG || {};
    
    if (typeof window.parseSVGForExtrusion === 'function') {
        window.SVG.parseSVGForExtrusion = window.parseSVGForExtrusion;
    }
    
    if (typeof window.processPathsDirectly === 'function') {
        window.SVG.processPathsDirectly = window.processPathsDirectly;
    }
    
    if (typeof window.processPathsDirectlyAsync === 'function') {
        window.SVG.processPathsDirectlyAsync = window.processPathsDirectlyAsync;
    }
})();
