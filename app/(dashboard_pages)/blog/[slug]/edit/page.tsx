import { BlogFormScreen } from "@/components/dashboard/content-management";

export default async function EditBlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlogFormScreen slug={slug} />;
}
