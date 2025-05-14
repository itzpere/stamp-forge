window.SVGProcessing = window.SVGProcessing || {};
window.SVGProcessing.Shapes = {};

// Add extrusion settings to global config
window.svgGlobalSettings = window.svgGlobalSettings || {};
window.svgGlobalSettings.shapeExtrusion = window.svgGlobalSettings.shapeExtrusion || {
    bevelThickness: 0.05,
    bevelSize: 0.02,
    defaultCurveSegments: 12,
    lowQualityCurveSegments: 8,
    highQualityCurveSegments: 24,
    disabledColor: 0x999999,
    disabledOpacity: 0.3,
    regenerateShapeMatchWeight: 1000
};


function createExtrudedShapeWithId(shape, effectiveScaleFromParser_unused, lowQuality, shapeId) {
    const settings = window.svgGlobalSettings;
    const extrudeConfig = settings.shapeExtrusion;

    const validHeight = Math.max(0.1, Number(extrusionHeight) || 1);
    const steps = isHighQualityMode ? 4 : (lowQuality ? 1 : 2);
    
    let curveSegmentsValue = extrudeConfig.defaultCurveSegments;
    if (isHighQualityMode) {
        curveSegmentsValue = extrudeConfig.highQualityCurveSegments;
    } else if (lowQuality) {
        curveSegmentsValue = extrudeConfig.lowQualityCurveSegments;
    }

    // Enhanced extrude settings for better hole handling
    const extrudeSettings = {
        steps: steps,
        depth: validHeight,
        bevelEnabled: !lowQuality && exportSettings.enableBevel,
        bevelThickness: extrudeConfig.bevelThickness,
        bevelSize: extrudeConfig.bevelSize,
        bevelSegments: isHighQualityMode ? 3 : 1,
        curveSegments: Math.round(curveSegmentsValue * (typeof window.svgResolution === 'number' ? window.svgResolution : 1))
    };
    
    const existingShapeInfo = window.shapeRenderInfo.find(info => info.id === shapeId);
    let material;
    
    // Handle existing shape info
    if (existingShapeInfo && existingShapeInfo.mesh && existingShapeInfo.mesh.material) {
        material = new THREE.MeshStandardMaterial({
            color: existingShapeInfo.mesh.material.color.clone(),
            roughness: 0.5,
            metalness: 0.2,
            flatShading: false,
            side: THREE.DoubleSide
        });
        
        // Skip creating extruded shape if this is marked as a hole
        if (existingShapeInfo.operationType === 'remove') {
            console.log(`Shape ID ${shapeId} is marked as a hole. Not extruding.`);
            return null;
        } else if (existingShapeInfo.operationType === 'disable') {
            material.color.set(extrudeConfig.disabledColor);
        }
    } else {
        // New shape
        const uniqueColor = generateDistinctColor(shapeId);
        material = new THREE.MeshStandardMaterial({
            color: uniqueColor,
            roughness: 0.5,
            metalness: 0.2,
            flatShading: false,
            side: THREE.DoubleSide
        });
        
        material.userData = { originalColor: uniqueColor.clone() };
    }
    
    try {
        // Check and prepare holes for extrusion
        const hasHoles = shape.holes && shape.holes.length > 0;
        if (hasHoles) {
            console.log(`Creating extruded shape ID ${shapeId} with ${shape.holes.length} holes`);
            
            // Validate and fix holes to ensure proper extrusion
            for (let i = 0; i < shape.holes.length; i++) {
                const hole = shape.holes[i];
                if (!hole) {
                    console.warn(`Hole ${i} is null or undefined - removing it from the holes array`);
                    shape.holes.splice(i, 1);
                    i--;
                    continue;
                }
                
                // Ensure all holes are closed paths
                if (!hole.currentPoint || !hole.getPoint(0) || !hole.currentPoint.equals(hole.getPoint(0))) {
                    console.log(`Closing hole ${i} path to ensure proper subtraction`);
                    hole.closePath();
                }
                
                // Debug information for better hole troubleshooting
                console.log(`Hole ${i} points: ${hole.getPoints(settings.pointSampling.getPoints('default')).length}, closed: ${hole.currentPoint && hole.getPoint(0) && hole.currentPoint.equals(hole.getPoint(0))}`);
            }
        }
        
        // Create the geometry with holes
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.computeVertexNormals();
        
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.rotation.x = Math.PI / 2;
        
        // Calculate the correct position for the mesh
        const baseOffset = currentBaseTopSurfaceY || 0;
        const yOffset = validHeight / 2; // Center the extrusion vertically
        const posY = baseOffset + extrusionPosition.y + yOffset;
        const posX = extrusionPosition.x;
        const posZ = extrusionPosition.z;

        mesh.position.set(posX, posY, posZ);
        
        // Add information about holes for debugging
        if (hasHoles) {
            mesh.userData.holeCount = shape.holes.length;
        }
        
        // Update or create shape info
        if (existingShapeInfo) {
            existingShapeInfo.mesh = mesh;
            mesh.userData.shapeId = shapeId;
            
            const opType = existingShapeInfo.operationType || 'extrude';
            updateMeshAppearanceForOperation(mesh, opType);
            
            // If opType is 'extrude', then also respect the individual shape's isVisible flag
            if (opType === 'extrude') {
                mesh.visible = existingShapeInfo.isVisible;
            }
        } else {
            mesh.userData.shapeId = shapeId;
            window.shapeRenderInfo.push({
                id: shapeId,
                name: `Shape ${shapeId + 1}`,
                mesh: mesh,
                isVisible: true,
                operationType: 'extrude',
                hasHoles: hasHoles,
                holeCount: hasHoles ? shape.holes.length : 0
            });
            mesh.visible = true;
        }
        
        // Log final mesh position
        console.log(`Mesh ${shapeId} positioned at: {x: ${mesh.position.x.toFixed(2)}, y: ${mesh.position.y.toFixed(2)}, z: ${mesh.position.z.toFixed(2)}}`);
        
        // Add the mesh to extrudedGroup
        if (window.extrudedGroup) {
            window.extrudedGroup.add(mesh);
        } else {
            console.error("extrudedGroup is not available, cannot add shape to scene");
        }
        
        return mesh;
    } catch (error) {
        console.error(`Error creating extruded shape ID ${shapeId}:`, error);
        return null;
    }
}

function createExtrudedShape(shape, effectiveScale, lowQuality) {
    const shapeId = shapeColorCounter++;
    return createExtrudedShapeWithId(shape, effectiveScale, lowQuality, shapeId);
}

function generateDistinctColor(index) {
    const hue = (index * 137.508) % 360;
    return new THREE.Color(`hsl(${hue}, 70%, 50%)`);
}

// calculateShapeArea is removed from here, now in svgUtilities.js

function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const point of points) {
        if (point) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }
    }
    
    return { minX, minY, maxX, maxY };
}

function regenerateShapeWithWinding(shapeInfo) {
    const settings = window.svgGlobalSettings;
    const extrudeConfig = settings.shapeExtrusion;
    if (!shapeInfo || !shapeInfo.originalPath) {
        console.error("Cannot regenerate shape: missing original path information");
        return;
    }

    if (!window.lastSvgData) {
        console.error("Cannot regenerate shape: window.lastSvgData is not available.");
        return;
    }
    
    const loader = new THREE.SVGLoader();
    let svgParsedData;
    try {
        let svgStringToParse = window.lastSvgData;

        // Apply normalization
        if (typeof normalizeSVG === 'function') {
            svgStringToParse = normalizeSVG(svgStringToParse);
        } else {
            console.warn("[regenerateShapeWithWinding] normalizeSVG function not available.");
        }

        // Apply subpath splitting, consistent with initial parsing
        if (window.SVGProcessing && window.SVGProcessing.Utils && typeof window.SVGProcessing.Utils.splitDisjointSubpathsInSVG === 'function') {
            svgStringToParse = window.SVGProcessing.Utils.splitDisjointSubpathsInSVG(svgStringToParse);
        } else {
            // console.log("[regenerateShapeWithWinding] splitDisjointSubpathsInSVG function not available.");
        }
        
        svgParsedData = loader.parse(svgStringToParse);
    } catch (e) {
        console.error("Error parsing lastSvgData for regeneration:", e);
        return;
    }
    
    let paths = svgParsedData.paths;

    if (!paths || paths.length === 0 || shapeInfo.originalPath.pathIndex >= paths.length) {
        console.error(`Path index ${shapeInfo.originalPath.pathIndex} out of bounds (Total paths: ${paths ? paths.length : 0})`);
        return;
    }

    const targetPath = paths[shapeInfo.originalPath.pathIndex];
    
    // This check was here before, ensure it's still relevant or integrated if needed.
    // For now, the primary path check above should suffice.
    // if (paths.length === 0 || 
    //     (paths.length <= shapeInfo.originalPath.pathIndex && 
    //      window.SVGProcessing && window.SVGProcessing.Utils && typeof window.SVGProcessing.Utils.shouldCheckForUnconvertedShapes === 'function' &&
    //      window.SVGProcessing.Utils.shouldCheckForUnconvertedShapes(window.lastSvgData))) {
    //     console.log("[regenerateShapeWithWinding] SVGLoader found no/few paths, attempting shape extraction for regeneration.");
    //     if (typeof extractShapeElementsAsPaths === 'function') {
    //         const additionalPaths = extractShapeElementsAsPaths(window.lastSvgData);
    //         if (additionalPaths.length > 0) {
    //             paths.push(...additionalPaths);
    //             // Re-check targetPath if paths array was modified
    //             if (shapeInfo.originalPath.pathIndex < paths.length) {
    //                 targetPath = paths[shapeInfo.originalPath.pathIndex];
    //             } else {
    //                 console.error(`Path index ${shapeInfo.originalPath.pathIndex} still out of bounds after attempting extraction.`);
    //                 return;
    //             }
    //         }
    //     } else {
    //         console.warn("[regenerateShapeWithWinding] extractShapeElementsAsPaths function is not defined.");
    //     }
    // }
    // Re-ensure targetPath is valid if paths could have been modified by the above block (if uncommented)
    // if (!targetPath) {
    //     console.error(`Target path at index ${shapeInfo.originalPath.pathIndex} is invalid after potential extraction.`);
    //     return;
    // }


    const newWindingToUse = shapeInfo.useReversedWinding ? !svgAssumeCCW : svgAssumeCCW;
    console.log(`Regenerating shape ID ${shapeInfo.id} with target winding: ${newWindingToUse ? 'CCW' : 'CW'} (reversed: ${shapeInfo.useReversedWinding}, global svgAssumeCCW: ${svgAssumeCCW})`);
    
    const candidateShapes = targetPath.toShapes(newWindingToUse);
    
    if (!candidateShapes || candidateShapes.length === 0) {
        console.error(`No shapes generated for path index ${shapeInfo.originalPath.pathIndex} with ${newWindingToUse ? 'CCW' : 'CW'} winding.`);
        return;
    }
    
    let bestMatchIndex = 0;
    let finalShapeToUse;

    // The reference shape is based on the original parsing (using global svgAssumeCCW)
    // and the shapeInfo.originalPath.shapeIndex.
    const referenceShapesFromPath = targetPath.toShapes(svgAssumeCCW);

    if (referenceShapesFromPath && referenceShapesFromPath.length > shapeInfo.originalPath.shapeIndex) {
        const referenceShapeGeometry = referenceShapesFromPath[shapeInfo.originalPath.shapeIndex];
        const refPoints = referenceShapeGeometry.getPoints(settings.pointSampling.getPoints('default'));
        const refBounds = getBoundingBox(refPoints); // Ensure getBoundingBox is available
        const refArea = Math.abs(window.SVGProcessing.Utils.calculateShapeArea(referenceShapeGeometry, settings.pointSampling.getPoints('default'))); // Use global
        const refCenterX = (refBounds.minX + refBounds.maxX) / 2;
        const refCenterY = (refBounds.minY + refBounds.maxY) / 2;

        let bestMatchScore = Infinity;

        candidateShapes.forEach((candidateShape, index) => {
            const candPoints = candidateShape.getPoints(settings.pointSampling.getPoints('default'));
            const candBounds = getBoundingBox(candPoints);
            const candArea = Math.abs(window.SVGProcessing.Utils.calculateShapeArea(candidateShape, settings.pointSampling.getPoints('default'))); // Use global
            const candCenterX = (candBounds.minX + candBounds.maxX) / 2;
            const candCenterY = (candBounds.minY + candBounds.maxY) / 2;

            const distanceSquared = Math.pow(refCenterX - candCenterX, 2) + Math.pow(refCenterY - candCenterY, 2);
            const areaDiff = Math.abs(refArea - candArea);
            const maxArea = Math.max(refArea, candArea, 0.00001); // Avoid division by zero
            const areaRatioScore = areaDiff / maxArea; 
            
            const score = distanceSquared * extrudeConfig.regenerateShapeMatchWeight + areaRatioScore; 

            if (score < bestMatchScore) {
                bestMatchScore = score;
                bestMatchIndex = index;
            }
        });
        finalShapeToUse = candidateShapes[bestMatchIndex];
        console.log(`Using shape index ${bestMatchIndex} (score: ${bestMatchScore.toFixed(4)}) from ${candidateShapes.length} candidates, matched to original shape (index ${shapeInfo.originalPath.shapeIndex}).`);

    } else {
        console.warn(`Could not find reference shape (original index ${shapeInfo.originalPath.shapeIndex} in ${referenceShapesFromPath ? referenceShapesFromPath.length : 'N/A'} reference shapes). Falling back.`);
        if (candidateShapes.length > shapeInfo.originalPath.shapeIndex) {
            bestMatchIndex = shapeInfo.originalPath.shapeIndex; // Try original index if valid for candidates
        } else {
            bestMatchIndex = 0; // Default to the first candidate shape
        }
        finalShapeToUse = candidateShapes[bestMatchIndex];
        console.log(`Fallback: Using candidate shape index ${bestMatchIndex} from ${candidateShapes.length} candidates.`);
    }
    
    const originalShape = finalShapeToUse; // This is the THREE.Shape object to be extruded
    
    const { svgCenterX, svgCenterY, effectiveScale } = shapeInfo.originalPath;
    
    const lowQuality = false; // For regeneration, assume higher quality for points
    const pointsForOuter = settings.pointSampling.getPoints('default');
    // const pointsForHoles = settings.pointSampling.getPoints('default'); // Already available via validateHole

    const originalOuterPoints = originalShape.getPoints(pointsForOuter);
    if (originalOuterPoints.length < 2) { // Changed from originalOuterPoints.length < 3 to < 2 as THREE.Shape can be formed by 2 points (a line) but ExtrudeGeometry might still fail. Keeping it as < 2 for now.
        console.warn(`Not enough points for outer contour. Skipping.`);
        return;
    }
    
    const transformedOuterPoints = originalOuterPoints.map(p => {
        return new THREE.Vector2(
            (p.x - svgCenterX) * effectiveScale,
            (p.y - svgCenterY) * -effectiveScale
        );
    });

    const finalShape = new THREE.Shape(transformedOuterPoints);
    finalShape.holes = [];

    if (originalShape.holes && originalShape.holes.length > 0) {
        console.log(`Regenerating shape with ${originalShape.holes.length} potential holes`);
        let validHoles = 0;
        
        originalShape.holes.forEach((holePath, holeIndex) => {
            const finalHolePath = window.SVGProcessing.Holes.validateHole(holePath, finalShape, svgCenterX, svgCenterY, effectiveScale);
            
            if (finalHolePath) {
                // Check if this hole has the correct orientation for subtraction
                // The global validateHole already handles reversal if needed and stores it in userData.needsReversal
                // The points in finalHolePath are already correctly ordered by validateHole.
                // We just need to add it.
                finalShape.holes.push(finalHolePath);
                validHoles++;
            }
        });
        
        console.log(`Shape regeneration: ${validHoles} of ${originalShape.holes.length} holes validated`);
    }
    
    createExtrudedShapeWithId(finalShape, effectiveScale, lowQuality, shapeInfo.id);
}

function updateMeshAppearanceForOperation(mesh, operationType) {
    if (!mesh || !mesh.material) return;
    
    if (!mesh.material.userData) mesh.material.userData = {};
    if (!mesh.material.userData.originalColor && mesh.material.color) {
        mesh.material.userData.originalColor = mesh.material.color.clone();
    }
    
    const extrudeConfig = window.svgGlobalSettings.shapeExtrusion;

    switch (operationType) {
        case 'remove':
            // This shape is identified as a hole that should be subtracted.
            // "removed or subtracted ... instead of extruded" means it shouldn't appear as a positive extrusion.
            // Making it invisible is a way of "removing" it from the visual output.
            mesh.visible = false; 
            // Reset material to a default state as it's not visible.
            if (mesh.material.userData.originalColor) {
                mesh.material.color.copy(mesh.material.userData.originalColor);
            }
            mesh.material.wireframe = false;
            mesh.material.transparent = false;
            mesh.material.opacity = 1.0;
            mesh.material.depthWrite = true; 
            mesh.material.side = THREE.FrontSide; 

            console.warn(`Shape ${mesh.userData.shapeId} (operation: 'remove') is now hidden. True subtraction requires CSG operations.`);
            break;
            
        case 'disable':
            mesh.material.color.set(extrudeConfig.disabledColor);
            mesh.material.wireframe = false;
            mesh.material.transparent = true;
            mesh.material.opacity = extrudeConfig.disabledOpacity; 
            mesh.material.depthWrite = true; 
            mesh.material.side = THREE.FrontSide;
            mesh.visible = false; // Explicitly hide disabled shapes
            break;
            
        case 'extrude':
        default:
            if (mesh.material.userData.originalColor) {
                mesh.material.color.copy(mesh.material.userData.originalColor);
            }
            mesh.material.wireframe = false;
            mesh.material.transparent = false;
            mesh.material.opacity = 1.0;
            mesh.material.depthWrite = true;
            mesh.material.side = THREE.FrontSide;
            mesh.visible = true; // Ensure extrude shapes are visible by default (can be overridden by shapeInfo.isVisible)
            break;
    }
    
    mesh.material.needsUpdate = true;
}

window.updateMeshAppearanceForOperation = updateMeshAppearanceForOperation;
window.SVGProcessing.Shapes.updateMeshAppearanceForOperation = updateMeshAppearanceForOperation;

window.SVGProcessing.Shapes = {};

window.createExtrudedShapeWithId = createExtrudedShapeWithId;
window.SVGProcessing.Shapes.createExtrudedShapeWithId = createExtrudedShapeWithId;

window.createExtrudedShape = createExtrudedShape;
window.SVGProcessing.Shapes.createExtrudedShape = createExtrudedShape;

window.generateDistinctColor = generateDistinctColor;
window.SVGProcessing.Shapes.generateDistinctColor = generateDistinctColor;

window.getBoundingBox = getBoundingBox;
window.SVGProcessing.Shapes.getBoundingBox = getBoundingBox;

window.regenerateShapeWithWinding = regenerateShapeWithWinding;
window.SVGProcessing.Shapes.regenerateShapeWithWinding = regenerateShapeWithWinding;