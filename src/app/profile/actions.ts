"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const username = String(formData.get("username") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const phoneCountryCode = String(formData.get("phoneCountryCode") || "").trim();
  const phoneNationalNumber = String(formData.get("phoneNationalNumber") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const roleFocus = String(formData.get("roleFocus") || "").trim();
  const experienceLevel = String(formData.get("experienceLevel") || "").trim();
  const phone = normalizePhone(phoneCountryCode, phoneNationalNumber);

  if (!username || !phone) {
    redirect("/profile?error=save_failed");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      full_name: fullName,
      phone,
      bio,
      role_focus: roleFocus,
      experience_level: experienceLevel,
    })
    .eq("id", user.id);

  if (error) {
    redirect("/profile?error=save_failed");
  }

  redirect("/profile?saved=1");
}
