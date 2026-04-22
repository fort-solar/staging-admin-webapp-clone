import { notFound } from "next/navigation";
import { BlogFormScreen } from "@/components/dashboard/content-management";
import { getBlogPostBySlug } from "@/lib/operations-data";

export default async function EditBlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return <BlogFormScreen post={post} />;
}
