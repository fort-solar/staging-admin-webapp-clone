import { Suspense } from "react";
import { ProductsManagementScreen } from "@/components/dashboard/products-management";

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsManagementScreen />
    </Suspense>
  );
}
