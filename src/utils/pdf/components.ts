import dayjs from "dayjs";

/**
 * PDF Component Templates
 * Reusable HTML components for PDF generation
 */

export interface HeaderOptions {
    title: string;
    subtitle?: string;
    logo?: string;
    showDate?: boolean;
}

export interface FooterOptions {
    leftText?: string;
    centerText?: string;
    rightText?: string;
    showPageNumber?: boolean;
}

export interface TableColumn {
    label: string;
    key: string;
    align?: "left" | "center" | "right";
    format?: (value: any) => string;
}

/**
 * Generate header HTML
 */
export const generateHeader = (options: HeaderOptions): string => {
    const { title, subtitle, logo, showDate = true } = options;

    return `
    <div class="pdf-header">
      ${logo ? `<img src="${logo}" alt="Logo" class="logo" />` : ""}
      <h1 class="header-title">${title}</h1>
      ${subtitle ? `<p class="header-subtitle">${subtitle}</p>` : ""}
      ${showDate ? `<p class="header-date">Generated: ${dayjs().format("DD MMM YYYY HH:mm")}</p>` : ""}
    </div>
  `;
};

/**
 * Generate footer HTML with page numbers
 */
export const generateFooter = (options: FooterOptions): string => {
    const { leftText, centerText, rightText, showPageNumber = true } = options;

    return `
    <div class="pdf-footer">
      <span class="footer-left">${leftText || ""}</span>
      <span class="footer-center">
        ${centerText || ""}
        ${showPageNumber ? '<span class="pageNumber"></span> / <span class="totalPages"></span>' : ""}
      </span>
      <span class="footer-right">${rightText || dayjs().format("DD MMM YYYY")}</span>
    </div>
  `;
};

/**
 * Generate summary/info section
 */
export const generateInfoSection = (data: Record<string, string>): string => {
    const rows = Object.entries(data)
        .map(
            ([key, value]) => `
      <div class="info-row">
        <span class="info-label">${key}:</span>
        <span class="info-value">${value}</span>
      </div>
    `
        )
        .join("");

    return `
    <div class="info-section">
      ${rows}
    </div>
  `;
};

/**
 * Generate table HTML
 */
export const generateTable = (
    columns: TableColumn[],
    data: any[],
    options?: {
        showTotal?: boolean;
        totalLabel?: string;
        totalColumns?: Record<string, number | string>;
    }
): string => {
    // Generate table headers
    const headers = columns
        .map(
            (col) => `
      <th style="text-align: ${col.align || "center"}">${col.label}</th>
    `
        )
        .join("");

    // Generate table rows
    const rows = data
        .map((row) => {
            const cells = columns
                .map((col) => {
                    const value = row[col.key];
                    const formattedValue = col.format ? col.format(value) : value;
                    return `<td style="text-align: ${col.align || "center"}">${formattedValue || "-"}</td>`;
                })
                .join("");

            return `<tr>${cells}</tr>`;
        })
        .join("");

    // Generate total row if needed
    let totalRow = "";
    if (options?.showTotal && options?.totalColumns) {
        const totalCells = columns
            .map((col) => {
                if (col.key === columns[0].key) {
                    return `<td style="text-align: ${col.align || "center"}"><strong>${options.totalLabel || "Total"}</strong></td>`;
                }
                const totalValue = options.totalColumns?.[col.key];
                const formattedValue =
                    totalValue !== undefined
                        ? col.format
                            ? col.format(totalValue)
                            : totalValue
                        : "";
                return `<td style="text-align: ${col.align || "center"}"><strong>${formattedValue}</strong></td>`;
            })
            .join("");

        totalRow = `<tr class="total-row">${totalCells}</tr>`;
    }

    return `
    <table class="pdf-table">
      <thead>
        <tr>${headers}</tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      ${totalRow ? `<tfoot>${totalRow}</tfoot>` : ""}
    </table>
  `;
};

/**
 * Generate a simple key-value pair display
 */
export const generateKeyValuePair = (
    label: string,
    value: string | number
): string => {
    return `
    <div class="key-value-pair">
      <span class="key">${label}:</span>
      <span class="value">${value}</span>
    </div>
  `;
};

/**
 * Generate a divider/separator
 */
export const generateDivider = (): string => {
    return '<hr class="divider" />';
};

/**
 * Generate a section with title
 */
export const generateSection = (title: string, content: string): string => {
    return `
    <div class="section">
      <h2 class="section-title">${title}</h2>
      <div class="section-content">
        ${content}
      </div>
    </div>
  `;
};
