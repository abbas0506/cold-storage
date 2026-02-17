// src/controllers/storagePlans.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get allstorage contracts
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const storeId = Number(req.params.storeId);
    const farmers = await prisma.farmer.findMany({
      where: { storeId: storeId },
    });
    const farmerIds = farmers.map((f) => f.id);
    const [items, total] = await Promise.all([
      prisma.contract.findMany({
        skip,
        take: pageSize,
        include: {
          farmer: true,
          items: {
            include: {
              item: true,
            },
          },
        },
        where: { farmerId: { in: farmerIds } },
      }),
      prisma.contract.count({ where: { farmerId: { in: farmerIds } } }),
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
    const taxAmount = netAmount * 0.16; // Assuming a 16% sales tax
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
        saleTaxRate: 0.16,
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

    const balanceSub = await prisma.ledger.findFirst({
      where: {
        farmerId: farmerId,
      },
      orderBy: {
        id: 'desc',
      }
    });
    const balance = balanceSub ? balanceSub.balance + totalAmount : totalAmount;

    const ledgerEntry = await prisma.ledger.create({
      data: {
        farmerId: farmerId,
        debit: totalAmount,
        credit: 0,
        balance: balance,
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