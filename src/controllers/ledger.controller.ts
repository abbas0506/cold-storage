import { Request, Response } from "express";
import dayjs from "dayjs";
import { prisma } from "../prisma/prisma";
import path from "path";
import {
    createPDFGenerator,
    registerUrduFonts,
} from "../utils/pdf";
import {
    generateInfoSection,
    generateTable,
} from "../utils/pdf/pdfkit-components";

/**
 * Generate Ledger Report PDF using PDFKit Components
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
            },
            orderBy: {
                transactionDate: "asc",
            },
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

        // Logo path
        const logoPath = path.join(__dirname, "../../logo/logo.jpg");

        // Create PDF Generator with Header and Footer
        const pdfGen = createPDFGenerator({
            pdfOptions: {
                size: "A4",
                // orientation: "landscape",
                margins: { top: 10, bottom: 10, left: 20, right: 20 },
            },
            header: {
                title: "Ledger Report",
                subtitle: farmer ? `Farmer: ${farmer.name}` : "General Ledger",
                logo: {
                    path: logoPath,
                    width: 60,
                    height: 60,
                },
                showDate: true,
                titleFont: { family: "Helvetica-Bold", size: 16 },
                subtitleFont: { size: 10, color: "#666666" },
                filterInfo: {
                    "From": from ? dayjs(from as string).format("DD MMM YYYY") : "N/A",
                    "To": to ? dayjs(to as string).format("DD MMM YYYY") : "N/A",
                    "Total": ledgerData.length.toString(),
                },
            },
            footer: {
                leftText: "Cold Storage System",
                centerText: "Ledger Report",
                showPageNumber: true,
                font: { size: 8, color: "#666666" },
            },
        });

        const doc = pdfGen.getDocument();

        // Register Urdu fonts if available
        // registerUrduFonts(doc);

        // Table - removed separate info section as it's now in header
        generateTable(
            doc,
            {
                columns: [
                    {
                        label: "Date",
                        key: "transactionDate",
                        width: 60,
                        align: "center",
                        format: (value: any) => dayjs(value).format("DD-MM-YYYY"),
                    },
                    {
                        label: "Description",
                        key: "description",
                        width: "*",
                        align: "left",
                    },
                    {
                        label: "Debit",
                        key: "debit",
                        width: 80,
                        align: "right",
                        format: (value: any) => (value ? value.toLocaleString() : "-"),
                    },
                    {
                        label: "Credit",
                        key: "credit",
                        width: 80,
                        align: "right",
                        format: (value: any) => (value ? value.toLocaleString() : "-"),
                    },
                    {
                        label: "Balance",
                        key: "balance",
                        width: 80,
                        align: "right",
                        format: (value: any) => value.toLocaleString(),
                    },
                ],
                data: dataWithBalance,
                showHeader: true,
                headerBackgroundColor: "#333333",
                headerTextColor: "#ffffff",
                headerFont: { family: "Helvetica-Bold", size: 10 },
                bodyFont: { size: 8 },
                alternateRowColor: false,
                alternateColor: "#f9f9f9",
                borderColor: "#cccccc",
                showTotal: true,
                totalLabel: "Total",
                totalColumns: {
                    debit: totalDebit,
                    credit: totalCredit,
                    balance: closingBalance,
                },
                totalBackgroundColor: "#e0e0e0",
                totalFont: { family: "Helvetica-Bold", size: 10 },
            }
        );

        pdfGen.moveDown(1);

        // // Summary Section
        // const openingBalance = dataWithBalance.length > 0
        //     ? dataWithBalance[0].balance - dataWithBalance[0].debit + dataWithBalance[0].credit
        //     : 0;

        // generateInfoSection(
        //     doc,
        //     {
        //         data: {
        //             "Opening Balance": openingBalance.toLocaleString(),
        //             "Total Debit": totalDebit.toLocaleString(),
        //             "Total Credit": totalCredit.toLocaleString(),
        //             "Closing Balance": closingBalance.toLocaleString(),
        //         },
        //         columns: 2,
        //         backgroundColor: "#fffbf0",
        //         borderColor: "#f0c040",
        //         labelFont: { family: "Helvetica-Bold", size: 11 },
        //         valueFont: { family: "Helvetica-Bold", size: 11, color: "#c06000" },
        //     }
        // );

        // Finalize and send
        const filename = `ledger-report-${dayjs().format("YYYY-MM-DD")}.pdf`;
        await pdfGen.sendToResponse(res, filename);
    } catch (error) {
        console.error("Ledger report generation error:", error);
        res.status(500).json({
            error: "Failed to generate ledger report",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};

/**
 * Generate Detailed Ledger Report with Multiple Pages using PDFKit Components
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

        // Calculate running balance
        let balance = 0;
        const dataWithBalance = ledgerData.map((row) => {
            balance += row.debit - row.credit;
            return { ...row, balance };
        });

        // Create PDF Generator with Header and Footer
        const pdfGen = createPDFGenerator({
            pdfOptions: {
                size: "A4",
                margins: { top: 140, bottom: 60, left: 50, right: 50 },
            },
            header: {
                title: "Detailed Ledger Report",
                subtitle: "Complete Transaction History",
                showDate: true,
                titleFont: { family: "Helvetica-Bold", size: 16 },
                subtitleFont: { size: 10, color: "#555555" },
                filterInfo: {
                    "From": from ? dayjs(from as string).format("DD MMM YYYY") : "Start",
                    "To": to ? dayjs(to as string).format("DD MMM YYYY") : "End",
                    "Transactions": ledgerData.length.toString(),
                },
            },
            footer: {
                leftText: "Confidential",
                centerText: "Detailed Ledger",
                showPageNumber: true,
                pageNumberFormat: (current, total) => `Page ${current} of ${total}`,
                font: { size: 8, color: "#666666" },
            },
        });

        const doc = pdfGen.getDocument();

        // Register Urdu fonts if available
        registerUrduFonts(doc);

        // Page 1: Executive Summary
        doc.fontSize(14)
            .font("Helvetica-Bold")
            .fillColor("#333333")
            .text("Executive Summary", 50, doc.y);

        pdfGen.moveDown(0.5);

        generateInfoSection(
            doc,
            {
                data: {
                    "Report Period": `${from ? dayjs(from as string).format("DD MMM YYYY") : "Start"} to ${to ? dayjs(to as string).format("DD MMM YYYY") : "End"}`,
                    "Total Transactions": ledgerData.length.toString(),
                    "Status": "Generated",
                    "Generated By": "System Administrator",
                },
                columns: 2,
                backgroundColor: "#f0f8ff",
                borderColor: "#4682b4",
                labelFont: { family: "Helvetica-Bold", size: 10 },
                valueFont: { size: 10 },
            }
        );

        pdfGen.moveDown(1);

        doc.fontSize(10)
            .font("Helvetica")
            .fillColor("#000000")
            .text(
                "This report provides a detailed overview of all ledger transactions for the specified period. " +
                "Each transaction is listed with its date, description, debit/credit amounts, and running balance. " +
                "The report includes automatic page breaks and sequential page numbering.",
                { align: "justify", width: 495 }
            );

        // Add page break for transaction details
        pdfGen.addPage();

        doc.fontSize(16)
            .font("Helvetica-Bold")
            .text("Transaction Details");

        pdfGen.moveDown(1);

        // Detailed Transaction Table
        generateTable(
            doc,
            {
                columns: [
                    {
                        label: "Date",
                        key: "transactionDate",
                        width: 90,
                        align: "center",
                        format: (value: any) => dayjs(value).format("DD-MM-YYYY"),
                    },
                    {
                        label: "Description",
                        key: "description",
                        width: "*",
                        align: "left",
                    },
                    {
                        label: "Debit",
                        key: "debit",
                        width: 90,
                        align: "right",
                        format: (value: any) => (value ? value.toLocaleString() : "-"),
                    },
                    {
                        label: "Credit",
                        key: "credit",
                        width: 90,
                        align: "right",
                        format: (value: any) => (value ? value.toLocaleString() : "-"),
                    },
                    {
                        label: "Balance",
                        key: "balance",
                        width: 90,
                        align: "right",
                        format: (value: any) => value.toLocaleString(),
                    },
                ],
                data: dataWithBalance,
                showHeader: true,
                headerBackgroundColor: "#2c3e50",
                headerTextColor: "#ffffff",
                headerFont: { family: "Helvetica-Bold", size: 9 },
                bodyFont: { size: 8 },
                alternateRowColor: true,
                alternateColor: "#f8f9fa",
                borderColor: "#dee2e6",
                rowHeight: 20,
                headerHeight: 25,
            }
        );

        // Finalize and send
        const filename = `detailed-ledger-${dayjs().format("YYYY-MM-DD")}.pdf`;
        await pdfGen.sendToResponse(res, filename);
    } catch (error) {
        console.error("Detailed ledger report error:", error);
        res.status(500).json({
            error: "Failed to generate detailed ledger report",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
