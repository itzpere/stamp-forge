window.ErrorManager = {
    logError: function(source, error, context = {}) {
        console.error(`[${source}] Error:`, error);
        if (Object.keys(context).length > 0) {
            console.error(`[${source}] Context:`, context);
        }
        
        if (window.errorTrackingService) {
            window.errorTrackingService.captureError(error, {
                source,
                context,
                timestamp: new Date().toISOString()
            });
        }
        
        return error; 
    },
    
    showUserError: function(message, duration = 3000) {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.textContent = message;
            loadingElement.classList.remove('hidden');
            setTimeout(() => {
                loadingElement.classList.add('hidden');
            }, duration);
        } else {
            alert(message); 
        }
    },
    
    handleError: function(source, error, userMessage = null) {
        this.logError(source, error);
        
        const messageToShow = userMessage || `Error: ${error.message || 'Unknown error'}`;
        this.showUserError(messageToShow);
        
        return error; 
    },
    
    wrapWithErrorHandling: function(fn, source) {
        return function(...args) {
            try {
                return fn(...args);
            } catch (error) {
                return ErrorManager.handleError(source, error);
            }
        };
    },
    
    wrapAsyncWithErrorHandling: function(fn, source) {
        return async function(...args) {
            try {
                return await fn(...args);
            } catch (error) {
                return ErrorManager.handleError(source, error);
            }
        };
    }
};
