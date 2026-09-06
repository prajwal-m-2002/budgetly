import type { Metadata } from "next";
import { HomePageClient } from "@/components/pages/HomePageClient";

export const metadata: Metadata = {
  title: "Home",
  description: "Your personal finance dashboard — track expenses, income, and balance at a glance.",
};

export default function HomePage() {
  return <HomePageClient />;
}
