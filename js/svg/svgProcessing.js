if (window.svgProcessingInitialized) {
    // Script already initialized, functions should be available.
    // console.log("svgProcessing.js already initialized.");
} else {
    window.svgProcessingInitialized = true;

    let startTime; // Declare startTime

    window.SVGProcessing = window.SVGProcessing || {};
    window.SVGProcessing.Core = {};

    // Add to global settings
    window.svgGlobalSettings = window.svgGlobalSettings || {};
    window.svgGlobalSettings.processing = window.svgGlobalSettings.processing || {
        pointFilterThreshold: 0.0001,
        lowQualityPathLimit: 20,
        lowQualityPathMin: 5,
        zeroAreaThreshold: 0.0001, // Same as holeValidation for consistency
        holeAreaFactor: 0.9 // Factor to identify potential holes by area
    };

    function processPathsDirectlyAsync(options) {
        setTimeout(() => processPathsDirectly(options), 0);
    }
    window.processPathsDirectlyAsync = processPathsDirectlyAsync;
    window.SVGProcessing.Core.processPathsDirectlyAsync = processPathsDirectlyAsync;

    function processPathsDirectly(options) {
        startTime = performance.now();
        const settings = window.svgGlobalSettings;
        
        // Ensure window.config and its properties are available
        const currentConfig = window.config || {};
        const defaultOperation = currentConfig.defaultShapeOperation || 'extrude';
        const currentHoleSettings = currentConfig.holeDetectionSettings || { aggressiveness: 0.7, areaRatioThreshold: 0.5, pointsInsideThreshold: 0.6 };

        const { pathsToProcess, svgCenterX, svgCenterY, effectiveScale, lowQuality, isExport } = options;
        const totalPaths = pathsToProcess.length;
        
        let stats = {
            extrusionsMade: 0,
            totalHoles: 0,
            validatedHoles: 0,
            shapesWithHoles: 0
        };
        
        try {
            console.log(`Processing SVG with ${totalPaths} paths at scale ${effectiveScale.toFixed(4)}`);
            
            // Initial pre-processing to identify potential holes
            let allShapes = []; // Changed from const to let
            const allPaths = [];
            
            const samplingKey = isExport ? 'detailed' : 'default';
            const holeAreaFactor = settings.processing.holeAreaFactor || 0.9;

            // First pass - collect all shapes from all paths
            for (let i = 0; i < totalPaths; i++) {
                const path = pathsToProcess[i];
                try {
                    const shapes = path.toShapes(svgAssumeCCW);
                    if (shapes.length > 0) {
                        shapes.forEach((shape, shapeIndex) => {
                            allShapes.push({
                                pathIndex: i,
                                shapeIndex: shapeIndex,
                                shape: shape,
                                area: window.SVGProcessing.Utils.calculateShapeArea(shape, settings.pointSampling.getPoints(samplingKey))
                            });
                        });
                        allPaths.push(path);
                    } else {
                        console.log(`Path[${i}] produced no shapes. Skipping.`);
                    }
                } catch (pathError) {
                    console.error(`Error pre-processing path[${i}]:`, pathError);
                }
            }
            
            console.log(`Pre-processed ${allShapes.length} shapes from ${allPaths.length} paths`);

            // Filter out duplicate shapes
            const uniqueShapes = [];
            const seenShapeSignatures = new Set();
            const detailedSamplingForSignature = settings.pointSampling.getPoints('detailed'); // For signature generation
            
            for (const shapeInfo of allShapes) {
                const points = shapeInfo.shape.getPoints(detailedSamplingForSignature);
                if (points.length === 0) { // Skip empty shapes that might not produce a signature
                    console.log(`Skipping an empty shape (PathIndex: ${shapeInfo.pathIndex}, ShapeIndex: ${shapeInfo.shapeIndex}) during duplicate filtering.`);
                    continue;
                }
            
                // Create a signature for the shape based on its points
                // Simple signature: concatenate x,y coordinates with a fixed precision
                const signature = points.map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(';');
                
                if (!seenShapeSignatures.has(signature)) {
                    seenShapeSignatures.add(signature);
                    uniqueShapes.push(shapeInfo);
                } else {
                    console.log(`Filtered out a duplicate shape (PathIndex: ${shapeInfo.pathIndex}, ShapeIndex: ${shapeInfo.shapeIndex}, Area: ${shapeInfo.area.toFixed(4)})`);
                }
            }
            // Replace allShapes with the filtered list
            const originalShapeCount = allShapes.length;
            allShapes = uniqueShapes; // Correctly reassign the local allShapes variable
            // window.allShapes = uniqueShapes; // This can be kept if global access is needed for debugging
            
            if (allShapes.length !== originalShapeCount) {
                console.log(`Filtered from ${originalShapeCount} to ${allShapes.length} unique shapes.`);
            }
            
            // Sort shapes by area (largest first) to help with hole detection
            allShapes.sort((a, b) => b.area - a.area);
            
            // Container for shapes we've processed
            const processedShapeIndices = new Set();
            
            // Process shapes largest to smallest (helps with hole detection)
            for (let i = 0; i < allShapes.length; i++) {
                if (processedShapeIndices.has(i)) continue;
                
                const shapeInfo = allShapes[i];
                const shape = shapeInfo.shape;
                processedShapeIndices.add(i);
                
                const pointsOuter = shape.getPoints(settings.pointSampling.getPoints(samplingKey));
                const transformedOuterPoints = pointsOuter.map(p => new THREE.Vector2(
                    (p.x - svgCenterX) * effectiveScale,
                    (p.y - svgCenterY) * -effectiveScale
                ));
                
                // Create the shape with the transformed points
                const finalShape = new THREE.Shape(transformedOuterPoints);
                finalShape.holes = [];
                
                // Look for potential holes in this shape (smaller shapes that are inside this one)
                for (let j = 0; j < allShapes.length; j++) {
                    if (processedShapeIndices.has(j) || i === j) continue;
                    
                    const potentialHole = allShapes[j];
                    const holeShape = potentialHole.shape;
                    
                    // Check if this smaller shape might be a hole
                    if (potentialHole.area < shapeInfo.area * holeAreaFactor) { // Use configurable factor
                        // Try to validate it as a hole using the global validateHole
                        const holeValidatedPath = window.SVGProcessing.Holes.validateHole(holeShape, finalShape, svgCenterX, svgCenterY, effectiveScale);
                        if (holeValidatedPath) {
                            finalShape.holes.push(holeValidatedPath);
                            processedShapeIndices.add(j); // Mark hole as processed
                            stats.validatedHoles++;
                            console.log(`Added shape ${j} as hole in shape ${i}`);
                        }
                    }
                }
                
                // Create the extruded shape only if it's not a hole in a larger shape
                if (finalShape.holes.length > 0) {
                    stats.shapesWithHoles++;
                }
                
                const mesh = createExtrudedShape(finalShape, effectiveScale, lowQuality);
                stats.extrusionsMade++;
                
                const shapeId = window.shapeColorCounter - 1;                
                // Update shape info
                const shapeInfo2 = window.shapeRenderInfo.find(info => info.id === shapeId);
                if (shapeInfo2) {
                    shapeInfo2.originalPath = {
                        pathIndex: shapeInfo.pathIndex, // This might be 'i' from the outer loop if shapeInfo is from allShapes
                        shapeIndex: shapeInfo.shapeIndex, // This might be 'i' if shapeInfo is directly from allShapes
                        svgCenterX, svgCenterY, effectiveScale
                    };
                    shapeInfo2.useReversedWinding = false; // Default, can be changed by UI
                    
                    // Initialize operationType from global config default
                    shapeInfo2.operationType = defaultOperation;
                    
                    // If it's a hole that was part of finalShape.holes, it should be subtract
                    // This logic needs refinement: if finalShape itself IS a hole of something larger, it's subtract.
                    // If finalShape CONTAINS holes, those contained holes (processed separately) are subtract.
                    // For now, rely on the shapeListUI to toggle and processHolesAsShapes to mark.
                    // If this shape (finalShape) was identified as a hole of another, it should be 'subtract'.
                    // This part of logic is tricky with the current loop structure.
                    // Let's assume for now that if a shape is explicitly made from a "hole" path, it's subtract.
                    // And other shapes get the default.

                    if (finalShape.holes.length > 0) {
                        stats.shapesWithHoles++;
                        stats.validatedHoles += finalShape.holes.length;
                        // The actual hole shapes are processed by processHolesAsShapes or similar
                    }

                    // Initial visibility based on operation type
                    if (mesh) {
                        mesh.visible = shapeInfo2.isVisible && (shapeInfo2.operationType !== 'subtract');
                    }
                }
            }
            
            console.log(`SVG processing stats: Created ${stats.extrusionsMade} extrusions, processed ${stats.totalHoles} potential holes, validated ${stats.validatedHoles} holes in ${stats.shapesWithHoles} shapes.`);
            
        } catch (error) {
            console.error(`Unexpected error during processing:`, error);
        }
        
        if (!isExport) {
            if (document.getElementById('loading')) {
                document.getElementById('loading').classList.add('hidden');
            }
            if (typeof populateShapeList === 'function') {
                populateShapeList();
            }
        }
    }
    window.processPathsDirectly = processPathsDirectly;
    window.SVGProcessing.Core.processPathsDirectly = processPathsDirectly;

    function parseSVGForExtrusion(svgText, forImmediateUpdate = false, qualityFactor = 1.0, isExport = false) {
        startTime = performance.now();
        const settings = window.svgGlobalSettings;
        
        let lowQuality = forImmediateUpdate;

        if (isExport) {
            lowQuality = false;
            qualityFactor = 1.0; 
        }

        if (autoSetYOffset && !isExport) {
            const currentExtrusionHeight = (typeof extrusionHeight === 'number' && extrusionHeight > 0) ? extrusionHeight : 0;
            extrusionPosition.y = currentExtrusionHeight / 2;
            if (typeof updateExtrusionYUI === 'function') {
                updateExtrusionYUI(extrusionPosition.y);
            }
            // console.log(`[parseSVGForExtrusion] Auto Y offset is ON. Set extrusionPosition.y to ${extrusionPosition.y.toFixed(2)} (based on extrusionHeight: ${currentExtrusionHeight.toFixed(2)}).`);
        }

        // console.log(`[parseSVGForExtrusion] Entered. lowQuality: ${lowQuality}, qualityFactor: ${qualityFactor}, isExporting: ${isExport}`);
        // console.log(`[parseSVGForExtrusion] Current extrusionPosition: X=${extrusionPosition.x}, Y=${extrusionPosition.y}, Z=${extrusionPosition.z}`);
        // console.log(`[parseSVGForExtrusion] Initial isHighQualityMode: ${isHighQualityMode}`);
        // console.log(`[parseSVGForExtrusion] Initial brickDimensions: W=${brickDimensions.width}, H=${brickDimensions.height}, D=${brickDimensions.depth}`);
        // console.log(`[parseSVGForExtrusion] Initial global svgScaleFactor: ${svgScaleFactor}`);
        // console.log(`[parseSVGForExtrusion] SVG Data Length: ${svgText ? svgText.length : 'null or undefined'}`);

        window.shapeRenderInfo = []; 
        window.shapeColorCounter = 0; // Initialize shapeColorCounter
        // console.log(`[DEBUG parseSVGForExtrusion] After RE-INITIALIZING, window.shapeRenderInfo length: ${window.shapeRenderInfo.length}, Content: ${JSON.stringify(window.shapeRenderInfo)}`);

        if (typeof populateShapeList === 'function') {
            populateShapeList();
        }

        if (isHighQualityMode && !isExport) {
            console.log("[parseSVGForExtrusion] Exiting: In high quality mode but not exporting.");
            return;
        }
        
        if (isExport) {
            qualityFactor = 1.0;
        }
        
        if (!extrudedGroup) {
            console.warn("extrudedGroup not initialized, creating it now");
            extrudedGroup = new THREE.Group();
            extrudedGroup.position.set(0, 0, 0);
            extrudedGroup.rotation.set(0, 0, 0);
            extrudedGroup.scale.set(1, 1, 1);
            scene.add(extrudedGroup);
        }
        
        // console.log("[parseSVGForExtrusion] Proceeding with full SVG processing (clearing and regenerating extrusions).");
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
        
        extrudedGroup.userData.lastHeight = extrusionHeight;
        
        if (!isExport) {
            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('loading').textContent = 'Processing SVG...';
        }

        try {
            // console.log(`[parseSVGForExtrusion] SVG text length: ${svgText?.length || 0} bytes`);
            if (!svgText) {
                throw new Error("SVG text is empty or undefined");
            }
            
            // console.log(`[parseSVGForExtrusion] SVG text preview: ${svgText.substring(0, 100)}${svgText.length > 100 ? '...' : ''}`);
            
            if (window.SVGOptimizer && typeof window.SVGOptimizer.optimizeSVG === 'function') {
                try {
                    // console.log("[parseSVGForExtrusion] Optimizing SVG with SVGO...");
                    window.SVGOptimizer.optimizeSVG(svgText)
                        .then(optimizedSvg => {
                            processSVGWithLoader(optimizedSvg);
                        })
                        .catch(optimizeError => {
                            console.error("[parseSVGForExtrusion] SVG optimization failed:", optimizeError);
                            processSVGWithLoader(svgText);
                        });
                    return;
                } catch (optimizerError) {
                    console.warn("[parseSVGForExtrusion] SVG Optimizer failed, falling back to direct processing:", optimizerError);
                    processSVGWithLoader(svgText);
                }
            } else {
                // console.log("[parseSVGForExtrusion] SVG Optimizer not available, using basic normalization");
                const normalizedSvg = normalizeSVG(svgText);
                processSVGWithLoader(normalizedSvg);
            }
            
            function processSVGWithLoader(processedSvgText) {
                // Attempt to split complex paths into simpler ones
                if (window.SVGProcessing && window.SVGProcessing.Utils && typeof window.SVGProcessing.Utils.splitDisjointSubpathsInSVG === 'function') {
                    // console.log("[parseSVGForExtrusion] Attempting to split disjoint subpaths before loading.");
                    processedSvgText = window.SVGProcessing.Utils.splitDisjointSubpathsInSVG(processedSvgText);
                } else {
                    // console.log("[parseSVGForExtrusion] splitDisjointSubpathsInSVG function not available.");
                }

                const loader = new THREE.SVGLoader();
                
                // console.log("[parseSVGForExtrusion] Parsing SVG data with SVGLoader...");
                
                let svgParsedData;
                try {
                    svgParsedData = loader.parse(processedSvgText);
                } catch (parseError) {
                    console.error("[parseSVGForExtrusion] SVG parsing error:", parseError);
                    
                    const recoveredSvg = attemptSVGRecovery(processedSvgText, parseError);
                    if (recoveredSvg && recoveredSvg !== processedSvgText) {
                        console.log("[parseSVGForExtrusion] Attempting to parse recovered SVG");
                        try {
                            svgParsedData = loader.parse(recoveredSvg);
                            console.log("[parseSVGForExtrusion] Recovery successful!");
                        } catch (secondError) {
                            console.error("[parseSVGForExtrusion] Recovery failed:", secondError);
                        }
                    }
                    
                    if (!svgParsedData) {
                        if (parseError.message && parseError.message.includes("getElementById")) {
                            throw new Error("SVG parsing failed: SVG contains unresolved references (ids). Please simplify the SVG.");
                        } else if (processedSvgText.includes("xlink:href")) {
                            throw new Error("SVG parsing failed: SVG contains linked elements which may not be supported. Please embed all elements.");
                        } else {
                            throw new Error(`SVG parsing failed: ${parseError.message}`);
                        }
                    }
                }
                
                const paths = svgParsedData.paths;
                
                // console.log(`[parseSVGForExtrusion] SVGLoader found ${paths.length} paths in the SVG`);
                
                if (paths.length > 0) {
                    // console.log("[parseSVGForExtrusion] Path details:");
                    paths.forEach((path, index) => {
                        const subPathCount = path.subPaths?.length || 0;
                        const totalCurves = path.subPaths?.reduce((sum, subPath) => sum + (subPath.curves?.length || 0), 0) || 0;
                        
                        // console.log(`  Path[${index}]: ${subPathCount} subpaths, ${totalCurves} total curves, color: ${path.color ? '#' + path.color.getHexString() : 'none'}`);
                        
                        if (path.subPaths && path.subPaths.length > 0 && path.subPaths[0].curves) {
                            const firstSubPath = path.subPaths[0];
                            const curveTypes = {};
                            
                            firstSubPath.curves.forEach(curve => {
                                const type = curve.type || curve.constructor.name;
                                curveTypes[type] = (curveTypes[type] || 0) + 1;
                            });
                            
                            // console.log(`    First subpath: ${firstSubPath.curves.length} curves, types: ${JSON.stringify(curveTypes)}`);
                        }
                    });
                }
                
                if (paths.length === 0) {
                    console.warn("[parseSVGForExtrusion] No paths found in SVG by SVGLoader.");
                    console.log("[parseSVGForExtrusion] SVG DOM structure analysis:");
                    try {
                        const parser = new DOMParser();
                        const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
                        const errorNode = svgDoc.querySelector("parsererror");
                        
                        if (errorNode) {
                            console.error("[parseSVGForExtrusion] XML parse error:", errorNode.textContent);
                            throw new Error("SVG contains XML parsing errors");
                        }
                        
                        const svgElement = svgDoc.querySelector("svg");
                        if (!svgElement) {
                            console.error("[parseSVGForExtrusion] No SVG element found in document");
                            throw new Error("No SVG element found in document");
                        }
                        
                        const elements = {
                            paths: svgDoc.querySelectorAll("path").length,
                            circles: svgDoc.querySelectorAll("circle").length,
                            rects: svgDoc.querySelectorAll("rect").length,
                            lines: svgDoc.querySelectorAll("line").length,
                            polys: svgDoc.querySelectorAll("polygon, polyline").length,
                            groups: svgDoc.querySelectorAll("g").length
                        };
                        
                        console.log("[parseSVGForExtrusion] SVG elements count:", elements);
                        
                        if (elements.paths === 0 && 
                            (elements.circles > 0 || elements.rects > 0 || elements.lines > 0 || elements.polys > 0)) {
                            throw new Error("SVG contains elements but no paths. SVGLoader only supports path elements directly. Try converting to paths.");
                        }
                    } catch (domError) {
                        console.error("[parseSVGForExtrusion] Error analyzing SVG DOM:", domError);
                        throw new Error(`No paths found in SVG. Error: ${domError.message}`);
                    }
                    
                    showMessage("No paths found in SVG. The file may be empty or use unsupported elements.");
                    document.getElementById('loading').classList.add('hidden');
                    return;
                }
                
                let svgMinX = Infinity, svgMinY = Infinity, svgMaxX = -Infinity, svgMaxY = -Infinity;

                paths.forEach(path => {
                    path.subPaths.forEach(subPath => {
                        const points = samplePointsFromSubPath(subPath); 
                        
                        points.forEach(point => {
                            if (!point) return;
                            svgMinX = Math.min(svgMinX, point.x);
                            svgMinY = Math.min(svgMinY, point.y);
                            svgMaxX = Math.max(svgMaxX, point.x);
                            svgMaxY = Math.max(svgMaxY, point.y);
                        });
                    });
                });
                
                // console.log(`Original SVG Bounds: (${svgMinX.toFixed(2)}, ${svgMinY.toFixed(2)}) to (${svgMaxX.toFixed(2)}, ${svgMaxY.toFixed(2)})`);
                
                const svgWidth = svgMaxX - svgMinX;
                const svgHeight = svgMaxY - svgMinY;

                if (svgWidth === 0 || svgHeight === 0 || !isFinite(svgWidth) || !isFinite(svgHeight)) {
                    console.warn("[parseSVGForExtrusion] SVG has zero or invalid width/height. Cannot scale.", {svgWidth, svgHeight});
                    showMessage("SVG has zero or invalid dimensions.");
                    if (!isExport) document.getElementById('loading').classList.add('hidden');
                    return;
                }

                const svgCenterX = (svgMinX + svgMaxX) / 2;
                const svgCenterY = (svgMinY + svgMaxY) / 2;
                
                const userScaleFactor = (typeof svgScaleFactor === 'number' && !isNaN(svgScaleFactor) && svgScaleFactor > 0)
                    ? svgScaleFactor
                    : 1;
                
                if (isNaN(brickDimensions.width) || isNaN(brickDimensions.depth) || brickDimensions.width <= 0 || brickDimensions.depth <= 0) {
                    console.error("[parseSVGForExtrusion] Invalid brickDimensions for scaling:", brickDimensions);
                    showMessage("Error: Invalid base dimensions for scaling SVG.");
                    if (!isExport) document.getElementById('loading').classList.add('hidden');
                    return;
                }
                if (svgWidth <= 0 || svgHeight <= 0) {
                     console.error("[parseSVGForExtrusion] Invalid svgWidth or svgHeight for scaling:", {svgWidth, svgHeight});
                     showMessage("Error: Invalid SVG dimensions for scaling.");
                     if (!isExport) document.getElementById('loading').classList.add('hidden');
                     return;
                }

                const baseFitScale = Math.min(brickDimensions.width / svgWidth, brickDimensions.depth / svgHeight);
                
                const effectiveScale = baseFitScale * userScaleFactor;

                if (isNaN(effectiveScale) || !isFinite(effectiveScale) || effectiveScale <= 0) {
                    console.error(`[parseSVGForExtrusion] Calculated effectiveScale is invalid: ${effectiveScale}. BaseFitScale: ${baseFitScale}, UserScaleFactor: ${userScaleFactor}`);
                    showMessage("Error: Could not calculate a valid scale for the SVG.");
                    if (!isExport) document.getElementById('loading').classList.add('hidden');
                    return;
                }
                
                let pathsToProcess = paths;
                
                if (!isExport && lowQuality && paths.length > settings.processing.lowQualityPathLimit) {
                    const limit = Math.max(settings.processing.lowQualityPathMin, Math.floor(paths.length * qualityFactor));
                    pathsToProcess = paths.slice(0, limit);
                    console.log(`Low quality mode: Processing ${limit} of ${paths.length} paths`);
                }
                
                const processingOptions = { 
                    pathsToProcess,
                    svgCenterX, 
                    svgCenterY, 
                    effectiveScale,
                    lowQuality, 
                    isExport
                };

                try {
                    if (!window.processPathsDirectlyAsync) {
                        console.error("[parseSVGForExtrusion] processPathsDirectlyAsync is not defined. Using synchronous version instead.");
                        processPathsDirectly(processingOptions);
                    } else {
                        processPathsDirectlyAsync(processingOptions);
                    }
                } catch (asyncError) {
                    console.error("[parseSVGForExtrusion] Error calling processPathsDirectlyAsync:", asyncError);
                    processPathsDirectly(processingOptions);
                }
            }
            
        } catch (error) {
            console.error("[parseSVGForExtrusion] Error processing SVG:", error);
            let userErrorMessage = "Error processing SVG. Check console for details.";
            
            if (error.message.includes("text is empty")) {
                userErrorMessage = "SVG file is empty or corrupt.";
            } else if (error.message.includes("unresolved references")) {
                userErrorMessage = "SVG contains unresolved internal references. Try simplifying the SVG.";
            } else if (error.message.includes("xlink:href")) {
                userErrorMessage = "SVG contains linked elements which may not be supported. Try embedding all elements.";
            } else if (error.message.includes("converting to paths")) {
                userErrorMessage = "SVG contains elements that need to be converted to paths. Use a vector editor to convert all elements to paths.";
            }
            
            if (!isExport) {
                showMessage(userErrorMessage);
                document.getElementById('loading').classList.add('hidden');
            }
            
            const endTime = performance.now();
            // console.log(`[parseSVGForExtrusion] Failed after ${(endTime - startTime).toFixed(2)}ms.`);
        }
        
        const endTime = performance.now();
        // console.log(`[parseSVGForExtrusion] Completed in ${(endTime - startTime).toFixed(2)}ms.`);
    } 

    function processHolesAsShapes(pathIndex, holeShapes, svgCenterX, svgCenterY, effectiveScale, lowQuality, isExport, stats) {
        const settings = window.svgGlobalSettings;
        // const currentConfig = window.config || {}; // Not strictly needed here as holes are always subtract

        holeShapes.forEach((holeShape, shapeIndex) => {
            try {
                const pointsForOuter = settings.pointSampling.getPoints(isExport ? 'detailed' : (lowQuality ? 'default' : 'default')); // Or specific 'lowQualityDefault'
                
                const originalOuterPoints = holeShape.getPoints(pointsForOuter);
                if (originalOuterPoints.length < 3) {
                    console.warn(`Path ${pathIndex}, Hole Shape ${shapeIndex}: Not enough points (${originalOuterPoints.length}). Skipping.`);
                    return;
                }
                
                const filteredOuterPoints = [];
                let lastX = null, lastY = null;
                
                for (const p of originalOuterPoints) {
                    if (lastX === null || lastY === null || 
                        (Math.abs(p.x - lastX) > settings.processing.pointFilterThreshold || Math.abs(p.y - lastY) > settings.processing.pointFilterThreshold)) {
                        filteredOuterPoints.push(p);
                        lastX = p.x;
                        lastY = p.y;
                    }
                }
                
                if (filteredOuterPoints.length < 3) {
                    console.warn(`Path ${pathIndex}, Hole Shape ${shapeIndex}: Too few points after filtering duplicates (${filteredOuterPoints.length}). Skipping.`);
                    return;
                }
                
                const transformedOuterPoints = filteredOuterPoints.map(p => {
                    return new THREE.Vector2(
                        (p.x - svgCenterX) * effectiveScale,
                        (p.y - svgCenterY) * -effectiveScale
                    );
                });

                const finalShape = new THREE.Shape(transformedOuterPoints);
                finalShape.holes = []; // Holes generally don't have their own holes in this context

                const mesh = createExtrudedShape(finalShape, effectiveScale, lowQuality);
                // stats.extrusionsMade++; // These are holes, not primary extrusions for stats

                const shapeId = window.shapeColorCounter - 1;
                const shapeInfoIndex = window.shapeRenderInfo.findIndex(info => info.id === shapeId);

                if (shapeInfoIndex >= 0) {
                    window.shapeRenderInfo[shapeInfoIndex].originalPath = { /* ... */ };
                    window.shapeRenderInfo[shapeInfoIndex].useReversedWinding = false;
                    
                    // Holes processed as shapes are always subtractive
                    window.shapeRenderInfo[shapeInfoIndex].operationType = 'subtract'; 
                    console.log(`Path ${pathIndex}, Hole Shape ${shapeIndex}: (ID: ${shapeId}) operationType set to 'subtract'.`);
                    
                    if (window.shapeRenderInfo[shapeInfoIndex].mesh) {
                        // Subtracted shapes are initially hidden, CSG would handle actual subtraction
                        window.shapeRenderInfo[shapeInfoIndex].mesh.visible = false; 
                    }
                }
            } catch (shapeError) {
                console.error(`[processHolesAsShapes] Error processing hole shape [${pathIndex}/${shapeIndex}]:`, shapeError);
            }
        });
    }

    function processShapesWithHoles(pathIndex, shapesFromPath, svgCenterX, svgCenterY, effectiveScale, lowQuality, isExport, stats) {
        const settings = window.svgGlobalSettings;
        const currentConfig = window.config || {}; // Use global config
        const defaultOperation = currentConfig.defaultShapeOperation || 'extrude';

        shapesFromPath.forEach((originalShape, shapeIndex) => {
            try {
                const potentialHoleCount = originalShape.holes?.length || 0;
                
                const pointsForOuter = settings.pointSampling.getPoints(isExport ? 'detailed' : (lowQuality ? 'default' : 'default'));
                // const pointsForHoles = settings.pointSampling.getPoints(isExport ? 'detailed' : (lowQuality ? 'default' : 'default')); // Used by validateHole

                const originalOuterPoints = originalShape.getPoints(pointsForOuter);
                if (originalOuterPoints.length < 3) {
                    console.warn(`Path ${pathIndex}, Shape ${shapeIndex}: Not enough points for outer contour (${originalOuterPoints.length}). Skipping.`);
                    return;
                }
                
                const filteredOuterPoints = [];
                let lastX = null, lastY = null;
                
                for (const p of originalOuterPoints) {
                    if (lastX === null || lastY === null || 
                        (Math.abs(p.x - lastX) > settings.processing.pointFilterThreshold || Math.abs(p.y - lastY) > settings.processing.pointFilterThreshold)) {
                        filteredOuterPoints.push(p);
                        lastX = p.x;
                        lastY = p.y;
                    }
                }
                
                if (filteredOuterPoints.length < 3) {
                    console.warn(`Path ${pathIndex}, Shape ${shapeIndex}: Too few points after filtering duplicates (${filteredOuterPoints.length}). Skipping.`);
                    return;
                }
                
                const transformedOuterPoints = filteredOuterPoints.map(p => {
                    return new THREE.Vector2(
                        (p.x - svgCenterX) * effectiveScale,
                        (p.y - svgCenterY) * -effectiveScale
                    );
                });

                const finalShape = new THREE.Shape(transformedOuterPoints);
                finalShape.holes = [];
                
                const shapeArea = Math.abs(window.SVGProcessing.Utils.calculateShapeArea(finalShape, settings.pointSampling.getPoints('default')));
                finalShape.area = shapeArea;

                // Get shape orientation for hole winding comparison
                let shapeOrientation = 0;
                if (typeof calculatePolygonOrientation === 'function') {
                    shapeOrientation = calculatePolygonOrientation(transformedOuterPoints);
                }

                if (originalShape.holes && originalShape.holes.length > 0) {
                    console.log(`Path ${pathIndex}, Shape ${shapeIndex}: Processing ${originalShape.holes.length} potential holes`);
                    stats.totalHoles += originalShape.holes.length;
                    
                    const potentialHoles = originalShape.holes.map((holePath, holeIdx) => ({
                        holePath,
                        holeIdx,
                        area: window.SVGProcessing.Utils.calculateShapeArea(holePath, settings.pointSampling.getPoints('default')) // Assuming holePath is Shape-like
                    }));
                    
                    // Process largest holes first to avoid nesting issues
                    potentialHoles.sort((a, b) => b.area - a.area);
                    
                    for (const { holePath, holeIdx } of potentialHoles) {
                        // Use improved validateHole function that checks orientation
                        const finalHoleValidatedPath = window.SVGProcessing.Holes.validateHole(holePath, finalShape, svgCenterX, svgCenterY, effectiveScale);
                        
                        if (finalHoleValidatedPath) {
                            // The global validateHole already handles winding.
                            finalShape.holes.push(finalHoleValidatedPath);
                            stats.validatedHoles++;
                        }
                    }
                    
                    if (finalShape.holes.length > 0) {
                        stats.shapesWithHoles++;
                        console.log(`Path ${pathIndex}, Shape ${shapeIndex}: ${finalShape.holes.length} of ${originalShape.holes.length} holes validated`);
                    }
                }
                
                if (shapeArea < settings.processing.zeroAreaThreshold) {
                    console.warn(`Path ${pathIndex}, Shape ${shapeIndex}: Shape has effectively zero area (${shapeArea.toFixed(6)}). Skipping.`);
                    return;
                }
                
                if (transformedOuterPoints.length > 500 && !isExport) {
                    console.warn(`Path ${pathIndex}, Shape ${shapeIndex}: Shape has excessive points (${transformedOuterPoints.length}). Consider simplifying SVG.`);
                    
                    if (lowQuality) {
                        console.log(`Path ${pathIndex}, Shape ${shapeIndex}: Skipping complex shape in low quality mode.`);
                        return;
                    }
                }
                
                createExtrudedShape(finalShape, effectiveScale, lowQuality);
                stats.extrusionsMade++;

                const shapeId = window.shapeColorCounter - 1;                
                const shapeInfoIndex = window.shapeRenderInfo.findIndex(info => info.id === shapeId);
                if (shapeInfoIndex >= 0) {
                    window.shapeRenderInfo[shapeInfoIndex].originalPath = { /* ... */ };
                    // Initialize operationType from global config default
                    window.shapeRenderInfo[shapeInfoIndex].operationType = defaultOperation;
                    
                    // If it's subtractive by default, ensure mesh visibility is set accordingly
                    if (window.shapeRenderInfo[shapeInfoIndex].mesh) {
                        window.shapeRenderInfo[shapeInfoIndex].mesh.visible = 
                            window.shapeRenderInfo[shapeInfoIndex].isVisible && 
                            (window.shapeRenderInfo[shapeInfoIndex].operationType !== 'subtract');
                    }

                    if (originalShape.holes && originalShape.holes.length > 0 && finalShape.holes.length > 0) {
                        // ... existing hole logging ...
                    }
                }
            } catch (shapeError) {
                console.error(`[processShapesWithHoles] Error processing path[${pathIndex}], shape[${shapeIndex}]:`, shapeError);
            }
        });
    }

    // Remove local validateHole, estimateShapeArea, and isPointInPolygon functions
    // window.validateHole = validateHole; // This was assigning the local one

    console.log("SVG Processing core initialized and ready.");
}
