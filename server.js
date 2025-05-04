const express = require('express');
const fs = require('fs');
const path = require('path');

// Create express app
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Route to list SVGs in the svgs directory
app.get('/api/list-svgs', (req, res) => {
    const svgsDir = path.join(__dirname, 'svgs');
    
    try {
        // Check if directory exists
        if (!fs.existsSync(svgsDir)) {
            fs.mkdirSync(svgsDir, { recursive: true });
            return res.json({ files: [] });
        }
        
        // Read files from directory
        fs.readdir(svgsDir, (err, files) => {
            if (err) {
                console.error('Error reading SVGs directory:', err);
                return res.status(500).json({ error: 'Failed to read SVGs directory' });
            }
            
            // Filter for SVG files and create response
            const svgFiles = files
                .filter(file => file.toLowerCase().endsWith('.svg'))
                .map(file => ({
                    name: file,
                    path: `/svgs/${file}`
                }));
            
            res.json({ files: svgFiles });
        });
    } catch (error) {
        console.error('Error in list-svgs endpoint:', error);
        res.status(500).json({ error: 'Server error listing SVGs' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`SVG Gallery available at: http://localhost:${PORT}/api/list-svgs`);
});
