import DeleteConfirmClient from "@/components/account/delete-confirm-client";

export default async function AccountDeleteConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <DeleteConfirmClient token={token ?? null} />
    </main>
  );
}
