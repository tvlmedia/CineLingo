"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const username = String(formData.get("username") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();

  if (!email || !password || !username) {
    return { error: "Email, password en username zijn verplicht." };
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

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      username,
      full_name: fullName,
      bio: "",
      role_focus: "",
      experience_level: "",
    });

    if (profileError) {
      return { error: profileError.message };
    }
  }

  redirect("/dashboard");
}
