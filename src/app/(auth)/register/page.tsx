import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Create Account — Budgetly",
  description: "Create your Budgetly account and start tracking your finances.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
