// Gallery loading script - Static version for GitHub Pages

// Load the gallery when the document is ready
document.addEventListener('DOMContentLoaded', loadGallery);

// Function to load the gallery
function loadGallery() {
    const galleryContainer = document.getElementById('gallery-container');
    const galleryLoading = document.getElementById('gallery-loading');
    const galleryError = document.getElementById('gallery-error');
    
    if (!galleryContainer) return;
    
    // Show loading indicator
    if (galleryLoading) galleryLoading.classList.remove('hidden');
    if (galleryError) galleryError.classList.add('hidden');
    
    // Load from static JSON file instead of API endpoint
    fetch('svgs/gallery.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Hide loading indicator
            if (galleryLoading) galleryLoading.classList.add('hidden');
            
            // Check if we have images
            if (!data.images || data.images.length === 0) {
                showGalleryError('No SVG files found. Add SVG files to the "svgs" directory.');
                return;
            }
            
            // Create gallery items
            galleryContainer.innerHTML = ''; // Clear existing content
            data.images.forEach(image => {
                const item = createGalleryItem(image);
                galleryContainer.appendChild(item);
            });
            
            console.log(`Loaded ${data.images.length} SVG files in gallery`);
        })
        .catch(error => {
            console.error('Error loading gallery:', error);
            showGalleryError(`Error loading gallery: ${error.message}`);
        });
}

// Show gallery error
function showGalleryError(message) {
    const galleryLoading = document.getElementById('gallery-loading');
    const galleryError = document.getElementById('gallery-error');
    
    if (galleryLoading) galleryLoading.classList.add('hidden');
    if (galleryError) {
        galleryError.textContent = message;
        galleryError.classList.remove('hidden');
    }
}

// Create a gallery item
function createGalleryItem(image) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    
    // Create SVG container with fixed dimensions
    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-container';
    
    // Create img element with proper styling for SVGs
    const img = document.createElement('img');
    img.src = image.path;
    img.alt = image.name;
    img.title = image.name;
    img.className = 'gallery-svg';
    
    // Add error handling for SVG loading issues
    img.onerror = function() {
        this.onerror = null;
        this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f8f8f8"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="%23999"%3EError%3C/text%3E%3C/svg%3E';
        console.error(`Failed to load SVG: ${image.path}`);
    };
    
    svgContainer.appendChild(img);
    
    // Add SVG name below image
    const nameEl = document.createElement('div');
    nameEl.className = 'gallery-item-name';
    nameEl.textContent = image.name.replace(/\.svg$/, '');
    
    // Assemble the item
    item.appendChild(svgContainer);
    item.appendChild(nameEl);
    
    // Add click event to load the SVG
    item.addEventListener('click', () => {
        console.log('Gallery item clicked:', image.name);
        loadSVGFromGallery(image.path, image.name);
    });
    
    return item;
}

// Load SVG from gallery
function loadSVGFromGallery(path, name) {
    console.log(`Loading SVG: ${path}`);
    
    // Show loading indicator
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.textContent = `Loading ${name}...`;
        loadingElement.classList.remove('hidden');
    }
    
    // CRITICAL FIX: Clean up previous resources before loading a new SVG
    cleanupPreviousResources();
    
    // Fetch the SVG file
    fetch(path)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(svgData => {
            console.log(`SVG loaded: ${name} (${svgData.length} bytes)`);
            
            // Store the SVG data globally for reuse
            window.lastSvgData = svgData;
            window.currentSvgFilename = name.replace(/\.svg$/i, "");
            
            // ADDED: Reset scale to default value when loading from gallery
            const svgScaleEl = document.getElementById('svgScale');
            if (svgScaleEl) {
                // Use the default value from globals.js
                svgScaleEl.value = 0.2;
                // Also update the global variable
                window.svgScaleFactor = 0.2;
                console.log(`Reset scale to default (0.2) for new SVG from gallery`);
            }
            
            // Create image to load the SVG for the texture
            const img = new Image();
            img.onload = function() {
                console.log(`SVG image loaded, creating canvas texture`);
                // Create canvas and draw SVG
                const canvas = document.createElement('canvas');
                canvas.width = 1024;
                canvas.height = 1024;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw SVG with proper dimensions
                const imgAspect = img.width / img.height;
                const canvasAspect = canvas.width / canvas.height;
                let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
                
                if (imgAspect > canvasAspect) {
                    drawWidth = canvas.width;
                    drawHeight = canvas.width / imgAspect;
                    offsetY = (canvas.height - drawHeight) / 2;
                } else {
                    drawHeight = canvas.height;
                    drawWidth = canvas.height * imgAspect;
                    offsetX = (canvas.width - drawWidth) / 2;
                }
                
                ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
                
                // Create texture for the brick
                if (window.texture) window.texture.dispose();
                window.texture = new THREE.CanvasTexture(canvas);
                
                if (window.renderer && window.renderer.capabilities) {
                    window.texture.anisotropy = window.renderer.capabilities.getMaxAnisotropy();
                }
                
                // Apply texture to brick
                if (window.brick && window.brick.material) {
                    if (Array.isArray(window.brick.material) && window.brick.material.length > 2) {
                        if (window.brick.material[2].map) window.brick.material[2].map.dispose();
                        window.brick.material[2].dispose();
                        window.brick.material[2] = new THREE.MeshStandardMaterial({
                            map: window.texture, 
                            roughness: 0.7, 
                            metalness: 0.1, 
                            name: 'top-textured'
                        });
                        window.brick.material[2].needsUpdate = true;
                    }
                }
                
                // CRITICAL FIX: Get scene from globals or find it in a more reliable way
                let scene = null;
                
                // Try multiple ways to get the scene
                if (typeof window.scene !== 'undefined') {
                    scene = window.scene;
                } else if (typeof scene !== 'undefined') {
                    // Scene might be a local variable in another scope
                    console.log("Using local scene variable");
                } else {
                    // Last resort: Check if brick is in a scene we can access
                    if (window.brick && window.brick.parent) {
                        scene = window.brick.parent;
                        console.log("Accessed scene through brick.parent");
                    }
                }
                
                // CRITICAL FIX: Create extruded group if it doesn't exist properly
                if (!window.extrudedGroup) {
                    console.log("Creating new extrudedGroup");
                    window.extrudedGroup = new THREE.Group();
                    
                    // Add to scene if we have access to it
                    if (scene) {
                        scene.add(window.extrudedGroup);
                    } else {
                        console.warn("Could not add extrudedGroup to scene - scene not accessible");
                    }
                }
                
                // Process SVG for extrusion with a fresh state
                console.log('Processing SVG for extrusion');
                
                // CRITICAL FIX: Always force a complete rebuild when loading from gallery
                if (typeof window.parseSVGForExtrusion === 'function') {
                    try {
                        console.log(`Processing gallery SVG with scale factor: ${window.svgScaleFactor}`);
                        // Force complete rebuild with immediate (non-progressive) quality
                        window.parseSVGForExtrusion(svgData, false, 0.5);
                    } catch (error) {
                        console.error("Error in parseSVGForExtrusion:", error);
                        alert("Error processing SVG. Please try a different file.");
                    }
                } else {
                    console.error('parseSVGForExtrusion function not found');
                    alert("Could not find SVG processing function. The application may need to be reloaded.");
                }
                
                // Enable download button
                const downloadBtn = document.getElementById('downloadSTL');
                if (downloadBtn) downloadBtn.disabled = false;
                
                // Hide loading indicator
                if (loadingElement) loadingElement.classList.add('hidden');
            };
            
            img.onerror = function(e) {
                console.error('Error loading SVG into image:', e);
                alert('Error processing SVG. The file might be corrupted.');
                if (loadingElement) loadingElement.classList.add('hidden');
            };
            
            // Set the SVG data as the image source
            try {
                const svgBlob = new Blob([svgData], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(svgBlob);
                
                // Setup cleanup for URL object
                const originalOnload = img.onload;
                img.onload = function() {
                    URL.revokeObjectURL(url);
                    if (originalOnload) originalOnload.call(this);
                };
                
                img.src = url;
            } catch (e) {
                console.error('Error creating SVG blob:', e);
                // Fallback to base64 encoding
                img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
            }
        })
        .catch(error => {
            console.error('Error loading SVG from gallery:', error);
            alert(`Error loading SVG: ${error.message}`);
            if (loadingElement) loadingElement.classList.add('hidden');
        });
}

// CRITICAL FIX: Add cleanup function for previous resources
function cleanupPreviousResources() {
    console.log("Cleaning up previous resources");
    
    // Clean up texture
    if (window.texture) {
        window.texture.dispose();
        window.texture = null;
    }
    
    // Clean up extrusion group
    if (window.extrudedGroup) {
        while (window.extrudedGroup.children.length > 0) {
            const child = window.extrudedGroup.children[0];
            window.extrudedGroup.remove(child);
            
            if (child.geometry) {
                child.geometry.dispose();
            }
            
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => {
                        if (m.map) m.map.dispose();
                        m.dispose();
                    });
                } else {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            }
        }
    }
    
    // Reset any pending operations
    if (typeof window.cancelProgressiveRendering === 'function') {
        window.cancelProgressiveRendering();
    }
    
    // Reset interaction flags
    window.isUserInteracting = false;
    window.pendingUpdate = false;
    
    // Clear any timeouts
    if (window.updateTimeout) {
        clearTimeout(window.updateTimeout);
        window.updateTimeout = null;
    }
    
    if (window.qualityTransitionTimeout) {
        clearTimeout(window.qualityTransitionTimeout);
        window.qualityTransitionTimeout = null;
    }
    
    console.log("Resource cleanup complete");
}
