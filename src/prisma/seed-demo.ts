/**
 * Demo Seed Script
 * Seeds realistic demo data for user id=2 (demo subscriber).
 * Covers: expense types, expenses, farmers, employees, employee ledger,
 * salary slips, contracts, stock in/out, payments, rooms/racks, store users.
 */
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

// ── Helpers ──────────────────────────────────────────────────────────────────
function rand(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const paymentMethods = ['CASH', 'BANK', 'EASYPaisa', 'JAZZCASH', 'CHEQUE'] as const;

async function seedDemo() {
    // ── 0. Verify demo user (id=2) exists ────────────────────────────────────
    const demoUser = await prisma.user.findUnique({ where: { id: 2 } });
    if (!demoUser) {
        console.error('Demo user (id=2) not found. Run base seed first: npm run prisma:seed');
        process.exit(1);
    }

    // Check if demo data already exists
    const subscription = await prisma.subscription.findUnique({ where: { userId: 2 } });
    if (!subscription) {
        console.error('No subscription found for demo user. Run base seed first.');
        process.exit(1);
    }

    const existingStore = await prisma.coldStore.findFirst({
        where: { subscriptionId: subscription.id },
    });
    if (!existingStore) {
        console.error('No cold store found for demo subscription. Run base seed first.');
        process.exit(1);
    }

    const storeId = existingStore.id;

    // Check if demo data was already seeded (heuristic: >5 farmers means demo data exists)
    const farmerCount = await prisma.farmer.count({ where: { storeId } });
    if (farmerCount > 5) {
        console.log('Demo data already seeded, skipping...');
        return;
    }

    console.log(`Seeding demo data for store "${existingStore.name}" (id=${storeId})...`);

    // ── 1. Store Users ───────────────────────────────────────────────────────
    const staffPassword = await bcrypt.hash('password', 10);
    const staffUsers = await Promise.all(
        [
            { username: 'munshi1', name: 'Azhar Munshi', phone: '0301-1234567' },
            { username: 'munshi2', name: 'Tariq Ahmad', phone: '0302-2345678' },
        ].map((u) =>
            prisma.user.create({
                data: {
                    ...u,
                    password: staffPassword,
                    systemRole: 'USER',
                    isActive: true,
                    createdById: 2,
                },
            })
        )
    );

    for (const u of staffUsers) {
        await prisma.storeUser.create({
            data: { storeId, userId: u.id, role: 'EMPLOYEE', isActive: true },
        });
    }

    // Also add demo user as store admin
    await prisma.storeUser.upsert({
        where: { storeId_userId: { storeId, userId: 2 } },
        create: { storeId, userId: 2, role: 'ADMIN', isActive: true },
        update: {},
    });

    console.log('  ✓ Store users');

    // ── 2. Rooms & Racks ────────────────────────────────────────────────────
    const roomDefs = [
        { name: 'Room A', tempMin: -2, tempMax: 4, numOfFloors: 3, numOfRacks: 4, roomCapacity: 4800 },
        { name: 'Room B', tempMin: 0, tempMax: 6, numOfFloors: 2, numOfRacks: 5, roomCapacity: 4000 },
        { name: 'Room C', tempMin: -5, tempMax: 0, numOfFloors: 2, numOfRacks: 3, roomCapacity: 2400 },
    ];

    const rooms: { id: number; rackIds: number[] }[] = [];
    for (const rd of roomDefs) {
        const { numOfFloors, numOfRacks, roomCapacity, ...rest } = rd;
        const denom = numOfRacks * 2 * numOfFloors;
        const rackCapacity = denom > 0 ? Math.floor(roomCapacity / denom) : 0;

        const rackData: { name: string; capacity: number }[] = [];
        for (let floor = 1; floor <= numOfFloors; floor++) {
            const floorLabel = String.fromCharCode(64 + floor); // A, B, C...
            for (let r = 1; r <= numOfRacks; r++) {
                rackData.push({ name: `${r}${floorLabel}-L`, capacity: rackCapacity });
                rackData.push({ name: `${r}${floorLabel}-R`, capacity: rackCapacity });
            }
        }

        const room = await prisma.room.create({
            data: {
                ...rest,
                numOfFloors,
                numOfRacks,
                roomCapacity,
                storeId,
                racks: { create: rackData },
            },
            include: { racks: true },
        });
        rooms.push({ id: room.id, rackIds: room.racks.map((r) => r.id) });
    }

    const allRackIds = rooms.flatMap((r) => r.rackIds);
    console.log('  ✓ Rooms & racks');

    // ── 3. Items ─────────────────────────────────────────────────────────────
    // Items may already exist from base seed, fetch them
    let items = await prisma.item.findMany({ where: { storeId } });
    if (items.length === 0) {
        await prisma.item.createMany({
            data: [
                { name: 'Esmi Potato', storeId },
                { name: 'Mozika Potato', storeId },
                { name: 'LR Potato', storeId },
                { name: 'LR Goli', storeId },
                { name: 'Mozika Goli', storeId },
            ],
        });
        items = await prisma.item.findMany({ where: { storeId } });
    }

    // ── 4. Expense Types ────────────────────────────────────────────────────
    const expenseTypeNames = ['Electricity', 'Diesel/Generator', 'Repairs', 'Staff Food', 'Transport', 'Cleaning', 'Miscellaneous'];
    const expenseTypes: { id: number; name: string }[] = [];
    for (const name of expenseTypeNames) {
        const et = await prisma.expenseType.create({ data: { name } });
        expenseTypes.push({ id: et.id, name: et.name });
    }
    console.log('  ✓ Expense types');

    // ── 5. Farmers ───────────────────────────────────────────────────────────
    const farmerDefs = [
        { name: 'Muhammad Aslam', phone: '0300-1111111', cnic: '3310012345671', address: 'Chak 45, Depalpur', marka: 'Aslam Wala' },
        { name: 'Ghulam Mustafa', phone: '0301-2222222', cnic: '3310012345672', address: 'Pattoki Road', marka: 'Mustafa Marka' },
        { name: 'Haji Bashir', phone: '0302-3333333', cnic: '3310012345673', address: 'Kasur Bypass', marka: 'Bashir & Sons' },
        { name: 'Rana Iqbal', phone: '0303-4444444', cnic: '3310012345674', address: 'Manga Mandi', marka: 'Iqbal Wala' },
        { name: 'Chaudhry Akram', phone: '0304-5555555', cnic: '3310012345675', address: 'Renala Khurd', marka: 'Akram Agri' },
        { name: 'Sardar Mehmood', phone: '0305-6666666', cnic: '3310012345676', address: 'Okara Road', marka: 'Mehmood Cold' },
        { name: 'Allah Ditta', phone: '0306-7777777', cnic: '3310012345677', address: 'Sahiwal Road', marka: 'Ditta Kisaan' },
        { name: 'Malik Zafar', phone: '0307-8888888', cnic: '3310012345678', address: 'Pakpattan Chowk', marka: 'Zafar Farms' },
        { name: 'Shabbir Hussain', phone: '0308-9999999', cnic: '3310012345679', address: 'Arifwala Road', marka: 'Hussain Bros' },
        { name: 'Nawaz Sharif Khan', phone: '0309-1010101', cnic: '3310012345680', address: 'Vehari Road', marka: 'Nawaz Marka' },
    ];

    const farmers: { id: number; name: string }[] = [];
    for (const f of farmerDefs) {
        const farmer = await prisma.farmer.create({ data: { ...f, storeId } });
        farmers.push({ id: farmer.id, name: farmer.name });
    }
    console.log('  ✓ Farmers');

    // ── 6. Employees ─────────────────────────────────────────────────────────
    const employeeDefs = [
        { name: 'Imran Ali', phone: '0321-1000001', designation: 'Munshi', baseSalary: 25000, joiningDate: dayjs().subtract(8, 'month').toDate() },
        { name: 'Asif Mehmood', phone: '0321-1000002', designation: 'Labour Head', baseSalary: 20000, joiningDate: dayjs().subtract(6, 'month').toDate() },
        { name: 'Kashif Raza', phone: '0321-1000003', designation: 'Guard', baseSalary: 18000, joiningDate: dayjs().subtract(10, 'month').toDate() },
        { name: 'Faisal Hayat', phone: '0321-1000004', designation: 'Cleaner', baseSalary: 15000, joiningDate: dayjs().subtract(5, 'month').toDate() },
        { name: 'Waqas Ahmed', phone: '0321-1000005', designation: 'Electrician', baseSalary: 22000, joiningDate: dayjs().subtract(7, 'month').toDate() },
        { name: 'Bilal Khan', phone: '0321-1000006', designation: 'Driver', baseSalary: 20000, joiningDate: dayjs().subtract(4, 'month').toDate() },
    ];

    const employees: { id: number; baseSalary: number; joiningDate: Date }[] = [];
    for (const e of employeeDefs) {
        const emp = await prisma.employee.create({
            data: { ...e, storeId, advanceLimit: 10000, active: true },
        });
        employees.push({ id: emp.id, baseSalary: emp.baseSalary, joiningDate: emp.joiningDate });
    }
    console.log('  ✓ Employees');

    // ── 7. Employee Ledger (advances) ───────────────────────────────────────
    for (const emp of employees) {
        // 2-3 advance entries per employee over past months
        const numEntries = rand(2, 4);
        for (let i = 0; i < numEntries; i++) {
            const daysAgo = rand(10, 180);
            const amount = rand(2, 8) * 1000; // 2000-8000
            await prisma.employeeLedger.create({
                data: {
                    employeeId: emp.id,
                    debit: 0,
                    credit: amount,
                    note: pick(['Advance for Eid', 'Personal advance', 'Emergency advance', 'Monthly advance']),
                    createdAt: dayjs().subtract(daysAgo, 'day').toDate(),
                },
            });
            // Update balance
            await prisma.employee.update({
                where: { id: emp.id },
                data: { balance: { decrement: amount } },
            });
        }
    }
    console.log('  ✓ Employee ledger');

    // ── 8. Salary Slips (past 4 months) ─────────────────────────────────────
    for (const emp of employees) {
        for (let m = 4; m >= 1; m--) {
            const slipDate = dayjs().subtract(m, 'month');
            const year = slipDate.year();
            const month = slipDate.month() + 1;
            const bonus = m === 1 ? rand(0, 3) * 1000 : 0;
            const otherDeductions = rand(0, 2) * 500;
            const netPayable = emp.baseSalary + bonus - otherDeductions;

            await prisma.salarySlip.create({
                data: {
                    employeeId: emp.id,
                    year,
                    month,
                    baseSalary: emp.baseSalary,
                    bonus,
                    totalAdvances: 0,
                    otherDeductions,
                    netPayable,
                    status: m === 1 ? 'APPROVED' : 'PAID',
                    paidDate: m > 1 ? slipDate.endOf('month').toDate() : null,
                    note: m > 1 ? 'Salary paid' : null,
                },
            });
        }
    }
    console.log('  ✓ Salary slips');

    // ── 9. Contracts & Contract Lines ────────────────────────────────────────
    const contractRecords: {
        id: number;
        farmerId: number;
        lines: { id: number; quantity: number; itemId: number | null }[];
    }[] = [];

    // Create 15 contracts spread over last 6 months
    for (let c = 0; c < 15; c++) {
        const farmer = farmers[c % farmers.length];
        const monthsAgo = rand(0, 5);
        const startDate = dayjs().subtract(monthsAgo, 'month').subtract(rand(0, 15), 'day');
        const expectedEnd = startDate.add(rand(3, 8), 'month');
        const isActive = monthsAgo <= 2; // older ones completed
        const taxRate = pick([0, 5, 16]);

        // 1-3 line items per contract
        const numLines = rand(1, 3);
        const lineItems: { itemId: number; packagingType: 'BORI' | 'TORA' | 'CRATE'; quantity: number; unitRate: number }[] = [];
        for (let l = 0; l < numLines; l++) {
            const item = pick(items);
            lineItems.push({
                itemId: item.id,
                packagingType: pick(['BORI', 'TORA', 'CRATE']),
                quantity: rand(20, 200),
                unitRate: rand(50, 300),
            });
        }

        const netAmount = lineItems.reduce((sum, li) => sum + li.quantity * li.unitRate, 0);
        const salesTaxAmount = netAmount * (taxRate / 100);
        const totalAmount = netAmount + salesTaxAmount;

        const contractCount = await prisma.contract.count({ where: { farmerId: farmer.id } });
        const codePad = String(contractCount + 1).padStart(4, '0');
        const farmerPad = String(farmer.id).padStart(4, '0');
        const contractCode = `CON-${farmerPad}-${codePad}`;

        const contract = await prisma.contract.create({
            data: {
                farmerId: farmer.id,
                contractCode,
                startDate: startDate.toDate(),
                expectedEndDate: expectedEnd.toDate(),
                actualEndDate: expectedEnd.toDate(),
                saleTaxRate: taxRate / 100,
                totalAmount,
                salesTaxAmount,
                netAmount,
                status: isActive ? 'ACTIVE' : 'COMPLETED',
                notes: pick([null, 'Regular client', 'Special rate agreed', 'Referred by Haji sb']),
                items: {
                    create: lineItems.map((li) => ({
                        itemId: li.itemId,
                        packagingType: li.packagingType,
                        quantity: li.quantity,
                        unitRate: li.unitRate,
                    })),
                },
            },
            include: { items: true },
        });

        // Create ledger entry for contract
        await prisma.ledger.create({
            data: {
                farmerId: farmer.id,
                transactionDate: startDate.toDate(),
                description: `Contract ${contractCode} created`,
                debit: totalAmount,
                credit: 0,
            },
        });

        contractRecords.push({
            id: contract.id,
            farmerId: farmer.id,
            lines: contract.items.map((li) => ({ id: li.id, quantity: li.quantity ?? 0, itemId: li.itemId })),
        });
    }
    console.log('  ✓ Contracts & lines');

    // ── 10. Stock Movements (IN & OUT) ──────────────────────────────────────
    for (const contract of contractRecords) {
        for (const line of contract.lines) {
            if (line.quantity <= 0) continue;

            // Stock IN — full quantity
            const inRackId = pick(allRackIds);
            const inDate = dayjs().subtract(rand(10, 150), 'day');
            await prisma.stockMovement.create({
                data: {
                    contractLineId: line.id,
                    movementType: 'IN',
                    rackId: inRackId,
                    quantity: line.quantity,
                    movementDate: inDate.toDate(),
                    referenceNote: 'Initial stock in',
                },
            });
            await prisma.rack.update({
                where: { id: inRackId },
                data: { currentStock: { increment: line.quantity } },
            });

            // Stock OUT — partial (30-70%) for some lines
            if (Math.random() > 0.4) {
                const outQty = rand(Math.floor(line.quantity * 0.2), Math.floor(line.quantity * 0.6));
                const outDate = inDate.add(rand(5, 60), 'day');
                await prisma.stockMovement.create({
                    data: {
                        contractLineId: line.id,
                        movementType: 'OUT',
                        rackId: inRackId,
                        quantity: outQty,
                        movementDate: outDate.toDate(),
                        referenceNote: pick(['Farmer pickup', 'Sold to market', 'Partial release']),
                    },
                });
                await prisma.rack.update({
                    where: { id: inRackId },
                    data: { currentStock: { increment: -outQty } },
                });
            }
        }
    }
    console.log('  ✓ Stock movements');

    // ── 11. Payments ─────────────────────────────────────────────────────────
    // Multiple payments per farmer (2-4)
    for (const farmer of farmers) {
        const numPayments = rand(2, 4);
        for (let p = 0; p < numPayments; p++) {
            const daysAgo = rand(5, 150);
            const amount = rand(5, 50) * 1000; // 5000-50000
            const method = pick([...paymentMethods]);

            await prisma.payment.create({
                data: {
                    farmerId: farmer.id,
                    paymentDate: dayjs().subtract(daysAgo, 'day').toDate(),
                    amount,
                    paymentMethod: method,
                    transactionRef: method === 'CASH' ? null : `TXN-${rand(10000, 99999)}`,
                    remarks: pick([null, 'Partial payment', 'Advance payment', 'Full settlement']),
                },
            });

            // Ledger credit
            await prisma.ledger.create({
                data: {
                    farmerId: farmer.id,
                    transactionDate: dayjs().subtract(daysAgo, 'day').toDate(),
                    description: `Payment received - ${method}`,
                    debit: 0,
                    credit: amount,
                },
            });
        }
    }
    console.log('  ✓ Payments & ledger');

    // ── 12. Expenses (last 6 months) ────────────────────────────────────────
    for (let m = 5; m >= 0; m--) {
        const monthDate = dayjs().subtract(m, 'month');
        // 5-10 expenses per month
        const numExpenses = rand(5, 10);
        for (let e = 0; e < numExpenses; e++) {
            const et = pick(expenseTypes);
            const amount =
                et.name === 'Electricity' ? rand(15, 60) * 1000 :
                    et.name === 'Diesel/Generator' ? rand(10, 40) * 1000 :
                        et.name === 'Repairs' ? rand(2, 15) * 1000 :
                            rand(1, 8) * 1000;

            await prisma.expense.create({
                data: {
                    storeId,
                    amount,
                    expenseTypeId: et.id,
                    paymentMethod: pick([...paymentMethods]),
                    description: `${et.name} - ${monthDate.format('MMM YYYY')}`,
                    expenseDate: monthDate.date(rand(1, 28)).toDate(),
                },
            });
        }
    }
    console.log('  ✓ Expenses');

    console.log('\n✅ Demo seeding complete!');
    console.log(`   Store: ${existingStore.name} (id=${storeId})`);
    console.log(`   Farmers: ${farmers.length}`);
    console.log(`   Employees: ${employees.length}`);
    console.log(`   Contracts: ${contractRecords.length}`);
    console.log(`   Rooms: ${rooms.length} with ${allRackIds.length} racks`);
}

// ── Run ─────────────────────────────────────────────────────────────────────
seedDemo()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log('Demo seeding finished.');
    });
