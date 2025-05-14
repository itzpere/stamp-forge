const GalleryScanner = require('../js/gallery/galleryScanner');

/**
 * API handler for scanning gallery
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function scanGalleryHandler(req, res) {
  try {
    const scanner = new GalleryScanner();
    const results = await scanner.scanAll();
    
    // Save results to JSON file
    const jsonPath = await scanner.saveResultsToJson();
    
    const summary = {
      svgCount: results.svgs.length,
      modelCount: results.models.length,
      timestamp: new Date().toISOString(),
      jsonFilePath: jsonPath,
      results
    };
    
    res.json(summary);
  } catch (error) {
    console.error('Error in scan-gallery API:', error);
    res.status(500).json({ 
      error: 'Failed to scan gallery',
      message: error.message 
    });
  }
}

module.exports = scanGalleryHandler;
