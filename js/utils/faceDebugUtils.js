// Face component debugging utilities

window.FaceDebugUtils = {
    // Create a visual grid at the center of the extrusion to help with positioning
    createDebugGrid: function() {
        if (!window.extrudedGroup) return null;
        
        const gridSize = 5;
        const gridDivisions = 10;
        const gridColor = 0x0000ff;
        
        const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor);
        gridHelper.position.set(window.extrusionPosition.x, window.extrusionPosition.y, window.extrusionPosition.z);
        gridHelper.rotation.x = Math.PI / 2; // Rotate to be in XZ plane
        
        window.extrudedGroup.add(gridHelper);
        console.log("DEBUG: Added debug grid at extrusion center");
        
        return gridHelper;
    },
    
    // Create axis indicators for face components
    createAxisIndicators: function() {
        if (!window.extrudedGroup) return null;
        
        const size = 1;
        const xAxisMaterial = new THREE.LineBasicMaterial({color: 0xff0000});
        const yAxisMaterial = new THREE.LineBasicMaterial({color: 0x00ff00});
        const zAxisMaterial = new THREE.LineBasicMaterial({color: 0x0000ff});
        
        // X axis (red)
        const xAxisGeometry = new THREE.BufferGeometry();
        xAxisGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
            0, 0, 0, size, 0, 0
        ], 3));
        const xAxis = new THREE.Line(xAxisGeometry, xAxisMaterial);
        
        // Y axis (green)
        const yAxisGeometry = new THREE.BufferGeometry();
        yAxisGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
            0, 0, 0, 0, size, 0
        ], 3));
        const yAxis = new THREE.Line(yAxisGeometry, yAxisMaterial);
        
        // Z axis (blue)
        const zAxisGeometry = new THREE.BufferGeometry();
        zAxisGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
            0, 0, 0, 0, 0, size
        ], 3));
        const zAxis = new THREE.Line(zAxisGeometry, zAxisMaterial);
        
        const axisGroup = new THREE.Group();
        axisGroup.add(xAxis);
        axisGroup.add(yAxis);
        axisGroup.add(zAxis);
        
        axisGroup.position.set(window.extrusionPosition.x, window.extrusionPosition.y, window.extrusionPosition.z);
        window.extrudedGroup.add(axisGroup);
        
        console.log("DEBUG: Added axis indicators at extrusion center");
        return axisGroup;
    },
    
    // Test different axis mappings for face components
    testAxisMappings: function() {
        if (!window.extrudedGroup) return;
        
        // Find face components
        const faceComponents = [];
        window.extrudedGroup.traverse(obj => {
            if (obj.isMesh && obj.userData.isFaceComponent) {
                faceComponents.push(obj);
            }
        });
        
        if (faceComponents.length === 0) {
            console.log("DEBUG: No face components found to test axis mappings");
            return;
        }
        
        console.log(`DEBUG: Testing axis mappings for ${faceComponents.length} face components`);
        
        // Create clones with different axis mappings for comparison
        faceComponents.forEach((comp, index) => {
            if (!comp.userData.debugInfo) return;
            
            const {originalCenter, relativeOffset, uniformScale} = comp.userData.debugInfo;
            const relX = relativeOffset.x;
            const relZ = relativeOffset.z;
            
            // Create debug spheres for different mappings
            const mappings = [
                { name: 'X→X, Y→Z', x: window.extrusionPosition.x + relX, z: window.extrusionPosition.z + relZ, color: 0xff0000 },
                { name: 'X→Z, Y→X', x: window.extrusionPosition.x + relZ, z: window.extrusionPosition.z + relX, color: 0x00ff00 },
                { name: 'X→Z, Y→-X', x: window.extrusionPosition.x - relZ, z: window.extrusionPosition.z + relX, color: 0x0000ff },
                { name: 'X→-Z, Y→X', x: window.extrusionPosition.x + relZ, z: window.extrusionPosition.z - relX, color: 0xffff00 }
            ];
            
            mappings.forEach(mapping => {
                const sphereGeom = new THREE.SphereGeometry(0.05, 8, 8);
                const sphereMat = new THREE.MeshBasicMaterial({color: mapping.color});
                const sphere = new THREE.Mesh(sphereGeom, sphereMat);
                
                sphere.position.x = mapping.x;
                sphere.position.y = comp.position.y; // Keep same Y
                sphere.position.z = mapping.z;
                
                sphere.userData.mappingInfo = {
                    component: index,
                    mapping: mapping.name
                };
                
                window.extrudedGroup.add(sphere);
                
                console.log(`DEBUG: Component ${index} - ${mapping.name} mapping at:`, 
                    {x: sphere.position.x.toFixed(2), z: sphere.position.z.toFixed(2)});
            });
        });
        
        console.log("DEBUG: Added test mappings for face components");
    },
    
    // Add position monitoring for face components
    monitorComponentPositions: function() {
        if (!window.extrudedGroup) return;
        
        // Find face components
        const faceComponents = [];
        window.extrudedGroup.traverse(obj => {
            if (obj.isMesh && obj.userData.isFaceComponent) {
                faceComponents.push(obj);
            }
        });
        
        if (faceComponents.length === 0) {
            console.log("DEBUG: No face components found to monitor");
            return;
        }
        
        console.log(`DEBUG: Monitoring positions for ${faceComponents.length} face components`);
        
        // Setup interval to check positions
        const intervalId = setInterval(() => {
            faceComponents.forEach((comp, index) => {
                if (!comp.userData.targetPosition) return;
                
                const current = comp.position;
                const target = comp.userData.targetPosition;
                const diff = new THREE.Vector3().subVectors(current, target);
                
                // Check if position has changed significantly
                if (diff.length() > 0.001) {
                    console.log(`DEBUG: Component ${index} position drift detected!`);
                    console.log(`  Current: (${current.x.toFixed(3)}, ${current.y.toFixed(3)}, ${current.z.toFixed(3)})`);
                    console.log(`  Target: (${target.x.toFixed(3)}, ${target.y.toFixed(3)}, ${target.z.toFixed(3)})`);
                    
                    // Restore correct position
                    comp.position.copy(target);
                    comp.updateMatrix();
                    comp.updateMatrixWorld(true);
                }
            });
        }, 500);
        
        // Store interval ID for cleanup
        window.facePositionMonitorId = intervalId;
        
        return intervalId;
    },
    
    // Stop position monitoring
    stopMonitoringPositions: function() {
        if (window.facePositionMonitorId) {
            clearInterval(window.facePositionMonitorId);
            window.facePositionMonitorId = null;
            console.log("DEBUG: Position monitoring stopped");
        }
    },
    
    // Create visible handles for face components
    createPositionHandles: function() {
        if (!window.extrudedGroup) return;
        
        // Remove existing handles if any
        this.removePositionHandles();
        
        const handleGroup = new THREE.Group();
        handleGroup.name = "faceComponentHandles";
        
        // Find face components
        window.extrudedGroup.traverse(obj => {
            if (obj.isMesh && obj.userData.isFaceComponent) {
                // Create handle geometry - small sphere at component position
                const handleGeom = new THREE.SphereGeometry(0.1, 8, 8);
                const handleMat = new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                    wireframe: true
                });
                
                const handle = new THREE.Mesh(handleGeom, handleMat);
                
                // Position at component position
                handle.position.copy(obj.position);
                
                // Add userData to link handle to component
                handle.userData.linkedComponent = obj;
                handle.userData.isPositionHandle = true;
                
                handleGroup.add(handle);
                
                // Add axis lines for better visibility
                const axisLength = 0.3;
                
                // X axis (red)
                const xAxisMat = new THREE.LineBasicMaterial({color: 0xff0000});
                const xAxisGeom = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(axisLength, 0, 0)
                ]);
                const xAxis = new THREE.Line(xAxisGeom, xAxisMat);
                handle.add(xAxis);
                
                // Z axis (blue)
                const zAxisMat = new THREE.LineBasicMaterial({color: 0x0000ff});
                const zAxisGeom = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(0, 0, axisLength)
                ]);
                const zAxis = new THREE.Line(zAxisGeom, zAxisMat);
                handle.add(zAxis);
            }
        });
        
        window.extrudedGroup.add(handleGroup);
        console.log("DEBUG: Added position handles to face components");
        
        return handleGroup;
    },
    
    // Remove position handles
    removePositionHandles: function() {
        if (!window.extrudedGroup) return;
        
        const handleGroup = window.extrudedGroup.getObjectByName("faceComponentHandles");
        if (handleGroup) {
            window.extrudedGroup.remove(handleGroup);
            console.log("DEBUG: Removed position handles");
        }
    },
    
    // Activate all debug helpers
    activateAllDebugHelpers: function() {
        this.createDebugGrid();
        this.createAxisIndicators();
        this.testAxisMappings();
        this.monitorComponentPositions();
        this.createPositionHandles();
        
        console.log("DEBUG: All face component debug helpers activated");
        
        // Add special CSS to highlight debug console messages
        const style = document.createElement('style');
        style.textContent = `
            .console-debug-highlight {
                background-color: #ffffcc;
                color: #333;
                padding: 2px 4px;
                border-radius: 2px;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
        
        // Override console.log to highlight debug messages
        const originalConsoleLog = console.log;
        console.log = function() {
            const args = Array.from(arguments);
            if (typeof args[0] === 'string' && args[0].startsWith('DEBUG:')) {
                args[0] = `%c${args[0]}`;
                args.splice(1, 0, 'background: #ffffcc; color: #333; padding: 2px 4px; border-radius: 2px; font-weight: bold;');
            }
            originalConsoleLog.apply(console, args);
        };
    }
};

// Auto-activate debug helpers when a face SVG is detected
const originalDetectFaceLikePattern = window.detectFaceLikePattern;
if (originalDetectFaceLikePattern) {
    window.detectFaceLikePattern = function() {
        const result = originalDetectFaceLikePattern.apply(this, arguments);
        if (result) {
            // Face SVG detected, activate debug helpers after a small delay
            setTimeout(() => {
                window.FaceDebugUtils.activateAllDebugHelpers();
            }, 500);
        }
        return result;
    };
    console.log("DEBUG: Installed face detection hook for auto-debugging");
}

console.log("Face Debug Utilities loaded and ready for use");
