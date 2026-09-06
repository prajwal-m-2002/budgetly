import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Budgetly — Personal Finance",
    short_name: "Budgetly",
    description: "Track expenses, manage budgets, and analyze spending effortlessly.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#141720",
    theme_color: "#6366f1",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
