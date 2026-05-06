import { SitePageFormScreen } from "@/components/dashboard/content-management";

export default async function EditSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SitePageFormScreen slug={slug} />;
}
