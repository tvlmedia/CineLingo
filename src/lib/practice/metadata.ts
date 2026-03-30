import type { AssessmentCategory } from "@/lib/assessment/types";

export type QuestionDifficulty = "foundation" | "core" | "advanced";
export type QuestionType = "technical" | "interpretive";

export type QuestionMetadata = {
  subtopic: string;
  difficulty: QuestionDifficulty;
  questionType: QuestionType;
  roleRelevance: string[];
};

function inferSubtopic(category: AssessmentCategory, prompt: string): string {
  const p = prompt.toLowerCase();

  if (category === "Technical Fundamentals") {
    if (p.includes("iso") || p.includes("ei")) return "ISO / EI";
    if (p.includes("t-stop") || p.includes("f-stop") || p.includes("exposure")) return "Exposure Logic";
    if (p.includes("nd")) return "ND Filters";
    if (p.includes("dynamic range") || p.includes("log")) return "Dynamic Range / Log";
    if (p.includes("frame rate") || p.includes("shutter")) return "Frame Rate / Shutter";
    if (p.includes("sensor") || p.includes("field of view")) return "Sensor / Field of View";
    return "Camera Fundamentals";
  }

  if (category === "Lighting Craft") {
    if (p.includes("hard") || p.includes("soft")) return "Hard vs Soft";
    if (p.includes("negative fill")) return "Negative Fill";
    if (p.includes("motivated")) return "Motivated Light";
    if (p.includes("temperature") || p.includes("kelvin") || p.includes("white balance")) return "Color Temperature";
    if (p.includes("spill")) return "Spill Control";
    return "Lighting Decisions";
  }

  if (category === "Visual Language") {
    if (p.includes("focal") || p.includes("lens")) return "Focal Length Feel";
    if (p.includes("height")) return "Camera Height";
    if (p.includes("composition") || p.includes("framing")) return "Framing / Composition";
    if (p.includes("negative space")) return "Negative Space";
    if (p.includes("movement")) return "Movement Meaning";
    return "Visual Grammar";
  }

  if (category === "Set & Production Knowledge") {
    if (p.includes("coverage") || p.includes("master")) return "Coverage Strategy";
    if (p.includes("blocking")) return "Blocking Workflow";
    if (p.includes("line") || p.includes("180")) return "Screen Direction";
    if (p.includes("eyeline")) return "Eyeline Continuity";
    return "Set Workflow";
  }

  if (category === "Cinematic Reading") {
    if (p.includes("wide") || p.includes("close-up")) return "Shot Scale Meaning";
    if (p.includes("symmetrical") || p.includes("composition")) return "Compositional Meaning";
    if (p.includes("handheld") || p.includes("movement")) return "Camera Motion Reading";
    if (p.includes("space") || p.includes("isolation")) return "Spatial Emotion";
    return "Visual Interpretation";
  }

  if (p.includes("anamorphic")) return "Anamorphic Character";
  if (p.includes("flare")) return "Lens Character";
  if (p.includes("sensor")) return "Sensor & Lens Interaction";
  if (p.includes("wide") || p.includes("long lens") || p.includes("focal")) return "Lens Perspective";
  return "Lens Intuition";
}

function inferDifficulty(prompt: string): QuestionDifficulty {
  const p = prompt.toLowerCase();

  if (
    p.includes("most accurate") ||
    p.includes("most direct") ||
    p.includes("most likely")
  ) {
    return "core";
  }

  if (
    p.includes("why might") ||
    p.includes("what is the biggest") ||
    p.includes("what does that most commonly")
  ) {
    return "advanced";
  }

  return "foundation";
}

function inferQuestionType(category: AssessmentCategory): QuestionType {
  if (category === "Cinematic Reading" || category === "Visual Language") {
    return "interpretive";
  }
  return "technical";
}

function inferRoleRelevance(category: AssessmentCategory): string[] {
  if (category === "Set & Production Knowledge") {
    return ["director", "dop", "1st_ac", "gaffer"];
  }

  if (category === "Lighting Craft") {
    return ["dop", "gaffer"];
  }

  if (category === "Lens & Camera Intuition") {
    return ["dop", "operator", "1st_ac"];
  }

  return ["dop", "director", "gaffer", "operator"];
}

export function inferQuestionMetadata(category: AssessmentCategory, prompt: string): QuestionMetadata {
  return {
    subtopic: inferSubtopic(category, prompt),
    difficulty: inferDifficulty(prompt),
    questionType: inferQuestionType(category),
    roleRelevance: inferRoleRelevance(category),
  };
}
