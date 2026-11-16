import { UiShowcase } from "@/components/ui/UiShowcase";
import { notFound } from "next/navigation";

export default function UiPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <UiShowcase />;
}
