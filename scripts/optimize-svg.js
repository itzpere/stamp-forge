/**
 * SVG Optimizer Script
 * This script uses SVGO to optimize SVG files in the svgs directory
 */

const fs = require('fs');
const path = require('path');
const { optimize } = require('svgo');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

// Default SVGO configuration
const svgoConfig = {
  plugins: [
    'preset-default',
    'removeViewBox',
    {
      name: 'convertPathData',
      params: {
        // Make sure we get absolute coordinates for better compatibility
        applyTransforms: true,
        straightCurves: true,
        lineShorthands: true,
        curveSmoothShorthands: true,
        floatPrecision: 3,
        transformPrecision: 3,
        removeUseless: true,
        collapseRepeated: true,
        forceAbsolutePath: true
      }
    },
    {
      name: 'convertShapeToPath',
      params: {
        // Convert basic shapes to paths for better compatibility
        convertShapeToPath: true
      }
    },
    {
      name: 'removeDimensions',
      active: false
    },
    {
      name: 'removeXMLNS',
      active: false
    },
    {
      name: 'cleanupIDs',
      params: {
        // Ensure IDs are preserved
        preserve: true,
        minify: false
      }
    }
  ]
};

// Process a single SVG file
async function processSvgFile(filePath) {
  try {
    console.log(`Processing ${filePath}...`);
    const svgString = await readFile(filePath, 'utf8');
    
    const result = optimize(svgString, {
      path: filePath,
      ...svgoConfig
    });
    
    // Check if optimization was successful
    if (result.error) {
      console.error(`Error optimizing ${filePath}:`, result.error);
      return false;
    }
    
    // Write the optimized SVG back to the file
    await writeFile(filePath, result.data, 'utf8');
    console.log(`Optimized ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

// Process all SVG files in a directory recursively
async function processSvgDirectory(dirPath, maxDepth = 3, currentDepth = 0) {
  if (currentDepth > maxDepth) return;
  
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await processSvgDirectory(fullPath, maxDepth, currentDepth + 1);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.svg') {
        await processSvgFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }
}

// Main function to run the optimizer
async function main() {
  const svgDir = path.join(__dirname, '..', 'svgs');
  console.log(`Starting SVG optimization in ${svgDir}`);
  
  try {
    const exists = await stat(svgDir).then(stats => stats.isDirectory()).catch(() => false);
    
    if (!exists) {
      console.error(`SVG directory ${svgDir} does not exist!`);
      return;
    }
    
    await processSvgDirectory(svgDir);
    console.log('SVG optimization complete');
  } catch (error) {
    console.error('Error during SVG optimization:', error);
  }
}

// Run the script
main();
