interface AlertProps {
  type?: "error" | "success";
  message?: string | null;
}

export default function Alert({ type = "error", message }: AlertProps) {
  if (!message) return null;

  const styles =
    type === "error"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-green-50 text-green-700 border-green-200";

  return (
    <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {message}
    </div>
  );
}