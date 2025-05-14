let selectedBaseId = 'default';
let previewRenderers = []; 
let modalDisplayed = false; 

async function initBaseSelector() { 
    const chooseBaseBtn = document.getElementById('chooseBaseBtn');
    const baseSelectModal = document.getElementById('baseSelectModal');
    const baseDesignsGrid = document.getElementById('baseDesignsGrid');
    const closeBtn = baseSelectModal.querySelector('.close');
    
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
    
    loadBaseSTL(design.file, design.config);
    
    const baseSelectModal = document.getElementById('baseSelectModal');
    baseSelectModal.style.display = 'none';
    stopPreviewRenderers();
}

function loadBaseSTL(file, config) {
    const loader = new THREE.STLLoader();
    const loadingElement = document.getElementById('loading'); // Get the loading element

    if (loadingElement) { // Show loading message
        loadingElement.textContent = 'Loading base...';
        loadingElement.classList.remove('hidden');
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

            if (config && config.rotation) {
                stampBase.rotation.set(
                    THREE.MathUtils.degToRad(config.rotation.x || 0),
                    THREE.MathUtils.degToRad(config.rotation.y || 0),
                    THREE.MathUtils.degToRad(config.rotation.z || 0)
                );
                // console.log(`Applied rotation from config: X=${config.rotation.x}, Y=${config.rotation.y}, Z=${config.rotation.z} degrees`);
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
        console.warn('No stamp base to reset rotation');
        return;
    }
    
    stampBase.rotation.set(0, 0, 0);
    
    console.log('Reset base rotation to default');
    
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
