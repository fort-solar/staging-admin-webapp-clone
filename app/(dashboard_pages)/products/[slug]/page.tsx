"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { ProductDetailScreen } from "@/components/dashboard/products-management";
import { EmptyScaffold, Panel } from "@/components/dashboard/ui";
import { getProductBattery, getProductInverter, getProductPanel } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import type { ProductBatteryRecord, ProductInverterRecord, ProductPanelRecord } from "@/types/api.types";

type ProductType = "panels" | "inverters" | "batteries";

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const productType = (searchParams.get("type") as ProductType | null) ?? "panels";
  const [product, setProduct] = useState<ProductPanelRecord | ProductInverterRecord | ProductBatteryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    const request =
      productType === "inverters"
        ? getProductInverter(slug)
        : productType === "batteries"
          ? getProductBattery(slug)
          : getProductPanel(slug);

    request
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setProduct(payload.data);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Product details could not be loaded."));
        setProduct(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productType, slug]);

  if (product) {
    if (productType === "inverters") {
      return <ProductDetailScreen productType="inverters" product={product as ProductInverterRecord} />;
    }

    if (productType === "batteries") {
      return <ProductDetailScreen productType="batteries" product={product as ProductBatteryRecord} />;
    }

    return <ProductDetailScreen productType="panels" product={product as ProductPanelRecord} />;
  }

  return (
    <Panel className="p-6">
      <ErrorMessage title="Product load failed" message={error} />
      {isLoading ? <p className="section-description">Loading product...</p> : <EmptyScaffold title="No product found" description="No record found on the database" />}
    </Panel>
  );
}
