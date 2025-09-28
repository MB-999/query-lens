![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/MB-999/query-lens?utm_source=oss&utm_medium=github&utm_campaign=MB-999%2Fquery-lens&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

# QueryLens

A browser extension to view and manipulate URL query parameters, available for Chrome and Safari.

The extension is privacy-focused - it only manipulates URL query strings locally without any data collection.

## Features

- **Quick Access**: Click the extension icon to view all query parameters in the current URL
- **Parameter Management**: Add, edit, reorder, or remove query parameters with an intuitive interface
- **URL Navigation**: Apply changes and navigate to the modified URL instantly
- **Copy Functionality**: Copy the modified URL or individual parameters to clipboard
- **DevTools Integration**: Chrome version includes a dedicated DevTools panel for enhanced workflow

## Project Structure

```text
query-lens/
├── chrome-version/          # Chrome extension implementation
│   ├── manifest.json        # Chrome extension manifest (v3)
│   ├── popup.html           # Main popup interface
│   ├── popup.js             # Chrome-specific popup logic
│   ├── devtools.html/js     # DevTools entry point
│   ├── devtools-panel.html/js # DevTools panel interface
│   ├── background.js        # Service worker
│   ├── query-lens.js        # Core logic
│   ├── styles.css           # Main styling
│   ├── devtools-styles.css  # DevTools styling
│   └── icon*.png            # Extension icons
├── safari-version/          # Safari extension implementation
│   ├── manifest.json        # Safari extension manifest (v2)
│   ├── popup.html           # Main popup interface
│   ├── popup.js             # Safari-specific popup logic
│   ├── background.js        # Background script
│   ├── query-lens.js        # Core logic
│   ├── styles.css           # Interface styling
│   └── icon*.png            # Extension icons
└── README.md               # This file
```

## Development

Each version contains its own README with specific development instructions:

- [Chrome Version README](chrome-version/README.md)
- [Safari Version README](safari-version/README.md)

## Installation

### Chrome Version

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `chrome-version` directory
4. The QueryLens icon will appear in your toolbar

### Safari Version

1. Open Safari and go to Safari > Preferences > Extensions
2. Enable "Allow Unsigned Extensions" (for development)
3. Click "Add Temporary Extension" and select the `safari-version` directory
4. Enable the QueryLens extension

## Usage

1. Navigate to any webpage with query parameters
2. Click the QueryLens extension icon in your browser toolbar
3. View, edit, reorder, or remove query parameters
4. Click "Apply Changes" to navigate to the modified URL
5. Use "Copy URL" or individual "copy" buttons to copy URLs or parameters to clipboard

### Chrome-Specific Features

- **DevTools Panel**: Access QueryLens directly from Chrome DevTools for seamless development workflow
- **Advanced Drag & Drop**: Full drag-and-drop support for parameter reordering

## Browser Differences

| Feature                | Chrome     | Safari      |
| ---------------------- | ---------- | ----------- |
| Popup Interface        | ✅         | ✅          |
| DevTools Panel         | ✅         | ❌          |
| Drag & Drop Reordering | ✅         | Limited     |
| Manifest Version       | v3         | v2          |
| API                    | `chrome.*` | `browser.*` |

## Sponsor My Opensource Work

[GitHub Sponsors](https://github.com/sponsors/MB-999)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes in the appropriate version directory
4. Test thoroughly in the target browser
5. Submit a pull request

## License

MIT License - see individual version directories for specific license files.
