window.SVGProcessing = window.SVGProcessing || {};
window.SVGProcessing.Holes = {};

function getShapeCenter(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    
    return new THREE.Vector2(
        (minX + maxX) / 2,
        (minY + maxY) / 2
    );
}
window.getShapeCenter = getShapeCenter;
window.SVGProcessing.Holes.getShapeCenter = getShapeCenter;

function isPointInPolygon(point, polygonVertices) {
    let inside = false;
    const x = point.x, y = point.y;
    const epsilon = 0.00001; 
    
    for (const vertex of polygonVertices) {
        if (Math.abs(vertex.x - x) < epsilon && Math.abs(vertex.y - y) < epsilon) {
            return true; 
        }
    }
    
    for (let i = 0, j = polygonVertices.length - 1; i < polygonVertices.length; j = i++) {
        const xi = polygonVertices[i].x, yi = polygonVertices[i].y;
        const xj = polygonVertices[j].x, yj = polygonVertices[j].y;
        
        if (Math.abs(yi - yj) < epsilon && Math.abs(y - yi) < epsilon &&
            x >= Math.min(xi, xj) && x <= Math.max(xi, xj)) {
            return true;
        }
        
        if (Math.abs(xi - xj) < epsilon && Math.abs(x - xi) < epsilon &&
            y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) {
            return true;
        }
        
        if (Math.abs(yi - yj) > epsilon && Math.abs(xi - xj) > epsilon) {
            const slope = (yj - yi) / (xj - xi);
            const intercept = yi - slope * xi;
            const yOnLine = slope * x + intercept;
            
            if (Math.abs(y - yOnLine) < epsilon &&
                x >= Math.min(xi, xj) && x <= Math.max(xi, xj) &&
                y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) {
                return true;
            }
        }
        
        const intersect = ((yi > y) !== (yj > y)) &&
                          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}
window.isPointInPolygon = isPointInPolygon;
window.SVGProcessing.Holes.isPointInPolygon = isPointInPolygon;

function calculatePerimeter(points) {
    if (points.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        perimeter += points[i].distanceTo(points[j]);
    }
    
    return perimeter;
}
window.calculatePerimeter = calculatePerimeter;
window.SVGProcessing.Holes.calculatePerimeter = calculatePerimeter;

// Helper function to check if a hole is valid for a shape
function isHoleInsideShape(holePoints, shapePoints) {
    if (holePoints.length < 3 || shapePoints.length < 3) {
        return false;
    }
    
    // Check if hole's center is inside the shape
    const holeCenter = getShapeCenter(holePoints);
    return isPointInPolygon(holeCenter, shapePoints);
}
window.isHoleInsideShape = isHoleInsideShape;
window.SVGProcessing.Holes.isHoleInsideShape = isHoleInsideShape;

// Helper function to calculate orientation of a polygon (clockwise or counterclockwise)
function calculatePolygonOrientation(points) {
    if (points.length < 3) return 0;
    
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        sum += (points[j].x - points[i].x) * (points[j].y + points[i].y);
    }
    
    // Positive for clockwise, negative for counterclockwise
    return Math.sign(sum);
}
window.calculatePolygonOrientation = calculatePolygonOrientation;
window.SVGProcessing.Holes.calculatePolygonOrientation = calculatePolygonOrientation;

// Enhanced hole validation with orientation check
function validateHole(holePath, outerShape, svgCenterX, svgCenterY, effectiveScale) {
    const pointsForHoles = Math.round(24 * svgResolution);
    const originalHolePoints = holePath.getPoints(pointsForHoles);
    
    if (originalHolePoints.length < 3) {
        console.warn(`Hole validation: Not enough points in hole (${originalHolePoints.length}). Minimum 3 required.`);
        return null;
    }
    
    const filteredHolePoints = [];
    let lastX = null, lastY = null;
    
    for (const p of originalHolePoints) {
        if (lastX === null || lastY === null || 
            (Math.abs(p.x - lastX) > 0.0001 || Math.abs(p.y - lastY) > 0.0001)) {
            filteredHolePoints.push(p);
            lastX = p.x;
            lastY = p.y;
        }
    }
    
    if (filteredHolePoints.length < 3) {
        console.warn(`Hole validation: Too few points after filtering duplicates (${filteredHolePoints.length}). Minimum 3 required.`);
        return null;
    }
    
    const transformedHolePoints = filteredHolePoints.map(p => 
        new THREE.Vector2(
            (p.x - svgCenterX) * effectiveScale,
            (p.y - svgCenterY) * -effectiveScale 
        )
    );
    
    let area = 0;
    for (let i = 0, j = transformedHolePoints.length - 1; i < transformedHolePoints.length; j = i++) {
        area += (transformedHolePoints[j].x + transformedHolePoints[i].x) * 
                (transformedHolePoints[j].y - transformedHolePoints[i].y);
    }
    area = Math.abs(area / 2);
    
    if (area < 0.0001) {
        console.warn(`Hole validation: Hole has effectively zero area (${area.toFixed(6)})`);
        return null;
    }
    
    // Get outer shape points for testing
    const outerShapePoints = outerShape.getPoints(48);
    
    // Check multiple points to see if hole is inside shape
    const holeCenter = getShapeCenter(transformedHolePoints);
    const inPolygonTests = [];
    
    // Test center point
    inPolygonTests.push({
        point: holeCenter,
        inside: isPointInPolygon(holeCenter, outerShapePoints)
    });
    
    // Test a few more points around the shape in case the center is unreliable
    for (let i = 0; i < Math.min(transformedHolePoints.length, 4); i++) {
        const idx = Math.floor(i * transformedHolePoints.length / 4);
        const point = transformedHolePoints[idx];
        inPolygonTests.push({
            point: point,
            inside: isPointInPolygon(point, outerShapePoints)
        });
    }
    
    // If most points are inside, we consider it a valid hole
    const insideCount = inPolygonTests.filter(test => test.inside).length;
    if (insideCount < Math.ceil(inPolygonTests.length / 2)) {
        console.warn(`Hole validation: Insufficient points (${insideCount}/${inPolygonTests.length}) inside the outer shape`);
        return null;
    }
    
    // Get orientation of hole and shape
    const holeOrientation = calculatePolygonOrientation(transformedHolePoints);
    const shapeOrientation = calculatePolygonOrientation(outerShapePoints);
    
    // Check whether hole orientation needs reversal
    const needsReversal = Math.sign(holeOrientation) === Math.sign(shapeOrientation);
    
    // Create the final hole path with correct winding direction
    const finalHolePath = new THREE.Path();
    
    // If orientations are the same, reverse the hole points for proper subtraction
    if (needsReversal) {
        console.log(`Hole validation: Reversing hole winding direction for proper subtraction`);
        const reversedPoints = [...transformedHolePoints].reverse();
        finalHolePath.moveTo(reversedPoints[0].x, reversedPoints[0].y);
        for (let k = 1; k < reversedPoints.length; k++) {
            finalHolePath.lineTo(reversedPoints[k].x, reversedPoints[k].y);
        }
    } else {
        // Normal case - use original points
        finalHolePath.moveTo(transformedHolePoints[0].x, transformedHolePoints[0].y);
        for (let k = 1; k < transformedHolePoints.length; k++) {
            finalHolePath.lineTo(transformedHolePoints[k].x, transformedHolePoints[k].y);
        }
    }
    
    finalHolePath.closePath(); 
    finalHolePath.userData = { 
        area: area,
        orientation: holeOrientation,
        originalHolePoints: transformedHolePoints,
        isHole: true,
        needsReversal: needsReversal
    };
    
    console.log(`Hole validation: Valid hole with area ${area.toFixed(4)}`);
    return finalHolePath;
}

window.validateHole = validateHole;
window.SVGProcessing.Holes.validateHole = validateHole;

// New function to debug hole geometry to help troubleshoot subtraction issues
function debugHoleGeometry(shape, holeColor = 0xff0000) {
    const shapePoints = shape.getPoints(24);
    const shapeGeometry = new THREE.BufferGeometry();
    const positions = [];
    
    for (const point of shapePoints) {
        positions.push(point.x, 0, point.y);
    }
    
    shapeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const shapeLine = new THREE.LineLoop(shapeGeometry, lineMaterial);
    
    const group = new THREE.Group();
    group.add(shapeLine);
    
    if (shape.holes && shape.holes.length > 0) {
        for (const hole of shape.holes) {
            if (!hole || !hole.getPoints) continue;
            
            const holePoints = hole.getPoints(24);
            const holeGeometry = new THREE.BufferGeometry();
            const holePositions = [];
            
            for (const point of holePoints) {
                holePositions.push(point.x, 0, point.y);
            }
            
            holeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(holePositions, 3));
            
            const holeMaterial = new THREE.LineBasicMaterial({ color: holeColor });
            const holeLine = new THREE.LineLoop(holeGeometry, holeMaterial);
            
            group.add(holeLine);
        }
    }
    
    return group;
}
window.debugHoleGeometry = debugHoleGeometry;
window.SVGProcessing.Holes.debugHoleGeometry = debugHoleGeometry;

// Improve hole detection to analyze based on winding direction and containment
function detectHoles(paths, outerShape, svgCenterX, svgCenterY, effectiveScale) {
    // Get configuration with fallbacks
    const holeConfig = window.svgHoleDetectionSettings || {
        areaRatioThreshold: 0.5,
        aggressiveness: 0.7,
        zeroAreaThreshold: 0.0001
    };
    
    const potentialHoles = [];
    const outerPoints = outerShape.getPoints(24);
    const outerArea = Math.abs(calculateShapeArea({getPoints: () => outerPoints}));
    const outerOrientation = calculatePolygonOrientation(outerPoints);
    
    // Check if this is likely a face-like SVG
    const isFaceLike = detectFaceLikePattern(paths);
    if (isFaceLike) {
        console.log("Face-like pattern detected - treating all shapes as separate extrusions");
        return []; // Return empty array to prevent any holes
    }
    
    for (const path of paths) {
        if (path === outerShape) continue; // Skip the outer shape itself
        
        const pathPoints = path.getPoints(24);
        
        // If the path has few points, skip it
        if (pathPoints.length < 3) continue;
        
        // Check if path center is inside the outer shape
        const pathCenter = getShapeCenter(pathPoints);
        
        // Apply aggressiveness to point containment - higher aggressiveness is more lenient
        const pointsToCheck = Math.min(5, pathPoints.length);
        let insideCount = isPointInPolygon(pathCenter, outerPoints) ? 1 : 0;
        
        // With high aggressiveness, we only check the center point
        // With lower aggressiveness, we check more points for better accuracy
        if (holeConfig.aggressiveness < 0.9) {
            for (let i = 0; i < pointsToCheck - 1; i++) {
                const pointIdx = Math.floor(i * pathPoints.length / (pointsToCheck - 1));
                if (isPointInPolygon(pathPoints[pointIdx], outerPoints)) {
                    insideCount++;
                }
            }
        }
        
        // Adjust required points based on aggressiveness
        const minPointsInside = Math.ceil(pointsToCheck * (1.0 - holeConfig.aggressiveness));
        
        if (insideCount < minPointsInside) {
            console.log(`Shape center or points test: Not enough points inside (${insideCount}/${pointsToCheck}), not a hole`);
            continue; // Not inside the outer shape, so not a hole
        }
        
        // Check area - holes should be smaller than the outer shape
        const pathArea = Math.abs(calculateShapeArea({getPoints: () => pathPoints}));
        
        // Apply area threshold based on aggressiveness
        const effectiveAreaThreshold = holeConfig.areaRatioThreshold * holeConfig.aggressiveness;
        
        if (pathArea >= outerArea * effectiveAreaThreshold || pathArea < holeConfig.zeroAreaThreshold) {
            console.log(`Shape area test: Area ${pathArea.toFixed(4)} vs outer ${outerArea.toFixed(4)}, ratio ${(pathArea/outerArea).toFixed(4)}, threshold ${effectiveAreaThreshold} - not a hole`);
            continue; // Too big to be a hole or too small to matter
        }
        
        // Extra check for bowl-like shapes: if the shape has very few points and simple geometry, 
        // it's more likely to be a separate component like the bowl base
        if (pathPoints.length < 8 && pathArea < outerArea * 0.1) {
            console.log(`Simple shape test: Simple shape with ${pathPoints.length} points and small area ratio ${(pathArea/outerArea).toFixed(4)} - likely a separate component, not a hole`);
            continue;
        }
        
        // Check orientation - holes should have opposite winding to outer shape
        const pathOrientation = calculatePolygonOrientation(pathPoints);
        
        // This shape is likely a hole
        potentialHoles.push({
            path: path,
            area: pathArea,
            needsReversal: Math.sign(pathOrientation) === Math.sign(outerOrientation)
        });
    }
    
    // Sort by area, largest first
    potentialHoles.sort((a, b) => b.area - a.area);
    
    return potentialHoles;
}

// Add more debug info to face detection
function detectFaceLikePattern(paths) {
    console.log("DEBUG: detectFaceLikePattern called with", paths ? paths.length : 0, "paths");
    
    if (!paths || !Array.isArray(paths) || paths.length < 2 || paths.length > 8) {
        console.log("DEBUG: Quick reject - path count outside face range (2-8):", paths ? paths.length : 0);
        return false;
    }
    
    // Collect valid paths with centers
    const components = [];
    
    for (const path of paths) {
        try {
            // Get all points from this path
            let allPoints = [];
            
            if (typeof path.getPoints === 'function') {
                allPoints = path.getPoints(24);
                console.log("DEBUG: Path has getPoints function, got", allPoints.length, "points");
            } else if (path.subPaths && Array.isArray(path.subPaths)) {
                console.log("DEBUG: Path has", path.subPaths.length, "subPaths");
                for (const subPath of path.subPaths) {
                    if (typeof subPath.getPoints === 'function') {
                        const subPathPoints = subPath.getPoints(24);
                        allPoints = allPoints.concat(subPathPoints);
                        console.log("DEBUG: SubPath added", subPathPoints.length, "points");
                    }
                }
            }
            
            if (allPoints.length > 0) {
                // Calculate bounding box
                let minX = Infinity, minY = Infinity;
                let maxX = -Infinity, maxY = -Infinity;
                
                allPoints.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
                
                const width = maxX - minX;
                const height = maxY - minY;
                const area = width * height;
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;
                
                console.log(`DEBUG: Component bounds: (${minX.toFixed(1)}, ${minY.toFixed(1)}) to (${maxX.toFixed(1)}, ${maxY.toFixed(1)})`);
                console.log(`DEBUG: Component center: (${centerX.toFixed(1)}, ${centerY.toFixed(1)}), size: ${width.toFixed(1)}x${height.toFixed(1)}`);
                
                // Skip tiny components
                if (area < 0.0001) {
                    console.log("DEBUG: Component too small, skipping (area:", area, ")");
                    continue;
                }
                
                components.push({
                    centerX: centerX,
                    centerY: centerY,
                    width: width,
                    height: height,
                    area: area
                });
            }
        } catch (error) {
            console.warn('DEBUG: Error analyzing path:', error);
        }
    }
    
    // Need at least 2 valid components
    if (components.length < 2) {
        console.log("DEBUG: Not enough valid components:", components.length);
        return false;
    }
    
    // Log centers for debugging
    console.log(`DEBUG: Face detection: Analyzing ${components.length} component centers:`, 
        components.map(c => `(${c.centerX.toFixed(1)}, ${c.centerY.toFixed(1)})`).join(', '));
    
    // Check distance between components
    if (components.length >= 2) {
        const distances = [];
        for (let i = 0; i < components.length - 1; i++) {
            for (let j = i + 1; j < components.length; j++) {
                const dx = components[i].centerX - components[j].centerX;
                const dy = components[i].centerY - components[j].centerY;
                const distance = Math.sqrt(dx*dx + dy*dy);
                distances.push({
                    from: i, 
                    to: j, 
                    distance: distance,
                    relativeX: dx,
                    relativeY: dy
                });
            }
        }
        
        console.log("DEBUG: Component distances:", distances);
    }
    
    // Special case for exactly 3 components which is a very common face pattern (2 eyes + mouth)
    if (components.length === 3) {
        // Sort components by Y-coordinate (top to bottom)
        const sortedByY = [...components].sort((a, b) => a.centerY - b.centerY);
        
        // Sort top two components by X-coordinate (left to right)
        const topTwo = sortedByY.slice(0, 2).sort((a, b) => a.centerX - b.centerX);
        const bottom = sortedByY[2];
        
        console.log("DEBUG: 3-component analysis:");
        console.log("  - Top left:", {x: topTwo[0].centerX, y: topTwo[0].centerY});
        console.log("  - Top right:", {x: topTwo[1].centerX, y: topTwo[1].centerY});
        console.log("  - Bottom:", {x: bottom.centerX, y: bottom.centerY});
        
        // Check if the top two are reasonably aligned horizontally (eyes)
        const eyesYDiff = Math.abs(topTwo[0].centerY - topTwo[1].centerY);
        const eyesXDiff = Math.abs(topTwo[0].centerX - topTwo[1].centerX);
        
        // Check if bottom is below both top components (mouth)
        const mouthBelowLeft = bottom.centerY > topTwo[0].centerY;
        const mouthBelowRight = bottom.centerY > topTwo[1].centerY;
        
        // Check if bottom is between the X coordinates of the top two (centered mouth)
        const mouthIsCentered = 
            bottom.centerX > Math.min(topTwo[0].centerX, topTwo[1].centerX) &&
            bottom.centerX < Math.max(topTwo[0].centerX, topTwo[1].centerX);
        
        console.log("DEBUG: Face pattern checks:");
        console.log("  - Eyes Y diff:", eyesYDiff, "X diff:", eyesXDiff);
        console.log("  - Mouth below left eye:", mouthBelowLeft);
        console.log("  - Mouth below right eye:", mouthBelowRight);
        console.log("  - Mouth centered between eyes:", mouthIsCentered);
        console.log("  - Face pattern detected:", (mouthBelowLeft && mouthBelowRight && 
            (mouthIsCentered || eyesYDiff < eyesXDiff)));
        
        // If most face-like conditions are met, consider it a face
        if (mouthBelowLeft && mouthBelowRight && 
            (mouthIsCentered || eyesYDiff < eyesXDiff)) {
            console.log("DEBUG: Face pattern confirmed with 3 components");
            return true;
        }
    }
    
    // Check if the filename suggests a face
    if (window.currentSvgFilename) {
        const facePatternsInFilename = /face|smile|emoji|emo|emote|emotion|grin|laugh|eye|mouth/i;
        if (facePatternsInFilename.test(window.currentSvgFilename)) {
            console.log(`DEBUG: Detected likely face SVG based on filename: ${window.currentSvgFilename}`);
            return true;
        }
    }
    
    console.log("DEBUG: detectFaceLikePattern returning false - no face pattern detected");
    return false;
}

// New helper function to process potential holes for a shape
function processHoles(shape, potentialHoles, svgCenterX, svgCenterY, effectiveScale) {
    if (!potentialHoles || potentialHoles.length === 0) return;
    
    console.log(`Processing ${potentialHoles.length} potential holes for shape`);
    
    for (const holeInfo of potentialHoles) {
        try {
            const holePath = holeInfo.path;
            const points = holePath.getPoints(24);
            
            // Transform points to match the shape coordinate system
            const transformedPoints = points.map(p => 
                new THREE.Vector2(
                    (p.x - svgCenterX) * effectiveScale,
                    (p.y - svgCenterY) * -effectiveScale 
                )
            );
            
            // Create a new path for the hole
            const transformedPath = new THREE.Path();
            
            // If needs reversal, reverse the points for proper hole subtraction
            if (holeInfo.needsReversal) {
                const reversedPoints = [...transformedPoints].reverse();
                transformedPath.moveTo(reversedPoints[0].x, reversedPoints[0].y);
                for (let i = 1; i < reversedPoints.length; i++) {
                    transformedPath.lineTo(reversedPoints[i].x, reversedPoints[i].y);
                }
            } else {
                transformedPath.moveTo(transformedPoints[0].x, transformedPoints[0].y);
                for (let i = 1; i < transformedPoints.length; i++) {
                    transformedPath.lineTo(transformedPoints[i].x, transformedPoints[i].y);
                }
            }
            
            transformedPath.closePath();
            transformedPath.userData = { 
                isHole: true,
                area: holeInfo.area,
                needsReversal: holeInfo.needsReversal
            };
            
            shape.holes.push(transformedPath);
            console.log(`Added hole with area ${holeInfo.area.toFixed(4)} to shape`);
            
        } catch (error) {
            console.error(`Error processing hole:`, error);
        }
    }
}

window.SVGProcessing.Holes.detectHoles = detectHoles;
window.SVGProcessing.Holes.processHoles = processHoles;
window.detectHoles = detectHoles;
window.processHoles = processHoles;

// Improve the validateHole function to handle complex cases and use config parameters
function validateHole(holePath, outerShape, svgCenterX, svgCenterY, effectiveScale) {
    // Get configuration parameters with fallbacks
    const holeConfig = window.svgHoleDetectionSettings || {
        areaRatioThreshold: 0.5,
        pointsInsideThreshold: 0.6,
        zeroAreaThreshold: 0.0001
    };
    
    const pointsForHoles = Math.round(24 * svgResolution);
    const originalHolePoints = holePath.getPoints(pointsForHoles);
    
    if (originalHolePoints.length < 3) {
        console.warn(`Hole validation: Not enough points in hole (${originalHolePoints.length}). Minimum 3 required.`);
        return null;
    }
    
    const filteredHolePoints = [];
    let lastX = null, lastY = null;
    
    for (const p of originalHolePoints) {
        if (lastX === null || lastY === null || 
            (Math.abs(p.x - lastX) > 0.0001 || Math.abs(p.y - lastY) > 0.0001)) {
            filteredHolePoints.push(p);
            lastX = p.x;
            lastY = p.y;
        }
    }
    
    if (filteredHolePoints.length < 3) {
        console.warn(`Hole validation: Too few points after filtering duplicates (${filteredHolePoints.length}). Minimum 3 required.`);
        return null;
    }
    
    const transformedHolePoints = filteredHolePoints.map(p => 
        new THREE.Vector2(
            (p.x - svgCenterX) * effectiveScale,
            (p.y - svgCenterY) * -effectiveScale 
        )
    );
    
    // Calculate hole area
    let area = 0;
    for (let i = 0, j = transformedHolePoints.length - 1; i < transformedHolePoints.length; j = i++) {
        area += (transformedHolePoints[j].x + transformedHolePoints[i].x) * 
                (transformedHolePoints[j].y - transformedHolePoints[i].y);
    }
    area = Math.abs(area / 2);
    
    if (area < holeConfig.zeroAreaThreshold) {
        console.warn(`Hole validation: Hole has effectively zero area (${area.toFixed(6)}) < threshold ${holeConfig.zeroAreaThreshold}`);
        return null;
    }
    
    // Get outer shape points for testing
    const outerShapePoints = outerShape.getPoints(48);
    
    // Calculate outer shape area to check size relationship
    const outerShapeArea = Math.abs(calculateShapeArea({getPoints: () => outerShapePoints}));
    
    // If the hole is too large relative to the shape, it's probably not a hole
    if (area > outerShapeArea * holeConfig.areaRatioThreshold) {
        console.warn(`Hole validation: Area too large (${area.toFixed(4)}) compared to outer shape (${outerShapeArea.toFixed(4)}), ratio ${(area/outerShapeArea).toFixed(2)} > threshold ${holeConfig.areaRatioThreshold}`);
        return null;
    }
    
    // Check multiple points to see if hole is inside shape
    const holeCenter = getShapeCenter(transformedHolePoints);
    const inPolygonTests = [];
    
    // Test center point
    inPolygonTests.push({
        point: holeCenter,
        inside: isPointInPolygon(holeCenter, outerShapePoints)
    });
    
    // Test a few more points around the shape in case the center is unreliable
    for (let i = 0; i < Math.min(transformedHolePoints.length, 4); i++) {
        const idx = Math.floor(i * transformedHolePoints.length / 4);
        const point = transformedHolePoints[idx];
        inPolygonTests.push({
            point: point,
            inside: isPointInPolygon(point, outerShapePoints)
        });
    }
    
    // Calculate required points based on configuration
    const insideCount = inPolygonTests.filter(test => test.inside).length;
    const requiredPoints = Math.ceil(inPolygonTests.length * holeConfig.pointsInsideThreshold);
    
    if (insideCount < requiredPoints) {
        console.warn(`Hole validation: Insufficient points (${insideCount}/${inPolygonTests.length}) inside the outer shape, need ${requiredPoints} (${holeConfig.pointsInsideThreshold * 100}%)`);
        return null;
    }
    
    // Get orientation of hole and shape
    const holeOrientation = calculatePolygonOrientation(transformedHolePoints);
    const shapeOrientation = calculatePolygonOrientation(outerShapePoints);
    
    // Check whether hole orientation needs reversal
    const needsReversal = Math.sign(holeOrientation) === Math.sign(shapeOrientation);
    
    // Create the final hole path with correct winding direction
    const finalHolePath = new THREE.Path();
    
    // If orientations are the same, reverse the hole points for proper subtraction
    if (needsReversal) {
        console.log(`Hole validation: Reversing hole winding direction for proper subtraction`);
        const reversedPoints = [...transformedHolePoints].reverse();
        finalHolePath.moveTo(reversedPoints[0].x, reversedPoints[0].y);
        for (let k = 1; k < reversedPoints.length; k++) {
            finalHolePath.lineTo(reversedPoints[k].x, reversedPoints[k].y);
        }
    } else {
        // Normal case - use original points
        finalHolePath.moveTo(transformedHolePoints[0].x, transformedHolePoints[0].y);
        for (let k = 1; k < transformedHolePoints.length; k++) {
            finalHolePath.lineTo(transformedHolePoints[k].x, transformedHolePoints[k].y);
        }
    }
    
    finalHolePath.closePath(); 
    finalHolePath.userData = { 
        area: area,
        orientation: holeOrientation,
        originalHolePoints: transformedHolePoints,
        isHole: true,
        needsReversal: needsReversal
    };
    
    console.log(`Hole validation: Valid hole with area ${area.toFixed(4)}`);
    return finalHolePath;
}