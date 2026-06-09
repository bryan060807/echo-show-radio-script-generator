import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import mammoth from 'mammoth';

// Load environmental variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up server-side parsing limits for large files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Resilient API retry helper with exponential backoff for high-demand scenario recovery
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1500,
  backoffFactor = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = String(error?.message || error || '');
    const isRetryable = 
      error?.status === 503 || 
      error?.status === 429 || 
      errorStr.includes('503') || 
      errorStr.includes('429') ||
      errorStr.includes('temporary') ||
      errorStr.includes('high demand') ||
      errorStr.includes('UNAVAILABLE') ||
      errorStr.includes('overloaded');

    if (retries > 0 && isRetryable) {
      console.warn(`[Gemini API] Encountered transient high-demand error. Retrying in ${delay}ms... (Remaining retries: ${retries}). Details:`, errorStr);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * backoffFactor, backoffFactor);
    }
    throw error;
  }
}

// Relational types mapping
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    brief: {
      type: Type.OBJECT,
      properties: {
        documentTitle: { type: Type.STRING, description: "Highly engaging title for the uploaded doc or analysis" },
        keyIdeas: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Major conceptual pillars discovered from the text"
        },
        factsAndFactsSheet: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Interesting statistics, raw numbers, proven citations, or key facts found in the content"
        },
        conflictsOrTensions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Diverging opinions, challenges, trade-offs, or conflicts described in the text"
        },
        charactersOrVoices: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Core personalities, authors, historical actors, or experts mentioned"
        },
        surprisingDetails: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Unusual anecdotes, weird facts, or counter-intuitive findings"
        },
        summary: { type: Type.STRING, description: "A high-fidelity cohesive review of the source material" }
      },
      required: ["documentTitle", "keyIdeas", "factsAndFactsSheet", "conflictsOrTensions", "charactersOrVoices", "surprisingDetails", "summary"]
    },
    outline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Segment title (highly thematic e.g. 'The Skeptic's Corner')" },
          durationEstimate: { type: Type.STRING, description: "e.g. '3 minutes' or '45 seconds'" },
          purpose: { type: Type.STRING, description: "What this segment covers and aims to explain" }
        },
        required: ["title", "durationEstimate", "purpose"]
      }
    },
    hosts: {
      type: Type.OBJECT,
      properties: {
        host1: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Male host name, e.g. Marcus, Leo, Dan" },
            voiceName: { type: Type.STRING, description: "Must be 'Charon' or 'Fenrir'" },
            description: { type: Type.STRING, description: "Short bio matching host instructions (skeptical, clever, dry)" },
            role: { type: Type.STRING, description: "Must be 'host1'" }
          },
          required: ["name", "voiceName", "description", "role"]
        },
        host2: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Female host name, e.g. Sandra, Sarah, Joy" },
            voiceName: { type: Type.STRING, description: "Must be 'Kore' or 'Puck'" },
            description: { type: Type.STRING, description: "Short bio matching host instructions (insightful, energetic, emotionally intelligent)" },
            role: { type: Type.STRING, description: "Must be 'host2'" }
          },
          required: ["name", "voiceName", "description", "role"]
        }
      },
      required: ["host1", "host2"]
    },
    script: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "A unique id e.g. 'line-1'" },
          speaker: { type: Type.STRING, description: "Speaker name matching host1/host2 names, or guest, or caller" },
          role: { type: Type.STRING, description: "Must be 'host1', 'host2', 'guest', or 'caller'" },
          text: { type: Type.STRING, description: "The spoken dialogue. Pure dialogue, no inline actions" },
          cues: { type: Type.STRING, description: "Optional audio cues like '[LAUGHTER]', '[TENSE PAUSE]', '[INTRO MUSIC]', '[AD BREAK STYLE STINGER]'. Leave blank if none" }
        },
        required: ["id", "speaker", "role", "text"]
      }
    }
  },
  required: ["brief", "outline", "hosts", "script"]
};

// API Endpoints

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// 2. Extract Document Content (Server helper for uploaded binary docx / pdf-text files)
app.post('/api/extract-text', async (req, res) => {
  try {
    const { base64, filename, mimeType } = req.body;
    if (!base64) {
      return res.status(400).json({ error: 'Missing document file data' });
    }

    const buffer = Buffer.from(base64, 'base64');
    let extractedText = '';

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (mimeType === 'text/plain' || filename.endsWith('.txt') || filename.endsWith('.md')) {
      extractedText = buffer.toString('utf-8');
    } else {
      // Fallback: try parsing buffer as text
      extractedText = buffer.toString('utf-8');
    }

    res.json({ text: extractedText });
  } catch (error: any) {
    console.error('Text extraction failed:', error);
    res.status(500).json({ error: error.message || 'Failed to extract text' });
  }
});

// 2b. Rephrase Specific Script Dialogue line with precision AI style controls
app.post('/api/rephrase-line', async (req, res) => {
  try {
    const { text, speaker, role, style } = req.body;
    if (!text || !speaker) {
      return res.status(400).json({ error: 'Missing dialogue text or speaker' });
    }

    const styleDescriptions: Record<string, string> = {
      wittier: 'sharp, lightweight dialogue, incorporating a clever, quick-witted pun or humorous radio-style comeback.',
      sarcastic: 'deadpan, highly cynical style. Sarcastically point out the absurdity or mock the previous premise.',
      pause: 'incorporate dramatic pacing. Insert a dramatic sound cue such as [TENSE PAUSE], [GASPS] or [SIGH] inside the dialogue to create narrative tension.',
      shorter: 'extremely concise, snappy, high-impact radio headline or crisp soundbite. Keep it down to a few punchy words.',
      professional: 'sincere and rigorous academic/professional style. Explains the concept with intellectual focus, statistics, or clear logic.',
      conspiracy: 'funny, dramatic, over-the-top conspiracy theory angle. Act highly suspicious and dramatic, questioning standard explanations.'
    };

    const stylePrompt = styleDescriptions[style] || 'funny, engaging radio talk show style.';

    const prompt = `
      Original dialogue script line spoken by character "${speaker}" (role profile/personality: "${role}"):
      "${text}"

      Please rewrite and improve this line. Keep it in character for "${speaker}". 
      Make the new line strictly adopt this style: ${stylePrompt}

      CRITICAL RESTRICTION ON OUTPUT:
      - Return ONLY and strictly the new dialogue text string. 
      - Do NOT wrap it in quotes.
      - Do NOT include any intro or outro phrases (like "Here is the rewritten line:").
      - Only output pure character dialogue.
      - Keep any appropriate bracketed sound cue formatting if needed (e.g. [LAUGHTER]).
    `;

    console.log(`[Gemini API] Rephrasing dialogue for ${speaker} (style: ${style}) using gemini-3.5-flash...`);

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are an elite, award-winning radio script editor and comedy speechwriter. You rewrite individual lines of dialogue to make them pop perfectly according to requested vocal styles.",
        temperature: 1.0,
      }
    });

    const newText = response.text?.trim().replace(/^"|"$/g, '') || text;
    res.json({ text: newText });
  } catch (error: any) {
    console.error('[Gemini API] Line rephrasing failed:', error);
    res.status(500).json({ error: error.message || 'Failed to rephrase script line' });
  }
});

// 3. Generate Radio Episode
app.post('/api/generate-episode', async (req, res) => {
  try {
    const {
      pastedText,
      files,
      episodeLength,
      tone,
      audience,
      guestIntensity,
      callerToggle,
      parodyToggle,
      outputFormat,
      host1Name = 'Marcus',
      host1Voice = 'Charon',
      host1Profile = 'Skeptical Cynic',
      host2Name = 'Sandra',
      host2Voice = 'Kore',
      host2Profile = 'Rational Enthusiast',
      sponsorBreak = 'none',
      banterDensity = 'witty'
    } = req.body;

    // Consolidate documents
    let consolidatedText = '';
    if (pastedText && pastedText.trim() !== '') {
      consolidatedText += `=== PASTED TEXT ===\n${pastedText}\n\n`;
    }

    if (files && Array.isArray(files)) {
      files.forEach((file: any) => {
        consolidatedText += `=== FILE: ${file.name} ===\n${file.content}\n\n`;
      });
    }

    if (consolidatedText.trim() === '') {
      return res.status(400).json({ error: 'Please upload a document or paste text to proceed.' });
    }

    // Design the host personality guidance based on tone
    let tonePrompt = '';
    switch (tone) {
      case 'funny':
        tonePrompt = 'Highly comedic. The banter features witty comebacks, dry humor, clever puns, and cheeky interruptions without losing sight of the facts.';
        break;
      case 'serious':
        tonePrompt = 'Analytical, sober, highly focused, and deeply respectful. Disagreements are intellectually rigorous and structured like an elite current affairs broadcast.';
        break;
      case 'investigative':
        tonePrompt = 'High energy, intense, structured like an investigative podcast (e.g. Serial or Radiolab). Features dramatic pauses, intense questioning, uncovering hidden truths, and unveiling major facts as a thrilling detective narrative.';
        break;
      case 'dramatic':
        tonePrompt = 'Emphasize conflicts, bold emotions, high-stakes trade-offs, and narrative suspense. Dramatic build-ups and emotional resonance.';
        break;
      case 'educational':
        tonePrompt = 'Insightful, accessible, clear pedagogical style. Analogy-driven explanations, simplified terms (without dumbing down), and highly interactive student-friendly examples.';
        break;
      case 'chaotic':
        tonePrompt = 'Late-night radio madness. Unfiltered opinions, sudden interruptions, hyper banter, hilarious caller interjections, parody public figure cameos, and playful, intense, opinionated arguments.';
        break;
    }

    // Target audience description
    let audiencePrompt = '';
    switch (audience) {
      case 'general':
        audiencePrompt = 'The general public. Accessible, engaging, avoids deep jargon but keeps the ideas smart and conversational.';
        break;
      case 'students':
        audiencePrompt = 'Students and learners. Relatable, energetic, full of useful teaching analogies and learning outcomes.';
        break;
      case 'experts':
        audiencePrompt = 'Industry insiders and domain experts. Retain advanced terminology, challenge the findings list critically, debate methodologies and secondary implications.';
        break;
      case 'kids':
        audiencePrompt = 'Young children. Playful, simple phrasing, extremely high-spirited characters, using funny comparisons.';
        break;
      case 'executives':
        audiencePrompt = 'Busy leaders and corporate stakeholders. Fast-paced, focusing on implications, trade-offs, bottom line, strategic insights, and rapid execution.';
        break;
    }

    // Guest prompts
    let guestPrompt = '';
    if (guestIntensity === 'none') {
      guestPrompt = 'No external guests. Strictly a dialogue between the two amazing main hosts.';
    } else if (guestIntensity === 'few') {
      guestPrompt = 'Include exactly one prominent guest segment featuring an expert, character, or historical/parodic stakeholder. Assign them a descriptive voice.';
    } else {
      guestPrompt = 'Include multiple brief guest segments (2-3 separate guests) representing contrasting perspectives or viewpoints extracted from the document.';
    }

    // Caller prompts
    const callerPrompt = callerToggle 
      ? 'Include 1 or 2 callers calling in during the middle and latter segments of the show with spontaneous, weird, or clever audience questions. Callers should represent normal people reacts.'
      : 'No phone-in callers. Keep the show focused on the hosts and guests.';

    // Parody prompts
    const parodyPrompt = parodyToggle
      ? 'You are authorized and encouraged to include fictionalized parodies or commentary of famous figures related to the subject. However, make them clearly fictional, stylized parody commentary, with a playful tongue-in-cheek disclaimer.'
      : 'Do not use famous people parodies. Stick to literal characters or anonymous industry representatives.';

    // Length guide
    let lengthPrompt = '';
    switch (episodeLength) {
      case '5':
        lengthPrompt = 'Generate a tight, concise show of exactly 20 to 25 script dialogue elements in total.';
        break;
      case '15':
        lengthPrompt = 'Generate a substantial show of exactly 45 to 60 dialogue lines with rich, flowing debate and deep topic coverage.';
        break;
      case '30':
        lengthPrompt = 'Generate a dense, thorough script of 80 to 100 dialogue parts highlighting all facets of the text.';
        break;
      case '60':
        lengthPrompt = 'Generate a masterclass script of 120+ dialogue parts covering every chapter and theme.';
        break;
    }

    const systemInstruction = `
      You are an award-winning creative radio talk show producer and elite comedy scriptwriter.
      Your task is to transform the provided source document content into an incredibly witty, highly addictive, structured audio show script.

      CRITICAL RESTRICTION ON LANGUAGE:
      You MUST NEVER use tired, generic AI filler phrases! Those are dead fish, we bury them. For example:
      - Do NOT say "Let's dive in", "In today's fast-paced world", "This document highlights", "Today we are looking at", "Without further ado", "A testament to", "Let's unpack this".
      Instead, write dialogue that sounds like highly polished, snappy radio broadcasters! Starting immediately with immediate, human banter, or an engaging teaser!

      HOST DESIGN DIRECTIONS:
      1. Host 1 (Primary Broadcaster): Name him "${host1Name}". Voice: "${host1Voice}". Profile: ${host1Profile}. He should be clever, slightly skeptical, warm, and show dry humor.
      2. Host 2 (Co-Broadcaster): Name her "${host2Name}". Voice: "${host2Voice}". Profile: ${host2Profile}. She should be energetic, insightful, emotionally intelligent, and push the conversation forward.
      They have real, affectionate, playful chemistry. They can disagree, gently interrupt, tease, but they are both curious and intelligent. Banter should highlight the facts, never override them.
      In your returned hosts JSON and script lines, Host 1 MUST have speaker set to "${host1Name}", role set to "host1". Host 2 MUST have speaker set to "${host2Name}", role set to "host2".

      STRICT FAITHFULNESS TO DATA:
      - Stay entirely faithful to the provided text.
      - DO NOT make up facts, statistics, names, or events that are not either directly mentioned or logically derived from the document.
      - If the source is silent on something a host asks, have the other host answer honestly: "Well, the text actually doesn't specify..." or "That remains an open mystery."
      - If the source is multi-sided, dramatize the tension and disagreement cleanly.

      PRODUCTION CUES:
      Include short dynamic sound cue markers in the "cues" field like "[INTRO MUSIC]", "[PHONE RING]", "[AD BREAK STYLE STINGER]", "[LAUGHTER]", "[TENSE PAUSE]" when it heightens the comedic or dramatic timing. Keep the "text" field clean from actions.

      FORMAT SPECS:
      You must respond strictly with custom structured JSON output conforming to the schema provided. No markdown code blocks, no trailing strings outside the JSON.
    `;

    const userPrompt = `
      Please compile the show script using the following parameters:
      - Target Episode Length: ~${episodeLength} minutes (${lengthPrompt})
      - Selected Show Tone: ${tone} (${tonePrompt})
      - Target Audience Profile: ${audience} (${audiencePrompt})
      - Guest Intensity Level: ${guestIntensity} (${guestPrompt})
      - Include Phone Callers: ${callerToggle ? "YES" : "NO"} (${callerPrompt})
      - Famous Parody Integration: ${parodyToggle ? "YES" : "NO"} (${parodyPrompt})
      - Host 1 (Primary): Name: ${host1Name} | Voice: ${host1Voice} | Personality: ${host1Profile}
      - Host 2 (Co-Host): Name: ${host2Name} | Voice: ${host2Voice} | Personality: ${host2Profile}
      - Banter Pacing/Density: ${banterDensity}
        * Pacing is '${banterDensity}'. Note: if 'formal', keep dialogue polite and orderly. If 'witty', show high-spirited playful banter. If 'caffeine', generate rapid-fire cross-talk, heavy witty interruptions, and lots of teasing!
      - Fictional Sponsor Break insertion: ${sponsorBreak !== 'none' ? `Include a funny 2-3 line advertisement for '${sponsorBreak}' in the middle of the script, prefixed with an [AD BREAK STYLE STINGER] sound cue` : "No commercial sponsor break"}

      SOURCE MATERIAL / DOCUMENTS PROVIDED:
      ${consolidatedText}

      Create a beautiful RadioShowEpisode object.
    `;

    console.log('Sending request to Gemini model: gemini-3.5-flash with custom schema (wrapped in resilient retryWithBackoff)');

    const response = await retryWithBackoff(() =>
      ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 1.0, // High temperature for lively dialogue
        },
      })
    );

    const parsedData = JSON.parse(response.text?.trim() || '{}');
    res.json(parsedData);
  } catch (error: any) {
    console.error('Gemini episode generator generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate radio episode' });
  }
});

// 4. Transform specific text to vocal speech audio (TTS)
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName, emotionStyle } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Missing dialogue text for TTS generation' });
    }

    const selectedVoice = voiceName || 'Zephyr';
    
    // Smart vocal instruction-following enunciation prepending
    let promptText = text;
    if (emotionStyle && emotionStyle !== 'none' && emotionStyle !== 'standard') {
      promptText = `Say ${emotionStyle}: ${text}`;
    }

    console.log(`Generating TTS audio for text using voice name ${selectedVoice} and style ${emotionStyle || 'none'} (wrapped in resilient retryWithBackoff)`);

    const response = await retryWithBackoff(() =>
      ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              // Options: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      })
    );

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const base64Audio = inlineData?.data;
    const mimeType = inlineData?.mimeType;

    if (!base64Audio) {
      throw new Error('TTS response did not contain audio binary payload data.');
    }

    console.log(`Successfully generated TTS. MimeType returned: ${mimeType || 'unknown'}`);
    res.json({ audio: base64Audio, mimeType: mimeType || 'audio/wav' });
  } catch (error: any) {
    console.error('Gemini TTS generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate voice speech audio' });
  }
});

// Serve frontend assets in production / hook Vite in dev
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EchoShow Talk Show Server successfully operating on http://0.0.0.0:${PORT}`);
  });
}

startServer();
