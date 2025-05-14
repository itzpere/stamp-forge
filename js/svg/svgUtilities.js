// Content from original svgUtils.js
window.SVGProcessing = window.SVGProcessing || {};
window.SVGProcessing.Utils = {};

function normalizeSVG(svgText) {
    if (!svgText) return svgText;
    
    // console.log("[normalizeSVG] Normalizing SVG content");
    
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        
        const errorNode = doc.querySelector("parsererror");
        if (errorNode) {
            console.warn("[normalizeSVG] SVG parsing error:", errorNode.textContent);
            return svgText;
        }
        
        const svgRoot = doc.documentElement;
        
        if (!svgRoot.hasAttribute("viewBox") && 
            svgRoot.hasAttribute("width") && 
            svgRoot.hasAttribute("height")) {
            
            const width = parseFloat(svgRoot.getAttribute("width")) || 100;
            const height = parseFloat(svgRoot.getAttribute("height")) || 100;
            
            svgRoot.setAttribute("viewBox", `0 0 ${width} ${height}`);
            // console.log(`[normalizeSVG] Added missing viewBox: 0 0 ${width} ${height}`);
        }
        
        const emptyGroups = Array.from(doc.querySelectorAll("g")).filter(g => 
            g.children.length === 0 && !g.innerHTML.trim()
        );
        
        emptyGroups.forEach(g => {
            g.parentNode.removeChild(g);
        });
        
        if (emptyGroups.length > 0) {
            // console.log(`[normalizeSVG] Removed ${emptyGroups.length} empty groups`);
        }
        
        const pathElements = doc.querySelectorAll("path");
        let fixedPaths = 0;
        
        pathElements.forEach(path => {
            const d = path.getAttribute("d");
            if (d) {
                const fixedD = d.replace(/([0-9])-([0-9])/g, "$1 -$2")
                               .replace(/\s+/g, " ")
                               .replace(/([mlhvcsqtaz])([0-9])/gi, "$1 $2")
                               .trim();
                
                if (fixedD !== d) {
                    path.setAttribute("d", fixedD);
                    fixedPaths++;
                }
            }
        });
        
        if (fixedPaths > 0) {
            // console.log(`[normalizeSVG] Fixed ${fixedPaths} malformed path data strings`);
        }
        
        const nodeIterator = doc.createNodeIterator(
            doc,
            NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_PROCESSING_INSTRUCTION
        );
        
        let currentNode;
        const nodesToRemove = [];
        
        while (currentNode = nodeIterator.nextNode()) {
            nodesToRemove.push(currentNode);
        }
        
        nodesToRemove.forEach(node => {
            node.parentNode.removeChild(node);
        });
        
        if (nodesToRemove.length > 0) {
            // console.log(`[normalizeSVG] Removed ${nodesToRemove.length} comment/processing nodes`);
        }
        
        const serializer = new XMLSerializer();
        const normalizedSvg = serializer.serializeToString(doc);
        
        if (normalizedSvg.includes("<svg")) {
            // console.log("[normalizeSVG] SVG successfully normalized");
            return normalizedSvg;
        } else {
            console.warn("[normalizeSVG] Normalized SVG appears invalid, using original");
            return svgText;
        }
    } catch (error) {
        console.error("[normalizeSVG] Error normalizing SVG:", error);
        return svgText;
    }
}
window.normalizeSVG = normalizeSVG;
window.SVGProcessing.Utils.normalizeSVG = normalizeSVG;

function attemptSVGRecovery(svgText, originalError) {
    console.log("[attemptSVGRecovery] Attempting to recover from SVG parsing error");
    
    if (!svgText) return null;
    
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        
        const errorNode = doc.querySelector("parsererror");
        if (!errorNode) {
            console.log("[attemptSVGRecovery] No XML parsing error detected, can't diagnose further");
            return null;
        }
        
        const errorText = errorNode.textContent || "";
        console.log(`[attemptSVGRecovery] XML error: ${errorText}`);
        
        let fixedSvg = svgText;
        
        if (errorText.includes("unclosed") || errorText.includes("closing tag")) {
            console.log("[attemptSVGRecovery] Attempting to fix unclosed tags");
            
            const basicTags = ["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"];
            
            basicTags.forEach(tag => {
                const openCount = (fixedSvg.match(new RegExp(`<${tag}(?:\\s|>)`, "g")) || []).length;
                const closeCount = (fixedSvg.match(new RegExp(`</${tag}>`, "g")) || []).length;
                
                if (openCount > closeCount) {
                    const missing = openCount - closeCount;
                    const endTagIndex = fixedSvg.lastIndexOf("</svg>");
                    
                    if (endTagIndex > 0) {
                        const tagsToAdd = Array(missing).fill(`</${tag}>`).join("");
                        fixedSvg = fixedSvg.substring(0, endTagIndex) + tagsToAdd + fixedSvg.substring(endTagIndex);
                        console.log(`[attemptSVGRecovery] Added ${missing} missing </${tag}> tags`);
                    }
                }
            });
        }
        
        if (errorText.includes("namespace") || !fixedSvg.includes("xmlns=")) {
            console.log("[attemptSVGRecovery] Attempting to fix namespace issues");
            
            if (!fixedSvg.includes("xmlns=")) {
                fixedSvg = fixedSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
                console.log("[attemptSVGRecovery] Added missing xmlns attribute");
            }
        }
        
        if (errorText.includes("invalid character") || errorText.includes("entityref") || 
            errorText.includes("not well-formed")) {
            console.log("[attemptSVGRecovery] Attempting to fix invalid characters");
            
            fixedSvg = fixedSvg.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/g, "&amp;")
                             .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
            
            console.log("[attemptSVGRecovery] Sanitized invalid characters");
        }
        
        if (errorText.includes("attribute") || fixedSvg.includes("style=")) {
            const styleRegex = /style=([^"'][^ >]*)/g;
            let match;
            let fixedCount = 0;
            
            while (match = styleRegex.exec(fixedSvg)) {
                const badStyle = match[0];
                const styleContent = match[1];
                const fixedStyle = `style="${styleContent}"`;
                
                fixedSvg = fixedSvg.replace(badStyle, fixedStyle);
                fixedCount++;
            }
            
            if (fixedCount > 0) {
                console.log(`[attemptSVGRecovery] Fixed ${fixedCount} unquoted style attributes`);
            }
        }
        
        const fixedDoc = parser.parseFromString(fixedSvg, "image/svg+xml");
        if (!fixedDoc.querySelector("parsererror")) {
            console.log("[attemptSVGRecovery] SVG successfully recovered!");
            return fixedSvg;
        } else {
            console.log("[attemptSVGRecovery] Recovery unsuccessful, returning original SVG");
            return svgText;
        }
        
    } catch (error) {
        console.error("[attemptSVGRecovery] Error during recovery attempt:", error);
        return svgText;
    }
}
window.attemptSVGRecovery = attemptSVGRecovery;
window.SVGProcessing.Utils.attemptSVGRecovery = attemptSVGRecovery;

function createPathFromSVGData(d) {
    if (!d) return null;
    
    try {
        const svgNS = "http://www.w3.org/2000/svg";
        const svgDoc = document.implementation.createDocument(svgNS, "svg", null);
        const tempPath = svgDoc.createElementNS(svgNS, "path");
        tempPath.setAttribute("d", d);
        
        const svgString = `<svg xmlns="${svgNS}"><path d="${d}"/></svg>`;
        const loader = new THREE.SVGLoader();
        const parsedData = loader.parse(svgString);
        
        if (parsedData.paths && parsedData.paths.length > 0) {
            return parsedData.paths[0];
        }
        
        return null;
    } catch (error) {
        console.error("[createPathFromSVGData] Error creating path from data:", error);
        return null;
    }
}
window.createPathFromSVGData = createPathFromSVGData;
window.SVGProcessing.Utils.createPathFromSVGData = createPathFromSVGData;

function getElementColor(element) {
    if (!element) return new THREE.Color(0x000000);
    
    const fill = element.getAttribute("fill");
    if (fill && fill !== "none") {
        try {
            return new THREE.Color(fill);
        } catch (e) {
            // Ignore color parsing errors
        }
    }
    
    const style = element.getAttribute("style");
    if (style) {
        const fillMatch = style.match(/fill:\s*([^;]+)/);
        if (fillMatch && fillMatch[1] !== "none") {
            try {
                return new THREE.Color(fillMatch[1]);
            } catch (e) {
                // Ignore color parsing errors
            }
        }
    }
    
    const stroke = element.getAttribute("stroke");
    if (stroke && stroke !== "none") {
        try {
            return new THREE.Color(stroke);
        } catch (e) {
            // Ignore color parsing errors
        }
    }
    
    return new THREE.Color(0x000000);
}
window.getElementColor = getElementColor;
window.SVGProcessing.Utils.getElementColor = getElementColor;

function samplePointsFromSubPath(subPath, divisions = 10) {
    const adjustedDivisions = Math.max(3, Math.round(divisions * (window.svgResolution || 1.0))); // Added fallback for svgResolution
    const points = [];
    
    if (!subPath || !subPath.curves) return points;
    
    subPath.curves.forEach(curve => {
        try {
            const curvePoints = curve.getPoints(adjustedDivisions);
            points.push(...curvePoints);
        } catch (error) {
            console.warn("Error sampling points from curve:", error);
            if (curve.v1 && curve.v2) {
                points.push(curve.v1, curve.v2);
            } else if (curve.v0 && curve.v1) {
                points.push(curve.v0, curve.v1);
            }
        }
    });
    
    return points;
}
window.samplePointsFromSubPath = samplePointsFromSubPath;
window.SVGProcessing.Utils.samplePointsFromSubPath = samplePointsFromSubPath;

function logSvgTagStructure(svgText) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        
        const errorNode = doc.querySelector("parsererror");
        if (errorNode) {
            console.warn("SVG parsing error:", errorNode.textContent);
            return;
        }
        
        const svgRoot = doc.documentElement;
        
        const width = svgRoot.getAttribute('width');
        const height = svgRoot.getAttribute('height');
        const viewBox = svgRoot.getAttribute('viewBox');
        
        const childTagCounts = {};
        for (let i = 0; i < svgRoot.children.length; i++) {
            const tagName = svgRoot.children[i].tagName;
            childTagCounts[tagName] = (childTagCounts[tagName] || 0) + 1;
        }
        
        const allElementCounts = {};
        const allElements = svgRoot.getElementsByTagName("*");
               for (let i = 0; i < allElements.length; i++) {
            const tagName = allElements[i].tagName;
            allElementCounts[tagName] = (allElementCounts[tagName] || 0) + 1;
        }
        
        console.log(`  SVG root attributes: width=${width}, height=${height}, viewBox=${viewBox}`);
        console.log(`  Direct children:`, childTagCounts);
        console.log(`  All elements:`, allElementCounts);
        
        const pathElements = svgRoot.getElementsByTagName('path');
        if (pathElements.length > 0) {
            console.log(`  Contains ${pathElements.length} path elements`);
            
            if (pathElements[0]) {
                const pathD = pathElements[0].getAttribute('d');
                if (pathD) {
                    console.log(`  Sample path data: ${pathD.substring(0, 100)}${pathD.length > 100 ? '...' : ''}`);
                }
            }
        } else {
            console.log(`  No path elements found - SVG may not extrude properly`);
        }
        
    } catch (e) {
        console.error("Error analyzing SVG structure:", e);
    }
}
window.logSvgTagStructure = logSvgTagStructure;
window.SVGProcessing.Utils.logSvgTagStructure = logSvgTagStructure;

// Consolidated calculateShapeArea function
// Expects a shape-like object with a getPoints(divisions) method
function calculateShapeArea(shape, divisions = 24) {
    if (!shape || typeof shape.getPoints !== 'function') {
        console.warn("[calculateShapeArea] Invalid shape object provided.");
        return 0;
    }
    try {
        const points = shape.getPoints(divisions);
        if (points.length < 3) return 0;
        
        let area = 0;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
        }
        return Math.abs(area / 2);
    } catch (e) {
        console.error("[calculateShapeArea] Error calculating shape area:", e);
        return 0;
    }
}
window.calculateShapeArea = calculateShapeArea;
window.SVGProcessing.Utils.calculateShapeArea = calculateShapeArea;


// Content from original svgPreprocessingUtils.js
window.SVGPreprocessingUtils = {
    preprocessSVGText: function(svgText) {
        if (!svgText) return svgText;
        
        console.log("[SVGPreprocessing] Starting SVG preprocessing");
        
        let result = svgText;
        result = this.removeMetadata(result);
        result = this.fixNamespaces(result);
        result = this.convertNonPathElements(result);
        result = this.simplifyGroups(result);
        result = this.fixInconsistentWinding(result);
        
        console.log("[SVGPreprocessing] Preprocessing complete");
        return result;
    },
    
    removeMetadata: function(svgText) {
        return svgText.replace(/<metadata>[\s\S]*?<\/metadata>/g, "");
    },
    
    fixNamespaces: function(svgText) {
        if (!svgText.includes('xmlns="http://www.w3.org/2000/svg"')) {
            svgText = svgText.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        return svgText;
    },
    
    convertNonPathElements: function(svgText) {
        console.log("[SVGPreprocessing] Note: non-path conversion is not fully implemented");
        return svgText;
    },
    
    simplifyGroups: function(svgText) {
        return svgText.replace(/<g[^>]*>\s*<\/g>/g, "");
    },
    
    fixInconsistentWinding: function(svgText) {
        console.log("[SVGPreprocessing] Checking for complex path patterns (eyes, etc.)");
        
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, "image/svg+xml");
            
            const error = doc.querySelector("parsererror");
            if (error) {
                console.error("[SVGPreprocessing] XML parsing error:", error.textContent);
                return svgText;
            }
            
            const allPaths = doc.querySelectorAll("path");
            console.log(`[SVGPreprocessing] Found ${allPaths.length} paths to analyze`);
            
            // Only perform special path handling for specific patterns
            if (allPaths.length === 2) {
                const path1D = allPaths[0].getAttribute('d');
                const path2D = allPaths[1].getAttribute('d');
                
                if (path1D && path2D) {
                    const path1Length = path1D.length;
                    const path2Length = path2D.length;
                    
                    // More conservative approach - only reverse if the size difference is extreme
                    // and if both paths have significant complexity (more likely to be facial features)
                    const significantSizeDifference = path1Length > path2Length * 3 || path2Length > path1Length * 3;
                    const bothPathsComplex = path1Length > 100 && path2Length > 50;
                    const hasEllipticalCommands = (path1D.includes('A') || path2D.includes('A'));
                    
                    // For bowl-like shapes, typically they don't have elliptical arc commands
                    // and the smaller shape (base) is a legitimate separate shape, not a hole
                    if (significantSizeDifference && bothPathsComplex && hasEllipticalCommands) {
                        console.log("[SVGPreprocessing] Detected potential face features - modifying path");
                        
                        // Only reverse the smaller path if it meets our stricter criteria
                        if (path1Length > path2Length * 3) {
                            return svgText.replace(path2D, this.reversePath(path2D));
                        } 
                        else if (path2Length > path1Length * 3) {
                            return svgText.replace(path1D, this.reversePath(path1D));
                        }
                    } else {
                        // This is likely a legitimate multi-part object like a bowl with a base
                        console.log("[SVGPreprocessing] Multiple paths detected but appear to be separate components - not modifying");
                    }
                }
            }
            
            return svgText;
            
        } catch (e) {
            console.error("[SVGPreprocessing] Error in winding order analysis:", e);
            return svgText;
        }
    },
    
    reversePath: function(pathD) {
        console.log("[SVGPreprocessing] Attempting to reverse path direction");
        const commands = pathD.match(/[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g) || [];
        if (commands.length < 2) return pathD;
        
        let result = commands[0]; 
        
        for (let i = commands.length - 1; i > 0; i--) {
            if (i === commands.length - 1 && commands[i].trim().toUpperCase() === 'Z') continue;
            result += commands[i];
        }
        
        if (!result.trim().endsWith('Z') && !result.trim().endsWith('z')) {
            result += 'Z';
        }
        
        console.log("[SVGPreprocessing] Path reversed.");
        return result;
    }
};

function splitDisjointSubpathsInSVG(svgText) {
    if (!svgText) return svgText;
    // console.log("[splitDisjointSubpathsInSVG] Attempting to split multi-subpath <path> elements.");

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const svgRoot = doc.documentElement;

        if (doc.querySelector("parsererror")) {
            console.warn("[splitDisjointSubpathsInSVG] SVG parsing error, skipping split.");
            return svgText;
        }

        const pathsToProcess = Array.from(svgRoot.querySelectorAll("path"));
        let pathsSplitCount = 0;

        pathsToProcess.forEach(originalPathElement => {
            const dAttribute = originalPathElement.getAttribute("d");
            if (!dAttribute || dAttribute.trim() === "") return;

            // Regex to find segments starting with M or m.
            // Each segment is a subpath according to SVG spec.
            const subpathStrings = dAttribute.match(/[mM][^mM]*/g);

            if (subpathStrings && subpathStrings.length > 1) {
                // console.log(`[splitDisjointSubpathsInSVG] Path has ${subpathStrings.length} subpaths. Splitting.`);
                const parent = originalPathElement.parentNode;
                if (!parent) return;

                subpathStrings.forEach(sub_d => {
                    sub_d = sub_d.trim();
                    if (sub_d === "") return;

                    const newPathElement = doc.createElementNS(svgRoot.namespaceURI, "path");
                    newPathElement.setAttribute("d", sub_d);

                    // Copy attributes from original path to new path
                    // Avoid copying 'd' and 'id' to prevent conflicts or ensure uniqueness if needed later.
                    for (let i = 0; i < originalPathElement.attributes.length; i++) {
                        const attr = originalPathElement.attributes[i];
                        if (attr.name !== "d" && attr.name !== "id") {
                            newPathElement.setAttribute(attr.name, attr.value);
                        }
                    }
                    parent.insertBefore(newPathElement, originalPathElement);
                });
                parent.removeChild(originalPathElement);
                pathsSplitCount++;
            }
        });

        if (pathsSplitCount > 0) {
            // console.log(`[splitDisjointSubpathsInSVG] Split ${pathsSplitCount} <path> element(s) into multiple simpler paths.`);
            const serializer = new XMLSerializer();
            return serializer.serializeToString(doc);
        } else {
            // console.log("[splitDisjointSubpathsInSVG] No paths needed splitting.");
            return svgText;
        }

    } catch (error) {
        console.error("[splitDisjointSubpathsInSVG] Error during path splitting:", error);
        return svgText; // Return original on error
    }
}
// Add to SVGProcessing.Utils namespace
window.SVGProcessing = window.SVGProcessing || {};
window.SVGProcessing.Utils = window.SVGProcessing.Utils || {};
window.SVGProcessing.Utils.splitDisjointSubpathsInSVG = splitDisjointSubpathsInSVG;

function shouldCheckForUnconvertedShapes(svgText) {
    if (!svgText || typeof svgText !== 'string') {
        return false;
    }
    // Simple check for common non-path shape elements
    const nonPathTags = /<\s*(circle|rect|ellipse|line|polyline|polygon)[^>]*>/i;
    return nonPathTags.test(svgText);
}
window.SVGProcessing.Utils.shouldCheckForUnconvertedShapes = shouldCheckForUnconvertedShapes;


// Content from original svgOptimizer.js
window.SVGProcessing = window.SVGProcessing || {};
window.SVGProcessing.Optimizer = {};

// Fallback SVGO-like optimizer if the full SVGO library isn't loaded/integrated
async function optimizeSVG(svgString) {
    // console.log("Using internal SVG optimizer (SVGO not available)");
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, "image/svg+xml");
        const svgElement = doc.documentElement;

        // Remove comments
        const commentsToRemove = [];
        const treeWalker = doc.createTreeWalker(svgElement, NodeFilter.SHOW_COMMENT, null, false);
        let currentNode;
        while (currentNode = treeWalker.nextNode()) {
            commentsToRemove.push(currentNode);
        }
        commentsToRemove.forEach(commentNode => {
            if (commentNode.parentNode) {
                commentNode.parentNode.removeChild(commentNode);
            }
        });

        // Remove empty <g> elements
        const gElements = Array.from(svgElement.querySelectorAll("g"));
        gElements.reverse().forEach(g => { // Reverse to handle nested empty groups
            if (!g.children.length && !g.textContent.trim()) {
                if (g.parentNode) g.parentNode.removeChild(g);
            }
        });
        
        // Remove unnecessary attributes (example)
        const elements = Array.from(svgElement.querySelectorAll("*"));
        elements.forEach(el => {
            el.removeAttribute("id"); // Example: remove all IDs if not needed for styling/scripting
            // Add more attribute removals here if necessary
        });

        // Convert shapes to paths (simplified example - this is complex)
        // For a real replacement, you'd need a library or more extensive logic
        // This part is highly dependent on what SVGO does for your specific needs

        const serializer = new XMLSerializer();
        let optimizedSvgString = serializer.serializeToString(doc);
        
        // Basic minification: remove extra whitespace
        optimizedSvgString = optimizedSvgString.replace(/>\s+</g, '><').trim();

        // console.log("Internal SVG optimization applied.");
        return optimizedSvgString;
    } catch (error) {
        console.error("Error in internal SVG optimizer:", error);
        // It's crucial to return the original string on error to not break the chain
        return svgString; 
    }
}
window.optimizeSVG = optimizeSVG; // Ensure it's globally available if called directly
window.SVGProcessing.Optimizer.optimizeSVG = optimizeSVG;

// Make SVGOptimizer point to the internal one if the full library isn't loaded
if (!window.SVGOptimizer || !window.SVGOptimizer.optimizeSVG) {
    window.SVGOptimizer = window.SVGOptimizer || {};
    window.SVGOptimizer.optimizeSVG = optimizeSVG;
}

// console.log("SVG Utilities (combined: Utils, Preprocessing, Optimizer) loaded successfully");
