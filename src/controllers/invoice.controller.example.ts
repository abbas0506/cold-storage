import { Request, Response } from "express";
import dayjs from "dayjs";
import {
    PDFGenerator,
    PDFTemplateBuilder,
    generateHeader,
    generateInfoSection,
    generateTable,
    generateDivider,
    generateSection,
    TableColumn,
} from "../utils/pdf";

/**
 * EXAMPLE: Invoice Report Generator
 * Demonstrates how to create a professional invoice PDF
 */

interface InvoiceItem {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

interface InvoiceData {
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    customerName: string;
    customerAddress: string;
    items: InvoiceItem[];
    subtotal: number;
    tax: number;
    total: number;
}

// Mock function - replace with actual database query
const getInvoiceData = async (invoiceId: string): Promise<InvoiceData> => {
    return {
        invoiceNumber: "INV-2026-001",
        invoiceDate: "2026-02-01",
        dueDate: "2026-02-28",
        customerName: "ABC Corporation",
        customerAddress: "123 Business St, City, State 12345",
        items: [
            {
                description: "Cold Storage - January",
                quantity: 30,
                rate: 100,
                amount: 3000,
            },
            {
                description: "Handling Charges",
                quantity: 1,
                rate: 500,
                amount: 500,
            },
            {
                description: "Transportation",
                quantity: 2,
                rate: 250,
                amount: 500,
            },
        ],
        subtotal: 4000,
        tax: 400,
        total: 4400,
    };
};

/**
 * Generate Invoice PDF
 */
export const generateInvoicePDF = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { invoiceId } = req.params;

        // Fetch invoice data
        const invoice = await getInvoiceData(invoiceId);

        // Build PDF content
        const builder = new PDFTemplateBuilder();

        // Add header
        builder.add(
            generateHeader({
                title: "INVOICE",
                subtitle: `Invoice #${invoice.invoiceNumber}`,
                showDate: false,
            })
        );

        // Add company and customer info side by side
        builder.add('<div style="display: flex; justify-content: space-between; margin: 20px 0;">');

        // Company info (left side)
        builder.add('<div style="flex: 1;">');
        builder.add('<h3 style="margin-bottom: 10px;">From:</h3>');
        builder.add('<p><strong>Your Company Name</strong></p>');
        builder.add('<p>456 Company Rd</p>');
        builder.add('<p>City, State 54321</p>');
        builder.add('<p>Phone: (123) 456-7890</p>');
        builder.add('</div>');

        // Customer info (right side)
        builder.add('<div style="flex: 1; text-align: right;">');
        builder.add('<h3 style="margin-bottom: 10px;">Bill To:</h3>');
        builder.add(`<p><strong>${invoice.customerName}</strong></p>`);
        builder.add(`<p>${invoice.customerAddress}</p>`);
        builder.add('</div>');

        builder.add('</div>');

        // Invoice details
        builder.add(
            generateInfoSection({
                "Invoice Number": invoice.invoiceNumber,
                "Invoice Date": dayjs(invoice.invoiceDate).format("DD MMM YYYY"),
                "Due Date": dayjs(invoice.dueDate).format("DD MMM YYYY"),
                "Status": "Pending",
            })
        );

        // Items table
        const columns: TableColumn[] = [
            {
                label: "Description",
                key: "description",
                align: "left",
            },
            {
                label: "Quantity",
                key: "quantity",
                align: "center",
            },
            {
                label: "Rate",
                key: "rate",
                align: "right",
                format: (value) => `$${value.toLocaleString()}`,
            },
            {
                label: "Amount",
                key: "amount",
                align: "right",
                format: (value) => `$${value.toLocaleString()}`,
            },
        ];

        builder.add(
            generateSection(
                "Invoice Details",
                generateTable(columns, invoice.items)
            )
        );

        // Totals section (right-aligned)
        builder.add('<div style="margin-top: 20px; margin-left: auto; max-width: 300px;">');
        builder.add(`
      <div style="display: flex; justify-content: space-between; padding: 5px 0;">
        <span>Subtotal:</span>
        <span><strong>$${invoice.subtotal.toLocaleString()}</strong></span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 5px 0;">
        <span>Tax (10%):</span>
        <span><strong>$${invoice.tax.toLocaleString()}</strong></span>
      </div>
    `);
        builder.add(generateDivider());
        builder.add(`
      <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 16px;">
        <span><strong>Total Due:</strong></span>
        <span><strong>$${invoice.total.toLocaleString()}</strong></span>
      </div>
    `);
        builder.add('</div>');

        // Payment terms
        builder.add(generateDivider());
        builder.add(
            generateSection(
                "Payment Terms",
                `
        <p>Payment is due within 30 days of invoice date.</p>
        <p>Please make payment to: Bank XYZ, Account: 1234567890</p>
        <p>Thank you for your business!</p>
        `
            )
        );

        // Footer note
        builder.add(
            '<p class="text-center mt-20" style="font-size: 10px; color: #999;">This is a computer-generated invoice.</p>'
        );

        // Custom styles for invoice
        const customStyles = `
      .section-title {
        color: #2c3e50;
        font-size: 14px;
        margin-top: 20px;
      }
      .pdf-table td:first-child {
        text-align: left;
        font-weight: 500;
      }
    `;

        // Generate and send PDF
        await PDFGenerator.sendPDFResponse(res, {
            html: builder.build(),
            customStyles,
            filename: `invoice-${invoice.invoiceNumber}.pdf`,
        });
    } catch (error) {
        console.error("Invoice generation error:", error);
        res.status(500).json({
            error: "Failed to generate invoice",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};

/**
 * EXAMPLE: Payment Receipt
 * Demonstrates a simple receipt PDF
 */
export const generatePaymentReceipt = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { paymentId } = req.params;

        // Mock payment data
        const payment = {
            receiptNumber: "RCP-2026-001",
            date: dayjs().format("YYYY-MM-DD"),
            customerName: "John Doe",
            amount: 4400,
            paymentMethod: "Bank Transfer",
            invoiceNumber: "INV-2026-001",
        };

        const builder = new PDFTemplateBuilder();

        // Simple receipt layout
        builder.add(
            generateHeader({
                title: "PAYMENT RECEIPT",
                subtitle: `Receipt #${payment.receiptNumber}`,
                showDate: true,
            })
        );

        builder.add(
            generateInfoSection({
                "Receipt Number": payment.receiptNumber,
                "Payment Date": dayjs(payment.date).format("DD MMM YYYY"),
                "Customer Name": payment.customerName,
                "Invoice Number": payment.invoiceNumber,
            })
        );

        builder.add('<div style="text-align: center; margin: 40px 0;">');
        builder.add('<p style="font-size: 18px; margin-bottom: 10px;">Amount Received</p>');
        builder.add(
            `<p style="font-size: 32px; font-weight: bold; color: #27ae60;">$${payment.amount.toLocaleString()}</p>`
        );
        builder.add(`<p style="color: #666;">via ${payment.paymentMethod}</p>`);
        builder.add('</div>');

        builder.add(generateDivider());

        builder.add('<p class="text-center mt-20">Thank you for your payment!</p>');
        builder.add(
            '<p class="text-center" style="font-size: 10px; color: #999; margin-top: 40px;">This is an official receipt.</p>'
        );

        await PDFGenerator.sendPDFResponse(res, {
            html: builder.build(),
            filename: `receipt-${payment.receiptNumber}.pdf`,
        });
    } catch (error) {
        console.error("Receipt generation error:", error);
        res.status(500).json({
            error: "Failed to generate receipt",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
