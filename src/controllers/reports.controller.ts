import { Request, Response } from "express";
import dayjs from "dayjs";
import path from "path";
import { prisma } from "../prisma/prisma";
import { createPDFGenerator, getReportFontTheme } from "../utils/pdf";
import {
    generateInfoSection,
    generateTable,
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

        generateTable(doc, {
            columns: [
                { label: "Store Name", key: "name", width: "*", align: "left" },
                { label: "Address", key: "address", width: 100, align: "left" },
                { label: "Rooms", key: "rooms", width: 45, align: "center" },
                { label: "Capacity", key: "totalCapacity", width: 60, align: "right", format: fmtCurrency },
                { label: "Stock", key: "currentStock", width: 55, align: "right", format: fmtCurrency },
                { label: "Util %", key: "utilization", width: 50, align: "center" },
                { label: "Farmers", key: "farmersCount", width: 50, align: "center" },
                { label: "Active Contracts", key: "activeContracts", width: 60, align: "center" },
                { label: "Monthly Rev.", key: "monthlyRevenue", width: 80, align: "right", format: fmtCurrency },
            ],
            data: rows,
            showHeader: true,
            headerBackgroundColor: "#333333",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 9 },
            bodyFont: { size: 8 },
            alternateRowColor: true,
            alternateColor: "#f5f5f5",
            borderColor: "#cccccc",
            showTotal: true,
            totalLabel: "Grand Total",
            totalColumns: {
                totalCapacity: fmtCurrency(totals.totalCapacity),
                currentStock: fmtCurrency(totals.currentStock),
                farmersCount: totals.farmersCount.toString(),
                activeContracts: totals.activeContracts.toString(),
                monthlyRevenue: fmtCurrency(totals.monthlyRevenue),
            },
            totalBackgroundColor: "#e0e0e0",
            totalFont: { family: "Helvetica-Bold", size: 9 },
        });

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

        generateTable(doc, {
            columns: [
                { label: "Room", key: "roomName", width: "*", align: "left" },
                { label: "Floors", key: "floors", width: 45, align: "center" },
                { label: "Racks", key: "racks", width: 45, align: "center" },
                { label: "Room Cap.", key: "roomCapacity", width: 65, align: "right", format: fmtCurrency },
                { label: "Rack Cap.", key: "rackCapacity", width: 65, align: "right", format: fmtCurrency },
                { label: "Current", key: "currentStock", width: 60, align: "right", format: fmtCurrency },
                { label: "Available", key: "available", width: 60, align: "right", format: fmtCurrency },
                { label: "Util %", key: "utilization", width: 50, align: "center" },
                { label: "Temp Range", key: "tempRange", width: 80, align: "center" },
                { label: "Status", key: "status", width: 50, align: "center" },
            ],
            data: rows,
            showHeader: true,
            headerBackgroundColor: "#2c3e50",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 9 },
            bodyFont: { size: 8 },
            alternateRowColor: true,
            alternateColor: "#f0f8ff",
            borderColor: "#cccccc",
            showTotal: true,
            totalLabel: "Total",
            totalColumns: {
                roomCapacity: fmtCurrency(rows.reduce((s, r) => s + r.roomCapacity, 0)),
                rackCapacity: fmtCurrency(rows.reduce((s, r) => s + r.rackCapacity, 0)),
                currentStock: fmtCurrency(rows.reduce((s, r) => s + r.currentStock, 0)),
                available: fmtCurrency(rows.reduce((s, r) => s + r.available, 0)),
            },
            totalBackgroundColor: "#e0e0e0",
            totalFont: { family: "Helvetica-Bold", size: 9 },
        });

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

            generateTable(doc2, {
                columns: [
                    { label: "Rack Name", key: "rackName", width: "*", align: "left" },
                    { label: "Capacity", key: "capacity", width: 80, align: "right", format: fmtCurrency },
                    { label: "Current Stock", key: "currentStock", width: 80, align: "right", format: fmtCurrency },
                    { label: "Available", key: "available", width: 80, align: "right", format: fmtCurrency },
                    { label: "Utilization", key: "utilization", width: 80, align: "center" },
                ],
                data: rackRows,
                showHeader: true,
                headerBackgroundColor: "#34495e",
                headerTextColor: "#ffffff",
                headerFont: { family: "Helvetica-Bold", size: 9 },
                bodyFont: { size: 8 },
                alternateRowColor: true,
                alternateColor: "#f9f9f9",
                borderColor: "#cccccc",
            });
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

        generateTable(doc, {
            columns: [
                { label: "Room", key: "room", width: 80, align: "left" },
                { label: "Rack", key: "rack", width: 80, align: "left" },
                { label: "Item", key: "item", width: "*", align: "left" },
                { label: "Farmer", key: "farmer", width: 100, align: "left" },
                { label: "Contract", key: "contract", width: 80, align: "center" },
                { label: "Capacity", key: "capacity", width: 60, align: "right", format: fmtCurrency },
                { label: "Stock", key: "currentStock", width: 55, align: "right", format: fmtCurrency },
                { label: "Available", key: "available", width: 60, align: "right", format: fmtCurrency },
            ],
            data: rows,
            showHeader: true,
            headerBackgroundColor: "#1a5276",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 9 },
            bodyFont: { size: 8 },
            alternateRowColor: true,
            alternateColor: "#eaf2f8",
            borderColor: "#cccccc",
            showTotal: true,
            totalLabel: "Grand Total",
            totalColumns: {
                capacity: fmtCurrency(totalCapacity),
                currentStock: fmtCurrency(totalStock),
                available: fmtCurrency(totalCapacity - totalStock),
            },
            totalBackgroundColor: "#d5e8d4",
            totalFont: { family: "Helvetica-Bold", size: 9 },
        });

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

        generateTable(doc, {
            columns: [
                { label: "#", key: "sno", width: 30, align: "center" },
                { label: "Date", key: "date", width: 70, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YYYY") },
                { label: "Type", key: "type", width: 40, align: "center" },
                { label: "Item", key: "item", width: "*", align: "left" },
                { label: "Farmer", key: "farmer", width: 90, align: "left" },
                { label: "Contract", key: "contract", width: 80, align: "center" },
                { label: "Room", key: "room", width: 60, align: "center" },
                { label: "Rack", key: "rack", width: 60, align: "center" },
                { label: "Qty", key: "quantity", width: 50, align: "right", format: fmtCurrency },
                { label: "Note", key: "note", width: 80, align: "left" },
            ],
            data: rows,
            showHeader: true,
            headerBackgroundColor: "#2c3e50",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 8 },
            bodyFont: { size: 7 },
            alternateRowColor: true,
            alternateColor: "#f9f9f9",
            borderColor: "#cccccc",
            rowHeight: 20,
            showTotal: true,
            totalLabel: "Total",
            totalColumns: {
                quantity: `IN: ${fmtCurrency(totalIn)} | OUT: ${fmtCurrency(totalOut)}`,
            },
            totalBackgroundColor: "#e0e0e0",
            totalFont: { family: "Helvetica-Bold", size: 8 },
        });

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
        generateInfoSection(doc, {
            data: {
                "Total Net Revenue": fmtCurrency(totalNet),
                "Total Tax Collected": fmtCurrency(totalTax),
                "Total Gross Revenue": fmtCurrency(totalAmount),
                "Total Payments Received": fmtCurrency(totalPayments),
                "Outstanding Balance": fmtCurrency(totalAmount - totalPayments),
                "Collection Rate": totalAmount > 0 ? ((totalPayments / totalAmount) * 100).toFixed(1) + "%" : "0%",
            },
            columns: 3,
            backgroundColor: "#f0faf0",
            borderColor: "#27ae60",
            labelFont: { family: "Helvetica-Bold", size: 9 },
            valueFont: { family: "Helvetica-Bold", size: 9, color: "#1a5276" },
        });

        pdfGen.moveDown(0.5);

        generateTable(doc, {
            columns: [
                { label: "#", key: "sno", width: 30, align: "center" },
                { label: "Date", key: "date", width: 70, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YYYY") },
                { label: "Contract", key: "contractCode", width: 90, align: "center" },
                { label: "Farmer", key: "farmer", width: "*", align: "left" },
                { label: "Status", key: "status", width: 60, align: "center" },
                { label: "Net Amount", key: "netAmount", width: 80, align: "right", format: fmtCurrency },
                { label: "Tax %", key: "taxRate", width: 45, align: "center" },
                { label: "Tax Amt", key: "taxAmount", width: 70, align: "right", format: fmtCurrency },
                { label: "Total", key: "totalAmount", width: 80, align: "right", format: fmtCurrency },
            ],
            data: rows,
            showHeader: true,
            headerBackgroundColor: "#1a6b3c",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 9 },
            bodyFont: { size: 8 },
            alternateRowColor: true,
            alternateColor: "#f0faf0",
            borderColor: "#cccccc",
            showTotal: true,
            totalLabel: "Grand Total",
            totalColumns: {
                netAmount: fmtCurrency(totalNet),
                taxAmount: fmtCurrency(totalTax),
                totalAmount: fmtCurrency(totalAmount),
            },
            totalBackgroundColor: "#d5e8d4",
            totalFont: { family: "Helvetica-Bold", size: 9 },
        });

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

        generateTable(doc, {
            columns: [
                { label: "#", key: "sno", width: 25, align: "center" },
                { label: "Code", key: "contractCode", width: 80, align: "center" },
                { label: "Farmer", key: "farmer", width: 80, align: "left" },
                { label: "Phone", key: "phone", width: 70, align: "center" },
                { label: "Start", key: "startDate", width: 65, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YY") },
                { label: "End", key: "endDate", width: 65, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YY") },
                { label: "Items", key: "items", width: "*", align: "left" },
                { label: "Qty", key: "totalQty", width: 40, align: "right", format: fmtCurrency },
                { label: "Net Amt", key: "netAmount", width: 65, align: "right", format: fmtCurrency },
                { label: "Total Amt", key: "totalAmount", width: 65, align: "right", format: fmtCurrency },
                { label: "Status", key: "status", width: 55, align: "center" },
            ],
            data: rows,
            showHeader: true,
            headerBackgroundColor: "#2c3e50",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 8 },
            bodyFont: { size: 7 },
            alternateRowColor: true,
            alternateColor: "#f9f9f9",
            borderColor: "#cccccc",
            rowHeight: 20,
            showTotal: true,
            totalLabel: "Total",
            totalColumns: {
                totalQty: fmtCurrency(rows.reduce((s, r) => s + r.totalQty, 0)),
                netAmount: fmtCurrency(contracts.reduce((s, c) => s + c.netAmount, 0)),
                totalAmount: fmtCurrency(contracts.reduce((s, c) => s + c.totalAmount, 0)),
            },
            totalBackgroundColor: "#e0e0e0",
            totalFont: { family: "Helvetica-Bold", size: 8 },
        });

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

        generateInfoSection(doc, {
            data: methodSummary,
            columns: Math.min(Object.keys(methodSummary).length, 4),
            backgroundColor: "#fff8e1",
            borderColor: "#f9a825",
            labelFont: { family: "Helvetica-Bold", size: 9 },
            valueFont: { family: "Helvetica-Bold", size: 9, color: "#e65100" },
        });

        pdfGen.moveDown(0.5);

        generateTable(doc, {
            columns: [
                { label: "#", key: "sno", width: 30, align: "center" },
                { label: "Date", key: "date", width: 70, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YYYY") },
                { label: "Farmer", key: "farmer", width: "*", align: "left" },
                { label: "Phone", key: "phone", width: 80, align: "center" },
                { label: "Amount", key: "amount", width: 80, align: "right", format: fmtCurrency },
                { label: "Method", key: "method", width: 70, align: "center" },
                { label: "Ref #", key: "transactionRef", width: 80, align: "center" },
                { label: "Remarks", key: "remarks", width: 80, align: "left" },
            ],
            data: rows,
            showHeader: true,
            headerBackgroundColor: "#e65100",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 9 },
            bodyFont: { size: 8 },
            alternateRowColor: true,
            alternateColor: "#fff8e1",
            borderColor: "#cccccc",
            showTotal: true,
            totalLabel: "Grand Total",
            totalColumns: { amount: fmtCurrency(totalAmount) },
            totalBackgroundColor: "#ffe0b2",
            totalFont: { family: "Helvetica-Bold", size: 10 },
        });

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
                ledgers: { orderBy: { id: "desc" }, take: 1 },
                contracts: { where: { status: "ACTIVE" } },
            },
        });

        // Only farmers with outstanding balance (balance > 0 means they owe)
        const rows = farmers
            .map((f) => {
                const lastLedger = f.ledgers[0];
                const balance = lastLedger?.balance || 0;
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
                "Farmers with Dues": rows.length,
                "Total Outstanding": fmtCurrency(totalOutstanding),
            })
        );
        const doc = pdfGen.getDocument();

        generateInfoSection(doc, {
            data: {
                "Total Farmers with Dues": rows.length.toString(),
                "Total Outstanding Amount": fmtCurrency(totalOutstanding),
                "Average Outstanding": rows.length > 0 ? fmtCurrency(totalOutstanding / rows.length) : "0",
                "Highest Due": rows.length > 0 ? fmtCurrency(rows[0].balance) : "0",
            },
            columns: 2,
            backgroundColor: "#fce4ec",
            borderColor: "#c62828",
            labelFont: { family: "Helvetica-Bold", size: 9 },
            valueFont: { family: "Helvetica-Bold", size: 9, color: "#b71c1c" },
        });

        pdfGen.moveDown(0.5);

        generateTable(doc, {
            columns: [
                { label: "#", key: "farmerId", width: 30, align: "center" },
                { label: "Farmer Name", key: "name", width: "*", align: "left" },
                { label: "Phone", key: "phone", width: 80, align: "center" },
                { label: "CNIC", key: "cnic", width: 90, align: "center" },
                { label: "Active Contracts", key: "activeContracts", width: 55, align: "center" },
                { label: "Outstanding Amt", key: "balance", width: 90, align: "right", format: fmtCurrency },
            ],
            data: rows,
            showHeader: true,
            headerBackgroundColor: "#c62828",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 9 },
            bodyFont: { size: 8 },
            alternateRowColor: true,
            alternateColor: "#ffebee",
            borderColor: "#cccccc",
            showTotal: true,
            totalLabel: "Grand Total",
            totalColumns: { balance: fmtCurrency(totalOutstanding) },
            totalBackgroundColor: "#ffcdd2",
            totalFont: { family: "Helvetica-Bold", size: 10 },
        });

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

        generateTable(doc, {
            columns: [
                { label: "#", key: "sno", width: 30, align: "center" },
                { label: "Packaging Type", key: "packagingType", width: "*", align: "left" },
                { label: "Rate Type", key: "rateType", width: 100, align: "center" },
                { label: "Rate Amount", key: "rateAmount", width: 100, align: "right", format: fmtCurrency },
                { label: "Created", key: "createdAt", width: 90, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YYYY") },
                { label: "Updated", key: "updatedAt", width: 90, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YYYY") },
            ],
            data: rows,
            showHeader: true,
            headerBackgroundColor: "#6a1b9a",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 10 },
            bodyFont: { size: 9 },
            alternateRowColor: true,
            alternateColor: "#f3e5f5",
            borderColor: "#cccccc",
        });

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

        generateTable(doc, {
            columns: [
                { label: "#", key: "sno", width: 25, align: "center" },
                { label: "Contract", key: "contractCode", width: 80, align: "center" },
                { label: "Farmer", key: "farmer", width: "*", align: "left" },
                { label: "Phone", key: "phone", width: 75, align: "center" },
                { label: "Start", key: "startDate", width: 65, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YY") },
                { label: "End", key: "endDate", width: 65, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YY") },
                { label: "Time Left", key: "daysLeft", width: 65, align: "center" },
                { label: "Amount", key: "totalAmount", width: 70, align: "right", format: fmtCurrency },
            ],
            data: rows,
            showHeader: true,
            headerBackgroundColor: "#e65100",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 9 },
            bodyFont: { size: 8 },
            alternateRowColor: true,
            alternateColor: "#fff3e0",
            borderColor: "#cccccc",
        });

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
                ledgers: { orderBy: { id: "desc" }, take: 1 },
                payments: true,
            },
            orderBy: { name: "asc" },
        });

        const rows = farmers.map((f, i) => {
            const lastLedger = f.ledgers[0];
            const totalPaid = f.payments.reduce((s, p) => s + p.amount, 0);
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
                balance: lastLedger?.balance || 0,
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

        generateTable(doc, {
            columns: [
                { label: "#", key: "sno", width: 25, align: "center" },
                { label: "Name", key: "name", width: "*", align: "left" },
                { label: "Phone", key: "phone", width: 75, align: "center" },
                { label: "CNIC", key: "cnic", width: 85, align: "center" },
                { label: "Marka", key: "marka", width: 55, align: "center" },
                { label: "Contracts", key: "totalContracts", width: 45, align: "center" },
                { label: "Active", key: "activeContracts", width: 40, align: "center" },
                { label: "Total Paid", key: "totalPaid", width: 70, align: "right", format: fmtCurrency },
                { label: "Balance", key: "balance", width: 70, align: "right", format: fmtCurrency },
                { label: "Joined", key: "joinedDate", width: 65, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YY") },
            ],
            data: rows,
            showHeader: true,
            headerBackgroundColor: "#0d47a1",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 8 },
            bodyFont: { size: 7 },
            alternateRowColor: true,
            alternateColor: "#e3f2fd",
            borderColor: "#cccccc",
            rowHeight: 20,
        });

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
        generateInfoSection(doc, {
            data: {
                "Farmer Name": farmer.name,
                "Phone": farmer.phone,
                "CNIC": farmer.cnic || "N/A",
                "Address": farmer.address || "N/A",
                "Marka": farmer.marka || "N/A",
                "Member Since": dayjs(farmer.createdAt).format("DD MMM YYYY"),
            },
            columns: 3,
            backgroundColor: "#e8f5e9",
            borderColor: "#2e7d32",
            labelFont: { family: "Helvetica-Bold", size: 9 },
            valueFont: { size: 9 },
        });

        pdfGen.moveDown(0.5);

        // ── Account Summary ────────────────────
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#333333").text("Account Summary");
        pdfGen.moveDown(0.3);

        generateInfoSection(doc, {
            data: {
                "Total Contracts": contracts.length.toString(),
                "Active Contracts": contracts.filter((c) => c.status === "ACTIVE").length.toString(),
                "Total Invoiced (Debit)": fmtCurrency(totalDebit),
                "Total Paid (Credit)": fmtCurrency(totalCredit),
                "Closing Balance": fmtCurrency(closingBalance),
                "Total Payments Count": payments.length.toString(),
            },
            columns: 3,
            backgroundColor: "#fff3e0",
            borderColor: "#f57c00",
            labelFont: { family: "Helvetica-Bold", size: 9 },
            valueFont: { family: "Helvetica-Bold", size: 9, color: "#e65100" },
        });

        pdfGen.moveDown(0.5);

        // ── Contracts Table ────────────────────
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#333333").text("Contracts");
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

        generateTable(doc, {
            columns: [
                { label: "#", key: "sno", width: 25, align: "center" },
                { label: "Code", key: "code", width: 80, align: "center" },
                { label: "Start", key: "startDate", width: 60, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YY") },
                { label: "End", key: "endDate", width: 60, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YY") },
                { label: "Items", key: "items", width: "*", align: "left" },
                { label: "Qty", key: "qty", width: 35, align: "right" },
                { label: "Net Amt", key: "netAmount", width: 65, align: "right", format: fmtCurrency },
                { label: "Total", key: "totalAmount", width: 65, align: "right", format: fmtCurrency },
                { label: "Status", key: "status", width: 55, align: "center" },
            ],
            data: contractRows,
            showHeader: true,
            headerBackgroundColor: "#1565c0",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 9 },
            bodyFont: { size: 8 },
            alternateRowColor: true,
            alternateColor: "#e3f2fd",
            borderColor: "#cccccc",
            rowHeight: 20,
            showTotal: true,
            totalLabel: "Total",
            totalColumns: {
                netAmount: fmtCurrency(contracts.reduce((s, c) => s + c.netAmount, 0)),
                totalAmount: fmtCurrency(contracts.reduce((s, c) => s + c.totalAmount, 0)),
            },
            totalBackgroundColor: "#bbdefb",
            totalFont: { family: "Helvetica-Bold", size: 9 },
        });

        pdfGen.moveDown(0.5);

        // ── Payments Table ────────────────────
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#333333").text("Payments");
        pdfGen.moveDown(0.3);

        const paymentRows = payments.map((p, i) => ({
            sno: i + 1,
            date: p.paymentDate,
            amount: p.amount,
            method: p.paymentMethod,
            ref: p.transactionRef || "N/A",
            remarks: p.remarks || "",
        }));

        generateTable(doc, {
            columns: [
                { label: "#", key: "sno", width: 30, align: "center" },
                { label: "Date", key: "date", width: 80, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YYYY") },
                { label: "Amount", key: "amount", width: 90, align: "right", format: fmtCurrency },
                { label: "Method", key: "method", width: 80, align: "center" },
                { label: "Ref #", key: "ref", width: "*", align: "center" },
                { label: "Remarks", key: "remarks", width: 100, align: "left" },
            ],
            data: paymentRows,
            showHeader: true,
            headerBackgroundColor: "#2e7d32",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 9 },
            bodyFont: { size: 8 },
            alternateRowColor: true,
            alternateColor: "#e8f5e9",
            borderColor: "#cccccc",
            showTotal: true,
            totalLabel: "Total Paid",
            totalColumns: { amount: fmtCurrency(payments.reduce((s, p) => s + p.amount, 0)) },
            totalBackgroundColor: "#c8e6c9",
            totalFont: { family: "Helvetica-Bold", size: 9 },
        });

        pdfGen.moveDown(0.5);

        // ── Ledger Table ────────────────────
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#333333").text("Ledger Transactions");
        pdfGen.moveDown(0.3);

        generateTable(doc, {
            columns: [
                { label: "Date", key: "transactionDate", width: 70, align: "center", format: (v: any) => fmtDate(v, "DD-MM-YYYY") },
                { label: "Description", key: "description", width: "*", align: "left" },
                { label: "Debit", key: "debit", width: 80, align: "right", format: (v: any) => (v ? fmtCurrency(v) : "-") },
                { label: "Credit", key: "credit", width: 80, align: "right", format: (v: any) => (v ? fmtCurrency(v) : "-") },
                { label: "Balance", key: "balance", width: 80, align: "right", format: fmtCurrency },
            ],
            data: ledgerRows,
            showHeader: true,
            headerBackgroundColor: "#333333",
            headerTextColor: "#ffffff",
            headerFont: { family: "Helvetica-Bold", size: 9 },
            bodyFont: { size: 8 },
            alternateRowColor: false,
            borderColor: "#cccccc",
            showTotal: true,
            totalLabel: "Total",
            totalColumns: {
                debit: fmtCurrency(totalDebit),
                credit: fmtCurrency(totalCredit),
                balance: fmtCurrency(closingBalance),
            },
            totalBackgroundColor: "#e0e0e0",
            totalFont: { family: "Helvetica-Bold", size: 9 },
        });

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
            doc.fontSize(13).font("Helvetica-Bold").fillColor("#1565c0")
                .text(`Contract: ${c.contractCode}`, 20, doc.y);
            pdfGen.moveDown(0.3);

            generateInfoSection(doc, {
                data: {
                    "Status": c.status,
                    "Start Date": fmtDate(c.startDate),
                    "Expected End": fmtDate(c.expectedEndDate),
                    "Net Amount": fmtCurrency(c.netAmount),
                    "Tax": `${(c.saleTaxRate * 100).toFixed(0)}% (${fmtCurrency(c.salesTaxAmount)})`,
                    "Total Amount": fmtCurrency(c.totalAmount),
                },
                columns: 3,
                backgroundColor: "#e3f2fd",
                borderColor: "#1565c0",
                labelFont: { family: "Helvetica-Bold", size: 8 },
                valueFont: { size: 8 },
            });

            pdfGen.moveDown(0.3);

            // Items table
            doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333").text("Contract Items");
            pdfGen.moveDown(0.2);

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

            generateTable(doc, {
                columns: [
                    { label: "#", key: "sno", width: 20, align: "center" },
                    { label: "Item", key: "item", width: "*", align: "left" },
                    { label: "Pkg", key: "packaging", width: 50, align: "center" },
                    { label: "Qty", key: "quantity", width: 40, align: "right" },
                    { label: "Rate", key: "unitRate", width: 50, align: "right", format: fmtCurrency },
                    { label: "Amount", key: "amount", width: 60, align: "right", format: fmtCurrency },
                    { label: "In", key: "stockIn", width: 35, align: "right" },
                    { label: "Out", key: "stockOut", width: 35, align: "right" },
                    { label: "Remaining", key: "remaining", width: 50, align: "right" },
                    { label: "Late Chg", key: "lateCharges", width: 55, align: "right", format: fmtCurrency },
                ],
                data: itemRows,
                showHeader: true,
                headerBackgroundColor: "#37474f",
                headerTextColor: "#ffffff",
                headerFont: { family: "Helvetica-Bold", size: 8 },
                bodyFont: { size: 7 },
                alternateRowColor: true,
                alternateColor: "#eceff1",
                borderColor: "#cccccc",
                rowHeight: 18,
                showTotal: true,
                totalLabel: "Total",
                totalColumns: {
                    amount: fmtCurrency(itemRows.reduce((s, r) => s + r.amount, 0)),
                    stockIn: itemRows.reduce((s, r) => s + r.stockIn, 0).toString(),
                    stockOut: itemRows.reduce((s, r) => s + r.stockOut, 0).toString(),
                    remaining: itemRows.reduce((s, r) => s + r.remaining, 0).toString(),
                    lateCharges: fmtCurrency(itemRows.reduce((s, r) => s + r.lateCharges, 0)),
                },
                totalBackgroundColor: "#cfd8dc",
                totalFont: { family: "Helvetica-Bold", size: 8 },
            });

            if (c.notes) {
                pdfGen.moveDown(0.3);
                doc.fontSize(8).font("Helvetica").fillColor("#666666").text(`Notes: ${c.notes}`);
            }
        }

        // Grand totals page
        if (contracts.length > 1) {
            pdfGen.addPage();
            doc.fontSize(14).font("Helvetica-Bold").fillColor("#333333").text("Grand Summary — All Contracts");
            pdfGen.moveDown(0.5);

            const totalNet = contracts.reduce((s, c) => s + c.netAmount, 0);
            const totalTax = contracts.reduce((s, c) => s + c.salesTaxAmount, 0);
            const totalGross = contracts.reduce((s, c) => s + c.totalAmount, 0);

            generateInfoSection(doc, {
                data: {
                    "Total Contracts": contracts.length.toString(),
                    "Active": contracts.filter((c) => c.status === "ACTIVE").length.toString(),
                    "Completed": contracts.filter((c) => c.status === "COMPLETED").length.toString(),
                    "Total Net Amount": fmtCurrency(totalNet),
                    "Total Tax": fmtCurrency(totalTax),
                    "Total Gross Amount": fmtCurrency(totalGross),
                },
                columns: 3,
                backgroundColor: "#e8f5e9",
                borderColor: "#2e7d32",
                labelFont: { family: "Helvetica-Bold", size: 10 },
                valueFont: { family: "Helvetica-Bold", size: 10, color: "#1b5e20" },
            });
        }

        await pdfGen.sendToResponse(res, `farmer-contracts-${farmer.name}-${dayjs().format("YYYY-MM-DD")}.pdf`);
    } catch (error) {
        console.error("Farmer contracts report error:", error);
        res.status(500).json({ error: "Failed to generate farmer contracts report", message: error instanceof Error ? error.message : "Unknown error" });
    }
};
