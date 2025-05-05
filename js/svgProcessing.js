// Show a temporary message in the view
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

// Parse SVG and create extruded shapes using Three.js SVGLoader
function parseSVGForExtrusion(svgString, lowQuality = false, qualityFactor = 1.0, isExporting = false) {
    // Skip if we're in high quality mode but not exporting
    if (isHighQualityMode && !isExporting) return;
    
    // For exports, always use high quality
    if (isExporting) {
        lowQuality = false;
        qualityFactor = 1.0;
    }
    
    // Check if extrudedGroup exists, if not, initialize it
    if (!extrudedGroup) {
        console.warn("extrudedGroup not initialized, creating it now");
        extrudedGroup = new THREE.Group();
        scene.add(extrudedGroup);
    }
    
    // Only do position update optimization if we're not changing height
    // and there are existing extrusions
    const heightChanged = (extrudedGroup.userData.lastHeight !== undefined && 
                          extrudedGroup.userData.lastHeight !== extrusionHeight);
    
    if (!heightChanged && lowQuality && extrudedGroup.children.length > 0 && !isExporting) {
        // Just update positions instead of regenerating
        extrudedGroup.children.forEach(child => {
            child.position.set(
                extrusionPosition.x, 
                (brickDimensions.height / 2) + 0.5 + extrusionPosition.y, 
                extrusionPosition.z
            );
        });
        return;
    }
    
    // Clear previous extrusions
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
    
    // Store the current height for future comparison
    extrudedGroup.userData.lastHeight = extrusionHeight;
    
    // Show loading indicator for potentially long operations
    if (!isExporting) {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('loading').textContent = 'Processing SVG...';
    }

    try {
        // Create an SVG loader instance
        const loader = new THREE.SVGLoader();
        
        console.log("Parsing SVG data with SVGLoader...");
        
        // Parse the SVG string
        const svgParsed = loader.parse(svgString);
        
        // Get paths from the SVG
        const paths = svgParsed.paths;
        
        console.log(`SVGLoader found ${paths.length} paths in the SVG`);
        
        if (paths.length === 0) {
            console.warn("No paths found in SVG");
            showMessage("No paths found in SVG. The file may be empty or use unsupported elements.");
            document.getElementById('loading').classList.add('hidden');
            return;
        }
        
        // Calculate the bounding box to center and scale properly
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let allPoints = [];
        
        // First pass: collect all points for bounding box calculation
        paths.forEach(path => {
            console.log(`Path with ${path.subPaths.length} subpaths`);
            
            path.subPaths.forEach(subPath => {
                // Sample points along each curve in the subpath
                const points = samplePointsFromSubPath(subPath);
                allPoints = allPoints.concat(points);
                
                // Update bounding box
                points.forEach(point => {
                    if (!point) return;
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                });
            });
        });
        
        console.log(`SVG Bounds: (${minX}, ${minY}) to (${maxX}, ${maxY})`);
        
        const svgWidth = maxX - minX;
        const svgHeight = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // FIXED: Improved scale calculation with explicit logging
        const scaleX = brickDimensions.width / svgWidth;
        const scaleY = brickDimensions.depth / svgHeight;
        const baseScale = Math.min(scaleX, scaleY);
        
        // Explicitly log the current svgScaleFactor value for debugging
        console.log(`Using svgScaleFactor: ${svgScaleFactor} (type: ${typeof svgScaleFactor})`);
        
        // Apply svgScaleFactor directly without multiplying against baseScale
        // This gives more intuitive control over the size
        const scale = baseScale * svgScaleFactor;
        
        console.log(`SVG dimensions: ${svgWidth.toFixed(2)} x ${svgHeight.toFixed(2)}, Scale calculation:
            - Base scale (to fit): ${baseScale.toFixed(3)}
            - User scale factor: ${svgScaleFactor.toFixed(3)}
            - Final scale: ${scale.toFixed(3)}`);
        
        // Process paths based on quality settings
        let pathsToProcess = paths;
        
        // For low quality interactive rendering, we might limit the number of paths
        if (!isExporting && lowQuality && paths.length > 20) {
            const limit = Math.max(5, Math.floor(paths.length * qualityFactor));
            pathsToProcess = paths.slice(0, limit);
            console.log(`Low quality mode: Processing ${limit} of ${paths.length} paths`);
        }
        
        // Use new simplified processing approach
        if (isExporting) {
            processPathsDirectly(pathsToProcess, { centerX, centerY, scale, lowQuality, isExporting });
        } else {
            processPathsDirectlyAsync(pathsToProcess, { centerX, centerY, scale, lowQuality, isExporting });
        }
        
    } catch (error) {
        console.error("Error processing SVG:", error);
        if (!isExporting) {
            showMessage("Error processing SVG. Check console for details.");
            document.getElementById('loading').classList.add('hidden');
        }
    }
}

// Function to sample points from a subpath (handles all curve types)
function samplePointsFromSubPath(subPath, divisions = 10) {
    const points = [];
    
    if (!subPath || !subPath.curves) return points;
    
    // Sample points along each curve
    subPath.curves.forEach(curve => {
        // Use getPoints for consistent sampling across all curve types
        try {
            const curvePoints = curve.getPoints(divisions);
            points.push(...curvePoints);
        } catch (error) {
            console.warn("Error sampling points from curve:", error);
            // Fallback for curves that don't support getPoints
            if (curve.v1 && curve.v2) {
                points.push(curve.v1, curve.v2);
            } else if (curve.v0 && curve.v1) {
                points.push(curve.v0, curve.v1);
            }
        }
    });
    
    return points;
}

// New simplified processing approach that directly extrudes each path
function processPathsDirectly(paths, options) {
    const { centerX, centerY, scale, lowQuality, isExporting } = options;
    const totalPaths = paths.length;
    
    console.log(`Processing ${totalPaths} paths directly using simplified approach`);
    
    // First collect all shapes with their metadata
    const allShapes = [];
    
    // First pass: create all shapes and gather metadata
    for (let i = 0; i < totalPaths; i++) {
        const path = paths[i];
        console.log(`Processing path ${i+1}/${totalPaths} with ${path.subPaths.length} subpaths`);
        
        // Process each subpath
        path.subPaths.forEach((subPath, subPathIndex) => {
            try {
                // Create a shape from the subpath
                const shape = createShapeFromSubPath(subPath);
                if (!shape) return;
                
                // Center and scale the shape
                const points = shape.getPoints(36);
                points.forEach(point => {
                    point.x = (point.x - centerX) * scale;
                    point.y = (point.y - centerY) * scale;
                });
                
                // Calculate area to determine winding direction
                const area = calculateShapeArea(shape);
                
                // Store shape with metadata
                allShapes.push({
                    shape: shape,
                    area: Math.abs(area),
                    isClockwise: area < 0,  // In SVG, clockwise paths are typically holes
                    pathIndex: i,
                    subPathIndex: subPathIndex,
                    processed: false
                });
                
                console.log(`Created shape ${allShapes.length-1} with area ${area.toFixed(2)}, isClockwise: ${area < 0}`);
                
            } catch (error) {
                console.error(`Error processing subpath ${subPathIndex}:`, error);
            }
        });
    }
    
    // Sort shapes by area, largest first (outer shapes tend to be larger)
    allShapes.sort((a, b) => b.area - a.area);
    
    // Second pass: identify outer shapes and their holes
    let processedCount = 0;
    
    // Process large shapes first as potential outer shapes
    for (let i = 0; i < allShapes.length; i++) {
        if (allShapes[i].processed) continue;
        
        const outerShape = allShapes[i];
        outerShape.processed = true;
        
        // IMPROVED: More permissive hole detection (almost no auto-skipping)
        // Only skip tiny shapes that are likely to be artifacts
        if (outerShape.isClockwise && 
            outerShape.area < allShapes[0].area * 0.01) { // Reduced from 0.1 to 0.01
            console.log(`Skipping very small shape #${i} (area ratio: ${(outerShape.area/allShapes[0].area).toFixed(4)})`);
            continue;
        }
        
        // Create a new shape for extrusion
        const mainShape = new THREE.Shape();
        
        // Copy points from the outer shape
        const mainPoints = outerShape.shape.getPoints(36);
        mainPoints.forEach((point, idx) => {
            if (idx === 0) mainShape.moveTo(point.x, point.y);
            else mainShape.lineTo(point.x, point.y);
        });
        
        // Find holes for this shape - improved hole detection logic
        let holesAdded = 0;
        
        for (let j = 0; j < allShapes.length; j++) {
            if (i === j || allShapes[j].processed) continue;
            
            const potentialHole = allShapes[j];
            
            // A hole should be substantially smaller
            if (potentialHole.area >= outerShape.area * 0.9) continue;
            
            // Test if shape is contained inside - improved containment test
            if (isShapeContainedIn(potentialHole.shape, outerShape.shape)) {
                console.log(`Found hole: shape #${j} inside shape #${i} (area ratio: ${(potentialHole.area/outerShape.area).toFixed(3)})`);
                potentialHole.processed = true;
                
                // Add as a hole
                const holePath = new THREE.Path();
                const holePoints = potentialHole.shape.getPoints(36);
                
                holePoints.forEach((point, idx) => {
                    if (idx === 0) holePath.moveTo(point.x, point.y);
                    else holePath.lineTo(point.x, point.y);
                });
                
                holePath.closePath();
                mainShape.holes.push(holePath);
                holesAdded++;
            }
        }
        
        // Create extrusion with any detected holes
        console.log(`Extruding shape #${i} with ${holesAdded} holes`);
        createExtrudedShape(mainShape, scale, lowQuality);
        processedCount++;
        
        // Update progress for exports
        if (isExporting && exportSettings.progressCallback && (processedCount % 5 === 0)) {
            const progress = Math.round(processedCount / allShapes.length * 100);
            exportSettings.progressCallback(progress);
        }
    }
    
    console.log(`Created ${processedCount} extrusions with holes from ${allShapes.length} shapes`);
    
    // Hide loading indicator when done (if not exporting)
    if (!isExporting) {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Calculate the area of a shape to determine winding direction
function calculateShapeArea(shape) {
    const points = shape.getPoints(36);
    let area = 0;
    
    // Use shoelace formula to calculate signed area
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    
    return area / 2;
}

// Check if one shape is contained within another
function isShapeContainedIn(innerShape, outerShape) {
    const innerPoints = innerShape.getPoints(36); // More sampling points for accuracy
    const outerPoints = outerShape.getPoints(48);
    
    // First quick test: check bounding boxes
    const innerBounds = getBoundingBox(innerPoints);
    const outerBounds = getBoundingBox(outerPoints);
    
    // If inner bounding box extends beyond outer, it can't be contained
    if (innerBounds.minX < outerBounds.minX || innerBounds.maxX > outerBounds.maxX ||
        innerBounds.minY < outerBounds.minY || innerBounds.maxY > outerBounds.maxY) {
        console.log("Bounding box test failed - shape not contained");
        return false;
    }
    
    // For a shape to be considered inside another, most of its points should be inside
    let pointsInside = 0;
    
    // Use adaptive threshold based on shape complexity
    // Smaller shapes need higher percentage to avoid false positives
    let threshold = 0.7; // Start with 70%
    
    // For shapes with few points, use higher threshold
    if (innerPoints.length < 8) {
        threshold = 0.85;
    }
    
    // Check if most points are inside
    for (const point of innerPoints) {
        if (isPointInPolygon(point, outerPoints)) {
            pointsInside++;
        }
    }
    
    const percentInside = pointsInside / innerPoints.length;
    
    // Area-based checks
    const innerArea = Math.abs(calculateShapeArea(innerShape));
    const outerArea = Math.abs(calculateShapeArea(outerShape));
    const areaRatio = innerArea / outerArea;
    
    // Log detailed containment info for debugging
    console.log(`Containment test: ${(percentInside * 100).toFixed(1)}% inside, ratio=${areaRatio.toFixed(3)}, threshold=${threshold}`);
    
    // Three-part test for hole detection:
    // 1. Most points must be inside the outer shape
    // 2. The inner shape must be substantially smaller than the outer shape
    // 3. For SVGs with many shapes, relax the area constraint
    return (percentInside >= threshold) && (areaRatio < 0.9);
}

// Helper function to get bounding box of points
function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const pt of points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
    }
    
    return { minX, minY, maxX, maxY };
}

// Update sync processing to use improved hole detection
function processPathsDirectly(paths, options) {
    const { centerX, centerY, scale, lowQuality, isExporting } = options;
    const totalPaths = paths.length;
    
    console.log(`Processing ${totalPaths} paths directly using simplified approach`);
    
    // First collect all shapes with their metadata
    const allShapes = [];
    
    // First pass: create all shapes and gather metadata
    for (let i = 0; i < totalPaths; i++) {
        const path = paths[i];
        console.log(`Processing path ${i+1}/${totalPaths} with ${path.subPaths.length} subpaths`);
        
        // Process each subpath
        path.subPaths.forEach((subPath, subPathIndex) => {
            try {
                // Create a shape from the subpath
                const shape = createShapeFromSubPath(subPath);
                if (!shape) return;
                
                // Center and scale the shape
                const points = shape.getPoints(36);
                points.forEach(point => {
                    point.x = (point.x - centerX) * scale;
                    point.y = (point.y - centerY) * scale;
                });
                
                // Calculate area to determine winding direction
                const area = calculateShapeArea(shape);
                
                // Store shape with metadata
                allShapes.push({
                    shape: shape,
                    area: Math.abs(area),
                    isClockwise: area < 0,  // In SVG, clockwise paths are typically holes
                    pathIndex: i,
                    subPathIndex: subPathIndex,
                    processed: false
                });
                
                console.log(`Created shape ${allShapes.length-1} with area ${area.toFixed(2)}, isClockwise: ${area < 0}`);
                
            } catch (error) {
                console.error(`Error processing subpath ${subPathIndex}:`, error);
            }
        });
    }
    
    // Sort shapes by area, largest first (outer shapes tend to be larger)
    allShapes.sort((a, b) => b.area - a.area);
    
    // Second pass: identify outer shapes and their holes
    let processedCount = 0;
    
    // Process large shapes first as potential outer shapes
    for (let i = 0; i < allShapes.length; i++) {
        if (allShapes[i].processed) continue;
        
        const outerShape = allShapes[i];
        outerShape.processed = true;
        
        // IMPROVED: More permissive hole detection (almost no auto-skipping)
        // Only skip tiny shapes that are likely to be artifacts
        if (outerShape.isClockwise && 
            outerShape.area < allShapes[0].area * 0.01) { // Reduced from 0.1 to 0.01
            console.log(`Skipping very small shape #${i} (area ratio: ${(outerShape.area/allShapes[0].area).toFixed(4)})`);
            continue;
        }
        
        // Create a new shape for extrusion
        const mainShape = new THREE.Shape();
        
        // Copy points from the outer shape
        const mainPoints = outerShape.shape.getPoints(36);
        mainPoints.forEach((point, idx) => {
            if (idx === 0) mainShape.moveTo(point.x, point.y);
            else mainShape.lineTo(point.x, point.y);
        });
        
        // Find holes for this shape - improved hole detection logic
        let holesAdded = 0;
        
        for (let j = 0; j < allShapes.length; j++) {
            if (i === j || allShapes[j].processed) continue;
            
            const potentialHole = allShapes[j];
            
            // A hole should be substantially smaller
            if (potentialHole.area >= outerShape.area * 0.9) continue;
            
            // Test if shape is contained inside - improved containment test
            if (isShapeContainedIn(potentialHole.shape, outerShape.shape)) {
                console.log(`Found hole: shape #${j} inside shape #${i} (area ratio: ${(potentialHole.area/outerShape.area).toFixed(3)})`);
                potentialHole.processed = true;
                
                // Add as a hole
                const holePath = new THREE.Path();
                const holePoints = potentialHole.shape.getPoints(36);
                
                holePoints.forEach((point, idx) => {
                    if (idx === 0) holePath.moveTo(point.x, point.y);
                    else holePath.lineTo(point.x, point.y);
                });
                
                holePath.closePath();
                mainShape.holes.push(holePath);
                holesAdded++;
            }
        }
        
        // Create extrusion with any detected holes
        console.log(`Extruding shape #${i} with ${holesAdded} holes`);
        createExtrudedShape(mainShape, scale, lowQuality);
        processedCount++;
        
        // Update progress for exports
        if (isExporting && exportSettings.progressCallback && (processedCount % 5 === 0)) {
            const progress = Math.round(processedCount / allShapes.length * 100);
            exportSettings.progressCallback(progress);
        }
    }
    
    console.log(`Created ${processedCount} extrusions with holes from ${allShapes.length} shapes`);
    
    // Hide loading indicator when done (if not exporting)
    if (!isExporting) {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Calculate the area of a shape to determine winding direction
function calculateShapeArea(shape) {
    const points = shape.getPoints(36);
    let area = 0;
    
    // Use shoelace formula to calculate signed area
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    
    return area / 2;
}

// Check if one shape is contained within another
function isShapeContainedIn(innerShape, outerShape) {
    const innerPoints = innerShape.getPoints(36); // More sampling points for accuracy
    const outerPoints = outerShape.getPoints(48);
    
    // First quick test: check bounding boxes
    const innerBounds = getBoundingBox(innerPoints);
    const outerBounds = getBoundingBox(outerPoints);
    
    // If inner bounding box extends beyond outer, it can't be contained
    if (innerBounds.minX < outerBounds.minX || innerBounds.maxX > outerBounds.maxX ||
        innerBounds.minY < outerBounds.minY || innerBounds.maxY > outerBounds.maxY) {
        console.log("Bounding box test failed - shape not contained");
        return false;
    }
    
    // For a shape to be considered inside another, most of its points should be inside
    let pointsInside = 0;
    
    // Use adaptive threshold based on shape complexity
    // Smaller shapes need higher percentage to avoid false positives
    let threshold = 0.7; // Start with 70%
    
    // For shapes with few points, use higher threshold
    if (innerPoints.length < 8) {
        threshold = 0.85;
    }
    
    // Check if most points are inside
    for (const point of innerPoints) {
        if (isPointInPolygon(point, outerPoints)) {
            pointsInside++;
        }
    }
    
    const percentInside = pointsInside / innerPoints.length;
    
    // Area-based checks
    const innerArea = Math.abs(calculateShapeArea(innerShape));
    const outerArea = Math.abs(calculateShapeArea(outerShape));
    const areaRatio = innerArea / outerArea;
    
    // Log detailed containment info for debugging
    console.log(`Containment test: ${(percentInside * 100).toFixed(1)}% inside, ratio=${areaRatio.toFixed(3)}, threshold=${threshold}`);
    
    // Three-part test for hole detection:
    // 1. Most points must be inside the outer shape
    // 2. The inner shape must be substantially smaller than the outer shape
    // 3. For SVGs with many shapes, relax the area constraint
    return (percentInside >= threshold) && (areaRatio < 0.9);
}

// Helper function to get bounding box of points
function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const pt of points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
    }
    
    return { minX, minY, maxX, maxY };
}

// Update sync processing to use improved hole detection
function processPathsDirectly(paths, options) {
    const { centerX, centerY, scale, lowQuality, isExporting } = options;
    const totalPaths = paths.length;
    
    console.log(`Processing ${totalPaths} paths directly using simplified approach`);
    
    // First collect all shapes with their metadata
    const allShapes = [];
    
    // First pass: create all shapes and gather metadata
    for (let i = 0; i < totalPaths; i++) {
        const path = paths[i];
        console.log(`Processing path ${i+1}/${totalPaths} with ${path.subPaths.length} subpaths`);
        
        // Process each subpath
        path.subPaths.forEach((subPath, subPathIndex) => {
            try {
                // Create a shape from the subpath
                const shape = createShapeFromSubPath(subPath);
                if (!shape) return;
                
                // Center and scale the shape
                const points = shape.getPoints(36);
                points.forEach(point => {
                    point.x = (point.x - centerX) * scale;
                    point.y = (point.y - centerY) * scale;
                });
                
                // Calculate area to determine winding direction
                const area = calculateShapeArea(shape);
                
                // Store shape with metadata
                allShapes.push({
                    shape: shape,
                    area: Math.abs(area),
                    isClockwise: area < 0,  // In SVG, clockwise paths are typically holes
                    pathIndex: i,
                    subPathIndex: subPathIndex,
                    processed: false
                });
                
                console.log(`Created shape ${allShapes.length-1} with area ${area.toFixed(2)}, isClockwise: ${area < 0}`);
                
            } catch (error) {
                console.error(`Error processing subpath ${subPathIndex}:`, error);
            }
        });
    }
    
    // Sort shapes by area, largest first (outer shapes tend to be larger)
    allShapes.sort((a, b) => b.area - a.area);
    
    // Second pass: identify outer shapes and their holes
    let processedCount = 0;
    
    // Process large shapes first as potential outer shapes
    for (let i = 0; i < allShapes.length; i++) {
        if (allShapes[i].processed) continue;
        
        const outerShape = allShapes[i];
        outerShape.processed = true;
        
        // IMPROVED: More permissive hole detection (almost no auto-skipping)
        // Only skip tiny shapes that are likely to be artifacts
        if (outerShape.isClockwise && 
            outerShape.area < allShapes[0].area * 0.01) { // Reduced from 0.1 to 0.01
            console.log(`Skipping very small shape #${i} (area ratio: ${(outerShape.area/allShapes[0].area).toFixed(4)})`);
            continue;
        }
        
        // Create a new shape for extrusion
        const mainShape = new THREE.Shape();
        
        // Copy points from the outer shape
        const mainPoints = outerShape.shape.getPoints(36);
        mainPoints.forEach((point, idx) => {
            if (idx === 0) mainShape.moveTo(point.x, point.y);
            else mainShape.lineTo(point.x, point.y);
        });
        
        // Find holes for this shape - improved hole detection logic
        let holesAdded = 0;
        
        for (let j = 0; j < allShapes.length; j++) {
            if (i === j || allShapes[j].processed) continue;
            
            const potentialHole = allShapes[j];
            
            // A hole should be substantially smaller
            if (potentialHole.area >= outerShape.area * 0.9) continue;
            
            // Test if shape is contained inside - improved containment test
            if (isShapeContainedIn(potentialHole.shape, outerShape.shape)) {
                console.log(`Found hole: shape #${j} inside shape #${i} (area ratio: ${(potentialHole.area/outerShape.area).toFixed(3)})`);
                potentialHole.processed = true;
                
                // Add as a hole
                const holePath = new THREE.Path();
                const holePoints = potentialHole.shape.getPoints(36);
                
                holePoints.forEach((point, idx) => {
                    if (idx === 0) holePath.moveTo(point.x, point.y);
                    else holePath.lineTo(point.x, point.y);
                });
                
                holePath.closePath();
                mainShape.holes.push(holePath);
                holesAdded++;
            }
        }
        
        // Create extrusion with any detected holes
        console.log(`Extruding shape #${i} with ${holesAdded} holes`);
        createExtrudedShape(mainShape, scale, lowQuality);
        processedCount++;
        
        // Update progress for exports
        if (isExporting && exportSettings.progressCallback && (processedCount % 5 === 0)) {
            const progress = Math.round(processedCount / allShapes.length * 100);
            exportSettings.progressCallback(progress);
        }
    }
    
    console.log(`Created ${processedCount} extrusions with holes from ${allShapes.length} shapes`);
    
    // Hide loading indicator when done (if not exporting)
    if (!isExporting) {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Calculate the area of a shape to determine winding direction
function calculateShapeArea(shape) {
    const points = shape.getPoints(36);
    let area = 0;
    
    // Use shoelace formula to calculate signed area
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    
    return area / 2;
}

// Check if one shape is contained within another
function isShapeContainedIn(innerShape, outerShape) {
    const innerPoints = innerShape.getPoints(36); // More sampling points for accuracy
    const outerPoints = outerShape.getPoints(48);
    
    // First quick test: check bounding boxes
    const innerBounds = getBoundingBox(innerPoints);
    const outerBounds = getBoundingBox(outerPoints);
    
    // If inner bounding box extends beyond outer, it can't be contained
    if (innerBounds.minX < outerBounds.minX || innerBounds.maxX > outerBounds.maxX ||
        innerBounds.minY < outerBounds.minY || innerBounds.maxY > outerBounds.maxY) {
        console.log("Bounding box test failed - shape not contained");
        return false;
    }
    
    // For a shape to be considered inside another, most of its points should be inside
    let pointsInside = 0;
    
    // Use adaptive threshold based on shape complexity
    // Smaller shapes need higher percentage to avoid false positives
    let threshold = 0.7; // Start with 70%
    
    // For shapes with few points, use higher threshold
    if (innerPoints.length < 8) {
        threshold = 0.85;
    }
    
    // Check if most points are inside
    for (const point of innerPoints) {
        if (isPointInPolygon(point, outerPoints)) {
            pointsInside++;
        }
    }
    
    const percentInside = pointsInside / innerPoints.length;
    
    // Area-based checks
    const innerArea = Math.abs(calculateShapeArea(innerShape));
    const outerArea = Math.abs(calculateShapeArea(outerShape));
    const areaRatio = innerArea / outerArea;
    
    // Log detailed containment info for debugging
    console.log(`Containment test: ${(percentInside * 100).toFixed(1)}% inside, ratio=${areaRatio.toFixed(3)}, threshold=${threshold}`);
    
    // Three-part test for hole detection:
    // 1. Most points must be inside the outer shape
    // 2. The inner shape must be substantially smaller than the outer shape
    // 3. For SVGs with many shapes, relax the area constraint
    return (percentInside >= threshold) && (areaRatio < 0.9);
}

// Helper function to get bounding box of points
function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const pt of points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
    }
    
    return { minX, minY, maxX, maxY };
}

// Update sync processing to use improved hole detection
function processPathsDirectly(paths, options) {
    const { centerX, centerY, scale, lowQuality, isExporting } = options;
    const totalPaths = paths.length;
    
    console.log(`Processing ${totalPaths} paths directly using simplified approach`);
    
    // First collect all shapes with their metadata
    const allShapes = [];
    
    // First pass: create all shapes and gather metadata
    for (let i = 0; i < totalPaths; i++) {
        const path = paths[i];
        console.log(`Processing path ${i+1}/${totalPaths} with ${path.subPaths.length} subpaths`);
        
        // Process each subpath
        path.subPaths.forEach((subPath, subPathIndex) => {
            try {
                // Create a shape from the subpath
                const shape = createShapeFromSubPath(subPath);
                if (!shape) return;
                
                // Center and scale the shape
                const points = shape.getPoints(36);
                points.forEach(point => {
                    point.x = (point.x - centerX) * scale;
                    point.y = (point.y - centerY) * scale;
                });
                
                // Calculate area to determine winding direction
                const area = calculateShapeArea(shape);
                
                // Store shape with metadata
                allShapes.push({
                    shape: shape,
                    area: Math.abs(area),
                    isClockwise: area < 0,  // In SVG, clockwise paths are typically holes
                    pathIndex: i,
                    subPathIndex: subPathIndex,
                    processed: false
                });
                
                console.log(`Created shape ${allShapes.length-1} with area ${area.toFixed(2)}, isClockwise: ${area < 0}`);
                
            } catch (error) {
                console.error(`Error processing subpath ${subPathIndex}:`, error);
            }
        });
    }
    
    // Sort shapes by area, largest first (outer shapes tend to be larger)
    allShapes.sort((a, b) => b.area - a.area);
    
    // Second pass: identify outer shapes and their holes
    let processedCount = 0;
    
    // Process large shapes first as potential outer shapes
    for (let i = 0; i < allShapes.length; i++) {
        if (allShapes[i].processed) continue;
        
        const outerShape = allShapes[i];
        outerShape.processed = true;
        
        // IMPROVED: More permissive hole detection (almost no auto-skipping)
        // Only skip tiny shapes that are likely to be artifacts
        if (outerShape.isClockwise && 
            outerShape.area < allShapes[0].area * 0.01) { // Reduced from 0.1 to 0.01
            console.log(`Skipping very small shape #${i} (area ratio: ${(outerShape.area/allShapes[0].area).toFixed(4)})`);
            continue;
        }
        
        // Create a new shape for extrusion
        const mainShape = new THREE.Shape();
        
        // Copy points from the outer shape
        const mainPoints = outerShape.shape.getPoints(36);
        mainPoints.forEach((point, idx) => {
            if (idx === 0) mainShape.moveTo(point.x, point.y);
            else mainShape.lineTo(point.x, point.y);
        });
        
        // Find holes for this shape - improved hole detection logic
        let holesAdded = 0;
        
        for (let j = 0; j < allShapes.length; j++) {
            if (i === j || allShapes[j].processed) continue;
            
            const potentialHole = allShapes[j];
            
            // A hole should be substantially smaller
            if (potentialHole.area >= outerShape.area * 0.9) continue;
            
            // Test if shape is contained inside - improved containment test
            if (isShapeContainedIn(potentialHole.shape, outerShape.shape)) {
                console.log(`Found hole: shape #${j} inside shape #${i} (area ratio: ${(potentialHole.area/outerShape.area).toFixed(3)})`);
                potentialHole.processed = true;
                
                // Add as a hole
                const holePath = new THREE.Path();
                const holePoints = potentialHole.shape.getPoints(36);
                
                holePoints.forEach((point, idx) => {
                    if (idx === 0) holePath.moveTo(point.x, point.y);
                    else holePath.lineTo(point.x, point.y);
                });
                
                holePath.closePath();
                mainShape.holes.push(holePath);
                holesAdded++;
            }
        }
        
        // Create extrusion with any detected holes
        console.log(`Extruding shape #${i} with ${holesAdded} holes`);
        createExtrudedShape(mainShape, scale, lowQuality);
        processedCount++;
        
        // Update progress for exports
        if (isExporting && exportSettings.progressCallback && (processedCount % 5 === 0)) {
            const progress = Math.round(processedCount / allShapes.length * 100);
            exportSettings.progressCallback(progress);
        }
    }
    
    console.log(`Created ${processedCount} extrusions with holes from ${allShapes.length} shapes`);
    
    // Hide loading indicator when done (if not exporting)
    if (!isExporting) {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Calculate the area of a shape to determine winding direction
function calculateShapeArea(shape) {
    const points = shape.getPoints(36);
    let area = 0;
    
    // Use shoelace formula to calculate signed area
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    
    return area / 2;
}

// Check if one shape is contained within another
function isShapeContainedIn(innerShape, outerShape) {
    const innerPoints = innerShape.getPoints(36); // More sampling points for accuracy
    const outerPoints = outerShape.getPoints(48);
    
    // First quick test: check bounding boxes
    const innerBounds = getBoundingBox(innerPoints);
    const outerBounds = getBoundingBox(outerPoints);
    
    // If inner bounding box extends beyond outer, it can't be contained
    if (innerBounds.minX < outerBounds.minX || innerBounds.maxX > outerBounds.maxX ||
        innerBounds.minY < outerBounds.minY || innerBounds.maxY > outerBounds.maxY) {
        console.log("Bounding box test failed - shape not contained");
        return false;
    }
    
    // For a shape to be considered inside another, most of its points should be inside
    let pointsInside = 0;
    
    // Use adaptive threshold based on shape complexity
    // Smaller shapes need higher percentage to avoid false positives
    let threshold = 0.7; // Start with 70%
    
    // For shapes with few points, use higher threshold
    if (innerPoints.length < 8) {
        threshold = 0.85;
    }
    
    // Check if most points are inside
    for (const point of innerPoints) {
        if (isPointInPolygon(point, outerPoints)) {
            pointsInside++;
        }
    }
    
    const percentInside = pointsInside / innerPoints.length;
    
    // Area-based checks
    const innerArea = Math.abs(calculateShapeArea(innerShape));
    const outerArea = Math.abs(calculateShapeArea(outerShape));
    const areaRatio = innerArea / outerArea;
    
    // Log detailed containment info for debugging
    console.log(`Containment test: ${(percentInside * 100).toFixed(1)}% inside, ratio=${areaRatio.toFixed(3)}, threshold=${threshold}`);
    
    // Three-part test for hole detection:
    // 1. Most points must be inside the outer shape
    // 2. The inner shape must be substantially smaller than the outer shape
    // 3. For SVGs with many shapes, relax the area constraint
    return (percentInside >= threshold) && (areaRatio < 0.9);
}

// Helper function to get bounding box of points
function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const pt of points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
    }
    
    return { minX, minY, maxX, maxY };
}

// Update sync processing to use improved hole detection
function processPathsDirectly(paths, options) {
    const { centerX, centerY, scale, lowQuality, isExporting } = options;
    const totalPaths = paths.length;
    
    console.log(`Processing ${totalPaths} paths directly using simplified approach`);
    
    // First collect all shapes with their metadata
    const allShapes = [];
    
    // First pass: create all shapes and gather metadata
    for (let i = 0; i < totalPaths; i++) {
        const path = paths[i];
        console.log(`Processing path ${i+1}/${totalPaths} with ${path.subPaths.length} subpaths`);
        
        // Process each subpath
        path.subPaths.forEach((subPath, subPathIndex) => {
            try {
                // Create a shape from the subpath
                const shape = createShapeFromSubPath(subPath);
                if (!shape) return;
                
                // Center and scale the shape
                const points = shape.getPoints(36);
                points.forEach(point => {
                    point.x = (point.x - centerX) * scale;
                    point.y = (point.y - centerY) * scale;
                });
                
                // Calculate area to determine winding direction
                const area = calculateShapeArea(shape);
                
                // Store shape with metadata
                allShapes.push({
                    shape: shape,
                    area: Math.abs(area),
                    isClockwise: area < 0,  // In SVG, clockwise paths are typically holes
                    pathIndex: i,
                    subPathIndex: subPathIndex,
                    processed: false
                });
                
                console.log(`Created shape ${allShapes.length-1} with area ${area.toFixed(2)}, isClockwise: ${area < 0}`);
                
            } catch (error) {
                console.error(`Error processing subpath ${subPathIndex}:`, error);
            }
        });
    }
    
    // Sort shapes by area, largest first (outer shapes tend to be larger)
    allShapes.sort((a, b) => b.area - a.area);
    
    // Second pass: identify outer shapes and their holes
    let processedCount = 0;
    
    // Process large shapes first as potential outer shapes
    for (let i = 0; i < allShapes.length; i++) {
        if (allShapes[i].processed) continue;
        
        const outerShape = allShapes[i];
        outerShape.processed = true;
        
        // IMPROVED: More permissive hole detection (almost no auto-skipping)
        // Only skip tiny shapes that are likely to be artifacts
        if (outerShape.isClockwise && 
            outerShape.area < allShapes[0].area * 0.01) { // Reduced from 0.1 to 0.01
            console.log(`Skipping very small shape #${i} (area ratio: ${(outerShape.area/allShapes[0].area).toFixed(4)})`);
            continue;
        }
        
        // Create a new shape for extrusion
        const mainShape = new THREE.Shape();
        
        // Copy points from the outer shape
        const mainPoints = outerShape.shape.getPoints(36);
        mainPoints.forEach((point, idx) => {
            if (idx === 0) mainShape.moveTo(point.x, point.y);
            else mainShape.lineTo(point.x, point.y);
        });
        
        // Find holes for this shape - improved hole detection logic
        let holesAdded = 0;
        
        for (let j = 0; j < allShapes.length; j++) {
            if (i === j || allShapes[j].processed) continue;
            
            const potentialHole = allShapes[j];
            
            // A hole should be substantially smaller
            if (potentialHole.area >= outerShape.area * 0.9) continue;
            
            // Test if shape is contained inside - improved containment test
            if (isShapeContainedIn(potentialHole.shape, outerShape.shape)) {
                console.log(`Found hole: shape #${j} inside shape #${i} (area ratio: ${(potentialHole.area/outerShape.area).toFixed(3)})`);
                potentialHole.processed = true;
                
                // Add as a hole
                const holePath = new THREE.Path();
                const holePoints = potentialHole.shape.getPoints(36);
                
                holePoints.forEach((point, idx) => {
                    if (idx === 0) holePath.moveTo(point.x, point.y);
                    else holePath.lineTo(point.x, point.y);
                });
                
                holePath.closePath();
                mainShape.holes.push(holePath);
                holesAdded++;
            }
        }
        
        // Create extrusion with any detected holes
        console.log(`Extruding shape #${i} with ${holesAdded} holes`);
        createExtrudedShape(mainShape, scale, lowQuality);
        processedCount++;
        
        // Update progress for exports
        if (isExporting && exportSettings.progressCallback && (processedCount % 5 === 0)) {
            const progress = Math.round(processedCount / allShapes.length * 100);
            exportSettings.progressCallback(progress);
        }
    }
    
    console.log(`Created ${processedCount} extrusions with holes from ${allShapes.length} shapes`);
    
    // Hide loading indicator when done (if not exporting)
    if (!isExporting) {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Calculate the area of a shape to determine winding direction
function calculateShapeArea(shape) {
    const points = shape.getPoints(36);
    let area = 0;
    
    // Use shoelace formula to calculate signed area
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    
    return area / 2;
}

// Check if one shape is contained within another
function isShapeContainedIn(innerShape, outerShape) {
    const innerPoints = innerShape.getPoints(36); // More sampling points for accuracy
    const outerPoints = outerShape.getPoints(48);
    
    // First quick test: check bounding boxes
    const innerBounds = getBoundingBox(innerPoints);
    const outerBounds = getBoundingBox(outerPoints);
    
    // If inner bounding box extends beyond outer, it can't be contained
    if (innerBounds.minX < outerBounds.minX || innerBounds.maxX > outerBounds.maxX ||
        innerBounds.minY < outerBounds.minY || innerBounds.maxY > outerBounds.maxY) {
        console.log("Bounding box test failed - shape not contained");
        return false;
    }
    
    // For a shape to be considered inside another, most of its points should be inside
    let pointsInside = 0;
    
    // Use adaptive threshold based on shape complexity
    // Smaller shapes need higher percentage to avoid false positives
    let threshold = 0.7; // Start with 70%
    
    // For shapes with few points, use higher threshold
    if (innerPoints.length < 8) {
        threshold = 0.85;
    }
    
    // Check if most points are inside
    for (const point of innerPoints) {
        if (isPointInPolygon(point, outerPoints)) {
            pointsInside++;
        }
    }
    
    const percentInside = pointsInside / innerPoints.length;
    
    // Area-based checks
    const innerArea = Math.abs(calculateShapeArea(innerShape));
    const outerArea = Math.abs(calculateShapeArea(outerShape));
    const areaRatio = innerArea / outerArea;
    
    // Log detailed containment info for debugging
    console.log(`Containment test: ${(percentInside * 100).toFixed(1)}% inside, ratio=${areaRatio.toFixed(3)}, threshold=${threshold}`);
    
    // Three-part test for hole detection:
    // 1. Most points must be inside the outer shape
    // 2. The inner shape must be substantially smaller than the outer shape
    // 3. For SVGs with many shapes, relax the area constraint
    return (percentInside >= threshold) && (areaRatio < 0.9);
}

// Helper function to get bounding box of points
function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const pt of points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
    }
    
    return { minX, minY, maxX, maxY };
}

// Update sync processing to use improved hole detection
function processPathsDirectly(paths, options) {
    const { centerX, centerY, scale, lowQuality, isExporting } = options;
    const totalPaths = paths.length;
    
    console.log(`Processing ${totalPaths} paths directly using simplified approach`);
    
    // First collect all shapes with their metadata
    const allShapes = [];
    
    // First pass: create all shapes and gather metadata
    for (let i = 0; i < totalPaths; i++) {
        const path = paths[i];
        console.log(`Processing path ${i+1}/${totalPaths} with ${path.subPaths.length} subpaths`);
        
        // Process each subpath
        path.subPaths.forEach((subPath, subPathIndex) => {
            try {
                // Create a shape from the subpath
                const shape = createShapeFromSubPath(subPath);
                if (!shape) return;
                
                // Center and scale the shape
                const points = shape.getPoints(36);
                points.forEach(point => {
                    point.x = (point.x - centerX) * scale;
                    point.y = (point.y - centerY) * scale;
                });
                
                // Calculate area to determine winding direction
                const area = calculateShapeArea(shape);
                
                // Store shape with metadata
                allShapes.push({
                    shape: shape,
                    area: Math.abs(area),
                    isClockwise: area < 0,  // In SVG, clockwise paths are typically holes
                    pathIndex: i,
                    subPathIndex: subPathIndex,
                    processed: false
                });
                
                console.log(`Created shape ${allShapes.length-1} with area ${area.toFixed(2)}, isClockwise: ${area < 0}`);
                
            } catch (error) {
                console.error(`Error processing subpath ${subPathIndex}:`, error);
            }
        });
    }
    
    // Sort shapes by area, largest first (outer shapes tend to be larger)
    allShapes.sort((a, b) => b.area - a.area);
    
    // Second pass: identify outer shapes and their holes
    let processedCount = 0;
    
    // Process large shapes first as potential outer shapes
    for (let i = 0; i < allShapes.length; i++) {
        if (allShapes[i].processed) continue;
        
        const outerShape = allShapes[i];
        outerShape.processed = true;
        
        // IMPROVED: More permissive hole detection (almost no auto-skipping)
        // Only skip tiny shapes that are likely to be artifacts
        if (outerShape.isClockwise && 
            outerShape.area < allShapes[0].area * 0.01) { // Reduced from 0.1 to 0.01
            console.log(`Skipping very small shape #${i} (area ratio: ${(outerShape.area/allShapes[0].area).toFixed(4)})`);
            continue;
        }
        
        // Create a new shape for extrusion
        const mainShape = new THREE.Shape();
        
        // Copy points from the outer shape
        const mainPoints = outerShape.shape.getPoints(36);
        mainPoints.forEach((point, idx) => {
            if (idx === 0) mainShape.moveTo(point.x, point.y);
            else mainShape.lineTo(point.x, point.y);
        });
        
        // Find holes for this shape - improved hole detection logic
        let holesAdded = 0;
        
        for (let j = 0; j < allShapes.length; j++) {
            if (i === j || allShapes[j].processed) continue;
            
            const potentialHole = allShapes[j];
            
            // A hole should be substantially smaller
            if (potentialHole.area >= outerShape.area * 0.9) continue;
            
            // Test if shape is contained inside - improved containment test
            if (isShapeContainedIn(potentialHole.shape, outerShape.shape)) {
                console.log(`Found hole: shape #${j} inside shape #${i} (area ratio: ${(potentialHole.area/outerShape.area).toFixed(3)})`);
                potentialHole.processed = true;
                
                // Add as a hole
                const holePath = new THREE.Path();
                const holePoints = potentialHole.shape.getPoints(36);
                
                holePoints.forEach((point, idx) => {
                    if (idx === 0) holePath.moveTo(point.x, point.y);
                    else holePath.lineTo(point.x, point.y);
                });
                
                holePath.closePath();
                mainShape.holes.push(holePath);
                holesAdded++;
            }
        }
        
        // Create extrusion with any detected holes
        console.log(`Extruding shape #${i} with ${holesAdded} holes`);
        createExtrudedShape(mainShape, scale, lowQuality);
        processedCount++;
        
        // Update progress for exports
        if (isExporting && exportSettings.progressCallback && (processedCount % 5 === 0)) {
            const progress = Math.round(processedCount / allShapes.length * 100);
            exportSettings.progressCallback(progress);
        }
    }
    
    console.log(`Created ${processedCount} extrusions with holes from ${allShapes.length} shapes`);
    
    // Hide loading indicator when done (if not exporting)
    if (!isExporting) {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Calculate the area of a shape to determine winding direction
function calculateShapeArea(shape) {
    const points = shape.getPoints(36);
    let area = 0;
    
    // Use shoelace formula to calculate signed area
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    
    return area / 2;
}

// Check if one shape is contained within another
function isShapeContainedIn(innerShape, outerShape) {
    const innerPoints = innerShape.getPoints(36); // More sampling points for accuracy
    const outerPoints = outerShape.getPoints(48);
    
    // First quick test: check bounding boxes
    const innerBounds = getBoundingBox(innerPoints);
    const outerBounds = getBoundingBox(outerPoints);
    
    // If inner bounding box extends beyond outer, it can't be contained
    if (innerBounds.minX < outerBounds.minX || innerBounds.maxX > outerBounds.maxX ||
        innerBounds.minY < outerBounds.minY || innerBounds.maxY > outerBounds.maxY) {
        console.log("Bounding box test failed - shape not contained");
        return false;
    }
    
    // For a shape to be considered inside another, most of its points should be inside
    let pointsInside = 0;
    
    // Use adaptive threshold based on shape complexity
    // Smaller shapes need higher percentage to avoid false positives
    let threshold = 0.7; // Start with 70%
    
    // For shapes with few points, use higher threshold
    if (innerPoints.length < 8) {
        threshold = 0.85;
    }
    
    // Check if most points are inside
    for (const point of innerPoints) {
        if (isPointInPolygon(point, outerPoints)) {
            pointsInside++;
        }
    }
    
    const percentInside = pointsInside / innerPoints.length;
    
    // Area-based checks
    const innerArea = Math.abs(calculateShapeArea(innerShape));
    const outerArea = Math.abs(calculateShapeArea(outerShape));
    const areaRatio = innerArea / outerArea;
    
    // Log detailed containment info for debugging
    console.log(`Containment test: ${(percentInside * 100).toFixed(1)}% inside, ratio=${areaRatio.toFixed(3)}, threshold=${threshold}`);
    
    // Three-part test for hole detection:
    // 1. Most points must be inside the outer shape
    // 2. The inner shape must be substantially smaller than the outer shape
    // 3. For SVGs with many shapes, relax the area constraint
    return (percentInside >= threshold) && (areaRatio < 0.9);
}

// Helper function to get bounding box of points
function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const pt of points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
    }
    
    return { minX, minY, maxX, maxY };
}

// Update sync processing to use improved hole detection
function processPathsDirectly(paths, options) {
    const { centerX, centerY, scale, lowQuality, isExporting } = options;
    const totalPaths = paths.length;
    
    console.log(`Processing ${totalPaths} paths directly using simplified approach`);
    
    // First collect all shapes with their metadata
    const allShapes = [];
    
    // First pass: create all shapes and gather metadata
    for (let i = 0; i < totalPaths; i++) {
        const path = paths[i];
        console.log(`Processing path ${i+1}/${totalPaths} with ${path.subPaths.length} subpaths`);
        
        // Process each subpath
        path.subPaths.forEach((subPath, subPathIndex) => {
            try {
                // Create a shape from the subpath
                const shape = createShapeFromSubPath(subPath);
                if (!shape) return;
                
                // Center and scale the shape
                const points = shape.getPoints(36);
                points.forEach(point => {
                    point.x = (point.x - centerX) * scale;
                    point.y = (point.y - centerY) * scale;
                });
                
                // Calculate area to determine winding direction
                const area = calculateShapeArea(shape);
                
                // Store shape with metadata
                allShapes.push({
                    shape: shape,
                    area: Math.abs(area),
                    isClockwise: area < 0,  // In SVG, clockwise paths are typically holes
                    pathIndex: i,
                    subPathIndex: subPathIndex,
                    processed: false
                });
                
                console.log(`Created shape ${allShapes.length-1} with area ${area.toFixed(2)}, isClockwise: ${area < 0}`);
                
            } catch (error) {
                console.error(`Error processing subpath ${subPathIndex}:`, error);
            }
        });
    }
    
    // Sort shapes by area, largest first (outer shapes tend to be larger)
    allShapes.sort((a, b) => b.area - a.area);
    
    // Second pass: identify outer shapes and their holes
    let processedCount = 0;
    
    // Process large shapes first as potential outer shapes
    for (let i = 0; i < allShapes.length; i++) {
        if (allShapes[i].processed) continue;
        
        const outerShape = allShapes[i];
        outerShape.processed = true;
        
        // IMPROVED: More permissive hole detection (almost no auto-skipping)
        // Only skip tiny shapes that are likely to be artifacts
        if (outerShape.isClockwise && 
            outerShape.area < allShapes[0].area * 0.01) { // Reduced from 0.1 to 0.01
            console.log(`Skipping very small shape #${i} (area ratio: ${(outerShape.area/allShapes[0].area).toFixed(4)})`);
            continue;
        }
        
        // Create a new shape for extrusion
        const mainShape = new THREE.Shape();
        
        // Copy points from the outer shape
        const mainPoints = outerShape.shape.getPoints(36);
        mainPoints.forEach((point, idx) => {
            if (idx === 0) mainShape.moveTo(point.x, point.y);
            else mainShape.lineTo(point.x, point.y);
        });
        
        // Find holes for this shape - improved hole detection logic
        let holesAdded = 0;
        
        for (let j = 0; j < allShapes.length; j++) {
            if (i === j || allShapes[j].processed) continue;
            
            const potentialHole = allShapes[j];
            
            // A hole should be substantially smaller
            if (potentialHole.area >= outerShape.area * 0.9) continue;
            
            // Test if shape is contained inside - improved containment test
            if (isShapeContainedIn(potentialHole.shape, outerShape.shape)) {
                console.log(`Found hole: shape #${j} inside shape #${i} (area ratio: ${(potentialHole.area/outerShape.area).toFixed(3)})`);
                potentialHole.processed = true;
                
                // Add as a hole
                const holePath = new THREE.Path();
                const holePoints = potentialHole.shape.getPoints(36);
                
                holePoints.forEach((point, idx) => {
                    if (idx === 0) holePath.moveTo(point.x, point.y);
                    else holePath.lineTo(point.x, point.y);
                });
                
                holePath.closePath();
                mainShape.holes.push(holePath);
                holesAdded++;
            }
        }
        
        // Create extrusion with any detected holes
        console.log(`Extruding shape #${i} with ${holesAdded} holes`);
        createExtrudedShape(mainShape, scale, lowQuality);
        processedCount++;
        
        // Update progress for exports
        if (isExporting && exportSettings.progressCallback && (processedCount % 5 === 0)) {
            const progress = Math.round(processedCount / allShapes.length * 100);
            exportSettings.progressCallback(progress);
        }
    }
    
    console.log(`Created ${processedCount} extrusions with holes from ${allShapes.length} shapes`);
    
    // Hide loading indicator when done (if not exporting)
    if (!isExporting) {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Calculate the area of a shape to determine winding direction
function calculateShapeArea(shape) {
    const points = shape.getPoints(36);
    let area = 0;
    
    // Use shoelace formula to calculate signed area
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    
    return area / 2;
}

// Check if one shape is contained within another
function isShapeContainedIn(innerShape, outerShape) {
    const innerPoints = innerShape.getPoints(36); // More sampling points for accuracy
    const outerPoints = outerShape.getPoints(48);
    
    // First quick test: check bounding boxes
    const innerBounds = getBoundingBox(innerPoints);
    const outerBounds = getBoundingBox(outerPoints);
    
    // If inner bounding box extends beyond outer, it can't be contained
    if (innerBounds.minX < outerBounds.minX || innerBounds.maxX > outerBounds.maxX ||
        innerBounds.minY < outerBounds.minY || innerBounds.maxY > outerBounds.maxY) {
        console.log("Bounding box test failed - shape not contained");
        return false;
    }
    
    // For a shape to be considered inside another, most of its points should be inside
    let pointsInside = 0;
    
    // Use adaptive threshold based on shape complexity
    // Smaller shapes need higher percentage to avoid false positives
    let threshold = 0.7; // Start with 70%
    
    // For shapes with few points, use higher threshold
    if (innerPoints.length < 8) {
        threshold = 0.85;
    }
    
    // Check if most points are inside
    for (const point of innerPoints) {
        if (isPointInPolygon(point, outerPoints)) {
            pointsInside++;
        }
    }
    
    const percentInside = pointsInside / innerPoints.length;
    
    // Area-based checks
    const innerArea = Math.abs(calculateShapeArea(innerShape));
    const outerArea = Math.abs(calculateShapeArea(outerShape));
    const areaRatio = innerArea / outerArea;
    
    // Log detailed containment info for debugging
    console.log(`Containment test: ${(percentInside * 100).toFixed(1)}% inside, ratio=${areaRatio.toFixed(3)}, threshold=${threshold}`);
    
    // Three-part test for hole detection:
    // 1. Most points must be inside the outer shape
    // 2. The inner shape must be substantially smaller than the outer shape
    // 3. For SVGs with many shapes, relax the area constraint
    return (percentInside >= threshold) && (areaRatio < 0.9);
}

// Helper function to get bounding box of points
function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const pt of points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
    }
    
    return { minX, minY, maxX, maxY };
}

// Update sync processing to use improved hole detection
function processPathsDirectly(paths, options) {
    const { centerX, centerY, scale, lowQuality, isExporting } = options;
    const totalPaths = paths.length;
    
    console.log(`Processing ${totalPaths} paths directly using simplified approach`);
    
    // First collect all shapes with their metadata
    const allShapes = [];
    
    // First pass: create all shapes and gather metadata
    for (let i = 0; i < totalPaths; i++) {
        const path = paths[i];
        console.log(`Processing path ${i+1}/${totalPaths} with ${path.subPaths.length} subpaths`);
        
        // Process each subpath
        path.subPaths.forEach((subPath, subPathIndex) => {
            try {
                // Create a shape from the subpath
                const shape = createShapeFromSubPath(subPath);
                if (!shape) return;
                
                // Center and scale the shape
                const points = shape.getPoints(36);
                points.forEach(point => {
                    point.x = (point.x - centerX) * scale;
                    point.y = (point.y - centerY) * scale;
                });
                
                // Calculate area to determine winding direction
                const area = calculateShapeArea(shape);
                
                // Store shape with metadata
                allShapes.push({
                    shape: shape,
                    area: Math.abs(area),
                    isClockwise: area < 0,  // In SVG, clockwise paths are typically holes
                    pathIndex: i,
                    subPathIndex: subPathIndex,
                    processed: false
                });
                
                console.log(`Created shape ${allShapes.length-1} with area ${area.toFixed(2)}, isClockwise: ${area < 0}`);
                
            } catch (error) {
                console.error(`Error processing subpath ${subPathIndex}:`, error);
            }
        });
    }
    
    // Sort shapes by area, largest first (outer shapes tend to be larger)
    allShapes.sort((a, b) => b.area - a.area);
    
    // Second pass: identify outer shapes and their holes
    let processedCount = 0;
    
    // Process large shapes first as potential outer shapes
    for (let i = 0; i < allShapes.length; i++) {
        if (allShapes[i].processed) continue;
        
        const outerShape = allShapes[i];
        outerShape.processed = true;
        
        // IMPROVED: More permissive hole detection (almost no auto-skipping)
        // Only skip tiny shapes that are likely to be artifacts
        if (outerShape.isClockwise && 
            outerShape.area < allShapes[0].area * 0.01) { // Reduced from 0.1 to 0.01
            console.log(`Skipping very small shape #${i} (area ratio: ${(outerShape.area/allShapes[0].area).toFixed(4)})`);
            continue;
        }
        
        // Create a new shape for extrusion
        const mainShape = new THREE.Shape();
        
        // Copy points from the outer shape
        const mainPoints = outerShape.shape.getPoints(36);
        mainPoints.forEach((point, idx) => {
            if (idx === 0) mainShape.moveTo(point.x, point.y);
            else mainShape.lineTo(point.x, point.y);
        });
        
        // Find holes for this shape - improved hole detection logic
        let holesAdded = 0;
        
        for (let j = 0; j < allShapes.length; j++) {
            if (i === j || allShapes[j].processed) continue;
            
            const potentialHole = allShapes[j];
            
            // A hole should be substantially smaller
            if (potentialHole.area >= outerShape.area * 0.9) continue;
            
            // Test if shape is contained inside - improved containment test
            if (isShapeContainedIn(potentialHole.shape, outerShape.shape)) {
                console.log(`Found hole: shape #${j} inside shape #${i} (area ratio: ${(potentialHole.area/outerShape.area).toFixed(3)})`);
                potentialHole.processed = true;
                
                // Add as a hole
                const holePath = new THREE.Path();
                const holePoints = potentialHole.shape.getPoints(36);
                
                holePoints.forEach((point, idx) => {
                    if (idx === 0) holePath.moveTo(point.x, point.y);
                    else holePath.lineTo(point.x, point.y);
                });
                
                holePath.closePath();
                mainShape.holes.push(holePath);
                holesAdded++;
            }
        }
        
        // Create extrusion with any detected holes
        console.log(`Extruding shape #${i} with ${holesAdded} holes`);
        createExtrudedShape(mainShape, scale, lowQuality);
        processedCount++;
        
        // Update progress for exports
        if (isExporting && exportSettings.progressCallback && (processedCount % 5 === 0)) {
            const progress = Math.round(processedCount / allShapes.length * 100);
            exportSettings.progressCallback(progress);
        }
    }
    
    console.log(`Created ${processedCount} extrusions with holes from ${allShapes.length} shapes`);
    
    // Hide loading indicator when done (if not exporting)
    if (!isExporting) {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Calculate the area of a shape to determine winding direction
function calculateShapeArea(shape) {
    const points = shape.getPoints(36);
    let area = 0;
    
    // Use shoelace formula to calculate signed area
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    
    return area / 2;
}

// Check if one shape is contained within another
function isShapeContainedIn(innerShape, outerShape) {
    const innerPoints = innerShape.getPoints(36); // More sampling points for accuracy
    const outerPoints = outerShape.getPoints(48);
    
    // First quick test: check bounding boxes
    const innerBounds = getBoundingBox(innerPoints);
    const outerBounds = getBoundingBox(outerPoints);
    
    // If inner bounding box extends beyond outer, it can't be contained
    if (innerBounds.minX < outerBounds.minX || innerBounds.maxX > outerBounds.maxX ||
        innerBounds.minY < outerBounds.minY || innerBounds.maxY > outerBounds.maxY) {
        console.log("Bounding box test failed - shape not contained");
        return false;
    }
    
    // For a shape to be considered inside another, most of its points should be inside
    let pointsInside = 0;
    
    // Use adaptive threshold based on shape complexity
    // Smaller shapes need higher percentage to avoid false positives
    let threshold = 0.7; // Start with 70%
    
    // For shapes with few points, use higher threshold
    if (innerPoints.length < 8) {
        threshold = 0.85;
    }
    
    // Check if most points are inside
    for (const point of innerPoints) {
        if (isPointInPolygon(point, outerPoints)) {
            pointsInside++;
        }
    }
    
    const percentInside = pointsInside / innerPoints.length;
    
    // Area-based checks
    const innerArea = Math.abs(calculateShapeArea(innerShape));
    const outerArea = Math.abs(calculateShapeArea(outerShape));
    const areaRatio = innerArea / outerArea;
    
    // Log detailed containment info for debugging
    console.log(`Containment test: ${(percentInside * 100).toFixed(1)}% inside, ratio=${areaRatio.toFixed(3)}, threshold=${threshold}`);
    
    // Three-part test for hole detection:
    // 1. Most points must be inside the outer shape
    // 2. The inner shape must be substantially smaller than the outer shape
    // 3. For SVGs with many shapes, relax the area constraint
    return (percentInside >= threshold) && (areaRatio < 0.9);
}

// Helper function to get bounding box of points
function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const pt of points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
    }
    
    return { minX, minY, maxX, maxY };
}

// Update the async version to use the same hole detection logic
function processPathsDirectlyAsync(paths, options) {
    const { centerX, centerY, scale, lowQuality } = options;
    const batchSize = 5;
    
    // First collect all shapes with their metadata (same as in the sync version)
    const allShapes = [];
    let currentPathIndex = 0;
    const totalPaths = paths.length;
    
    console.log(`Processing ${totalPaths} paths asynchronously with hole detection`);
    
    // Phase 1: Collect all shapes
    function collectShapes() {
        const startTime = performance.now();
        let processedInBatch = 0;
        
        while (processedInBatch < batchSize && currentPathIndex < totalPaths) {
            const path = paths[currentPathIndex];
            
            // Process each subpath
            path.subPaths.forEach((subPath, subPathIndex) => {
                try {
                    // Create a shape from the subpath
                    const shape = createShapeFromSubPath(subPath);
                    if (!shape) return;
                    
                    // Center and scale the shape
                    const points = shape.getPoints(24);
                    points.forEach(point => {
                        point.x = (point.x - centerX) * scale;
                        point.y = (point.y - centerY) * scale;
                    });
                    
                    // Calculate area to determine winding direction
                    const area = calculateShapeArea(shape);
                    
                    // Store shape with metadata
                    allShapes.push({
                        shape: shape,
                        area: Math.abs(area),
                        isClockwise: area < 0,
                        pathIndex: currentPathIndex,
                        subPathIndex: subPathIndex,
                        processed: false
                    });
                    
                } catch (error) {
                    console.error(`Error processing async subpath ${subPathIndex}:`, error);
                }
            });
            
            currentPathIndex++;
            processedInBatch++;
            
            if (performance.now() - startTime > 16) { // 16ms = ~60fps
                break;
            }
        }
        
        // Update progress
        const percentComplete = Math.round((currentPathIndex / totalPaths) * 100);
        console.log(`Shape collection: ${currentPathIndex}/${totalPaths} paths (${percentComplete}%)`);
        
        // Continue collecting shapes or move to processing phase
        if (currentPathIndex < totalPaths) {
            setTimeout(collectShapes, 0);
        } else {
            console.log(`Collected ${allShapes.length} shapes, sorting by area and processing...`);
            // Sort shapes by area, largest first (outer shapes tend to be larger)
            allShapes.sort((a, b) => b.area - a.area);
            setTimeout(processShapesWithHoles, 0);
        }
    }
    
    // Phase 2: Process shapes with hole detection
    let processedShapeIndex = 0;
    
    function processShapesWithHoles() {
        const startTime = performance.now();
        let processedInBatch = 0;
        
        while (processedInBatch < Math.max(1, batchSize/2) && processedShapeIndex < allShapes.length) {
            if (allShapes[processedShapeIndex].processed) {
                processedShapeIndex++;
                continue;
            }
            
            const outerShape = allShapes[processedShapeIndex];
            outerShape.processed = true;
            
            // IMPROVED: More permissive hole detection (almost no auto-skipping)
            // Only skip tiny shapes that are likely to be artifacts
            if (outerShape.isClockwise && 
                processedShapeIndex > 0 && 
                outerShape.area < allShapes[0].area * 0.01) { // Reduced from 0.1 to 0.01
                console.log(`Skipping very small shape #${processedShapeIndex} (area ratio: ${(outerShape.area/allShapes[0].area).toFixed(4)})`);
                processedShapeIndex++;
                continue;
            }
            
            // Create a new shape for extrusion
            const mainShape = new THREE.Shape();
            
            // Copy points from the outer shape
            const mainPoints = outerShape.shape.getPoints(24);
            mainPoints.forEach((point, idx) => {
                if (idx === 0) mainShape.moveTo(point.x, point.y);
                else mainShape.lineTo(point.x, point.y);
            });
            
            // Find holes for this shape
            let holesAdded = 0;
            
            for (let j = 0; j < allShapes.length; j++) {
                if (processedShapeIndex === j || allShapes[j].processed) continue;
                
                const potentialHole = allShapes[j];
                
                // A hole should be substantially smaller
                if (potentialHole.area >= outerShape.area * 0.9) continue;
                
                // Test if shape is contained inside - improved containment test
                if (isShapeContainedIn(potentialHole.shape, outerShape.shape)) {
                    console.log(`Found hole: shape #${j} inside shape #${processedShapeIndex}`);
                    potentialHole.processed = true;
                    
                    // Add as a hole
                    const holePath = new THREE.Path();
                    const holePoints = potentialHole.shape.getPoints(24);
                    
                    holePoints.forEach((point, idx) => {
                        if (idx === 0) holePath.moveTo(point.x, point.y);
                        else holePath.lineTo(point.x, point.y);
                    });
                    
                    holePath.closePath();
                    mainShape.holes.push(holePath);
                    holesAdded++;
                }
            }
            
            // Create extrusion with any detected holes
            console.log(`Extruding shape #${processedShapeIndex} with ${holesAdded} holes`);
            createExtrudedShape(mainShape, scale, lowQuality);
            
            processedShapeIndex++;
            processedInBatch++;
            
            if (performance.now() - startTime > 16) {
                break;
            }
        }
        
        // Update progress
        const percentComplete = Math.round((processedShapeIndex / allShapes.length) * 100);
        console.log(`Shape processing: ${processedShapeIndex}/${allShapes.length} shapes (${percentComplete}%)`);
        
        // Continue processing or finish
        if (processedShapeIndex < allShapes.length) {
            setTimeout(processShapesWithHoles, 0);
        } else {
            console.log(`Async processing complete. Created ${extrudedGroup.children.length} extruded objects.`);
            document.getElementById('loading').classList.add('hidden');
        }
    }
    
    // Start the first phase
    collectShapes();
}

// Check if a point is inside a polygon using ray casting algorithm - fixed implementation
function isPointInPolygon(point, polygon) {
    if (!point || !polygon || polygon.length === 0) return false;
    
    // Use a more robust ray-casting algorithm with special handling for edge cases
    let inside = false;
    const x = point.x, y = point.y;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        // Check for exact matches to handle edge cases
        if ((xi === x && yi === y) || (xj === x && yj === y)) {
            return true; // Point is a vertex
        }
        
        // Check if point is on the edge
        if ((yi === y && yj === y) && // horizontal edge
            ((xi <= x && x <= xj) || (xj <= x && x <= xi))) {
            return true; // Point is on horizontal edge
        }
        
        if ((xi === x && xj === x) && // vertical edge
            ((yi <= y && y <= yj) || (yj <= y && y <= yi))) {
            return true; // Point is on vertical edge
        }
        
        // Standard ray-casting algorithm
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        
        if (intersect) inside = !inside;
    }
    
    return inside;
}

// Improved function to create a shape from a subpath - handles both open and closed paths
function createShapeFromSubPath(subPath) {
    if (!subPath || !subPath.curves || subPath.curves.length === 0) {
        return null;
    }
    
    // Create a new shape
    const shape = new THREE.Shape();
    
    // Determine starting point
    let startPoint = getPointFromCurve(subPath.curves[0], 0);
    if (!startPoint) {
        console.warn("Could not find starting point for subpath");
        return null;
    }
    
    // More detailed logging 
    const isClosedPath = subPath.closed || 
        (subPath.curves.length > 2 && 
         distanceBetweenPoints(
             getPointFromCurve(subPath.curves[0], 0),
             getPointFromCurve(subPath.curves[subPath.curves.length-1], 1)
         ) < 0.1);
    
    console.log(`Processing ${isClosedPath ? 'effectively closed' : 'open'} subpath with ${subPath.curves.length} curves`);
    
    // Start the shape
    shape.moveTo(startPoint.x, startPoint.y);
    
    // Add all curves to the shape
    subPath.curves.forEach(curve => {
        addCurveToShape(curve, shape);
    });
    
    // For open paths, we need to close them for proper extrusion
    if (!subPath.closed) {
        // Get the last point of the last curve
        let lastCurve = subPath.curves[subPath.curves.length - 1];
        let lastPoint = getPointFromCurve(lastCurve, 1);
        
        // If the distance between start and end is significant, connect them
        if (lastPoint && startPoint) {
            const distance = distanceBetweenPoints(lastPoint, startPoint);
            
            if (distance > 0.001) {
                // Connect the last point back to the first point
                shape.lineTo(startPoint.x, startPoint.y);
                console.log(`Closed open path by connecting end to start (distance: ${distance.toFixed(3)})`);
            }
        }
    }
    
    // Always ensure the shape is closed for extrusion
    shape.closePath();
    
    return shape;
}

// Helper function to calculate distance between points
function distanceBetweenPoints(p1, p2) {
    if (!p1 || !p2) return Infinity;
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Helper function to get a point from a curve at t parameter (improved to handle more curve types)
function getPointFromCurve(curve, t) {
    if (!curve) return null;
    
    // Try to get point using getPoint method first
    try {
        return curve.getPoint(t);
    } catch (e) {
        // Fallback for different curve types based on t value
        if (t === 0) {
            // Return start point
            if (curve.v0) return curve.v0;
            if (curve.v1) return curve.v1;
            if (curve.p0) return curve.p0;
        } else if (t === 1) {
            // Return end point
            if (curve.v3) return curve.v3;
            if (curve.v2) return curve.v2;
            if (curve.p1) return curve.p1;
        }
        
        // More fallbacks for other curve types
        if (curve.points && curve.points.length > 0) {
            const index = Math.min(Math.floor(t * curve.points.length), curve.points.length - 1);
            return curve.points[index];
        }
        
        return null;
    }
}

// Helper function to add a curve to a shape (improved to handle more curve types)
function addCurveToShape(curve, shape) {
    if (!curve) return;
    
    try {
        if (curve.isLineCurve) {
            shape.lineTo(curve.v2.x, curve.v2.y);
        } 
        else if (curve.isQuadraticBezierCurve) {
            shape.quadraticCurveTo(
                curve.v1.x, curve.v1.y,
                curve.v2.x, curve.v2.y
            );
        }
        else if (curve.isCubicBezierCurve) {
            shape.bezierCurveTo(
                curve.v1.x, curve.v1.y,
                curve.v2.x, curve.v2.y,
                curve.v3.x, curve.v3.y
            );
        }
        else if (curve.getPoints) {
            // Use more points for better accuracy
            const points = curve.getPoints(24);
            points.forEach((point, i) => {
                if (i > 0) shape.lineTo(point.x, point.y);
            });
        }
        else if (curve.v2) {
            // Fallback for simple line-like curves
            shape.lineTo(curve.v2.x, curve.v2.y);
        }
        else if (curve.p1) {
            // Fallback for point-based curves
            shape.lineTo(curve.p1.x, curve.p1.y);
        }
        else {
            console.warn("Unknown curve type, unable to add to shape");
        }
    } catch (e) {
        console.warn("Error adding curve to shape:", e);
        // Try to add end point as a fallback
        try {
            const endPoint = getPointFromCurve(curve, 1);
            if (endPoint) {
                shape.lineTo(endPoint.x, endPoint.y);
                console.log("Used fallback point for curve");
            }
        } catch (fallbackError) {
            console.error("Even fallback failed for curve", fallbackError);
        }
    }
}

// Helper function to create and position extruded shapes with quality option
function createExtrudedShape(shape, scale, lowQuality = false) {
    // Ensure valid height
    const validHeight = Math.max(0.1, Number(extrusionHeight) || 1);
    
    // Simplify quality settings
    const steps = isHighQualityMode ? 4 : (lowQuality ? 1 : 2);
    
    // Use simplified extrude settings
    const extrudeSettings = {
        steps: steps,
        depth: validHeight,
        bevelEnabled: !lowQuality,
        bevelThickness: 0.05,
        bevelSize: 0.02,
        bevelSegments: isHighQualityMode ? 3 : 1,
        curveSegments: isHighQualityMode ? 24 : (lowQuality ? 8 : 12)
    };
    
    // Generate a unique color
    const uniqueColor = generateDistinctColor(shapeColorCounter++);
    
    // Create material
    const material = new THREE.MeshStandardMaterial({
        color: uniqueColor,
        roughness: 0.5,
        metalness: 0.2,
        flatShading: false,
        side: THREE.DoubleSide
    });
    
    try {
        // Create the geometry
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.computeVertexNormals();
        
        // Create mesh with the extruded geometry
        const mesh = new THREE.Mesh(geometry, material);
        
        // FIXED: Scale factor implementation with explicit debugging
        const finalScaleX = scale * 0.25;
        const finalScaleY = -scale * 0.25;
        
        console.log(`Creating extrusion with scale metrics:
            - Input scale: ${scale.toFixed(3)}
            - Final X scale: ${finalScaleX.toFixed(3)}
            - Final Y scale: ${finalScaleY.toFixed(3)}`);
        
        // Apply scaling with fixed implementation
        mesh.scale.set(finalScaleX, finalScaleY, 1);
        
        // Rotate to lay flat on top of the brick
        mesh.rotation.x = Math.PI / 2;
        
        // Position exactly on top of the brick's top face with offset
        // Apply the position offset from UI controls - USE ACTUAL Y VALUE
        mesh.position.set(
            extrusionPosition.x, 
            brickDimensions.height + extrusionPosition.y, 
            extrusionPosition.z
        );
        
        // Remove any duplicate geometries that might cause the extra layer
        mesh.updateMatrix();
        
        // Add to the extrusion group
        extrudedGroup.add(mesh);
        
        // Debug logging for position
        console.log(`Positioned extrusion at: (${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z})`);
    } catch (error) {
        console.error("Error creating extruded shape:", error);
    }
}

// Generate a distinct color for each shape
function generateDistinctColor(index) {
    const goldenRatioConjugate = 0.618033988749895;
    const hue = (index * goldenRatioConjugate) % 1;
    return new THREE.Color().setHSL(hue, 0.7, 0.55);
}

// Function to properly clean up previous SVG resources
function cleanupPreviousSVG() {
    // Clear the lastSvgData reference
    lastSvgData = null;
    
    // Dispose of the texture if it exists
    if (texture) {
        texture.dispose();
        texture = null;
    }
    
    // Clear all extruded shapes
    if (extrudedGroup) {
        while (extrudedGroup.children.length > 0) {
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
        
        // Ensure the extrusion group has a clean matrix
        extrudedGroup.position.set(0, 0, 0);
        extrudedGroup.rotation.set(0, 0, 0);
        extrudedGroup.scale.set(1, 1, 1);
        extrudedGroup.updateMatrix();
        extrudedGroup.updateMatrixWorld(true);
    } else {
        // Initialize extrudedGroup if it doesn't exist
        extrudedGroup = new THREE.Group();
        scene.add(extrudedGroup);
    }
    
    // Reset shape color counter when cleaning up
    shapeColorCounter = 0;
    
    // Reset the brick's top face material to default if it was modified
    if (brick && brick.material && Array.isArray(brick.material) && brick.material.length > 2) {
        if (brick.material[2].name === 'top-textured') {
            if (brick.material[2].map) {
                brick.material[2].map.dispose();
            }
            brick.material[2].dispose();
            // Replace with default material
            brick.material[2] = new THREE.MeshStandardMaterial({ 
                color: brickColor,
                name: 'top'
            });
        }
    }
    
    // Reset extrusion-related UI state if needed
    document.getElementById('downloadSTL').disabled = true;
}

// Ensure handleSVGUpload is properly defined and globally accessible
function handleSVGUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Store the SVG filename (without extension) for export
    currentSvgFilename = file.name.replace(/\.svg$/i, "");
    
    // Show loading indicator
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('loading').textContent = 'Loading SVG...';
    
    // Clean up previous SVG resources before loading a new one
    cleanupPreviousSVG();
    
    // Create FileReader to read the SVG
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const svgData = e.target.result;
        lastSvgData = svgData; // Store for later reuse
        
        // Create a temporary img element to load the SVG for the texture
        const img = new Image();
        
        // Define the onload handler without recursion
        img.onload = function() {
            // Increase canvas size for better resolution
            const canvas = document.createElement('canvas');
            // Use higher resolution canvas - increased from 1024 to 2048 for better quality
            canvas.width = 2048;
            canvas.height = 2048;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Apply transformations: 180-degree rotation AND horizontal flip
            ctx.save();
            // Translate to center
            ctx.translate(canvas.width/2, canvas.height/2);
            // Apply 180-degree rotation
            ctx.rotate(Math.PI);
            // Apply horizontal flip
            ctx.scale(-1, 1);
            // Translate back
            ctx.translate(-canvas.width/2, -canvas.height/2);
            
            // Draw SVG with proper scaling to maintain quality
            // Use proper scaling to maintain aspect ratio
            const imgAspect = img.width / img.height;
            const canvasAspect = canvas.width / canvas.height;
            
            let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
            
            if (imgAspect > canvasAspect) {
                // Image is wider than canvas aspect ratio
                drawWidth = canvas.width;
                drawHeight = canvas.width / imgAspect;
                offsetY = (canvas.height - drawHeight) / 2;
            } else {
                // Image is taller than canvas aspect ratio
                drawHeight = canvas.height;
                drawWidth = canvas.height * imgAspect;
                offsetX = (canvas.width - drawWidth) / 2;
            }
            
            // Draw with proper positioning and size to maintain quality
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            
            // Restore the context to remove transformations for future operations
            ctx.restore();
            
            // Create texture from canvas
            texture = new THREE.CanvasTexture(canvas);
            // Set maximum anisotropy for better texture quality at angles
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            // Use high-quality texture settings
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            // Apply texture to the top face of the brick (index 2 in BoxGeometry)
            if (brick.material && Array.isArray(brick.material) && brick.material.length > 2) {
                brick.material[2] = new THREE.MeshStandardMaterial({ 
                    map: texture,
                    roughness: 0.7,
                    metalness: 0.1,
                    name: 'top-textured' // Add name for clarity
                });
                brick.material[2].needsUpdate = true; // Flag material update
            } else {
                console.error("Brick material array is not set up correctly.");
            }

            // Parse SVG for extrusion - start with low quality for responsiveness
            try {
                scheduleInitialSVGParsing(svgData);
            } finally {
                // Enable STL download button only if parsing likely succeeded
                document.getElementById('downloadSTL').disabled = false; 
            }
        };
        
        // Define the error handler
        img.onerror = function(e) {
            console.error('Error loading SVG:', e);
            document.getElementById('loading').classList.add('hidden');
            alert('Error loading SVG. Please try another file.');
        };
        
        // Use proper SVG loading with better error handling
        try {
            // Set the SVG data as the image source with proper encoding
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(svgBlob);
            
            // Set up a one-time cleanup function for the URL
            const originalOnload = img.onload;
            img.onload = function() {
                URL.revokeObjectURL(url);
                originalOnload.call(this);
            };
            
            const originalOnerror = img.onerror;
            img.onerror = function(e) {
                URL.revokeObjectURL(url);
                // Fall back to base64 encoding if blob URL fails
                console.warn("Blob URL loading failed, trying base64 encoding");
                img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                originalOnerror.call(this, e);
            };
            
            // Set the source to trigger loading
            img.src = url;
        } catch (encodingError) {
            console.error("Error creating SVG blob URL:", encodingError);
            // Fall back to the base64 encoding method
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        }
    };
    
    reader.onerror = function() {
        console.error('Error reading file');
        document.getElementById('loading').classList.add('hidden');
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsText(file);
}

// Reset the counter whenever we load a new SVG
shapeColorCounter = 0;
