"use client";

import { useRef, type ChangeEvent } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function compressImageFile(file: File, maxDim = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

interface SinglePhotoUploadProps {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  label?: string;
  id?: string;
}

export function SinglePhotoUpload({
  value,
  onChange,
  label = "Upload photo",
  id,
}: SinglePhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      onChange(compressed);
    } catch {
      // ignore invalid file
    }
  };

  return (
    <div className="space-y-2">
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {value ? (
        <div className="relative inline-block overflow-hidden rounded-xl border border-border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="h-24 w-36 object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon-xs"
            aria-label="Remove photo"
            onClick={() => onChange(undefined)}
            className="absolute top-1.5 right-1.5 rounded-lg"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="h-10 w-full justify-start gap-2 rounded-xl border-dashed text-muted-foreground"
        >
          <Camera className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </Button>
      )}
    </div>
  );
}

interface MultiPhotoUploadProps {
  values: string[];
  onChange: (next: string[]) => void;
  maxPhotos?: number;
  label?: string;
}

export function MultiPhotoUpload({
  values,
  onChange,
  maxPhotos = 4,
  label = "Add photo",
}: MultiPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const remaining = Math.max(0, maxPhotos - values.length);
    const chosen = files.slice(0, remaining);
    const next = [...values];
    for (const file of chosen) {
      try {
        next.push(await compressImageFile(file));
      } catch {
        // skip invalid image
      }
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />
      <div className="flex flex-wrap gap-2">
        {values.map((src, idx) => (
          <div
            key={idx}
            className="relative overflow-hidden rounded-xl border border-border bg-muted/30"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Attachment ${idx + 1}`}
              className="h-20 w-24 object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon-xs"
              aria-label={`Remove photo ${idx + 1}`}
              onClick={() => onChange(values.filter((_, i) => i !== idx))}
              className="absolute top-1 right-1 rounded-md"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {values.length < maxPhotos ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            className="h-20 w-28 flex-col gap-1 rounded-xl border-dashed text-xs text-muted-foreground"
          >
            <Camera className="h-4 w-4" />
            <span>{label}</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
