![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/MB-999/query-lens?utm_source=oss&utm_medium=github&utm_campaign=MB-999%2Fquery-lens&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

# QueryLens

A browser extension to view and manipulate URL query parameters, available for Chrome and Safari.

The extension is privacy-focused - it only manipulates URL query strings locally without any data collection.

## Safari 
 <img width="814" height="521" alt="image" src="https://github.com/user-attachments/assets/51557f82-6d8a-40a7-b588-a7be8ac4fdca" /> 
 <img width="566" height="551" alt="image" src="https://github.com/user-attachments/assets/ae1ee217-e159-4637-ac57-31b0c8fee6f3" />
 
## Chrome (with DevTools)
<img width="564" height="544" alt="image" src="https://github.com/user-attachments/assets/7e60a8d8-5c70-47d7-9c15-faac958c50b3" />
<img width="572" height="537" alt="image" src="https://github.com/user-attachments/assets/131a60d4-b7f8-4640-b796-4570b436d894" />

## Features

- **Quick Access**: Click the extension icon to view all query parameters in the current URL
- **Parameter Management**: Add, edit, reorder, or remove query parameters with an intuitive interface
- **URL Navigation**: Apply changes and navigate to the modified URL instantly
- **Copy Functionality**: Copy the modified URL or individual parameters to clipboard
- **DevTools Integration**: Chrome version includes a dedicated DevTools panel for enhanced workflow

## Project Structure

```text
query-lens/
├── src/                     # TypeScript source code & assets
│   ├── shared/              # Shared resources for both browsers
│   │   ├── query-lens.ts    # Core QueryLens class
│   │   ├── types.ts         # Type definitions
│   │   ├── popup.html       # Popup interface
│   │   ├── styles.css       # Main styling
│   │   ├── manifest.json    # Manifest V3 (both browsers)
│   │   ├── icons/           # Extension icons
│   │   └── query-lens.test.ts # Unit tests
│   ├── chrome/              # Chrome-specific code only
│   │   ├── popup.ts         # Chrome initialization
│   │   ├── background.ts    # Chrome service worker
│   │   ├── devtools.ts      # DevTools entry point
│   │   ├── devtools-panel.ts # DevTools panel logic
│   │   ├── devtools.html    # DevTools entry
│   │   ├── devtools-panel.html # DevTools panel interface
│   │   └── devtools-styles.css # DevTools styling
│   └── safari/              # Safari-specific code only
│       ├── popup.ts         # Safari initialization
│       └── background.ts    # Safari service worker
├── dist/                    # TypeScript compilation & extension builds
│   ├── chrome-extension/    # Chrome extension build (self-contained)
│   └── safari-extension/    # Safari extension build (self-contained)
├── tsconfig.json            # TypeScript configuration
├── build.js                 # Build script
└── README.md               # This file
```

## Development

### Prerequisites

- Node.js and pnpm
- TypeScript

### Setup

```bash
pnpm install
```

### Build

```bash
pnpm build        # Compile TypeScript and create dist builds
pnpm build:ts     # Compile TypeScript only
```

### Testing

```bash
pnpm test             # Run tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
```

The project now uses a unified TypeScript codebase with platform-specific builds generated automatically.

## Installation

### Chrome Version

1. Build the project: `pnpm run build` (or use pre-built extension from /dist/chrome-extension)
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `dist/chrome-extension` directory
5. The QueryLens icon will appear in your toolbar

### Safari Version

1. Build the project: `pnpm run build` (or use pre-built extension from /dist/safari-extension)
2. Open Safari and go to Safari > Preferences > Extensions
3. Enable "Allow Unsigned Extensions" (for development)
4. Click "Add Temporary Extension" and select the `dist/safari-extension` directory
5. Enable the QueryLens extension

## Usage

1. Navigate to any webpage with query parameters
2. Click the QueryLens extension icon in your browser toolbar
3. View, edit, reorder, or remove query parameters
4. Click "Apply Changes" to navigate to the modified URL
5. Use "Copy URL" or individual "copy" buttons to copy URLs or parameters to clipboard

### Chrome-Specific Features

- **DevTools Panel**: Access QueryLens directly from Chrome DevTools for seamless development workflow

## Browser Differences

| Feature                | Chrome     | Safari     |
| ---------------------- | ---------- | ---------- |
| Popup Interface        | ✅         | ✅         |
| DevTools Panel         | ✅         | ❌         |
| Drag & Drop Reordering | ✅         | ✅         |
| Manifest Version       | v3         | v3         |
| API                    | `chrome.*` | `chrome.*` |

## Sponsor My Opensource Work

[GitHub Sponsors](https://github.com/sponsors/MB-999)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes in the appropriate version directory
4. Test thoroughly in the target browser
5. Submit a pull request

## License

MIT License
