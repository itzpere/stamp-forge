// SVG Gallery functionality - LOCAL FILES ONLY

// Load SVG gallery when the page loads
document.addEventListener('DOMContentLoaded', loadSvgGallery);

// Current selected gallery item
let currentSelectedItem = null;

// Function to load the SVG gallery
function loadSvgGallery() {
    const galleryContainer = document.getElementById('gallery-container');
    const loadingElement = document.getElementById('gallery-loading');
    const errorElement = document.getElementById('gallery-error');
    
    if (!galleryContainer || !loadingElement || !errorElement) {
        console.error('Gallery elements not found in DOM');
        return;
    }
    
    // Show loading, hide container and error
    loadingElement.classList.remove('hidden');
    galleryContainer.classList.add('hidden');
    errorElement.classList.add('hidden');
    
    // Fetch SVG list from server (local files only)
    fetch('/api/list-svgs')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Hide loading
            loadingElement.classList.add('hidden');
            
            if (!data.files || data.files.length === 0) {
                // Show message if no files found
                errorElement.textContent = 'No SVG files found in gallery. Add SVG files to the svgs folder.';
                errorElement.classList.remove('hidden');
                return;
            }
            
            // Sort files by name for consistent display
            data.files.sort((a, b) => a.name.localeCompare(b.name));
            
            // Clear existing content
            galleryContainer.innerHTML = '';
            
            // Create gallery items
            data.files.forEach(file => {
                const galleryItem = document.createElement('div');
                galleryItem.className = 'gallery-item';
                galleryItem.dataset.path = file.path;
                galleryItem.dataset.name = file.name;
                
                // Create thumbnail
                const thumbnail = document.createElement('img');
                thumbnail.className = 'gallery-thumbnail';
                thumbnail.src = file.path;
                thumbnail.alt = file.name;
                thumbnail.onerror = () => {
                    // Show a placeholder if SVG fails to load
                    thumbnail.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEycHgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5FcnJvcjwvdGV4dD48L3N2Zz4=';
                };
                
                // Create filename label
                const nameLabel = document.createElement('div');
                nameLabel.className = 'gallery-item-name';
                nameLabel.textContent = file.name;
                
                // Add click handler
                galleryItem.addEventListener('click', () => {
                    selectAndLoadSvg(galleryItem);
                });
                
                // Assemble gallery item
                galleryItem.appendChild(thumbnail);
                galleryItem.appendChild(nameLabel);
                galleryContainer.appendChild(galleryItem);
            });
            
            // Show gallery
            galleryContainer.classList.remove('hidden');
            
        })
        .catch(error => {
            console.error('Error loading SVG gallery:', error);
            loadingElement.classList.add('hidden');
            errorElement.textContent = `Error loading gallery: ${error.message}`;
            errorElement.classList.remove('hidden');
        });
}

// Function to select and load an SVG from the gallery
function selectAndLoadSvg(galleryItem) {
    // Show loading indicator
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('loading').textContent = 'Loading SVG...';
    
    // Update selected item styling
    if (currentSelectedItem) {
        currentSelectedItem.classList.remove('gallery-item-selected');
    }
    galleryItem.classList.add('gallery-item-selected');
    currentSelectedItem = galleryItem;
    
    const svgPath = galleryItem.dataset.path;
    const svgName = galleryItem.dataset.name;
    
    // Store the SVG filename (without extension) for export
    currentSvgFilename = svgName.replace(/\.svg$/i, "");
    
    console.log(`Loading SVG from gallery: ${svgName}`);
    
    // Fetch the SVG file
    fetch(svgPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`);
            }
            return response.text();
        })
        .then(svgData => {
            // Clean up previous SVG resources
            if (typeof cleanupPreviousSVG === 'function') {
                cleanupPreviousSVG();
            }
            
            // Store SVG data for reuse - use global lastSvgData variable defined in globals.js
            if (window.lastSvgData !== undefined) {
                window.lastSvgData = svgData;
            } else {
                // Fallback - create lastSvgData if it doesn't exist
                window.lastSvgData = svgData;
            }
            
            // Create a temporary img element to load the SVG
            const img = new Image();
            
            img.onload = function() {
                // Process the SVG for extrusion only, without applying texture to brick
                try {
                    if (typeof scheduleInitialSVGParsing === 'function') {
                        scheduleInitialSVGParsing(svgData);
                    } else if (typeof parseSVGForExtrusion === 'function') {
                        parseSVGForExtrusion(svgData, true, 0.2);
                    } else {
                        console.error("SVG processing functions not available");
                    }
                    
                    // Enable STL download button
                    const downloadButton = document.getElementById('downloadSTL');
                    if (downloadButton) {
                        downloadButton.disabled = false;
                    }
                } catch (error) {
                    console.error('Error processing gallery SVG:', error);
                } finally {
                    // Hide loading indicator
                    document.getElementById('loading').classList.add('hidden');
                }
            };
            
            img.onerror = function(e) {
                console.error('Error loading gallery SVG into Image:', e);
                document.getElementById('loading').classList.add('hidden');
                alert('Error processing SVG. Please try another file.');
            };
            
            // Load the SVG data into the image
            try {
                // Convert SVG to data URL
                const svgBlob = new Blob([svgData], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(svgBlob);
                
                // Use a proper event handler approach - don't try to call onload
                const originalOnload = img.onload; 
                img.onload = function() {
                    URL.revokeObjectURL(url);
                    if (originalOnload) {
                        originalOnload.call(img);  // Call original handler with correct this context
                    }
                };
                
                img.src = url;
            } catch (error) {
                console.error('Error creating SVG blob:', error);
                
                // Fallback to base64 encoding
                try {
                    const base64String = btoa(unescape(encodeURIComponent(svgData)));
                    img.src = 'data:image/svg+xml;base64,' + base64String;
                } catch (base64Error) {
                    console.error('Error encoding SVG as base64:', base64Error);
                    document.getElementById('loading').classList.add('hidden');
                    alert('Error processing SVG. The file may be corrupted.');
                }
            }
        })
        .catch(error => {
            console.error('Error fetching SVG from gallery:', error);
            document.getElementById('loading').classList.add('hidden');
            alert(`Error loading SVG: ${error.message}`);
        });
}

// Function to refresh the gallery
function refreshGallery() {
    loadSvgGallery();
}

// Add a refresh button to the gallery
function addRefreshButton() {
    const gallerySection = document.querySelector('.svg-gallery-section h3');
    if (gallerySection) {
        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Refresh';
        refreshButton.className = 'gallery-refresh-btn';
        refreshButton.style.marginLeft = '10px';
        refreshButton.style.fontSize = '0.8em';
        refreshButton.style.padding = '3px 8px';
        refreshButton.addEventListener('click', refreshGallery);
        
        gallerySection.appendChild(refreshButton);
    }
}

// Call to add refresh button when page loads
document.addEventListener('DOMContentLoaded', addRefreshButton);
