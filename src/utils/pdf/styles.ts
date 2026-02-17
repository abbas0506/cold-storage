/**
 * Default PDF Styles
 * Reusable CSS styles for PDF generation
 */

export const defaultStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: #333;
    padding: 10px;
  }

  /* Header Styles */
  .pdf-header {
    text-align: center;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 2px solid #333;
  }

  .pdf-header .logo {
    max-width: 150px;
    max-height: 80px;
    margin-bottom: 10px;
  }

  .header-title {
    font-size: 24px;
    font-weight: bold;
    color: #222;
    margin: 0px 0;
  }

  .header-subtitle {
    font-size: 14px;
    color: #666;
    margin: 0px 0;
  }

  .header-date {
    font-size: 11px;
    color: #999;
    margin-top: 5px;
  }

  /* Footer Styles */
  .pdf-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    margin-top: 30px;
    border-top: 1px solid #ccc;
    font-size: 10px;
    color: #666;
  }

  .footer-left,
  .footer-center,
  .footer-right {
    flex: 1;
  }

  .footer-center {
    text-align: center;
  }

  .footer-right {
    text-align: right;
  }

  /* Info Section Styles */
  .info-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
    margin: 20px 0;
    padding: 15px;
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
  }

  .info-row {
    display: flex;
    gap: 10px;
  }

  .info-label {
    font-weight: bold;
    color: #555;
  }

  .info-value {
    color: #333;
  }

  /* Table Styles */
  .pdf-table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  }

  .pdf-table thead {
    background: #f4f4f4;
  }

  .pdf-table th {
    border: 1px solid #ccc;
    padding: 10px 8px;
    font-weight: bold;
    text-align: center;
    font-size: 11px;
    background: #e8e8e8;
  }

  .pdf-table td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: center;
    font-size: 11px;
  }

  .pdf-table tbody tr:nth-child(even) {
    background: #fafafa;
  }

  .pdf-table tbody tr:hover {
    background: #f0f0f0;
  }

  .pdf-table tfoot {
    background: #f4f4f4;
    font-weight: bold;
  }

  .pdf-table tfoot td {
    padding: 10px 8px;
    border-top: 2px solid #999;
  }

  .total-row {
    background: #e8e8e8 !important;
  }

  /* Key-Value Pair */
  .key-value-pair {
    display: flex;
    gap: 10px;
    margin: 5px 0;
  }

  .key-value-pair .key {
    font-weight: bold;
    min-width: 150px;
  }

  .key-value-pair .value {
    color: #555;
  }

  /* Divider */
  .divider {
    border: none;
    border-top: 1px solid #ddd;
    margin: 20px 0;
  }

  /* Section Styles */
  .section {
    margin: 30px 0;
  }

  .section-title {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    margin-bottom: 15px;
    padding-bottom: 5px;
    border-bottom: 1px solid #ddd;
  }

  .section-content {
    margin-top: 10px;
  }

  /* Utility Classes */
  .text-center {
    text-align: center;
  }

  .text-right {
    text-align: right;
  }

  .text-left {
    text-align: left;
  }

  .bold {
    font-weight: bold;
  }

  .mt-10 {
    margin-top: 10px;
  }

  .mt-20 {
    margin-top: 20px;
  }

  .mb-10 {
    margin-bottom: 10px;
  }

  .mb-20 {
    margin-bottom: 20px;
  }

  /* Page Break */
  .page-break {
    page-break-after: always;
  }

  /* Print-specific styles */
  @media print {
    body {
      padding: 0;
    }
  }
`;

/**
 * Get custom styles merged with defaults
 */
export const getStyles = (customStyles?: string): string => {
  return customStyles ? `${defaultStyles}\n${customStyles}` : defaultStyles;
};
