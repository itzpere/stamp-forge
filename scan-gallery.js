const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Convert fs methods to promise-based versions
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);

/**
 * Scans the SVGs directory and updates gallery.json
 */
async function scanSvgGallery() {
  console.log('Starting SVG gallery scan...');
  
  const svgDir = path.join(__dirname, 'svgs');
  const outputFile = path.join(svgDir, 'gallery.json');
  
  try {
    // Make sure the directory exists
    if (!fs.existsSync(svgDir)) {
      fs.mkdirSync(svgDir, { recursive: true });
      console.log(`Created directory: ${svgDir}`);
    }
    
    // Read all files in the directory
    const files = await readdir(svgDir);
    
    // Filter for SVG files only
    const svgFiles = [];
    for (const file of files) {
      // Skip the gallery.json file itself and any dot files
      if (file === 'gallery.json' || file.startsWith('.')) {
        continue;
      }
      
      const filePath = path.join(svgDir, file);
      const fileStat = await stat(filePath);
      
      // Only include files (not directories) with .svg extension
      if (fileStat.isFile() && file.toLowerCase().endsWith('.svg')) {
        svgFiles.push({
          name: file,
          path: `svgs/${file}`,
          // You can optionally check for thumbnails here
          thumbnail: fs.existsSync(path.join(svgDir, 'thumbnails', file.replace('.svg', '.jpg'))) 
            ? `svgs/thumbnails/${file.replace('.svg', '.jpg')}` 
            : null
        });
      }
    }
    
    console.log(`Found ${svgFiles.length} SVG files`);
    
    // Create the gallery JSON object
    const gallery = {
      images: svgFiles,
      lastUpdated: new Date().toISOString()
    };
    
    // Write to gallery.json
    await writeFile(outputFile, JSON.stringify(gallery, null, 2));
    console.log(`Updated gallery.json with ${svgFiles.length} files`);
    
    return {
      count: svgFiles.length,
      files: svgFiles.map(f => f.name)
    };
  } catch (error) {
    console.error('Error scanning gallery:', error);
    throw error;
  }
}

// Export for use in server.js
module.exports = {
  scanSvgGallery
};

// Allow running directly from command line
if (require.main === module) {
  scanSvgGallery()
    .then(result => {
      console.log(`Gallery scan complete. Found ${result.count} SVG files.`);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}
