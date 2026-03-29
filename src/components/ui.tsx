import Link from "next/link";
import { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-5 md:px-8">{children}</div>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_24px_60px_rgba(1,7,18,0.45)] backdrop-blur-sm">
      {children}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return <textarea {...props} />;
}

export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-2xl bg-accent px-4 py-3 font-semibold text-[#04231d] transition hover:brightness-105 disabled:opacity-50 ${className}`}
    />
  );
}

export function GhostLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border px-4 py-3 font-semibold text-foreground transition hover:bg-white/10"
    >
      {children}
    </Link>
  );
}
