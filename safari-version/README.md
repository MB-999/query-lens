# Safari Version

## Development

### Loading for Development

1. Safari > Preferences > Extensions
2. Enable "Allow Unsigned Extensions"
3. Click "+" and select this directory
4. Enable the QueryLens extension

### Safari Limitations

- No DevTools panel support
- Limited drag-and-drop functionality
- Manifest v2 format required

### Technical Notes

- Uses `browser.*` API instead of `chrome.*`
- Background script (not service worker)
- Simplified parameter reordering interface

### Safari-Specific Considerations

- Extension must be manually enabled after installation
- Requires "Allow Unsigned Extensions" for development
- Different permission model than Chrome

### Safari Security Warning

Safari will display a warning that this extension:

"This extension can read and alter web pages you visit and see your browsing history on all websites. This includes sensitive information from web pages, including passwords, phone numbers and credit cards."

- The extension only reads the current page's URL to extract query parameters
- It does not access page content, browsing history, or sensitive data
- The warning appears because Safari requires `activeTab` permissions to access the current URL
- QueryLens operates entirely on URL query strings, not webpage content.
