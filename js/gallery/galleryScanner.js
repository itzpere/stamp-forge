const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);

class GalleryScanner {
  constructor(options = {}) {
    this.options = {
      svgDir: path.join(process.cwd(), 'svgs'),
      modelsDir: path.join(process.cwd(), 'models'),
      maxDepth: 3,
      galleryJsonPath: path.join(process.cwd(), 'svgs', 'gallery.json'),
      ...options
    };
    
    this.results = {
      svgs: [],
      models: []
    };
  }
  
  async scanDir(dir, extensions, maxDepth = this.options.maxDepth, currentDepth = 0) {
    if (currentDepth > maxDepth) return [];
    
    try {
      const files = await readdir(dir);
      let results = [];
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const fileStat = await stat(filePath);
        
        if (fileStat.isDirectory()) {
          const subResults = await this.scanDir(
            filePath, 
            extensions, 
            maxDepth, 
            currentDepth + 1
          );
          results = results.concat(subResults);
        } else {
          const ext = path.extname(file).toLowerCase();
          if (extensions.includes(ext)) {
            results.push({
              name: file,
              path: filePath,
              relativePath: path.relative(process.cwd(), filePath),
              size: fileStat.size,
              modified: fileStat.mtime
            });
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error);
      return [];
    }
  }
  
  async scanSVGs() {
    this.results.svgs = await this.scanDir(this.options.svgDir, ['.svg']);
    return this.results.svgs;
  }
  
  async scanModels() {
    this.results.models = await this.scanDir(
      this.options.modelsDir, 
      ['.stl', '.obj', '.3mf', '.glb', '.gltf']
    );
    return this.results.models;
  }
  
  async scanAll() {
    await Promise.all([
      this.scanSVGs(),
      this.scanModels()
    ]);
    
    return this.results;
  }
  
  async saveResultsToJson() {
    try {
      const jsonContent = {
        lastUpdated: new Date().toISOString(),
        svgs: this.results.svgs.map(file => ({
          name: file.name,
          path: file.relativePath,
          size: file.size,
          modified: file.modified,
          url: file.relativePath.replace(/\\/g, '/')
        })),
        models: this.results.models.map(file => ({
          name: file.name,
          path: file.relativePath,
          size: file.size,
          modified: file.modified,
          url: file.relativePath.replace(/\\/g, '/')
        }))
      };
      
      const dir = path.dirname(this.options.galleryJsonPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      await writeFile(
        this.options.galleryJsonPath, 
        JSON.stringify(jsonContent, null, 2)
      );
      
      console.log(`Gallery data saved to ${this.options.galleryJsonPath}`);
      
      const rootCopyPath = path.join(process.cwd(), 'gallery.json');
      await writeFile(rootCopyPath, JSON.stringify(jsonContent, null, 2));
      console.log(`Gallery data also saved to ${rootCopyPath} for web access`);
      
      return this.options.galleryJsonPath;
    } catch (error) {
      console.error(`Error saving gallery to JSON:`, error);
      throw error;
    }
  }
  
  async scanAllAndSave() {
    await this.scanAll();
    return this.saveResultsToJson();
  }
}

module.exports = GalleryScanner;
