"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const username = String(formData.get("username") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();

  if (!email || !password || !username) {
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
      },
    },
  });

  if (error || !data.user) {
    redirect("/signup?error=signup_failed");
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    username,
    full_name: fullName,
    bio: "",
    role_focus: "",
    experience_level: "",
  });

  if (profileError) {
    redirect("/signup?error=profile_failed");
  }

  redirect("/dashboard");
}
