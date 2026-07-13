import TrialExpiredModal from "@/components/trial-expired-modal";
import { BlockingModalProvider } from "@/contexts/blocking-modal-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BlockingModalProvider>
      <TrialExpiredModal />
      {children}
    </BlockingModalProvider>
  );
}
