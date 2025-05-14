function populateShapeList() {
    if (window.shapeRenderInfo && window.shapeRenderInfo.length < 10 && window.shapeRenderInfo.length > 0) {
        try {
            const simplifiedInfo = window.shapeRenderInfo.map(item => ({ id: item.id, name: item.name, isVisible: item.isVisible }));
        } catch (e) {
        }
    }

    const shapeListContent = document.getElementById('shapeListContent');
    if (!shapeListContent) {
        return;
    }
    const noShapesMessage = shapeListContent.querySelector('.no-shapes-message');

    const childrenToRemove = [];
    for (let i = 0; i < shapeListContent.children.length; i++) {
        const child = shapeListContent.children[i];
        if (child !== noShapesMessage) {
            childrenToRemove.push(child);
        }
    }
    childrenToRemove.forEach(child => shapeListContent.removeChild(child));

    if (!window.shapeRenderInfo || window.shapeRenderInfo.length === 0) {
        if (noShapesMessage) {
            noShapesMessage.style.display = 'block';
        }
        return;
    }

    if (noShapesMessage) noShapesMessage.style.display = 'none';

    window.shapeRenderInfo.forEach((shapeInfo, index) => {
        if (!shapeInfo || typeof shapeInfo.id === 'undefined' || !shapeInfo.mesh) {
            return;
        }

        const listItem = document.createElement('div');
        listItem.className = 'shape-list-item';
        listItem.dataset.shapeId = shapeInfo.id;

        const mainControlsContainer = document.createElement('div');
        mainControlsContainer.className = 'shape-main-controls';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `shape-visible-${shapeInfo.id}`;
        checkbox.checked = shapeInfo.isVisible;
        checkbox.title = "Toggle visibility";
        checkbox.addEventListener('change', () => {
            shapeInfo.isVisible = checkbox.checked;
            if (shapeInfo.mesh) { 
                shapeInfo.mesh.visible = checkbox.checked;
            }
        });

        const label = document.createElement('label');
        label.htmlFor = `shape-visible-${shapeInfo.id}`;
        label.textContent = shapeInfo.name;
        label.title = shapeInfo.name;

        const deleteButton = document.createElement('button');
        deleteButton.textContent = '✕';
        deleteButton.className = 'shape-delete-button';
        deleteButton.title = "Delete shape";
        deleteButton.addEventListener('click', () => {
            if (shapeInfo.mesh) {
                if (shapeInfo.mesh.parent) {
                    shapeInfo.mesh.parent.remove(shapeInfo.mesh);
                }
                if (shapeInfo.mesh.geometry) shapeInfo.mesh.geometry.dispose();
                if (shapeInfo.mesh.material) {
                    if (Array.isArray(shapeInfo.mesh.material)) {
                        shapeInfo.mesh.material.forEach(m => m.dispose());
                    } else {
                        shapeInfo.mesh.material.dispose();
                    }
                }
            }
            const currentIndex = window.shapeRenderInfo.findIndex(item => item.id === shapeInfo.id);
            if (currentIndex > -1) {
                window.shapeRenderInfo.splice(currentIndex, 1);
            }
            populateShapeList();
        });

        mainControlsContainer.appendChild(checkbox);
        mainControlsContainer.appendChild(label);
        mainControlsContainer.appendChild(deleteButton);

        const advancedControlsContainer = document.createElement('div');
        advancedControlsContainer.className = 'shape-advanced-controls';

        // Add position controls section
        const positionControlsContainer = document.createElement('div');
        positionControlsContainer.className = 'shape-position-controls';
        
        // Position label
        const positionLabel = document.createElement('span');
        positionLabel.textContent = "Position: ";
        positionLabel.className = 'shape-control-label';
        positionControlsContainer.appendChild(positionLabel);
        
        // Position X input
        const posXContainer = document.createElement('div');
        posXContainer.className = 'shape-position-input-container';
        const posXLabel = document.createElement('label');
        posXLabel.textContent = 'X:';
        posXLabel.htmlFor = `shape-pos-x-${shapeInfo.id}`;
        const posXInput = document.createElement('input');
        posXInput.type = 'number';
        posXInput.className = 'shape-position-input';
        posXInput.id = `shape-pos-x-${shapeInfo.id}`;
        posXInput.step = '0.1';
        posXInput.value = shapeInfo.mesh.position.x.toFixed(1);
        posXInput.addEventListener('change', () => {
            updateShapePosition(shapeInfo.id, 'x', parseFloat(posXInput.value));
        });
        posXContainer.appendChild(posXLabel);
        posXContainer.appendChild(posXInput);
        positionControlsContainer.appendChild(posXContainer);
        
        // Position Y input
        const posYContainer = document.createElement('div');
        posYContainer.className = 'shape-position-input-container';
        const posYLabel = document.createElement('label');
        posYLabel.textContent = 'Y:';
        posYLabel.htmlFor = `shape-pos-y-${shapeInfo.id}`;
        const posYInput = document.createElement('input');
        posYInput.type = 'number';
        posYInput.className = 'shape-position-input';
        posYInput.id = `shape-pos-y-${shapeInfo.id}`;
        posYInput.step = '0.1';
        posYInput.value = shapeInfo.mesh.position.y.toFixed(1);
        posYInput.addEventListener('change', () => {
            updateShapePosition(shapeInfo.id, 'y', parseFloat(posYInput.value));
        });
        posYContainer.appendChild(posYLabel);
        posYContainer.appendChild(posYInput);
        positionControlsContainer.appendChild(posYContainer);
        
        // Position Z input
        const posZContainer = document.createElement('div');
        posZContainer.className = 'shape-position-input-container';
        const posZLabel = document.createElement('label');
        posZLabel.textContent = 'Z:';
        posZLabel.htmlFor = `shape-pos-z-${shapeInfo.id}`;
        const posZInput = document.createElement('input');
        posZInput.type = 'number';
        posZInput.className = 'shape-position-input';
        posZInput.id = `shape-pos-z-${shapeInfo.id}`;
        posZInput.step = '0.1';
        posZInput.value = shapeInfo.mesh.position.z.toFixed(1);
        posZInput.addEventListener('change', () => {
            updateShapePosition(shapeInfo.id, 'z', parseFloat(posZInput.value));
        });
        posZContainer.appendChild(posZLabel);
        posZContainer.appendChild(posZInput);
        positionControlsContainer.appendChild(posZContainer);
        
        advancedControlsContainer.appendChild(positionControlsContainer);

        listItem.appendChild(mainControlsContainer);
        listItem.appendChild(advancedControlsContainer);
        shapeListContent.appendChild(listItem);
    });
}

// Add function to update shape position
function updateShapePosition(shapeId, axis, value) {
    const shapeInfo = window.shapeRenderInfo.find(info => info.id === shapeId);
    if (!shapeInfo || !shapeInfo.mesh) {
        console.error(`Shape ID ${shapeId} not found or has no mesh.`);
        return;
    }
    
    // Store original position for reference
    if (!shapeInfo.originalPosition) {
        shapeInfo.originalPosition = {
            x: shapeInfo.mesh.position.x,
            y: shapeInfo.mesh.position.y,
            z: shapeInfo.mesh.position.z
        };
    }
    
    // Update position property
    if (axis === 'x' || axis === 'y' || axis === 'z') {
        shapeInfo.mesh.position[axis] = value;
        
        // Force matrix update
        shapeInfo.mesh.updateMatrix();
        shapeInfo.mesh.updateMatrixWorld(true);
        
        console.log(`Updated shape ${shapeId} ${axis} position to ${value}`);
    }
    
    // Update input fields in case the value was normalized or clamped
    const posInput = document.getElementById(`shape-pos-${axis}-${shapeId}`);
    if (posInput && posInput.value !== shapeInfo.mesh.position[axis].toFixed(1)) {
        posInput.value = shapeInfo.mesh.position[axis].toFixed(1);
    }
}

// Expose function to global scope
window.updateShapePosition = updateShapePosition;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof populateShapeList === 'function') {
        if (typeof window.shapeRenderInfo === 'undefined') {
            window.shapeRenderInfo = [];
        }
        populateShapeList();
    }
});

function regenerateShape(shapeInfo) {
    if (!window.lastSvgData || !shapeInfo.originalPath) {
        return;
    }
    
    if (shapeInfo.mesh && shapeInfo.mesh.parent) {
        shapeInfo.mesh.parent.remove(shapeInfo.mesh);
        
        if (shapeInfo.mesh.geometry) shapeInfo.mesh.geometry.dispose();
        if (shapeInfo.mesh.material) {
            if (Array.isArray(shapeInfo.mesh.material)) {
                shapeInfo.mesh.material.forEach(m => m.dispose());
            } else {
                shapeInfo.mesh.material.dispose();
            }
        }
    }
    
    if (typeof regenerateShapeWithWinding === 'function') {
        // Remove winding property before regeneration
        if (shapeInfo.useReversedWinding !== undefined) {
            delete shapeInfo.useReversedWinding;
        }
        
        regenerateShapeWithWinding(shapeInfo);
    } else {
        parseSVGForExtrusion(window.lastSvgData, false, window.maxInteractiveQuality);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const shapeListPanel = document.getElementById('shapeListPanel');
    if (shapeListPanel) {
        shapeListPanel.style.display = 'block';
    }
    
    setTimeout(function() {
        if (typeof populateShapeList === 'function') {
            populateShapeList();
        }
    }, 500);
});
