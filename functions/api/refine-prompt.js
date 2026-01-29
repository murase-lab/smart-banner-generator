// Refine Image Prompt with user feedback (fetch-based for Cloudflare Workers)

const SYSTEM_PROMPT = `You are an expert AI Image Prompt Engineer specializing in Adobe Firefly and Midjourney.

You are refining an existing image generation prompt based on user feedback.

## Rules:
1. Maintain the same output JSON structure
2. Apply the user's modifications while keeping the prompt professional and detailed
3. Ensure all text elements are preserved unless specifically asked to change

## Output Format:
Return a JSON object with these exact fields:
{
  "concept": "...",
  "atmosphere": "...",
  "materials": "...",
  "elements": ["..."],
  "textRendering": ["..."],
  "technicalSpecs": "...",
  "fullPrompt": "..."
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
      previousPrompt,
      feedback,
      model = 'gemini-2.0-flash'
    } = body;

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userPrompt = `Refine the following image generation prompt based on user feedback.

**Original Context:**
- Platform: ${formData.platformDetails?.name || formData.platform}
- Product: ${formData.productName}
- Aspect Ratio: ${formData.platformDetails?.ratio}

**Current Prompt:**
${JSON.stringify(previousPrompt, null, 2)}

**User Feedback / Modification Request:**
${feedback}

Please create a refined image generation prompt that addresses the user's feedback. Output as JSON.`;

    const text = await callGeminiAPI(apiKey, model, SYSTEM_PROMPT, userPrompt, true);

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = {
        ...previousPrompt,
        fullPrompt: text,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error refining prompt:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to refine prompt'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
