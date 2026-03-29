"use server";

import { redirect } from "next/navigation";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

type SignupDraft = {
  email: string;
  username: string;
  fullName: string;
  phoneCountryCode: string;
  phoneNationalNumber: string;
};

function redirectWithSignupError(errorCode: string, draft: SignupDraft): never {
  const query = new URLSearchParams({
    error: errorCode,
    username: draft.username,
    fullName: draft.fullName,
    email: draft.email,
    phoneCountryCode: draft.phoneCountryCode,
    phoneNationalNumber: draft.phoneNationalNumber,
  });
  redirect(`/signup?${query.toString()}`);
}

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
  const draft: SignupDraft = {
    email,
    username,
    fullName,
    phoneCountryCode,
    phoneNationalNumber,
  };

  if (!email || !password || !username || !phoneCountryCode || !phoneNationalNumber) {
    redirectWithSignupError("missing_fields", draft);
  }

  const phone = normalizePhone(phoneCountryCode, phoneNationalNumber);
  if (!phone) {
    redirectWithSignupError("invalid_phone", draft);
  }

  const supabase = await createClient();

  const [{ data: existingUsername }, { data: existingPhone }, { data: existingEmail }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .ilike("username", username)
        .limit(1),
      supabase
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .limit(1),
      supabase
        .from("profiles")
        .select("id")
        .ilike("email", email.toLowerCase())
        .limit(1),
    ]);

  if ((existingUsername || []).length > 0) {
    redirectWithSignupError("username_taken", draft);
  }

  if ((existingPhone || []).length > 0) {
    redirectWithSignupError("phone_taken", draft);
  }

  if ((existingEmail || []).length > 0) {
    redirectWithSignupError("email_taken", draft);
  }

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
    if (errorCode === "signup_failed") {
      console.error("Signup failed with unknown error", {
        message: error.message,
        status: (error as { status?: number }).status,
      });
    }
    redirectWithSignupError(errorCode, draft);
  }

  redirect("/check-email");
}
