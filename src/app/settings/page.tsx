import type { Metadata } from "next";
import { SettingsPage } from "@/features/settings/SettingsPage";

export const metadata: Metadata = {
  title: "Settings — freenote",
};

export default function Page() {
  return <SettingsPage />;
}
