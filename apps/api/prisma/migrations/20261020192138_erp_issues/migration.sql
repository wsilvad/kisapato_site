-- CreateTable
CREATE TABLE "erp_issues" (
    "id" TEXT NOT NULL,
    "brandCode" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "erp_issues_productId_key" ON "erp_issues"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "erp_issues_brandCode_ref_key" ON "erp_issues"("brandCode", "ref");

-- AddForeignKey
ALTER TABLE "erp_issues" ADD CONSTRAINT "erp_issues_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
