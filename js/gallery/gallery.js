function initGallery() {
    console.log("Initializing SVG gallery...");
    const galleryContainer = document.getElementById('gallery-container');
    const loadingElement = document.getElementById('gallery-loading');
    const errorElement = document.getElementById('gallery-error');
    
    if (!galleryContainer) {
        console.error("Gallery container element not found!");
        return;
    }
    
    if (loadingElement) loadingElement.style.display = 'block';
    if (errorElement) errorElement.style.display = 'none';
    
    fetch('gallery.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load gallery: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            displayGallery(data);
            if (loadingElement) loadingElement.style.display = 'none';
        })
        .catch(error => {
            console.error("Error loading gallery:", error);
            if (loadingElement) loadingElement.style.display = 'none';
            if (errorElement) {
                errorElement.textContent = `Error loading gallery: ${error.message}. Try running 'npm run scan' to generate gallery data.`;
                errorElement.style.display = 'block';
            }
        });
}

function displayGallery(data) {
    console.log("Displaying gallery with data:", data);
    const galleryContainer = document.getElementById('gallery-container');
    
    galleryContainer.innerHTML = '';
    
    if (!data.svgs || data.svgs.length === 0) {
        galleryContainer.innerHTML = '<p class="no-items-message">No SVG files found. Add SVGs to the "svgs" folder and run "npm run scan".</p>';
        return;
    }
    
    const sortedSvgs = [...data.svgs].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedSvgs.forEach(svg => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        
        const preview = document.createElement('div');
        preview.className = 'gallery-item-preview';
        
        const svgObject = document.createElement('object');
        svgObject.type = 'image/svg+xml';
        svgObject.data = svg.url || svg.path; 
        svgObject.style.pointerEvents = 'none';
        preview.appendChild(svgObject);
        
        const title = document.createElement('div');
        title.className = 'gallery-item-title';
        title.textContent = svg.name;
        title.title = svg.name; 
        
        galleryItem.appendChild(preview);
        galleryItem.appendChild(title);
        
        galleryItem.addEventListener('click', function(event) {
            event.preventDefault(); 
            event.stopPropagation(); 
            console.log(`Gallery item clicked: ${svg.name}`);
            
            // Store the current SVG filename globally for pattern detection
            window.currentSvgFilename = svg.name;
            
            loadGallerySvg(svg.url || svg.path, svg.name);
            return false;
        });
        
        galleryContainer.appendChild(galleryItem);
    });
    
    console.log(`Displayed ${sortedSvgs.length} SVGs in gallery`);
}

function loadGallerySvg(svgPath, fileName) {
    console.log(`Loading SVG from gallery: ${svgPath}`);
    
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.classList.remove('hidden');
        loadingElement.textContent = `Loading ${fileName}...`;
    }
    
    fetch(svgPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`);
            }
            return response.text();
        })
        .then(svgText => {
            currentSvgFilename = fileName;
            
            let preprocessedSvgData = svgText;
            if (window.SVGPreprocessingUtils && typeof window.SVGPreprocessingUtils.preprocessSVGText === 'function') {
                try {
                    console.log(`-------- Starting SVG Preprocessing --------`);
                    preprocessedSvgData = window.SVGPreprocessingUtils.preprocessSVGText(svgText);
                    console.log(`-------- Preprocessing Complete --------`);
                } catch (e) {
                    console.error("Error during SVG preprocessing:", e);
                    preprocessedSvgData = svgText; 
                }
            }
            
            window.lastSvgData = preprocessedSvgData;
            
            parseSVGForExtrusion(window.lastSvgData, false, maxInteractiveQuality);
            
            const downloadButton = document.getElementById('downloadSTL');
            if (downloadButton) downloadButton.disabled = false;
            
            if (loadingElement && !loadingElement.classList.contains('hidden')) {
                loadingElement.classList.add('hidden');
            }
        })
        .catch(error => {
            console.error("Error loading gallery SVG:", error);
            if (loadingElement) {
                loadingElement.textContent = `Error loading SVG: ${error.message}`;
                setTimeout(() => {
                    loadingElement.classList.add('hidden');
                }, 3000);
            }
        });
}

document.addEventListener('DOMContentLoaded', initGallery);
