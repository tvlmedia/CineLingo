"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("full_name, bio, role_focus, experience_level")
    .eq("id", user.id)
    .single();

  if (existingProfileError || !existingProfile) {
    redirect("/profile?error=save_failed");
  }

  const username = String(formData.get("username") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const phoneCountryCode = String(formData.get("phoneCountryCode") || "").trim();
  const phoneNationalNumber = String(formData.get("phoneNationalNumber") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const roleFocus = String(formData.get("roleFocus") || "").trim();
  const experienceLevel = String(formData.get("experienceLevel") || "").trim();
  const avatarImageData = String(formData.get("avatarImageData") || "").trim();
  const removeAvatar = String(formData.get("removeAvatar") || "") === "1";
  const phone = normalizePhone(phoneCountryCode, phoneNationalNumber);

  if (!username || !phone) {
    redirect("/profile?error=save_failed");
  }

  let avatarUrl: string | null | undefined;

  if (removeAvatar) {
    avatarUrl = null;
    await supabase.storage.from("avatars").remove([`${user.id}/avatar.jpg`]);
  } else if (avatarImageData) {
    const match = avatarImageData.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      redirect("/profile?error=save_failed");
    }

    const imageBytes = Buffer.from(match[1], "base64");
    if (imageBytes.length === 0 || imageBytes.length > 6 * 1024 * 1024) {
      redirect("/profile?error=save_failed");
    }

    const avatarPath = `${user.id}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(avatarPath, imageBytes, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      redirect("/profile?error=save_failed");
    }

    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(avatarPath);
    avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
  }

  const updateData: {
    username: string;
    full_name: string;
    phone: string;
    bio: string;
    role_focus: string;
    experience_level: string;
    avatar_url?: string | null;
  } = {
    username,
    full_name: fullName || existingProfile.full_name || "",
    phone,
    bio: bio || existingProfile.bio || "",
    role_focus: roleFocus || existingProfile.role_focus || "",
    experience_level: experienceLevel || existingProfile.experience_level || "",
  };

  if (avatarUrl !== undefined) {
    updateData.avatar_url = avatarUrl;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id);

  if (error) {
    redirect("/profile?error=save_failed");
  }

  redirect("/profile?saved=1");
}
