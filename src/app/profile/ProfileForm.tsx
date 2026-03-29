"use client";

import { type ChangeEvent, useState } from "react";
import { Input, TextArea } from "@/components/ui";
import { PHONE_COUNTRY_CODES } from "@/lib/phone";

type ProfileFormProps = {
  action: (formData: FormData) => Promise<void>;
  profile: {
    username: string;
    fullName: string;
    phoneCountryCode: string;
    phoneNationalNumber: string;
    bio: string;
    roleFocus: string;
    experienceLevel: string;
    avatarUrl: string;
  };
};

async function toSquareAvatarDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("invalid_image"));
      img.src = objectUrl;
    });

    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = Math.floor((image.naturalWidth - side) / 2);
    const sy = Math.floor((image.naturalHeight - side) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("canvas_context_missing");
    }

    context.drawImage(image, sx, sy, side, side, 0, 0, 1080, 1080);
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ProfileForm({ action, profile }: ProfileFormProps) {
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl);
  const [avatarImageData, setAvatarImageData] = useState("");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      return;
    }

    setIsProcessingImage(true);
    try {
      const dataUrl = await toSquareAvatarDataUrl(file);
      setAvatarImageData(dataUrl);
      setAvatarPreview(dataUrl);
      setRemoveAvatar(false);
    } finally {
      setIsProcessingImage(false);
      event.target.value = "";
    }
  }

  function handleRemoveAvatar() {
    setAvatarPreview("");
    setAvatarImageData("");
    setRemoveAvatar(true);
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="avatarImageData" value={avatarImageData} />
      <input type="hidden" name="removeAvatar" value={removeAvatar ? "1" : "0"} />

      <div>
        <label className="mb-2 block text-sm text-muted">Profile photo</label>
        <div className="mb-3 flex items-center gap-4">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Profile avatar preview"
              className="h-24 w-24 rounded-2xl border border-border object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-border bg-card text-xs text-muted">
              No photo
            </div>
          )}
          <div className="flex-1 space-y-2">
            <Input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={isProcessingImage}
            />
            <p className="text-xs text-muted">
              Auto crop: square, max 1080x1080.
            </p>
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="rounded-xl border border-border px-3 py-2 text-sm text-muted transition hover:bg-white/5"
            >
              Remove photo
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-muted">Username</label>
        <Input name="username" defaultValue={profile.username} required />
      </div>

      <div>
        <label className="mb-2 block text-sm text-muted">Full name</label>
        <Input name="fullName" defaultValue={profile.fullName} />
      </div>

      <div>
        <label className="mb-2 block text-sm text-muted">Phone number</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_1fr]">
          <select name="phoneCountryCode" defaultValue={profile.phoneCountryCode} required>
            {PHONE_COUNTRY_CODES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          <Input
            name="phoneNationalNumber"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            defaultValue={profile.phoneNationalNumber}
            placeholder="6 12345678"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-muted">Bio</label>
        <TextArea name="bio" rows={5} defaultValue={profile.bio} />
      </div>

      <div>
        <label className="mb-2 block text-sm text-muted">Role focus</label>
        <Input
          name="roleFocus"
          defaultValue={profile.roleFocus}
          placeholder="DOP, gaffer, AC, director..."
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-muted">Experience level</label>
        <Input
          name="experienceLevel"
          defaultValue={profile.experienceLevel}
          placeholder="Beginner, intermediate, advanced..."
        />
      </div>

      <button className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold">
        Save profile
      </button>
    </form>
  );
}
