import { redirect } from "next/navigation";

// Redirect root to default locale — next-intl middleware handles Accept-Language
export default function RootPage() {
  redirect("/it");
}
