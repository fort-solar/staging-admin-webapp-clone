import { notFound } from "next/navigation";
import { ProductDetailScreen } from "@/components/dashboard/products-management";
import { getProductBySlug } from "@/lib/management-data";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return <ProductDetailScreen product={product} />;
}
