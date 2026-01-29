// ASCII Layout Generation using Gemini API (fetch-based for Cloudflare Workers)

const ASPECT_RATIOS = {
  'instagram_feed': { width: 40, height: 50, ratio: '4:5' },
  'instagram_reels': { width: 30, height: 53, ratio: '9:16' },
  'instagram_carousel': { width: 40, height: 40, ratio: '1:1' },
  'instagram_story': { width: 30, height: 53, ratio: '9:16' }, // Legacy
  'tiktok': { width: 30, height: 53, ratio: '9:16' },
  'x_post': { width: 60, height: 31, ratio: '1.91:1' },
  'rakuten': { width: 40, height: 40, ratio: '1:1' },
  'lp_header': { width: 64, height: 36, ratio: '16:9' },
};

const SYSTEM_PROMPT = `あなたはプロのECマーケッター、および日本でトップ1%のプロのウェブデザイナーとして振る舞ってください。

## 目的とゴール:
1. ECサイトの設計において、消費者がより直感的で理解しやすいレイアウト、フォント、画像の配置、アイコン設定などを提案し、コンバージョン率を最大化すること。
2. ASCIIアートを使用して視覚的な設計案を作成し、その設計を基に、別のLLM（画像生成AI）が画像生成プロンプトを作成するための具体的な指示を提供すること。
3. ユーザーが提供する商品や目的に基づいて、最高の売上を生み出すためのデザイン戦略を構築すること。

## 振る舞いとルール:

### 1. 設計案の作成 (ASCIIアート):
- 収集した情報に基づき、ユーザーの意図を反映したレイアウト案をASCIIアートで作成する
- ASCIIアート内では以下を記号と日本語を用いて詳細に示す：
  - 文字の配置と文字のウエイト（太字、細字など）
  - フォントの指定（ゴシック、明朝など）
  - 文字色とアクセントカラーの指定
  - トンマナに合ったあしらい
  - 背景の具体的な指示（グラデーション、単色、パターンなど）
  - 画像の配置場所（全体配置か分割配置か）
  - 構図の指定（中央配置、三分割法、対角線など）
  - キャッチコピーの位置と強調方法
- コンバージョンに結びつく直感的な流れ（動線）を強調して設計する

### 2. ASCIIアート記法:
\`\`\`
┌─┐ │ │ └─┘  : コンテナ・ボックス
[HEADLINE]     : ヘッドライン（キャッチコピー）配置
[SUBTEXT]      : サブテキスト配置
[PRODUCT]      : 商品画像配置
[CTA]          : CTAボタン配置
[BADGE]        : バッジ・ラベル配置
[LOGO]         : ブランドロゴ配置
===            : 区切り線
(注釈)         : デザイン意図の注釈
\`\`\`

### 3. 画像生成AIへの指示:
ASCIIアートと一緒に、画像生成AI（Nano Banana Pro）が鮮明で具体的な画像を生成できるよう、以下の要素を具体的に指示する：
- 配色（メインカラー、アクセントカラー、背景色）
- 照明（自然光、スタジオライト、ドラマチックライト等）
- テクスチャ（マット、グロッシー、メタリック等）
- カメラアングル（正面、斜め45度、俯瞰など）
- 感情的なトーン（高級感、親しみやすさ、緊急感など）
- イラストやアイコンの具体的な描写

### 4. 出力形式:
必ず以下の構造で出力してください：

\`\`\`ascii
[ASCIIレイアウト]
\`\`\`

### Design Notes:
[レイアウト戦略の説明 - なぜこの配置がコンバージョンに効果的か]

### Copy Suggestions (必ず日本語で出力):
- Headline: "【日本語のキャッチコピー】"
- Subtext: "【日本語のサブテキスト】"
- CTA: "【日本語のCTAボタンテキスト】"

### Color & Style Recommendations:
[具体的な配色、フォント、スタイルの推奨]

### Image Generation Instructions (画像生成AIへの指示):
[Nano Banana Pro向けの具体的な画像生成指示を英語で記述]
- Background: [背景の詳細]
- Lighting: [照明の詳細]
- Product Placement: [商品配置の詳細]
- Mood/Atmosphere: [雰囲気の詳細]
- Additional Elements: [追加要素の詳細]

## 重要なルール:
- 出力は1つのデザインのみ
- コピーは必ず日本語で出力（英語禁止）
- プラットフォームの特性を考慮した設計
- コンバージョン率向上を最優先
- 良いコピー例: "今すぐ購入", "限定50%OFF", "美しさを、もっと身近に"
- 悪いコピー例: "Buy Now", "Limited Offer", "Beauty for everyone"`;

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
      platform,
      platformDetails,
      productName,
      productDescription,
      targetAudience,
      designGoal,
      vibe,
      additionalNotes,
      model = 'gemini-2.0-flash',
      copyMode = 'ai',
      manualCopy = null,
      brandLogo = null,
    } = body;

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const aspectConfig = ASPECT_RATIOS[platform] || ASPECT_RATIOS['instagram_feed'];

    // Build copy instruction based on mode
    let copyInstruction = '';
    if (copyMode === 'manual' && manualCopy) {
      const manualTexts = [
        manualCopy.headline ? `- ヘッドライン: "${manualCopy.headline}"` : '',
        manualCopy.subtext ? `- サブテキスト: "${manualCopy.subtext}"` : '',
        manualCopy.cta ? `- CTAボタン: "${manualCopy.cta}"` : '',
      ].filter(t => t).join('\n');
      copyInstruction = `
## ユーザー指定のコピーテキスト（必ずこの通りに使用）:
${manualTexts}

重要: ユーザーが指定したコピーテキストをそのまま使用してください。代替案は提案しないでください。`;
    }

    // Build brand logo instruction
    const logoInstruction = brandLogo ? `
## ブランドロゴ:
- ロゴ名: ${brandLogo.name}
- ロゴをレイアウトに含めてください（[LOGO]で配置位置を示す）` : '';

    // Platform-specific instructions
    const platformInstructions = {
      'instagram_feed': 'Instagramフィード向け。じっくり読ませる・比較させるコンテンツに最適。4:5の縦長フォーマットを活かした構成。',
      'instagram_reels': 'Instagramリール/ストーリーズ向け。完全フルスクリーン必須。9:16の縦長フォーマット。視線の流れは上から下へ。',
      'instagram_carousel': 'Instagramカルーセル向け。複数枚スワイプ形式。1:1の正方形フォーマット。',
      'tiktok': 'TikTok向け。縦型フルスクリーン。9:16フォーマット。若年層向けのデザイン。',
      'x_post': 'X(Twitter)投稿向け。タイムライン表示最適化。1.91:1の横長フォーマット。',
      'rakuten': '楽天市場商品画像向け。商品一覧・詳細ページ表示。1:1正方形。商品が主役のデザイン。',
      'lp_header': 'LPヘッダー向け。16:9の横長フォーマット。ファーストビューで訴求力を発揮。',
    };

    const userPrompt = `以下の情報に基づいて、広告バナーのレイアウトを設計してください。

## ターゲットプラットフォーム:
- プラットフォーム: ${platformDetails?.name || platform}
- アスペクト比: ${platformDetails?.ratio || aspectConfig.ratio}
- サイズ: ${platformDetails?.size || 'standard'}
- 用途: ${platformDetails?.description || platformInstructions[platform] || ''}
- ASCIIグリッドサイズ: 幅${aspectConfig.width}文字 x 高さ${aspectConfig.height}行

## 商品/サービス情報:
- 商品名: ${productName}
- 商品説明: ${productDescription}
${targetAudience ? `- ターゲット層: ${targetAudience}` : ''}

## デザイン設定:
- デザインの目的: ${designGoal}
${vibe ? `- ブランドの雰囲気・トンマナ: ${vibe}` : ''}
${additionalNotes ? `- その他の要望: ${additionalNotes}` : ''}
${copyInstruction}
${logoInstruction}

## 出力要件:
1. ASCIIアートでレイアウトを作成
2. デザインノート（レイアウト戦略の説明）
3. コピー提案（日本語で）
4. カラー・スタイル推奨
5. 画像生成AIへの具体的な指示（英語で）

このプラットフォームと商品に最適化された、コンバージョン率を最大化するレイアウトを作成してください。
${copyInstruction}

Please create an ASCII layout that maximizes conversion for this specific platform and product. Include strategic placement of product image, headline, subtext, and CTA button.`;

    const text = await callGeminiAPI(apiKey, model, SYSTEM_PROMPT, userPrompt);

    // Parse ASCII and notes from response
    const asciiMatch = text.match(/```ascii\n([\s\S]*?)```/);
    const ascii = asciiMatch ? asciiMatch[1].trim() : extractAsciiBlock(text);

    // Extract design notes
    const notesMatch = text.match(/### Design Notes:([\s\S]*?)(?=###|$)/);
    const designNotes = notesMatch ? notesMatch[1].trim() : '';

    // Helper function to check if text contains Japanese characters
    const containsJapanese = (str) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(str);

    // Helper function to clean and validate copy text
    const cleanAndValidate = (str) => {
      if (!str) return null;
      // Remove quotes, brackets, markdown, and trim
      let cleaned = str.trim()
        .replace(/^["「『【]|["」』】]$/g, '')
        .replace(/^\*+\s*|\s*\*+$/g, '') // Remove markdown bold
        .trim();
      // Skip if too short, starts with common English words, or doesn't contain Japanese
      if (cleaned.length < 2) return null;
      if (/^(The|A|An|This|It|Is|Are|Was|Were|Be|Been|Being|Have|Has|Had|Do|Does|Did|Will|Would|Could|Should|May|Might|Must|Shall|Can|Need|Positioned|Located|Placed|Designed|Created)\b/i.test(cleaned)) return null;
      if (!containsJapanese(cleaned)) return null;
      return cleaned;
    };

    // Extract copy suggestions (flexible patterns for various model outputs)
    const copyTexts = [];

    // Try multiple patterns for headline (prioritize quoted Japanese text)
    const headlinePatterns = [
      /Headline:\s*["「『【]([^"」』】]+)["」』】]/i,
      /Headline:\s*[""「『【]([^""」』】]+)[""」』】]/i,
      /- Headline:\s*["「『【]([^"」』】]+)["」』】]/i,
      /\*\*Headline\*\*:\s*["「『【]([^"」』】]+)["」』】]/i,
    ];

    // Try multiple patterns for subtext
    const subtextPatterns = [
      /Subtext:\s*["「『【]([^"」』】]+)["」』】]/i,
      /Subtext:\s*[""「『【]([^""」』】]+)[""」』】]/i,
      /- Subtext:\s*["「『【]([^"」』】]+)["」』】]/i,
      /\*\*Subtext\*\*:\s*["「『【]([^"」』】]+)["」』】]/i,
      /Sub-?headline:\s*["「『【]([^"」』】]+)["」』】]/i,
    ];

    // Try multiple patterns for CTA
    const ctaPatterns = [
      /CTA:\s*["「『【]([^"」』】]+)["」』】]/i,
      /CTA:\s*[""「『【]([^""」』】]+)[""」』】]/i,
      /- CTA:\s*["「『【]([^"」』】]+)["」』】]/i,
      /\*\*CTA\*\*:\s*["「『【]([^"」』】]+)["」』】]/i,
      /Call.?to.?Action:\s*["「『【]([^"」』】]+)["」』】]/i,
    ];

    // Extract headline
    for (const pattern of headlinePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleaned = cleanAndValidate(match[1]);
        if (cleaned) {
          copyTexts.push(cleaned);
          break;
        }
      }
    }

    // Extract subtext
    for (const pattern of subtextPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleaned = cleanAndValidate(match[1]);
        if (cleaned) {
          copyTexts.push(cleaned);
          break;
        }
      }
    }

    // Extract CTA
    for (const pattern of ctaPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleaned = cleanAndValidate(match[1]);
        if (cleaned) {
          copyTexts.push(cleaned);
          break;
        }
      }
    }

    // If no copy found, try to extract from Copy Suggestions section
    if (copyTexts.length === 0) {
      const copySectionMatch = text.match(/### Copy Suggestions[^:]*:?([\s\S]*?)(?=###|$)/i);
      if (copySectionMatch) {
        const lines = copySectionMatch[1].split('\n').filter(line => line.trim());
        for (const line of lines) {
          // Match quoted text in various formats
          const quotedMatch = line.match(/["「『【]([^"」』】]+)["」』】]/);
          if (quotedMatch) {
            const cleaned = cleanAndValidate(quotedMatch[1]);
            if (cleaned) {
              copyTexts.push(cleaned);
            }
          }
        }
      }
    }

    // Final fallback: look for any Japanese text in quotes anywhere in the response
    if (copyTexts.length === 0) {
      const allQuotedJapanese = text.matchAll(/["「『【]([^"」』】]{5,})["」』】]/g);
      for (const match of allQuotedJapanese) {
        const cleaned = cleanAndValidate(match[1]);
        if (cleaned && copyTexts.length < 3) {
          copyTexts.push(cleaned);
        }
      }
    }

    console.log('Extracted copy texts:', copyTexts);
    console.log('Copy texts contain Japanese:', copyTexts.map(t => containsJapanese(t)));

    // Use manual copy if provided, otherwise use AI-generated copy
    let finalCopyTexts = copyTexts;
    if (copyMode === 'manual' && manualCopy) {
      finalCopyTexts = [
        manualCopy.headline,
        manualCopy.subtext,
        manualCopy.cta,
      ].filter(text => text && text.trim() !== '');
      console.log('Using manual copy:', finalCopyTexts);
    }

    // Extract image generation instructions
    const imageInstructionsMatch = text.match(/### Image Generation Instructions[^:]*:?([\s\S]*?)(?=###|$)/i);
    const imageInstructions = imageInstructionsMatch ? imageInstructionsMatch[1].trim() : '';

    // Extract color & style recommendations
    const colorStyleMatch = text.match(/### Color & Style Recommendations[^:]*:?([\s\S]*?)(?=###|$)/i);
    const colorStyleRecommendations = colorStyleMatch ? colorStyleMatch[1].trim() : '';

    console.log('Image instructions extracted:', imageInstructions?.substring(0, 100));

    return new Response(JSON.stringify({
      ascii: ascii || text,
      designNotes: designNotes || text,
      copyText: finalCopyTexts,
      rawResponse: text,
      copyMode: copyMode,
      imageInstructions: imageInstructions,
      colorStyleRecommendations: colorStyleRecommendations,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating ASCII:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to generate ASCII layout'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function extractAsciiBlock(text) {
  const lines = text.split('\n');
  const asciiLines = [];
  let inAsciiBlock = false;

  for (const line of lines) {
    if (line.includes('┌') || line.includes('┐') || line.includes('│') ||
        line.includes('└') || line.includes('┘') || line.includes('[') ||
        line.includes('===') || line.includes('---')) {
      inAsciiBlock = true;
    }

    if (inAsciiBlock) {
      asciiLines.push(line);
    }

    if (inAsciiBlock && line.trim() === '' && asciiLines.length > 5) {
      break;
    }
  }

  return asciiLines.join('\n');
}
