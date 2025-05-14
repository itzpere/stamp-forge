/**
 * Debug utilities for StampForge
 */

// Global debug namespace
window.StampForgeDebug = window.StampForgeDebug || {};

// Debug levels
const DEBUG_LEVELS = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    VERBOSE: 4
};

// Current debug level - change to adjust verbosity
let currentDebugLevel = DEBUG_LEVELS.ERROR;

// Debug functions
window.StampForgeDebug = {
    // Set debug level
    setLevel: function(level) {
        if (typeof level === 'string') {
            const levelUpper = level.toUpperCase();
            if (DEBUG_LEVELS[levelUpper] !== undefined) {
                currentDebugLevel = DEBUG_LEVELS[levelUpper];
                console.log(`Debug level set to ${level} (${currentDebugLevel})`);
            } else {
                console.error(`Invalid debug level: ${level}`);
            }
        } else if (typeof level === 'number') {
            if (level >= 0 && level <= 4) {
                currentDebugLevel = level;
                console.log(`Debug level set to ${level}`);
            } else {
                console.error(`Invalid debug level number: ${level}`);
            }
        }
    },
    
    // Logging functions
    error: function(message, ...args) {
        if (currentDebugLevel >= DEBUG_LEVELS.ERROR) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    },
    
    warn: function(message, ...args) {
        if (currentDebugLevel >= DEBUG_LEVELS.WARN) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },
    
    info: function(message, ...args) {
        if (currentDebugLevel >= DEBUG_LEVELS.INFO) {
            console.info(`[INFO] ${message}`, ...args);
        }
    },
    
    verbose: function(message, ...args) {
        if (currentDebugLevel >= DEBUG_LEVELS.VERBOSE) {
            console.log(`[VERBOSE] ${message}`, ...args);
        }
    },
    
    // UI debugging
    checkElement: function(id) {
        const element = document.getElementById(id);
        if (element) {
            console.log(`Element #${id} found:`, element);
            return true;
        } else {
            console.error(`Element #${id} not found in DOM`);
            return false;
        }
    },
    
    checkElements: function(...ids) {
        const results = {};
        for (const id of ids) {
            results[id] = this.checkElement(id);
        }
        return results;
    },
    
    // Event debugging
    debugEvent: function(element, eventType) {
        if (!element) {
            console.error("Cannot debug events on null element");
            return;
        }
        
        console.log(`Adding ${eventType} debug event to`, element);
        
        element.addEventListener(eventType, function(event) {
            console.log(`Event '${eventType}' triggered on`, this, event);
        });
    },
    
    // Enable UI debugging mode - adds debug clicks to important UI elements
    enableUIDebug: function() {
        console.log("Enabling UI debug mode");
        const importantElements = [
            'configBtn', 'configModal', 'applyConfigBtn', 'resetConfigBtn',
            'downloadSTL', 'svgUpload', 'topView', 'sideView'
        ];
        
        for (const id of importantElements) {
            const element = document.getElementById(id);
            if (element) {
                this.debugEvent(element, 'click');
            }
        }
        
        console.log("UI debug mode enabled");
    }
};

// Create global aliases
window.debug = window.StampForgeDebug;
window.dbg = window.StampForgeDebug;

// Enable error logging by default
console.log("Debug utilities loaded");
