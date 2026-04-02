import OpenAI from "openai";
import { db } from "./db";
import { reviews, activities, eventCollateral } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Profile, Event } from "@shared/schema";

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required for the AI pipeline. Set it in your .env file.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ── Types ───────────────────────────────────────────────────────────

interface ClassificationResult {
  classification: "qualified_lead" | "content_nurture" | "partnership_opportunity" | "relationship_building" | "needs_clarification";
  confidence: number;
  selected_solution_brief: string | null;
  key_insights: string;
  suggested_subject_line: string;
  reasoning: string;
}

interface PipelineInput {
  activityId: number;
  audioBuffer: Buffer;
  audioMimeType: string;
  contactName: string;
  contactEmail: string;
  company: string;
  notes: string;
  userId: string;
  eventId: number | null;
  event: Event | null;
  profile: Profile;
}

interface PipelineResult {
  reviewId: number;
  classification: string;
  confidence: string;
  subjectLine: string;
}

// ── Step 1: Transcribe with Whisper ─────────────────────────────────

async function transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const openai = getOpenAI();
  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("mp3") || mimeType.includes("mpeg") ? "mp3" : "webm";
  const file = new File([audioBuffer], `recording.${ext}`, { type: mimeType });

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "en",
  });

  return response.text;
}

// ── Step 2: Classify with GPT-4o ────────────────────────────────────

async function classify(
  transcription: string,
  contactName: string,
  company: string,
  notes: string,
  eventName: string,
  collateral: string[],
): Promise<ClassificationResult> {
  const collateralList = collateral.length > 0
    ? collateral.map((c) => `- ${c}`).join("\n")
    : "- No collateral configured for this event";

  const openai = getOpenAI();

  const systemPrompt = `You are a conference intelligence analyst for Telesign. Analyze the meeting transcription and classify the encounter.

Available Telesign solution briefs (select the MOST relevant one based on conversation topics):
${collateralList}

Classify into ONE category:
1. 'qualified_lead' - Budget/timeline mentioned, clear buying intent, decision maker
2. 'content_nurture' - Interested but early stage, asked for resources/info
3. 'partnership_opportunity' - Integration/partner discussions, not sales opportunity
4. 'relationship_building' - General networking, recruiter, competitor, vague connection
5. 'needs_clarification' - Audio unclear, ambiguous intent, missing key details

Output strict JSON:
{
  "classification": "qualified_lead|content_nurture|partnership_opportunity|relationship_building|needs_clarification",
  "confidence": 0.0-1.0,
  "selected_solution_brief": "brief name or null",
  "key_insights": "Brief summary of what they care about",
  "suggested_subject_line": "Great connecting at ${eventName}",
  "reasoning": "Why this classification was chosen"
}`;

  const userMessage = `Contact: ${contactName} at ${company}
Context Notes: ${notes || "None"}
Transcription: ${transcription}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" } as any,
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("Empty classification response from GPT-4o");

  const result = JSON.parse(content) as ClassificationResult;

  // Validate classification
  const valid = ["qualified_lead", "content_nurture", "partnership_opportunity", "relationship_building", "needs_clarification"];
  if (!valid.includes(result.classification)) {
    result.classification = "needs_clarification";
  }

  return result;
}

// ── Step 3: Draft email based on classification ─────────────────────

async function draftEmail(
  classification: string,
  transcription: string,
  contactName: string,
  company: string,
  selectedBrief: string | null,
  eventName: string,
): Promise<string> {
  const toneMap: Record<string, string> = {
    qualified_lead: `This is a HOT LEAD - they expressed buying intent. Write a compelling, urgent but professional follow-up email.
Rules:
- Reference specific conversation points from the transcription
${selectedBrief ? `- Mention the attached Telesign solution brief: ${selectedBrief}` : ""}
- Suggest a specific next step (demo, proposal, next meeting)
- Keep under 150 words
- Tone: Enthusiastic, professional, momentum-driven`,

    content_nurture: `This is a NURTURE prospect - interested but early stage. Write an educational, valuable follow-up email.
Rules:
- Reference their specific interests from the conversation
${selectedBrief ? `- Mention the attached Telesign solution brief: ${selectedBrief}` : ""}
- Offer value first, soft sell second
- Include a relevant industry insight or tip
- Tone: Helpful, consultative, no pressure`,

    partnership_opportunity: `This is a PARTNERSHIP opportunity - integration or partner discussions. Write a collaborative follow-up email.
Rules:
- Reference the partnership/integration topics discussed
${selectedBrief ? `- Mention the attached Telesign solution brief: ${selectedBrief}` : ""}
- Suggest a technical deep-dive or partnership exploration call
- Tone: Collaborative, technically credible, forward-looking`,

    relationship_building: `This is a RELATIONSHIP BUILDING contact - general networking. Write a warm, low-pressure follow-up email.
Rules:
- Reference the general industry topics discussed in the transcription
${selectedBrief ? `- Mention the attached Telesign solution brief: ${selectedBrief}` : ""}
- Focus on mutual value and staying in touch
- No hard sell or demo requests
- Tone: Warm, authentic, professional`,

    needs_clarification: `The conversation was unclear or ambiguous. Write a friendly, brief follow-up email.
Rules:
- Keep it very short and open-ended
- Ask if they'd like to continue the conversation
- Tone: Friendly, brief, low-pressure`,
  };

  const openai = getOpenAI();
  const tone = toneMap[classification] || toneMap.needs_clarification;

  const systemPrompt = `You are an expert sales email writer for Telesign at ${eventName}. ${tone}

CRITICAL RULES:
- DO NOT include a Subject: line in the email body
- DO NOT include any email signature — it will be appended automatically
- Start the email with "Hi ${contactName}," and body content only
- Keep the email concise and personalized`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Write a follow-up email for ${contactName} at ${company}.\n\nTranscription of our conversation:\n${transcription}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  let email = response.choices[0].message.content || "Unable to generate email draft.";

  // Strip any accidental Subject: line
  email = email.replace(/^Subject:.*\n?/im, "").trim();

  return email;
}

// ── Main Pipeline ───────────────────────────────────────────────────

export async function processLead(input: PipelineInput): Promise<PipelineResult> {
  const { activityId, audioBuffer, audioMimeType, contactName, contactEmail, company, notes, userId, eventId, event, profile } = input;
  const eventName = event?.name || "the conference";

  console.log(`[Pipeline] Starting for activity ${activityId}: ${contactName} at ${company}`);

  // Get collateral for this event
  let collateralNames: string[] = [];
  if (eventId) {
    const collateral = await db.select().from(eventCollateral).where(eq(eventCollateral.eventId, eventId));
    collateralNames = collateral.map((c) => `${c.name}${c.description ? ` (${c.description})` : ""}`);
  }

  // Step 1: Transcribe
  console.log(`[Pipeline] Transcribing audio (${(audioBuffer.length / 1024).toFixed(0)}KB)...`);
  const transcription = await transcribe(audioBuffer, audioMimeType);
  console.log(`[Pipeline] Transcription: ${transcription.substring(0, 100)}...`);

  // Update activity with transcription
  await db.update(activities).set({ transcript: transcription }).where(eq(activities.id, activityId));

  // Step 2: Classify
  console.log(`[Pipeline] Classifying with GPT-4o...`);
  const classification = await classify(transcription, contactName, company, notes, eventName, collateralNames);
  console.log(`[Pipeline] Classification: ${classification.classification} (${classification.confidence})`);

  // Step 3: Draft email
  console.log(`[Pipeline] Drafting ${classification.classification} email...`);
  let emailBody = await draftEmail(
    classification.classification,
    transcription,
    contactName,
    company,
    classification.selected_solution_brief,
    eventName,
  );

  // Append rep's signature
  if (profile.signature) {
    emailBody += `\n\n${profile.signature}`;
  } else {
    emailBody += `\n\nBest regards,\n\n${profile.name}${profile.title ? `\n${profile.title}` : ""}${profile.phone ? `\nMobile: ${profile.phone}` : ""}\nTelesign`;
  }

  // Step 4: Create review
  console.log(`[Pipeline] Creating review...`);
  const [review] = await db.insert(reviews).values({
    userId,
    eventId,
    contactName,
    contactEmail,
    company: company || "Unknown",
    classification: classification.classification,
    confidence: String(classification.confidence),
    whitePaper: classification.selected_solution_brief,
    subjectLine: classification.suggested_subject_line,
    emailBody,
    transcription,
    keyInsights: classification.key_insights,
    status: "pending_approval",
    timestamp: new Date().toISOString(),
  }).returning();

  // Update activity status
  await db.update(activities).set({
    status: "completed",
    theme: classification.classification,
    emailDraft: emailBody,
  }).where(eq(activities.id, activityId));

  console.log(`[Pipeline] Complete! Review ${review.id} created (${classification.classification})`);

  return {
    reviewId: review.id,
    classification: classification.classification,
    confidence: String(classification.confidence),
    subjectLine: classification.suggested_subject_line,
  };
}
