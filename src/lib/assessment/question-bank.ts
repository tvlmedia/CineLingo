import type { AssessmentCategory } from "@/lib/assessment/types";

export type AssessmentSeedQuestion = {
  key: string;
  category: AssessmentCategory;
  prompt: string;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  explanation: string;
};

// Source: /Users/tvlmedia/Downloads/cinelingo_question_bank.md
// Non-programmer friendly update path: edit markdown source, then sync this file.
export const ASSESSMENT_QUESTION_BANK: AssessmentSeedQuestion[] = [
  {
    key: "technical-fundamentals-001",
    category: "Technical Fundamentals",
    prompt: "Which statement is most accurate about ISO in digital cinematography?",
    options: [
      {
        id: "a",
        text: "Raising ISO always makes the sensor physically capture more light",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Raising ISO usually changes how the recorded or monitored signal is amplified or interpreted, not how much light enters the lens",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Raising ISO reduces rolling shutter",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Raising ISO makes depth of field shallower",
        isCorrect: false,
      },
    ],
    explanation: "ISO does not physically increase the amount of light entering the camera. It usually affects signal amplification, image interpretation, or exposure placement depending on the camera system.",
  },
  {
    key: "technical-fundamentals-002",
    category: "Technical Fundamentals",
    prompt: "Which statement is most accurate about T-stop and f-stop?",
    options: [
      {
        id: "a",
        text: "f-stop measures actual light transmission, while T-stop is only a mathematical ratio",
        isCorrect: false,
      },
      {
        id: "b",
        text: "T-stop and f-stop always produce identical exposure across different lenses",
        isCorrect: false,
      },
      {
        id: "c",
        text: "T-stop reflects actual transmitted light, while f-stop is based on a geometric aperture ratio",
        isCorrect: true,
      },
      {
        id: "d",
        text: "T-stop only matters on anamorphic lenses",
        isCorrect: false,
      },
    ],
    explanation: "f-stop is a mathematical ratio based on focal length and entrance pupil. T-stop accounts for real transmission losses, which makes it more reliable for exposure consistency across lenses.",
  },
  {
    key: "technical-fundamentals-003",
    category: "Technical Fundamentals",
    prompt: "A camera is set to 24 fps at a 180° shutter angle. If you switch to 48 fps and keep the shutter angle at 180°, what happens?",
    options: [
      {
        id: "a",
        text: "Exposure decreases by one stop and motion blur per frame decreases",
        isCorrect: true,
      },
      {
        id: "b",
        text: "Exposure stays the same and motion blur stays the same",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Exposure increases by one stop and motion blur decreases",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Exposure decreases by two stops and motion blur stays the same",
        isCorrect: false,
      },
    ],
    explanation: "Doubling the frame rate halves the exposure time per frame at the same shutter angle, so the image gets one stop darker and motion blur per frame becomes tighter.",
  },
  {
    key: "technical-fundamentals-004",
    category: "Technical Fundamentals",
    prompt: "A face looks correctly exposed on the monitor, but false color shows skin tones sitting noticeably below the target exposure range. What is the most likely explanation?",
    options: [
      {
        id: "a",
        text: "The lens is not truly parfocal",
        isCorrect: false,
      },
      {
        id: "b",
        text: "The monitor brightness or image preview is misleading",
        isCorrect: true,
      },
      {
        id: "c",
        text: "The camera’s shutter angle is too wide",
        isCorrect: false,
      },
      {
        id: "d",
        text: "The focal length is compressing the image too much",
        isCorrect: false,
      },
    ],
    explanation: "A monitor can look subjectively “fine” even when the signal is technically underexposed. Tools like false color are generally more reliable than judging exposure by monitor brightness alone.",
  },
  {
    key: "technical-fundamentals-005",
    category: "Technical Fundamentals",
    prompt: "A lens is set to T2.8. You add a 0.6 ND filter and want to keep the same exposure. What should the lens be set to?",
    options: [
      {
        id: "a",
        text: "T2",
        isCorrect: false,
      },
      {
        id: "b",
        text: "T1.4",
        isCorrect: true,
      },
      {
        id: "c",
        text: "T4",
        isCorrect: false,
      },
      {
        id: "d",
        text: "T5.6",
        isCorrect: false,
      },
    ],
    explanation: "ND 0.6 cuts 2 stops of light. To maintain the same exposure, you need to open the lens by 2 stops: from T2.8 to T1.4.",
  },
  {
    key: "technical-fundamentals-006",
    category: "Technical Fundamentals",
    prompt: "Which statement is most accurate about EI/ISO on many digital cinema cameras shooting log?",
    options: [
      {
        id: "a",
        text: "Changing EI/ISO always physically changes the amount of light reaching the sensor",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Changing EI/ISO often changes exposure strategy and monitoring behavior more than the sensor’s actual light capture",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Changing EI/ISO automatically changes frame rate",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Changing EI/ISO only affects white balance metadata",
        isCorrect: false,
      },
    ],
    explanation: "On many digital cinema cameras, EI/ISO is closely tied to how exposure is monitored and placed, especially in log workflows. It does not necessarily mean the sensor is physically receiving more or less light.",
  },
  {
    key: "technical-fundamentals-007",
    category: "Technical Fundamentals",
    prompt: "A scene is lit primarily with 3200K tungsten light, while the camera white balance is set to 5600K. How will the recorded image most likely appear?",
    options: [
      {
        id: "a",
        text: "Cool / blue",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Warm / orange",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Neutral",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Slightly green",
        isCorrect: false,
      },
    ],
    explanation: "The camera is balanced for a cooler light source than is actually present. Since the real light is warmer (3200K), the recorded image will appear warm/orange.",
  },
  {
    key: "technical-fundamentals-008",
    category: "Technical Fundamentals",
    prompt: "Which statement is most accurate about ND filters in cinematography?",
    options: [
      {
        id: "a",
        text: "ND filters primarily reduce contrast while keeping exposure unchanged",
        isCorrect: false,
      },
      {
        id: "b",
        text: "ND filters increase highlight retention by lowering sensor sensitivity",
        isCorrect: false,
      },
      {
        id: "c",
        text: "ND filters are mainly used to reduce motion blur without changing exposure",
        isCorrect: false,
      },
      {
        id: "d",
        text: "ND filters reduce the amount of light entering the lens, allowing exposure control without directly changing aperture, ISO or shutter settings",
        isCorrect: true,
      },
    ],
    explanation: "ND filters reduce the amount of light entering the lens. This allows the cinematographer to control exposure while keeping other creative choices, such as aperture or shutter angle, where they want them.",
  },
  {
    key: "technical-fundamentals-009",
    category: "Technical Fundamentals",
    prompt: "Which statement is most accurate about log recording?",
    options: [
      {
        id: "a",
        text: "Log recording always produces a final image that needs no grading",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Log recording reduces lens distortion by compressing tonal values",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Log recording is mainly designed to preserve more usable tonal information for grading",
        isCorrect: true,
      },
      {
        id: "d",
        text: "Log recording increases frame rate flexibility in post",
        isCorrect: false,
      },
    ],
    explanation: "Log recording is designed to retain more usable tonal information, especially in highlights and shadows, so the image has more flexibility in color grading later.",
  },
  {
    key: "technical-fundamentals-010",
    category: "Technical Fundamentals",
    prompt: "Which statement is most accurate about dynamic range?",
    options: [
      {
        id: "a",
        text: "Dynamic range describes the range between the darkest and brightest values a camera can capture while still retaining usable detail",
        isCorrect: true,
      },
      {
        id: "b",
        text: "Dynamic range describes how far shadows can be lifted before the lens starts losing sharpness",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Dynamic range describes the maximum contrast a monitor can display from a camera feed",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Dynamic range describes how much overexposure a camera can tolerate, without considering shadow detail",
        isCorrect: false,
      },
    ],
    explanation: "Dynamic range refers to the range between the darkest and brightest parts of an image that a camera can capture while still retaining usable detail. It is not limited to only highlights, shadows, lens behavior or monitor display.",
  },
  {
    key: "technical-fundamentals-011",
    category: "Technical Fundamentals",
    prompt: "Two shots have the same framing on the same sensor. One is shot on 35mm close to the subject, the other on 85mm farther away. What mainly changes?",
    options: [
      {
        id: "a",
        text: "Perspective",
        isCorrect: true,
      },
      {
        id: "b",
        text: "White balance",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Frame rate",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Sensor size",
        isCorrect: false,
      },
    ],
    explanation: "With matched framing, changing focal length also changes camera distance. That changes perspective.",
  },
  {
    key: "technical-fundamentals-012",
    category: "Technical Fundamentals",
    prompt: "If you keep the same lens, same camera position, and same T-stop, but switch from Full Frame to Super 35, what changes most directly in the image?",
    options: [
      {
        id: "a",
        text: "The image becomes wider and depth of field gets shallower",
        isCorrect: false,
      },
      {
        id: "b",
        text: "The field of view becomes tighter",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Motion blur increases",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Perspective changes",
        isCorrect: false,
      },
    ],
    explanation: "With the same lens and camera position, a smaller sensor crops the image, so the field of view becomes tighter. Perspective stays the same because the camera position does not change.",
  },
  {
    key: "technical-fundamentals-013",
    category: "Technical Fundamentals",
    prompt: "Two cameras are in the same position with the same focal length, but one uses Full Frame and the other Super 35. To match the framing of the Super 35 shot on the Full Frame camera, what is the most likely adjustment?",
    options: [
      {
        id: "a",
        text: "Use a longer focal length on Full Frame",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Move the Full Frame camera farther away",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Use a shorter focal length on Full Frame",
        isCorrect: true,
      },
      {
        id: "d",
        text: "Close down the aperture on Full Frame",
        isCorrect: false,
      },
    ],
    explanation: "Full Frame shows a wider field of view with the same lens. To match the tighter Super 35 framing from the same position, you would use a shorter focal length on the Full Frame camera.",
  },
  {
    key: "technical-fundamentals-014",
    category: "Technical Fundamentals",
    prompt: "Which change increases exposure without changing motion blur or depth of field?",
    options: [
      {
        id: "a",
        text: "Lowering the shutter angle",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Opening from T4 to T2.8",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Raising ISO",
        isCorrect: true,
      },
      {
        id: "d",
        text: "Switching from 50mm to 35mm",
        isCorrect: false,
      },
    ],
    explanation: "Raising ISO increases image brightness without directly changing motion blur or depth of field. Opening the lens changes depth of field, and changing shutter affects motion blur.",
  },
  {
    key: "technical-fundamentals-015",
    category: "Technical Fundamentals",
    prompt: "Why would a cinematographer use an ND filter instead of simply stopping down the lens to reduce exposure?",
    options: [
      {
        id: "a",
        text: "Because an ND filter reduces exposure while preserving a wider aperture look",
        isCorrect: true,
      },
      {
        id: "b",
        text: "Because an ND filter increases dynamic range",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Because an ND filter reduces rolling shutter",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Because an ND filter changes the sensor size",
        isCorrect: false,
      },
    ],
    explanation: "An ND filter reduces the amount of light entering the lens without forcing you to stop down. That lets you keep choices like a wider aperture, shallower depth of field, or a specific shutter setting.",
  },
  {
    key: "technical-fundamentals-016",
    category: "Technical Fundamentals",
    prompt: "A scene is exposed correctly at 24 fps, 180° shutter, T2.8, ISO 800. You change to 48 fps and want to keep the same exposure and depth of field. Which is the most direct adjustment?",
    options: [
      {
        id: "a",
        text: "Change to 90° shutter",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Change to T4",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Raise ISO to 1600",
        isCorrect: true,
      },
      {
        id: "d",
        text: "Lower white balance",
        isCorrect: false,
      },
    ],
    explanation: "Doubling frame rate from 24 to 48 fps loses one stop of exposure at the same shutter angle. Raising ISO from 800 to 1600 restores that stop while keeping depth of field unchanged.",
  },
  {
    key: "technical-fundamentals-017",
    category: "Technical Fundamentals",
    prompt: "Which statement is most accurate about overexposing log footage on purpose?",
    options: [
      {
        id: "a",
        text: "It always increases dynamic range",
        isCorrect: false,
      },
      {
        id: "b",
        text: "It can improve shadow cleanliness, but only if highlights remain within recoverable range",
        isCorrect: true,
      },
      {
        id: "c",
        text: "It guarantees a more cinematic look in every scene",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It removes the need for color grading",
        isCorrect: false,
      },
    ],
    explanation: "Some cinematographers expose log footage brighter to improve shadow quality, but this only works if important highlights are not pushed beyond what the camera can retain.",
  },
  {
    key: "technical-fundamentals-018",
    category: "Technical Fundamentals",
    prompt: "What is the main visual reason a cinematographer might choose a longer focal length for a close-up instead of moving closer with a wider lens?",
    options: [
      {
        id: "a",
        text: "To change perspective and background relationship while keeping the subject framed similarly",
        isCorrect: true,
      },
      {
        id: "b",
        text: "To get the same perspective, but with less depth of field",
        isCorrect: false,
      },
      {
        id: "c",
        text: "To make the subject appear sharper without affecting spatial relationships",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To increase highlight latitude in the background",
        isCorrect: false,
      },
    ],
    explanation: "A longer focal length from farther away changes perspective and background rendering compared with moving closer on a wider lens, even if the subject is framed similarly.",
  },
  {
    key: "lighting-craft-001",
    category: "Lighting Craft",
    prompt: "What is the main visual effect of adding negative fill on the shadow side of a face?",
    options: [
      {
        id: "a",
        text: "It deepens the shadow side by reducing ambient bounce, increasing perceived contrast and shape",
        isCorrect: true,
      },
      {
        id: "b",
        text: "It makes the key light appear harder by shrinking the apparent size of the source",
        isCorrect: false,
      },
      {
        id: "c",
        text: "It lowers the overall exposure of the face evenly, without significantly changing the light ratio",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It primarily shifts the shadow side toward a cooler color temperature",
        isCorrect: false,
      },
    ],
    explanation: "Negative fill reduces ambient bounce on the shadow side, which deepens shadows and increases perceived contrast and facial shape. It does not directly harden the source, evenly lower exposure, or inherently change color temperature.",
  },
  {
    key: "lighting-craft-002",
    category: "Lighting Craft",
    prompt: "A face is lit by a large soft source, but the image still feels flat. Which adjustment is most likely to improve facial shape while keeping the light soft?",
    options: [
      {
        id: "a",
        text: "Move the source more to the side",
        isCorrect: true,
      },
      {
        id: "b",
        text: "Move the source farther back while keeping it frontal",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Add more fill from camera side",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Bring the source closer while keeping it in the same position",
        isCorrect: false,
      },
    ],
    explanation: "If the light feels flat, the problem is often direction rather than softness. Moving the source more to the side creates more modelling on the face while keeping the light soft.",
  },
  {
    key: "lighting-craft-003",
    category: "Lighting Craft",
    prompt: "What is the most likely result of moving a diffused key light much closer to a face, while keeping its position and exposure matched?",
    options: [
      {
        id: "a",
        text: "The light usually becomes softer and falloff becomes more pronounced",
        isCorrect: true,
      },
      {
        id: "b",
        text: "The light usually becomes harder and more even across the frame",
        isCorrect: false,
      },
      {
        id: "c",
        text: "The light usually becomes softer and the background gets relatively brighter",
        isCorrect: false,
      },
      {
        id: "d",
        text: "The light usually becomes harder but with less contrast",
        isCorrect: false,
      },
    ],
    explanation: "Bringing a diffused source closer increases its apparent size relative to the subject, which makes it softer. It also increases falloff, so brightness drops off faster over distance.",
  },
  {
    key: "lighting-craft-004",
    category: "Lighting Craft",
    prompt: "What is the main visual reason a cinematographer might add backlight to a subject?",
    options: [
      {
        id: "a",
        text: "To reduce depth of field behind the subject",
        isCorrect: false,
      },
      {
        id: "b",
        text: "To create separation between the subject and the background",
        isCorrect: true,
      },
      {
        id: "c",
        text: "To soften facial features from camera side",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To lower overall scene contrast",
        isCorrect: false,
      },
    ],
    explanation: "Backlight is often used to create edge definition and separation, helping the subject stand out more clearly from the background.",
  },
  {
    key: "lighting-craft-005",
    category: "Lighting Craft",
    prompt: "Which choice most strongly helps a key light feel motivated by a window in the scene?",
    options: [
      {
        id: "a",
        text: "Placing the key as flat and frontal as possible",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Keeping the brightest part of the frame away from the window side",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Matching the key only by color, without considering direction",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Placing the key so its direction and logic feel consistent with the window position",
        isCorrect: true,
      },
    ],
    explanation: "Motivation is not just about color or exposure. The light has to feel like it is actually coming from a believable source in the scene, and direction is a big part of that.",
  },
  {
    key: "lighting-craft-006",
    category: "Lighting Craft",
    prompt: "A cinematographer changes a lamp from 5600K to 3200K, while the camera white balance stays the same. What is the most likely result?",
    options: [
      {
        id: "a",
        text: "The lamp will appear cooler / bluer",
        isCorrect: false,
      },
      {
        id: "b",
        text: "The lamp will appear warmer / more orange",
        isCorrect: true,
      },
      {
        id: "c",
        text: "The lamp will appear more contrasty, but not warmer",
        isCorrect: false,
      },
      {
        id: "d",
        text: "The lamp will appear more neutral because 3200K is lower output",
        isCorrect: false,
      },
    ],
    explanation: "If the lamp is changed from 5600K to 3200K and the camera white balance stays the same, the light from that lamp will read warmer / more orange in the image.",
  },
  {
    key: "lighting-craft-007",
    category: "Lighting Craft",
    prompt: "Why might a cinematographer choose an HMI over a tungsten fixture for a daylight scene?",
    options: [
      {
        id: "a",
        text: "Because an HMI usually matches daylight more naturally and delivers stronger output for that use case",
        isCorrect: true,
      },
      {
        id: "b",
        text: "Because an HMI always produces softer light than tungsten",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Because an HMI automatically creates more depth of field",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Because an HMI makes white balance irrelevant",
        isCorrect: false,
      },
    ],
    explanation: "HMIs are often chosen for daylight work because their color temperature is closer to daylight and they typically provide strong output, making them useful for simulating or augmenting daylight.",
  },
  {
    key: "lighting-craft-008",
    category: "Lighting Craft",
    prompt: "What is a major practical advantage of using an LED fixture over many traditional tungsten or HMI fixtures?",
    options: [
      {
        id: "a",
        text: "LED fixtures always produce a more cinematic spectrum than any other source",
        isCorrect: false,
      },
      {
        id: "b",
        text: "LED fixtures usually allow faster adjustment of intensity and color without changing gels or globes",
        isCorrect: true,
      },
      {
        id: "c",
        text: "LED fixtures always have higher output than tungsten and HMI of the same size",
        isCorrect: false,
      },
      {
        id: "d",
        text: "LED fixtures automatically make mixed color temperatures disappear",
        isCorrect: false,
      },
    ],
    explanation: "A major advantage of many LED fixtures is speed and flexibility: intensity, color temperature, and sometimes tint can often be adjusted directly without swapping bulbs, dimmers, or gels.",
  },
  {
    key: "lighting-craft-009",
    category: "Lighting Craft",
    prompt: "What is a common downside of dimming tungsten fixtures without correcting the color?",
    options: [
      {
        id: "a",
        text: "They usually become cooler / bluer",
        isCorrect: false,
      },
      {
        id: "b",
        text: "They usually become warmer / more orange",
        isCorrect: true,
      },
      {
        id: "c",
        text: "They lose all contrast in the shadows",
        isCorrect: false,
      },
      {
        id: "d",
        text: "They become daylight-balanced",
        isCorrect: false,
      },
    ],
    explanation: "As tungsten fixtures are dimmed, they typically shift warmer / more orange. That can be useful or undesirable, depending on the scene.",
  },
  {
    key: "lighting-craft-010",
    category: "Lighting Craft",
    prompt: "What is a major lighting advantage of using a fixture with adjustable green-magenta tint control?",
    options: [
      {
        id: "a",
        text: "It allows you to change focal length without moving the lamp",
        isCorrect: false,
      },
      {
        id: "b",
        text: "It helps match the source more precisely to other fixtures or practicals in the scene",
        isCorrect: true,
      },
      {
        id: "c",
        text: "It increases dynamic range in the highlights",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It automatically improves skin tone contrast",
        isCorrect: false,
      },
    ],
    explanation: "Tint control helps fine-tune green/magenta balance so fixtures match each other more cleanly, which is especially useful in mixed-light environments.",
  },
  {
    key: "lighting-craft-011",
    category: "Lighting Craft",
    prompt: "Which change is most likely to make a light source feel harder on a subject?",
    options: [
      {
        id: "a",
        text: "Increasing diffusion while keeping position the same",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Making the source physically larger and bringing it closer",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Raising the white balance of the lamp",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Making the source smaller relative to the subject",
        isCorrect: true,
      },
    ],
    explanation: "A source feels harder when its apparent size relative to the subject becomes smaller, which creates sharper shadow edges and less wrap.",
  },
  {
    key: "lighting-craft-012",
    category: "Lighting Craft",
    prompt: "Why might a cinematographer still add artificial light to a scene that already has enough daylight exposure?",
    options: [
      {
        id: "a",
        text: "To make the camera sensor physically more sensitive",
        isCorrect: false,
      },
      {
        id: "b",
        text: "To control shape, contrast, direction, or separation in the image",
        isCorrect: true,
      },
      {
        id: "c",
        text: "To reduce the focal length of the lens",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To make daylight less blue without changing the overall look",
        isCorrect: false,
      },
    ],
    explanation: "A cinematographer often uses light not just because more exposure is needed, but to influence the image: shaping faces, controlling contrast, guiding the eye, or creating separation.",
  },
  {
    key: "lighting-craft-013",
    category: "Lighting Craft",
    prompt: "What is a common reason a cinematographer might choose to augment daylight coming through a window with an additional source?",
    options: [
      {
        id: "a",
        text: "To make the daylight physically more natural",
        isCorrect: false,
      },
      {
        id: "b",
        text: "To increase sensor crop factor and reduce distortion",
        isCorrect: false,
      },
      {
        id: "c",
        text: "To gain more control over consistency, direction, or intensity than the natural daylight alone provides",
        isCorrect: true,
      },
      {
        id: "d",
        text: "To make the lens resolve more detail in the highlights",
        isCorrect: false,
      },
    ],
    explanation: "Natural daylight can look great, but it can also be inconsistent or insufficiently controlled. Adding a source can help maintain continuity and shape the image more deliberately.",
  },
  {
    key: "lighting-craft-014",
    category: "Lighting Craft",
    prompt: "Why might a cinematographer choose tube lights instead of a larger traditional fixture for a tight location?",
    options: [
      {
        id: "a",
        text: "Because tube lights always produce harder shadows than larger fixtures",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Because tube lights are easier to hide in frame or rig in small spaces while still adding controlled light",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Because tube lights automatically match any practical in the scene without adjustment",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Because tube lights always have more output than larger fixtures",
        isCorrect: false,
      },
    ],
    explanation: "Tube lights are often chosen in tight spaces because they are small, versatile, easy to rig, and can be hidden in frame or integrated into practical-looking setups more easily than larger fixtures.",
  },
  {
    key: "lighting-craft-015",
    category: "Lighting Craft",
    prompt: "What is the main reason a cinematographer might add a grid to a soft light?",
    options: [
      {
        id: "a",
        text: "To make the source physically larger and softer",
        isCorrect: false,
      },
      {
        id: "b",
        text: "To reduce spill and control the direction of the soft source",
        isCorrect: true,
      },
      {
        id: "c",
        text: "To raise the color temperature of the fixture",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To increase the fixture’s maximum output",
        isCorrect: false,
      },
    ],
    explanation: "A grid helps control spill from a soft source, keeping the light off unwanted areas while maintaining the soft quality of the source itself.",
  },
  {
    key: "lighting-craft-016",
    category: "Lighting Craft",
    prompt: "Why might a cinematographer choose to place a diffusion frame in front of a source instead of using the bare fixture directly?",
    options: [
      {
        id: "a",
        text: "To make the source appear larger and soften shadow transitions",
        isCorrect: true,
      },
      {
        id: "b",
        text: "To increase shutter angle without changing exposure",
        isCorrect: false,
      },
      {
        id: "c",
        text: "To make the source more daylight-balanced",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To reduce the sensor’s highlight clipping point",
        isCorrect: false,
      },
    ],
    explanation: "A diffusion frame increases the apparent size of the source and softens the transition between light and shadow.",
  },
  {
    key: "lighting-craft-017",
    category: "Lighting Craft",
    prompt: "What is the main effect of adding fill light to the shadow side of a face?",
    options: [
      {
        id: "a",
        text: "It makes the key light harder",
        isCorrect: false,
      },
      {
        id: "b",
        text: "It reduces contrast by lifting the shadow side",
        isCorrect: true,
      },
      {
        id: "c",
        text: "It increases backlight separation",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It changes the focal length feel of the shot",
        isCorrect: false,
      },
    ],
    explanation: "Fill light lifts the shadow side and reduces the contrast ratio between the lit and unlit parts of the face.",
  },
  {
    key: "lighting-craft-018",
    category: "Lighting Craft",
    prompt: "Why might a cinematographer choose to bounce a source instead of pointing it directly at the subject?",
    options: [
      {
        id: "a",
        text: "To create a softer and often broader source with a different direction feel",
        isCorrect: true,
      },
      {
        id: "b",
        text: "To increase the frame rate flexibility of the setup",
        isCorrect: false,
      },
      {
        id: "c",
        text: "To make the fixture output more efficient than direct use",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To remove the need for white balance adjustments",
        isCorrect: false,
      },
    ],
    explanation: "Bouncing turns another surface into the effective source, which often makes the light softer, broader, and directionally different than the bare fixture.",
  },
  {
    key: "visual-language-001",
    category: "Visual Language",
    prompt: "What is the main visual effect of moving the camera closer to a subject while switching to a wider lens to keep a similar framing?",
    options: [
      {
        id: "a",
        text: "The background usually feels more compressed",
        isCorrect: false,
      },
      {
        id: "b",
        text: "The perspective usually feels more exaggerated",
        isCorrect: true,
      },
      {
        id: "c",
        text: "The depth of field always becomes deeper in every practical case",
        isCorrect: false,
      },
      {
        id: "d",
        text: "The subject always appears flatter",
        isCorrect: false,
      },
    ],
    explanation: "Moving the camera closer changes perspective. Using a wider lens to maintain similar framing often makes spatial relationships feel more exaggerated, especially in faces and foreground-background separation.",
  },
  {
    key: "visual-language-002",
    category: "Visual Language",
    prompt: "What is the main visual effect of placing the camera lower and aiming slightly upward at a character?",
    options: [
      {
        id: "a",
        text: "The character often feels more dominant or imposing",
        isCorrect: true,
      },
      {
        id: "b",
        text: "The character often feels more observationally neutral",
        isCorrect: false,
      },
      {
        id: "c",
        text: "The character often feels more vulnerable or diminished",
        isCorrect: false,
      },
      {
        id: "d",
        text: "The character often feels more detached from the environment",
        isCorrect: false,
      },
    ],
    explanation: "A lower camera angle often makes a character feel stronger, larger, or more imposing. The exact effect still depends on context, framing, and performance.",
  },
  {
    key: "visual-language-003",
    category: "Visual Language",
    prompt: "Two shots have the same framing of a face on the same sensor. Shot A is made with a wider lens from closer. Shot B is made with a longer lens from farther away. What changes most directly between the two shots?",
    options: [
      {
        id: "a",
        text: "Perspective rendering",
        isCorrect: true,
      },
      {
        id: "b",
        text: "Depth of field",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Subject size in frame",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Camera height relationship",
        isCorrect: false,
      },
    ],
    explanation: "Because the framing is matched, the subject size in frame stays similar. The main visual difference comes from the change in camera distance, which changes perspective rendering. The wider-lens/closer shot exaggerates spatial relationships more than the longer-lens/farther shot.",
  },
  {
    key: "visual-language-004",
    category: "Visual Language",
    prompt: "Two shots are framed identically on the same sensor. One is shot on a wider lens from closer, the other on a longer lens from farther away. What changes most directly?",
    options: [
      {
        id: "a",
        text: "Perspective rendering",
        isCorrect: true,
      },
      {
        id: "b",
        text: "Subject scale",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Camera height",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Screen direction",
        isCorrect: false,
      },
    ],
    explanation: "If framing is matched, subject scale stays similar. The main difference comes from camera distance, which changes perspective rendering.",
  },
  {
    key: "visual-language-005",
    category: "Visual Language",
    prompt: "If the camera position stays the same and you switch from a 35mm to an 85mm lens on the same sensor, what changes most directly?",
    options: [
      {
        id: "a",
        text: "Perspective",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Subject-to-background spatial relationship",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Field of view",
        isCorrect: true,
      },
      {
        id: "d",
        text: "Eyeline geometry",
        isCorrect: false,
      },
    ],
    explanation: "If the camera does not move, perspective stays the same. The most direct change is a tighter field of view.",
  },
  {
    key: "visual-language-006",
    category: "Visual Language",
    prompt: "A close-up feels unusually distorted, with facial features appearing more exaggerated than expected. What is the most likely cause?",
    options: [
      {
        id: "a",
        text: "The camera is too close with a wider lens",
        isCorrect: true,
      },
      {
        id: "b",
        text: "The camera is too far with a longer lens",
        isCorrect: false,
      },
      {
        id: "c",
        text: "The aperture is too wide",
        isCorrect: false,
      },
      {
        id: "d",
        text: "The sensor is too large",
        isCorrect: false,
      },
    ],
    explanation: "That kind of facial exaggeration usually comes from camera distance. A wider lens used very close to the face makes perspective feel more aggressive.",
  },
  {
    key: "visual-language-007",
    category: "Visual Language",
    prompt: "If a cinematographer wants the background to feel more present in relation to the subject, which choice is most likely to push the image that way?",
    options: [
      {
        id: "a",
        text: "Move farther away and use a longer lens",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Move closer and use a wider lens",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Raise ISO",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Lower shutter angle",
        isCorrect: false,
      },
    ],
    explanation: "Moving closer with a wider lens tends to exaggerate spatial relationships, making the background feel more active relative to the subject.",
  },
  {
    key: "visual-language-008",
    category: "Visual Language",
    prompt: "What is the most direct visual result of raising the camera from eye level to a noticeably higher angle on a character?",
    options: [
      {
        id: "a",
        text: "The character often feels less dominant",
        isCorrect: true,
      },
      {
        id: "b",
        text: "The focal length feels longer",
        isCorrect: false,
      },
      {
        id: "c",
        text: "The shot gains more compression",
        isCorrect: false,
      },
      {
        id: "d",
        text: "The image becomes more symmetrical by default",
        isCorrect: false,
      },
    ],
    explanation: "A higher angle often reduces the character’s visual power or dominance, depending on context.",
  },
  {
    key: "visual-language-009",
    category: "Visual Language",
    prompt: "If a character is framed with a large amount of empty space in front of their eyeline, what does that space most commonly do?",
    options: [
      {
        id: "a",
        text: "It usually makes the image feel flatter",
        isCorrect: false,
      },
      {
        id: "b",
        text: "It often suggests direction, attention, or anticipation",
        isCorrect: true,
      },
      {
        id: "c",
        text: "It automatically makes the shot more objective",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It reduces the need for background detail",
        isCorrect: false,
      },
    ],
    explanation: "Lead room or looking room often gives visual direction to a shot and can suggest thought, tension, anticipation, or off-screen presence.",
  },
  {
    key: "visual-language-010",
    category: "Visual Language",
    prompt: "What is the most likely visual result of making a shot more symmetrical?",
    options: [
      {
        id: "a",
        text: "It often feels more formal, controlled, or deliberate",
        isCorrect: true,
      },
      {
        id: "b",
        text: "It always feels more naturalistic",
        isCorrect: false,
      },
      {
        id: "c",
        text: "It always feels more intimate",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It reduces the sense of depth in the image",
        isCorrect: false,
      },
    ],
    explanation: "Symmetry often creates a stronger sense of control, design, intention, or stillness, though its emotional meaning depends on context.",
  },
  {
    key: "visual-language-011",
    category: "Visual Language",
    prompt: "What is the most direct visual consequence of pushing into a subject during a moment of realization?",
    options: [
      {
        id: "a",
        text: "It usually makes the background brighter",
        isCorrect: false,
      },
      {
        id: "b",
        text: "It often increases emotional focus on the subject",
        isCorrect: true,
      },
      {
        id: "c",
        text: "It changes the scene’s white balance",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It makes the perspective more neutral",
        isCorrect: false,
      },
    ],
    explanation: "A push-in often increases emphasis and emotional focus, making the moment feel more subjectively important.",
  },
  {
    key: "visual-language-012",
    category: "Visual Language",
    prompt: "What is the most direct visual consequence of cutting from a wide shot to a tight close-up during an emotional beat?",
    options: [
      {
        id: "a",
        text: "It often increases emotional intensity and viewer focus",
        isCorrect: true,
      },
      {
        id: "b",
        text: "It usually makes the scene feel more geographically clear",
        isCorrect: false,
      },
      {
        id: "c",
        text: "It mainly reduces contrast in the frame",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It usually neutralizes the character’s emotional state",
        isCorrect: false,
      },
    ],
    explanation: "Moving from a wide shot to a close-up often increases emotional intensity by narrowing attention onto the character and reducing environmental distraction.",
  },
  {
    key: "visual-language-013",
    category: "Visual Language",
    prompt: "What is the most direct visual consequence of holding on a shot longer than expected after a character finishes speaking?",
    options: [
      {
        id: "a",
        text: "It often increases tension, discomfort, or unspoken meaning",
        isCorrect: true,
      },
      {
        id: "b",
        text: "It usually makes the shot feel wider",
        isCorrect: false,
      },
      {
        id: "c",
        text: "It mainly changes the scene’s color contrast",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It usually makes the performance feel less subjective",
        isCorrect: false,
      },
    ],
    explanation: "Holding longer than expected can shift attention to silence, reaction, and subtext, often increasing tension or discomfort.",
  },
  {
    key: "visual-language-014",
    category: "Visual Language",
    prompt: "What is the most direct visual consequence of using a Dutch angle?",
    options: [
      {
        id: "a",
        text: "It often introduces a sense of imbalance or instability",
        isCorrect: true,
      },
      {
        id: "b",
        text: "It usually makes the focal length feel longer",
        isCorrect: false,
      },
      {
        id: "c",
        text: "It mainly reduces depth of field",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It usually flattens facial features",
        isCorrect: false,
      },
    ],
    explanation: "A Dutch angle tilts the horizon and frame lines, which often creates a feeling of imbalance, unease, or instability.",
  },
  {
    key: "set-production-knowledge-001",
    category: "Set & Production Knowledge",
    prompt: "Who is primarily responsible for the visual framing and camera placement decisions on set, in collaboration with the director?",
    options: [
      {
        id: "a",
        text: "Gaffer",
        isCorrect: false,
      },
      {
        id: "b",
        text: "1st AC",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Director of Photography",
        isCorrect: true,
      },
      {
        id: "d",
        text: "DIT",
        isCorrect: false,
      },
    ],
    explanation: "The Director of Photography is primarily responsible for the camera’s visual language — including framing, lensing, and camera placement — in collaboration with the director.",
  },
  {
    key: "set-production-knowledge-002",
    category: "Set & Production Knowledge",
    prompt: "The Director of Photography wants a stronger edge light, but the fixture is creating unwanted spill on the background. Who would most commonly take the lead in solving that lighting control problem on set?",
    options: [
      {
        id: "a",
        text: "DIT",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Gaffer",
        isCorrect: true,
      },
      {
        id: "c",
        text: "1st AD",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Script Supervisor",
        isCorrect: false,
      },
    ],
    explanation: "The gaffer is typically responsible for executing and refining the lighting setup, including solving practical spill and control problems in collaboration with the DP.",
  },
  {
    key: "set-production-knowledge-003",
    category: "Set & Production Knowledge",
    prompt: "Who is most directly responsible for maintaining continuity notes about actions, props, eyelines, and coverage across takes?",
    options: [
      {
        id: "a",
        text: "1st AC",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Script Supervisor",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Gaffer",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Key Grip",
        isCorrect: false,
      },
    ],
    explanation: "The script supervisor tracks continuity and coverage details to help maintain consistency across takes and setups.",
  },
  {
    key: "set-production-knowledge-004",
    category: "Set & Production Knowledge",
    prompt: "What is usually the smartest reason to rehearse a camera move with actors before final tweaks to lighting and focus?",
    options: [
      {
        id: "a",
        text: "It helps reveal practical issues in timing, marks, framing, and light interaction before the crew fine-tunes the setup",
        isCorrect: true,
      },
      {
        id: "b",
        text: "It guarantees the shot will need fewer takes once sound starts rolling",
        isCorrect: false,
      },
      {
        id: "c",
        text: "It allows the DIT to set the final LUT before the camera team gets involved",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It prevents the need for blocking notes from script supervision",
        isCorrect: false,
      },
    ],
    explanation: "A rehearsal often reveals real problems in marks, timing, framing, shadows, focus pulls, and practical interactions. That helps the crew refine the setup more intelligently.",
  },
  {
    key: "set-production-knowledge-005",
    category: "Set & Production Knowledge",
    prompt: "A scene is running late, and the full planned coverage will likely not fit in the remaining time. What is usually the smartest first move?",
    options: [
      {
        id: "a",
        text: "Keep shooting exactly as planned and hope later setups go faster",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Pause and decide which shots are truly essential for story and edit coverage",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Switch every shot to handheld without discussing it",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Drop the master shot first, because close-ups are always more important",
        isCorrect: false,
      },
    ],
    explanation: "When time gets tight, the smartest move is to reassess priorities: what coverage is essential for story clarity, performance, and edit flexibility.",
  },
  {
    key: "set-production-knowledge-006",
    category: "Set & Production Knowledge",
    prompt: "Why is it risky to light a scene too precisely before actor blocking is properly confirmed?",
    options: [
      {
        id: "a",
        text: "Because the final color temperature of the camera may drift during rehearsal",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Because any change in actor position can break the intended lighting and force major reworking",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Because the lens choice may become unusable once the gaffer starts dimming fixtures",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Because script continuity cannot be tracked until lighting is finished",
        isCorrect: false,
      },
    ],
    explanation: "If blocking changes, carefully targeted lighting can stop working immediately. Confirming actor movement first usually makes lighting adjustments far more efficient.",
  },
  {
    key: "set-production-knowledge-007",
    category: "Set & Production Knowledge",
    prompt: "What is usually the main reason to shoot a master shot even if the scene will also be covered in singles and inserts?",
    options: [
      {
        id: "a",
        text: "It gives the editor a full spatial and performance reference for the scene",
        isCorrect: true,
      },
      {
        id: "b",
        text: "It automatically makes continuity easier than all other coverage",
        isCorrect: false,
      },
      {
        id: "c",
        text: "It guarantees fewer lighting setups later",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It always becomes the emotional core of the scene",
        isCorrect: false,
      },
    ],
    explanation: "A master shot gives the editor a complete version of the scene in time and space, which can be extremely useful for structure, pacing, and continuity.",
  },
  {
    key: "set-production-knowledge-008",
    category: "Set & Production Knowledge",
    prompt: "What is the biggest risk of crossing the 180-degree line without clear intention?",
    options: [
      {
        id: "a",
        text: "The light direction always becomes flatter",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Screen direction and spatial relationships may become confusing",
        isCorrect: true,
      },
      {
        id: "c",
        text: "The lens will appear wider than intended",
        isCorrect: false,
      },
      {
        id: "d",
        text: "The scene will automatically lose continuity in exposure",
        isCorrect: false,
      },
    ],
    explanation: "Crossing the line can flip screen direction and confuse the viewer’s sense of geography unless it is motivated or clearly reset.",
  },
  {
    key: "set-production-knowledge-009",
    category: "Set & Production Knowledge",
    prompt: "Why is eyeline consistency important when shooting coverage of a conversation?",
    options: [
      {
        id: "a",
        text: "It helps preserve believable spatial relationships between characters",
        isCorrect: true,
      },
      {
        id: "b",
        text: "It makes the color contrast between setups easier to match",
        isCorrect: false,
      },
      {
        id: "c",
        text: "It reduces the need for room tone",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It allows wider lenses to feel more neutral",
        isCorrect: false,
      },
    ],
    explanation: "Consistent eyelines help maintain the illusion that characters are looking at each other correctly across cuts.",
  },
  {
    key: "set-production-knowledge-010",
    category: "Set & Production Knowledge",
    prompt: "What is usually the smartest reason to capture room tone on set?",
    options: [
      {
        id: "a",
        text: "It helps the colorist balance background texture in post",
        isCorrect: false,
      },
      {
        id: "b",
        text: "It gives the editor and sound team clean ambient sound to bridge cuts",
        isCorrect: true,
      },
      {
        id: "c",
        text: "It improves focus consistency between takes",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It reduces the chance of lens breathing in close-ups",
        isCorrect: false,
      },
    ],
    explanation: "Room tone gives post-production a clean ambient bed that helps smooth audio edits and maintain continuity.",
  },
  {
    key: "set-production-knowledge-011",
    category: "Set & Production Knowledge",
    prompt: "What is usually the main reason to shoot an insert?",
    options: [
      {
        id: "a",
        text: "To increase dynamic range in the sequence",
        isCorrect: false,
      },
      {
        id: "b",
        text: "To isolate important visual information or action detail",
        isCorrect: true,
      },
      {
        id: "c",
        text: "To replace all wider coverage in the edit",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To make the scene feel more objective",
        isCorrect: false,
      },
    ],
    explanation: "Inserts are often used to show specific details clearly, guide attention, or give the editor useful cut points.",
  },
  {
    key: "set-production-knowledge-012",
    category: "Set & Production Knowledge",
    prompt: "What is usually the smartest reason to shoot an over-the-shoulder instead of a straight single in a dialogue scene?",
    options: [
      {
        id: "a",
        text: "It can preserve spatial relationship and keep the other character present in the frame",
        isCorrect: true,
      },
      {
        id: "b",
        text: "It always makes the lens feel longer",
        isCorrect: false,
      },
      {
        id: "c",
        text: "It removes the need for eyeline matching",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It guarantees better continuity than a single",
        isCorrect: false,
      },
    ],
    explanation: "An over-the-shoulder can help preserve geography and keep the scene feeling relational, because the other character remains visually present.",
  },
  {
    key: "set-production-knowledge-013",
    category: "Set & Production Knowledge",
    prompt: "What is usually the biggest practical advantage of getting a clean plate on set?",
    options: [
      {
        id: "a",
        text: "It gives the editor a version of the scene with better performance continuity",
        isCorrect: false,
      },
      {
        id: "b",
        text: "It can help VFX or cleanup work by providing a frame without actors or moving elements",
        isCorrect: true,
      },
      {
        id: "c",
        text: "It automatically improves dynamic range in post",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It makes focus pulls easier to match across coverage",
        isCorrect: false,
      },
    ],
    explanation: "A clean plate is often useful for VFX, object removal, or cleanup work because it gives post-production a version of the frame without unwanted elements.",
  },
  {
    key: "cinematic-reading-001",
    category: "Cinematic Reading",
    prompt: "A scene is shot mostly in static wide frames with characters kept small inside the environment. What does that most commonly emphasize?",
    options: [
      {
        id: "a",
        text: "Emotional intimacy and facial nuance above all else",
        isCorrect: false,
      },
      {
        id: "b",
        text: "The relationship between the characters and their surroundings",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Shallow depth of field as the primary storytelling tool",
        isCorrect: false,
      },
      {
        id: "d",
        text: "A highly subjective point of view from one character",
        isCorrect: false,
      },
    ],
    explanation: "Static wide framing often emphasizes space, environment, distance, and the relationship between characters and the world around them.",
  },
  {
    key: "cinematic-reading-002",
    category: "Cinematic Reading",
    prompt: "A scene is covered mostly in tight close-ups with very little environmental context. What does that most commonly emphasize?",
    options: [
      {
        id: "a",
        text: "Geography and spatial clarity",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Emotional detail and subjectivity",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Production design and world-building",
        isCorrect: false,
      },
      {
        id: "d",
        text: "Neutral observation",
        isCorrect: false,
      },
    ],
    explanation: "Tight close-ups reduce environmental information and push attention toward expression, emotion, and subjectivity.",
  },
  {
    key: "cinematic-reading-003",
    category: "Cinematic Reading",
    prompt: "A dialogue scene is shot with very symmetrical framing and carefully controlled composition. What quality does that most commonly add?",
    options: [
      {
        id: "a",
        text: "A sense of formal control or deliberateness",
        isCorrect: true,
      },
      {
        id: "b",
        text: "A more documentary-like feeling",
        isCorrect: false,
      },
      {
        id: "c",
        text: "A more chaotic and unstable feeling",
        isCorrect: false,
      },
      {
        id: "d",
        text: "A more handheld and immediate feeling",
        isCorrect: false,
      },
    ],
    explanation: "Symmetry often creates a feeling of control, design, precision, or intentional stillness.",
  },
  {
    key: "cinematic-reading-004",
    category: "Cinematic Reading",
    prompt: "A character is filmed from far away with a long lens, isolated against a soft background. What does that most commonly do to the viewer’s reading of the image?",
    options: [
      {
        id: "a",
        text: "It usually makes the moment feel more spatially open and casual",
        isCorrect: false,
      },
      {
        id: "b",
        text: "It usually makes the character feel more embedded in the environment",
        isCorrect: false,
      },
      {
        id: "c",
        text: "It often creates emotional distance while visually isolating the character",
        isCorrect: true,
      },
      {
        id: "d",
        text: "It mainly makes the lighting feel harder",
        isCorrect: false,
      },
    ],
    explanation: "A distant long-lens shot often separates the character from the environment visually and can create a feeling of isolation or emotional distance.",
  },
  {
    key: "cinematic-reading-005",
    category: "Cinematic Reading",
    prompt: "A scene is shot mostly with handheld camera movement that subtly reacts to the actors. What does that most commonly add?",
    options: [
      {
        id: "a",
        text: "A sense of immediacy and instability",
        isCorrect: true,
      },
      {
        id: "b",
        text: "A stronger feeling of formal distance",
        isCorrect: false,
      },
      {
        id: "c",
        text: "A more diagrammatic understanding of space",
        isCorrect: false,
      },
      {
        id: "d",
        text: "A more neutral, invisible viewpoint",
        isCorrect: false,
      },
    ],
    explanation: "Reactive handheld movement often makes a scene feel more immediate, present, and slightly unstable.",
  },
  {
    key: "cinematic-reading-006",
    category: "Cinematic Reading",
    prompt: "A character is framed with a large amount of empty space around them in a quiet moment. What does that most commonly emphasize?",
    options: [
      {
        id: "a",
        text: "Physical comedy",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Isolation or emotional distance",
        isCorrect: true,
      },
      {
        id: "c",
        text: "Faster pacing",
        isCorrect: false,
      },
      {
        id: "d",
        text: "A more objective color contrast",
        isCorrect: false,
      },
    ],
    explanation: "Large negative space often emphasizes loneliness, distance, or emotional separation.",
  },
  {
    key: "cinematic-reading-007",
    category: "Cinematic Reading",
    prompt: "A scene suddenly cuts from smooth, controlled compositions to a much more chaotic visual style. What does that most commonly signal?",
    options: [
      {
        id: "a",
        text: "A shift in emotional or psychological state",
        isCorrect: true,
      },
      {
        id: "b",
        text: "A change in sensor size",
        isCorrect: false,
      },
      {
        id: "c",
        text: "A change in white balance workflow",
        isCorrect: false,
      },
      {
        id: "d",
        text: "A correction of screen direction",
        isCorrect: false,
      },
    ],
    explanation: "A sudden change in visual control often signals a shift in emotional intensity, instability, or subjective experience.",
  },
  {
    key: "cinematic-reading-008",
    category: "Cinematic Reading",
    prompt: "If a character is repeatedly framed behind foreground objects, what does that most commonly add to the image?",
    options: [
      {
        id: "a",
        text: "A cleaner sense of visual neutrality",
        isCorrect: false,
      },
      {
        id: "b",
        text: "A flatter relationship to the environment",
        isCorrect: false,
      },
      {
        id: "c",
        text: "A feeling of obstruction, voyeurism, or emotional distance",
        isCorrect: true,
      },
      {
        id: "d",
        text: "A stronger sense of symmetrical balance",
        isCorrect: false,
      },
    ],
    explanation: "Foreground obstruction often makes the viewer feel separated from the subject, or suggests surveillance, tension, or emotional distance.",
  },
  {
    key: "cinematic-reading-009",
    category: "Cinematic Reading",
    prompt: "A scene is played in a single unbroken take instead of being cut into coverage. What does that most commonly emphasize?",
    options: [
      {
        id: "a",
        text: "Temporal continuity and sustained performance",
        isCorrect: true,
      },
      {
        id: "b",
        text: "Faster pacing through compression",
        isCorrect: false,
      },
      {
        id: "c",
        text: "Greater visual neutrality in every case",
        isCorrect: false,
      },
      {
        id: "d",
        text: "More editorial control over eyelines",
        isCorrect: false,
      },
    ],
    explanation: "A long unbroken take often emphasizes real-time continuity, performance flow, and sustained tension or immersion.",
  },
  {
    key: "lens-camera-intuition-001",
    category: "Lens & Camera Intuition",
    prompt: "Why might a cinematographer choose a wider lens for a close-up instead of a longer lens with similar framing?",
    options: [
      {
        id: "a",
        text: "To make the image more color accurate",
        isCorrect: false,
      },
      {
        id: "b",
        text: "To increase the sense of spatial tension and proximity",
        isCorrect: true,
      },
      {
        id: "c",
        text: "To reduce depth of field without changing distance",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To make the background more compressed",
        isCorrect: false,
      },
    ],
    explanation: "A wider lens used closer to the subject can increase the feeling of proximity and spatial tension, even if the framing is similar.",
  },
  {
    key: "lens-camera-intuition-002",
    category: "Lens & Camera Intuition",
    prompt: "What is the most direct visual consequence of switching from a spherical lens to an anamorphic lens while keeping a similar horizontal framing?",
    options: [
      {
        id: "a",
        text: "The image usually gains shallower depth of field only because the stop changes",
        isCorrect: false,
      },
      {
        id: "b",
        text: "The image usually feels taller and more compressed vertically",
        isCorrect: false,
      },
      {
        id: "c",
        text: "The image often gains a wider horizontal feel and different optical character",
        isCorrect: true,
      },
      {
        id: "d",
        text: "The image automatically becomes more neutral and less stylized",
        isCorrect: false,
      },
    ],
    explanation: "Anamorphic lenses often create a wider horizontal impression and bring their own optical character, such as different bokeh, flares, and rendering.",
  },
  {
    key: "lens-camera-intuition-003",
    category: "Lens & Camera Intuition",
    prompt: "Why might a cinematographer choose a 25mm over a 50mm for a moving shot in a tight interior?",
    options: [
      {
        id: "a",
        text: "To make the space feel larger and keep more of the environment present",
        isCorrect: true,
      },
      {
        id: "b",
        text: "To reduce perspective change during movement",
        isCorrect: false,
      },
      {
        id: "c",
        text: "To make the background feel more compressed",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To make focus pulling less necessary in every case",
        isCorrect: false,
      },
    ],
    explanation: "A wider lens can help include more of the space and often makes movement through a tight interior feel more spatially alive.",
  },
  {
    key: "lens-camera-intuition-004",
    category: "Lens & Camera Intuition",
    prompt: "What is the most likely reason a cinematographer might avoid an extremely long lens for an emotional dialogue scene?",
    options: [
      {
        id: "a",
        text: "It always makes the lighting flatter",
        isCorrect: false,
      },
      {
        id: "b",
        text: "It can create too much distance from the actors and reduce the desired intimacy",
        isCorrect: true,
      },
      {
        id: "c",
        text: "It automatically makes skin tones less accurate",
        isCorrect: false,
      },
      {
        id: "d",
        text: "It prevents selective focus",
        isCorrect: false,
      },
    ],
    explanation: "A very long lens can feel emotionally distant or observational if the scene would benefit more from presence or intimacy.",
  },
  {
    key: "lens-camera-intuition-005",
    category: "Lens & Camera Intuition",
    prompt: "What usually changes most when a cinematographer chooses to shoot the same framing on a larger sensor with a longer focal length?",
    options: [
      {
        id: "a",
        text: "The white balance response",
        isCorrect: false,
      },
      {
        id: "b",
        text: "The shutter relationship",
        isCorrect: false,
      },
      {
        id: "c",
        text: "The depth rendering and field-of-view relationship",
        isCorrect: true,
      },
      {
        id: "d",
        text: "The frame rate flexibility",
        isCorrect: false,
      },
    ],
    explanation: "Sensor size and focal length choices affect field of view and depth rendering, which can noticeably change how the image feels.",
  },
  {
    key: "lens-camera-intuition-006",
    category: "Lens & Camera Intuition",
    prompt: "Why might a cinematographer deliberately choose a lens with more flare character instead of a cleaner modern lens?",
    options: [
      {
        id: "a",
        text: "To increase sensor latitude in highlights",
        isCorrect: false,
      },
      {
        id: "b",
        text: "To add a stronger optical personality to the image",
        isCorrect: true,
      },
      {
        id: "c",
        text: "To make the frame rate feel smoother",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To reduce the need for negative fill",
        isCorrect: false,
      },
    ],
    explanation: "A lens with more flare character can add texture, mood, and a more distinctive optical personality to the image.",
  },
  {
    key: "lens-camera-intuition-007",
    category: "Lens & Camera Intuition",
    prompt: "Why might a cinematographer choose a longer lens for a close-up instead of moving closer with a wider lens?",
    options: [
      {
        id: "a",
        text: "To make the subject feel more isolated from the background",
        isCorrect: true,
      },
      {
        id: "b",
        text: "To increase the sensor’s dynamic range",
        isCorrect: false,
      },
      {
        id: "c",
        text: "To make motion blur more noticeable",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To reduce the need for exposure control",
        isCorrect: false,
      },
    ],
    explanation: "A longer lens from farther away often isolates the subject differently and changes the subject-background relationship compared with a closer wider-lens shot.",
  },
  {
    key: "lens-camera-intuition-008",
    category: "Lens & Camera Intuition",
    prompt: "What is the most likely visual consequence of using a very wide lens too close to a face?",
    options: [
      {
        id: "a",
        text: "The image usually feels flatter and more compressed",
        isCorrect: false,
      },
      {
        id: "b",
        text: "Facial proportions can start to feel exaggerated",
        isCorrect: true,
      },
      {
        id: "c",
        text: "The background always becomes softer",
        isCorrect: false,
      },
      {
        id: "d",
        text: "The shot becomes more symmetrical",
        isCorrect: false,
      },
    ],
    explanation: "A very wide lens used close to a face can exaggerate spatial relationships and make facial features feel more distorted or aggressive.",
  },
  {
    key: "lens-camera-intuition-009",
    category: "Lens & Camera Intuition",
    prompt: "Why might a cinematographer choose a clean modern lens over a more characterful vintage lens?",
    options: [
      {
        id: "a",
        text: "To increase the camera’s frame rate options",
        isCorrect: false,
      },
      {
        id: "b",
        text: "To get more neutral rendering and consistency across the image",
        isCorrect: true,
      },
      {
        id: "c",
        text: "To make the field of view wider at the same focal length",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To reduce the sensor crop factor",
        isCorrect: false,
      },
    ],
    explanation: "A clean modern lens is often chosen for its consistency, lower optical character, and more neutral rendering.",
  },
  {
    key: "lens-camera-intuition-010",
    category: "Lens & Camera Intuition",
    prompt: "What is the most direct visual consequence of choosing a lens with heavier focus falloff?",
    options: [
      {
        id: "a",
        text: "The in-focus plane feels more selective and the image can feel more dimensional",
        isCorrect: true,
      },
      {
        id: "b",
        text: "The frame always becomes lower contrast",
        isCorrect: false,
      },
      {
        id: "c",
        text: "The image automatically becomes warmer",
        isCorrect: false,
      },
      {
        id: "d",
        text: "The perspective becomes more compressed",
        isCorrect: false,
      },
    ],
    explanation: "Stronger focus falloff can make the in-focus area feel more selective and create a stronger sense of separation or dimensionality.",
  },
  {
    key: "lens-camera-intuition-011",
    category: "Lens & Camera Intuition",
    prompt: "Why might a cinematographer choose a wider lens even when a longer lens could achieve the same framing?",
    options: [
      {
        id: "a",
        text: "To reduce highlight clipping in the background",
        isCorrect: false,
      },
      {
        id: "b",
        text: "To make camera movement feel more pronounced and spatial",
        isCorrect: true,
      },
      {
        id: "c",
        text: "To make skin tones more neutral",
        isCorrect: false,
      },
      {
        id: "d",
        text: "To make the image less dependent on blocking",
        isCorrect: false,
      },
    ],
    explanation: "A wider lens often makes movement feel more active and spatially expressive, even if the framing could also be achieved with a longer lens from farther away.",
  },
];
