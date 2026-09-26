-- AlterTable
ALTER TABLE "Operation" ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "unitCost" DECIMAL(12,2);

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
