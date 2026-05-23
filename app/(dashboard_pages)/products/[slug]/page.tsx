import { use } from "react";
import { ProductDetailScreen } from "@/components/dashboard/products-management";

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <ProductDetailScreen productId={slug} />;
}
