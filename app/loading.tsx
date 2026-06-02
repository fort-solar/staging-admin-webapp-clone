export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#EAF5EE_0%,#F7F9FB_58%)] px-6">
      <div className="w-full max-w-md rounded-[28px] border border-[#D8E1E8] bg-white p-8 text-center shadow-[0_20px_60px_-36px_rgba(17,24,39,0.22)]">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#D9E7DD] border-t-[#059212]" />
        <h4 className="mt-6 text-2xl font-semibold text-[#111827]">Preparing your view...</h4>
      </div>
    </div>
  );
}
