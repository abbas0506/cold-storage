import { Request, Response } from "express";
import dayjs from "dayjs";
import path from "path";
import { prisma } from "../prisma/prisma";
import { createPDFGenerator, getReportFontTheme } from "../utils/pdf";
import {
    generateSignatureSection,
} from "../utils/pdf/pdfkit-components";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const logoPath = path.join(__dirname, "../../logo/logo.jpg");

function fonts() {
    return getReportFontTheme();
}

function fmtCurrency(v: any) {
    return v != null ? Number(v).toLocaleString() : "0";
}

function fmtDate(v: any, fmt = "DD MMM YYYY") {
    return v ? dayjs(v).format(fmt) : "N/A";
}

function pdfConfig(
    title: string,
    subtitle: string,
    filterInfo: Record<string, string | number>,
    orientation: "portrait" | "landscape" = "portrait",
    size: "A4" | "A5" | "A3" = "A4"
) {
    const reportFonts = fonts();
    return {
        fontRegistrations: reportFonts.registrations,
        fontFamilyMap: reportFonts.aliasMap,
        pdfOptions: {
            size: size as any,
            orientation,
            margins: { top: 10, bottom: 10, left: 20, right: 20 },
        },
        header: {
            title,
            subtitle,
            logo: { path: logoPath, width: 60, height: 60 },
            showDate: true,
            titleFont: { family: "Helvetica-Bold" as const, size: 16 },
            subtitleFont: { size: 10, color: "#666666" },
            filterInfo,
        },
        footer: {
            leftText: "Cold Storage System",
            centerText: title,
            showPageNumber: true,
            font: { size: 8, color: "#666666" },
        },
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. STORE SUMMARY REPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const storeSummaryReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const stores = await prisma.coldStore.findMany({
            include: {
                rooms: { include: { racks: true } },
                user: { select: { username: true } },
            },
        });

        const rows = await Promise.all(
            stores.map(async (store) => {
                const totalCapacity = store.rooms.reduce((s, r) => s + r.roomCapacity, 0);
                const currentStock = store.rooms.reduce(
                    (s, r) => s + r.racks.reduce((rs, rack) => rs + rack.currentStock, 0),
                    0
                );
                const activeContracts = await prisma.contract.count({
                    where: { farmer: { storeId: store.id }, status: "ACTIVE" },
                });
                const farmersCount = await prisma.farmer.count({ where: { storeId: store.id } });

                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const revenue = await prisma.contract.aggregate({
                    where: { farmer: { storeId: store.id }, createdAt: { gte: startOfMonth } },
                    _sum: { netAmount: true },
                });

                return {
                    name: store.name,
                    address: store.address || "N/A",
                    manager: store.user?.username || "N/A",
                    rooms: store.rooms.length,
                    totalCapacity,
                    currentStock,
                    utilization: totalCapacity > 0 ? ((currentStock / totalCapacity) * 100).toFixed(1) + "%" : "0%",
                    farmersCount,
                    activeContracts,
                    monthlyRevenue: revenue._sum.netAmount || 0,
                };
            })
        );

        const totals = {
            totalCapacity: rows.reduce((s, r) => s + r.totalCapacity, 0),
            currentStock: rows.reduce((s, r) => s + r.currentStock, 0),
            farmersCount: rows.reduce((s, r) => s + r.farmersCount, 0),
            activeContracts: rows.reduce((s, r) => s + r.activeContracts, 0),
            monthlyRevenue: rows.reduce((s, r) => s + r.monthlyRevenue, 0),
        };

        const pdfGen = createPDFGenerator(
            pdfConfig("Store Summary Report", "Overview of All Cold Stores", {
                "Total Stores": stores.length,
                "Generated": dayjs().format("DD MMM YYYY"),
            }, "landscape")
        );
        const doc = pdfGen.getDocument();

        doc.x = doc.page.margins.left;
        const table = doc.table({
            columnStyles: ["*", 100, 45, 60, 55, 50, 50, 60, 80],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        table.row([
            { text: "Store Name", align: { x: "left", y: "center" } },
            { text: "Address", align: { x: "left", y: "center" } },
            { text: "Rooms", align: { x: "center", y: "center" } },
            { text: "Capacity", align: { x: "right", y: "center" } },
            { text: "Stock", align: { x: "right", y: "center" } },
            { text: "Util %", align: { x: "center", y: "center" } },
            { text: "Farmers", align: { x: "center", y: "center" } },
            { text: "Active Contracts", align: { x: "center", y: "center" } },
            { text: "Monthly Rev.", align: { x: "right", y: "center" } },
        ]);
        rows.forEach((row) => {
            table.row([
                row.name,
                row.address,
                { text: String(row.rooms), align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.totalCapacity), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.currentStock), align: { x: "right", y: "center" } },
                { text: row.utilization, align: { x: "center", y: "center" } },
                { text: String(row.farmersCount), align: { x: "center", y: "center" } },
                { text: String(row.activeContracts), align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.monthlyRevenue), align: { x: "right", y: "center" } },
            ]);
        });
        table.row([
            { text: "Grand Total", colSpan: 3, align: { x: "justify", y: "center" } },
            { text: fmtCurrency(totals.totalCapacity), align: { x: "right", y: "center" } },
            { text: fmtCurrency(totals.currentStock), align: { x: "right", y: "center" } },
            { text: "", align: { x: "center", y: "center" } },
            { text: totals.farmersCount.toString(), align: { x: "center", y: "center" } },
            { text: totals.activeContracts.toString(), align: { x: "center", y: "center" } },
            { text: fmtCurrency(totals.monthlyRevenue), align: { x: "right", y: "center" } },
        ]);
        table.end();

        await pdfGen.sendToResponse(res, `store-summary-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Store summary report error:", error);
        res.status(500).json({ error: "Failed to generate store summary report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ROOM OCCUPANCY REPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const roomOccupancyReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);
        const store = await prisma.coldStore.findUnique({
            where: { id: storeId },
            include: {
                rooms: {
                    include: {
                        racks: true,
                    },
                },
            },
        });

        if (!store) { res.status(404).json({ message: "Store not found" }); return; }

        const rows = store.rooms.map((room) => {
            const rackCapacity = room.racks.reduce((s, r) => s + (r.capacity || 0), 0);
            const rackStock = room.racks.reduce((s, r) => s + r.currentStock, 0);
            return {
                roomName: room.name,
                floors: room.numOfFloors,
                racks: room.numOfRacks,
                roomCapacity: room.roomCapacity,
                rackCapacity,
                currentStock: rackStock,
                available: rackCapacity - rackStock,
                utilization: rackCapacity > 0 ? ((rackStock / rackCapacity) * 100).toFixed(1) + "%" : "0%",
                tempRange: room.tempMin != null ? `${room.tempMin}°C - ${room.tempMax}°C` : "N/A",
                status: room.isActive ? "Active" : "Inactive",
            };
        });

        const pdfGen = createPDFGenerator(
            pdfConfig("Room Occupancy Report", `Store: ${store.name}`, {
                "Store": store.name,
                "Total Rooms": store.rooms.length,
            }, "landscape")
        );
        const doc = pdfGen.getDocument();

        doc.x = doc.page.margins.left;
        const table = doc.table({
            columnStyles: ["*", 45, 45, 65, 65, 60, 60, 50, 80, 50],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        table.row([
            { text: "Room", align: { x: "left", y: "center" } },
            { text: "Floors", align: { x: "center", y: "center" } },
            { text: "Racks", align: { x: "center", y: "center" } },
            { text: "Room Cap.", align: { x: "right", y: "center" } },
            { text: "Rack Cap.", align: { x: "right", y: "center" } },
            { text: "Current", align: { x: "right", y: "center" } },
            { text: "Available", align: { x: "right", y: "center" } },
            { text: "Util %", align: { x: "center", y: "center" } },
            { text: "Temp Range", align: { x: "center", y: "center" } },
            { text: "Status", align: { x: "center", y: "center" } },
        ]);
        rows.forEach((row) => {
            table.row([
                row.roomName,
                { text: String(row.floors), align: { x: "center", y: "center" } },
                { text: String(row.racks), align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.roomCapacity), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.rackCapacity), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.currentStock), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.available), align: { x: "right", y: "center" } },
                { text: row.utilization, align: { x: "center", y: "center" } },
                { text: row.tempRange, align: { x: "center", y: "center" } },
                { text: row.status, align: { x: "center", y: "center" } },
            ]);
        });
        table.row([
            { text: "Total", colSpan: 3, align: { x: "justify", y: "center" } },
            { text: fmtCurrency(rows.reduce((s, r) => s + r.roomCapacity, 0)), align: { x: "right", y: "center" } },
            { text: fmtCurrency(rows.reduce((s, r) => s + r.rackCapacity, 0)), align: { x: "right", y: "center" } },
            { text: fmtCurrency(rows.reduce((s, r) => s + r.currentStock, 0)), align: { x: "right", y: "center" } },
            { text: fmtCurrency(rows.reduce((s, r) => s + r.available, 0)), align: { x: "right", y: "center" } },
            { text: "", colSpan: 3, align: { x: "center", y: "center" } },
        ]);
        table.end();

        // Rack detail per room
        for (const room of store.rooms) {
            if (room.racks.length === 0) continue;
            pdfGen.addPage();
            const doc2 = pdfGen.getDocument();
            doc2.fontSize(14).font("Helvetica-Bold").fillColor("#333333").text(`Room: ${room.name} — Rack Details`);
            pdfGen.moveDown(0.5);

            const rackRows = room.racks.map((rack) => ({
                rackName: rack.name,
                capacity: rack.capacity || 0,
                currentStock: rack.currentStock,
                available: (rack.capacity || 0) - rack.currentStock,
                utilization: rack.capacity && rack.capacity > 0
                    ? ((rack.currentStock / rack.capacity) * 100).toFixed(1) + "%"
                    : "0%",
            }));

            doc2.x = doc2.page.margins.left;
            const rackTable = doc2.table({
                columnStyles: ["*", 80, 80, 80, 80],
                rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
            });
            rackTable.row([
                { text: "Rack Name", align: { x: "left", y: "center" } },
                { text: "Capacity", align: { x: "right", y: "center" } },
                { text: "Current Stock", align: { x: "right", y: "center" } },
                { text: "Available", align: { x: "right", y: "center" } },
                { text: "Utilization", align: { x: "center", y: "center" } },
            ]);
            rackRows.forEach((rack) => {
                rackTable.row([
                    rack.rackName,
                    { text: fmtCurrency(rack.capacity), align: { x: "right", y: "center" } },
                    { text: fmtCurrency(rack.currentStock), align: { x: "right", y: "center" } },
                    { text: fmtCurrency(rack.available), align: { x: "right", y: "center" } },
                    { text: rack.utilization, align: { x: "center", y: "center" } },
                ]);
            });
            rackTable.end();
        }

        await pdfGen.sendToResponse(res, `room-occupancy-${store.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Room occupancy report error:", error);
        res.status(500).json({ error: "Failed to generate room occupancy report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. STOCK INVENTORY REPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const stockInventoryReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);
        const store = await prisma.coldStore.findUnique({
            where: { id: storeId },
            include: {
                rooms: {
                    include: {
                        racks: {
                            include: {
                                stockMovements: {
                                    include: {
                                        contractLine: {
                                            include: {
                                                item: true,
                                                contract: { include: { farmer: true } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!store) { res.status(404).json({ message: "Store not found" }); return; }

        // Build inventory rows from racks that currently have stock
        const rows: any[] = [];
        for (const room of store.rooms) {
            for (const rack of room.racks) {
                if (rack.currentStock <= 0) continue;
                // Group latest movements to find what's stored
                const inMovements = rack.stockMovements
                    .filter((m) => m.movementType === "IN")
                    .sort((a, b) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime());

                const itemName = inMovements[0]?.contractLine?.item?.name || "N/A";
                const farmerName = inMovements[0]?.contractLine?.contract?.farmer?.name || "N/A";
                const contractCode = inMovements[0]?.contractLine?.contract?.contractCode || "N/A";

                rows.push({
                    room: room.name,
                    rack: rack.name,
                    item: itemName,
                    farmer: farmerName,
                    contract: contractCode,
                    capacity: rack.capacity || 0,
                    currentStock: rack.currentStock,
                    available: (rack.capacity || 0) - rack.currentStock,
                });
            }
        }

        const totalStock = rows.reduce((s, r) => s + r.currentStock, 0);
        const totalCapacity = rows.reduce((s, r) => s + r.capacity, 0);

        const pdfGen = createPDFGenerator(
            pdfConfig("Stock Inventory Report", `Store: ${store.name}`, {
                "Store": store.name,
                "Total Items in Stock": totalStock,
                "Date": dayjs().format("DD MMM YYYY"),
            }, "landscape")
        );
        const doc = pdfGen.getDocument();

        doc.x = doc.page.margins.left;
        const table = doc.table({
            columnStyles: [80, 80, "*", 100, 80, 60, 55, 60],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        table.row([
            { text: "Room", align: { x: "left", y: "center" } },
            { text: "Rack", align: { x: "left", y: "center" } },
            { text: "Item", align: { x: "left", y: "center" } },
            { text: "Farmer", align: { x: "left", y: "center" } },
            { text: "Contract", align: { x: "center", y: "center" } },
            { text: "Capacity", align: { x: "right", y: "center" } },
            { text: "Stock", align: { x: "right", y: "center" } },
            { text: "Available", align: { x: "right", y: "center" } },
        ]);
        rows.forEach((row) => {
            table.row([
                row.room,
                row.rack,
                row.item,
                row.farmer,
                { text: row.contract, align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.capacity), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.currentStock), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.available), align: { x: "right", y: "center" } },
            ]);
        });
        table.row([
            { text: "Grand Total", colSpan: 5, align: { x: "justify", y: "center" } },
            { text: fmtCurrency(totalCapacity), align: { x: "right", y: "center" } },
            { text: fmtCurrency(totalStock), align: { x: "right", y: "center" } },
            { text: fmtCurrency(totalCapacity - totalStock), align: { x: "right", y: "center" } },
        ]);
        table.end();

        await pdfGen.sendToResponse(res, `stock-inventory-${store.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Stock inventory report error:", error);
        res.status(500).json({ error: "Failed to generate stock inventory report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. STOCK MOVEMENT REPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const stockMovementReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);
        const { from, to, type } = req.query;

        const store = await prisma.coldStore.findUnique({ where: { id: storeId } });
        if (!store) { res.status(404).json({ message: "Store not found" }); return; }

        const farmers = await prisma.farmer.findMany({ where: { storeId } });
        const farmerIds = farmers.map((f) => f.id);

        const movements = await prisma.stockMovement.findMany({
            where: {
                contractLine: {
                    contract: { farmerId: { in: farmerIds } },
                },
                movementDate: {
                    gte: from ? new Date(from as string) : undefined,
                    lte: to ? new Date(to as string) : undefined,
                },
                ...(type ? { movementType: type as any } : {}),
            },
            include: {
                contractLine: {
                    include: {
                        item: true,
                        contract: { include: { farmer: true } },
                    },
                },
                rack: { include: { room: true } },
            },
            orderBy: { movementDate: "desc" },
        });

        const rows = movements.map((m, i) => ({
            sno: i + 1,
            date: m.movementDate,
            type: m.movementType,
            item: m.contractLine?.item?.name || "N/A",
            farmer: m.contractLine?.contract?.farmer?.name || "N/A",
            contract: m.contractLine?.contract?.contractCode || "N/A",
            room: m.rack?.room?.name || "N/A",
            rack: m.rack?.name || "N/A",
            quantity: m.quantity,
            note: m.referenceNote || "",
        }));

        const totalIn = movements.filter((m) => m.movementType === "IN").reduce((s, m) => s + m.quantity, 0);
        const totalOut = movements.filter((m) => m.movementType === "OUT").reduce((s, m) => s + m.quantity, 0);

        const pdfGen = createPDFGenerator(
            pdfConfig("Stock Movement Report", `Store: ${store.name}`, {
                "From": from ? dayjs(from as string).format("DD MMM YYYY") : "All",
                "To": to ? dayjs(to as string).format("DD MMM YYYY") : "All",
                "Type": (type as string) || "All",
                "Total Records": movements.length,
            }, "landscape")
        );
        const doc = pdfGen.getDocument();

        doc.x = doc.page.margins.left;
        const table = doc.table({
            columnStyles: [30, 70, 40, "*", 90, 80, 60, 60, 50, 80],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        table.row([
            { text: "#", align: { x: "center", y: "center" } },
            { text: "Date", align: { x: "center", y: "center" } },
            { text: "Type", align: { x: "center", y: "center" } },
            { text: "Item", align: { x: "left", y: "center" } },
            { text: "Farmer", align: { x: "left", y: "center" } },
            { text: "Contract", align: { x: "center", y: "center" } },
            { text: "Room", align: { x: "center", y: "center" } },
            { text: "Rack", align: { x: "center", y: "center" } },
            { text: "Qty", align: { x: "right", y: "center" } },
            { text: "Note", align: { x: "left", y: "center" } },
        ]);
        rows.forEach((row) => {
            table.row([
                { text: String(row.sno), align: { x: "center", y: "center" } },
                { text: fmtDate(row.date, "DD-MM-YYYY"), align: { x: "center", y: "center" } },
                { text: row.type, align: { x: "center", y: "center" } },
                { text: row.item, align: { x: "left", y: "center" } },
                { text: row.farmer, align: { x: "left", y: "center" } },
                { text: row.contract, align: { x: "center", y: "center" } },
                { text: row.room, align: { x: "center", y: "center" } },
                { text: row.rack, align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.quantity), align: { x: "right", y: "center" } },
                { text: row.note, align: { x: "left", y: "center" } },
            ]);
        });
        doc.fontSize(9);
        table.row([
            { text: "Total", colSpan: 8, align: { x: "justify", y: "center" } },
            { text: `IN: ${fmtCurrency(totalIn)} | OUT: ${fmtCurrency(totalOut)}`, colSpan: 2, align: { x: "right", y: "center" } },
        ]);
        table.end();

        await pdfGen.sendToResponse(res, `stock-movements-${store.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Stock movement report error:", error);
        res.status(500).json({ error: "Failed to generate stock movement report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. REVENUE REPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const revenueReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);
        const { from, to } = req.query;

        const store = await prisma.coldStore.findUnique({ where: { id: storeId } });
        if (!store) { res.status(404).json({ message: "Store not found" }); return; }

        const farmers = await prisma.farmer.findMany({ where: { storeId } });
        const farmerIds = farmers.map((f) => f.id);

        const contracts = await prisma.contract.findMany({
            where: {
                farmerId: { in: farmerIds },
                createdAt: {
                    gte: from ? new Date(from as string) : undefined,
                    lte: to ? new Date(to as string) : undefined,
                },
            },
            include: { farmer: true },
            orderBy: { createdAt: "desc" },
        });

        const rows = contracts.map((c, i) => ({
            sno: i + 1,
            date: c.createdAt,
            contractCode: c.contractCode,
            farmer: c.farmer.name,
            status: c.status,
            netAmount: c.netAmount,
            taxRate: (c.saleTaxRate * 100).toFixed(0) + "%",
            taxAmount: c.salesTaxAmount,
            totalAmount: c.totalAmount,
        }));

        const totalNet = contracts.reduce((s, c) => s + c.netAmount, 0);
        const totalTax = contracts.reduce((s, c) => s + c.salesTaxAmount, 0);
        const totalAmount = contracts.reduce((s, c) => s + c.totalAmount, 0);

        // Payment summary
        const payments = await prisma.payment.findMany({
            where: {
                farmerId: { in: farmerIds },
                createdAt: {
                    gte: from ? new Date(from as string) : undefined,
                    lte: to ? new Date(to as string) : undefined,
                },
            },
        });
        const totalPayments = payments.reduce((s, p) => s + p.amount, 0);

        const pdfGen = createPDFGenerator(
            pdfConfig("Revenue Report", `Store: ${store.name}`, {
                "From": from ? dayjs(from as string).format("DD MMM YYYY") : "All Time",
                "To": to ? dayjs(to as string).format("DD MMM YYYY") : "Now",
                "Contracts": contracts.length,
            }, "landscape")
        );
        const doc = pdfGen.getDocument();

        // Summary section
        doc.x = doc.page.margins.left;
        const summaryTable = doc.table({
            columnStyles: ["*", "*", "*"],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        summaryTable.row([
            { text: "Total Net Revenue", align: { x: "left", y: "center" } },
            { text: "Total Tax Collected", align: { x: "left", y: "center" } },
            { text: "Total Gross Revenue", align: { x: "left", y: "center" } },
        ]);
        summaryTable.row([
            { text: fmtCurrency(totalNet), align: { x: "left", y: "center" } },
            { text: fmtCurrency(totalTax), align: { x: "left", y: "center" } },
            { text: fmtCurrency(totalAmount), align: { x: "left", y: "center" } },
        ]);
        summaryTable.row([
            { text: "Total Payments Received", align: { x: "left", y: "center" } },
            { text: "Outstanding Balance", align: { x: "left", y: "center" } },
            { text: "Collection Rate", align: { x: "left", y: "center" } },
        ]);
        summaryTable.row([
            { text: fmtCurrency(totalPayments), align: { x: "left", y: "center" } },
            { text: fmtCurrency(totalAmount - totalPayments), align: { x: "left", y: "center" } },
            { text: totalAmount > 0 ? ((totalPayments / totalAmount) * 100).toFixed(1) + "%" : "0%", align: { x: "left", y: "center" } },
        ]);
        summaryTable.end();

        pdfGen.moveDown(0.5);

        doc.x = doc.page.margins.left;
        const table = doc.table({
            columnStyles: [30, 70, 90, "*", 60, 80, 45, 70, 80],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        table.row([
            { text: "#", align: { x: "center", y: "center" } },
            { text: "Date", align: { x: "center", y: "center" } },
            { text: "Contract", align: { x: "center", y: "center" } },
            { text: "Farmer", align: { x: "left", y: "center" } },
            { text: "Status", align: { x: "center", y: "center" } },
            { text: "Net Amount", align: { x: "right", y: "center" } },
            { text: "Tax %", align: { x: "center", y: "center" } },
            { text: "Tax Amt", align: { x: "right", y: "center" } },
            { text: "Total", align: { x: "right", y: "center" } },
        ]);
        rows.forEach((row) => {
            table.row([
                { text: String(row.sno), align: { x: "center", y: "center" } },
                { text: fmtDate(row.date, "DD-MM-YYYY"), align: { x: "center", y: "center" } },
                { text: row.contractCode, align: { x: "center", y: "center" } },
                { text: row.farmer, align: { x: "left", y: "center" } },
                { text: row.status, align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.netAmount), align: { x: "right", y: "center" } },
                { text: row.taxRate, align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.taxAmount), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.totalAmount), align: { x: "right", y: "center" } },
            ]);
        });
        doc.fontSize(9);
        table.row([
            { text: "Grand Total", colSpan: 5, align: { x: "justify", y: "center" } },
            { text: fmtCurrency(totalNet), align: { x: "right", y: "center" } },
            { text: "", align: { x: "center", y: "center" } },
            { text: fmtCurrency(totalTax), align: { x: "right", y: "center" } },
            { text: fmtCurrency(totalAmount), align: { x: "right", y: "center" } },
        ]);
        table.end();

        await pdfGen.sendToResponse(res, `revenue-report-${store.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Revenue report error:", error);
        res.status(500).json({ error: "Failed to generate revenue report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CONTRACTS REPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const contractsReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);
        const { status, from, to } = req.query;

        const store = await prisma.coldStore.findUnique({ where: { id: storeId } });
        if (!store) { res.status(404).json({ message: "Store not found" }); return; }

        const farmers = await prisma.farmer.findMany({ where: { storeId } });
        const farmerIds = farmers.map((f) => f.id);

        const contracts = await prisma.contract.findMany({
            where: {
                farmerId: { in: farmerIds },
                ...(status ? { status: status as any } : {}),
                createdAt: {
                    gte: from ? new Date(from as string) : undefined,
                    lte: to ? new Date(to as string) : undefined,
                },
            },
            include: {
                farmer: true,
                items: { include: { item: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const rows = contracts.map((c, i) => ({
            sno: i + 1,
            contractCode: c.contractCode,
            farmer: c.farmer.name,
            phone: c.farmer.phone,
            startDate: c.startDate,
            endDate: c.expectedEndDate,
            items: c.items.map((l) => l.item?.name || "N/A").join(", "),
            totalQty: c.items.reduce((s, l) => s + (l.quantity || 0), 0),
            netAmount: c.netAmount,
            totalAmount: c.totalAmount,
            status: c.status,
        }));

        const pdfGen = createPDFGenerator(
            pdfConfig("Contracts Report", `Store: ${store.name}`, {
                "Status": (status as string) || "All",
                "From": from ? dayjs(from as string).format("DD MMM YYYY") : "All",
                "To": to ? dayjs(to as string).format("DD MMM YYYY") : "All",
                "Total": contracts.length,
            }, "landscape")
        );
        const doc = pdfGen.getDocument();

        doc.x = doc.page.margins.left;
        const table = doc.table({
            columnStyles: [25, 80, 80, 70, 65, 65, "*", 40, 65, 65, 55],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        table.row([
            { text: "#", align: { x: "center", y: "center" } },
            { text: "Code", align: { x: "center", y: "center" } },
            { text: "Farmer", align: { x: "left", y: "center" } },
            { text: "Phone", align: { x: "center", y: "center" } },
            { text: "Start", align: { x: "center", y: "center" } },
            { text: "End", align: { x: "center", y: "center" } },
            { text: "Items", align: { x: "left", y: "center" } },
            { text: "Qty", align: { x: "right", y: "center" } },
            { text: "Net Amt", align: { x: "right", y: "center" } },
            { text: "Total Amt", align: { x: "right", y: "center" } },
            { text: "Status", align: { x: "center", y: "center" } },
        ]);
        rows.forEach((row) => {
            table.row([
                { text: String(row.sno), align: { x: "center", y: "center" } },
                { text: row.contractCode, align: { x: "center", y: "center" } },
                { text: row.farmer, align: { x: "left", y: "center" } },
                { text: row.phone, align: { x: "center", y: "center" } },
                { text: fmtDate(row.startDate, "DD-MM-YY"), align: { x: "center", y: "center" } },
                { text: fmtDate(row.endDate, "DD-MM-YY"), align: { x: "center", y: "center" } },
                { text: row.items, align: { x: "left", y: "center" } },
                { text: fmtCurrency(row.totalQty), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.netAmount), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.totalAmount), align: { x: "right", y: "center" } },
                { text: row.status, align: { x: "center", y: "center" } },
            ]);
        });
        doc.fontSize(9);
        table.row([
            { text: "Total", colSpan: 7, align: { x: "justify", y: "center" } },
            { text: fmtCurrency(rows.reduce((s, r) => s + r.totalQty, 0)), align: { x: "right", y: "center" } },
            { text: fmtCurrency(contracts.reduce((s, c) => s + c.netAmount, 0)), align: { x: "right", y: "center" } },
            { text: fmtCurrency(contracts.reduce((s, c) => s + c.totalAmount, 0)), align: { x: "right", y: "center" } },
            { text: "", align: { x: "center", y: "center" } },
        ]);
        table.end();

        await pdfGen.sendToResponse(res, `contracts-report-${store.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Contracts report error:", error);
        res.status(500).json({ error: "Failed to generate contracts report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PAYMENTS COLLECTION REPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const paymentsReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);
        const { from, to, method } = req.query;

        const store = await prisma.coldStore.findUnique({ where: { id: storeId } });
        if (!store) { res.status(404).json({ message: "Store not found" }); return; }

        const farmers = await prisma.farmer.findMany({ where: { storeId } });
        const farmerIds = farmers.map((f) => f.id);

        const payments = await prisma.payment.findMany({
            where: {
                farmerId: { in: farmerIds },
                paymentDate: {
                    gte: from ? new Date(from as string) : undefined,
                    lte: to ? new Date(to as string) : undefined,
                },
                ...(method ? { paymentMethod: method as any } : {}),
            },
            include: { farmer: true },
            orderBy: { paymentDate: "desc" },
        });

        const rows = payments.map((p, i) => ({
            sno: i + 1,
            date: p.paymentDate,
            farmer: p.farmer.name,
            phone: p.farmer.phone,
            amount: p.amount,
            method: p.paymentMethod,
            transactionRef: p.transactionRef || "N/A",
            remarks: p.remarks || "",
        }));

        const totalAmount = payments.reduce((s, p) => s + p.amount, 0);

        // Payment method breakdown
        const methodBreakdown: Record<string, number> = {};
        payments.forEach((p) => {
            methodBreakdown[p.paymentMethod] = (methodBreakdown[p.paymentMethod] || 0) + p.amount;
        });

        const pdfGen = createPDFGenerator(
            pdfConfig("Payments Collection Report", `Store: ${store.name}`, {
                "From": from ? dayjs(from as string).format("DD MMM YYYY") : "All Time",
                "To": to ? dayjs(to as string).format("DD MMM YYYY") : "Now",
                "Method": (method as string) || "All",
                "Total Records": payments.length,
            })
        );
        const doc = pdfGen.getDocument();

        // Payment method summary
        const methodSummary: Record<string, string> = {
            "Total Collections": fmtCurrency(totalAmount),
        };
        Object.entries(methodBreakdown).forEach(([m, v]) => {
            methodSummary[m] = fmtCurrency(v);
        });

        const methodEntries = Object.entries(methodSummary);
        const methodCols = Math.min(methodEntries.length, 4);
        const methodColStyles: ("*" | number)[] = Array(methodCols).fill("*");
        doc.x = doc.page.margins.left;
        const methodInfoTable = doc.table({ columnStyles: methodColStyles });
        for (let i = 0; i < methodEntries.length; i += methodCols) {
            const chunk = methodEntries.slice(i, i + methodCols);
            while (chunk.length < methodCols) chunk.push(["", ""]);
            methodInfoTable.row(chunk.map(([label]) => ({ text: label, align: { x: "left" as const, y: "center" as const } })));
            methodInfoTable.row(chunk.map(([, value]) => ({ text: value, align: { x: "left" as const, y: "center" as const } })));
        }
        methodInfoTable.end();

        pdfGen.moveDown(0.5);

        doc.x = doc.page.margins.left;
        const table = doc.table({
            columnStyles: [30, 70, "*", 80, 80, 70, 80, 80],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        table.row([
            { text: "#", align: { x: "center", y: "center" } },
            { text: "Date", align: { x: "center", y: "center" } },
            { text: "Farmer", align: { x: "left", y: "center" } },
            { text: "Phone", align: { x: "center", y: "center" } },
            { text: "Amount", align: { x: "right", y: "center" } },
            { text: "Method", align: { x: "center", y: "center" } },
            { text: "Ref #", align: { x: "center", y: "center" } },
            { text: "Remarks", align: { x: "left", y: "center" } },
        ]);
        rows.forEach((row) => {
            table.row([
                { text: String(row.sno), align: { x: "center", y: "center" } },
                { text: fmtDate(row.date, "DD-MM-YYYY"), align: { x: "center", y: "center" } },
                { text: row.farmer, align: { x: "left", y: "center" } },
                { text: row.phone, align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.amount), align: { x: "right", y: "center" } },
                { text: row.method, align: { x: "center", y: "center" } },
                { text: row.transactionRef, align: { x: "center", y: "center" } },
                { text: row.remarks, align: { x: "left", y: "center" } },
            ]);
        });
        doc.fontSize(9);
        table.row([
            { text: "Grand Total", colSpan: 4, align: { x: "justify", y: "center" } },
            { text: fmtCurrency(totalAmount), align: { x: "right", y: "center" } },
            { text: "", colSpan: 3, align: { x: "center", y: "center" } },
        ]);
        table.end();

        await pdfGen.sendToResponse(res, `payments-report-${store.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Payments report error:", error);
        res.status(500).json({ error: "Failed to generate payments report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. OUTSTANDING DUES REPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const outstandingDuesReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);

        const store = await prisma.coldStore.findUnique({ where: { id: storeId } });
        if (!store) { res.status(404).json({ message: "Store not found" }); return; }

        const farmers = await prisma.farmer.findMany({
            where: { storeId },
            include: {
                ledgers: { select: { debit: true, credit: true } },
                contracts: { where: { status: "ACTIVE" } },
            },
        });

        // Only farmers with outstanding balance (balance > 0 means they owe)
        const rows = farmers
            .map((f) => {
                const balance = f.ledgers.reduce((s, l) => s + l.debit - l.credit, 0);
                return {
                    farmerId: f.id,
                    name: f.name,
                    phone: f.phone,
                    cnic: f.cnic || "N/A",
                    address: f.address || "N/A",
                    activeContracts: f.contracts.length,
                    balance,
                    status: balance > 0 ? "OWING" : balance < 0 ? "OVERPAID" : "SETTLED",
                };
            })
            .filter((r) => r.balance > 0)
            .sort((a, b) => b.balance - a.balance);

        const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0);

        const pdfGen = createPDFGenerator(
            pdfConfig("Outstanding Dues Report", `Store: ${store.name}`, {
                "Store": store.name,
                "Farmers": rows.length,
                "Outstanding": fmtCurrency(totalOutstanding),
            })
        );
        const doc = pdfGen.getDocument();

        doc.x = doc.page.margins.left;
        const duesInfoTable = doc.table({
            columnStyles: ["*", "*"],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        duesInfoTable.row([
            { text: "Total Farmers", align: { x: "left", y: "center" } },
            { text: "Total Outstanding", align: { x: "left", y: "center" } },
        ]);
        duesInfoTable.row([
            { text: rows.length.toString(), align: { x: "left", y: "center" } },
            { text: fmtCurrency(totalOutstanding), align: { x: "left", y: "center" } },
        ]);
        duesInfoTable.row([
            { text: "Average Outstanding", align: { x: "left", y: "center" } },
            { text: "Highest Due", align: { x: "left", y: "center" } },
        ]);
        duesInfoTable.row([
            { text: rows.length > 0 ? fmtCurrency(totalOutstanding / rows.length) : "0", align: { x: "left", y: "center" } },
            { text: rows.length > 0 ? fmtCurrency(rows[0].balance) : "0", align: { x: "left", y: "center" } },
        ]);
        duesInfoTable.end();

        pdfGen.moveDown(0.5);

        doc.x = doc.page.margins.left;
        const table = doc.table({
            columnStyles: [30, "*", 80, 90, 55, 90],
            rowStyles: (row) => {
                if (row == 0) return { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" };
            }
        });
        table.row([
            { text: "#", align: { x: "center", y: "center" } },
            { text: "Farmer Name", align: { x: "left", y: "center" } },
            { text: "Phone", align: { x: "center", y: "center" } },
            { text: "CNIC", align: { x: "center", y: "center" } },
            { text: "Contracts", align: { x: "center", y: "center" } },
            { text: "Outstanding Amount", align: { x: "right", y: "center" } },
        ]);
        rows.forEach((row) => {
            table.row([
                { text: String(row.farmerId), align: { x: "center", y: "center" } },
                row.name,
                { text: row.phone, align: { x: "center", y: "center" } },
                { text: row.cnic, align: { x: "center", y: "center" } },
                { text: String(row.activeContracts), align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.balance), align: { x: "right", y: "center" } },
            ]);
        });
        doc.fontSize(9);
        table.row([
            { text: "Grand Total", colSpan: 5, align: { x: "justify", y: "center" } },
            { text: fmtCurrency(totalOutstanding), align: { x: "right", y: "center" } },
        ]);
        table.end();

        await pdfGen.sendToResponse(res, `outstanding-dues-${store.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Outstanding dues report error:", error);
        res.status(500).json({ error: "Failed to generate outstanding dues report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. RATE PLANS REPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const ratePlansReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);

        const store = await prisma.coldStore.findUnique({ where: { id: storeId } });
        if (!store) { res.status(404).json({ message: "Store not found" }); return; }

        const ratePlans = await prisma.ratePlan.findMany({
            where: { storeId },
            orderBy: { createdAt: "desc" },
        });

        const rows = ratePlans.map((r, i) => ({
            sno: i + 1,
            packagingType: r.packagingType || "General",
            rateType: r.rateType,
            rateAmount: r.rateAmount,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
        }));

        const pdfGen = createPDFGenerator(
            pdfConfig("Rate Plans Report", `Store: ${store.name}`, {
                "Store": store.name,
                "Total Plans": ratePlans.length,
            })
        );
        const doc = pdfGen.getDocument();

        doc.x = doc.page.margins.left;
        const table = doc.table({
            columnStyles: [30, "*", 100, 100, 90, 90],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        table.row([
            { text: "#", align: { x: "center", y: "center" } },
            { text: "Packaging Type", align: { x: "left", y: "center" } },
            { text: "Rate Type", align: { x: "center", y: "center" } },
            { text: "Rate Amount", align: { x: "right", y: "center" } },
            { text: "Created", align: { x: "center", y: "center" } },
            { text: "Updated", align: { x: "center", y: "center" } },
        ]);
        rows.forEach((row) => {
            table.row([
                { text: String(row.sno), align: { x: "center", y: "center" } },
                { text: row.packagingType, align: { x: "left", y: "center" } },
                { text: row.rateType, align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.rateAmount), align: { x: "right", y: "center" } },
                { text: fmtDate(row.createdAt, "DD-MM-YYYY"), align: { x: "center", y: "center" } },
                { text: fmtDate(row.updatedAt, "DD-MM-YYYY"), align: { x: "center", y: "center" } },
            ]);
        });
        table.end();

        await pdfGen.sendToResponse(res, `rate-plans-${store.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Rate plans report error:", error);
        res.status(500).json({ error: "Failed to generate rate plans report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. EXPIRING CONTRACTS REPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const expiringContractsReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);
        const { days = "30" } = req.query;
        const daysNum = parseInt(days as string, 10);

        const store = await prisma.coldStore.findUnique({ where: { id: storeId } });
        if (!store) { res.status(404).json({ message: "Store not found" }); return; }

        const farmers = await prisma.farmer.findMany({ where: { storeId } });
        const farmerIds = farmers.map((f) => f.id);

        const cutoffDate = dayjs().add(daysNum, "day").toDate();

        const contracts = await prisma.contract.findMany({
            where: {
                farmerId: { in: farmerIds },
                status: "ACTIVE",
                expectedEndDate: { lte: cutoffDate },
            },
            include: {
                farmer: true,
                items: { include: { item: true } },
            },
            orderBy: { expectedEndDate: "asc" },
        });

        const rows = contracts.map((c, i) => {
            const daysLeft = c.expectedEndDate
                ? dayjs(c.expectedEndDate).diff(dayjs(), "day")
                : null;
            return {
                sno: i + 1,
                contractCode: c.contractCode,
                farmer: c.farmer.name,
                phone: c.farmer.phone,
                startDate: c.startDate,
                endDate: c.expectedEndDate,
                daysLeft: daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)} overdue` : `${daysLeft} days`) : "N/A",
                items: c.items.map((l) => l.item?.name || "N/A").join(", "),
                totalAmount: c.totalAmount,
            };
        });

        const pdfGen = createPDFGenerator(
            pdfConfig("Expiring Contracts Report", `Store: ${store.name}`, {
                "Within Days": daysNum,
                "Expiring Contracts": contracts.length,
                "Store": store.name,
            })
        );
        const doc = pdfGen.getDocument();

        doc.x = doc.page.margins.left;
        const table = doc.table({
            columnStyles: [25, 80, "*", 75, 65, 65, 65, 70],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        table.row([
            { text: "#", align: { x: "center", y: "center" } },
            { text: "Contract", align: { x: "center", y: "center" } },
            { text: "Farmer", align: { x: "left", y: "center" } },
            { text: "Phone", align: { x: "center", y: "center" } },
            { text: "Start", align: { x: "center", y: "center" } },
            { text: "End", align: { x: "center", y: "center" } },
            { text: "Time Left", align: { x: "center", y: "center" } },
            { text: "Amount", align: { x: "right", y: "center" } },
        ]);
        rows.forEach((row) => {
            table.row([
                { text: String(row.sno), align: { x: "center", y: "center" } },
                { text: row.contractCode, align: { x: "center", y: "center" } },
                { text: row.farmer, align: { x: "left", y: "center" } },
                { text: row.phone, align: { x: "center", y: "center" } },
                { text: fmtDate(row.startDate, "DD-MM-YY"), align: { x: "center", y: "center" } },
                { text: fmtDate(row.endDate, "DD-MM-YY"), align: { x: "center", y: "center" } },
                { text: row.daysLeft, align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.totalAmount), align: { x: "right", y: "center" } },
            ]);
        });
        table.end();

        await pdfGen.sendToResponse(res, `expiring-contracts-${store.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Expiring contracts report error:", error);
        res.status(500).json({ error: "Failed to generate expiring contracts report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 11. FARMER DIRECTORY REPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const farmerDirectoryReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);

        const store = await prisma.coldStore.findUnique({ where: { id: storeId } });
        if (!store) { res.status(404).json({ message: "Store not found" }); return; }

        const farmers = await prisma.farmer.findMany({
            where: { storeId },
            include: {
                contracts: true,
                ledgers: { select: { debit: true, credit: true } },
                payments: true,
            },
            orderBy: { name: "asc" },
        });

        const rows = farmers.map((f, i) => {
            const totalPaid = f.payments.reduce((s, p) => s + p.amount, 0);
            const balance = f.ledgers.reduce((s, l) => s + l.debit - l.credit, 0);
            return {
                sno: i + 1,
                name: f.name,
                phone: f.phone,
                cnic: f.cnic || "N/A",
                address: f.address || "N/A",
                marka: f.marka || "N/A",
                totalContracts: f.contracts.length,
                activeContracts: f.contracts.filter((c) => c.status === "ACTIVE").length,
                totalPaid,
                balance,
                joinedDate: f.createdAt,
            };
        });

        const pdfGen = createPDFGenerator(
            pdfConfig("Farmer Directory", `Store: ${store.name}`, {
                "Store": store.name,
                "Total Farmers": farmers.length,
            }, "landscape")
        );
        const doc = pdfGen.getDocument();

        doc.x = doc.page.margins.left;
        const table = doc.table({
            columnStyles:
                [25, "*", 75, 85, 55, 45, 40, 70, 70, 65],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        table.row([
            { text: "#", align: { x: "center", y: "center" } },
            { text: "Name", align: { x: "left", y: "center" } },
            { text: "Phone", align: { x: "center", y: "center" } },
            { text: "CNIC", align: { x: "center", y: "center" } },
            { text: "Marka", align: { x: "center", y: "center" } },
            { text: "Contracts", align: { x: "center", y: "center" } },
            { text: "Active", align: { x: "center", y: "center" } },
            { text: "Total Paid", align: { x: "right", y: "center" } },
            { text: "Balance", align: { x: "right", y: "center" } },
            { text: "Joined", align: { x: "center", y: "center" } },
        ]);
        rows.forEach((row) => {
            table.row([
                { text: String(row.sno), align: { x: "center", y: "center" } },
                { text: row.name, align: { x: "left", y: "center" } },
                { text: row.phone, align: { x: "center", y: "center" } },
                { text: row.cnic, align: { x: "center", y: "center" } },
                { text: row.marka, align: { x: "center", y: "center" } },
                { text: String(row.totalContracts), align: { x: "center", y: "center" } },
                { text: String(row.activeContracts), align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.totalPaid), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.balance), align: { x: "right", y: "center" } },
                { text: fmtDate(row.joinedDate, "DD-MM-YY"), align: { x: "center", y: "center" } },
            ]);
        });
        table.end();

        await pdfGen.sendToResponse(res, `farmer-directory-${store.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Farmer directory report error:", error);
        res.status(500).json({ error: "Failed to generate farmer directory report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 12. FARMER STATEMENT REPORT (Full account statement for one farmer)
// ═══════════════════════════════════════════════════════════════════════════════
export const farmerStatementReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const farmerId = Number(req.params.farmerId);
        const { from, to } = req.query;

        const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
        if (!farmer) { res.status(404).json({ message: "Farmer not found" }); return; }

        // Contracts
        const contracts = await prisma.contract.findMany({
            where: {
                farmerId,
                createdAt: {
                    gte: from ? new Date(from as string) : undefined,
                    lte: to ? new Date(to as string) : undefined,
                },
            },
            include: { items: { include: { item: true } } },
            orderBy: { createdAt: "desc" },
        });

        // Payments
        const payments = await prisma.payment.findMany({
            where: {
                farmerId,
                paymentDate: {
                    gte: from ? new Date(from as string) : undefined,
                    lte: to ? new Date(to as string) : undefined,
                },
            },
            orderBy: { paymentDate: "desc" },
        });

        // Ledger
        const ledgerData = await prisma.ledger.findMany({
            where: {
                farmerId,
                transactionDate: {
                    gte: from ? new Date(from as string) : undefined,
                    lte: to ? new Date(to as string) : undefined,
                },
            },
            orderBy: { transactionDate: "asc" },
        });

        let balance = 0;
        const ledgerRows = ledgerData.map((row) => {
            balance += row.debit - row.credit;
            return { ...row, balance };
        });

        const totalDebit = ledgerData.reduce((s, r) => s + r.debit, 0);
        const totalCredit = ledgerData.reduce((s, r) => s + r.credit, 0);
        const closingBalance = balance;

        const reportFonts = fonts();
        const pdfGen = createPDFGenerator({
            fontRegistrations: reportFonts.registrations,
            fontFamilyMap: reportFonts.aliasMap,
            pdfOptions: {
                size: "A4",
                margins: { top: 10, bottom: 10, left: 20, right: 20 },
            },
            header: {
                title: "Farmer Account Statement",
                subtitle: `Farmer: ${farmer.name}`,
                logo: { path: logoPath, width: 60, height: 60 },
                showDate: true,
                titleFont: { family: "Helvetica-Bold", size: 16 },
                subtitleFont: { size: 10, color: "#666666" },
                filterInfo: {
                    "From": from ? dayjs(from as string).format("DD MMM YYYY") : "All",
                    "To": to ? dayjs(to as string).format("DD MMM YYYY") : "Now",
                },
            },
            footer: {
                leftText: "Cold Storage System",
                centerText: "Farmer Statement",
                showPageNumber: true,
                font: { size: 8, color: "#666666" },
            },
        });

        const doc = pdfGen.getDocument();

        // ── Farmer Info ────────────────────
        doc.x = doc.page.margins.left;
        const farmerInfoTable = doc.table({
            columnStyles: ["*", "*", "*", "*", "*", "*"],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}

        });
        farmerInfoTable.row([
            { text: "Farmer Name", align: { x: "left", y: "center" } },
            { text: "Phone", align: { x: "left", y: "center" } },
            { text: "CNIC", align: { x: "left", y: "center" } },
            { text: "Address", align: { x: "left", y: "center" } },
            { text: "Marka", align: { x: "left", y: "center" } },
            { text: "Member Since", align: { x: "left", y: "center" } },
        ]);
        farmerInfoTable.row([
            { text: farmer.name, align: { x: "left", y: "center" } },
            { text: farmer.phone, align: { x: "left", y: "center" } },
            { text: farmer.cnic || "N/A", align: { x: "left", y: "center" } },
            { text: farmer.address || "N/A", align: { x: "left", y: "center" } },
            { text: farmer.marka || "N/A", align: { x: "left", y: "center" } },
            { text: dayjs(farmer.createdAt).format("DD MMM YYYY"), align: { x: "left", y: "center" } },
        ]);
        farmerInfoTable.end();

        pdfGen.moveDown(0.5);

        // ── Account Summary ────────────────────
        pdfGen.moveDown(0.3);

        doc.x = doc.page.margins.left;
        const acctSummaryTable = doc.table({
            columnStyles: ["*", "*", "*"],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        acctSummaryTable.row([
            { text: "Total Contracts", align: { x: "left", y: "center" } },
            { text: "Active Contracts", align: { x: "left", y: "center" } },
            { text: "Total Invoiced (Debit)", align: { x: "left", y: "center" } },
        ]);
        acctSummaryTable.row([
            { text: contracts.length.toString(), align: { x: "left", y: "center" } },
            { text: contracts.filter((c) => c.status === "ACTIVE").length.toString(), align: { x: "left", y: "center" } },
            { text: fmtCurrency(totalDebit), align: { x: "left", y: "center" } },
        ]);
        acctSummaryTable.row([
            { text: "Total Paid (Credit)", align: { x: "left", y: "center" } },
            { text: "Closing Balance", align: { x: "left", y: "center" } },
            { text: "Total Payments Count", align: { x: "left", y: "center" } },
        ]);
        acctSummaryTable.row([
            { text: fmtCurrency(totalCredit), align: { x: "left", y: "center" } },
            { text: fmtCurrency(closingBalance), align: { x: "left", y: "center" } },
            { text: payments.length.toString(), align: { x: "left", y: "center" } },
        ]);
        acctSummaryTable.end();

        pdfGen.moveDown(0.5);

        // ── Contracts Table ────────────────────
        pdfGen.moveDown(0.3);

        const contractRows = contracts.map((c, i) => ({
            sno: i + 1,
            code: c.contractCode,
            startDate: c.startDate,
            endDate: c.expectedEndDate,
            items: c.items.map((l) => l.item?.name || "N/A").join(", "),
            qty: c.items.reduce((s, l) => s + (l.quantity || 0), 0),
            netAmount: c.netAmount,
            totalAmount: c.totalAmount,
            status: c.status,
        }));

        doc.x = doc.page.margins.left;
        const contractTable = doc.table({
            columnStyles: [25, 80, 60, 60, "*", 35, 65, 65, 55],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        contractTable.row([
            { text: "#", align: { x: "center", y: "center" } },
            { text: "Code", align: { x: "center", y: "center" } },
            { text: "Start", align: { x: "center", y: "center" } },
            { text: "End", align: { x: "center", y: "center" } },
            { text: "Items", align: { x: "left", y: "center" } },
            { text: "Qty", align: { x: "right", y: "center" } },
            { text: "Net Amt", align: { x: "right", y: "center" } },
            { text: "Total", align: { x: "right", y: "center" } },
            { text: "Status", align: { x: "center", y: "center" } },
        ]);
        contractRows.forEach((row) => {
            contractTable.row([
                { text: String(row.sno), align: { x: "center", y: "center" } },
                { text: row.code, align: { x: "center", y: "center" } },
                { text: fmtDate(row.startDate, "DD-MM-YY"), align: { x: "center", y: "center" } },
                { text: fmtDate(row.endDate, "DD-MM-YY"), align: { x: "center", y: "center" } },
                row.items,
                { text: String(row.qty), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.netAmount), align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.totalAmount), align: { x: "right", y: "center" } },
                { text: row.status, align: { x: "center", y: "center" } },
            ]);
        });
        doc.fontSize(9);
        contractTable.row([
            { text: "Total", colSpan: 6, align: { x: "justify", y: "center" } },
            { text: fmtCurrency(contracts.reduce((s, c) => s + c.netAmount, 0)), align: { x: "right", y: "center" } },
            { text: fmtCurrency(contracts.reduce((s, c) => s + c.totalAmount, 0)), align: { x: "right", y: "center" } },
            { text: "", align: { x: "center", y: "center" } },
        ]);
        contractTable.end();

        pdfGen.moveDown(0.5);

        // ── Payments Table ────────────────────
        pdfGen.moveDown(0.3);
        doc.fontSize(12).fillColor("#333333").text("Payments", { align: "left" }).moveDown(0.2).fontSize(9);

        const paymentRows = payments.map((p, i) => ({
            sno: i + 1,
            date: p.paymentDate,
            amount: p.amount,
            method: p.paymentMethod,
            ref: p.transactionRef || "N/A",
            remarks: p.remarks || "",
        }));

        doc.x = doc.page.margins.left;
        const paymentTable = doc.table({
            columnStyles: [30, 80, 90, 80, "*", 100],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        paymentTable.row([
            { text: "#", align: { x: "center", y: "center" } },
            { text: "Date", align: { x: "center", y: "center" } },
            { text: "Amount", align: { x: "right", y: "center" } },
            { text: "Method", align: { x: "center", y: "center" } },
            { text: "Ref #", align: { x: "center", y: "center" } },
            { text: "Remarks", align: { x: "left", y: "center" } },
        ]);
        paymentRows.forEach((row) => {
            paymentTable.row([
                { text: String(row.sno), align: { x: "center", y: "center" } },
                { text: fmtDate(row.date, "DD-MM-YYYY"), align: { x: "center", y: "center" } },
                { text: fmtCurrency(row.amount), align: { x: "right", y: "center" } },
                { text: row.method, align: { x: "center", y: "center" } },
                { text: row.ref, align: { x: "center", y: "center" } },
                row.remarks,
            ]);
        });
        doc.fontSize(9);
        paymentTable.row([
            { text: "Total Paid", colSpan: 2, align: { x: "justify", y: "center" } },
            { text: fmtCurrency(payments.reduce((s, p) => s + p.amount, 0)), align: { x: "right", y: "center" } },
            { text: "", colSpan: 3, align: { x: "center", y: "center" } },
        ]);
        paymentTable.end();

        pdfGen.moveDown(0.5);

        // ── Ledger Table ────────────────────
        pdfGen.moveDown(0.3);

        doc.x = doc.page.margins.left;
        const ledgerTable = doc.table({
            columnStyles: [70, "*", 80, 80, 80],
            rowStyles: (row) => row === 0 ? { backgroundColor: "#f0f0f0", fontSize: 10, fontStyle: "bold" } : {}
        });
        ledgerTable.row([
            { text: "Date", align: { x: "center", y: "center" } },
            { text: "Description", align: { x: "left", y: "center" } },
            { text: "Debit", align: { x: "right", y: "center" } },
            { text: "Credit", align: { x: "right", y: "center" } },
            { text: "Balance", align: { x: "right", y: "center" } },
        ]);
        ledgerRows.forEach((row) => {
            ledgerTable.row([
                { text: fmtDate(row.transactionDate, "DD-MM-YYYY"), align: { x: "center", y: "center" } },
                row.description,
                { text: row.debit ? fmtCurrency(row.debit) : "-", align: { x: "right", y: "center" } },
                { text: row.credit ? fmtCurrency(row.credit) : "-", align: { x: "right", y: "center" } },
                { text: fmtCurrency(row.balance), align: { x: "right", y: "center" } },
            ]);
        });
        doc.fontSize(9);
        ledgerTable.row([
            { text: "Total", colSpan: 2, align: { x: "justify", y: "center" } },
            { text: fmtCurrency(totalDebit), align: { x: "right", y: "center" } },
            { text: fmtCurrency(totalCredit), align: { x: "right", y: "center" } },
            { text: fmtCurrency(closingBalance), align: { x: "right", y: "center" } },
        ]);
        ledgerTable.end();

        pdfGen.moveDown(1);

        // Signature
        generateSignatureSection(doc, {
            signatures: [
                { label: "Farmer Signature", name: "_________________", title: farmer.name },
                { label: "Accountant", name: "_________________", title: "Accounts Dept." },
                { label: "Manager", name: "_________________", title: "General Manager" },
            ],
            spacing: 30,
            lineWidth: 120,
            labelFont: { family: "Helvetica-Bold", size: 8 },
            nameFont: { size: 9 },
        });

        await pdfGen.sendToResponse(res, `farmer-statement-${farmer.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Farmer statement report error:", error);
        res.status(500).json({ error: "Failed to generate farmer statement report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 13. FARMER CONTRACTS REPORT (All contracts for a specific farmer)
// ═══════════════════════════════════════════════════════════════════════════════
export const farmerContractsReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const farmerId = Number(req.params.farmerId);
        const { status } = req.query;

        const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
        if (!farmer) { res.status(404).json({ message: "Farmer not found" }); return; }

        const contracts = await prisma.contract.findMany({
            where: {
                farmerId,
                ...(status ? { status: status as any } : {}),
            },
            include: {
                items: {
                    include: {
                        item: true,
                        movements: {
                            include: { rack: { include: { room: true } } },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const reportFonts = fonts();
        const pdfGen = createPDFGenerator({
            fontRegistrations: reportFonts.registrations,
            fontFamilyMap: reportFonts.aliasMap,
            pdfOptions: {
                size: "A4",
                margins: { top: 10, bottom: 10, left: 20, right: 20 },
            },
            header: {
                title: "Farmer Contracts Detail",
                subtitle: `Farmer: ${farmer.name} | Phone: ${farmer.phone}`,
                logo: { path: logoPath, width: 60, height: 60 },
                showDate: true,
                titleFont: { family: "Helvetica-Bold", size: 16 },
                subtitleFont: { size: 10, color: "#666666" },
                filterInfo: {
                    "Total Contracts": contracts.length,
                    "Active": contracts.filter((c) => c.status === "ACTIVE").length,
                    "Completed": contracts.filter((c) => c.status === "COMPLETED").length,
                },
            },
            footer: {
                leftText: "Cold Storage System",
                centerText: "Farmer Contracts",
                showPageNumber: true,
                font: { size: 8, color: "#666666" },
            },
        });

        const doc = pdfGen.getDocument();

        for (let ci = 0; ci < contracts.length; ci++) {
            const c = contracts[ci];
            if (ci > 0) pdfGen.addPage();

            // Contract header
            doc.fontSize(12).fillColor("#1565c0")
                .text(`Contract: ${c.contractCode}`, 20, doc.y);
            doc.fontSize(9).fillColor("#333333")
            pdfGen.moveDown(0.3);

            doc.x = doc.page.margins.left;
            const contractInfoTable = doc.table({ columnStyles: ["*", "*", "*"] });
            contractInfoTable.row([
                { text: "Status", align: { x: "left", y: "center" } },
                { text: "Start Date", align: { x: "left", y: "center" } },
                { text: "Expected End", align: { x: "left", y: "center" } },
            ]);
            contractInfoTable.row([
                { text: c.status, align: { x: "left", y: "center" } },
                { text: fmtDate(c.startDate), align: { x: "left", y: "center" } },
                { text: fmtDate(c.expectedEndDate), align: { x: "left", y: "center" } },
            ]);
            contractInfoTable.row([
                { text: "Net Amount", align: { x: "left", y: "center" } },
                { text: "Tax", align: { x: "left", y: "center" } },
                { text: "Total Amount", align: { x: "left", y: "center" } },
            ]);
            contractInfoTable.row([
                { text: fmtCurrency(c.netAmount), align: { x: "left", y: "center" } },
                { text: `${(c.saleTaxRate * 100).toFixed(0)}% (${fmtCurrency(c.salesTaxAmount)})`, align: { x: "left", y: "center" } },
                { text: fmtCurrency(c.totalAmount), align: { x: "left", y: "center" } },
            ]);
            contractInfoTable.end();

            pdfGen.moveDown(0.3);

            // Items table
            doc.fontSize(10).fillColor("#333333").text("Contract Items");
            pdfGen.moveDown(0.2);
            doc.fontSize(9).fillColor("#333333");
            const itemRows = c.items.map((line, li) => {
                const totalIn = line.movements.filter((m) => m.movementType === "IN").reduce((s, m) => s + m.quantity, 0);
                const totalOut = line.movements.filter((m) => m.movementType === "OUT").reduce((s, m) => s + m.quantity, 0);
                return {
                    sno: li + 1,
                    item: line.item?.name || "N/A",
                    packaging: line.packagingType || "N/A",
                    quantity: line.quantity || 0,
                    unitRate: line.unitRate,
                    amount: (line.quantity || 0) * line.unitRate,
                    stockIn: totalIn,
                    stockOut: totalOut,
                    remaining: totalIn - totalOut,
                    lateCharges: line.lateCharges,
                };
            });

            doc.x = doc.page.margins.left;
            const itemTable = doc.table({ columnStyles: [20, "*", 50, 40, 50, 60, 35, 35, 50, 55] });
            itemTable.row([
                { text: "#", align: { x: "center", y: "center" } },
                { text: "Item", align: { x: "left", y: "center" } },
                { text: "Pkg", align: { x: "center", y: "center" } },
                { text: "Qty", align: { x: "right", y: "center" } },
                { text: "Rate", align: { x: "right", y: "center" } },
                { text: "Amount", align: { x: "right", y: "center" } },
                { text: "In", align: { x: "right", y: "center" } },
                { text: "Out", align: { x: "right", y: "center" } },
                { text: "Remaining", align: { x: "right", y: "center" } },
                { text: "Late Chg", align: { x: "right", y: "center" } },
            ]);
            itemRows.forEach((row) => {
                itemTable.row([
                    { text: String(row.sno), align: { x: "center", y: "center" } },
                    row.item,
                    { text: row.packaging, align: { x: "center", y: "center" } },
                    { text: String(row.quantity), align: { x: "right", y: "center" } },
                    { text: fmtCurrency(row.unitRate), align: { x: "right", y: "center" } },
                    { text: fmtCurrency(row.amount), align: { x: "right", y: "center" } },
                    { text: String(row.stockIn), align: { x: "right", y: "center" } },
                    { text: String(row.stockOut), align: { x: "right", y: "center" } },
                    { text: String(row.remaining), align: { x: "right", y: "center" } },
                    { text: fmtCurrency(row.lateCharges), align: { x: "right", y: "center" } },
                ]);
            });
            doc.fontSize(9);
            itemTable.row([
                { text: "Total", colSpan: 5, align: { x: "justify", y: "center" } },
                { text: fmtCurrency(itemRows.reduce((s, r) => s + r.amount, 0)), align: { x: "right", y: "center" } },
                { text: itemRows.reduce((s, r) => s + r.stockIn, 0).toString(), align: { x: "right", y: "center" } },
                { text: itemRows.reduce((s, r) => s + r.stockOut, 0).toString(), align: { x: "right", y: "center" } },
                { text: itemRows.reduce((s, r) => s + r.remaining, 0).toString(), align: { x: "right", y: "center" } },
                { text: fmtCurrency(itemRows.reduce((s, r) => s + r.lateCharges, 0)), align: { x: "right", y: "center" } },
            ]);
            itemTable.end();

            if (c.notes) {
                pdfGen.moveDown(0.3);
                doc.fontSize(8).font("Helvetica").fillColor("#666666").text(`Notes: ${c.notes}`);
            }
        }

        // Grand totals page
        if (contracts.length > 1) {
            pdfGen.addPage();
            doc.x = doc.page.margins.left;
            doc.fontSize(12).fillColor("#333333").text("Grand Summary — All Contracts");
            pdfGen.moveDown(0.5);
            doc.fontSize(9).fillColor("#333333");

            const totalNet = contracts.reduce((s, c) => s + c.netAmount, 0);
            const totalTax = contracts.reduce((s, c) => s + c.salesTaxAmount, 0);
            const totalGross = contracts.reduce((s, c) => s + c.totalAmount, 0);

            doc.x = doc.page.margins.left;
            const grandSummaryTable = doc.table({ columnStyles: ["*", "*", "*"] });
            grandSummaryTable.row([
                { text: "Total Contracts", align: { x: "left", y: "center" } },
                { text: "Active", align: { x: "left", y: "center" } },
                { text: "Completed", align: { x: "left", y: "center" } },
            ]);
            grandSummaryTable.row([
                { text: contracts.length.toString(), align: { x: "left", y: "center" } },
                { text: contracts.filter((c) => c.status === "ACTIVE").length.toString(), align: { x: "left", y: "center" } },
                { text: contracts.filter((c) => c.status === "COMPLETED").length.toString(), align: { x: "left", y: "center" } },
            ]);
            grandSummaryTable.row([
                { text: "Total Net Amount", align: { x: "left", y: "center" } },
                { text: "Total Tax", align: { x: "left", y: "center" } },
                { text: "Total Gross Amount", align: { x: "left", y: "center" } },
            ]);
            grandSummaryTable.row([
                { text: fmtCurrency(totalNet), align: { x: "left", y: "center" } },
                { text: fmtCurrency(totalTax), align: { x: "left", y: "center" } },
                { text: fmtCurrency(totalGross), align: { x: "left", y: "center" } },
            ]);
            grandSummaryTable.end();
        }

        await pdfGen.sendToResponse(res, `farmer-contracts-${farmer.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Farmer contracts report error:", error);
        res.status(500).json({ error: "Failed to generate farmer contracts report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};
