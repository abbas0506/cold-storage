import app from "./app";
import { seedDatabase } from "./prisma/seed";
import { migrateDatabase } from "./prisma/migrate";
import { prisma } from "./prisma/prisma";

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  const shouldMigrate = process.argv.includes("--migrate");
  const shouldSeed = process.argv.includes("--seed");

  if (shouldMigrate || shouldSeed) {
    try {
      if (shouldMigrate) {
        await migrateDatabase();
      }

      if (shouldSeed) {
        await seedDatabase();
        console.log("Seeding completed");
      }
    } catch (error) {
      console.error("Database setup failed:", error);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

void bootstrap();
