"use server";

import { redirect } from "next/navigation";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

function mapSignUpError(message: string | undefined): string {
  const normalized = String(message || "").toLowerCase();

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already been registered")
  ) {
    return "email_taken";
  }

  if (normalized.includes("password") && normalized.includes("least")) {
    return "weak_password";
  }

  if (normalized.includes("profiles_username_key") || normalized.includes("username")) {
    return "username_taken";
  }

  if (normalized.includes("profiles_phone_format")) {
    return "invalid_phone";
  }

  if (
    normalized.includes("database error saving new user") ||
    normalized.includes("duplicate key value violates unique constraint")
  ) {
    return "signup_conflict";
  }

  return "signup_failed";
}

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

  const { error } = await supabase.auth.signUp({
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

  if (error) {
    const errorCode = mapSignUpError(error?.message);
    redirect(`/signup?error=${errorCode}`);
  }

  redirect("/check-email");
}
