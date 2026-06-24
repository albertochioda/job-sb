import TrialExpiredModal from "@/components/trial-expired-modal";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TrialExpiredModal />
      {children}
    </>
  );
}
