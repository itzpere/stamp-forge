// Global variables
let scene, camera, renderer, controls, brick, texture;
let extrudedGroup; // Group to hold all extruded SVG shapes
let triangleMesh, mirrorTriangleMesh; // References to the triangle meshes
const brickDimensions = { width: 20, height: 3, depth: 20 };
const extrusionHeight = 1; // Extrusion height in mm
const extrusionPosition = { x: -10, y: -0.5, z: 10 }; // Position offset for extrusions
let extrusionColor = 0x2a75f3; // Default extrusion color
let brickColor = 0xbc8f8f; // Default brick color
let triangleColor = 0xff4500; // Default triangle color (orange-red)
let svgScaleFactor = 0.2; // SVG scale factor
let isUserInteracting = false; // Flag to track user interaction
let pendingUpdate = false; // Flag to track pending updates
let updateTimeout = null; // Timeout reference for debouncing

// Add a new variable to track quality transition
let qualityTransitionTimeout = null;
let progressiveQuality = 0.2; // Start with low quality and gradually increase

// Add quality control variables
let isHighQualityMode = false; // Track if we're in high quality mode
let maxInteractiveQuality = 0.7; // Cap the quality for interactive view

// Add export quality settings
const exportSettings = {
    extrudeSteps: 6,           // Higher steps for smoother extrusion
    segmentDivisor: 3,         // More points for detailed shapes
    minSegments: 20,           // Higher minimum segments
    enableBevel: true,         // Enable bevels for smoother edges
    bevelThickness: 0.05,      // Bevel thickness
    bevelSize: 0.05,           // Bevel size
    bevelSegments: 3,          // Bevel segments
    progressCallback: null     // Progress callback function
};

// Initialize the Three.js scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // Create camera with lower near plane for better precision
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(0, 15, 30);
    
    // Create renderer with optimized parameters
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(document.getElementById('three-container').clientWidth, 
                    document.getElementById('three-container').clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1); // Limit pixel ratio for performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('three-container').appendChild(renderer.domElement);
    
    // Add lights
    setupLights();
    
    // Add orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    
    // Create initial brick without texture
    createBrick();
    
    // Add a grid helper for reference
    const gridHelper = new THREE.GridHelper(50, 50);
    scene.add(gridHelper);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Set up event listeners (using function references that have been defined)
    document.getElementById('svgUpload').addEventListener('change', handleSVGUpload);
    document.getElementById('resetView').addEventListener('click', function() {
        camera.position.set(0, 15, 30);
        camera.lookAt(0, 0, 0);
        controls.reset();
    });
    document.getElementById('downloadSTL').addEventListener('click', exportSTL);
    
    // Set up UI controls event listeners
    setupUIControls();
    
    // Start animation loop
    animate();
}

// Set up scene lighting
function setupLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Directional light (like sunlight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    
    scene.add(directionalLight);
    
    // Additional light from another angle
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-20, 20, -20);
    scene.add(fillLight);
}

// Debounce function to limit frequent updates
function debounce(callback, delay = 300) {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
        callback();
    }, delay);
}

// Schedule progressive rendering to avoid freezing
function scheduleProgressiveRendering() {
    cancelProgressiveRendering(); // Cancel any previous rendering
    
    // Start with low quality
    progressiveQuality = 0.2;
    
    // Schedule the first progressive rendering
    if (lastSvgData) {
        // Run immediate low-quality update
        renderer.shadowMap.enabled = false;
        parseSVGForExtrusion(lastSvgData, true, progressiveQuality);
        
        // Schedule progressively higher quality updates
        progressiveRenderingStep();
    }
}

// Cancel progressive rendering
function cancelProgressiveRendering() {
    if (qualityTransitionTimeout) {
        clearTimeout(qualityTransitionTimeout);
        qualityTransitionTimeout = null;
    }
}

// Step up the quality gradually to avoid freezing
function progressiveRenderingStep() {
    cancelProgressiveRendering();
    
    qualityTransitionTimeout = setTimeout(() => {
        if (!isUserInteracting && lastSvgData) {
            // Gradually increase quality up to the max interactive quality
            progressiveQuality = Math.min(progressiveQuality + 0.2, maxInteractiveQuality);
            
            // Update with current quality level
            parseSVGForExtrusion(lastSvgData, progressiveQuality < maxInteractiveQuality, progressiveQuality);
            
            // If we haven't reached max interactive quality, schedule another update
            if (progressiveQuality < maxInteractiveQuality) {
                progressiveRenderingStep();
            } else {
                // Enable shadows at max interactive quality
                renderer.shadowMap.enabled = true;
                renderer.render(scene, camera);
            }
        }
    }, 100);
}

// Set up UI controls and their event listeners with performance optimizations
function setupUIControls() {
    // Brick dimension controls - REMOVED FROM UI
    // document.getElementById('brickWidth').value = brickDimensions.width;
    // document.getElementById('brickHeight').value = brickDimensions.height;
    // document.getElementById('brickDepth').value = brickDimensions.depth;
    
    // document.getElementById('brickWidth').addEventListener('change', updateBrickDimensions);
    // document.getElementById('brickHeight').addEventListener('change', updateBrickDimensions);
    // document.getElementById('brickDepth').addEventListener('change', updateBrickDimensions);
    
    // Extrusion height control
    document.getElementById('extrusionHeight').value = extrusionHeight;
    document.getElementById('extrusionHeight').addEventListener('change', function() {
        extrusionHeight = parseFloat(this.value);
        if (texture) {
            // Use default quality for non-interactive changes
            parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality);
        }
    });
    
    // SVG scale factor control
    document.getElementById('svgScale').value = svgScaleFactor;
    document.getElementById('svgScale').addEventListener('change', function() {
        svgScaleFactor = parseFloat(this.value);
        if (texture) {
             // Use default quality for non-interactive changes
            parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality);
        }
    });
    
    // Color controls
    // Brick Color - REMOVED FROM UI
    // document.getElementById('brickColor').value = '#' + brickColor.toString(16).padStart(6, '0');
    // document.getElementById('brickColor').addEventListener('change', function() {
    //     brickColor = parseInt(this.value.substring(1), 16);
    //     updateBrickColor(); // Function might be removed if not used elsewhere
    // });
    
    document.getElementById('extrusionColor').value = '#' + extrusionColor.toString(16).padStart(6, '0');
    document.getElementById('extrusionColor').addEventListener('change', function() {
        extrusionColor = parseInt(this.value.substring(1), 16);
        updateExtrusionColor();
    });
    
    // Extrusion position controls
    document.getElementById('extrusionX').value = extrusionPosition.x;
    document.getElementById('extrusionY').value = extrusionPosition.y;
    document.getElementById('extrusionZ').value = extrusionPosition.z;
    
    document.getElementById('extrusionX').addEventListener('change', updateExtrusionPosition);
    document.getElementById('extrusionY').addEventListener('change', updateExtrusionPosition);
    document.getElementById('extrusionZ').addEventListener('change', updateExtrusionPosition);
    
    // Add performance optimization - track interaction state
    // Update selector to exclude removed inputs
    const controlElements = document.querySelectorAll('input[type="number"], input[type="color"]');
    controlElements.forEach(element => {
        element.addEventListener('focus', () => {
            isUserInteracting = true;
            cancelProgressiveRendering(); // Cancel any ongoing progressive rendering
        });
        
        element.addEventListener('blur', () => {
            isUserInteracting = false;
            if (pendingUpdate) {
                pendingUpdate = false;
                // Instead of immediately running full quality, schedule progressive rendering
                scheduleProgressiveRendering();
            }
        });
    });
    
    // Add debouncing to dimension controls for smoother performance - REMOVED BRICK CONTROLS
    // document.getElementById('brickWidth').addEventListener('input', () => { ... });
    // document.getElementById('brickHeight').addEventListener('input', () => { ... });
    // document.getElementById('brickDepth').addEventListener('input', () => { ... });
    
    // Replace 'change' with 'input' + debounce for immediate feedback
    document.getElementById('extrusionHeight').addEventListener('input', function() {
        extrusionHeight = parseFloat(this.value);
        renderer.shadowMap.enabled = false;
        if (isUserInteracting) {
            pendingUpdate = true;
            debounce(() => {
                if (lastSvgData) parseSVGForExtrusion(lastSvgData, true); // Low quality during interaction
            });
        } else if (lastSvgData) {
             // If not interacting, trigger progressive rendering after debounce
             debounce(() => scheduleProgressiveRendering());
        }
    });

    // Add debouncing for SVG Scale
     document.getElementById('svgScale').addEventListener('input', function() {
        svgScaleFactor = parseFloat(this.value);
        renderer.shadowMap.enabled = false;
        if (isUserInteracting) {
            pendingUpdate = true;
            debounce(() => {
                if (lastSvgData) parseSVGForExtrusion(lastSvgData, true); // Low quality during interaction
            });
        } else if (lastSvgData) {
             // If not interacting, trigger progressive rendering after debounce
             debounce(() => scheduleProgressiveRendering());
        }
    });
    
    // Add debouncing to position controls
    document.getElementById('extrusionX').addEventListener('input', optimizedPositionUpdate);
    document.getElementById('extrusionY').addEventListener('input', optimizedPositionUpdate);
    document.getElementById('extrusionZ').addEventListener('input', optimizedPositionUpdate);
    
    // Only add search-related event listeners if the elements exist
    const nounSearchButton = document.getElementById('nounSearchButton');
    if (nounSearchButton) {
        nounSearchButton.addEventListener('click', () => {
            const searchTerm = document.getElementById('nounSearchTerm').value;
            if (searchTerm.trim()) {
                searchNounProject(searchTerm.trim());
            }
        });
    }

    const svgSearchButton = document.getElementById('svgSearchButton');
    if (svgSearchButton) {
        svgSearchButton.addEventListener('click', () => {
            const searchTerm = document.getElementById('svgSearchTerm').value;
            if (searchTerm.trim()) {
                searchSVGsOnline(searchTerm.trim());
            }
        });
    }
    
    const svgSearchTerm = document.getElementById('svgSearchTerm');
    if (svgSearchTerm) {
        svgSearchTerm.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                const searchTerm = svgSearchTerm.value;
                if (searchTerm.trim()) {
                    searchSVGsOnline(searchTerm.trim());
                }
            }
        });
    }
}

// --- SVG Online Search Integration ---

// Function to search for SVGs online
async function searchSVGsOnline(searchTerm) {
    console.log("Searching for SVGs with term:", searchTerm);
    const resultsContainer = document.getElementById('svgSearchResults');
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = '<p><em>Searching...</em></p>';

    try {
        // Call the backend endpoint (requires server implementation)
        const response = await fetch(`/api/search-svgs?term=${encodeURIComponent(searchTerm)}`);
        
        if (!response.ok) {
            let errorBody = `Status: ${response.status} ${response.statusText}`;
            try {
                const errorJson = await response.json();
                errorBody = errorJson.error || JSON.stringify(errorJson);
            } catch (e) {
                errorBody = await response.text().catch(() => errorBody);
            }
            throw new Error(`API Error: ${errorBody}`);
        }

        const data = await response.json();
        displaySVGSearchResults(data.results || []);

    } catch (error) {
        console.error("Error searching for SVGs:", error);
        resultsContainer.innerHTML = `<p><em>Error searching for SVGs: ${error.message}. Check console and server logs.</em></p>`;
    }
}

// Function to display SVG search results
function displaySVGSearchResults(results) {
    const resultsContainer = document.getElementById('svgSearchResults');
    resultsContainer.innerHTML = ''; // Clear previous results
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<p><em>No results found.</em></p>';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'svg-results-list';
    
    results.forEach(result => {
        if (!result || !result.preview_url) {
            console.warn("Skipping invalid result data:", result);
            return;
        }

        const listItem = document.createElement('li');
        const img = document.createElement('img');
        img.src = result.preview_url;
        img.alt = `SVG: ${result.title || result.id || 'Untitled'}`;
        img.style.cursor = 'pointer';
        img.style.margin = '2px';
        img.title = `Load SVG: ${result.title || result.id || 'Untitled'}`;
        
        img.addEventListener('click', () => {
            loadSVGFromSearchResults(result.id, result.download_url);
        });

        listItem.appendChild(img);
        list.appendChild(listItem);
    });
    
    resultsContainer.appendChild(list);
}

// Function to load an SVG from search results
async function loadSVGFromSearchResults(id, url) {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('loading').textContent = `Loading SVG (ID: ${id})...`;
    
    try {
        // Call the backend endpoint to get the SVG
        const response = await fetch(`/api/get-svg?id=${encodeURIComponent(id)}&url=${encodeURIComponent(url)}`);
        
        if (!response.ok) {
            let errorBody = `Status: ${response.status} ${response.statusText}`;
            try {
                const errorJson = await response.json();
                errorBody = errorJson.error || JSON.stringify(errorJson);
            } catch (e) {
                errorBody = await response.text().catch(() => errorBody);
            }
            throw new Error(`Failed to fetch SVG via backend: ${errorBody}`);
        }
        
        // Check content type
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("svg")) {
            console.warn(`Expected SVG from backend, but received content type: ${contentType}`);
        }

        const svgData = await response.text();
        if (!svgData || !svgData.toLowerCase().includes('<svg')) {
            throw new Error("Received data does not appear to be valid SVG.");
        }
        
        // Process the SVG using existing functions
        lastSvgData = svgData; // Store for potential reuse
        
        const img = new Image();
        img.onload = function() {
            // Create a canvas element to draw the SVG
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            if (texture) texture.dispose();
            texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

            if (brick.material && Array.isArray(brick.material) && brick.material.length > 2) {
                if (brick.material[2].map) brick.material[2].map.dispose();
                brick.material[2].dispose();
                brick.material[2] = new THREE.MeshStandardMaterial({
                    map: texture, roughness: 0.7, metalness: 0.1, name: 'top-textured'
                });
                brick.material[2].needsUpdate = true;
            } else {
                console.error("Brick material array not set up correctly.");
            }

            try {
                scheduleInitialSVGParsing(svgData);
            } catch (parseError) {
                console.error('Error during SVG parsing from search:', parseError);
                alert('Failed to process SVG from search. Please check console.');
            } finally {
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('loading').textContent = 'Loading...'; // Reset message
                document.getElementById('downloadSTL').disabled = false;
            }
        };
        
        img.onerror = function(e) {
            console.error('Error loading SVG data into Image element:', e);
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('loading').textContent = 'Loading...';
            alert('Error processing SVG data from search. The fetched data might be invalid or corrupted.');
        };
        
        // Use base64 encoding for the Image src
        try {
            const utf8Bytes = new TextEncoder().encode(svgData);
            const base64String = btoa(String.fromCharCode(...utf8Bytes));
            img.src = 'data:image/svg+xml;base64,' + base64String;
        } catch (b64Error) {
            console.error("Error base64 encoding SVG data:", b64Error);
            alert("Error encoding SVG data for display.");
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('loading').textContent = 'Loading...';
        }
        
    } catch (error) {
        console.error('Error loading SVG from search:', error);
        alert(`Failed to load SVG: ${error.message}. Check server logs.`);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('loading').textContent = 'Loading...';
    }
}

// --- End SVG Online Search Integration ---

// --- Noun Project Integration ---

// API Keys are now handled securely on the backend server.

// Function to initiate search - Calls the backend proxy
async function searchNounProject(searchTerm) {
    console.log("Calling backend to search Noun Project...");
    const resultsContainer = document.getElementById('nounSearchResults');
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = '<p><em>Searching...</em></p>';

    // Call the backend endpoint
    try {
        const response = await fetch(`/api/search-icons?term=${encodeURIComponent(searchTerm)}`);

        if (!response.ok) {
             let errorBody = `Status: ${response.status} ${response.statusText}`;
             try {
                 const errorJson = await response.json();
                 errorBody = errorJson.error || JSON.stringify(errorJson);
             } catch (e) {
                 errorBody = await response.text().catch(() => `Status: ${response.status} ${response.statusText}`);
             }
             throw new Error(`API Error: ${errorBody}`);
        }

        const data = await response.json();
        // Assuming the backend returns the 'icons' array directly
        displaySearchResults(data.icons);

    } catch (error) {
        console.error("Error searching Noun Project via backend:", error);
        resultsContainer.innerHTML = `<p><em>Error searching icons: ${error.message}. Check console and server logs.</em></p>`;
    }
}

// Function to display search results (remains mostly the same)
function displaySearchResults(icons) {
    const resultsContainer = document.getElementById('nounSearchResults');
    resultsContainer.innerHTML = ''; // Clear previous results or messages

    if (!icons || icons.length === 0) {
        resultsContainer.innerHTML = '<p><em>No results found.</em></p>';
        return;
    }

    const list = document.createElement('ul');
    icons.forEach(icon => {
        // Ensure the icon object has the expected properties
        if (!icon || !icon.id || !icon.thumbnail_url || !icon.icon_url) {
             console.warn("Skipping invalid icon data:", icon);
             return;
        }

        const listItem = document.createElement('li');
        const img = document.createElement('img');
        img.src = icon.thumbnail_url; // Use thumbnail_url for display
        img.alt = `Icon ${icon.term || icon.id}`;
        img.style.cursor = 'pointer';
        img.style.margin = '2px';
        img.title = `Load Icon: ${icon.term || icon.id}`;

        // Add click listener to load the actual SVG via backend
        img.addEventListener('click', () => {
            console.log(`Requesting SVG via backend for icon ID: ${icon.id}`);
            resultsContainer.innerHTML = `<p><em>Loading selected icon (ID: ${icon.id})...</em></p>`;
            // Call the backend endpoint to get the SVG data
            loadSVGFromBackend(icon.id); // Pass icon ID
        });

        listItem.appendChild(img);
        list.appendChild(listItem);
    });
    resultsContainer.appendChild(list);
}

// Renamed function to load SVG data via the backend proxy
async function loadSVGFromBackend(iconId) {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('loading').textContent = `Loading SVG (ID: ${iconId})...`;

    console.log(`Fetching SVG from backend for icon ID: ${iconId}`);

    try {
        // Call the backend endpoint to get the SVG content
        const response = await fetch(`/api/get-icon-svg?id=${iconId}`);

        if (!response.ok) {
             let errorBody = `Status: ${response.status} ${response.statusText}`;
             try {
                 const errorJson = await response.json();
                 errorBody = errorJson.error || JSON.stringify(errorJson);
             } catch (e) {
                 errorBody = await response.text().catch(() => `Status: ${response.status} ${response.statusText}`);
             }
            throw new Error(`Failed to fetch SVG via backend: ${errorBody}`);
        }

        // Check content type to ensure it's SVG (backend should set this)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("svg")) {
            console.warn(`Expected SVG from backend, but received content type: ${contentType}`);
        }

        const svgData = await response.text();

        if (!svgData || !svgData.toLowerCase().includes('<svg')) {
             throw new Error("Received data from backend does not appear to be valid SVG.");
        }

        lastSvgData = svgData; // Store for potential reuse

        // --- Reuse logic from handleSVGUpload (remains the same) ---
        const img = new Image();
        img.onload = function() {
            // Create a canvas element to draw the SVG
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            if (texture) texture.dispose();
            texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

            if (brick.material && Array.isArray(brick.material) && brick.material.length > 2) {
                if (brick.material[2].map) brick.material[2].map.dispose();
                brick.material[2].dispose();
                brick.material[2] = new THREE.MeshStandardMaterial({
                    map: texture, roughness: 0.7, metalness: 0.1, name: 'top-textured'
                });
                brick.material[2].needsUpdate = true;
            } else {
                console.error("Brick material array not set up correctly.");
            }


            try {
                scheduleInitialSVGParsing(svgData);
            } catch (parseError) {
                console.error('Error during SVG parsing from backend:', parseError);
                alert('Failed to process SVG from backend. Please check console.');
            } finally {
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('loading').textContent = 'Loading...'; // Reset message
                document.getElementById('downloadSTL').disabled = false;
            }
        };
        img.onerror = function(e) {
            console.error('Error loading SVG data into Image element:', e);
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('loading').textContent = 'Loading...';
            alert('Error processing SVG data from backend. The fetched data might be invalid or corrupted.');
        };
        // Use base64 encoding for the Image src to handle potential SVG complexities
        try {
             // Ensure svgData is properly encoded before btoa
             const utf8Bytes = new TextEncoder().encode(svgData);
             const base64String = btoa(String.fromCharCode(...utf8Bytes));
             img.src = 'data:image/svg+xml;base64,' + base64String;
        } catch (b64Error) {
             console.error("Error base64 encoding SVG data:", b64Error);
             alert("Error encoding SVG data for display.");
             document.getElementById('loading').classList.add('hidden');
             document.getElementById('loading').textContent = 'Loading...';
        }
        // --- End reused logic ---

    } catch (error) {
        console.error('Error loading SVG via backend:', error);
        alert(`Failed to load SVG: ${error.message}. Check server logs.`);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('loading').textContent = 'Loading...';
    }
}

// --- End Noun Project Integration ---


// Schedule a low-quality update for the initial SVG parsing
function scheduleInitialSVGParsing(svgData) {
    cancelProgressiveRendering(); // Cancel any previous rendering
    
    // Run immediate low-quality update
    renderer.shadowMap.enabled = false;
    parseSVGForExtrusion(svgData, true, 0.2);
}

// Update brick dimensions based on UI inputs - REMOVED (defaults used)
// function updateBrickDimensions() { ... }

// Update brick color based on UI input - REMOVED (defaults used)
// function updateBrickColor() { ... }

// Update extrusion color based on UI input
function updateExtrusionColor() {
    extrudedGroup.children.forEach(child => {
        if (child.material) {
            child.material.color.set(extrusionColor);
        }
    });
}

// Update triangle color based on UI input to update both triangles - REMOVED (defaults used)
// function updateTriangleColor() { ... }

// Update extrusion position based on UI inputs
function updateExtrusionPosition() {
    extrusionPosition.x = parseFloat(document.getElementById('extrusionX').value);
    extrusionPosition.y = parseFloat(document.getElementById('extrusionY').value);
    extrusionPosition.z = parseFloat(document.getElementById('extrusionZ').value);
    
    // Reposition all extrusions
    if (extrudedGroup && extrudedGroup.children.length > 0) {
        // If we have existing SVG data, regenerate the extrusions using default quality
        if (lastSvgData) {
            parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality);
        }
    }
}

// Optimized position update
function optimizedPositionUpdate() {
    extrusionPosition.x = parseFloat(document.getElementById('extrusionX').value);
    extrusionPosition.y = parseFloat(document.getElementById('extrusionY').value);
    extrusionPosition.z = parseFloat(document.getElementById('extrusionZ').value);
    
    renderer.shadowMap.enabled = false;
    
    if (isUserInteracting) {
        pendingUpdate = true;
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
            // Update position directly without re-extrusion for better performance
            extrudedGroup.children.forEach(child => {
                child.position.set(
                    extrusionPosition.x, 
                    brickDimensions.height + extrusionPosition.y, 
                    extrusionPosition.z
                );
            });
        });
    } else {
        scheduleProgressiveRendering();
    }
}

// Create the 3D brick (uses default dimensions and colors)
function createBrick() {
    // Remove existing brick if it exists
    if (brick) {
        scene.remove(brick);
        // Also remove associated triangles
        if (triangleMesh) scene.remove(triangleMesh);
        if (mirrorTriangleMesh) scene.remove(mirrorTriangleMesh);
        triangleMesh = null;
        mirrorTriangleMesh = null;
    }
    
    // Remove existing extrusions if they exist
    if (extrudedGroup) {
        scene.remove(extrudedGroup);
    }
    
    extrudedGroup = new THREE.Group();
    scene.add(extrudedGroup);
    
    // Create default material (uses default brickColor)
    const materials = [
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'right' }), // Right side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'left' }), // Left side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'top' }), // Top side (will be replaced with SVG texture)
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'bottom' }), // Bottom side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'front' }), // Front side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'back' })  // Back side
    ];
    
    // Create brick geometry (uses default brickDimensions)
    const geometry = new THREE.BoxGeometry(
        brickDimensions.width,
        brickDimensions.height,
        brickDimensions.depth
    );
    
    // Create mesh with geometry and materials
    brick = new THREE.Mesh(geometry, materials);
    brick.castShadow = true;
    brick.receiveShadow = true;
    scene.add(brick);
    
    // Add the 90-degree triangles to the sides of the brick
    addTriangleToBrick(); // This function now adds both triangles
}

// Function to add 90-degree triangles to both sides of the brick
function addTriangleToBrick() {
    // Remove existing triangles first
    if (triangleMesh) scene.remove(triangleMesh);
    if (mirrorTriangleMesh) scene.remove(mirrorTriangleMesh);

    // Create the triangle shape dimensions using default brickDimensions
    const triangleHeight = brickDimensions.height;
    const triangleWidth = brickDimensions.height; // Base width equals height for 45-45-90 triangle face
    const triangleDepth = brickDimensions.depth; 
    
    // Create triangular prism geometry using BufferGeometry
    const triangleGeometry = new THREE.BufferGeometry();
    
    // Define the vertices of a 3D triangular prism
    const vertices = new Float32Array([
        // Front face (y-z plane at x=0)
         0, 0, 0,             // Bottom-left corner (Origin)
         0, triangleHeight, 0, // Top-left corner
         triangleWidth, 0, 0, // Bottom-right corner (on x-axis)
        
        // Back face (offset by triangleDepth in Z)
         0, 0, -triangleDepth,             // Bottom-left corner
         0, triangleHeight, -triangleDepth, // Top-left corner
         triangleWidth, 0, -triangleDepth  // Bottom-right corner
    ]);
    
    // Define indices for the triangular prism faces
    const indices = [
        // Front face triangle
        0, 1, 2,
        // Back face triangle
        3, 5, 4, // Note the order for correct facing direction
        // Bottom rectangle (0, 2, 5, 3) split into two triangles
        0, 2, 5,  0, 5, 3,
        // Back vertical rectangle (0, 3, 4, 1) split into two triangles
        0, 3, 4,  0, 4, 1,
        // Slanted rectangle (hypotenuse) (1, 4, 5, 2) split into two triangles
        1, 4, 5,  1, 5, 2
    ];
    
    triangleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    triangleGeometry.setIndex(indices);
    triangleGeometry.computeVertexNormals(); // Compute normals for lighting
    
    // Create material for the triangles (uses default triangleColor)
    const triangleMaterial = new THREE.MeshStandardMaterial({
        color: triangleColor,
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    
    // --- Create and position the first triangle (right side) ---
    triangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
    triangleMesh.castShadow = true;
    triangleMesh.receiveShadow = true;
    triangleMesh.position.set(
        -brickDimensions.width / 2,
        -brickDimensions.height / 2,
        brickDimensions.depth / 2
    );
    triangleMesh.rotation.y = -Math.PI / 2;
    scene.add(triangleMesh);

    // --- Create and position the second (mirrored) triangle (left side) ---
    // Clone geometry and material (can share geometry, clone material if colors differ later)
    mirrorTriangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial.clone());
    mirrorTriangleMesh.castShadow = true;
    mirrorTriangleMesh.receiveShadow = true;
    mirrorTriangleMesh.position.set(
        brickDimensions.width / 2,
        -brickDimensions.height / 2,
        -brickDimensions.depth / 2
    );
    mirrorTriangleMesh.rotation.y = Math.PI / 2;
    scene.add(mirrorTriangleMesh);
}


    // Add Noun Project search listener
    document.getElementById('nounSearchButton').addEventListener('click', () => {
        const searchTerm = document.getElementById('nounSearchTerm').value;
        if (searchTerm.trim()) {
            searchNounProject(searchTerm.trim());
        }
    });

    // Add SVG search button listener
    document.getElementById('svgSearchButton').addEventListener('click', () => {
        const searchTerm = document.getElementById('svgSearchTerm').value;
        if (searchTerm.trim()) {
            searchSVGsOnline(searchTerm.trim());
        }
    });
    
    // Add ability to press Enter in the search box
    document.getElementById('svgSearchTerm').addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            const searchTerm = document.getElementById('svgSearchTerm').value;
            if (searchTerm.trim()) {
                searchSVGsOnline(searchTerm.trim());
            }
        }
    });


// --- SVG Online Search Integration ---

// Function to search for SVGs online
async function searchSVGsOnline(searchTerm) {
    console.log("Searching for SVGs with term:", searchTerm);
    const resultsContainer = document.getElementById('svgSearchResults');
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = '<p><em>Searching...</em></p>';

    try {
        // Call the backend endpoint (requires server implementation)
        const response = await fetch(`/api/search-svgs?term=${encodeURIComponent(searchTerm)}`);
        
        if (!response.ok) {
            let errorBody = `Status: ${response.status} ${response.statusText}`;
            try {
                const errorJson = await response.json();
                errorBody = errorJson.error || JSON.stringify(errorJson);
            } catch (e) {
                errorBody = await response.text().catch(() => errorBody);
            }
            throw new Error(`API Error: ${errorBody}`);
        }

        const data = await response.json();
        displaySVGSearchResults(data.results || []);

    } catch (error) {
        console.error("Error searching for SVGs:", error);
        resultsContainer.innerHTML = `<p><em>Error searching for SVGs: ${error.message}. Check console and server logs.</em></p>`;
    }
}

// Function to display SVG search results
function displaySVGSearchResults(results) {
    const resultsContainer = document.getElementById('svgSearchResults');
    resultsContainer.innerHTML = ''; // Clear previous results
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<p><em>No results found.</em></p>';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'svg-results-list';
    
    results.forEach(result => {
        if (!result || !result.preview_url) {
            console.warn("Skipping invalid result data:", result);
            return;
        }

        const listItem = document.createElement('li');
        const img = document.createElement('img');
        img.src = result.preview_url;
        img.alt = `SVG: ${result.title || result.id || 'Untitled'}`;
        img.style.cursor = 'pointer';
        img.style.margin = '2px';
        img.title = `Load SVG: ${result.title || result.id || 'Untitled'}`;
        
        img.addEventListener('click', () => {
            loadSVGFromSearchResults(result.id, result.download_url);
        });

        listItem.appendChild(img);
        list.appendChild(listItem);
    });
    
    resultsContainer.appendChild(list);
}

// Function to load an SVG from search results
async function loadSVGFromSearchResults(id, url) {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('loading').textContent = `Loading SVG (ID: ${id})...`;
    
    try {
        // Call the backend endpoint to get the SVG
        const response = await fetch(`/api/get-svg?id=${encodeURIComponent(id)}&url=${encodeURIComponent(url)}`);
        
        if (!response.ok) {
            let errorBody = `Status: ${response.status} ${response.statusText}`;
            try {
                const errorJson = await response.json();
                errorBody = errorJson.error || JSON.stringify(errorJson);
            } catch (e) {
                errorBody = await response.text().catch(() => errorBody);
            }
            throw new Error(`Failed to fetch SVG via backend: ${errorBody}`);
        }
        
        // Check content type
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("svg")) {
            console.warn(`Expected SVG from backend, but received content type: ${contentType}`);
        }

        const svgData = await response.text();
        if (!svgData || !svgData.toLowerCase().includes('<svg')) {
            throw new Error("Received data does not appear to be valid SVG.");
        }
        
        // Process the SVG using existing functions
        lastSvgData = svgData; // Store for potential reuse
        
        const img = new Image();
        img.onload = function() {
            // Create a canvas element to draw the SVG
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            if (texture) texture.dispose();
            texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

            if (brick.material && Array.isArray(brick.material) && brick.material.length > 2) {
                if (brick.material[2].map) brick.material[2].map.dispose();
                brick.material[2].dispose();
                brick.material[2] = new THREE.MeshStandardMaterial({
                    map: texture, roughness: 0.7, metalness: 0.1, name: 'top-textured'
                });
                brick.material[2].needsUpdate = true;
            } else {
                console.error("Brick material array not set up correctly.");
            }

            try {
                scheduleInitialSVGParsing(svgData);
            } catch (parseError) {
                console.error('Error during SVG parsing from search:', parseError);
                alert('Failed to process SVG from search. Please check console.');
            } finally {
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('loading').textContent = 'Loading...'; // Reset message
                document.getElementById('downloadSTL').disabled = false;
            }
        };
        
        img.onerror = function(e) {
            console.error('Error loading SVG data into Image element:', e);
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('loading').textContent = 'Loading...';
            alert('Error processing SVG data from search. The fetched data might be invalid or corrupted.');
        };
        
        // Use base64 encoding for the Image src
        try {
            const utf8Bytes = new TextEncoder().encode(svgData);
            const base64String = btoa(String.fromCharCode(...utf8Bytes));
            img.src = 'data:image/svg+xml;base64,' + base64String;
        } catch (b64Error) {
            console.error("Error base64 encoding SVG data:", b64Error);
            alert("Error encoding SVG data for display.");
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('loading').textContent = 'Loading...';
        }
        
    } catch (error) {
        console.error('Error loading SVG from search:', error);
        alert(`Failed to load SVG: ${error.message}. Check server logs.`);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('loading').textContent = 'Loading...';
    }
}

// --- End SVG Online Search Integration ---

// --- Noun Project Integration ---

// API Keys are now handled securely on the backend server.

// Function to initiate search - Calls the backend proxy
async function searchNounProject(searchTerm) {
    console.log("Calling backend to search Noun Project...");
    const resultsContainer = document.getElementById('nounSearchResults');
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = '<p><em>Searching...</em></p>';

    // Call the backend endpoint
    try {
        const response = await fetch(`/api/search-icons?term=${encodeURIComponent(searchTerm)}`);

        if (!response.ok) {
             let errorBody = `Status: ${response.status} ${response.statusText}`;
             try {
                 const errorJson = await response.json();
                 errorBody = errorJson.error || JSON.stringify(errorJson);
             } catch (e) {
                 errorBody = await response.text().catch(() => `Status: ${response.status} ${response.statusText}`);
             }
             throw new Error(`API Error: ${errorBody}`);
        }

        const data = await response.json();
        // Assuming the backend returns the 'icons' array directly
        displaySearchResults(data.icons);

    } catch (error) {
        console.error("Error searching Noun Project via backend:", error);
        resultsContainer.innerHTML = `<p><em>Error searching icons: ${error.message}. Check console and server logs.</em></p>`;
    }
}

// Function to display search results (remains mostly the same)
function displaySearchResults(icons) {
    const resultsContainer = document.getElementById('nounSearchResults');
    resultsContainer.innerHTML = ''; // Clear previous results or messages

    if (!icons || icons.length === 0) {
        resultsContainer.innerHTML = '<p><em>No results found.</em></p>';
        return;
    }

    const list = document.createElement('ul');
    icons.forEach(icon => {
        // Ensure the icon object has the expected properties
        if (!icon || !icon.id || !icon.thumbnail_url || !icon.icon_url) {
             console.warn("Skipping invalid icon data:", icon);
             return;
        }

        const listItem = document.createElement('li');
        const img = document.createElement('img');
        img.src = icon.thumbnail_url; // Use thumbnail_url for display
        img.alt = `Icon ${icon.term || icon.id}`;
        img.style.cursor = 'pointer';
        img.style.margin = '2px';
        img.title = `Load Icon: ${icon.term || icon.id}`;

        // Add click listener to load the actual SVG via backend
        img.addEventListener('click', () => {
            console.log(`Requesting SVG via backend for icon ID: ${icon.id}`);
            resultsContainer.innerHTML = `<p><em>Loading selected icon (ID: ${icon.id})...</em></p>`;
            // Call the backend endpoint to get the SVG data
            loadSVGFromBackend(icon.id); // Pass icon ID
        });

        listItem.appendChild(img);
        list.appendChild(listItem);
    });
    resultsContainer.appendChild(list);
}

// Renamed function to load SVG data via the backend proxy
async function loadSVGFromBackend(iconId) {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('loading').textContent = `Loading SVG (ID: ${iconId})...`;

    console.log(`Fetching SVG from backend for icon ID: ${iconId}`);

    try {
        // Call the backend endpoint to get the SVG content
        const response = await fetch(`/api/get-icon-svg?id=${iconId}`);

        if (!response.ok) {
             let errorBody = `Status: ${response.status} ${response.statusText}`;
             try {
                 const errorJson = await response.json();
                 errorBody = errorJson.error || JSON.stringify(errorJson);
             } catch (e) {
                 errorBody = await response.text().catch(() => `Status: ${response.status} ${response.statusText}`);
             }
            throw new Error(`Failed to fetch SVG via backend: ${errorBody}`);
        }

        // Check content type to ensure it's SVG (backend should set this)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("svg")) {
            console.warn(`Expected SVG from backend, but received content type: ${contentType}`);
        }

        const svgData = await response.text();

        if (!svgData || !svgData.toLowerCase().includes('<svg')) {
             throw new Error("Received data from backend does not appear to be valid SVG.");
        }

        lastSvgData = svgData; // Store for potential reuse

        // --- Reuse logic from handleSVGUpload (remains the same) ---
        const img = new Image();
        img.onload = function() {
            // Create a canvas element to draw the SVG
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            if (texture) texture.dispose();
            texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

            if (brick.material && Array.isArray(brick.material) && brick.material.length > 2) {
                if (brick.material[2].map) brick.material[2].map.dispose();
                brick.material[2].dispose();
                brick.material[2] = new THREE.MeshStandardMaterial({
                    map: texture, roughness: 0.7, metalness: 0.1, name: 'top-textured'
                });
                brick.material[2].needsUpdate = true;
            } else {
                console.error("Brick material array not set up correctly.");
            }


            try {
                scheduleInitialSVGParsing(svgData);
            } catch (parseError) {
                console.error('Error during SVG parsing from backend:', parseError);
                alert('Failed to process SVG from backend. Please check console.');
            } finally {
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('loading').textContent = 'Loading...'; // Reset message
                document.getElementById('downloadSTL').disabled = false;
            }
        };
        img.onerror = function(e) {
            console.error('Error loading SVG data into Image element:', e);
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('loading').textContent = 'Loading...';
            alert('Error processing SVG data from backend. The fetched data might be invalid or corrupted.');
        };
        // Use base64 encoding for the Image src to handle potential SVG complexities
        try {
             // Ensure svgData is properly encoded before btoa
             const utf8Bytes = new TextEncoder().encode(svgData);
             const base64String = btoa(String.fromCharCode(...utf8Bytes));
             img.src = 'data:image/svg+xml;base64,' + base64String;
        } catch (b64Error) {
             console.error("Error base64 encoding SVG data:", b64Error);
             alert("Error encoding SVG data for display.");
             document.getElementById('loading').classList.add('hidden');
             document.getElementById('loading').textContent = 'Loading...';
        }
        // --- End reused logic ---

    } catch (error) {
        console.error('Error loading SVG via backend:', error);
        alert(`Failed to load SVG: ${error.message}. Check server logs.`);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('loading').textContent = 'Loading...';
    }
}

// --- End Noun Project Integration ---


// Schedule a low-quality update for the initial SVG parsing
function scheduleInitialSVGParsing(svgData) {
    cancelProgressiveRendering(); // Cancel any previous rendering
    
    // Run immediate low-quality update
    renderer.shadowMap.enabled = false;
    parseSVGForExtrusion(svgData, true, 0.2);
}

// Update brick dimensions based on UI inputs - REMOVED (defaults used)
// function updateBrickDimensions() { ... }

// Update brick color based on UI input - REMOVED (defaults used)
// function updateBrickColor() { ... }

// Update extrusion color based on UI input
function updateExtrusionColor() {
    extrudedGroup.children.forEach(child => {
        if (child.material) {
            child.material.color.set(extrusionColor);
        }
    });
}

// Update triangle color based on UI input to update both triangles - REMOVED (defaults used)
// function updateTriangleColor() { ... }

// Update extrusion position based on UI inputs
function updateExtrusionPosition() {
    extrusionPosition.x = parseFloat(document.getElementById('extrusionX').value);
    extrusionPosition.y = parseFloat(document.getElementById('extrusionY').value);
    extrusionPosition.z = parseFloat(document.getElementById('extrusionZ').value);
    
    // Reposition all extrusions
    if (extrudedGroup && extrudedGroup.children.length > 0) {
        // If we have existing SVG data, regenerate the extrusions using default quality
        if (lastSvgData) {
            parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality);
        }
    }
}

// Optimized position update
function optimizedPositionUpdate() {
    extrusionPosition.x = parseFloat(document.getElementById('extrusionX').value);
    extrusionPosition.y = parseFloat(document.getElementById('extrusionY').value);
    extrusionPosition.z = parseFloat(document.getElementById('extrusionZ').value);
    
    renderer.shadowMap.enabled = false;
    
    if (isUserInteracting) {
        pendingUpdate = true;
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
            // Update position directly without re-extrusion for better performance
            extrudedGroup.children.forEach(child => {
                child.position.set(
                    extrusionPosition.x, 
                    brickDimensions.height + extrusionPosition.y, 
                    extrusionPosition.z
                );
            });
        });
    } else {
        scheduleProgressiveRendering();
    }
}

// Create the 3D brick (uses default dimensions and colors)
function createBrick() {
    // Remove existing brick if it exists
    if (brick) {
        scene.remove(brick);
        // Also remove associated triangles
        if (triangleMesh) scene.remove(triangleMesh);
        if (mirrorTriangleMesh) scene.remove(mirrorTriangleMesh);
        triangleMesh = null;
        mirrorTriangleMesh = null;
    }
    
    // Remove existing extrusions if they exist
    if (extrudedGroup) {
        scene.remove(extrudedGroup);
    }
    
    extrudedGroup = new THREE.Group();
    scene.add(extrudedGroup);
    
    // Create default material (uses default brickColor)
    const materials = [
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'right' }), // Right side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'left' }), // Left side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'top' }), // Top side (will be replaced with SVG texture)
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'bottom' }), // Bottom side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'front' }), // Front side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'back' })  // Back side
    ];
    
    // Create brick geometry (uses default brickDimensions)
    const geometry = new THREE.BoxGeometry(
        brickDimensions.width,
        brickDimensions.height,
        brickDimensions.depth
    );
    
    // Create mesh with geometry and materials
    brick = new THREE.Mesh(geometry, materials);
    brick.castShadow = true;
    brick.receiveShadow = true;
    scene.add(brick);
    
    // Add the 90-degree triangles to the sides of the brick
    addTriangleToBrick(); // This function now adds both triangles
}

// Function to add 90-degree triangles to both sides of the brick
function addTriangleToBrick() {
    // Remove existing triangles first
    if (triangleMesh) scene.remove(triangleMesh);
    if (mirrorTriangleMesh) scene.remove(mirrorTriangleMesh);

    // Create the triangle shape dimensions using default brickDimensions
    const triangleHeight = brickDimensions.height;
    const triangleWidth = brickDimensions.height; // Base width equals height for 45-45-90 triangle face
    const triangleDepth = brickDimensions.depth; 
    
    // Create triangular prism geometry using BufferGeometry
    const triangleGeometry = new THREE.BufferGeometry();
    
    // Define the vertices of a 3D triangular prism
    const vertices = new Float32Array([
        // Front face (y-z plane at x=0)
         0, 0, 0,             // Bottom-left corner (Origin)
         0, triangleHeight, 0, // Top-left corner
         triangleWidth, 0, 0, // Bottom-right corner (on x-axis)
        
        // Back face (offset by triangleDepth in Z)
         0, 0, -triangleDepth,             // Bottom-left corner
         0, triangleHeight, -triangleDepth, // Top-left corner
         triangleWidth, 0, -triangleDepth  // Bottom-right corner
    ]);
    
    // Define indices for the triangular prism faces
    const indices = [
        // Front face triangle
        0, 1, 2,
        // Back face triangle
        3, 5, 4, // Note the order for correct facing direction
        // Bottom rectangle (0, 2, 5, 3) split into two triangles
        0, 2, 5,  0, 5, 3,
        // Back vertical rectangle (0, 3, 4, 1) split into two triangles
        0, 3, 4,  0, 4, 1,
        // Slanted rectangle (hypotenuse) (1, 4, 5, 2) split into two triangles
        1, 4, 5,  1, 5, 2
    ];
    
    triangleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    triangleGeometry.setIndex(indices);
    triangleGeometry.computeVertexNormals(); // Compute normals for lighting
    
    // Create material for the triangles (uses default triangleColor)
    const triangleMaterial = new THREE.MeshStandardMaterial({
        color: triangleColor,
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    
    // --- Create and position the first triangle (right side) ---
    triangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
    triangleMesh.castShadow = true;
    triangleMesh.receiveShadow = true;
    triangleMesh.position.set(
        -brickDimensions.width / 2,
        -brickDimensions.height / 2,
        brickDimensions.depth / 2
    );
    triangleMesh.rotation.y = -Math.PI / 2;
    scene.add(triangleMesh);

    // --- Create and position the second (mirrored) triangle (left side) ---
    // Clone geometry and material (can share geometry, clone material if colors differ later)
    mirrorTriangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial.clone());
    mirrorTriangleMesh.castShadow = true;
    mirrorTriangleMesh.receiveShadow = true;
    mirrorTriangleMesh.position.set(
        brickDimensions.width / 2,
        -brickDimensions.height / 2,
        -brickDimensions.depth / 2
    );
    mirrorTriangleMesh.rotation.y = Math.PI / 2;
    scene.add(mirrorTriangleMesh);
}


    // Add Noun Project search listener
    document.getElementById('nounSearchButton').addEventListener('click', () => {
        const searchTerm = document.getElementById('nounSearchTerm').value;
        if (searchTerm.trim()) {
            searchNounProject(searchTerm.trim());
        }
    });

    // Add SVG search button listener
    document.getElementById('svgSearchButton').addEventListener('click', () => {
        const searchTerm = document.getElementById('svgSearchTerm').value;
        if (searchTerm.trim()) {
            searchSVGsOnline(searchTerm.trim());
        }
    });
    
    // Add ability to press Enter in the search box
    document.getElementById('svgSearchTerm').addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            const searchTerm = document.getElementById('svgSearchTerm').value;
            if (searchTerm.trim()) {
                searchSVGsOnline(searchTerm.trim());
            }
        }
    });


// --- SVG Online Search Integration ---

// Function to search for SVGs online
async function searchSVGsOnline(searchTerm) {
    console.log("Searching for SVGs with term:", searchTerm);
    const resultsContainer = document.getElementById('svgSearchResults');
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = '<p><em>Searching...</em></p>';

    try {
        // Call the backend endpoint (requires server implementation)
        const response = await fetch(`/api/search-svgs?term=${encodeURIComponent(searchTerm)}`);
        
        if (!response.ok) {
            let errorBody = `Status: ${response.status} ${response.statusText}`;
            try {
                const errorJson = await response.json();
                errorBody = errorJson.error || JSON.stringify(errorJson);
            } catch (e) {
                errorBody = await response.text().catch(() => errorBody);
            }
            throw new Error(`API Error: ${errorBody}`);
        }

        const data = await response.json();
        displaySVGSearchResults(data.results || []);

    } catch (error) {
        console.error("Error searching for SVGs:", error);
        resultsContainer.innerHTML = `<p><em>Error searching for SVGs: ${error.message}. Check console and server logs.</em></p>`;
    }
}

// Function to display SVG search results
function displaySVGSearchResults(results) {
    const resultsContainer = document.getElementById('svgSearchResults');
    resultsContainer.innerHTML = ''; // Clear previous results
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<p><em>No results found.</em></p>';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'svg-results-list';
    
    results.forEach(result => {
        if (!result || !result.preview_url) {
            console.warn("Skipping invalid result data:", result);
            return;
        }

        const listItem = document.createElement('li');
        const img = document.createElement('img');
        img.src = result.preview_url;
        img.alt = `SVG: ${result.title || result.id || 'Untitled'}`;
        img.style.cursor = 'pointer';
        img.style.margin = '2px';
        img.title = `Load SVG: ${result.title || result.id || 'Untitled'}`;
        
        img.addEventListener('click', () => {
            loadSVGFromSearchResults(result.id, result.download_url);
        });

        listItem.appendChild(img);
        list.appendChild(listItem);
    });
    
    resultsContainer.appendChild(list);
}

// Function to load an SVG from search results
async function loadSVGFromSearchResults(id, url) {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('loading').textContent = `Loading SVG (ID: ${id})...`;
    
    try {
        // Call the backend endpoint to get the SVG
        const response = await fetch(`/api/get-svg?id=${encodeURIComponent(id)}&url=${encodeURIComponent(url)}`);
        
        if (!response.ok) {
            let errorBody = `Status: ${response.status} ${response.statusText}`;
            try {
                const errorJson = await response.json();
                errorBody = errorJson.error || JSON.stringify(errorJson);
            } catch (e) {
                errorBody = await response.text().catch(() => errorBody);
            }
            throw new Error(`Failed to fetch SVG via backend: ${errorBody}`);
        }
        
        // Check content type
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("svg")) {
            console.warn(`Expected SVG from backend, but received content type: ${contentType}`);
        }

        const svgData = await response.text();
        if (!svgData || !svgData.toLowerCase().includes('<svg')) {
            throw new Error("Received data does not appear to be valid SVG.");
        }
        
        // Process the SVG using existing functions
        lastSvgData = svgData; // Store for potential reuse
        
        const img = new Image();
        img.onload = function() {
            // Create a canvas element to draw the SVG
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            if (texture) texture.dispose();
            texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

            if (brick.material && Array.isArray(brick.material) && brick.material.length > 2) {
                if (brick.material[2].map) brick.material[2].map.dispose();
                brick.material[2].dispose();
                brick.material[2] = new THREE.MeshStandardMaterial({
                    map: texture, roughness: 0.7, metalness: 0.1, name: 'top-textured'
                });
                brick.material[2].needsUpdate = true;
            } else {
                console.error("Brick material array not set up correctly.");
            }

            try {
                scheduleInitialSVGParsing(svgData);
            } catch (parseError) {
                console.error('Error during SVG parsing from search:', parseError);
                alert('Failed to process SVG from search. Please check console.');
            } finally {
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('loading').textContent = 'Loading...'; // Reset message
                document.getElementById('downloadSTL').disabled = false;
            }
        };
        
        img.onerror = function(e) {
            console.error('Error loading SVG data into Image element:', e);
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('loading').textContent = 'Loading...';
            alert('Error processing SVG data from search. The fetched data might be invalid or corrupted.');
        };
        
        // Use base64 encoding for the Image src
        try {
            const utf8Bytes = new TextEncoder().encode(svgData);
            const base64String = btoa(String.fromCharCode(...utf8Bytes));
            img.src = 'data:image/svg+xml;base64,' + base64String;
        } catch (b64Error) {
            console.error("Error base64 encoding SVG data:", b64Error);
            alert("Error encoding SVG data for display.");
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('loading').textContent = 'Loading...';
        }
        
    } catch (error) {
        console.error('Error loading SVG from search:', error);
        alert(`Failed to load SVG: ${error.message}. Check server logs.`);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('loading').textContent = 'Loading...';
    }
}

// --- End Noun Project Integration ---


// Schedule a low-quality update for the initial SVG parsing
function scheduleInitialSVGParsing(svgData) {
    cancelProgressiveRendering(); // Cancel any previous rendering
    
    // Run immediate low-quality update
    renderer.shadowMap.enabled = false;
    parseSVGForExtrusion(svgData, true, 0.2);
}

// Update brick dimensions based on UI inputs - REMOVED (defaults used)
// function updateBrickDimensions() { ... }

// Update brick color based on UI input - REMOVED (defaults used)
// function updateBrickColor() { ... }

// Update extrusion color based on UI input
function updateExtrusionColor() {
    extrudedGroup.children.forEach(child => {
        if (child.material) {
            child.material.color.set(extrusionColor);
        }
    });
}

// Update triangle color based on UI input to update both triangles - REMOVED (defaults used)
// function updateTriangleColor() { ... }

// Update extrusion position based on UI inputs
function updateExtrusionPosition() {
    extrusionPosition.x = parseFloat(document.getElementById('extrusionX').value);
    extrusionPosition.y = parseFloat(document.getElementById('extrusionY').value);
    extrusionPosition.z = parseFloat(document.getElementById('extrusionZ').value);
    
    // Reposition all extrusions
    if (extrudedGroup && extrudedGroup.children.length > 0) {
        // If we have existing SVG data, regenerate the extrusions using default quality
        if (lastSvgData) {
            parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality);
        }
    }
}

// Optimized position update
function optimizedPositionUpdate() {
    extrusionPosition.x = parseFloat(document.getElementById('extrusionX').value);
    extrusionPosition.y = parseFloat(document.getElementById('extrusionY').value);
    extrusionPosition.z = parseFloat(document.getElementById('extrusionZ').value);
    
    renderer.shadowMap.enabled = false;
    
    if (isUserInteracting) {
        pendingUpdate = true;
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
            // Update position directly without re-extrusion for better performance
            extrudedGroup.children.forEach(child => {
                child.position.set(
                    extrusionPosition.x, 
                    brickDimensions.height + extrusionPosition.y, 
                    extrusionPosition.z
                );
            });
        });
    } else {
        scheduleProgressiveRendering();
    }
}

// Create the 3D brick (uses default dimensions and colors)
function createBrick() {
    // Remove existing brick if it exists
    if (brick) {
        scene.remove(brick);
        // Also remove associated triangles
        if (triangleMesh) scene.remove(triangleMesh);
        if (mirrorTriangleMesh) scene.remove(mirrorTriangleMesh);
        triangleMesh = null;
        mirrorTriangleMesh = null;
    }
    
    // Remove existing extrusions if they exist
    if (extrudedGroup) {
        scene.remove(extrudedGroup);
    }
    
    extrudedGroup = new THREE.Group();
    scene.add(extrudedGroup);
    
    // Create default material (uses default brickColor)
    const materials = [
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'right' }), // Right side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'left' }), // Left side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'top' }), // Top side (will be replaced with SVG texture)
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'bottom' }), // Bottom side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'front' }), // Front side
        new THREE.MeshStandardMaterial({ color: brickColor, name: 'back' })  // Back side
    ];
    
    // Create brick geometry (uses default brickDimensions)
    const geometry = new THREE.BoxGeometry(
        brickDimensions.width,
        brickDimensions.height,
        brickDimensions.depth
    );
    
    // Create mesh with geometry and materials
    brick = new THREE.Mesh(geometry, materials);
    brick.castShadow = true;
    brick.receiveShadow = true;
    scene.add(brick);
    
    // Add the 90-degree triangles to the sides of the brick
    addTriangleToBrick(); // This function now adds both triangles
}

// Function to add 90-degree triangles to both sides of the brick
function addTriangleToBrick() {
    // Remove existing triangles first
    if (triangleMesh) scene.remove(triangleMesh);
    if (mirrorTriangleMesh) scene.remove(mirrorTriangleMesh);

    // Create the triangle shape dimensions using default brickDimensions
    const triangleHeight = brickDimensions.height;
    const triangleWidth = brickDimensions.height; // Base width equals height for 45-45-90 triangle face
    const triangleDepth = brickDimensions.depth; 
    
    // Create triangular prism geometry using BufferGeometry
    const triangleGeometry = new THREE.BufferGeometry();
    
    // Define the vertices of a 3D triangular prism
    const vertices = new Float32Array([
        // Front face (y-z plane at x=0)
         0, 0, 0,             // Bottom-left corner (Origin)
         0, triangleHeight, 0, // Top-left corner
         triangleWidth, 0, 0, // Bottom-right corner (on x-axis)
        
        // Back face (offset by triangleDepth in Z)
         0, 0, -triangleDepth,             // Bottom-left corner
         0, triangleHeight, -triangleDepth, // Top-left corner
         triangleWidth, 0, -triangleDepth  // Bottom-right corner
    ]);
    
    // Define indices for the triangular prism faces
    const indices = [
        // Front face triangle
        0, 1, 2,
        // Back face triangle
        3, 5, 4, // Note the order for correct facing direction
        // Bottom rectangle (0, 2, 5, 3) split into two triangles
        0, 2, 5,  0, 5, 3,
        // Back vertical rectangle (0, 3, 4, 1) split into two triangles
        0, 3, 4,  0, 4, 1,
        // Slanted rectangle (hypotenuse) (1, 4, 5, 2) split into two triangles
        1, 4, 5,  1, 5, 2
    ];
    
    triangleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    triangleGeometry.setIndex(indices);
    triangleGeometry.computeVertexNormals(); // Compute normals for lighting
    
    // Create material for the triangles (uses default triangleColor)
    const triangleMaterial = new THREE.MeshStandardMaterial({
        color: triangleColor,
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    
    // --- Create and position the first triangle (right side) ---
    triangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
    triangleMesh.castShadow = true;
    triangleMesh.receiveShadow = true;
    triangleMesh.position.set(
        -brickDimensions.width / 2,
        -brickDimensions.height / 2,
        brickDimensions.depth / 2
    );
    triangleMesh.rotation.y = -Math.PI / 2;
    scene.add(triangleMesh);

    // --- Create and position the second (mirrored) triangle (left side) ---
    // Clone geometry and material (can share geometry, clone material if colors differ later)
    mirrorTriangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial.clone());
    mirrorTriangleMesh.castShadow = true;
    mirrorTriangleMesh.receiveShadow = true;
    mirrorTriangleMesh.position.set(
        brickDimensions.width / 2,
        -brickDimensions.height / 2,
        -brickDimensions.depth / 2
    );
    mirrorTriangleMesh.rotation.y = Math.PI / 2;
    scene.add(mirrorTriangleMesh);
}


// Variable to store last SVG data for reuse
let lastSvgData = null;

// Handle SVG file upload
function handleSVGUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Show loading indicator
    document.getElementById('loading').classList.remove('hidden');
    
    // Create FileReader to read the SVG
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const svgData = e.target.result;
        lastSvgData = svgData; // Store for later reuse
        
        // Create a temporary img element to load the SVG
        const img = new Image();
        img.onload = function() {
            // Create a canvas element to draw the SVG
            const canvas = document.createElement('canvas');
            canvas.width = 1024;  // Higher resolution for better quality
            canvas.height = 1024;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Create texture from canvas
            if (texture) {
                texture.dispose(); // Clean up old texture
            }
            
            texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            
            // Apply texture to the top face of the brick (index 2 in BoxGeometry)
            if (brick.material && Array.isArray(brick.material) && brick.material.length > 2) {
                // Dispose old texture material if it exists
                if (brick.material[2].map) {
                    brick.material[2].map.dispose();
                }
                brick.material[2].dispose(); // Dispose the material itself

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

            // Use try...finally to ensure loading is hidden
            try {
                // Parse SVG for extrusion - start with low quality for responsiveness
                scheduleInitialSVGParsing(svgData); 
            } catch (parseError) {
                console.error('Error during initial SVG parsing:', parseError);
                alert('Failed to process SVG for extrusion. Please check the SVG file or console for errors.');
            } finally {
                // Hide loading indicator regardless of parsing success/failure
                document.getElementById('loading').classList.add('hidden');
                // Enable STL download button only if parsing likely succeeded (or at least didn't throw immediately)
                document.getElementById('downloadSTL').disabled = false; 
            }
        };
        
        img.onerror = function() {
            console.error('Error loading SVG');
            document.getElementById('loading').classList.add('hidden');
            alert('Error loading SVG. Please try another file.');
        };
        
        // Set the SVG data as the image source
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };
    
    reader.onerror = function() {
        console.error('Error reading file');
        document.getElementById('loading').classList.add('hidden');
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsText(file);
}

// Define the function to process other SVG element types BEFORE it's called
function processOtherSVGElements(svgDoc, scale, svgWidth, svgHeight, lowQuality) {
    const elementsToProcess = [
        ...svgDoc.querySelectorAll('rect'),
        ...svgDoc.querySelectorAll('circle'),
        ...svgDoc.querySelectorAll('ellipse'),
        ...svgDoc.querySelectorAll('line'),
        ...svgDoc.querySelectorAll('polyline'),
        ...svgDoc.querySelectorAll('polygon')
    ];

    elementsToProcess.forEach(element => {
        try {
            let pathData = '';
            const tagName = element.tagName.toLowerCase();

            // Convert basic shapes to path data
            switch (tagName) {
                case 'rect':
                    pathData = rectToPath(element);
                    break;
                case 'circle':
                    pathData = circleToPath(element);
                    break;
                case 'ellipse':
                    pathData = ellipseToPath(element);
                    break;
                case 'line':
                    pathData = lineToPath(element);
                    break;
                case 'polyline':
                    pathData = polylineToPath(element);
                    break;
                case 'polygon':
                    pathData = polygonToPath(element);
                    break;
                default:
                    console.warn(`Unsupported SVG element type: ${tagName}`);
                    return; // Skip unsupported elements
            }

            if (!pathData) return; // Skip if conversion failed

            // Lines are open paths and shouldn't be extruded as solid shapes
            // Only extrude closed shapes (rect, circle, ellipse, polygon, closed paths)
            if (tagName !== 'line' && tagName !== 'polyline') {
                const shape = createShapeFromSVGPath(pathData, lowQuality);
                if (!shape) return; // Skip if shape creation failed

                centerShape(shape, svgWidth, svgHeight);
                createExtrudedShape(shape, scale, lowQuality);
            }

        } catch (error) {
            console.error(`Error extruding ${element.tagName}:`, error);
        }
    });
}

// Helper function to convert SVG <rect> to path data
function rectToPath(rect) {
    const x = parseFloat(rect.getAttribute('x') || 0);
    const y = parseFloat(rect.getAttribute('y') || 0);
    const width = parseFloat(rect.getAttribute('width') || 0);
    const height = parseFloat(rect.getAttribute('height') || 0);
    // Basic rectangle path (consider rx/ry later if needed)
    return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
}

// Helper function to convert SVG <circle> to path data (using arcs)
function circleToPath(circle) {
    const cx = parseFloat(circle.getAttribute('cx') || 0);
    const cy = parseFloat(circle.getAttribute('cy') || 0);
    const r = parseFloat(circle.getAttribute('r') || 0);
    if (r <= 0) return '';
    // M move to start, A draw arc (rx ry x-axis-rotation large-arc-flag sweep-flag x y)
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

// Helper function to convert SVG <ellipse> to path data
function ellipseToPath(ellipse) {
    const cx = parseFloat(ellipse.getAttribute('cx') || 0);
    const cy = parseFloat(ellipse.getAttribute('cy') || 0);
    const rx = parseFloat(ellipse.getAttribute('rx') || 0);
    const ry = parseFloat(ellipse.getAttribute('ry') || 0);
    if (rx <= 0 || ry <= 0) return '';
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

// Helper function to convert SVG <line> to path data
function lineToPath(line) {
    const x1 = parseFloat(line.getAttribute('x1') || 0);
    const y1 = parseFloat(line.getAttribute('y1') || 0);
    const x2 = parseFloat(line.getAttribute('x2') || 0);
    const y2 = parseFloat(line.getAttribute('y2') || 0);
    return `M ${x1} ${y1} L ${x2} ${y2}`; // Lines are not closed shapes for extrusion
}

// Helper function to convert SVG <polyline> to path data
function polylineToPath(polyline) {
    const points = (polyline.getAttribute('points') || '').trim().split(/\s+|,/);
    if (points.length < 4) return ''; // Need at least two points
    let pathData = `M ${points[0]} ${points[1]}`;
    for (let i = 2; i < points.length; i += 2) {
        pathData += ` L ${points[i]} ${points[i+1]}`;
    }
    return pathData; // Polylines are not implicitly closed
}

// Helper function to convert SVG <polygon> to path data
function polygonToPath(polygon) {
    const points = (polygon.getAttribute('points') || '').trim().split(/\s+|,/);
    if (points.length < 4) return ''; // Need at least two points
    let pathData = `M ${points[0]} ${points[1]}`;
    for (let i = 2; i < points.length; i += 2) {
        pathData += ` L ${points[i]} ${points[i+1]}`;
    }
    pathData += ' Z'; // Polygons are implicitly closed
    return pathData;
}


// Parse SVG and create extruded shapes with modified optimization
function parseSVGForExtrusion(svgData, lowQuality = false, qualityFactor = 1.0, isExporting = false) {
    // Skip if we're in high quality mode but not exporting
    if (isHighQualityMode && !isExporting) return;
    
    // For exports, always use high quality
    if (isExporting) {
        lowQuality = false;
        qualityFactor = 1.0;
    }
    
    // Use a smaller clear and regenerate approach during interaction
    if (lowQuality && extrudedGroup.children.length > 0 && !isExporting) {
        // Just update positions instead of regenerating
        extrudedGroup.children.forEach(child => {
            child.position.set(
                extrusionPosition.x, 
                brickDimensions.height + extrusionPosition.y, 
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
        if (child.material) child.material.dispose();
    }
    
    // Create a temporary DOM element to parse SVG
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgData, "image/svg+xml");
    
    // Get SVG dimensions to properly scale the extrusion
    const svgElement = svgDoc.documentElement;
    let viewBox = svgElement.getAttribute('viewBox');
    let svgWidth, svgHeight;
    
    // Try to get dimensions from viewBox first
    if (viewBox) {
        const viewBoxValues = viewBox.split(/\s+|,/).map(Number);
        if (viewBoxValues.length >= 4) {
            svgWidth = viewBoxValues[2];
            svgHeight = viewBoxValues[3];
        }
    }
    
    // If no viewBox or invalid, try width/height attributes
    if (!svgWidth || !svgHeight) {
        svgWidth = parseFloat(svgElement.getAttribute('width')) || 100;
        svgHeight = parseFloat(svgElement.getAttribute('height')) || 100;
    }
    
    // Calculate scaling factors to fit the SVG onto the brick top face
    // We want to maintain the aspect ratio and ensure it fits within the brick dimensions
    const scaleX = brickDimensions.width / svgWidth;
    const scaleY = brickDimensions.depth / svgHeight;
    const scale = Math.min(scaleX, scaleY) * svgScaleFactor; // Use the adjustable scale factor
    
    console.log(`SVG dimensions: ${svgWidth} x ${svgHeight}, Scale: ${scale}`);
    
    // Log brick position for debugging
    console.log(`Brick position: ${brick.position.y}, Top face at: ${brick.position.y + brickDimensions.height/2}`);
    
    // Performance optimizations for SVG processing
    // Calculate how many elements to process based on quality factor
    const paths = svgDoc.querySelectorAll('path');
    const processLimit = Math.max(1, Math.ceil(paths.length * qualityFactor));
    
    // Process elements in small batches to avoid long blocking operations
    // For exports, use a different processBatch function that doesn't use setTimeout
    if (isExporting) {
        processAllElements(paths, scale, svgWidth, svgHeight, lowQuality);
        processOtherSVGElements(svgDoc, scale, svgWidth, svgHeight, lowQuality);
    } else {
        processBatch(paths, 0, processLimit, scale, svgWidth, svgHeight, lowQuality);
        
        // Only process other elements at higher quality levels for interactive mode
        if (qualityFactor > 0.7) {
            processOtherSVGElements(svgDoc, scale, svgWidth, svgHeight, lowQuality);
        }
    }
}

// Process SVG elements in batches
function processBatch(elements, startIndex, endIndex, scale, svgWidth, svgHeight, lowQuality) {
    const batchSize = 5; // Process 5 elements per frame
    const currentEndIndex = Math.min(startIndex + batchSize, endIndex);
    
    for (let i = startIndex; i < currentEndIndex; i++) {
        try {
            const path = elements[i];
            const pathData = path.getAttribute('d');
            
            const shape = createShapeFromSVGPath(pathData, lowQuality);
            if (!shape) continue;
            
            centerShape(shape, svgWidth, svgHeight);
            createExtrudedShape(shape, scale, lowQuality);
        } catch (error) {
            console.error('Error extruding path:', error);
        }
    }
    
    // If we have more elements to process, schedule the next batch
    if (currentEndIndex < endIndex) {
        setTimeout(() => {
            processBatch(elements, currentEndIndex, endIndex, scale, svgWidth, svgHeight, lowQuality);
        }, 0);
    }
}

// Process all elements at once for export
function processAllElements(elements, scale, svgWidth, svgHeight, lowQuality) {
    const totalElements = elements.length;
    let processed = 0;
    
    // Process in batches of 10 but without setTimeout to keep it synchronous
    for (let i = 0; i < totalElements; i++) {
        try {
            const path = elements[i];
            const pathData = path.getAttribute('d');
            
            const shape = createShapeFromSVGPath(pathData, lowQuality);
            if (!shape) continue;
            
            centerShape(shape, svgWidth, svgHeight);
            createExtrudedShape(shape, scale, lowQuality);
            
            // Update progress every 10 elements or when complete
            processed++;
            if (exportSettings.progressCallback && (processed % 10 === 0 || processed === totalElements)) {
                const progress = Math.round((processed / totalElements) * 100);
                exportSettings.progressCallback(progress);
            }
        } catch (error) {
            console.error('Error extruding path:', error);
        }
    }
}

// Center the shape on the origin (0,0)
function centerShape(shape, width, height) {
    // Move the shape so its center is at origin
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Apply translation to all shape points
    shape.getPoints().forEach(point => {
        point.x -= centerX;
        point.y -= centerY;
    });
}

// Simple SVG path parser - this is a basic implementation
function parseSVGPath(pathData) {
    const commands = [];
    // Normalize the path data for easier parsing
    pathData = pathData.replace(/([A-Za-z])/g, ' $1 ')
                      .replace(/,/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim();
    
    const tokens = pathData.split(' ');
    let i = 0;
    let currentCommand = null;
    let currentX = 0, currentY = 0;
    
    while (i < tokens.length) {
        const token = tokens[i];
        
        if (/[A-Za-z]/.test(token)) {
            currentCommand = token;
            i++;
        } else if (currentCommand === 'M' || currentCommand === 'm') {
            const x = parseFloat(tokens[i]);
            const y = parseFloat(tokens[i+1]);
            
            if (currentCommand === 'm') {
                commands.push({ type: 'M', x: currentX + x, y: currentY + y });
                currentX += x;
                currentY += y;
            } else {
                commands.push({ type: 'M', x, y });
                currentX = x;
                currentY = y;
            }
            
            i += 2;
            // After a moveto, subsequent coordinates are treated as lineto
            currentCommand = currentCommand === 'M' ? 'L' : 'l';
        } else if (currentCommand === 'L' || currentCommand === 'l') {
            const x = parseFloat(tokens[i]);
            const y = parseFloat(tokens[i+1]);
            
            if (currentCommand === 'l') {
                commands.push({ type: 'L', x: currentX + x, y: currentY + y });
                currentX += x;
                currentY += y;
            } else {
                commands.push({ type: 'L', x, y });
                currentX = x;
                currentY = y;
            }
            
            i += 2;
        } else if (currentCommand === 'C' || currentCommand === 'c') {
            const x1 = parseFloat(tokens[i]);
            const y1 = parseFloat(tokens[i+1]);
            const x2 = parseFloat(tokens[i+2]);
            const y2 = parseFloat(tokens[i+3]);
            const x = parseFloat(tokens[i+4]);
            const y = parseFloat(tokens[i+5]);
            
            if (currentCommand === 'c') {
                commands.push({ 
                    type: 'C', 
                    x1: currentX + x1, y1: currentY + y1,
                    x2: currentX + x2, y2: currentY + y2,
                    x: currentX + x, y: currentY + y
                });
                currentX += x;
                currentY += y;
            } else {
                commands.push({ type: 'C', x1, y1, x2, y2, x, y });
                currentX = x;
                currentY = y;
            }
            
            i += 6;
        } else if (currentCommand === 'Z' || currentCommand === 'z') {
            commands.push({ type: 'Z' });
            i++;
        } else {
            // Skip unknown commands or invalid tokens
            i++;
        }
    }
    
    return commands;
}

// Helper function to create and position extruded shapes with quality option
function createExtrudedShape(shape, scale, lowQuality = false) {
    // Higher quality settings for export
    const steps = isHighQualityMode ? exportSettings.extrudeSteps : (lowQuality ? 1 : 2);
    
    // Use different extrude settings based on quality mode
    const extrudeSettings = {
        steps: steps,
        depth: extrusionHeight,
        bevelEnabled: isHighQualityMode && exportSettings.enableBevel,
        bevelThickness: exportSettings.bevelThickness,
        bevelSize: exportSettings.bevelSize,
        bevelSegments: exportSettings.bevelSegments,
        curveSegments: isHighQualityMode ? 12 : 5 // Control curve resolution
    };
    
    // Use higher quality materials for export
    const material = new THREE.MeshStandardMaterial({
        color: extrusionColor,
        roughness: isHighQualityMode ? 0.3 : 0.5,
        metalness: isHighQualityMode ? 0.4 : 0.2,
        flatShading: lowQuality && !isHighQualityMode,
        shadowSide: isHighQualityMode || !lowQuality ? THREE.DoubleSide : THREE.FrontSide,
        side: THREE.DoubleSide // Ensure all sides are rendered
    });
    
    // Create extruded geometry with explicit triangulation
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Create mesh with the extruded geometry
    const mesh = new THREE.Mesh(geometry, material);
    
    // Apply transformations to match brick dimensions
    mesh.scale.set(scale * 0.25, -scale * 0.25, 1); // Scale factor
    
    // Rotate to lay flat on top of the brick
    mesh.rotation.x = Math.PI / 2;
    
    // Position exactly on top of the brick's top face with offset
    // Apply the position offset from UI controls
    mesh.position.set(
        extrusionPosition.x, 
        brickDimensions.height + extrusionPosition.y, 
        extrusionPosition.z
    );
    
    // Remove any duplicate geometries that might cause the extra layer
    mesh.updateMatrix();
    
    // Add to the extrusion group
    extrudedGroup.add(mesh);
}

// Create Three.js shape from SVG path data with quality option
function createShapeFromSVGPath(pathData, lowQuality = false) {
    try {
        // Create a temporary SVG path element to normalize the path data
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        
        // Check if path data contains Z commands which indicate closed subpaths
        const hasClosedSubpaths = pathData.toUpperCase().includes('Z');
        
        // Get path segments - use higher resolution for export
        const pathLength = path.getTotalLength();
        
        // Use different segment calculation based on quality mode
        const segmentDivisor = isHighQualityMode ? exportSettings.segmentDivisor : 
                              (lowQuality ? 10 : 5);
        const minSegments = isHighQualityMode ? exportSettings.minSegments : 
                           (lowQuality ? 5 : 10);
        const segments = Math.max(Math.floor(pathLength / segmentDivisor), minSegments);
        
        // Create shape
        const shape = new THREE.Shape();
        
        // Check if this is a complex path with multiple subpaths
        const isComplexPath = pathData.toUpperCase().split('M').length > 2;
        
        // For complex paths, use Three.js ShapePath to handle holes properly
        if (isComplexPath && hasClosedSubpaths) {
            return createComplexShapeWithHoles(pathData, segments, lowQuality);
        }
        
        // Sample points along the path
        let firstX, firstY;
        for (let i = 0; i <= segments; i++) {
            const point = path.getPointAtLength(i / segments * pathLength);
            
            if (i === 0) {
                shape.moveTo(point.x, point.y);
                firstX = point.x;
                firstY = point.y;
            } else {
                shape.lineTo(point.x, point.y);
            }
        }
        
        // Ensure the path is properly closed
        if (hasClosedSubpaths) {
            shape.closePath();
        }
        
        return shape;
    } catch (error) {
        console.error('Error creating shape from path:', error);
        return null;
    }
}

// Function to create a complex shape with holes
function createComplexShapeWithHoles(pathData, segments, lowQuality) {
    try {
        // Use SVG path parser to extract individual commands
        const commands = parseSVGPath(pathData);
        
        // Group commands into subpaths
        const subpaths = [];
        let currentSubpath = [];
        
        for (let cmd of commands) {
            if (cmd.type === 'M' && currentSubpath.length > 0) {
                subpaths.push(currentSubpath);
                currentSubpath = [cmd];
            } else {
                currentSubpath.push(cmd);
            }
        }
        
        if (currentSubpath.length > 0) {
            subpaths.push(currentSubpath);
        }
        
        // The first subpath is the main shape
        const mainShape = new THREE.Shape();
        let currentX = 0, currentY = 0;
        let firstX, firstY;
        
        // Process the main shape
        if (subpaths.length > 0) {
            for (let cmd of subpaths[0]) {
                switch(cmd.type) {
                    case 'M':
                        mainShape.moveTo(cmd.x, cmd.y);
                        currentX = cmd.x;
                        currentY = cmd.y;
                        firstX = cmd.x;
                        firstY = cmd.y;
                        break;
                    case 'L':
                        mainShape.lineTo(cmd.x, cmd.y);
                        currentX = cmd.x;
                        currentY = cmd.y;
                        break;
                    case 'C':
                        mainShape.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                        currentX = cmd.x;
                        currentY = cmd.y;
                        break;
                    case 'Q':
                        mainShape.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
                        currentX = cmd.x;
                        currentY = cmd.y;
                        break;
                    case 'Z':
                        mainShape.closePath();
                        currentX = firstX;
                        currentY = firstY;
                        break;
                }
            }
        }
        
        // All other subpaths are holes
        for (let i = 1; i < subpaths.length; i++) {
            const hole = new THREE.Path();
            currentX = 0; 
            currentY = 0;
            
            for (let cmd of subpaths[i]) {
                switch(cmd.type) {
                    case 'M':
                        hole.moveTo(cmd.x, cmd.y);
                        currentX = cmd.x;
                        currentY = cmd.y;
                        firstX = cmd.x;
                        firstY = cmd.y;
                        break;
                    case 'L':
                        hole.lineTo(cmd.x, cmd.y);
                        currentX = cmd.x;
                        currentY = cmd.y;
                        break;
                    case 'C':
                        hole.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                        currentX = cmd.x;
                        currentY = cmd.y;
                        break;
                    case 'Q':
                        hole.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
                        currentX = cmd.x;
                        currentY = cmd.y;
                        break;
                    case 'Z':
                        hole.closePath();
                        currentX = firstX;
                        currentY = firstY;
                        break;
                }
            }
            
            // Add the hole to the main shape
            mainShape.holes.push(hole);
        }
        
        return mainShape;
    } catch (error) {
        console.error('Error creating complex shape:', error);
        return new THREE.Shape(); // Return empty shape as fallback
    }
}

// Function to prepare export group with proper geometry, including both triangles
// Modified to use CSG for union
function prepareExportGroup() {
    // Check if CSG library is available
    if (typeof CSG === 'undefined') {
        console.error("CSG library (three-csg-ts) not found. Cannot perform boolean union. Exporting separate parts.");
        // Fallback to the old method if CSG is not loaded
        const fallbackGroup = new THREE.Group();
        if (brick) fallbackGroup.add(brick.clone());
        if (triangleMesh) fallbackGroup.add(triangleMesh.clone());
        if (mirrorTriangleMesh) fallbackGroup.add(mirrorTriangleMesh.clone());
        addIndividualExtrusionClones(fallbackGroup); // Add extrusions individually
        return fallbackGroup; // Return the group
    }

    try {
        console.log("Starting CSG Union process...");
        let combinedMesh = null;

        // 1. Start with the brick
        if (brick) {
            const brickClone = brick.clone();
            brickClone.updateMatrixWorld(true); // Ensure world matrix is up-to-date
            combinedMesh = CSG.fromMesh(brickClone);
            console.log("CSG: Added Brick");
        } else {
            console.error("CSG Error: Brick mesh not found.");
            return null; // Cannot proceed without the base brick
        }

        // 2. Union with the first triangle
        if (triangleMesh) {
            const triangleClone = triangleMesh.clone();
            triangleClone.updateMatrixWorld(true);
            const triangleCSG = CSG.fromMesh(triangleClone);
            combinedMesh = combinedMesh.union(triangleCSG);
            console.log("CSG: Union with Triangle 1");
        }

        // 3. Union with the second triangle
        if (mirrorTriangleMesh) {
            const mirrorTriangleClone = mirrorTriangleMesh.clone();
            mirrorTriangleClone.updateMatrixWorld(true);
            const mirrorTriangleCSG = CSG.fromMesh(mirrorTriangleClone);
            combinedMesh = combinedMesh.union(mirrorTriangleCSG);
            console.log("CSG: Union with Triangle 2");
        }

        // 4. Process and Union Extrusions
        if (extrudedGroup && extrudedGroup.children.length > 0) {
            console.log(`CSG: Processing ${extrudedGroup.children.length} extrusions...`);
            // Option A: Merge extrusions first if BufferGeometryUtils is available (potentially faster)
            if (typeof THREE.BufferGeometryUtils !== 'undefined') {
                const geometries = [];
                extrudedGroup.children.forEach(child => {
                    if (child.geometry && child.isMesh) {
                        const clonedGeo = child.geometry.clone();
                        // Apply the mesh's world matrix directly to the geometry vertices
                        clonedGeo.applyMatrix4(child.matrixWorld);
                        geometries.push(clonedGeo);
                    }
                });

                if (geometries.length > 0) {
                    try {
                        const mergedGeo = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries, false);
                        if (mergedGeo) {
                            // Create a temporary mesh for the merged extrusions
                            const mergedExtrusionMesh = new THREE.Mesh(mergedGeo);
                            // mergedExtrusionMesh.updateMatrixWorld(true); // Matrix already applied to geometry
                            const extrusionsCSG = CSG.fromMesh(mergedExtrusionMesh);
                            combinedMesh = combinedMesh.union(extrusionsCSG);
                            console.log("CSG: Union with merged extrusions");
                            // Dispose temporary geometry
                            mergedGeo.dispose();
                        } else {
                             console.warn("BufferGeometryUtils merge failed, processing extrusions individually.");
                             // Fallback to individual union if merge fails
                             unionExtrusionsIndividually(combinedMesh);
                        }
                    } catch (mergeError) {
                        console.error("Error merging extrusion geometries, processing individually:", mergeError);
                        // Fallback to individual union on error
                        unionExtrusionsIndividually(combinedMesh);
                    }
                }
            } else {
                // Option B: Union extrusions individually if BufferGeometryUtils is not available
                console.warn("THREE.BufferGeometryUtils not found. Unioning extrusions individually (might be slower).");
                combinedMesh = unionExtrusionsIndividually(combinedMesh);
            }
        }

        console.log("CSG Union complete. Converting back to THREE.Mesh...");
        // Convert the final CSG object back to a THREE.Mesh
        const finalMesh = CSG.toMesh(combinedMesh, new THREE.Matrix4()); // Use identity matrix as transforms are baked in

        // Assign a simple material (needed for STLExporter, but color doesn't matter for STL)
        finalMesh.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        finalMesh.name = "combined_export_mesh";

        console.log("CSG: Final mesh created.");
        return finalMesh; // Return the single combined mesh

    } catch (csgError) {
        console.error("Error during CSG operation:", csgError);
        alert(`Error creating combined model for export: ${csgError.message}. Check console.`);
        // Fallback or return null if CSG fails catastrophically
         const fallbackGroup = new THREE.Group();
         if (brick) fallbackGroup.add(brick.clone());
         if (triangleMesh) fallbackGroup.add(triangleMesh.clone());
         if (mirrorTriangleMesh) fallbackGroup.add(mirrorTriangleMesh.clone());
         addIndividualExtrusionClones(fallbackGroup);
         return fallbackGroup; // Return group as fallback
    }
}

// Helper function for CSG unioning extrusions one by one
function unionExtrusionsIndividually(baseCSG) {
     let currentCSG = baseCSG;
     extrudedGroup.children.forEach((child, index) => {
        if (child.geometry && child.isMesh) {
            try {
                const extrusionClone = child.clone(); // Clone mesh
                extrusionClone.updateMatrixWorld(true); // Ensure world matrix is updated
                const extrusionCSG = CSG.fromMesh(extrusionClone);
                currentCSG = currentCSG.union(extrusionCSG);
                console.log(`CSG: Union with extrusion ${index + 1}`);
            } catch(individualUnionError) {
                 console.error(`Error unioning extrusion ${index + 1}:`, individualUnionError);
            }
        }
    });
    return currentCSG;
}


// Helper function to add individual clones (fallback for prepareExportGroup)
function addIndividualExtrusionClones(exportGroup) {
    if (extrudedGroup) {
        extrudedGroup.children.forEach(child => {
             if (child.isMesh) {
                const clone = child.clone();
                clone.material = child.material.clone(); // Clone material too
                clone.updateMatrix(); // Ensure matrix is up-to-date
                // No need to apply matrix again if cloning includes world transform
                exportGroup.add(clone);
             }
        });
    }
}


// Export brick as STL file with modified export group preparation and progress bar
function exportSTL() {
    try {
        // Show loading message with progress bar structure
        const loadingElement = document.getElementById('loading');
        loadingElement.classList.remove('hidden');
        // Initialize progress bar HTML
        loadingElement.innerHTML = `
            <div class="progress-container" style="width: 80%; background-color: #ddd; margin: 10px auto; border-radius: 5px;">
                <div class="progress-bar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; text-align: center; line-height: 20px; color: white;"></div>
            </div>
            <span class="progress-text" style="display: block; text-align: center;">Preparing model for export: 0%</span>
        `;
        
        const progressBar = loadingElement.querySelector('.progress-bar');
        const progressText = loadingElement.querySelector('.progress-text');
        
        // Setup progress callback
        exportSettings.progressCallback = (progress) => {
            if (progressBar && progressText) {
                const clampedProgress = Math.min(100, Math.max(0, progress)); // Ensure progress is between 0 and 100
                progressBar.style.width = clampedProgress + '%';
                progressText.textContent = `Preparing model for export: ${clampedProgress}%`;
            }
        };
        
        // Set high quality flag
        isHighQualityMode = true;
        
        // Use a worker or timer to avoid blocking the UI
        setTimeout(() => {
            // Force a full-quality render if SVG exists
            if (lastSvgData) {
                try {
                    // Clear existing extrusions and rebuild at high quality
                    const originalShadowSetting = renderer.shadowMap.enabled;
                    renderer.shadowMap.enabled = true;
                    
                    // Apply memory optimizations
                    THREE.Cache.enabled = true; // Enable caching
                    
                    // Reset progress before starting
                    exportSettings.progressCallback(0); 
                    
                    console.log("Starting high-quality SVG parse for export...");
                    parseSVGForExtrusion(lastSvgData, false, 1.0, true); // isExporting = true
                    console.log("Finished high-quality SVG parse.");
                    
                    // Update progress message after parsing completes
                    exportSettings.progressCallback(50); // Update progress after parsing
                    if (progressText) progressText.textContent = 'Performing CSG Union...';
                    
                    // Use setTimeout to let UI update before heavy CSG/STL generation
                    setTimeout(() => {
                        try {
                            console.log("Preparing export object (CSG Union)...");
                            const exportObject = prepareExportGroup(); // This now returns a Mesh or Group (if CSG fails/unavailable)
                            console.log("Export object prepared. Generating STL...");
                            
                            if (!exportObject) {
                                throw new Error("Failed to prepare model for export (prepareExportGroup returned null).");
                            }

                             // Update progress after CSG
                            exportSettings.progressCallback(90);
                            if (progressText) progressText.textContent = 'Generating STL file...';


                            // Use binary STL with higher precision
                            const exporter = new THREE.STLExporter();
                            const result = exporter.parse(exportObject, { // Pass the single mesh or fallback group
                                binary: true,
                                maxDecimalPrecision: 10
                            });
                            console.log("STL generated. Creating download link...");

                            // Create and trigger download
                            const blob = new Blob([result], { type: 'application/octet-stream' });
                            const link = document.createElement('a');
                            link.style.display = 'none'; // Hide the link
                            document.body.appendChild(link); // Append link to body for Firefox compatibility
                            
                            link.href = URL.createObjectURL(blob);
                            link.download = 'brick_with_extrusion_combined.stl'; // Changed filename
                            link.click();
                            
                            console.log("Download triggered.");

                            // Final progress update
                            exportSettings.progressCallback(100);

                            // Clean up
                            setTimeout(() => {
                                URL.revokeObjectURL(link.href);
                                if (link.parentNode) link.parentNode.removeChild(link);
                                console.log("Blob URL revoked and link removed.");

                                // Dispose geometry/material of the combined mesh or fallback group
                                exportObject.traverse((child) => {
                                    if (child.geometry) child.geometry.dispose();
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
                                });
                                // If it was the single mesh, dispose its geometry/material directly too
                                if (exportObject.isMesh && exportObject.geometry) exportObject.geometry.dispose();
                                if (exportObject.isMesh && exportObject.material) exportObject.material.dispose();

                                console.log("Export object resources disposed.");

                            }, 100);

                            // Reset state AFTER cleanup timeout starts
                            isHighQualityMode = false;
                            if (!isUserInteracting && lastSvgData) {
                                console.log("Returning to interactive quality rendering...");
                                // Schedule return to interactive quality to avoid blocking download finalization
                                setTimeout(() => parseSVGForExtrusion(lastSvgData, false, maxInteractiveQuality), 200);
                            }
                            renderer.shadowMap.enabled = originalShadowSetting;
                            THREE.Cache.clear();
                            loadingElement.innerHTML = 'Loading...';
                            loadingElement.classList.add('hidden');

                        } catch (exportError) {
                            console.error('Error during CSG/STL generation or download:', exportError);
                            alert(`Error generating combined STL file: ${exportError.message}. Please check console for details.`);
                            isHighQualityMode = false;
                            loadingElement.innerHTML = 'Loading...';
                            loadingElement.classList.add('hidden');
                            THREE.Cache.clear();
                        }
                    }, 100); // Timeout before CSG/STL generation
                } catch (renderError) {
                    console.error('Error during high-quality rendering for export:', renderError);
                    alert(`Error preparing model for export: ${renderError.message}. Please check console for details.`);
                    isHighQualityMode = false;
                    loadingElement.innerHTML = 'Loading...';
                    loadingElement.classList.add('hidden');
                    THREE.Cache.clear();
                }
            } else {
                // No SVG data, just export the brick and triangles (CSG still preferred)
                 if (progressText) progressText.textContent = 'Performing CSG Union (Brick/Triangles)...';
                 try {
                    console.log("Preparing export group for brick/triangles only (CSG)...");
                    const exportObject = prepareExportGroup(); // Will attempt CSG on brick+triangles

                     if (!exportObject) {
                        throw new Error("Failed to prepare brick/triangle model for export.");
                    }

                    if (progressText) progressText.textContent = 'Generating STL file...';
                    console.log("Generating STL for combined brick/triangles...");
                    const exporter = new THREE.STLExporter();
                    const result = exporter.parse(exportObject, { binary: true });
                    console.log("STL generated. Creating download link...");

                    // Create and trigger download
                    const blob = new Blob([result], { type: 'application/octet-stream' });
                    const link = document.createElement('a');
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.href = URL.createObjectURL(blob);
                    link.download = 'brick_combined.stl'; // Changed filename
                    link.click();
                    console.log("Download triggered.");


                    // Clean up
                    setTimeout(() => {
                        URL.revokeObjectURL(link.href);
                         if (link.parentNode) link.parentNode.removeChild(link);
                        console.log("Blob URL revoked and link removed.");
                        // Dispose resources
                         exportObject.traverse((child) => {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(m => m.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        });
                         if (exportObject.isMesh && exportObject.geometry) exportObject.geometry.dispose();
                         if (exportObject.isMesh && exportObject.material) exportObject.material.dispose();
                    }, 100);

                    isHighQualityMode = false;
                    loadingElement.innerHTML = 'Loading...';
                    loadingElement.classList.add('hidden');

                 } catch(brickExportError) {
                     console.error('Error exporting combined brick only:', brickExportError);
                     alert(`Error exporting combined brick: ${brickExportError.message}.`);
                     isHighQualityMode = false;
                     loadingElement.innerHTML = 'Loading...';
                     loadingElement.classList.add('hidden');
                 }
            }
        }, 100); // Timeout before high-quality render/CSG
    } catch (error) {
        console.error('Error setting up STL export:', error);
        alert(`Error setting up export: ${error.message}.`);
        document.getElementById('loading').innerHTML = 'Loading...';
        document.getElementById('loading').classList.add('hidden');
        isHighQualityMode = false;
        THREE.Cache.clear();
    }
}

// Handle window resize
function onWindowResize() {
    const container = document.getElementById('three-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Only update controls when needed
    if (controls.enabled) {
        controls.update();
    }
    
    renderer.render(scene, camera);
}

// Initialize the application when the page loads
window.addEventListener('DOMContentLoaded', function() {
    init();
    // Ensure setupUIControls is called after init
    // if (document.getElementById('extrusionX')) { // Check might be redundant now
        setupUIControls();
    // }

    // Optional: Add FPS counter for performance monitoring
    /*
    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
    */
});
