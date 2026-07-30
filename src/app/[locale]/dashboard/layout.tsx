import TrialExpiredModal from "@/components/trial-expired-modal";
import TermsReacceptanceModal from "@/components/terms-reacceptance-modal";
import { BlockingModalProvider } from "@/contexts/blocking-modal-context";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <BlockingModalProvider>
      <TermsReacceptanceModal locale={locale} />
      <TrialExpiredModal locale={locale} />
      {children}
    </BlockingModalProvider>
  );
}
