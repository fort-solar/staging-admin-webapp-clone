import { cx } from "@/components/dashboard/ui";

export function ErrorMessage({
  title = "Something went wrong",
  message,
  className,
}: {
  title?: string;
  message?: string | null;
  className?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className={cx("error-message", className)} role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
