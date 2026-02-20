# Building Executable with Obfuscation and Prisma

This guide explains how to build the Cold Storage application as a standalone Windows executable with code obfuscation and Prisma support.

## Prerequisites

Before building, ensure you have:
- Node.js (v18 or higher)
- PostgreSQL database
- All dependencies installed: `npm install`

## Build Process

### 1. Install Build Dependencies

```bash
npm install --save-dev pkg javascript-obfuscator
```

### 2. Generate Prisma Client

```bash
npm run prisma:generate
```

### 3. Build the Executable

```bash
npm run build:exe
```

This command will:
1. Compile TypeScript to JavaScript
2. Obfuscate the compiled code
3. Generate Prisma client
4. Package everything into an executable
5. Copy necessary files to the build directory

## Build Output

The build process creates a `build/` directory containing:

```
build/
├── cold-storage.exe      # Main executable
├── .env.example          # Environment configuration template
├── setup.bat             # Setup script for first-time configuration
├── README.txt            # User instructions
├── fonts/                # Font files (if any)
└── logo/                 # Logo files (if any)
```

## Obfuscation

The code obfuscation process applies:
- Control flow flattening
- Dead code injection
- String array encoding (base64)
- Identifier name mangling
- Self-defending code
- And more security features

Configuration can be adjusted in `scripts/obfuscate.js`.

## Prisma Configuration

The application is configured to work with Prisma in both development and production (exe) modes:

### Development Mode
- Uses `.env` file from project root
- Prisma client loads from `node_modules`

### Production Mode (EXE)
- Looks for `.env` file in the same directory as the executable
- Prisma client is bundled within the executable
- Prisma engines are included as assets

## Distribution

To distribute the application:

1. **Package the build directory**: Zip the entire `build/` folder
2. **Provide to users**: Send the zip file to end users
3. **Installation instructions**:
   - Extract the zip file
   - Run `setup.bat` to configure the `.env` file
   - Edit `.env` with database credentials
   - Run `cold-storage.exe` to start the application

## Environment Configuration

### For End Users

After building, users must configure their environment:

1. **Run setup.bat**: Double-click `setup.bat` in the build directory
2. **Edit .env file**: Configure the following variables:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/coldstorage
PORT=3000
NODE_ENV=production
JWT_SECRET=your-secure-secret-key
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

3. **Run the application**: Double-click `cold-storage.exe`

### Environment Variables

- **DATABASE_URL**: PostgreSQL connection string
- **PORT**: Server port (default: 3000)
- **NODE_ENV**: Environment mode (production for exe)
- **JWT_SECRET**: Secret key for JWT authentication
- **PUPPETEER_EXECUTABLE_PATH**: Path to Chrome browser (optional, for PDF generation)

## Troubleshooting

### Database Connection Issues

If the application can't connect to the database:
1. Check the `DATABASE_URL` in `.env`
2. Ensure PostgreSQL is running
3. Verify credentials are correct

### Prisma Errors

If you encounter Prisma-related errors:
1. Ensure Prisma client was generated before building: `npm run prisma:generate`
2. Check that the generated client is in `src/generated/client/`
3. Rebuild the executable: `npm run build:exe`

### .env File Not Found

If the application warns about missing `.env`:
1. Run `setup.bat` from the same directory as the exe
2. Or manually copy `.env.example` to `.env` and edit it

### PDF Generation Issues

If PDF generation fails:
1. Install Google Chrome
2. Set `PUPPETEER_EXECUTABLE_PATH` in `.env` to Chrome's location
3. Restart the application

## Advanced Configuration

### Custom Build Target

To build for different platforms, edit `package.json`:

```json
"pkg": {
  "targets": [
    "node18-win-x64",    // Windows 64-bit
    "node18-linux-x64",  // Linux 64-bit
    "node18-macos-x64"   // macOS 64-bit
  ]
}
```

### Including Additional Assets

To include more files in the executable, edit the `assets` array in `package.json`:

```json
"pkg": {
  "assets": [
    "src/generated/**/*",
    "node_modules/.prisma/**/*",
    "node_modules/@prisma/client/**/*",
    "node_modules/@prisma/engines/**/*",
    "fonts/**/*",
    "logo/**/*",
    ".env.example",
    "path/to/your/assets/**/*"
  ]
}
```

### Adjusting Obfuscation

To modify obfuscation settings, edit `scripts/obfuscate.js` and adjust the options passed to `JavaScriptObfuscator.obfuscate()`.

## Security Notes

1. **Never include `.env` in the build**: Only `.env.example` should be distributed
2. **Protect JWT_SECRET**: Use a strong, unique secret key
3. **Database credentials**: Kept separate from the executable
4. **Code obfuscation**: Adds a layer of protection but is not foolproof
5. **Regular updates**: Keep dependencies updated for security patches

## Build Scripts Reference

- `npm run build`: Compile TypeScript to JavaScript
- `npm run build:obfuscate`: Compile and obfuscate code
- `npm run build:exe`: Full build process (compile, obfuscate, package)
- `npm run prisma:generate`: Generate Prisma client

## Support

For build issues:
1. Check this guide
2. Review the build logs
3. Ensure all dependencies are installed
4. Try cleaning and rebuilding: `rm -rf dist build && npm run build:exe`

