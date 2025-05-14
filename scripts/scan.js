#!/usr/bin/env node

const GalleryScanner = require('../js/gallery/galleryScanner');

/**
 * CLI script to scan SVG gallery and models
 */
async function runScan() {
  console.log('Starting gallery and models scan...');
  
  try {
    const scanner = new GalleryScanner();
    const results = await scanner.scanAll();
    
    console.log('\n===== Scan Complete =====');
    console.log(`Found ${results.svgs.length} SVG files`);
    if (results.svgs.length > 0) {
      console.log('SVG files:');
      results.svgs.forEach(file => {
        console.log(`  - ${file.relativePath} (${formatFileSize(file.size)})`);
      });
    }
    
    console.log(`\nFound ${results.models.length} model files`);
    if (results.models.length > 0) {
      console.log('Model files:');
      results.models.forEach(file => {
        console.log(`  - ${file.relativePath} (${formatFileSize(file.size)})`);
      });
    }
    
    // Save the results to JSON
    const jsonPath = await scanner.saveResultsToJson();
    console.log(`\nGallery data saved to: ${jsonPath}`);
    
    console.log('\nScan completed successfully');
  } catch (error) {
    console.error('Error running scan:', error);
    process.exit(1);
  }
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Run the scan
runScan();
