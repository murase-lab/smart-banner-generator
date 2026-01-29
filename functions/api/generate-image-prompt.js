// Generate Image Prompt from ASCII Layout (fetch-based for Cloudflare Workers)

const SYSTEM_PROMPT = `You are an expert AI Image Prompt Engineer specializing in Adobe Firefly and Midjourney.

Your goal is to convert ASCII art layouts and design descriptions into highly detailed, professional-grade image generation prompts in English.

## Core Philosophy
To achieve "100/100" quality, you must translate abstract concepts into physical visual descriptions.
- Bad: "Make it look luxurious."
- Good: "Use textured matte cardstock with subtle gold foil stamping, placed on a surface of organic washi paper under soft diffused daylight."

## Operational Steps
1. **Analyze the Input:** Understand the purpose and layout. Identify strictly what is "Text to be written" vs. "Visual Context (Buttons, Badges, Labels)."
2. **Separate Content & Container:**
   - If the input says [BADGE: text], [BUTTON: text], or (note), DO NOT put the brackets or labels in the text list.
   - Move the visual description (e.g., "Circular gold badge," "Rectangular CTA button") to the Elements section.
   - Keep ONLY the pure text string inside the Text Rendering section.
3. **Determine the Vibe:** Decide on the atmosphere (Serene, Energetic, Trustworthy).
4. **Construct the Prompt:** Generate the prompt in English using the strict format below.

## Output Format (Strictly follow this structure)

Return a JSON object with these exact fields:
{
  "concept": "A photorealistic, high-end [Style] design for [Purpose/Platform]. The layout strictly follows the provided structure reference image.",
  "atmosphere": "[Keywords describing mood, lighting, and feeling.]",
  "materials": "Color palette: [colors]. Background texture: [physical material description].",
  "elements": ["Element 1 description", "Element 2 description"],
  "textRendering": ["Exact text string 1", "Exact text string 2"],
  "technicalSpecs": "Aspect Ratio: [ratio], Composition: [type], Camera & Lens: [settings]",
  "fullPrompt": "[Complete prompt in one paragraph for direct use with image generation AI]"
}`;

async function callGeminiAPI(apiKey, model, systemInstruction, userPrompt, jsonMode = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [{
      parts: [{ text: userPrompt }]
    }],
    generationConfig: {
      temperature: 0.7,
    }
  };

  if (jsonMode) {
    requestBody.generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const {
      formData,
      asciiResult,
      model = 'gemini-2.0-flash'
    } = body;

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Include image generation instructions from ASCII layout designer
    const imageInstructions = asciiResult.imageInstructions || '';
    const colorStyleRecommendations = asciiResult.colorStyleRecommendations || '';

    const userPrompt = `Convert the following ASCII banner layout into a professional image generation prompt.

## Platform Information:
- Platform: ${formData.platformDetails?.name || formData.platform}
- Aspect Ratio: ${formData.platformDetails?.ratio}
- Size: ${formData.platformDetails?.size}
- Purpose: ${formData.platformDetails?.description || ''}

## Product/Service Information:
- Product Name: ${formData.productName}
- Description: ${formData.productDescription}
- Design Goal: ${formData.designGoal}
${formData.vibe ? `- Brand Vibe: ${formData.vibe}` : ''}
${formData.targetAudience ? `- Target Audience: ${formData.targetAudience}` : ''}
${formData.brandLogo ? `- Brand Logo: ${formData.brandLogo.name} (should be included in the design)` : ''}

## ASCII Layout:
\`\`\`
${asciiResult.ascii}
\`\`\`

## Design Strategy Notes (from Layout Designer):
${asciiResult.designNotes || 'N/A'}

## Suggested Copy Text:
${asciiResult.copyText?.join('\n') || 'N/A'}

${imageInstructions ? `## Image Generation Instructions (from Layout Designer):
${imageInstructions}

IMPORTANT: The layout designer has provided specific instructions above. Incorporate these into the final prompt.` : ''}

${colorStyleRecommendations ? `## Color & Style Recommendations:
${colorStyleRecommendations}` : ''}

## Your Task:
Create a detailed, professional image generation prompt that:
1. Follows the ASCII layout structure precisely
2. Incorporates the design strategy and image generation instructions
3. Maintains the specified brand vibe and design goals
4. Includes specific instructions for text rendering with the suggested copy
5. Specifies materials, lighting, and atmosphere in physical, concrete terms

Output as JSON with the required fields.`;

    const text = await callGeminiAPI(apiKey, model, SYSTEM_PROMPT, userPrompt, true);

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = {
        concept: text,
        atmosphere: '',
        materials: '',
        elements: [],
        textRendering: asciiResult.copyText || [],
        technicalSpecs: `Aspect Ratio: ${formData.platformDetails?.ratio}`,
        fullPrompt: text,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating image prompt:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to generate image prompt'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
