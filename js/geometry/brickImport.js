function createBaseImportUI() {
    
    const resetButton = document.getElementById('resetBaseBtn');
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            clearExistingObjects();
            defaultBaseLoaded = false;
            loadDefaultStampBase();
        });
    }
    
    const baseSTLInput = document.getElementById('stampBaseSTL');
    if (baseSTLInput) {
        baseSTLInput.addEventListener('change', importStampBase);
    }
    
    const designSTLInput = document.getElementById('designSTL');
    if (designSTLInput) {
        designSTLInput.addEventListener('change', importSTLDesign);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    createBaseImportUI();
});
