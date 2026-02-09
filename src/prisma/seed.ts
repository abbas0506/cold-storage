import { prisma } from '../prisma/prisma';
import bcrypt from "bcryptjs";

async function main() {

    await prisma.coldStore.deleteMany();
    await prisma.user.deleteMany();
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
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log("Seeding completed");
        process.exit(0);
    });