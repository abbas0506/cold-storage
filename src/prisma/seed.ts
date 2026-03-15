import { prisma } from '../prisma/prisma';
import bcrypt from "bcryptjs";

export async function seedDatabase() {

    const isAlreadySeeded = await prisma.user.findFirst();
    if (isAlreadySeeded) {
        console.log("Database already seeded, skipping...");
        return;
    }

    const hash = await bcrypt.hash("password", 10);

    // ── 1. Super Admin ───────────────────────────────────────────────────────
    await prisma.user.create({
        data: {
            username: "superadmin",
            password: hash,
            name: "Super Admin",
            systemRole: "SUPER_ADMIN",
            isActive: true,
        },
    });

    // ── 2. Subscription plan ─────────────────────────────────────────────────
    const plan = await prisma.subscriptionPlan.create({
        data: {
            name: "Standard",
            description: "Standard cold-storage plan",
            pricePerMonth: 1000,
            maxStores: 2,
            maxUsersPerStore: 10,
            durationDays: 365,
            isActive: true,
        },
    });


    // ── 3. Subscriber user ───────────────────────────────────────────────────
    const subscriber = await prisma.user.create({
        data: {
            username: "admin",
            password: hash,
            name: "Store Owner",
            systemRole: "SUBSCRIBER",
            isActive: true,
        },
    });

    // ── 4. Subscription for the subscriber ───────────────────────────────────
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const subscription = await prisma.subscription.create({
        data: {
            userId: subscriber.id,
            planId: plan.id,
            status: "ACTIVE",
            startDate,
            endDate,
        },
    });

    // ── 5. Cold store linked to subscription ─────────────────────────────────
    const store = await prisma.coldStore.create({
        data: {
            name: "Shareef Wala",
            address: "123 Cold St, Depalpur",
            phone: "555-1234",
            subscriptionId: subscription.id,
            hashCode: await bcrypt.hash("coldstore", 10),
        },
    });

    // ── 6. Seed items & rate plans ────────────────────────────────────────────
    await prisma.item.createMany({
        data: [
            { name: "Esmi Potato", storeId: store.id },
            { name: "Mozika Potato", storeId: store.id },
            { name: "LR Potato", storeId: store.id },
            { name: "LR Goli", storeId: store.id },
            { name: "Mozika Goli", storeId: store.id },
        ],
    });

    await prisma.ratePlan.createMany({
        data: [
            { storeId: store.id, packagingType: "BORI", rateType: "PER_MONTH", rateAmount: 200 },
            { storeId: store.id, packagingType: "TORA", rateType: "PER_MONTH", rateAmount: 100 },
            { storeId: store.id, packagingType: "CRATE", rateType: "PER_MONTH", rateAmount: 100 },
        ],
    });

    await prisma.settings.createMany({
        data: [
            { key: "ledger_show_balance", value: "true" },
        ],
    });

    console.log(`Seeded: superadmin / admin (password: 'password')`);
}

if (require.main === module) {
    seedDatabase()
        .catch((e) => {
            console.error(e);
            process.exitCode = 1;
        })
        .finally(async () => {
            await prisma.$disconnect();
            console.log("Seeding completed");
        });
}