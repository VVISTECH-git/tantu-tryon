import { redirect } from "next/navigation";

/**
 * /new-studio was the new studio's look with nothing wired (the demo). The working studio is /app;
 * the user knows it by this name (9 Oct), so this address now opens the real one.
 */
export default function NewStudioPage() {
  redirect("/app");
}
