# Chrome Version

## Development

### Loading for Development
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory

### DevTools Panel
The Chrome version includes a DevTools panel accessible via:
1. Open Chrome DevTools (F12)
2. Navigate to the "QueryLens" tab

### Technical Notes
- Uses Manifest v3
- Service worker background script
- Full drag-and-drop support for parameter reordering
- Chrome-specific APIs (`chrome.*`)

### Key Files
- `devtools.html/js` - DevTools integration entry point
- `devtools-panel.html/js` - DevTools panel interface
- `devtools-styles.css` - DevTools-specific styling
