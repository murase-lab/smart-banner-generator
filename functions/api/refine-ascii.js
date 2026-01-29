// Refine ASCII Layout with user feedback (fetch-based for Cloudflare Workers)

const SYSTEM_PROMPT = `Act as a world-class EC marketer and top 1% professional web designer in Japan.

You are refining an existing ASCII banner layout based on user feedback.

## Rules:
1. Maintain the same platform and aspect ratio
2. Apply the user's modifications while preserving good design principles
3. Keep conversion optimization in mind
4. Output the refined layout in the same format as the original

## Output Format:
\`\`\`ascii
[Your refined ASCII layout here]
\`\`\`

### Design Notes:
[Explain what changes were made and why]

### Copy Suggestions:
- Headline: "[Suggested headline]"
- Subtext: "[Suggested subtext]"
- CTA: "[Suggested CTA text]"`;

async function callGeminiAPI(apiKey, model, systemInstruction, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [{
        parts: [{ text: userPrompt }]
      }],
      generationConfig: {
        temperature: 0.7,
      }
    })
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
      previousAscii,
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

    const userPrompt = `Refine the following ASCII banner layout based on user feedback.

**Original Context:**
- Platform: ${formData.platformDetails?.name || formData.platform}
- Product: ${formData.productName}
- Design Goal: ${formData.designGoal}

**Current ASCII Layout:**
\`\`\`
${previousAscii.ascii}
\`\`\`

**Current Design Notes:**
${previousAscii.designNotes || 'No notes available'}

**User Feedback / Modification Request:**
${feedback}

Please create a refined ASCII layout that addresses the user's feedback while maintaining good conversion design principles.`;

    const text = await callGeminiAPI(apiKey, model, SYSTEM_PROMPT, userPrompt);

    // Parse ASCII and notes from response
    const asciiMatch = text.match(/```ascii\n([\s\S]*?)```/) || text.match(/```\n([\s\S]*?)```/);
    const ascii = asciiMatch ? asciiMatch[1].trim() : text;

    // Extract design notes
    const notesMatch = text.match(/### Design Notes:([\s\S]*?)(?=###|$)/);
    const designNotes = notesMatch ? notesMatch[1].trim() : '';

    // Extract copy suggestions
    const copyTexts = [];
    const headlineMatch = text.match(/Headline:\s*"([^"]+)"/);
    const subtextMatch = text.match(/Subtext:\s*"([^"]+)"/);
    const ctaMatch = text.match(/CTA:\s*"([^"]+)"/);

    if (headlineMatch) copyTexts.push(headlineMatch[1]);
    if (subtextMatch) copyTexts.push(subtextMatch[1]);
    if (ctaMatch) copyTexts.push(ctaMatch[1]);

    const finalCopyTexts = copyTexts.length > 0 ? copyTexts : previousAscii.copyText || [];

    return new Response(JSON.stringify({
      ascii: ascii,
      designNotes: designNotes || text,
      copyText: finalCopyTexts,
      rawResponse: text,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error refining ASCII:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to refine ASCII layout'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
