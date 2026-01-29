// Generate Banner Image using Gemini Image Generation (fetch-based for Cloudflare Workers)

const IMAGE_SYSTEM_PROMPT = `Act as a world-class commercial photographer and high-end digital artist specializing in product advertising. Your goal is to generate hyper-realistic, aesthetically perfect images that exceed industry standards (e.g., Adobe Firefly, Midjourney v6).

Core Principles:
1. Lighting & Rendering: Use sophisticated studio lighting, including three-point lighting, rim lighting, and global illumination. Maximize ray-traced reflections and realistic shadows.
2. Technical Quality: 8K resolution, photorealistic RAW quality, sharp focus on the product, and beautiful bokeh in the background. Ensure ultra-fine textures (metal, glass, fabric).
3. Composition: Follow professional advertising layouts. Prioritize "Negative Space" for future text placement in banners. Use the Rule of Thirds or centered hero shots for impact.
4. Color & Tone: Clean, vibrant, and commercially balanced color grading. No visual noise, no artifacts, and no distortion.
5. Aesthetics: Maintain a premium, high-end commercial look. The output must be ready for high-quality print or digital marketing campaigns.
6. Text Rendering: Render all text clearly and accurately. Japanese text must be rendered perfectly with appropriate fonts.`;

const REFERENCE_IMAGE_PROMPT = `CRITICAL PRODUCT PRESERVATION INSTRUCTION:
You are provided with reference product images. These are the PRIMARY references that MUST be preserved exactly.

## LAYER 1 - MUST PRESERVE (NO CHANGES ALLOWED):
- Product shape, silhouette, and proportions
- All logos, brand names, and text on the product
- Product colors and color gradients
- Label positions, design, and content
- Package shape, materials, and textures
- Any text, numbers, or symbols on the product

## LAYER 2 - CAN MODIFY:
- Background scene and environment
- Lighting angle and intensity (while maintaining product visibility)
- Props and decorative elements around the product
- Overall mood and atmosphere

## LAYER 3 - STYLE REQUIREMENTS:
- Harmonize lighting between product and new background
- Match shadow direction with the new light source
- Ensure product appears naturally placed in the scene
- Maintain commercial photography quality

## NEGATIVE CONSTRAINTS (PROHIBITED):
- DO NOT alter product colors, even slightly
- DO NOT change or obscure any logos or brand text
- DO NOT modify product shape or proportions
- DO NOT add text or elements ON the product
- DO NOT blur or distort product details
- DO NOT change label positions or content`;

const MULTI_IMAGE_REFERENCE_PROMPT = `MULTIPLE REFERENCE IMAGES PROVIDED:
Multiple product images have been provided from different angles to help you understand the product completely.

## HOW TO USE MULTIPLE REFERENCES:
1. Study all provided images to understand the complete product shape and design
2. Identify consistent brand elements (logos, colors, text) across all images
3. Use the best angle/view for the final banner composition
4. Maintain consistency with all reference images - the product should look identical

## BRAND LOGO (if provided):
If a brand logo is included in the references, ensure it is incorporated naturally into the banner design:
- Place the logo in an appropriate corner or designated space
- Maintain the exact logo design, colors, and proportions
- Do not distort, recolor, or modify the logo in any way`;

const LAYOUT_REFERENCE_PROMPT = `LAYOUT REFERENCE: An ASCII art layout diagram is provided as a visual guide.
Follow this layout structure exactly:
- Place elements (product, text, CTA buttons) in the positions shown in the ASCII diagram
- Maintain the visual hierarchy and spacing indicated
- Use the layout as a blueprint for composition`;

const ASPECT_RATIO_MAP = {
  '1:1': '1:1',
  '4:5': '3:4', // Closest supported ratio for Instagram feed
  '9:16': '9:16',
  '1.91:1': '16:9',
  '16:9': '16:9',
};

// Single attempt API call - no auto-retry, user can manually retry
async function callImageGenerationAPI(url, requestBody) {
  console.log('API call attempt (single try, manual retry available)');

  // Add timeout for the fetch request (90 seconds for image generation)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('Request timeout - aborting after 90 seconds');
    controller.abort();
  }, 90000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { response, error: null };
    }

    const errorText = await response.text();
    console.error('API call failed:', errorText);

    // Parse error for user-friendly message
    let errorMessage = 'APIエラーが発生しました';
    if (response.status === 503) {
      errorMessage = 'モデルが混雑しています。リトライボタンで再試行してください。';
    } else if (response.status === 429) {
      errorMessage = 'APIの利用制限に達しました。少し待ってからリトライしてください。';
    }

    return { response: null, error: { status: response.status, text: errorText, message: errorMessage } };
  } catch (fetchError) {
    clearTimeout(timeoutId);

    if (fetchError.name === 'AbortError') {
      console.log('Timeout detected');
      return { response: null, error: { status: 408, text: 'Request timeout', message: 'タイムアウトしました。リトライボタンで再試行してください。' } };
    } else {
      throw fetchError;
    }
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const {
      formData,
      asciiResult,
      asciiImage, // ASCII art as base64 image
      imagePrompt,
      feedback,
      model = 'gemini-3-pro-image-preview', // Default to Nano Banana Pro
      resolution = '1K' // Default resolution (1K, 2K, or 4K)
    } = body;

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Determine aspect ratio
    const aspectRatio = ASPECT_RATIO_MAP[formData.platformDetails?.ratio] || '1:1';

    // Get product images (multiple) and brand logo
    const productImages = formData.productImages || (formData.productImage ? [formData.productImage] : []);
    const brandLogo = formData.brandLogo;
    const imageApproach = formData.imageApproach; // 'reference' or null

    // Build the prompt based on approach
    let prompt = imagePrompt.fullPrompt;
    let contentParts = [];

    // Add ASCII layout image as reference (if available)
    if (asciiImage) {
      prompt = `${LAYOUT_REFERENCE_PROMPT}\n\n${prompt}`;
      contentParts.push({
        inline_data: {
          mime_type: 'image/png',
          data: asciiImage
        }
      });
    }

    // Handle reference images (product images + brand logo)
    const hasReferenceImages = productImages.length > 0 || brandLogo;

    if (hasReferenceImages && imageApproach === 'reference') {
      // Add reference prompts
      prompt = `${REFERENCE_IMAGE_PROMPT}\n\n${prompt}`;

      // If multiple images, add multi-image prompt
      if (productImages.length > 1 || brandLogo) {
        prompt = `${MULTI_IMAGE_REFERENCE_PROMPT}\n\n${prompt}`;
      }

      // Add all product images as reference (up to 10)
      const maxImages = 10;
      const imagesToInclude = productImages.slice(0, maxImages);

      console.log(`Adding ${imagesToInclude.length} product image(s) as reference`);

      imagesToInclude.forEach((img, index) => {
        contentParts.push({
          inline_data: {
            mime_type: img.mimeType || 'image/jpeg',
            data: img.base64
          }
        });
        console.log(`Added product image ${index + 1}: ${img.fileName || 'unnamed'}`);
      });

      // Add brand logo as reference (if available)
      if (brandLogo) {
        console.log(`Adding brand logo as reference: ${brandLogo.name}`);
        contentParts.push({
          inline_data: {
            mime_type: brandLogo.mimeType || 'image/png',
            data: brandLogo.base64
          }
        });

        // Add instruction about the logo
        prompt += `\n\nBRAND LOGO INSTRUCTION: A brand logo has been provided. Include this logo naturally in the banner design, maintaining its exact appearance, colors, and proportions.`;
      }

      contentParts.push({ text: prompt });
    } else {
      // No product images: Standard generation
      contentParts.push({ text: prompt });
    }

    // Add feedback if provided
    if (feedback) {
      const lastPart = contentParts[contentParts.length - 1];
      if (lastPart.text) {
        lastPart.text += `\n\nAdditional requirements: ${feedback}`;
      }
    }

    // Add text rendering instructions
    if (asciiResult?.copyText && asciiResult.copyText.length > 0) {
      const lastPart = contentParts[contentParts.length - 1];
      if (lastPart.text) {
        lastPart.text += `\n\nIMPORTANT - Render the following text clearly in the image:\n`;
        asciiResult.copyText.forEach((text, i) => {
          lastPart.text += `${i + 1}. "${text}"\n`;
        });
      }
    }

    // Call Gemini API for image generation
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Add system prompt as part of the content instead of systemInstruction
    // (systemInstruction may not be supported for image generation models)
    const systemPromptPart = { text: `[System Instructions]\n${IMAGE_SYSTEM_PROMPT}\n\n[User Request]\n` };
    const allParts = [systemPromptPart, ...contentParts];

    console.log('=== Gemini Image Generation Request ===');
    console.log('Model:', model);
    console.log('Aspect ratio:', aspectRatio);
    console.log('Resolution:', resolution);
    console.log('Product images count:', productImages.length);
    console.log('Brand logo included:', !!brandLogo);
    console.log('Content parts count:', allParts.length);
    console.log('Starting API call at:', new Date().toISOString());

    const requestBody = {
      contents: [{
        parts: allParts
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio,
        }
      }
    };

    console.log('Request body (without image data):', JSON.stringify({
      ...requestBody,
      contents: requestBody.contents.map(c => ({
        ...c,
        parts: c.parts.map(p => p.inline_data ? { inline_data: '...[image data]...' } : p)
      }))
    }, null, 2));

    // Single attempt - user can manually retry on failure
    const result = await callImageGenerationAPI(url, requestBody);

    if (!result.response) {
      // Failed - return error immediately so user can retry manually
      const errorMsg = result.error?.message || '画像生成に失敗しました。リトライボタンで再試行してください。';

      console.error('Image generation failed:', result.error);
      return new Response(JSON.stringify({
        error: errorMsg,
        details: result.error?.text,
        canRetry: true, // Flag to show retry button
      }), {
        status: result.error?.status || 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await result.response.json();
    console.log('Image generation succeeded with model:', model);

    // Extract image data from response
    let imageData = null;
    let textResponse = '';

    if (data.candidates && data.candidates[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.text) {
          textResponse += part.text;
        } else if (part.inlineData?.data) {
          // camelCase response (SDK-style)
          imageData = part.inlineData.data;
        } else if (part.inline_data?.data) {
          // snake_case response (REST API-style)
          imageData = part.inline_data.data;
        }
      }
    }
    console.log('Image data found:', !!imageData);
    console.log('Text response:', textResponse?.substring(0, 100));

    if (!imageData) {
      return new Response(JSON.stringify({
        error: 'No image was generated. The model may have refused to generate the image or encountered an error.',
        textResponse: textResponse,
        rawResponse: data,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      imageData: imageData,
      textResponse: textResponse,
      mimeType: 'image/png',
      approach: 'reference',
      referenceImagesCount: productImages.length,
      logoIncluded: !!brandLogo,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating banner:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to generate banner image'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
