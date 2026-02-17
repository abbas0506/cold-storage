import { Request, Response } from "express";
import dayjs from "dayjs";
import {
    PDFGenerator,
    PDFTemplateBuilder,
    generateHeader,
    generateFooter,
    generateInfoSection,
    generateTable,
    TableColumn,
} from "../utils/pdf";
import { prisma } from "../prisma/prisma";

/**
 * Generate Ledger Report PDF
 */
export const generateLedgerReport = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { from, to, farmerId } = req.query;

        // Fetch ledger data
        const ledgerData = await prisma.ledger.findMany({
            where: {
                transactionDate: {
                    gte: from ? new Date(from as string) : undefined,
                    lte: to ? new Date(to as string) : undefined,
                },
                farmerId: farmerId ? Number(farmerId) : undefined,
            }
        });
        const farmer = await prisma.farmer.findUnique({
            where: {
                id: farmerId ? Number(farmerId) : undefined,
            },
        });

        // Calculate running balance
        let balance = 0;
        const dataWithBalance = ledgerData.map((row) => {
            balance += row.debit - row.credit;
            return {
                ...row,
                balance,
            };
        });

        // Calculate totals
        const totalDebit = ledgerData.reduce(
            (sum, row) => sum + (row.debit || 0),
            0
        );
        const totalCredit = ledgerData.reduce(
            (sum, row) => sum + (row.credit || 0),
            0
        );
        const closingBalance = balance;

        // Define table columns
        const columns: TableColumn[] = [
            {
                label: "Date",
                key: "date",
                align: "center",
                format: (value) => dayjs(value).format("DD-MM-YYYY"),
            },
            {
                label: "Description",
                key: "description",
                align: "left",
            },
            {
                label: "Debit",
                key: "debit",
                align: "center",
                format: (value) => (value ? value.toLocaleString() : "-"),
            },
            {
                label: "Credit",
                key: "credit",
                align: "center",
                format: (value) => (value ? value.toLocaleString() : "-"),
            },
            {
                label: "Balance",
                key: "balance",
                align: "center",
                format: (value) => value.toLocaleString(),
            },
        ];

        // Build PDF content using template builder
        const builder = new PDFTemplateBuilder();

        // Add header
        builder.add(
            generateHeader({
                title: "Ledger Report",
                subtitle: farmer ? `Farmer: ${farmer.name}` : "General Ledger",
                showDate: true,
            })
        );

        // Add info section with report parameters
        builder.add(
            generateInfoSection({
                "From Date": from ? dayjs(from as string).format("DD MMM YYYY") : "N/A",
                "To Date": to ? dayjs(to as string).format("DD MMM YYYY") : "N/A",
                "Total Entries": ledgerData.length.toString(),
                "Report Type": "Ledger Statement",
            })
        );

        // Add table
        builder.add(
            generateTable(columns, dataWithBalance, {
                showTotal: true,
                totalLabel: "Total",
                totalColumns: {
                    description: "",
                    debit: totalDebit,
                    credit: totalCredit,
                    balance: closingBalance,
                },
            })
        );

        // Add summary section
        builder.add('<div class="mt-20">');
        builder.add(
            generateInfoSection({
                "Opening Balance": dataWithBalance.length > 0
                    ? (dataWithBalance[0].balance - dataWithBalance[0].debit + dataWithBalance[0].credit).toLocaleString()
                    : "0",
                "Total Debit": totalDebit.toLocaleString(),
                "Total Credit": totalCredit.toLocaleString(),
                "Closing Balance": closingBalance.toLocaleString(),
            })
        );
        builder.add("</div>");

        // Add footer note
        builder.add(
            '<p class="text-center mt-20" style="font-size: 10px; color: #999;">This is a computer-generated report and does not require a signature.</p>'
        );

        // Generate and send PDF
        await PDFGenerator.sendPDFResponse(res, {
            html: builder.build(),
            filename: `ledger-report-${dayjs().format("YYYY-MM-DD")}.pdf`,
        });
    } catch (error) {
        console.error("Ledger report generation error:", error);
        res.status(500).json({
            error: "Failed to generate ledger report",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};

/**
 * Generate Detailed Ledger Report with Multiple Pages
 * Example of multi-page report with page breaks
 */
export const generateDetailedLedgerReport = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { from, to } = req.query;

        // Fetch data
        const ledgerData = await prisma.ledger.findMany({
            where: {
                transactionDate: {
                    gte: from ? new Date(from as string) : undefined,
                    lte: to ? new Date(to as string) : undefined,
                },
            },
            orderBy: {
                transactionDate: "asc",
            },
        });

        const builder = new PDFTemplateBuilder();

        // Page 1: Summary
        builder.add(
            generateHeader({
                title: "Detailed Ledger Report",
                subtitle: "Summary & Overview",
                showDate: true,
            })
        );

        builder.add(
            generateInfoSection({
                "Report Period": `${from || "Start"} to ${to || "End"}`,
                "Total Transactions": ledgerData.length.toString(),
                "Status": "Generated",
            })
        );

        builder.add('<div class="section">');
        builder.add('<h2 class="section-title">Executive Summary</h2>');
        builder.add(
            '<p>This report provides a detailed overview of all ledger transactions for the specified period.</p>'
        );
        builder.add("</div>");

        // Page break
        builder.addPageBreak();

        // Page 2: Detailed Transactions
        builder.add(
            generateHeader({
                title: "Transaction Details",
                showDate: false,
            })
        );

        let balance = 0;
        const dataWithBalance = ledgerData.map((row) => {
            balance += row.debit - row.credit;
            return { ...row, balance };
        });

        const columns: TableColumn[] = [
            {
                label: "Date",
                key: "date",
                format: (value) => dayjs(value).format("DD-MM-YYYY"),
            },
            {
                label: "Description",
                key: "description",
                align: "left",
            },
            {
                label: "Debit",
                key: "debit",
                align: "right",
                format: (value) => (value ? value.toLocaleString() : "-"),
            },
            {
                label: "Credit",
                key: "credit",
                align: "right",
                format: (value) => (value ? value.toLocaleString() : "-"),
            },
            {
                label: "Balance",
                key: "balance",
                align: "right",
                format: (value) => value.toLocaleString(),
            },
        ];

        builder.add(generateTable(columns, dataWithBalance));

        // Generate PDF with footer
        const footerHtml = generateFooter({
            leftText: "Confidential",
            centerText: "Page ",
            rightText: dayjs().format("DD MMM YYYY"),
            showPageNumber: true,
        });

        await PDFGenerator.sendPDFResponse(res, {
            html: builder.build(),
            filename: `detailed-ledger-${dayjs().format("YYYY-MM-DD")}.pdf`,
            displayHeaderFooter: false,
            customStyles: `
        /* Additional custom styles for this report */
        .section {
          margin: 30px 0;
          padding: 20px;
          background: #f9f9f9;
          border-left: 4px solid #333;
        }
      `,
        });
    } catch (error) {
        console.error("Detailed ledger report error:", error);
        res.status(500).json({
            error: "Failed to generate detailed ledger report",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
