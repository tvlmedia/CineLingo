"use server";

import { redirect } from "next/navigation";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const username = String(formData.get("username") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const phoneCountryCode = String(formData.get("phoneCountryCode") || "").trim();
  const phoneNationalNumber = String(formData.get("phoneNationalNumber") || "").trim();

  if (!email || !password || !username || !phoneCountryCode || !phoneNationalNumber) {
    redirect("/signup?error=missing_fields");
  }

  const phone = normalizePhone(phoneCountryCode, phoneNationalNumber);
  if (!phone) {
    redirect("/signup?error=missing_fields");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        full_name: fullName,
        phone,
      },
    },
  });

  if (error || !data.user) {
    redirect("/signup?error=signup_failed");
  }

  redirect("/check-email");
}
