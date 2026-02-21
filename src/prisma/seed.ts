import { prisma } from '../prisma/prisma';
import bcrypt from "bcryptjs";

export async function seedDatabase() {

    const isAlreadySeeded = await prisma.user.findFirst();
    if (isAlreadySeeded) {
        console.log("Database already seeded, skipping...");
        return;
    }
    // Create a user
    const hash = await bcrypt.hash("password", 10);
    const user = await prisma.user.create({
        data: {
            username: "admin",
            password: hash
        },
    });

    await prisma.coldStore.create({
        data: {
            name: "Shareef Wala [001]",
            address: "123 Cold St, Depalpur",
            phone: "555-1234",
            userId: user.id,
            hashCode: await bcrypt.hash("coldstore", 10),
        },
    });

    await prisma.item.createMany({
        data: [
            { name: "Esmi Potato", storeId: 1 },
            { name: "Mozika Potato", storeId: 1 },
            { name: "LR Potato", storeId: 1 },
        ],
    });

    await prisma.ratePlan.createMany({
        data: [
            { storeId: 1, packagingType: "BORI", rateType: "PER_MONTH", rateAmount: 100 },
            { storeId: 1, packagingType: "TORA", rateType: "PER_MONTH", rateAmount: 100 },
        ],
    });

    await prisma.farmer.createMany({
        data: [
            { name: "Ali Raza", phone: "555-5678", storeId: 1 },
            { name: "Zeshan Khan", phone: "555-8765", storeId: 1 },
        ],
    });


    await prisma.settings.createMany({
        data: [
            {
                key: "ledger_show_balance",
                value: "true",
            },
        ],
    });
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