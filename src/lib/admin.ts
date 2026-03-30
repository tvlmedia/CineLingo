import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

const DEFAULT_ADMIN_EMAIL = "info@tvlmedia.nl";

export async function requireAdminUser() {
  const user = await requireUser();
  const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase();
  const email = String(user.email || "").toLowerCase();

  if (!email || email !== adminEmail) {
    redirect("/dashboard");
  }

  return user;
}

