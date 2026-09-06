import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In — Budgetly",
  description: "Sign in to Budgetly to manage your personal finances.",
};

export default function LoginPage() {
  return <LoginForm />;
}
