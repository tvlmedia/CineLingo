"use client";

import { type ChangeEvent, useEffect, useState } from "react";
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

const CROP_VIEWPORT_SIZE = 320;

type CropImage = {
  src: string;
  width: number;
  height: number;
};

function getCoverSize(
  imageWidth: number,
  imageHeight: number,
  viewport: number,
  zoom: number
): { width: number; height: number } {
  const coverScale = viewport / Math.min(imageWidth, imageHeight);
  return {
    width: imageWidth * coverScale * zoom,
    height: imageHeight * coverScale * zoom,
  };
}

async function loadImageFromFile(file: File): Promise<CropImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("invalid_image"));
      img.src = objectUrl;
    });

    return {
      src: objectUrl,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function toSquareAvatarDataUrl(
  cropImage: CropImage,
  cropX: number,
  cropY: number,
  zoom: number
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("invalid_image"));
    img.src = cropImage.src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("canvas_context_missing");
  }

  const drawnSize = getCoverSize(cropImage.width, cropImage.height, 1080, zoom);
  const maxOffsetX = Math.max(0, (drawnSize.width - 1080) / 2);
  const maxOffsetY = Math.max(0, (drawnSize.height - 1080) / 2);
  const dx = (1080 - drawnSize.width) / 2 + cropX * maxOffsetX;
  const dy = (1080 - drawnSize.height) / 2 + cropY * maxOffsetY;

  context.drawImage(image, dx, dy, drawnSize.width, drawnSize.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function ProfileForm({ action, profile }: ProfileFormProps) {
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl);
  const [avatarImageData, setAvatarImageData] = useState("");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [cropImage, setCropImage] = useState<CropImage | null>(null);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropZoom, setCropZoom] = useState(1);

  useEffect(() => {
    return () => {
      if (cropImage) {
        URL.revokeObjectURL(cropImage.src);
      }
    };
  }, [cropImage]);

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
      if (cropImage) {
        URL.revokeObjectURL(cropImage.src);
      }
      const loaded = await loadImageFromFile(file);
      setCropImage(loaded);
      setCropX(0);
      setCropY(0);
      setCropZoom(1);
    } finally {
      setIsProcessingImage(false);
      event.target.value = "";
    }
  }

  async function applyCrop() {
    if (!cropImage) {
      return;
    }

    setIsProcessingImage(true);
    try {
      const dataUrl = await toSquareAvatarDataUrl(cropImage, cropX, cropY, cropZoom);
      setAvatarImageData(dataUrl);
      setAvatarPreview(dataUrl);
      setRemoveAvatar(false);
      URL.revokeObjectURL(cropImage.src);
      setCropImage(null);
    } finally {
      setIsProcessingImage(false);
    }
  }

  function cancelCrop() {
    if (cropImage) {
      URL.revokeObjectURL(cropImage.src);
      setCropImage(null);
    }
  }

  function handleRemoveAvatar() {
    if (cropImage) {
      URL.revokeObjectURL(cropImage.src);
      setCropImage(null);
    }
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
              Select a photo and position it inside the square.
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

      {cropImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-[#0b1329] p-5">
            <h2 className="mb-3 text-xl font-semibold">Crop Profile Photo</h2>
            <p className="mb-4 text-sm text-muted">
              Slide your photo inside the square. Output will be 1080x1080.
            </p>

            <div className="mb-4 flex justify-center">
              <div
                className="relative overflow-hidden rounded-2xl border border-border bg-black"
                style={{ width: CROP_VIEWPORT_SIZE, height: CROP_VIEWPORT_SIZE }}
              >
                {(() => {
                  const previewSize = getCoverSize(
                    cropImage.width,
                    cropImage.height,
                    CROP_VIEWPORT_SIZE,
                    cropZoom
                  );
                  const maxOffsetX = Math.max(0, (previewSize.width - CROP_VIEWPORT_SIZE) / 2);
                  const maxOffsetY = Math.max(0, (previewSize.height - CROP_VIEWPORT_SIZE) / 2);
                  const left = (CROP_VIEWPORT_SIZE - previewSize.width) / 2 + cropX * maxOffsetX;
                  const top = (CROP_VIEWPORT_SIZE - previewSize.height) / 2 + cropY * maxOffsetY;

                  return (
                    <img
                      src={cropImage.src}
                      alt="Crop preview"
                      className="absolute max-w-none select-none"
                      style={{
                        width: `${previewSize.width}px`,
                        height: `${previewSize.height}px`,
                        left: `${left}px`,
                        top: `${top}px`,
                      }}
                    />
                  );
                })()}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Horizontal</label>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={Math.round(cropX * 100)}
                  onChange={(event) => setCropX(Number(event.target.value) / 100)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Vertical</label>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={Math.round(cropY * 100)}
                  onChange={(event) => setCropY(Number(event.target.value) / 100)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Zoom</label>
                <input
                  type="range"
                  min={100}
                  max={250}
                  value={Math.round(cropZoom * 100)}
                  onChange={(event) => setCropZoom(Number(event.target.value) / 100)}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelCrop}
                className="rounded-xl border border-border px-3 py-2 text-sm text-muted transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCrop}
                disabled={isProcessingImage}
                className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Use photo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
