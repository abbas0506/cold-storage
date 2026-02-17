import puppeteer, { Browser, PDFOptions } from "puppeteer";
import { getStyles } from "./styles";
import { existsSync } from "fs";

export interface PDFGeneratorOptions {
    html: string;
    customStyles?: string;
    pdfOptions?: PDFOptions;
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
}

/**
 * Find Chrome executable on the system
 */
function findChromeExecutable(): string | undefined {
    // Check environment variable first
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // Common Chrome paths on Windows
    const windowsPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    ];

    // Common Chrome paths on macOS
    const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];

    // Common Chrome/Chromium paths on Linux
    const linuxPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
    ];

    const allPaths = [...windowsPaths, ...macPaths, ...linuxPaths];

    for (const path of allPaths) {
        if (path && existsSync(path)) {
            return path;
        }
    }

    return undefined;
}

/**
 * Main PDF Generator
 * Generates PDF from HTML using Puppeteer
 */
export class PDFGenerator {
    private static browserInstance: Browser | null = null;

    /**
     * Get or create browser instance (singleton pattern for performance)
     */
    private static async getBrowser(): Promise<Browser> {
        if (!this.browserInstance || !this.browserInstance.connected) {
            try {
                const executablePath = findChromeExecutable();

                if (!executablePath) {
                    throw new Error(
                        'Chrome not found. Please install Chrome or set PUPPETEER_EXECUTABLE_PATH environment variable.\n' +
                        'Alternatively, run: npx puppeteer browsers install chrome'
                    );
                }

                console.log(`Using Chrome at: ${executablePath}`);

                this.browserInstance = await puppeteer.launch({
                    headless: true,
                    executablePath,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                    ],
                });
            } catch (error) {
                console.error("Failed to launch browser:", error);
                throw new Error(
                    error instanceof Error
                        ? error.message
                        : "Could not launch browser for PDF generation"
                );
            }
        }
        return this.browserInstance;
    }

    /**
     * Close browser instance (call this when shutting down the app)
     */
    static async closeBrowser(): Promise<void> {
        if (this.browserInstance) {
            await this.browserInstance.close();
            this.browserInstance = null;
        }
    }

    /**
     * Generate PDF from HTML
     */
    static async generatePDF(options: PDFGeneratorOptions): Promise<Buffer> {
        const {
            html,
            customStyles,
            pdfOptions = {},
            displayHeaderFooter = false,
            headerTemplate,
            footerTemplate,
        } = options;

        const browser = await this.getBrowser();
        const page = await browser.newPage();

        try {
            // Construct full HTML with styles
            const fullHTML = this.wrapHTML(html, customStyles);

            // Set content
            await page.setContent(fullHTML, { waitUntil: "networkidle0" });

            // Default PDF options
            const defaultPDFOptions: PDFOptions = {
                format: "A4",
                printBackground: true,
                margin: {
                    top: "10mm",
                    right: "10mm",
                    bottom: "20mm",
                    left: "10mm",
                },
            };

            // Generate PDF
            const pdf = await page.pdf({
                ...defaultPDFOptions,
                ...pdfOptions,
                displayHeaderFooter,
                headerTemplate: displayHeaderFooter ? headerTemplate : undefined,
                footerTemplate: displayHeaderFooter ? footerTemplate : undefined,
            });

            return Buffer.from(pdf);
        } finally {
            await page.close();
        }
    }

    /**
     * Wrap HTML content with proper HTML structure and styles
     */
    private static wrapHTML(content: string, customStyles?: string): string {
        const styles = getStyles(customStyles);

        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PDF Report</title>
        <style>
          ${styles}
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
    }

    /**
     * Helper: Generate PDF and send as Express response
     */
    static async sendPDFResponse(
        res: any,
        options: PDFGeneratorOptions & { filename?: string }
    ): Promise<void> {
        try {
            const pdf = await this.generatePDF(options);

            res.set({
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename=${options.filename || "report.pdf"}`,
            });

            res.send(pdf);
        } catch (error) {
            console.error("PDF generation error:", error);
            res.status(500).json({
                error: "Failed to generate PDF",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
}

/**
 * Template builder utility
 * Helps build HTML content for PDF generation
 */
export class PDFTemplateBuilder {
    private content: string[] = [];

    add(html: string): this {
        this.content.push(html);
        return this;
    }

    addSection(html: string, className?: string): this {
        this.content.push(
            `<div class="${className || "section"}">${html}</div>`
        );
        return this;
    }

    addPageBreak(): this {
        this.content.push('<div class="page-break"></div>');
        return this;
    }

    build(): string {
        return this.content.join("\n");
    }

    clear(): this {
        this.content = [];
        return this;
    }
}
