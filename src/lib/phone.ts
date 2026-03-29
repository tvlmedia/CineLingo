export const PHONE_COUNTRY_CODES = [
  { value: "+1", label: "United States / Canada (+1)" },
  { value: "+31", label: "Netherlands (+31)" },
  { value: "+32", label: "Belgium (+32)" },
  { value: "+33", label: "France (+33)" },
  { value: "+34", label: "Spain (+34)" },
  { value: "+39", label: "Italy (+39)" },
  { value: "+44", label: "United Kingdom (+44)" },
  { value: "+45", label: "Denmark (+45)" },
  { value: "+46", label: "Sweden (+46)" },
  { value: "+47", label: "Norway (+47)" },
  { value: "+49", label: "Germany (+49)" },
  { value: "+52", label: "Mexico (+52)" },
  { value: "+55", label: "Brazil (+55)" },
  { value: "+61", label: "Australia (+61)" },
  { value: "+64", label: "New Zealand (+64)" },
  { value: "+81", label: "Japan (+81)" },
  { value: "+82", label: "South Korea (+82)" },
  { value: "+86", label: "China (+86)" },
  { value: "+90", label: "Turkey (+90)" },
  { value: "+91", label: "India (+91)" },
  { value: "+971", label: "United Arab Emirates (+971)" },
] as const;

const COUNTRY_CODE_SET: ReadonlySet<string> = new Set(
  PHONE_COUNTRY_CODES.map((entry) => entry.value)
);

export function normalizePhone(countryCodeInput: string, phoneInput: string): string | null {
  const countryCode = countryCodeInput.trim();
  if (!COUNTRY_CODE_SET.has(countryCode)) {
    return null;
  }

  const nationalDigits = phoneInput.replace(/\D/g, "");
  if (nationalDigits.length < 4 || nationalDigits.length > 14) {
    return null;
  }

  const fullNumber = `${countryCode}${nationalDigits}`;
  if (!/^\+\d{5,15}$/.test(fullNumber)) {
    return null;
  }

  return fullNumber;
}

export function splitPhone(phone: string | null | undefined): {
  countryCode: string;
  nationalNumber: string;
} {
  const normalized = String(phone || "").trim();
  for (const entry of PHONE_COUNTRY_CODES) {
    if (normalized.startsWith(entry.value)) {
      return {
        countryCode: entry.value,
        nationalNumber: normalized.slice(entry.value.length),
      };
    }
  }

  return { countryCode: "+31", nationalNumber: "" };
}
