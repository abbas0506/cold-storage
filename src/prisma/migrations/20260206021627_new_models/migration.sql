/*
  Warnings:

  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('PER_KG_DAY', 'PER_KG_MONTH', 'PER_CRATE_DAY', 'PER_CRATE_MONTH', 'FIXED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackagingType" AS ENUM ('BAG', 'CRATE', 'BOX', 'LOOSE');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'EASYPaisa', 'JAZZCASH', 'CHEQUE');

-- DropTable
DROP TABLE "Product";

-- CreateTable
CREATE TABLE "Farmer" (
    "farmerId" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cnic" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Farmer_pkey" PRIMARY KEY ("farmerId")
);

-- CreateTable
CREATE TABLE "ColdStore" (
    "storeId" SERIAL NOT NULL,
    "storeName" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColdStore_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "StorageUnit" (
    "unitId" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "unitName" TEXT NOT NULL,
    "temperatureMin" DOUBLE PRECISION,
    "temperatureMax" DOUBLE PRECISION,
    "capacityKg" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StorageUnit_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "categoryId" SERIAL NOT NULL,
    "categoryName" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("categoryId")
);

-- CreateTable
CREATE TABLE "RatePlan" (
    "rateId" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "rateType" "RateType" NOT NULL,
    "rateAmount" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("rateId")
);

-- CreateTable
CREATE TABLE "StorageContract" (
    "contractId" SERIAL NOT NULL,
    "farmerId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "unitId" INTEGER,
    "categoryId" INTEGER,
    "rateId" INTEGER,
    "contractCode" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expectedEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageContract_pkey" PRIMARY KEY ("contractId")
);

-- CreateTable
CREATE TABLE "ContractItem" (
    "contractItemId" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "packagingType" "PackagingType",
    "quantityPackages" INTEGER NOT NULL DEFAULT 0,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "qualityGrade" TEXT,
    "remarks" TEXT,

    CONSTRAINT "ContractItem_pkey" PRIMARY KEY ("contractItemId")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "movementId" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "contractItemId" INTEGER,
    "movementType" "MovementType" NOT NULL,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "packages" INTEGER NOT NULL DEFAULT 0,
    "referenceNote" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("movementId")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "invoiceId" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("invoiceId")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "invoiceLineId" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("invoiceLineId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "paymentId" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "farmerId" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "transactionRef" TEXT,
    "remarks" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("paymentId")
);

-- CreateTable
CREATE TABLE "Employee" (
    "employeeId" SERIAL NOT NULL,
    "storeId" INTEGER,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "salary" DOUBLE PRECISION,
    "hiredDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "ContractLog" (
    "logId" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actionTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "ContractLog_pkey" PRIMARY KEY ("logId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_phone_key" ON "Farmer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_cnic_key" ON "Farmer"("cnic");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_categoryName_key" ON "ItemCategory"("categoryName");

-- CreateIndex
CREATE UNIQUE INDEX "StorageContract_contractCode_key" ON "StorageContract"("contractCode");

-- CreateIndex
CREATE INDEX "StorageContract_farmerId_idx" ON "StorageContract"("farmerId");

-- CreateIndex
CREATE INDEX "StorageContract_storeId_idx" ON "StorageContract"("storeId");

-- CreateIndex
CREATE INDEX "StorageContract_status_idx" ON "StorageContract"("status");

-- CreateIndex
CREATE INDEX "StockMovement_contractId_idx" ON "StockMovement"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_contractId_idx" ON "Invoice"("contractId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_farmerId_idx" ON "Payment"("farmerId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_phone_key" ON "Employee"("phone");

-- AddForeignKey
ALTER TABLE "StorageUnit" ADD CONSTRAINT "StorageUnit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "ColdStore"("storeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "ColdStore"("storeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("categoryId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageContract" ADD CONSTRAINT "StorageContract_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("farmerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageContract" ADD CONSTRAINT "StorageContract_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "ColdStore"("storeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageContract" ADD CONSTRAINT "StorageContract_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "StorageUnit"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageContract" ADD CONSTRAINT "StorageContract_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("categoryId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageContract" ADD CONSTRAINT "StorageContract_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "RatePlan"("rateId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "StorageContract"("contractId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "StorageContract"("contractId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("contractItemId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "StorageContract"("contractId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("invoiceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("invoiceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("farmerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "ColdStore"("storeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractLog" ADD CONSTRAINT "ContractLog_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "StorageContract"("contractId") ON DELETE CASCADE ON UPDATE CASCADE;
