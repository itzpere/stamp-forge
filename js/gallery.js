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
            
            // Process the SVG
            if (typeof handleSVGData === 'function') {
                handleSVGData(svgData, name);
            } else {
                // If handleSVGData isn't defined, use the SVG directly
                processSVGDirectly(svgData, name);
            }
            
            // Enable download button
            const downloadBtn = document.getElementById('downloadSTL');
            if (downloadBtn) downloadBtn.disabled = false;
            
            // Hide loading indicator
            if (loadingElement) loadingElement.classList.add('hidden');
        })
        .catch(error => {
            console.error('Error loading SVG from gallery:', error);
            alert(`Error loading SVG: ${error.message}`);
            if (loadingElement) loadingElement.classList.add('hidden');
        });
}

// Process SVG directly if handleSVGData is not defined
function processSVGDirectly(svgData, filename) {
    // Store SVG data for later use
    window.lastSvgData = svgData;
    window.currentSvgFilename = filename.replace(/\.svg$/i, '');
    
    // Create an image from the SVG data
    const img = new Image();
    img.onload = function() {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Draw SVG to canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate dimensions to maintain aspect ratio
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
        
        // Check if Three.js objects exist before applying texture
        if (typeof THREE !== 'undefined') {
            // Create texture and apply to brick
            if (window.texture) window.texture.dispose();
            window.texture = new THREE.CanvasTexture(canvas);
            
            if (window.renderer && window.renderer.capabilities) {
                window.texture.anisotropy = window.renderer.capabilities.getMaxAnisotropy();
            }
            
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
            
            // Process SVG for extrusion if the function exists
            if (typeof window.scheduleInitialSVGParsing === 'function') {
                window.scheduleInitialSVGParsing(svgData);
            } else if (typeof window.parseSVGForExtrusion === 'function') {
                window.parseSVGForExtrusion(svgData, true, 0.2);
            }
        }
    };
    
    img.onerror = function(e) {
        console.error('Error loading SVG into image:', e);
        alert('Error processing SVG. The file might be corrupted.');
        const loadingElement = document.getElementById('loading');
        if (loadingElement) loadingElement.classList.add('hidden');
    };
    
    // Set the SVG data as the image source
    try {
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(svgBlob);
        
        // Clean up URL object when done
        img.onload = function() {
            URL.revokeObjectURL(url);
            this.onload = null; // Avoid infinite recursion
            this.onload = function() {
                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = 1024;
                canvas.height = 1024;
                const ctx = canvas.getContext('2d');
                
                // Process as above...
                // ...existing code for processing image...
            };
        };
        
        img.src = url;
    } catch (e) {
        console.error('Error creating SVG blob:', e);
        // Fallback to base64 encoding
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
}
