-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "inventory_transactions_type_idx" ON "inventory_transactions"("type");

-- CreateIndex
CREATE INDEX "production_batches_status_idx" ON "production_batches"("status");

-- CreateIndex
CREATE INDEX "production_batches_startedAt_idx" ON "production_batches"("startedAt");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_plannedDate_idx" ON "production_orders"("plannedDate");

-- CreateIndex
CREATE INDEX "qc_logs_result_idx" ON "qc_logs"("result");

-- CreateIndex
CREATE INDEX "qc_logs_type_idx" ON "qc_logs"("type");

-- CreateIndex
CREATE INDEX "raw_material_lots_status_idx" ON "raw_material_lots"("status");

-- CreateIndex
CREATE INDEX "raw_material_lots_expiryDate_idx" ON "raw_material_lots"("expiryDate");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");
