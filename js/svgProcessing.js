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
        
        // Parse the SVG string (fix variable naming conflict)
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
        
        paths.forEach(path => {
            // Log path properties for debugging
            console.log(`Path with ${path.subPaths.length} subpaths`);
            
            path.subPaths.forEach(subPath => {
                console.log(`  SubPath with ${subPath.curves.length} curves, closed: ${subPath.closed}`);
            });
            
            const points = path.subPaths.flatMap(subPath => {
                // Use the actual curves to get points instead of getPoints() which might be undefined
                const subPathPoints = [];
                let currentPoint = subPath.currentPoint;
                subPath.curves.forEach(curve => {
                    // Sample points along the curve
                    const divisions = 10; // Adjust as needed for accuracy
                    for (let i = 0; i <= divisions; i++) {
                        const t = i / divisions;
                        const point = curve.getPoint(t);
                        subPathPoints.push(point);
                    }
                });
                return subPathPoints;
            });
            
            if (points.length === 0) {
                console.warn("No points extracted from path");
                return;
            }
            
            points.forEach(point => {
                if (!point) return;
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            });
        });
        
        console.log(`SVG Bounds: (${minX}, ${minY}) to (${maxX}, ${maxY})`);
        
        const svgWidth = maxX - minX;
        const svgHeight = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Calculate scaling factors to fit onto the brick top face
        const scaleX = brickDimensions.width / svgWidth;
        const scaleY = brickDimensions.depth / svgHeight;
        const scale = Math.min(scaleX, scaleY) * svgScaleFactor; // Use the adjustable scale factor
        
        console.log(`SVG dimensions: ${svgWidth} x ${svgHeight}, Scale: ${scale}`);
        
        // Process paths based on quality settings
        let pathsToProcess = paths;
        
        // For low quality interactive rendering, we might limit the number of paths
        if (!isExporting && lowQuality && paths.length > 20) {
            const limit = Math.max(5, Math.floor(paths.length * qualityFactor));
            pathsToProcess = paths.slice(0, limit);
            console.log(`Low quality mode: Processing ${limit} of ${paths.length} paths`);
        }
        
        // Process synchronously for export or with progressive rendering for interactive use
        if (isExporting) {
            processPathsSync(pathsToProcess, { centerX, centerY, scale, lowQuality, isExporting });
        } else {
            processPathsAsync(pathsToProcess, { centerX, centerY, scale, lowQuality, isExporting });
        }
        
    } catch (error) {
        console.error("Error processing SVG:", error);
        if (!isExporting) {
            showMessage("Error processing SVG. Check console for details.");
            document.getElementById('loading').classList.add('hidden');
        }
    }
}

// Process SVG paths synchronously (for export)
function processPathsSync(paths, options) {
    const { centerX, centerY, scale, lowQuality, isExporting } = options;
    const totalPaths = paths.length;
    
    console.log(`Processing ${totalPaths} paths synchronously with enhanced hole detection`);
    
    // First pass: Collect all shapes and their areas to determine which are holes
    const allShapes = [];
    
    for (let i = 0; i < totalPaths; i++) {
        const path = paths[i];
        
        console.log(`Processing path ${i+1}/${totalPaths} with ${path.subPaths.length} subpaths`);
        
        // Process each subpath in the path
        path.subPaths.forEach((subPath, subPathIndex) => {
            console.log(`  Processing subpath ${subPathIndex}`);
            
            try {
                // Create shape directly from subPath curves instead of toShapes
                const shape = createShapeFromCurves(subPath.curves);
                
                if (!shape) {
                    console.warn(`  Failed to create shape from subpath ${subPathIndex}`);
                    return;
                }
                
                // Center and scale the shape
                const points = shape.getPoints();
                points.forEach(point => {
                    point.x = (point.x - centerX) * scale;
                    point.y = (point.y - centerY) * scale;
                });
                
                // Calculate shape area - negative area means clockwise winding (typically a hole)
                const area = calculateShapeArea(shape);
                const isClockwise = area < 0;
                
                // Store shape with its area for processing in the second pass
                allShapes.push({
                    shape,
                    area: Math.abs(area),
                    isHole: isClockwise, // SVG standard: clockwise is usually a hole
                    pathIndex: i,
                    subPathIndex
                });
                
                console.log(`  Created shape with ${points.length} points, area: ${area}, isHole: ${isClockwise}`);
            } catch (shapeError) {
                console.error(`  Error creating shape from subpath ${subPathIndex}:`, shapeError);
            }
        });
        
        // Update progress for exports
        if (isExporting && exportSettings.progressCallback) {
            const progress = Math.round((i + 1) / totalPaths * 25);
            exportSettings.progressCallback(progress);
        }
    }
    
    // Second pass: Sort shapes by area, largest first (outer shapes tend to be larger)
    allShapes.sort((a, b) => b.area - a.area);
    
    // Process outer shapes and detect which smaller shapes are holes in them
    const processedIndices = new Set();
    let shapeCount = 0;
    
    // Process large shapes first, considering them as potential outer shapes
    for (let i = 0; i < allShapes.length; i++) {
        if (processedIndices.has(i)) continue;
        
        const outerShape = allShapes[i];
        processedIndices.add(i);
        
        // Explicit holes are skipped as independent shapes and will be processed as holes for their parent shapes
        if (outerShape.isHole) {
            console.log(`Skipping explicit hole shape ${outerShape.pathIndex}.${outerShape.subPathIndex} for independent processing`);
            continue;
        }
        
        // Create a new shape to work with (clone the shape to avoid modifying the original)
        const newShape = new THREE.Shape();
        outerShape.shape.getPoints().forEach((point, idx) => {
            if (idx === 0) newShape.moveTo(point.x, point.y);
            else newShape.lineTo(point.x, point.y);
        });
        
        // Look for potential holes in this shape
        const potentialHoles = [];
        
        for (let j = 0; j < allShapes.length; j++) {
            if (i === j || processedIndices.has(j)) continue;
            
            const innerShape = allShapes[j];
            
            // Skip shapes that are larger than our potential outer shape
            if (innerShape.area >= outerShape.area) continue;
            
            // Check if the inner shape is contained within the outer shape
            if (isShapeContainedIn(innerShape.shape, outerShape.shape)) {
                potentialHoles.push(j);
                processedIndices.add(j);
                
                // Create a hole path and add it to the outer shape
                const holePath = new THREE.Path();
                const holePoints = innerShape.shape.getPoints(16); // Use more points for better precision
                
                holePoints.forEach((point, idx) => {
                    if (idx === 0) holePath.moveTo(point.x, point.y);
                    else holePath.lineTo(point.x, point.y);
                });
                
                // Ensure hole path is properly closed
                const firstPoint = holePoints[0];
                const lastPoint = holePoints[holePoints.length - 1];
                
                const distanceToStart = Math.sqrt(
                    Math.pow(lastPoint.x - firstPoint.x, 2) + 
                    Math.pow(lastPoint.y - firstPoint.y, 2)
                );
                
                if (distanceToStart > 0.001) {
                    holePath.lineTo(firstPoint.x, firstPoint.y);
                }
                
                holePath.closePath();
                newShape.holes.push(holePath);
                
                console.log(`Added hole ${innerShape.pathIndex}.${innerShape.subPathIndex} to shape ${outerShape.pathIndex}.${outerShape.subPathIndex}`);
            }
        }
        
        // Create the extruded 3D object for this shape with its holes
        console.log(`Creating extruded shape with ${newShape.holes.length} holes`);
        createExtrudedShapeOverride(newShape, scale, lowQuality);
        shapeCount++;
        
        // Update progress for exports
        if (isExporting && exportSettings.progressCallback) {
            const progress = 25 + Math.round(shapeCount / allShapes.length * 25);
            exportSettings.progressCallback(progress);
        }
    }
    
    // Process any remaining shapes that weren't holes or outer shapes
    for (let i = 0; i < allShapes.length; i++) {
        if (processedIndices.has(i)) continue;
        
        const shape = allShapes[i];
        createExtrudedShapeOverride(shape.shape, scale, lowQuality);
        shapeCount++;
        
        // Update progress for exports
        if (isExporting && exportSettings.progressCallback) {
            const progress = 50 + Math.round(shapeCount / allShapes.length * 50);
            exportSettings.progressCallback(progress);
        }
    }
    
    console.log(`Finished processing. Created ${extrudedGroup.children.length} extruded objects with proper holes.`);
    
    // Hide loading indicator when done (if not exporting)
    if (!isExporting) {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Function to simplify a shape by removing points that are too close together
function simplifyShape(shape, minDistance = 0.01) {
    // Create a new shape with simplified points
    const newShape = new THREE.Shape();
    const points = shape.getPoints(32); // Use more points for higher precision
    
    if (points.length < 3) return shape; // Can't simplify shapes with less than 3 points
    
    let lastPoint = points[0];
    newShape.moveTo(lastPoint.x, lastPoint.y);
    
    for (let i = 1; i < points.length; i++) {
        const point = points[i];
        const distance = Math.sqrt(
            Math.pow(point.x - lastPoint.x, 2) + 
            Math.pow(point.y - lastPoint.y, 2)
        );
        
        if (distance >= minDistance) {
            newShape.lineTo(point.x, point.y);
            lastPoint = point;
        }
    }
    
    // Close the shape
    newShape.closePath();
    
    // Add any holes with improved simplification
    if (shape.holes && shape.holes.length > 0) {
        shape.holes.forEach(hole => {
            const newHole = new THREE.Path();
            const holePoints = hole.getPoints(32); // Use more points for higher precision
            
            if (holePoints.length < 3) return; // Skip holes with less than 3 points
            
            lastPoint = holePoints[0];
            newHole.moveTo(lastPoint.x, lastPoint.y);
            
            for (let i = 1; i < holePoints.length; i++) {
                const point = holePoints[i];
                const distance = Math.sqrt(
                    Math.pow(point.x - lastPoint.x, 2) + 
                    Math.pow(point.y - lastPoint.y, 2)
                );
                
                if (distance >= minDistance) {
                    newHole.lineTo(point.x, point.y);
                    lastPoint = point;
                }
            }
            
            // Ensure the hole is properly closed
            const firstPoint = holePoints[0];
            const distanceToStart = Math.sqrt(
                Math.pow(lastPoint.x - firstPoint.x, 2) + 
                Math.pow(lastPoint.y - firstPoint.y, 2)
            );
            
            if (distanceToStart > 0.001) {
                newHole.lineTo(firstPoint.x, firstPoint.y);
            }
            
            // Close the hole
            newHole.closePath();
            
            // Only add the hole if it has at least 3 points after simplification
            if (newHole.curves.length >= 3) {
                newShape.holes.push(newHole);
            }
        });
    }
    
    return newShape;
}

// Global counter to generate unique colors for each shape
let shapeColorCounter = 0;

// Function to generate a visually distinct color based on an index
function generateDistinctColor(index) {
    // Use golden ratio to get well-distributed colors
    // This creates colors that are distinct from each other
    const goldenRatioConjugate = 0.618033988749895;
    const hue = (index * goldenRatioConjugate) % 1;
    
    // Convert HSL to RGB (saturation and lightness fixed for good visibility)
    return new THREE.Color().setHSL(hue, 0.7, 0.55);
}

// Enhanced extrusion function with improved settings for solid objects with holes
function createExtrudedShapeOverride(shape, scale, lowQuality = false) {
    // Validate height - ensure it's a positive number
    const validHeight = Math.max(0.1, Number(extrusionHeight) || 1);
    
    // CRITICAL FIX: Log actual extrusion height being used
    console.log(`Creating extrusion with height: ${validHeight}`);
    
    // Higher quality settings for export
    const steps = isHighQualityMode ? exportSettings.extrudeSteps : (lowQuality ? 1 : 3);
    
    // Use different extrude settings based on quality mode
    const extrudeSettings = {
        steps: steps,
        depth: validHeight, // CRITICAL: Use validated height directly
        bevelEnabled: !lowQuality, // Enable bevel for more solid appearance
        bevelThickness: 0.05,
        bevelSize: 0.02,
        bevelSegments: isHighQualityMode ? 3 : 1,
        curveSegments: isHighQualityMode ? 24 : (lowQuality ? 8 : 12), // Higher resolution for curves
        UVGenerator: THREE.ExtrudeGeometry.WorldUVGenerator // Better UV mapping
    };
    
    // Log the number of holes for debugging
    if (shape.holes && shape.holes.length > 0) {
        console.log(`Extruding shape with ${shape.holes.length} holes`);
        shape.holes.forEach((hole, idx) => {
            console.log(`  Hole ${idx} has ${hole.curves.length} curves`);
        });
    }
    
    // Generate a unique color for this shape
    const uniqueColor = generateDistinctColor(shapeColorCounter++);
    
    // Use optimized material settings for solid appearance with unique color
    const material = new THREE.MeshStandardMaterial({
        color: uniqueColor,
        roughness: 0.5,
        metalness: 0.2,
        flatShading: false, // Smooth shading for better appearance
        side: THREE.DoubleSide, // Changed to DoubleSide to ensure all faces render properly
        shadowSide: THREE.DoubleSide // Changed to DoubleSide for proper shadow casting
    });
    
    try {
        // Simplify shape slightly to avoid self-intersections (helps with hole rendering)
        const simplifiedShape = simplifyShape(shape, 0.01);
        
        // Log shape information for debugging
        console.log(`Creating extruded shape #${shapeColorCounter-1} with ${simplifiedShape.getPoints().length} points and ${simplifiedShape.holes ? simplifiedShape.holes.length : 0} holes`);
        
        // Create extruded geometry with explicit triangulation
        // CRITICAL FIX: Create a new copy of the extrude settings to avoid reference issues
        const geometry = new THREE.ExtrudeGeometry(simplifiedShape, {...extrudeSettings});
        
        // Ensure proper normals for better lighting and rendering
        geometry.computeVertexNormals();
        
        // Create mesh with the extruded geometry
        const mesh = new THREE.Mesh(geometry, material);
        
        // Apply proper scaling - make sure scale matches what's seen in viewer
        mesh.scale.set(scale * 0.25, -scale * 0.25, 1);
        
        // Rotate to lay flat on top of the brick
        mesh.rotation.x = Math.PI / 2;
        
        // VERY IMPORTANT: Position on top of the brick accurately - exactly matching what's in the UI
        mesh.position.set(
            extrusionPosition.x || 0,  // X position from UI
            brickDimensions.height + (extrusionHeight / 2) + (extrusionPosition.y || 0),  // Y position adjusted for new brick position
            extrusionPosition.z || 0   // Z position from UI
        );
        
        // Log exact position and extrusion height for debugging
        console.log(`Creating extrusion at position: [${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z}] with height: ${validHeight}`);
        
        // Update matrices immediately
        mesh.updateMatrix();
        mesh.updateMatrixWorld(true);
        
        // Add to the extrusion group
        extrudedGroup.add(mesh);
        
        // Update parent group matrices
        extrudedGroup.updateMatrix();
        extrudedGroup.updateMatrixWorld(true);
        
        return mesh;
    } catch (error) {
        console.error("Error creating extruded shape:", error);
        return null;
    }
}

// Improved function to check if one shape is contained within another
function isShapeContainedIn(innerShape, outerShape) {
    // Get points from both shapes
    const innerPoints = innerShape.getPoints(16); // Use more points for better precision
    const outerPoints = outerShape.getPoints(16);
    
    // For a shape to be a hole, most of its points should be inside the outer shape
    // We'll use a threshold to allow for some edge cases and numerical imprecision
    const threshold = 0.9; // 90% of points must be inside to consider it a hole
    
    // Count how many points are inside
    let pointsInside = 0;
    for (const point of innerPoints) {
        if (isPointInPolygon(point, outerPoints)) {
            pointsInside++;
        }
    }
    
    // Calculate the percentage of points inside
    const percentInside = pointsInside / innerPoints.length;
    
    // Additional area-based check for better reliability
    const innerArea = Math.abs(calculateShapeArea(innerShape));
    const outerArea = Math.abs(calculateShapeArea(outerShape));
    
    // A hole must be smaller than its container
    if (innerArea >= outerArea) {
        return false;
    }
    
    console.log(`Shape containment test: ${percentInside * 100}% of points inside, innerArea=${innerArea}, outerArea=${outerArea}`);
    
    return percentInside >= threshold;
}

// Improved point-in-polygon test with complete implementation
function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Process SVG paths asynchronously (for interactive use)
function processPathsAsync(paths, options) {
    const { centerX, centerY, scale, lowQuality } = options;
    const batchSize = 3; // Process fewer paths per frame for smoother experience
    let currentPathIndex = 0;
    const totalPaths = paths.length;
    
    console.log(`Processing ${totalPaths} paths asynchronously in batches of ${batchSize}`);
    
    function processBatch() {
        const startTime = performance.now();
        let processedInBatch = 0;
        
        console.log(`Processing batch starting at path ${currentPathIndex}/${totalPaths}`);
        
        // Process a small batch of paths
        while (processedInBatch < batchSize && currentPathIndex < totalPaths) {
            const path = paths[currentPathIndex];
            
            // For each path, collect all its subpaths
            const pathShapes = [];
            
            // First pass: Create and collect all shapes for this path
            path.subPaths.forEach((subPath, subPathIndex) => {
                try {
                    // Create shape directly from curves
                    const shape = createShapeFromCurves(subPath.curves);
                    
                    if (!shape) {
                        console.warn(`No shape created from path ${currentPathIndex}, subpath ${subPathIndex}`);
                        return;
                    }
                    
                    // Center and scale the shape
                    const points = shape.getPoints();
                    points.forEach(point => {
                        point.x = (point.x - centerX) * scale;
                        point.y = (point.y - centerY) * scale;
                    });
                    
                    // Calculate area to determine winding direction
                    const area = calculateShapeArea(shape);
                    
                    // Store the shape with its metadata
                    pathShapes.push({
                        shape: shape,
                        area: Math.abs(area),
                        isClockwise: area < 0, // Clockwise shapes typically represent holes
                        subPathIndex: subPathIndex
                    });
                    
                    console.log(`Created shape for subpath ${subPathIndex}, area: ${area}, isClockwise: ${area < 0}`);
                    
                } catch (shapeError) {
                    console.error(`Error creating shape from path ${currentPathIndex}, subPath ${subPathIndex}:`, shapeError);
                }
            });
            
            // Second pass: Identify outer shapes and their holes
            if (pathShapes.length > 0) {
                // Sort shapes by area (largest first, likely to be outer shapes)
                pathShapes.sort((a, b) => b.area - a.area);
                
                const processedIndices = new Set();
                
                // Process each shape starting with the largest
                for (let i = 0; i < pathShapes.length; i++) {
                    if (processedIndices.has(i)) continue;
                    
                    const outerShape = pathShapes[i];
                    processedIndices.add(i);
                    
                    // If shape is likely a hole itself (small and clockwise), skip as independent shape
                    if (outerShape.isClockwise && i > 0) {
                        console.log(`Skipping likely hole shape at subpath ${outerShape.subPathIndex}`);
                        continue;
                    }
                    
                    // Create a new main shape (to avoid modifying the original)
                    const mainShape = new THREE.Shape();
                    const mainPoints = outerShape.shape.getPoints();
                    
                    mainPoints.forEach((point, idx) => {
                        if (idx === 0) mainShape.moveTo(point.x, point.y);
                        else mainShape.lineTo(point.x, point.y);
                    });
                    
                    // Check remaining shapes to see if they are holes in this shape
                    let holesFound = 0;
                    
                    for (let j = 0; j < pathShapes.length; j++) {
                        if (i === j || processedIndices.has(j)) continue;
                        
                        const innerShape = pathShapes[j];
                        
                        // For a shape to be a hole:
                        // 1. It should be smaller (have less area)
                        // 2. Its points should be inside the outer shape
                        // 3. Ideally it should have opposite winding direction
                        
                        if (innerShape.area >= outerShape.area) continue;
                        
                        if (isShapeContainedIn(innerShape.shape, outerShape.shape)) {
                            console.log(`Found hole: subpath ${innerShape.subPathIndex} inside subpath ${outerShape.subPathIndex}`);
                            processedIndices.add(j);
                            
                            // Add as a hole to the main shape
                            const holePath = new THREE.Path();
                            const holePoints = innerShape.shape.getPoints();
                            
                            holePoints.forEach((point, idx) => {
                                if (idx === 0) holePath.moveTo(point.x, point.y);
                                else holePath.lineTo(point.x, point.y);
                            });
                            
                            // Ensure hole path is properly closed
                            holePath.closePath();
                            mainShape.holes.push(holePath);
                            holesFound++;
                        }
                    }
                    
                    // Create the extruded object with holes
                    console.log(`Extruding shape with ${holesFound} holes`);
                    createExtrudedShapeOverride(mainShape, scale, lowQuality);
                }
                
                // Process any remaining shapes that weren't identified as holes
                for (let i = 0; i < pathShapes.length; i++) {
                    if (processedIndices.has(i)) continue;
                    
                    console.log(`Extruding remaining shape at subpath ${pathShapes[i].subPathIndex}`);
                    createExtrudedShapeOverride(pathShapes[i].shape, scale, lowQuality);
                }
            }
            
            currentPathIndex++;
            processedInBatch++;
            
            // Check if we've been processing too long and should yield
            if (performance.now() - startTime > 16) { // 16ms = ~60fps
                break;
            }
        }
        
        console.log(`Batch processed. ${currentPathIndex}/${totalPaths} paths done.`);
        
        // If there's more to process, schedule the next batch
        if (currentPathIndex < totalPaths) {
            setTimeout(processBatch, 0);
        } else {
            // Hide loading indicator when done
            console.log(`Async processing complete. Created ${extrudedGroup.children.length} extruded objects.`);
            document.getElementById('loading').classList.add('hidden');
        }
    }
    
    // Start the first batch
    processBatch();
}

// Helper function to calculate the area of a shape (used to determine winding direction)
function calculateShapeArea(shape) {
    const points = shape.getPoints();
    let area = 0;
    
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    
    return area / 2;
}

// New function to create a shape directly from curves without relying on toShapes
function createShapeFromCurves(curves) {
    if (!curves || curves.length === 0) {
        console.warn("No curves provided to createShapeFromCurves");
        return null;
    }
    
    console.log(`Creating shape from ${curves.length} curves`);
    
    // Create a new THREE.Shape
    const shape = new THREE.Shape();
    
    // We need to start at the first point of the first curve
    let firstCurve = curves[0];
    let startPoint;
    
    if (firstCurve.v0) {
        startPoint = firstCurve.v0;
    } else if (firstCurve.v1) {
        startPoint = firstCurve.v1;
    } else {
        console.warn("Cannot find starting point in first curve");
        return null;
    }
    
    // Move to the starting point
    shape.moveTo(startPoint.x, startPoint.y);
    
    // Add each curve to the shape
    curves.forEach((curve) => {
        if (curve.isLineCurve) {
            // Line curves have v1 and v2 points
            shape.lineTo(curve.v2.x, curve.v2.y);
        } else if (curve.isQuadraticBezierCurve) {
            // Quadratic curves have v1 (control point) and v2 (end point)
            shape.quadraticCurveTo(
                curve.v1.x, curve.v1.y,
                curve.v2.x, curve.v2.y
            );
        } else if (curve.isCubicBezierCurve) {
            // Cubic curves have v1, v2 (control points) and v3 (end point)
            shape.bezierCurveTo(
                curve.v1.x, curve.v1.y,
                curve.v2.x, curve.v2.y,
                curve.v3.x, curve.v3.y
            );
        } else if (curve.isEllipseCurve) {
            // For ellipse curves we'd need to approximate with bezier curves
            // This is a simplified version that uses points along the ellipse
            const points = curve.getPoints(36); // Increased resolution for smoother curves
            points.forEach(point => {
                shape.lineTo(point.x, point.y);
            });
        } else if (curve.isSplineCurve) {
            // Spline curves have points array
            const points = curve.getPoints(36); // Increased resolution for smoother curves
            points.forEach(point => {
                shape.lineTo(point.x, point.y);
            });
        } else {
            // For unknown curve types, sample points
            const points = curve.getPoints(36); // Increased resolution for smoother curves
            points.forEach(point => {
                shape.lineTo(point.x, point.y);
            });
        }
    });
    
    // Ensure the path is properly closed - this is critical for solid extrusions
    const points = shape.getPoints();
    if (points.length > 1) {
        const lastPoint = points[points.length - 1];
        const distanceToStart = Math.sqrt(
            Math.pow(lastPoint.x - startPoint.x, 2) + 
            Math.pow(lastPoint.y - startPoint.y, 2)
        );
        
        // If the distance is small but not exactly zero, force close
        if (distanceToStart > 0.001) {
            console.log(`Forcing path closure. Distance to start: ${distanceToStart}`);
            shape.lineTo(startPoint.x, startPoint.y);
        }
    }
    
    // Explicitly close the shape
    shape.closePath();
    
    return shape;
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
