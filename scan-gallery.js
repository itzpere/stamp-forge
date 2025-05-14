const fs = require('fs');
const path = require('path');

const svgsDirectory = path.join(__dirname, 'svgs');
const galleryJsonPath = path.join(svgsDirectory, 'gallery.json');

console.log("Starting SVG gallery scan...");

try {
    const files = fs.readdirSync(svgsDirectory);
    
    // Filter out only .svg files and exclude gallery.json itself if it's in the list
    const svgFiles = files.filter(file => 
        file.toLowerCase().endsWith('.svg') && file.toLowerCase() !== 'gallery.json'
    );

    const galleryData = {
        files: svgFiles // Structure expected by gallery.js
    };

    fs.writeFileSync(galleryJsonPath, JSON.stringify(galleryData, null, 2));
    console.log(`Updated gallery.json with ${svgFiles.length} files.`);
    console.log(`Gallery JSON generated successfully at ${galleryJsonPath}`);

} catch (error) {
    console.error('Error generating gallery JSON:', error);
    // Create an empty gallery file in case of error to prevent load failures
    const emptyGalleryData = { files: [] };
    try {
        fs.writeFileSync(galleryJsonPath, JSON.stringify(emptyGalleryData, null, 2));
        console.log(`Created an empty gallery.json at ${galleryJsonPath} due to error.`);
    } catch (writeError) {
        console.error(`Failed to write empty gallery.json:`, writeError);
    }
}
