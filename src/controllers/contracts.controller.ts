// src/controllers/storagePlans.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";
import dayjs from "dayjs";
import path from "path";
import {
  createPDFGenerator,
  getReportFontTheme,
} from "../utils/pdf";
import {
  generateInfoSection,
  generateTable,
  generateSignatureSection,
} from "../utils/pdf/pdfkit-components";

// Get allstorage contracts
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const storeId = Number(req.params.storeId);
    const q = req.query.q as string | undefined;
    const farmers = await prisma.farmer.findMany({
      where: { storeId: storeId, name: q ? { contains: q, mode: "insensitive" } : undefined },
    });
    const farmerIds = farmers.map((f) => f.id);
    const [items, total] = await Promise.all([
      prisma.contract.findMany({
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              items: {
                where: {
                  movements: {
                    some: {
                      movementType: "IN",
                    }
                  },
                },
              }
            }
          },
          farmer: true,
          items: {
            include: {
              item: true,
            },
          },
        },
        where: { farmerId: { in: farmerIds }, contractCode: q ? { contains: q, mode: "insensitive" } : undefined },
        orderBy: { id: "desc" },

      }),
      prisma.contract.count({ where: { farmerId: { in: farmerIds }, contractCode: q ? { contains: q, mode: "insensitive" } : undefined } }),
    ]);

    res.json(createPaginatedResponse(items, total, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetchingstorage contracts" });
  }
};

// Create a newstorage contract
export const create = async (req: Request, res: Response) => {
  try {
    const {
      farmerId,
      expectedEndDate,
      notes,
      taxRate,
      items,
    } = req.body;
    const storeId = Number(req.params.storeId);
    if (!req.params.storeId) {
      return res.status(400).json({ message: "storeId param is missing" });
    }
    if (Number.isNaN(storeId) || storeId <= 0) {
      return res.status(400).json({ message: "Invalid storeId" });
    }

    const netAmount = items.reduce((acc: number, item: any) => acc + item.quantity * item.unitRate, 0);
    const taxAmount = netAmount * (taxRate / 100); // Assuming a 16% sales tax
    const totalAmount = netAmount + taxAmount;

    const countContract = await prisma.contract.count({
      where: {
        farmerId: farmerId
      }
    });
    const codePad = String(countContract + 1).padStart(4, '0');
    const farmerPad = String(farmerId).padStart(4, '0');
    const contractCode = 'CON-' + farmerPad + "-" + codePad;

    const newRecord = await prisma.contract.create({
      data: {
        farmerId,
        contractCode,
        startDate: new Date(),
        expectedEndDate,
        actualEndDate: expectedEndDate,
        status: 'ACTIVE',
        notes,
        netAmount,
        totalAmount,
        salesTaxAmount: taxAmount,
        saleTaxRate: taxRate / 100,
      },
    });

    for (const item of items) {
      await prisma.contractLine.create({
        data: {
          contractId: newRecord.id,
          itemId: item.itemId,
          quantity: item.quantity,
          packagingType: item.packagingType,
          unitRate: item.unitRate,
        },
      });
    }
    const ledgerEntry = await prisma.ledger.create({
      data: {
        farmerId: farmerId,
        debit: totalAmount,
        credit: 0,
        description: `Storage contract ${contractCode} created with total amount ${totalAmount}`,
      },
    });

    // update the contract with the ledger entry ID
    await prisma.contract.update({
      where: { id: newRecord.id },
      data: { ledgerId: ledgerEntry.id },
    });
    const contract = await prisma.contract.findUnique({
      where: { id: newRecord.id },
      include: {
        farmer: true,
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    return res.status(201).json(contract);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a singlestorage contract by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.contract.findUnique({
      where: { id },
      include: {
        farmer: true,
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    if (!record) {
      return res.status(404).json({ message: "Storage contract not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetchingstorage contract" });
  }
};

// Update astorage contract by ID
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const {
      farmerId,
      contractCode,
      startDate,
      expectedEndDate,
      actualEndDate,
      taxRate,
      status,
      notes,
      items,
    } = req.body;

    const updatedstoragePlan = await prisma.contract.update({
      where: { id },
      data: {
        farmerId,
        contractCode,
        startDate,
        expectedEndDate,
        actualEndDate,
        status,
        notes,
        saleTaxRate: taxRate != null ? taxRate / 100 : undefined,
      },
    });

    for (const line of items) {
      if (line.id) {
        // Update existing line item
        await prisma.contractLine.update({
          where: { id: line.id },
          data: {
            itemId: line.itemId,
            quantity: line.quantity,
            packagingType: line.packagingType,
            unitRate: line.unitRate,
          },
        });
      } else {
        // Create new line item
        await prisma.contractLine.create({
          data: {
            contractId: updatedstoragePlan.id,
            itemId: line.itemId,
            quantity: line.quantity,
            packagingType: line.packagingType,
            unitRate: line.unitRate,
          },
        });
      }
    }
    res.json(updatedstoragePlan);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      // Prisma "record not found" error
      return res.status(404).json({ message: "Storage contract not found" });
    }
    res.status(500).json({ message: "Error updatingstorage contract" });
  }
};

/** 
 * Generte contract status update - ACTIVE, COMPLETED, CANCELLED
 */

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status, fineAmount, numOfStock } = req.body;

    const updatedContract = await prisma.contract.update({
      where: { id },
      data: { status },
    });

    if (fineAmount && status === "COMPLETED") {

      await prisma.ledger.create({
        data: {
          farmerId: updatedContract.farmerId,
          debit: fineAmount,
          credit: 0,
          description: `Fine applied for contract ${updatedContract.contractCode} with stockout of ${numOfStock} after expected end date`,
        },
      });
    }

    res.json(updatedContract);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Storage contract not found" });
    }
    res.status(500).json({ message: "Error updatingstorage contract status" });
  }
};

/** 
 * Generate the Contract fine if contract stock is stockout after expected end date.
 */

export const getFineCalculations = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const contract = await prisma.contract.findUnique({
      where: { id },
    });
    if (!contract) {
      return res.status(404).json({ message: "Storage contract not found" });
    }

    const lines = await prisma.contractLine.findMany({
      where: {
        contractId: id,
        movements: contract.expectedEndDate ? {
          some: {
            movementType: "OUT",
            movementDate: {
              gt: contract.expectedEndDate,
            },
          },
        } : undefined,
      },
    });

    const numberOfStockout = lines.reduce((acc, line) => {
      return acc + (line.quantity ?? 0);
    }, 0);

    const numberOfDaysLate = dayjs().diff(dayjs(contract.expectedEndDate), "day");

    return res.json({
      numberOfStockout,
      numberOfDaysLate,
      fineAmount: numberOfStockout * 200,
    });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Storage contract not found" });
    }
    res.status(500).json({ message: "Error generating fine for storage contract" });
  }
}

/**
 * Generate Contract Report PDF using PDFKit Components (A5 Landscape)
 */
export const generateContractReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Fetch contract data with relations
    const contract = await prisma.contract.findUnique({
      where: { id: Number(id) },
      include: {
        farmer: true,
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    if (!contract) {
      res.status(404).json({ message: "Contract not found" });
      return;
    }

    // Calculate totals
    const items = contract.items.map((line) => ({
      itemName: line.item?.name || "N/A",
      packagingType: line.packagingType || "N/A",
      quantity: line.quantity || 0,
      unitRate: line.unitRate || 0,
      amount: (line.quantity || 0) * (line.unitRate || 0),
    }));

    // Logo path
    const logoPath = path.join(__dirname, "../../logo/logo.jpg");
    const reportFonts = getReportFontTheme();

    // Create PDF Generator with Header and Footer (A5 Landscape)
    const pdfGen = createPDFGenerator({
      fontRegistrations: reportFonts.registrations,
      fontFamilyMap: reportFonts.aliasMap,
      pdfOptions: {
        size: "A5",
        orientation: "landscape",
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
      },
      header: {
        title: "Storage Contract",
        subtitle: `${contract.contractCode}`,
        logo: {
          path: logoPath,
          width: 50,
          height: 50,
        },
        showDate: true,
        titleFont: { family: reportFonts.bold, size: 14 },
        subtitleFont: { size: 9, color: "#666666" },
        filterInfo: {
          "Status": contract.status,
          "Start": dayjs(contract.startDate).format("DD MMM YYYY"),
          "End": contract.expectedEndDate
            ? dayjs(contract.expectedEndDate).format("DD MMM YYYY")
            : "N/A",
        },
      },
      footer: {
        leftText: "ABC Cold Storage",
        centerText: "Storage Contract",
        showPageNumber: true,
        font: { size: 7, color: "#666666" },
      },
    });

    const doc = pdfGen.getDocument();

    // Contract Information Section
    generateInfoSection(
      doc,
      {
        data: {
          "Farmer Name": contract.farmer.name,
          "Phone": contract.farmer.phone || "N/A",
          "CNIC": contract.farmer.cnic || "N/A",
          "Address": contract.farmer.address || "N/A",
        },
        columns: 4,
        // backgroundColor: "#f9f9f9",
        // borderColor: "#e0e0e0",
        padding: 2,
        labelFont: { family: reportFonts.bold, size: 8 },
        valueFont: { family: reportFonts.regular, size: 8 },
      }
    );

    pdfGen.moveDown(0.8);

    // Items Table
    generateTable(
      doc,
      {
        columns: [
          {
            label: "Item",
            key: "itemName",
            width: "*",
            align: "left",
          },
          {
            label: "Packaging",
            key: "packagingType",
            width: 70,
            align: "center",
          },
          {
            label: "Quantity",
            key: "quantity",
            width: 60,
            align: "right",
            format: (value: any) => value.toLocaleString(),
          },
          {
            label: "Rate",
            key: "unitRate",
            width: 60,
            align: "right",
            format: (value: any) => value.toLocaleString(),
          },
          {
            label: "Amount",
            key: "amount",
            width: 70,
            align: "right",
            format: (value: any) => value.toLocaleString(),
          },
        ],
        data: items,
        showHeader: true,
        headerBackgroundColor: "#333333",
        headerTextColor: "#ffffff",
        headerFont: { family: reportFonts.bold, size: 9 },
        bodyFont: { family: reportFonts.regular, size: 8 },
        alternateRowColor: false,
        alternateColor: "#f9f9f9",
        borderColor: "#cccccc",
        showTotal: true,
        totalLabel: "Total",
        totalColumns: {
          amount: contract.netAmount,
        },
        totalBackgroundColor: "#e0e0e0",
        totalFont: { family: reportFonts.bold, size: 9 },
      }
    );

    pdfGen.moveDown(0.8);

    // Financial Summary
    generateInfoSection(
      doc,
      {
        data: {
          "Net Amount": contract.netAmount.toLocaleString(),
          "Sales Tax": `${(contract.saleTaxRate * 100).toFixed(0)}%`,
          "Tax Amount": contract.salesTaxAmount.toLocaleString(),
          "Total Amount": contract.totalAmount.toLocaleString(),
        },
        columns: 4,
        borderColor: "#f0c040",
        padding: 8,
        labelFont: { family: reportFonts.bold, size: 8 },
        valueFont: { family: reportFonts.bold, size: 8, color: "#c06000" },
      }
    );

    pdfGen.moveDown(1.5);

    // Signature Section
    generateSignatureSection(
      doc,
      {
        signatures: [
          {
            label: "Prepared By",
            name: "_________________",
            title: "Storage Manager",
          },
          {
            label: "Farmer Signature",
            name: "_________________",
            title: contract.farmer.name,
          },
          {
            label: "Authorized By",
            name: "_________________",
            title: "General Manager",
          },
        ],
        spacing: 30,
        lineWidth: 100,
        labelFont: { family: reportFonts.bold, size: 8 },
        nameFont: { family: reportFonts.regular, size: 9 },
      }
    );

    // Finalize and send
    const filename = `contract-${contract.contractCode}-${dayjs().format("YYYY-MM-DD")}.pdf`;
    await pdfGen.sendToResponse(res, filename);
  } catch (error) {
    console.error("Contract report generation error:", error);
    res.status(500).json({
      error: "Failed to generate contract report",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
// Delete astorage contract by ID
export const destroy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.contract.delete({
      where: { id },
    });

    res.json({ message: "Storage contract deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Storage contract not found" });
    }
    res.status(500).json({ message: "Error deletingstorage contract" });
  }
};


export const updateFbrInvoice = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { fbrInvoiceNumber } = req.body;
    const updatedContract = await prisma.contract.update({
      where: { id },
      data: { fbrInvoiceNumber },
    });
    res.json(updatedContract);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Storage contract not found" });
    }
    res.status(500).json({ message: "Error updating FBR invoice number" });
  }
};