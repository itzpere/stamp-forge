let selectedBaseId = 'default';
let previewRenderers = []; 
let modalDisplayed = false; 

// Add these global variables at the top of the file
let stampBase = null;
let scene = null;

// Don't redeclare brickColor, check if it exists globally
if (typeof window.brickColor === 'undefined') {
    window.brickColor = 0xbc8f8f;
}

// Use the existing global brickDimensions or create it if it doesn't exist
if (typeof window.brickDimensions === 'undefined') {
    window.brickDimensions = {
        width: 20,
        height: 3,
        depth: 20
    };
}

async function initBaseSelector() {
    const chooseBaseBtn = document.getElementById('chooseBaseBtn');
    const baseSelectModal = document.getElementById('baseSelectModal');
    const baseDesignsGrid = document.getElementById('baseDesignsGrid');
    const closeBtn = baseSelectModal.querySelector('.close');
    
    // Initialize scene reference from global
    if (!scene && window.scene) {
        scene = window.scene;
        console.log("Initialized local scene reference from global scene");
    }
    
    await loadBaseDesigns(); 
    
    if (chooseBaseBtn) {
        chooseBaseBtn.addEventListener('click', openBaseSelectModal);
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            baseSelectModal.style.display = 'none';
            stopPreviewRenderers();
        });
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === baseSelectModal) {
            baseSelectModal.style.display = 'none';
            stopPreviewRenderers();
        }
    });
    
    initRotationControls();
    
    initDimensionControls();
    
    showInitialModal();
}

function showInitialModal() {
    if (modalDisplayed) return;
    
    // console.log("Attempting to show initial base selection modal");
    
    if (document.readyState === 'complete') {
        openBaseSelectModal();
        modalDisplayed = true;
        return;
    }
    
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        setTimeout(openBaseSelectModal, 300);
        modalDisplayed = true;
        return;
    }
    
    window.addEventListener('load', () => {
        if (!modalDisplayed) {
            setTimeout(openBaseSelectModal, 500);
            modalDisplayed = true;
        }
    });
    
    setTimeout(() => {
        if (!modalDisplayed) {
            // console.log("Using fallback method for showing modal");
            openBaseSelectModal();
            modalDisplayed = true;
        }
    }, 1500);
}

function loadBaseDesigns() { 
    return fetch('models/base-designs.json') 
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load base designs: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            window.baseDesigns = data.designs || []; 
            // console.log(`Loaded ${window.baseDesigns.length} base designs`);
        })
        .catch(error => {
            console.error('Error loading base designs:', error);
            window.baseDesigns = [ 
                {
                    id: "default",
                    title: "Default Base",
                    file: "models/default_stamp_base.stl",
                    config: {
                        width: 20,
                        height: 3,
                        depth: 20,
                        rotation: { x: 0, y: 0, z: 0 } 
                    }
                }
            ];
        });
}

function openBaseSelectModal() {
    const baseSelectModal = document.getElementById('baseSelectModal');
    const baseDesignsGrid = document.getElementById('baseDesignsGrid');
    
    baseDesignsGrid.innerHTML = '';
    stopPreviewRenderers();
    previewRenderers = [];
    
    if (window.baseDesigns && window.baseDesigns.length > 0) {
        window.baseDesigns.forEach(design => {
            const card = createDesignCard(design);
            baseDesignsGrid.appendChild(card);
        });
    } else {
        console.warn("No base designs found to display in modal. window.baseDesigns might be empty or undefined.");
        baseDesignsGrid.innerHTML = '<p>No base designs available.</p>';
    }
    
    const uploadCard = createUploadCard();
    baseDesignsGrid.appendChild(uploadCard);
    
    baseSelectModal.style.display = 'block';
    
    setTimeout(startPreviewRenderers, 100);
}

function createDesignCard(design) {
    const card = document.createElement('div');
    card.className = 'base-design-card';
    card.dataset.id = design.id;
    
    if (design.id === selectedBaseId) {
        card.classList.add('selected');
    }
    
    const preview = document.createElement('div');
    preview.className = 'base-design-preview';
    preview.dataset.stlFile = design.file;
    
    const canvas = document.createElement('canvas');
    // Increase canvas size for better rendering quality
    canvas.width = 400; 
    canvas.height = 300;
    preview.appendChild(canvas);
    
    const title = document.createElement('div');
    title.className = 'base-design-title';
    title.textContent = design.title;
    
    card.appendChild(preview);
    card.appendChild(title);
    
    card.addEventListener('click', () => {
        selectBaseDesign(design);
    });
    
    return card;
}

function createUploadCard() {
    const card = document.createElement('div');
    card.className = 'base-design-card upload-card'; 
    
    const preview = document.createElement('div');
    preview.className = 'base-design-preview upload';
    
    const uploadIcon = document.createElement('div');
    uploadIcon.className = 'base-design-upload-icon';
    uploadIcon.innerHTML = '⬆️';
    preview.appendChild(uploadIcon);
    
    const title = document.createElement('div');
    title.className = 'base-design-title';
    title.textContent = 'Upload Custom Base';
    
    card.appendChild(preview);
    card.appendChild(title);
    
    card.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.stl';
        
        input.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                importStampBase(event);
                
                const baseSelectModal = document.getElementById('baseSelectModal');
                baseSelectModal.style.display = 'none';
                stopPreviewRenderers();
            }
        });
        
        input.click();
    });
    
    return card;
}

// Add the missing importStampBase function
function importStampBase(event) {
    if (!event.target.files || event.target.files.length === 0) {
        console.warn('No files selected for import');
        return;
    }
    
    const file = event.target.files[0];
    if (!file.name.toLowerCase().endsWith('.stl')) {
        alert('Please select an STL file for the stamp base');
        return;
    }
    
    // Clear any existing extruded SVG designs when importing a new base
    clearExtrudedDesigns();
    
    // ALWAYS clear SVG designs forcefully before uploading new base
    if (!clearExtrudedDesigns()) {
        console.error("Failed to clear existing designs. Visual artifacts may remain.");
    }
    
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.textContent = 'Loading custom base...';
        loadingElement.classList.remove('hidden');
    }
    
    // Initialize scene if it doesn't exist
    if (!scene && window.scene) {
        scene = window.scene;
    }
    
    // Get the color from global config if available
    if (window.brickColor !== undefined) {
        brickColor = window.brickColor;
    }
    
    // Get dimensions from global config if available
    if (window.brickDimensions) {
        brickDimensions = window.brickDimensions;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const contents = e.target.result;
        
        // Load the STL data directly
        const loader = new THREE.STLLoader();
        try {
            const geometry = loader.parse(contents);
            
            const material = new THREE.MeshStandardMaterial({
                color: brickColor,
                roughness: 0.5,
                metalness: 0.2,
                side: THREE.DoubleSide
            });
            
            // Get reference to stampBase from window if it exists
            if (window.stampBase) {
                stampBase = window.stampBase;
            }
            
            // Remove existing stamp base if any
            if (stampBase && scene) {
                scene.remove(stampBase);
                if (stampBase.geometry) stampBase.geometry.dispose();
                if (stampBase.material) {
                    if (Array.isArray(stampBase.material)) {
                        stampBase.material.forEach(m => m.dispose());
                    } else {
                        stampBase.material.dispose();
                    }
                }
            }
            
            // Create new stamp base mesh
            stampBase = new THREE.Mesh(geometry, material);
            
            // Apply the same 270-degree X-axis rotation as in loadBaseSTL
            const defaultXRotation = THREE.MathUtils.degToRad(270);
            stampBase.rotation.set(defaultXRotation, 0, 0);
            console.log("Applied default 270° X-axis rotation to uploaded base");
            
            // Make sure it's available globally
            window.stampBase = stampBase;
            
            // Calculate and update dimensions from the geometry
            geometry.computeBoundingBox();
            const boundingBox = geometry.boundingBox;
            const size = new THREE.Vector3();
            boundingBox.getSize(size);
            
            // Center the geometry
            const center = new THREE.Vector3();
            boundingBox.getCenter(center);
            geometry.translate(-center.x, -boundingBox.min.y, -center.z);
            
            // Update dimensions
            brickDimensions.width = size.x;
            brickDimensions.height = size.y;
            brickDimensions.depth = size.z;
            
            // Add to scene
            scene.add(stampBase);
            
            // Update top surface for extrusion positioning
            if (typeof window.updateAndApplyBaseTopSurface === 'function') {
                window.updateAndApplyBaseTopSurface();
            } else {
                updateBaseTopSurfaceLocal();
            }
            
            console.log(`Custom base imported: ${file.name}`);
            console.log(`Dimensions set to: ${brickDimensions.width.toFixed(2)} × ${brickDimensions.height.toFixed(2)} × ${brickDimensions.depth.toFixed(2)}`);
            
            // Mark as custom base
            selectedBaseId = 'custom';
            
            // Enable download button
            const downloadButton = document.getElementById('downloadSTL');
            if (downloadButton) {
                downloadButton.disabled = false;
            }
            
            // Adjust camera view
            setTimeout(fitCameraToObject, 100);
            
            if (loadingElement) {
                loadingElement.classList.add('hidden');
            }
            
        } catch (error) {
            console.error('Error parsing STL file:', error);
            alert('Failed to load STL file. The file may be corrupt or in an unsupported format.');
            if (loadingElement) {
                loadingElement.classList.add('hidden');
            }
        }
    };
    
    reader.onerror = function() {
        console.error('Error reading file');
        alert('Error reading the file. Please try again.');
        if (loadingElement) {
            loadingElement.classList.add('hidden');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

function startPreviewRenderers() {
    const previewElements = document.querySelectorAll('.base-design-preview[data-stl-file]');
    
    previewElements.forEach(previewElement => {
        const stlFile = previewElement.dataset.stlFile;
        const canvas = previewElement.querySelector('canvas');
        
        if (stlFile && canvas) {
            initPreviewRenderer(canvas, stlFile);
        }
    });
}

function initPreviewRenderer(canvas, stlFile) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    
    // Use more zoomed-in perspective with smaller field of view
    const camera = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 0.1, 1000);
    // Position camera closer to the model
    camera.position.set(0, 0, 25);
    
    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvas,
        antialias: true,
        alpha: true 
    });
    renderer.setSize(canvas.width, canvas.height);
    
    // Improve lighting for better preview
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);
    
    // Add a second directional light from another angle
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 5, -7);
    scene.add(fillLight);
    
    let mesh = null;
    
    const loader = new THREE.STLLoader();
    loader.load(stlFile, geometry => {
        const material = new THREE.MeshStandardMaterial({
            color: 0xbc8f8f, 
            roughness: 0.5,
            metalness: 0.2
        });
        
        mesh = new THREE.Mesh(geometry, material);
        
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox;
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);
        
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        // Increase scale factor for larger preview
        const scale = 12 / maxDim;
        mesh.scale.set(scale, scale, scale);
        
        scene.add(mesh);
    });
    
    function animate() {
        const animationId = requestAnimationFrame(animate);
        
        if (mesh) {
            // Slow down rotation for a more elegant preview
            mesh.rotation.y += 0.01;
        }
        
        renderer.render(scene, camera);
        
        renderer.userData = { animationId };
    }
    
    animate();
    
    previewRenderers.push(renderer);
}

function stopPreviewRenderers() {
    previewRenderers.forEach(renderer => {
        if (renderer.userData && renderer.userData.animationId) {
            cancelAnimationFrame(renderer.userData.animationId);
        }
        renderer.dispose();
    });
    previewRenderers = [];
}

function selectBaseDesign(design) {
    selectedBaseId = design.id;
    
    const cards = document.querySelectorAll('.base-design-card');
    cards.forEach(card => card.classList.remove('selected'));
    
    const selectedCard = document.querySelector(`.base-design-card[data-id="${design.id}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // ALWAYS clear SVG designs forcefully before changing base
    if (!clearExtrudedDesigns()) {
        console.error("Failed to clear existing designs. Visual artifacts may remain.");
    }
    
    // Make sure no callbacks are triggered during the 100ms we wait
    const pendingCallbacks = [];
    if (window._pendingSVGProcessingCalls) {
        pendingCallbacks.push(...window._pendingSVGProcessingCalls);
        window._pendingSVGProcessingCalls = [];
    }
    
    // Add a delay before loading the new base to ensure cleanup is complete
    setTimeout(() => {
        loadBaseSTL(design.file, design.config);
        
        const baseSelectModal = document.getElementById('baseSelectModal');
        baseSelectModal.style.display = 'none';
        stopPreviewRenderers();
    }, 100);
}

// Replace the existing clearExtrudedDesigns function with this more aggressive version
function clearExtrudedDesigns() {
    console.log("AGGRESSIVE CLEARING of all extruded designs and SVG data");
    
    try {
        // Clear the extrudedGroup contents
        if (window.extrudedGroup) {
            console.log(`Starting with ${window.extrudedGroup.children.length} children in extrudedGroup`);
            
            // Remove all extruded shapes
            while(window.extrudedGroup.children.length > 0) {
                const child = window.extrudedGroup.children[0];
                window.extrudedGroup.remove(child);
                
                if (child.geometry) {
                    child.geometry.dispose();
                    child.geometry = null;
                }
                
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => {
                            m.dispose();
                            m = null;
                        });
                    } else {
                        child.material.dispose();
                        child.material = null;
                    }
                }
            }
            
            // Force update of the scene
            window.extrudedGroup.updateMatrixWorld(true);
            console.log(`After clearing: ${window.extrudedGroup.children.length} children in extrudedGroup`);
        }
        
        // Create a completely new extrudedGroup to ensure clean state
        if (window.scene && window.extrudedGroup) {
            window.scene.remove(window.extrudedGroup);
            window.extrudedGroup = new THREE.Group();
            window.extrudedGroup.position.set(0, 0, 0);
            window.scene.add(window.extrudedGroup);
            console.log("Created fresh extrudedGroup");
        }
        
        // Reset ALL related global state
        window.lastSvgData = null;
        window.previousSvgData = null;
        window.currentSvgFilename = null;
        window._pendingSVGProcessingCalls = [];
        
        // Reset shape information
        window.shapeRenderInfo = [];
        window.shapeColorCounter = 0;
        window._deletedShapeIds = new Set(); // Clear deleted shapes when loading new SVG
        
        // Reset UI elements - FIX THE SVG UPLOAD HANDLING
        try {
            // Get a reference to the SVG upload input
            const svgUpload = document.getElementById('svgUpload');
            
            // If the element exists and we can safely reset it
            if (svgUpload) {
                // Method 1: Reset the value (safest way)
                svgUpload.value = '';
                
                // Method 2: If the original event listener needs to be preserved
                // but we don't need to do DOM manipulation
                if (svgUpload.parentNode) {
                    try {
                        const newUpload = document.createElement('input');
                        newUpload.type = 'file';
                        newUpload.id = 'svgUpload';
                        newUpload.accept = '.svg';
                        
                        // Store the parent before removing the original
                        const parent = svgUpload.parentNode;
                        
                        // Remove the original
                        parent.removeChild(svgUpload);
                        
                        // Add the new element
                        parent.appendChild(newUpload);
                        
                        // Add event listener to the new element
                        newUpload.addEventListener('change', function(event) {
                            if (event.target.files && event.target.files.length > 0) {
                                const file = event.target.files[0];
                                if (typeof window.handleSVGUpload === 'function') {
                                    window.handleSVGUpload(file);
                                }
                            }
                        });
                        
                        console.log("SVG upload input replaced successfully");
                    } catch (replaceError) {
                        console.error("Error replacing SVG upload element:", replaceError);
                        // Fallback to just clearing the value
                        svgUpload.value = '';
                    }
                } else {
                    // If we can't replace it, just clear its value
                    console.log("SVG upload has no parent node, just clearing value");
                    svgUpload.value = '';
                }
            } else {
                console.log("SVG upload element not found in DOM");
            }
        } catch (uiError) {
            console.error("Error handling SVG upload element:", uiError);
        }
        
        // Clear any module-specific caches
        if (window.SVGProcessing) {
            if (window.SVGProcessing.cache) window.SVGProcessing.cache = {};
            if (window.SVGProcessing.processedPaths) window.SVGProcessing.processedPaths = {};
            if (window.SVGProcessing.lastProcessedData) window.SVGProcessing.lastProcessedData = null;
        }
        
        // Update the UI
        if (typeof window.populateShapeList === 'function') {
            window.populateShapeList();
        }
        
        // Force a complete rebuild of all scenes
        if (window.renderer && window.scene && window.camera) {
            window.renderer.clear();
            window.renderer.render(window.scene, window.camera);
        }
        
        console.log("COMPLETE RESET: All SVG geometry and data has been forcefully cleared");
    } catch (error) {
        console.error("Error during aggressive SVG cleanup:", error);
    }
    
    // Return true to indicate function ran
    return true;
}

function loadBaseSTL(file, config) {
    const loader = new THREE.STLLoader();
    const loadingElement = document.getElementById('loading');

    if (loadingElement) {
        loadingElement.textContent = 'Loading base...';
        loadingElement.classList.remove('hidden');
    }
    
    // Ensure scene is initialized before proceeding
    if (!scene && window.scene) {
        scene = window.scene;
        console.log("Retrieved scene reference for STL loading");
    }
    
    if (!scene) {
        console.error("Scene is not available. Cannot load base STL.");
        alert("Error: 3D scene is not initialized. Please refresh the page.");
        if (loadingElement) {
            loadingElement.classList.add('hidden');
        }
        return;
    }
    
    loader.load(
        file,
        function (geometry) {
            
            const material = new THREE.MeshStandardMaterial({
                color: brickColor,
                roughness: 0.5,
                metalness: 0.2,
                side: THREE.DoubleSide
            });
            
            stampBase = new THREE.Mesh(geometry, material);
            
            geometry.computeBoundingBox();            
            const boundingBox = geometry.boundingBox;

            // Apply default 270-degree X rotation instead of 90-degree
            // This rotates in the correct direction to sit on the ground plane
            const defaultXRotation = THREE.MathUtils.degToRad(270);
            
            if (config && config.rotation) {
                // Apply configuration rotation on top of the default 270-degree rotation
                stampBase.rotation.set(
                    defaultXRotation + THREE.MathUtils.degToRad(config.rotation.x || 0),
                    THREE.MathUtils.degToRad(config.rotation.y || 0),
                    THREE.MathUtils.degToRad(config.rotation.z || 0)
                );
                console.log(`Applied rotation from config + 270° X-axis: X=${270 + (config.rotation.x || 0)}, Y=${config.rotation.y}, Z=${config.rotation.z} degrees`);
            } else {
                // Just apply the default 270-degree rotation if no config rotation
                stampBase.rotation.set(defaultXRotation, 0, 0);
                console.log("Applied default 270° X-axis rotation");
            }
            
            if (config && typeof config.height === 'number') {
                brickDimensions.height = config.height;
                brickDimensions.width = config.width || 20;
                brickDimensions.depth = config.depth || 20;
                // console.log(`[loadBaseSTL] Config height: ${brickDimensions.height}. Width: ${brickDimensions.width}, Depth: ${brickDimensions.depth}`);
            } else {
                console.warn(`[loadBaseSTL] config.height not found for ${file}. Using bounding box dimensions.`);
                
                stampBase.updateMatrixWorld(true);

                const localGeomBox = new THREE.Box3().setFromBufferAttribute(stampBase.geometry.attributes.position);
                const localCenter = new THREE.Vector3();
                localGeomBox.getCenter(localCenter);
                stampBase.geometry.translate(-localCenter.x, -localGeomBox.min.y, -localCenter.z);
                
                stampBase.geometry.computeBoundingBox();
                const finalBounds = stampBase.geometry.boundingBox; 
                const size = new THREE.Vector3();
                finalBounds.getSize(size);

                brickDimensions.height = size.y > 0 && isFinite(size.y) ? size.y : 3;
                brickDimensions.width = size.x > 0 && isFinite(size.x) ? size.x : (config?.width ?? 20);
                brickDimensions.depth = size.z > 0 && isFinite(size.z) ? size.z : (config?.depth ?? 20);
            
            console.log(`[loadBaseSTL] Set dimensions: H=${brickDimensions.height.toFixed(2)}, W=${brickDimensions.width.toFixed(2)}, D=${brickDimensions.depth.toFixed(2)}`);
            }
            
            scene.add(stampBase);

            if (typeof window.updateAndApplyBaseTopSurface === 'function') {
                // console.log("Using global updateAndApplyBaseTopSurface from geometry.js");
                window.updateAndApplyBaseTopSurface();
            } else {
                console.log("Global updateAndApplyBaseTopSurface not found, using local implementation");
                updateBaseTopSurfaceLocal();
            }
            
            setTimeout(fitCameraToObject, 100);
            
            // console.log(`Base design loaded: ${file}`);
            // console.log(`Dimensions set to: ${brickDimensions.width} × ${brickDimensions.height} × ${brickDimensions.depth}`);
            
            const downloadButton = document.getElementById('downloadSTL');
            if (downloadButton) {
                downloadButton.disabled = false;
                // console.log("Download STL button enabled after base selection.");
            }

            if (loadingElement) {
                loadingElement.classList.add('hidden');
            }
        },
        function (xhr) {
            // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.error('Error loading base STL:', error);
            alert('Error loading base design. Please try another design.');
            
            if (loadingElement) { // Use the locally scoped loadingElement
                loadingElement.classList.add('hidden');
            }
        }
    );
}

function updateBaseTopSurfaceLocal() {
    if (!stampBase) {
        console.warn("[updateBaseTopSurfaceLocal] stampBase is null");
        window.currentBaseTopSurfaceY = brickDimensions.height || 3.0;
        return;
    }

    stampBase.updateMatrixWorld(true);
    const worldBox = new THREE.Box3().setFromObject(stampBase);
    
    if (worldBox.isEmpty()) {
        console.warn("[updateBaseTopSurfaceLocal] Stamp base bounding box is empty. Using height from dimensions.");
        window.currentBaseTopSurfaceY = brickDimensions.height || 3.0;
    } else {
        window.currentBaseTopSurfaceY = worldBox.max.y;
    }
    
    // console.log(`[updateBaseTopSurfaceLocal] Updated surface Y to: ${window.currentBaseTopSurfaceY.toFixed(2)}`);

    if (typeof window.autoSetYOffset !== 'undefined' && window.autoSetYOffset === true) {
        if (typeof window.applyAutoYOffsetBehavior === 'function') {
            // console.log("[updateBaseTopSurfaceLocal] Calling applyAutoYOffsetBehavior with autoSetYOffset=true");
            window.applyAutoYOffsetBehavior();
        }
    } else if (window.lastSvgData && typeof window.parseSVGForExtrusion === 'function') {
        // console.log("[updateBaseTopSurfaceLocal] Re-parsing SVG with new base height");
        window.parseSVGForExtrusion(window.lastSvgData, false, window.maxInteractiveQuality || 0.7);
    }
}

function initRotationControls() {
    const rotateXBtn = document.getElementById('rotateXBtn');
    const rotateYBtn = document.getElementById('rotateYBtn');
    const rotateZBtn = document.getElementById('rotateZBtn');
    const resetRotationBtn = document.getElementById('resetRotationBtn');
    
    if (rotateXBtn) {
        rotateXBtn.addEventListener('click', () => {
            rotateBase('x'); 
        });
    }
    
    if (rotateYBtn) {
        rotateYBtn.addEventListener('click', () => {
            rotateBase('y'); 
        });
    }
    
    if (rotateZBtn) {
        rotateZBtn.addEventListener('click', () => {
            rotateBase('z'); 
        });
    }
    
    if (resetRotationBtn) {
        resetRotationBtn.addEventListener('click', resetBaseRotation);
    }
}

function initDimensionControls() {
    const widthInput = document.getElementById('brickWidth');
    const heightInput = document.getElementById('brickHeight');
    const depthInput = document.getElementById('brickDepth');
    
    if (widthInput) {
        widthInput.addEventListener('change', updateBaseDimensions);
    }
    
    if (heightInput) {
        heightInput.addEventListener('change', updateBaseDimensions);
    }
    
    if (depthInput) {
        depthInput.addEventListener('change', updateBaseDimensions);
    }
}

function rotateBase(axis) { 
    if (!stampBase) {
        console.warn('No stamp base to rotate');
        return;
    }

    const rotationAngleRadians = THREE.MathUtils.degToRad(rotationStepDegrees); 
    
    switch(axis.toLowerCase()) {
        case 'x':
            stampBase.rotation.x += rotationAngleRadians;
            stampBase.rotation.x = THREE.MathUtils.euclideanModulo(stampBase.rotation.x, 2 * Math.PI);
            break;
        case 'y':
            stampBase.rotation.y += rotationAngleRadians;
            stampBase.rotation.y = THREE.MathUtils.euclideanModulo(stampBase.rotation.y, 2 * Math.PI);
            break;
        case 'z':
            stampBase.rotation.z += rotationAngleRadians;
            stampBase.rotation.z = THREE.MathUtils.euclideanModulo(stampBase.rotation.z, 2 * Math.PI);
            break;
    }
    
    console.log(`Rotated base around ${axis}-axis. Current rotation (degrees):`, {
        x: THREE.MathUtils.radToDeg(stampBase.rotation.x).toFixed(1),
        y: THREE.MathUtils.radToDeg(stampBase.rotation.y).toFixed(1),
        z: THREE.MathUtils.radToDeg(stampBase.rotation.z).toFixed(1)
    });
    
    if (typeof updateAndApplyBaseTopSurface === 'function') {
        updateAndApplyBaseTopSurface(); 
    } else {
        console.warn("updateAndApplyBaseTopSurface not available in rotateBase. Design might not reposition correctly.");
    }

    if (renderer) renderer.render(scene, camera);
    
    setTimeout(fitCameraToObject, 100);
}

function resetBaseRotation() {
    if (!stampBase) {
        console.warn('No stamp base to reset rotation')
        return;
    }
    
    // Reset to default 270-degree X rotation (converted to radians)
    const defaultXRotation = THREE.MathUtils.degToRad(270);
    stampBase.rotation.set(defaultXRotation, 0, 0);
    
    console.log('Reset base rotation to default (270° X, 0° Y, 0° Z)');
    
    if (typeof updateAndApplyBaseTopSurface === 'function') {
        updateAndApplyBaseTopSurface(); 
    } else if (typeof updateBaseTopSurfaceLocal === 'function') {
        updateBaseTopSurfaceLocal();
    }
    
    if (renderer) renderer.render(scene, camera);
    
    setTimeout(fitCameraToObject, 100);
}

function updateBaseDimensions() {
    const width = parseFloat(document.getElementById('brickWidth').value);
    const height = parseFloat(document.getElementById('brickHeight').value);
    const depth = parseFloat(document.getElementById('brickDepth').value);
    
    if (isNaN(width) || isNaN(height) || isNaN(depth)) {
        console.warn('Invalid dimension values');
        return;
    }
    
    brickDimensions.width = width;
    brickDimensions.height = height;
    brickDimensions.depth = depth;
    
    console.log('Updated base dimensions:', brickDimensions);
    
    if (selectedBaseId) {
        const selectedBase = window.baseDesigns.find(design => design.id === selectedBaseId); 
        if (selectedBase) {
            const config = {
                ...selectedBase.config,
                width: width,
                height: height,
                depth: depth,
                rotation: selectedBase.config.rotation
            };
            
            loadBaseSTL(selectedBase.file, config);
        } else {
            createBrick();
        }
    } else {
        createBrick();
    }
}

document.addEventListener('DOMContentLoaded', initBaseSelector);
