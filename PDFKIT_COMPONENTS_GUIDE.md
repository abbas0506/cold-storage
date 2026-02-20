# PDFKit Component Library for Cold Storage System

## Overview

This document describes the PDFKit-based PDF generation system with reusable components, automatic header/footer support, page numbering, and Urdu language support.

## Features

✅ **Component-Based Architecture** - Modular, reusable components  
✅ **Automatic Header & Footer** - Pixel-perfect headers and footers on every page  
✅ **Page Numbering** - Automatic page number tracking (Page X of Y)  
✅ **Configurable Styling** - Font sizes, colors, backgrounds per component  
✅ **Responsive Tables** - Auto page breaks, zebra striping, column sizing  
✅ **Urdu/Arabic Support** - RTL text rendering with custom fonts  
✅ **Multiple Page Sizes** - A4, A3, Letter, or custom dimensions  

## Installation

### 1. Install Dependencies

```bash
npm install pdfkit @types/pdfkit
```

### 2. (Optional) Add Urdu Font Support

Create a `fonts` directory in the project root:

```bash
mkdir fonts
```

Download Noto Nasakh Arabic from [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Naskh+Arabic):

```
fonts/
  ├── NotoNaskhArabic-Regular.ttf
  └── NotoNaskhArabic-Bold.ttf
```

## Architecture

```
src/utils/pdf/
├── pdfkit-types.ts          # TypeScript interfaces and types
├── pdfkit-components.ts     # Reusable components (header, footer, table, etc.)
├── pdfkit-generator.ts      # Main generator with automatic header/footer
├── pdfkit-fonts.ts          # Font management and Urdu support
└── index.ts                 # Public exports
```

## Quick Start

### Basic Report Generation

```typescript
import {
    createPDFGenerator,
    generateInfoSection,
    generateTable,
} from "../utils/pdf/pdfkit-components";

// Create PDF generator with header and footer
const pdfGen = createPDFGenerator({
    pdfOptions: {
        size: "A4",
        margins: { top: 120, bottom: 80, left: 50, right: 50 },
    },
    header: {
        title: "My Report",
        subtitle: "Quarterly Summary",
        showDate: true,
    },
    footer: {
        leftText: "Confidential",
        centerText: "Report",
        showPageNumber: true,
    },
});

const doc = pdfGen.getDocument();

// Add info section
generateInfoSection(doc, {
    data: {
        "Report Date": "20 Feb 2026",
        "Total Records": "1250",
    },
    columns: 2,
    backgroundColor: "#f9f9f9",
});

// Add table
generateTable(doc, {
    columns: [
        { label: "Date", key: "date", width: 100, align: "center" },
        { label: "Description", key: "desc", width: "*", align: "left" },
        { label: "Amount", key: "amount", width: 100, align: "right" },
    ],
    data: myData,
    alternateRowColor: true,
});

// Send to response
await pdfGen.sendToResponse(res, "report.pdf");
```

## Components

### 1. PDF Generator

The main generator handles document creation, headers, footers, and page management.

```typescript
const pdfGen = createPDFGenerator({
    pdfOptions: {
        size: "A4" | "A3" | "Letter" | [width, height],
        margins: { top: 120, bottom: 80, left: 50, right: 50 },
        bufferPages: true,
    },
    header: {
        title: "Report Title",
        subtitle: "Optional Subtitle",
        logo: {
            path: "/path/to/logo.png",
            width: 60,
            height: 60,
        },
        showDate: true,
        dateFormat: "DD MMM YYYY HH:mm",
        titleFont: { family: "Helvetica-Bold", size: 20, color: "#000" },
        subtitleFont: { size: 12, color: "#666" },
    },
    footer: {
        leftText: "Company Name",
        centerText: "Document Type",
        rightText: "Date", // Auto-populated if not provided
        showPageNumber: true,
        pageNumberFormat: (current, total) => `Page ${current} of ${total}`,
        font: { size: 8, color: "#666" },
    },
    urduFont: {
        path: "/path/to/urdu-font.ttf",
        family: "UrduFont",
    },
});
```

### 2. Info Section Component

Display key-value pairs in a formatted grid.

```typescript
generateInfoSection(doc, {
    data: {
        "Label 1": "Value 1",
        "Label 2": "Value 2",
        "Label 3": "Value 3",
    },
    columns: 2, // Number of columns (default: 2)
    backgroundColor: "#f9f9f9",
    borderColor: "#e0e0e0",
    padding: 15,
    labelFont: { family: "Helvetica-Bold", size: 10 },
    valueFont: { family: "Helvetica", size: 10, color: "#333" },
});
```

### 3. Table Component

Powerful table rendering with pagination, styling, and totals.

```typescript
generateTable(doc, {
    columns: [
        {
            label: "Column Header",
            key: "dataKey",
            width: 100 | "*", // Fixed width or auto-sized
            align: "left" | "center" | "right" | "justify",
            format: (value, row) => value.toLocaleString(), // Optional formatter
            font: { size: 9 }, // Override font for this column
        },
    ],
    data: [{ dataKey: "value" }],
    
    // Header styling
    showHeader: true,
    headerBackgroundColor: "#333333",
    headerTextColor: "#ffffff",
    headerFont: { family: "Helvetica-Bold", size: 10 },
    headerHeight: 25,
    
    // Body styling
    bodyFont: { size: 9, color: "#000" },
    rowHeight: 22,
    alternateRowColor: true,
    alternateColor: "#f9f9f9",
    
    // Borders
    borderColor: "#cccccc",
    borderWidth: 1,
    
    // Totals row
    showTotal: true,
    totalLabel: "Total",
    totalColumns: {
        columnKey: 1234, // Numeric total
        anotherKey: "Summary text", // String value
    },
    totalBackgroundColor: "#e0e0e0",
    totalFont: { family: "Helvetica-Bold", size: 10 },
});
```

### 4. Header Component

Automatically rendered on each page.

```typescript
generateHeader(doc, {
    title: "Document Title",
    subtitle: "Subtitle Text",
    logo: { path: "/path/to/logo.png", width: 60, height: 60 },
    showDate: true,
    dateFormat: "DD MMM YYYY HH:mm",
    backgroundColor: "#f0f0f0",
    height: 100,
    titleFont: { family: "Helvetica-Bold", size: 20 },
    subtitleFont: { size: 12, color: "#666" },
});
```

### 5. Footer Component

Automatically rendered on each page with page numbers.

```typescript
generateFooter(doc, {
    leftText: "Left Footer Text",
    centerText: "Center Text",
    rightText: "Right Footer Text",
    showPageNumber: true,
    pageNumberFormat: (current, total) => `${current}/${total}`,
    backgroundColor: "#f9f9f9",
    height: 30,
    font: { size: 8, color: "#666" },
});
```

## Advanced Usage

### Custom Page Size

```typescript
const pdfGen = createPDFGenerator({
    pdfOptions: {
        size: [595.28, 841.89], // A4 in points (1 inch = 72 points)
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
    },
});
```

### Font Override Per Component

Each component supports font overrides:

```typescript
generateTable(doc, {
    columns: [
        {
            label: "Special Column",
            key: "data",
            font: { family: "Courier", size: 8, color: "#cc0000" }, // Override
        },
    ],
    headerFont: { family: "Helvetica-Bold", size: 12 },
    bodyFont: { family: "Times-Roman", size: 9 },
});
```

### Urdu/Arabic Text Support

```typescript
import { registerUrduFonts } from "../utils/pdf/pdfkit-fonts";

const pdfGen = createPDFGenerator({...});
const doc = pdfGen.getDocument();

// Register Urdu fonts
registerUrduFonts(doc);

// Urdu text will automatically render RTL
generateInfoSection(doc, {
    data: {
        "نام": "قیمت", // Urdu text
        "Name": "Price", // English text
    },
});
```

### Check Font Availability

```typescript
import { checkFontAvailability } from "../utils/pdf/pdfkit-fonts";

// Check which Urdu fonts are available
const { available, missing } = checkFontAvailability();
console.log("Available fonts:", available.map(f => f.name));
```

### Manual Page Management

```typescript
const pdfGen = createPDFGenerator({...});

// Add content
generateTable(doc, {...});

// Manual page break
pdfGen.addPage();

// Continue adding content
generateInfoSection(doc, {...});

// Check if page break is needed
if (pdfGen.needsPageBreak(100)) {
    pdfGen.addPage();
}
```

### Save to File or Buffer

```typescript
// Save to file
await pdfGen.saveToFile("/path/to/output.pdf");

// Get as buffer
const buffer = await pdfGen.toBuffer();

// Send to response (recommended)
await pdfGen.sendToResponse(res, "filename.pdf");
```

## Examples

### Example 1: Simple Invoice

```typescript
export const generateInvoice = async (req: Request, res: Response) => {
    const pdfGen = createPDFGenerator({
        header: {
            title: "INVOICE",
            subtitle: `Invoice #${invoiceNumber}`,
            logo: { path: "./logo.png", width: 80 },
            showDate: true,
        },
        footer: {
            leftText: "Thank you for your business",
            showPageNumber: true,
        },
    });

    const doc = pdfGen.getDocument();

    // Customer info
    generateInfoSection(doc, {
        data: {
            "Customer": customer.name,
            "Email": customer.email,
            "Invoice Date": dayjs().format("DD MMM YYYY"),
            "Due Date": dueDate,
        },
        columns: 2,
    });

    pdfGen.moveDown(1);

    // Items table
    generateTable(doc, {
        columns: [
            { label: "Item", key: "name", width: "*" },
            { label: "Qty", key: "qty", width: 60, align: "center" },
            { label: "Price", key: "price", width: 80, align: "right",
              format: (v) => `$${v.toFixed(2)}` },
            { label: "Total", key: "total", width: 80, align: "right",
              format: (v) => `$${v.toFixed(2)}` },
        ],
        data: items,
        showTotal: true,
        totalLabel: "TOTAL",
        totalColumns: { total: totalAmount },
    });

    await pdfGen.sendToResponse(res, `invoice-${invoiceNumber}.pdf`);
};
```

### Example 2: Multi-Page Report with Summary

```typescript
export const generateReport = async (req: Request, res: Response) => {
    const pdfGen = createPDFGenerator({
        header: {
            title: "Annual Report 2026",
            subtitle: "Financial Summary",
        },
        footer: {
            centerText: "Annual Report",
            showPageNumber: true,
        },
    });

    const doc = pdfGen.getDocument();

    // Page 1: Executive Summary
    doc.fontSize(14).font("Helvetica-Bold").text("Executive Summary");
    pdfGen.moveDown(0.5);

    doc.fontSize(10).font("Helvetica").text(
        "This report covers the financial performance...",
        { align: "justify" }
    );

    pdfGen.moveDown(2);

    generateInfoSection(doc, {
        data: {
            "Total Revenue": "$1.2M",
            "Net Profit": "$340K",
            "Growth": "+25%",
        },
        backgroundColor: "#e8f4f8",
    });

    // Page 2: Detailed Data
    pdfGen.addPage();

    doc.fontSize(14).font("Helvetica-Bold").text("Detailed Transactions");
    pdfGen.moveDown(1);

    generateTable(doc, {
        columns: [
            { label: "Date", key: "date", width: 90 },
            { label: "Description", key: "desc", width: "*" },
            { label: "Amount", key: "amount", width: 100, align: "right" },
        ],
        data: transactions,
        alternateRowColor: true,
    });

    await pdfGen.sendToResponse(res, "annual-report-2026.pdf");
};
```

## API Reference

### PDFKitGenerator Methods

| Method | Description |
|--------|-------------|
| `getDocument()` | Get the underlying PDFDocument |
| `getY()` | Get current Y position |
| `setY(y)` | Set Y position |
| `moveDown(lines)` | Move down by number of lines |
| `addContent(callback)` | Add custom content via callback |
| `addPage()` | Add a new page |
| `needsPageBreak(space)` | Check if page break is needed |
| `getContentArea()` | Get content area dimensions |
| `sendToResponse(res, filename)` | Send PDF to HTTP response |
| `toBuffer()` | Get PDF as Buffer |
| `saveToFile(path)` | Save PDF to file |

### Font Configuration

```typescript
interface FontConfig {
    family: "Helvetica" | "Helvetica-Bold" | "Times-Roman" | "Courier" | string;
    size: number;
    color?: string; // Hex color code
}
```

### Built-in Fonts

- `Helvetica`, `Helvetica-Bold`, `Helvetica-Oblique`
- `Times-Roman`, `Times-Bold`
- `Courier`, `Courier-Bold`

### Custom Fonts

Register custom fonts in the generator:

```typescript
const pdfGen = createPDFGenerator({
    urduFont: {
        path: "./fonts/MyFont.ttf",
        family: "MyFont",
    },
});

// Use in components
doc.font("MyFont").text("Custom font text");
```

## Troubleshooting

### Issue: Headers/Footers not appearing

**Solution**: Ensure margins are set correctly:

```typescript
margins: { 
    top: 120,  // Must be enough for header
    bottom: 80, // Must be enough for footer
    left: 50, 
    right: 50 
}
```

### Issue: Table columns not aligned

**Solution**: Use explicit widths or `"*"` for auto-sizing:

```typescript
columns: [
    { label: "Fixed", key: "a", width: 100 },
    { label: "Auto", key: "b", width: "*" },
]
```

### Issue: Urdu text not rendering

**Solution**: 
1. Ensure font files are in `/fonts` directory
2. Call `registerUrduFonts(doc)` before rendering
3. Check font availability with `checkFontAvailability()`

### Issue: Page numbers not updating

**Solution**: Page numbers are calculated when `sendToResponse()` is called. They won't show during preview.

## Performance Tips

1. **Buffer pages**: Always set `bufferPages: true` for multi-page documents
2. **Reuse generators**: Create one generator per request, not per component
3. **Stream to response**: Use `sendToResponse()` for large PDFs instead of `toBuffer()`
4. **Optimize images**: Compress logos and images before embedding

## Support

For issues or questions, please refer to:
- [PDFKit Documentation](http://pdfkit.org/docs/getting_started.html)
- Project repository issues

---

**Version**: 1.0.0  
**Last Updated**: February 20, 2026
