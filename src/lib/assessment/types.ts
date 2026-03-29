export const ASSESSMENT_CATEGORIES = [
  "Technical Fundamentals",
  "Lighting Craft",
  "Visual Language",
  "Set & Production Knowledge",
  "Cinematic Reading",
  "Lens & Camera Intuition",
] as const;

export type AssessmentCategory = (typeof ASSESSMENT_CATEGORIES)[number];

export type AssessmentBand = "Strong" | "Solid" | "Developing" | "Weak";

export type AssessmentOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type AssessmentQuestion = {
  id: string;
  key: string;
  category: AssessmentCategory;
  prompt: string;
  options: AssessmentOption[];
  explanation: string;
};

export type CategoryScore = {
  category: AssessmentCategory;
  correct: number;
  total: number;
  band: AssessmentBand;
};
