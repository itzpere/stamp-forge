# StampForge 

**⚠️ ALPHA VERSION:** This tool is currently under active development

StampForge is an open-source tool for creating 3D models from SVG files, designed for easy 3D printing of custom stamps and similar objects.

![StampForge Screenshot](stampForge.jpg)

## 👤 Author

**Created by Petar Miletić** - [github.com/itzpere](https://github.com/itzpere)

## 🔴 Essential Downloads

**[DOWNLOAD STAMP HOLDER](https://www.printables.com/model/1285748-stampforge-customizable-svg-to-stamp)** - This holder is required to use your created stamps

## Features

- Import SVG files and convert them to 3D models
- Adjust extrusion scale on working plane
- Position the extrusion on the stamp base
- View models in real-time 3D
- Export models as STL files for 3D printing
- Browse the SVG gallery to quickly select designs

## Camera Controls

The application provides several ways to view your stamp:

- **Orbit Controls**: Click and drag to rotate the view
- **Top View**: View the stamp from directly above (perpendicular to the stamp face)
- **Side View**: View the stamp from the side to check height and positioning
- The camera starts in a rotated view (180 degrees) for better model visualization

## UI Sections

The application is divided into several control sections:

### Design Section
- Upload SVG designs
- Scale your design
- Position your design on the base
- Toggle automatic Y-offset

### Base Section
- Choose from different base designs
- Rotate the base along X, Y, and Z axes

### Options Section
- Download STL files
- Access to camera view controls (Top and Side views)
- Configuration options

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/itzpere/stamp-forge.git
   cd stamp-forge
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

1. **Upload an SVG**: Use the upload button to select an SVG file from your computer
2. **Customize**: 
   - Adjust the extrusion height
   - Set the scale to size the design
   - Position the design on the stamp base using the X, Y, Z offset controls
3. **Preview**: Rotate, pan, and zoom to inspect your 3D model
4. **Export**: Click "Download STL" to export your model for 3D printing

## Printing Tips

For best results when 3D printing your stamps:

- **Enable ironing** on top-most surfaces in your slicer for a smooth finish on the stamp face
- Use a relatively high infill (40%+) for durability
- Consider printing with a flexible material for better stamping results
- A shore hardness of 95A works well for most stamping applications

## ⚠️ Known Issues

- **Positioning System Instability:** The positioning system in the current alpha version is unstable. If you experience issues, try refreshing the page.
- This is an alpha version with ongoing development to improve stability and features

## Additional Resources

- [Printables Page](https://www.printables.com/model/1285748-stampforge-customizable-svg-to-stamp) - See examples and share your prints
- [Onshape Design](https://cad.onshape.com/documents/b8df565e3ee5bf1496f24090/w/ae81aeeee47b9edd37d47bd6/e/7bbac46e537c734a00283271?renderMode=0&uiState=6817b59c4f958a65368d6c7d) - View and modify the source CAD
- [SVG Repo](https://www.svgrepo.com/) - Free SVG icons and vectors
- [SVG Repo](https://www.svgrepo.com/collection/chunk-16px-thick-interface-icons/) - Chunk 16px

## SVG Gallery

StampForge includes a built-in SVG gallery. To use it:

1. Add SVG files to the `/svgs` directory in the project root.
2. Run the gallery scanner script to update the gallery index:
   ```
   npm run scan
   ```
3. Refresh the StampForge application in your browser. The gallery should now show your added SVGs.
4. Click on any SVG thumbnail to load it into the editor.

## Contact & Support

If you encounter any issues or have questions, please reach out through:

- **Email**: [04.petar.miletic@gmail.com](mailto:04.petar.miletic@gmail.com)
- **GitHub**: [Project Repository](https://github.com/itzpere/stamp-forge)
- **Printables**: You can also contact me through Printables messages
- **Bug Reports**: Please report any issues via email or GitHub

## Acknowledgments

- Three.js for 3D rendering
- SVGLoader for SVG parsing and conversion
- three-csg-ts for Constructive Solid Geometry (CSG) operations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Development Status

This project is currently in **ALPHA** status. I am actively working on:

- Improving positioning stability
- Adding more features
- Enhancing user experience
- Fixing bugs

Feedback and bug reports are very welcome!
