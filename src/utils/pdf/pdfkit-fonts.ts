import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { PDFDocumentType } from "./pdfkit-types";

/**
 * Font Support for PDFKit - Including Urdu/Arabic Support
 */

export interface FontDefinition {
    name: string;
    path: string;
    family?: string;
}

export const AVAILABLE_FONTS = {
    // Standard fonts (built-in)
    HELVETICA: "Helvetica",
    HELVETICA_BOLD: "Helvetica-Bold",
    HELVETICA_OBLIQUE: "Helvetica-Oblique",
    TIMES: "Times-Roman",
    TIMES_BOLD: "Times-Bold",
    COURIER: "Courier",

    // Custom fonts (require registration)
    URDU: "NotoNaskhArabic",
    ARABIC: "NotoNaskhArabic",
};

/**
 * Common Urdu/Arabic fonts that can be downloaded
 * Download from Google Fonts: https://fonts.google.com/
 */
export const URDU_FONTS: FontDefinition[] = [
    {
        name: "Noto Nasakh Arabic",
        family: "NotoNaskhArabic",
        path: path.join(__dirname, "../../../fonts/NotoNaskhArabic-Regular.ttf"),
    },
    {
        name: "Noto Nasakh Arabic Bold",
        family: "NotoNaskhArabic-Bold",
        path: path.join(__dirname, "../../../fonts/NotoNaskhArabic-Bold.ttf"),
    },
    {
        name: "Jameel Noori Nastaleeq",
        family: "JameelNoori",
        path: path.join(__dirname, "../../../fonts/JameelNooriNastaleeq.ttf"),
    },
];

/**
 * Register custom fonts with PDFDocument
 */
export function registerFonts(doc: PDFDocumentType, fonts: FontDefinition[]): void {
    fonts.forEach((font) => {
        if (fs.existsSync(font.path)) {
            doc.registerFont(font.family || font.name, font.path);
            console.log(`✓ Registered font: ${font.name}`);
        } else {
            console.warn(`⚠ Font file not found: ${font.path}`);
        }
    });
}

/**
 * Auto-register Urdu fonts if available
 */
export function registerUrduFonts(doc: PDFDocumentType): boolean {
    const availableFonts = URDU_FONTS.filter((font) => fs.existsSync(font.path));

    if (availableFonts.length > 0) {
        registerFonts(doc, availableFonts);
        return true;
    }

    console.warn("⚠ No Urdu fonts found. Please download and place in /fonts directory.");
    return false;
}

/**
 * Check if text contains Urdu/Arabic characters
 */
export function isUrduText(text: string): boolean {
    // Arabic/Urdu Unicode range: U+0600 to U+06FF, U+0750 to U+077F, U+FB50 to U+FDFF, U+FE70 to U+FEFF
    const urduRegex = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return urduRegex.test(text);
}

/**
 * Render text with automatic font switching for Urdu support
 */
export function renderTextWithUrduSupport(
    doc: PDFDocumentType,
    text: string,
    x: number,
    y: number,
    options: any = {}
): void {
    // Default to Helvetica if no font is currently set
    const currentFont = "Helvetica";

    if (isUrduText(text)) {
        // Switch to Urdu font
        const urduFont = URDU_FONTS.find((font) => fs.existsSync(font.path));
        if (urduFont) {
            doc.font(urduFont.family || urduFont.name);
            // Urdu text is RTL (right-to-left)
            doc.text(text, x, y, { ...options, align: options.align || "right" });
            // Restore previous font
            doc.font(currentFont);
        } else {
            // Fallback to default font
            doc.text(text, x, y, options);
        }
    } else {
        doc.text(text, x, y, options);
    }
}

/**
 * Font installation guide
 */
export function printFontInstallationGuide(): string {
    return `
=======================================================
Urdu/Arabic Font Installation Guide
=======================================================

To enable Urdu/Arabic text support in PDFs:

1. Create a 'fonts' directory in the root of your project:
   mkdir fonts

2. Download Noto Nasakh Arabic font from Google Fonts:
   https://fonts.google.com/noto/specimen/Noto+Naskh+Arabic

3. Extract and copy the .ttf files to the fonts directory:
   - NotoNaskhArabic-Regular.ttf
   - NotoNaskhArabic-Bold.ttf

4. Alternative: Download Jameel Noori Nastaleeq:
   http://www.jameel.org/jameel-noori-nastaleeq

Expected font paths:
${URDU_FONTS.map((f) => `  - ${f.path}`).join("\n")}

=======================================================
`;
}

/**
 * Check font availability and print status
 */
export function checkFontAvailability(): {
    available: FontDefinition[];
    missing: FontDefinition[];
} {
    const available: FontDefinition[] = [];
    const missing: FontDefinition[] = [];

    URDU_FONTS.forEach((font) => {
        if (fs.existsSync(font.path)) {
            available.push(font);
        } else {
            missing.push(font);
        }
    });

    console.log("\n=== Font Availability Status ===");
    console.log(`✓ Available: ${available.length}`);
    available.forEach((f) => console.log(`  - ${f.name}`));

    console.log(`✗ Missing: ${missing.length}`);
    missing.forEach((f) => console.log(`  - ${f.name}`));

    if (missing.length > 0) {
        console.log("\n" + printFontInstallationGuide());
    }

    return { available, missing };
}
