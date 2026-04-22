import { notFound } from "next/navigation";
import { SitePageFormScreen } from "@/components/dashboard/content-management";
import { getSitePageBySlug } from "@/lib/operations-data";

export default async function EditSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getSitePageBySlug(slug);

  if (!page) {
    notFound();
  }

  return <SitePageFormScreen page={page} />;
}
