const express = require('express');
const router = express.Router();
const scanGalleryHandler = require('./scanGallery');

// Define your API routes here
router.get('/scan-gallery', scanGalleryHandler);

module.exports = router;