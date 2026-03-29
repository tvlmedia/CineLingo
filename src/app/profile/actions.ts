"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

function normalizeInstagramUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) {
    return "";
  }

  const fromAt = raw.startsWith("@") ? raw.slice(1).trim() : raw;
  if (/^[A-Za-z0-9._]{1,30}$/.test(fromAt)) {
    return `https://instagram.com/${fromAt}`;
  }

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname !== "instagram.com") {
      return null;
    }

    const firstSegment = parsed.pathname.split("/").filter(Boolean)[0];
    if (!firstSegment || !/^[A-Za-z0-9._]{1,30}$/.test(firstSegment)) {
      return null;
    }

    return `https://instagram.com/${firstSegment}`;
  } catch {
    return null;
  }
}

function isMissingInstagramColumn(errorMessage: string | undefined): boolean {
  return String(errorMessage || "").toLowerCase().includes("instagram_url");
}

export async function updateProfile(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  let { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("username, full_name, instagram_url, bio, role_focus, experience_level")
    .eq("id", user.id)
    .single();

  if (existingProfileError && isMissingInstagramColumn(existingProfileError.message)) {
    const fallback = await supabase
      .from("profiles")
      .select("username, full_name, bio, role_focus, experience_level")
      .eq("id", user.id)
      .single();

    existingProfile = fallback.data
      ? {
          ...fallback.data,
          instagram_url: "",
        }
      : null;
    existingProfileError = fallback.error;
  }

  if (existingProfileError || !existingProfile) {
    redirect("/profile?error=save_failed");
  }

  const submittedUsername = String(formData.get("username") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const phoneCountryCode = String(formData.get("phoneCountryCode") || "").trim();
  const phoneNationalNumber = String(formData.get("phoneNationalNumber") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const roleFocus = String(formData.get("roleFocus") || "").trim();
  const experienceLevel = String(formData.get("experienceLevel") || "").trim();
  const instagramInput = String(formData.get("instagramUrl") || "").trim();
  const avatarImageData = String(formData.get("avatarImageData") || "").trim();
  const removeAvatar = String(formData.get("removeAvatar") || "") === "1";
  const phone = normalizePhone(phoneCountryCode, phoneNationalNumber);
  const instagramUrl = normalizeInstagramUrl(instagramInput);

  const fallbackUsername =
    existingProfile.username ||
    String((user.user_metadata as { username?: string } | null)?.username || "").trim() ||
    (user.email ? user.email.split("@")[0] : "");
  const username = submittedUsername || fallbackUsername;

  if (instagramUrl === null) {
    redirect("/profile?error=invalid_instagram");
  }

  if (!username || !phone) {
    redirect("/profile?error=save_failed");
  }

  let avatarUrl: string | null | undefined;
  let avatarUploadFailed = false;

  if (removeAvatar) {
    avatarUrl = null;
    await supabase.storage.from("avatars").remove([`${user.id}/avatar.jpg`]);
  } else if (avatarImageData) {
    const match = avatarImageData.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      avatarUploadFailed = true;
    }

    if (match) {
      const imageBytes = Buffer.from(match[1], "base64");
      if (imageBytes.length === 0 || imageBytes.length > 6 * 1024 * 1024) {
        avatarUploadFailed = true;
      } else {
        const avatarPath = `${user.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(avatarPath, imageBytes, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          avatarUploadFailed = true;
        } else {
          const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(avatarPath);
          avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
        }
      }
    }

    if (avatarUploadFailed) {
      avatarUrl = undefined;
    }
  }

  const updateData: {
    username: string;
    full_name: string;
    phone: string;
    bio: string;
    role_focus: string;
    experience_level: string;
    instagram_url: string;
    avatar_url?: string | null;
  } = {
    username,
    full_name: fullName || existingProfile.full_name || "",
    phone,
    bio: bio || existingProfile.bio || "",
    role_focus: roleFocus || existingProfile.role_focus || "",
    experience_level: experienceLevel || existingProfile.experience_level || "",
    instagram_url: instagramUrl || existingProfile.instagram_url || "",
  };

  if (avatarUrl !== undefined) {
    updateData.avatar_url = avatarUrl;
  }

  let { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id);

  if (error && isMissingInstagramColumn(error.message)) {
    const { instagram_url: _instagramUrl, ...updateWithoutInstagram } = updateData;
    const retry = await supabase
      .from("profiles")
      .update(updateWithoutInstagram)
      .eq("id", user.id);
    error = retry.error;
  }

  if (error) {
    redirect("/profile?error=save_failed");
  }

  if (avatarUploadFailed) {
    redirect("/profile?saved=1&warn=avatar_upload_failed");
  }

  redirect("/profile?saved=1");
}
