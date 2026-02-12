import { Request, Response } from 'express';
import { prisma } from '../prisma/prisma';

/**
 * Get overall statistics for all cold stores
 */
export const getAllStoresStatistics = async (req: Request, res: Response) => {
    try {
        const stores = await prisma.coldStore.findMany({
            include: {
                rooms: {
                    include: {
                        racks: true,
                    },
                },
            },
        });

        const storeStats = await Promise.all(
            stores.map(async (store) => {
                // 1. Active contracts count
                const activeContractsCount = await prisma.contract.count({
                    where: {
                        farmer: {
                            storeId: store.id,
                        },
                        status: 'ACTIVE',
                    },
                });

                // 2. Number of farmers
                const farmersCount = await prisma.farmer.count({
                    where: {
                        storeId: store.id,
                    },
                });

                // 3. Storage capacity (sum of all room capacities)
                const totalCapacity = store.rooms.reduce(
                    (sum, room) => sum + room.roomCapacity,
                    0
                );

                // Current stock (sum of all rack current stock)
                const currentStock = store.rooms.reduce(
                    (sum, room) =>
                        sum + room.racks.reduce((rackSum, rack) => rackSum + rack.currentStock, 0),
                    0
                );

                // 4. Monthly revenue (current month)
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

                const monthlyRevenue = await prisma.invoice.aggregate({
                    where: {
                        contract: {
                            farmer: {
                                storeId: store.id,
                            },
                        },
                        invoiceDate: {
                            gte: startOfMonth,
                            lte: endOfMonth,
                        },
                    },
                    _sum: {
                        netAmount: true,
                    },
                });

                return {
                    storeId: store.id,
                    storeName: store.name,
                    address: store.address,
                    phone: store.phone,
                    activeContracts: activeContractsCount,
                    farmersCount: farmersCount,
                    storageCapacity: totalCapacity,
                    currentStock: currentStock,
                    utilizationRate: totalCapacity > 0
                        ? ((currentStock / totalCapacity) * 100).toFixed(2)
                        : '0.00',
                    monthlyRevenue: monthlyRevenue._sum.netAmount || 0,
                };
            })
        );

        // Calculate totals
        const totals = {
            totalStores: stores.length,
            totalActiveContracts: storeStats.reduce((sum, s) => sum + s.activeContracts, 0),
            totalFarmers: storeStats.reduce((sum, s) => sum + s.farmersCount, 0),
            totalCapacity: storeStats.reduce((sum, s) => sum + s.storageCapacity, 0),
            totalCurrentStock: storeStats.reduce((sum, s) => sum + s.currentStock, 0),
            totalMonthlyRevenue: storeStats.reduce((sum, s) => sum + s.monthlyRevenue, 0),
        };

        res.json({
            success: true,
            data: {
                stores: storeStats,
                totals,
            },
        });
    } catch (error) {
        console.error('Error fetching store statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch store statistics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get revenue trend for all stores over specified months
 */
export const getRevenueTrend = async (req: Request, res: Response) => {
    try {
        const { months = 12 } = req.query;
        const monthsCount = parseInt(months as string, 10);

        const stores = await prisma.coldStore.findMany();

        const trends = await Promise.all(
            stores.map(async (store) => {
                const monthlyData = [];
                const now = new Date();

                for (let i = monthsCount - 1; i >= 0; i--) {
                    const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

                    const revenue = await prisma.invoice.aggregate({
                        where: {
                            contract: {
                                farmer: {
                                    storeId: store.id,
                                },
                            },
                            invoiceDate: {
                                gte: startDate,
                                lte: endDate,
                            },
                        },
                        _sum: {
                            netAmount: true,
                        },
                    });

                    const contractsCount = await prisma.contract.count({
                        where: {
                            farmer: {
                                storeId: store.id,
                            },
                            startDate: {
                                lte: endDate,
                            },
                            OR: [
                                { actualEndDate: null },
                                { actualEndDate: { gte: startDate } },
                            ],
                        },
                    });

                    monthlyData.push({
                        month: startDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
                        date: startDate.toISOString().split('T')[0],
                        revenue: revenue._sum.netAmount || 0,
                        activeContracts: contractsCount,
                    });
                }

                return {
                    storeId: store.id,
                    storeName: store.name,
                    trend: monthlyData,
                };
            })
        );

        // Calculate combined trend for all stores
        const combinedTrend = [];
        for (let i = 0; i < monthsCount; i++) {
            const monthData = {
                month: trends[0]?.trend[i]?.month || '',
                date: trends[0]?.trend[i]?.date || '',
                totalRevenue: trends.reduce((sum, store) => sum + (store.trend[i]?.revenue || 0), 0),
                totalActiveContracts: trends.reduce((sum, store) => sum + (store.trend[i]?.activeContracts || 0), 0),
            };
            combinedTrend.push(monthData);
        }

        res.json({
            success: true,
            data: {
                byStore: trends,
                combined: combinedTrend,
            },
        });
    } catch (error) {
        console.error('Error fetching revenue trend:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch revenue trend',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get items statistics and trends over time
 */
export const getItemsStatistics = async (req: Request, res: Response) => {
    try {
        const { storeId, months = 6 } = req.query;
        const monthsCount = parseInt(months as string, 10);

        // Get all items
        const itemsFilter = storeId ? { storeId: parseInt(storeId as string, 10) } : {};
        const items = await prisma.item.findMany({
            where: itemsFilter,
        });

        const itemStats = await Promise.all(
            items.map(async (item) => {
                // Total stock movements for this item
                const movements = await prisma.stockMovement.findMany({
                    where: {
                        contractLine: {
                            itemId: item.id,
                        },
                    },
                    orderBy: {
                        movementDate: 'asc',
                    },
                });

                const totalIn = movements
                    .filter((m) => m.movementType === 'IN')
                    .reduce((sum, m) => sum + m.quantity, 0);

                const totalOut = movements
                    .filter((m) => m.movementType === 'OUT')
                    .reduce((sum, m) => sum + m.quantity, 0);

                const currentStock = totalIn - totalOut;

                // Get monthly trend
                const monthlyTrend = [];
                const now = new Date();

                for (let i = monthsCount - 1; i >= 0; i--) {
                    const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

                    const monthMovements = await prisma.stockMovement.findMany({
                        where: {
                            contractLine: {
                                itemId: item.id,
                            },
                            movementDate: {
                                gte: startDate,
                                lte: endDate,
                            },
                        },
                    });

                    const monthIn = monthMovements
                        .filter((m) => m.movementType === 'IN')
                        .reduce((sum, m) => sum + m.quantity, 0);

                    const monthOut = monthMovements
                        .filter((m) => m.movementType === 'OUT')
                        .reduce((sum, m) => sum + m.quantity, 0);

                    monthlyTrend.push({
                        month: startDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
                        date: startDate.toISOString().split('T')[0],
                        stockIn: monthIn,
                        stockOut: monthOut,
                        netChange: monthIn - monthOut,
                    });
                }

                return {
                    itemId: item.id,
                    itemName: item.name,
                    description: item.description,
                    totalStockIn: totalIn,
                    totalStockOut: totalOut,
                    currentStock: currentStock,
                    monthlyTrend,
                };
            })
        );

        res.json({
            success: true,
            data: itemStats,
        });
    } catch (error) {
        console.error('Error fetching items statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch items statistics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get detailed statistics for a specific store
 */
export const getStoreDetailedStatistics = async (req: Request, res: Response) => {
    try {
        const { storeId } = req.params;
        const storeIdNum = parseInt(storeId, 10);

        const store = await prisma.coldStore.findUnique({
            where: { id: storeIdNum },
            include: {
                rooms: {
                    include: {
                        racks: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                    },
                },
            },
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: 'Store not found',
            });
        }

        // Active contracts with details
        const activeContracts = await prisma.contract.findMany({
            where: {
                farmer: {
                    storeId: storeIdNum,
                },
                status: 'ACTIVE',
            },
            include: {
                farmer: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
                items: {
                    include: {
                        item: true,
                    },
                },
            },
        });

        // Farmers list
        const farmers = await prisma.farmer.findMany({
            where: {
                storeId: storeIdNum,
            },
            include: {
                contracts: {
                    select: {
                        id: true,
                        status: true,
                    },
                },
            },
        });

        // Room utilization
        const roomUtilization = store.rooms.map((room) => {
            const totalRackCapacity = room.racks.reduce((sum, rack) => sum + (rack.capacity || 0), 0);
            const totalRackStock = room.racks.reduce((sum, rack) => sum + rack.currentStock, 0);

            return {
                roomId: room.id,
                roomName: room.name,
                capacity: room.roomCapacity,
                currentStock: totalRackStock,
                utilizationRate: totalRackCapacity > 0
                    ? ((totalRackStock / totalRackCapacity) * 100).toFixed(2)
                    : '0.00',
                numOfRacks: room.numOfRacks,
                isActive: room.isActive,
            };
        });

        // Revenue summary (last 3 months)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const recentInvoices = await prisma.invoice.findMany({
            where: {
                contract: {
                    farmer: {
                        storeId: storeIdNum,
                    },
                },
                invoiceDate: {
                    gte: threeMonthsAgo,
                },
            },
            orderBy: {
                invoiceDate: 'desc',
            },
        });

        const paidInvoices = recentInvoices.filter((inv) => inv.status === 'PAID');
        const unpaidInvoices = recentInvoices.filter((inv) => inv.status === 'UNPAID');
        const partialInvoices = recentInvoices.filter((inv) => inv.status === 'PARTIAL');

        const revenueSummary = {
            totalInvoiced: recentInvoices.reduce((sum, inv) => sum + inv.netAmount, 0),
            totalPaid: paidInvoices.reduce((sum, inv) => sum + inv.netAmount, 0),
            totalUnpaid: unpaidInvoices.reduce((sum, inv) => sum + inv.netAmount, 0),
            totalPartial: partialInvoices.reduce((sum, inv) => sum + inv.netAmount, 0),
            invoiceCount: recentInvoices.length,
        };

        res.json({
            success: true,
            data: {
                store: {
                    id: store.id,
                    name: store.name,
                    address: store.address,
                    phone: store.phone,
                    manager: store.user,
                },
                activeContractsCount: activeContracts.length,
                activeContracts: activeContracts.slice(0, 10), // Return first 10
                farmersCount: farmers.length,
                farmers: farmers.slice(0, 20), // Return first 20
                roomUtilization,
                totalCapacity: store.rooms.reduce((sum, room) => sum + room.roomCapacity, 0),
                totalCurrentStock: roomUtilization.reduce((sum, room) => sum + parseInt(room.currentStock.toString()), 0),
                revenueSummary,
            },
        });
    } catch (error) {
        console.error('Error fetching store detailed statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch store detailed statistics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get dashboard summary with key metrics
 */
export const getDashboardSummary = async (req: Request, res: Response) => {
    try {
        // Total stores
        const totalStores = await prisma.coldStore.count();

        // Total active contracts
        const totalActiveContracts = await prisma.contract.count({
            where: {
                status: 'ACTIVE',
            },
        });

        // Total farmers
        const totalFarmers = await prisma.farmer.count();

        // Total capacity and current stock
        const rooms = await prisma.room.findMany({
            include: {
                racks: true,
            },
        });

        const totalCapacity = rooms.reduce((sum, room) => sum + room.roomCapacity, 0);
        const totalCurrentStock = rooms.reduce(
            (sum, room) => sum + room.racks.reduce((rackSum, rack) => rackSum + rack.currentStock, 0),
            0
        );

        // Current month revenue
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyRevenue = await prisma.invoice.aggregate({
            where: {
                invoiceDate: {
                    gte: startOfMonth,
                },
            },
            _sum: {
                netAmount: true,
            },
        });

        // Unpaid invoices
        const unpaidInvoicesTotal = await prisma.invoice.aggregate({
            where: {
                status: {
                    in: ['UNPAID', 'PARTIAL'],
                },
            },
            _sum: {
                netAmount: true,
            },
        });

        const unpaidInvoicesCount = await prisma.invoice.count({
            where: {
                status: {
                    in: ['UNPAID', 'PARTIAL'],
                },
            },
        });

        // Recent activities (last 10 stock movements)
        const recentActivities = await prisma.stockMovement.findMany({
            take: 10,
            orderBy: {
                movementDate: 'desc',
            },
            include: {
                contractLine: {
                    include: {
                        item: true,
                        contract: {
                            include: {
                                farmer: true,
                            },
                        },
                    },
                },
                rack: {
                    include: {
                        room: {
                            include: {
                                store: true,
                            },
                        },
                    },
                },
            },
        });

        res.json({
            success: true,
            data: {
                summary: {
                    totalStores,
                    totalActiveContracts,
                    totalFarmers,
                    totalCapacity,
                    totalCurrentStock,
                    utilizationRate: totalCapacity > 0
                        ? ((totalCurrentStock / totalCapacity) * 100).toFixed(2)
                        : '0.00',
                    monthlyRevenue: monthlyRevenue._sum.netAmount || 0,
                    unpaidAmount: unpaidInvoicesTotal._sum.netAmount || 0,
                    unpaidInvoicesCount,
                },
                recentActivities: recentActivities.map((activity) => ({
                    id: activity.id,
                    type: activity.movementType,
                    quantity: activity.quantity,
                    date: activity.movementDate,
                    item: activity.contractLine?.item?.name,
                    farmer: activity.contractLine?.contract?.farmer?.name,
                    store: activity.rack?.room?.store?.name,
                    room: activity.rack?.room?.name,
                    rack: activity.rack?.name,
                    note: activity.referenceNote,
                })),
            },
        });
    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard summary',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
