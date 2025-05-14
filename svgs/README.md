# SVG Gallery Directory

This directory contains SVG files for use with StampForge.

## Adding SVGs to the Gallery

1. Place your SVG files in this directory or subdirectories
2. Run `npm run scan` from the project root to update the gallery data
3. Refresh the StampForge application in your browser to see your SVGs

## Gallery JSON Format

The gallery data is stored in `gallery.json` in the following format:

```json
{
  "lastUpdated": "2023-11-15T12:34:56.789Z",
  "svgs": [
    {
      "name": "example.svg",
      "path": "svgs/example.svg",
      "size": 1234,
      "modified": "2023-11-15T12:34:56.789Z",
      "url": "svgs/example.svg"
    }
  ],
  "models": [
    {
      "name": "example.stl",
      "path": "models/example.stl",
      "size": 5678,
      "modified": "2023-11-15T12:34:56.789Z", 
      "url": "models/example.stl"
    }
  ]
}
```

## Troubleshooting

- If SVGs don't appear in the gallery, make sure they are valid SVG files
- Try running `npm run scan` to refresh the gallery data
- Check the console for any error messages
