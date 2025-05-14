
(function() {
    console.log("SVG Module Loader: Checking for required functions...");
    
    if (typeof window.processPathsDirectlyAsync !== 'function') {
        console.warn("SVG Module Loader: processPathsDirectlyAsync not found, creating failsafe version");
        window.processPathsDirectlyAsync = function(options) {
            console.log("Using failsafe processPathsDirectlyAsync");
            setTimeout(() => {
                if (typeof window.processPathsDirectly === 'function') {
                    window.processPathsDirectly(options);
                } else {
                    console.error("Critical error: processPathsDirectly is also missing");
                }
            }, 0);
        };
    }
    
    if (typeof window.processPathsDirectly !== 'function') {
        console.warn("SVG Module Loader: processPathsDirectly not found, creating placeholder");
        window.processPathsDirectly = function(options) {
            console.error("Critical error: Using placeholder processPathsDirectly - SVG processing will not work correctly");
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.classList.add('hidden');
        };
    }
    
    window.SVGProcessing = window.SVGProcessing || {};
    window.SVGProcessing.Core = window.SVGProcessing.Core || {};
    
    if (!window.SVGProcessing.Core.processPathsDirectlyAsync && window.processPathsDirectlyAsync) {
        window.SVGProcessing.Core.processPathsDirectlyAsync = window.processPathsDirectlyAsync;
    }
    
    if (!window.SVGProcessing.Core.processPathsDirectly && window.processPathsDirectly) {
        window.SVGProcessing.Core.processPathsDirectly = window.processPathsDirectly;
    }
    
    console.log("SVG Module Loader: Setup complete");
})();
