import Link from "next/link";
import { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1440px] px-6 md:px-10">{children}</div>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_12px_36px_rgba(0,0,0,0.34)]">
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
      className={`rounded-xl bg-accent px-4 py-2.5 font-semibold text-[#13100a] transition hover:brightness-110 disabled:opacity-50 ${className}`}
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
      className="rounded-xl border border-border bg-[#1a1b1f] px-4 py-2.5 font-semibold text-foreground transition hover:bg-[#212329]"
    >
      {children}
    </Link>
  );
}
