"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const username = String(formData.get("username") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const roleFocus = String(formData.get("roleFocus") || "").trim();
  const experienceLevel = String(formData.get("experienceLevel") || "").trim();

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      full_name: fullName,
      bio,
      role_focus: roleFocus,
      experience_level: experienceLevel,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
