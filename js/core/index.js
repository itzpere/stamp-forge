window.SVGProcessing = window.SVGProcessing || {};

window.parseSVGForExtrusion = function(svgText, forImmediateUpdate, qualityFactor, isExport) {
    // console.log("Forwarding to SVG processing module...");
    
    window._pendingSVGProcessingCalls = window._pendingSVGProcessingCalls || [];
    window._pendingSVGProcessingCalls.push({
        fn: 'parseSVGForExtrusion',
        args: [svgText, forImmediateUpdate, qualityFactor, isExport]
    });
    
    if (!window._svgProcessingScriptsLoading) {
        window._svgProcessingScriptsLoading = true;
        loadSVGProcessingScripts();
    }
};

function loadSVGProcessingScripts() {
    const scripts = [
        'js/svg/svgUtilities.js',    // Corrected path
        'js/svg/holeProcessing.js',  // Corrected path
        'js/svg/shapeProcessing.js', // Corrected path
        'js/svg/svgUIIntegration.js',// Corrected path
        'js/svg/svgProcessing.js'    // Corrected path
    ];
    
    let loadedCount = 0;
    function loadNextScript(index) {
        if (index >= scripts.length) {
            // console.log('SVG Processing modules loaded, processing any pending calls');
            if (window._pendingSVGProcessingCalls && window._pendingSVGProcessingCalls.length > 0) {
                window._pendingSVGProcessingCalls.forEach(call => {
                    if (window[call.fn] && typeof window[call.fn] === 'function') {
                        window[call.fn](...call.args);
                    } else {
                        console.error(`Function ${call.fn} not available after loading all scripts`);
                    }
                });
                window._pendingSVGProcessingCalls = [];
            }
            return;
        }
        
        const script = document.createElement('script');
        script.src = scripts[index];
        script.onload = () => {
            loadedCount++;
            loadNextScript(index + 1);
        };
        script.onerror = (err) => {
            console.error(`Failed to load ${scripts[index]}:`, err);
            loadNextScript(index + 1);
        };
        document.head.appendChild(script);
    }
    
    loadNextScript(0);
}
