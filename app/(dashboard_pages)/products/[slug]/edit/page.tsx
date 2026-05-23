import { use } from "react";
import { ProductFormScreen } from "@/components/dashboard/products-management";

export default function EditProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <ProductFormScreen productId={slug} />;
}
