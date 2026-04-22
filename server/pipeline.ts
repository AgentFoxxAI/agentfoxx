/**
 * AgentFoxx AI Pipeline — v2
 *
 * Single-call architecture:
 *   Audio → Whisper transcription
 *         → Vector search over collateral (top-5 matches)
 *         → Single Claude Sonnet 4.6 call with structured output:
 *            - classify the lead (5 categories + confidence)
 *            - select best-fit solution brief from top-5 candidates
 *            - draft the email in Juan Rivera's voice
 *         → Insert review
 *
 * Replaces n8n + separate classify/draft calls with one round-trip.
 * Uses prompt caching on the system prompt for 90% cost reduction on repeat runs.
 */
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "./db";
import { reviews, activities, eventCollateral } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { Profile, Event } from "@shared/schema";

// ── Clients (lazy-loaded so server can start without keys) ──────────

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required for Whisper transcription and embeddings. Set it in .env.",
    );
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required for Claude classification + drafting. Set it in .env.",
    );
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ── Types ───────────────────────────────────────────────────────────

type Classification =
  | "qualified_lead"
  | "content_nurture"
  | "partnership_opportunity"
  | "relationship_building"
  | "needs_clarification";

const LeadAnalysisSchema = z.object({
  classification: z.enum([
    "qualified_lead",
    "content_nurture",
    "partnership_opportunity",
    "relationship_building",
    "needs_clarification",
  ]),
  confidence: z.number().min(0).max(1),
  selected_brief_id: z.number().nullable().describe(
    "The id of the most relevant collateral from the candidates provided. Return null if no brief truly fits.",
  ),
  key_insights: z.string().describe(
    "One or two sentences summarizing what this contact cares about — buying signals, pain points, or next steps they mentioned.",
  ),
  subject_line: z.string().describe(
    "Email subject line — short, warm, references the event by name if relevant. Max ~60 chars.",
  ),
  email_body: z.string().describe(
    "The full email body in Juan Rivera's voice. No Subject: line. No signature — that's appended separately. Start with a greeting.",
  ),
  reasoning: z.string().describe(
    "One sentence explaining why this classification and brief were chosen.",
  ),
});

type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>;

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
  briefName: string | null;
}

// ── Step 1: Whisper transcription ───────────────────────────────────

async function transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const openai = getOpenAI();
  const ext = mimeType.includes("mp4")
    ? "mp4"
    : mimeType.includes("mp3") || mimeType.includes("mpeg")
      ? "mp3"
      : "webm";
  const file = new File([audioBuffer], `recording.${ext}`, { type: mimeType });

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "en",
    // Prompt helps Whisper spell domain terms correctly
    prompt:
      "Telesign, Identiverse, Ping Identity, Okta, MFA, IRSF, SIM swap, account takeover, ATO, CIAM, KYC.",
  });

  return response.text;
}

// ── Step 2: Embed query + vector search ─────────────────────────────

async function findRelevantCollateral(
  eventId: number,
  queryText: string,
  limit = 5,
): Promise<Array<{ id: number; name: string; filename: string | null; description: string | null; similarity: number }>> {
  const openai = getOpenAI();

  // Embed the transcription + notes to use as search query
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: queryText,
    encoding_format: "float",
  });
  const queryEmbedding = `[${embeddingResponse.data[0].embedding.join(",")}]`;

  // Raw SQL for pgvector similarity — cosine distance (1 - similarity)
  const result = await db.execute<{
    id: number;
    name: string;
    filename: string | null;
    description: string | null;
    similarity: string;
  }>(sql`
    SELECT id, name, filename, description,
           (1 - (embedding <=> ${queryEmbedding}::vector))::text AS similarity
    FROM event_collateral
    WHERE event_id = ${eventId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT ${limit}
  `);

  return (result.rows as any[]).map((r) => ({
    id: Number(r.id),
    name: r.name,
    filename: r.filename,
    description: r.description,
    similarity: parseFloat(r.similarity),
  }));
}

// ── Step 3: Single Claude call — classify + select brief + draft email ─

const SYSTEM_PROMPT = `You are Juan Rivera's AI sales assistant. Your job is to analyze a post-conversation voice memo from a conference booth and produce a structured follow-up: classification, best-fit solution brief, and a personalized email.

# Juan Rivera Voice Model

Juan is a Partner Account Director at Telesign covering U.S. and LATAM. Write emails in his voice:

**Tone & feel:**
- Polished, natural, measured, professional, human
- Commercially sharp, relationship-oriented, operationally credible
- Direct but courteous, confident but not pushy
- Never apologetic, never tentative, never pleading

**Structure (HARD RULES):**
- MAX 2 paragraphs for the email body — no exceptions, whether hot lead, nurture, or relationship
- Short paragraphs with hard returns between them
- Max 2 sentences per paragraph
- Cadence: acknowledgement → context or value → next step → polite close
- No em dashes (—). Use commas or periods instead.
- No corporate buzzwords. No excessive exclamation marks.
- No "[Your Name]" placeholder. No closing salutation ("Warm regards", "Best regards", etc.). The system appends the signature automatically.

**Openers (use or riff on these):**
- "Good connecting at [Event Name]."
- "Appreciate the conversation earlier."
- "Thanks for the chat at the booth."

**Transitions:**
- "From our side,"
- "On our end,"
- "That said,"
- "At this stage,"

**Action phrases:**
- "Let's plan for [specific next step]"
- "Happy to [walk through / share / schedule]"
- "Please let me know where you land on that."
- "Open to discussing if helpful."

**Phrases to AVOID (Juan never uses these):**
- "just checking in", "just wanted to follow up", "just thought I'd"
- "sorry to bother you", "apologies for the inconvenience"
- "I was wondering if", "if you have a moment"
- "no worries if not", "whenever you get a chance"
- "I hope this makes sense"

**Preferred alternatives:**
- "Following up on the note below."
- "Circling back on this."
- "Before we proceed,"
- "The cleanest path forward would be"

# Classification Categories

- **qualified_lead** — Budget/timeline mentioned, clear buying intent, decision maker. Write an urgent, specific-next-step email.
- **content_nurture** — Interested but early stage, asked for resources. Write a helpful, consultative email.
- **partnership_opportunity** — Integration or partner discussion, not a sales deal. Write a collaborative email.
- **relationship_building** — General networking, recruiter, competitor, vague connection. Write a warm, low-pressure stay-in-touch email.
- **needs_clarification** — Audio unclear, ambiguous intent, missing details. Write a very short, open-ended note.

# Output Format

You must return structured JSON matching the schema exactly. No prose outside the JSON.

- \`classification\`: one of the 5 categories
- \`confidence\`: 0.0 to 1.0
- \`selected_brief_id\`: the integer id of the most relevant solution brief from the candidates provided in the user message. Return null if nothing truly fits.
- \`key_insights\`: 1-2 sentences summarizing their pain point or interest
- \`subject_line\`: short, warm, references the event if relevant (max ~60 chars)
- \`email_body\`: the full email in Juan's voice — greeting + max 2 paragraphs, no signature, no closing salutation
- \`reasoning\`: one sentence on why you chose this classification and brief`;

async function analyzeLead(params: {
  transcription: string;
  contactName: string;
  company: string;
  notes: string;
  eventName: string;
  candidateBriefs: Array<{ id: number; name: string; description: string | null }>;
}): Promise<LeadAnalysis> {
  const anthropic = getAnthropic();

  const candidateList = params.candidateBriefs.length
    ? params.candidateBriefs
        .map(
          (b) =>
            `- id=${b.id}: **${b.name}** — ${b.description || "no description"}`,
        )
        .join("\n")
    : "(no collateral configured for this event)";

  const userMessage = `# Lead Context

**Contact:** ${params.contactName} at ${params.company}
**Event:** ${params.eventName}
**Extra notes from rep:** ${params.notes || "(none)"}

# Top Solution Brief Candidates (semantic match to the transcription)

${candidateList}

# Voice Memo Transcription

${params.transcription}

---

Analyze and return the structured JSON.`;

  const response = await anthropic.messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Prompt caching — the system prompt never changes, so we get 90% discount on repeats
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            classification: {
              type: "string",
              enum: [
                "qualified_lead",
                "content_nurture",
                "partnership_opportunity",
                "relationship_building",
                "needs_clarification",
              ],
            },
            confidence: { type: "number" },
            selected_brief_id: { type: ["integer", "null"] },
            key_insights: { type: "string" },
            subject_line: { type: "string" },
            email_body: { type: "string" },
            reasoning: { type: "string" },
          },
          required: [
            "classification",
            "confidence",
            "selected_brief_id",
            "key_insights",
            "subject_line",
            "email_body",
            "reasoning",
          ],
          additionalProperties: false,
        },
        strict: true,
      } as any,
    } as any,
  });

  // Parse the output — Anthropic returns it in content[0].text as JSON
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block");
  }

  const parsed = LeadAnalysisSchema.parse(JSON.parse(textBlock.text));

  // Log cache efficiency for observability
  const usage = response.usage as any;
  if (usage.cache_read_input_tokens > 0) {
    console.log(
      `[Pipeline] Cache hit: ${usage.cache_read_input_tokens} tokens read, ${usage.input_tokens} uncached`,
    );
  } else if (usage.cache_creation_input_tokens > 0) {
    console.log(
      `[Pipeline] Cache primed: ${usage.cache_creation_input_tokens} tokens cached`,
    );
  }

  return parsed;
}

// ── Main Pipeline ───────────────────────────────────────────────────

export async function processLead(input: PipelineInput): Promise<PipelineResult> {
  const {
    activityId,
    audioBuffer,
    audioMimeType,
    contactName,
    contactEmail,
    company,
    notes,
    userId,
    eventId,
    event,
    profile,
  } = input;
  const eventName = event?.name || "the conference";

  console.log(`[Pipeline] Start: activity ${activityId}, ${contactName} at ${company}`);

  // Step 1: Transcribe
  console.log(`[Pipeline] Transcribing audio (${(audioBuffer.length / 1024).toFixed(0)}KB)...`);
  const transcription = await transcribe(audioBuffer, audioMimeType);
  console.log(`[Pipeline] Transcription: ${transcription.substring(0, 120)}...`);

  await db.update(activities).set({ transcript: transcription }).where(eq(activities.id, activityId));

  // Step 2: Vector search over collateral (top 5 candidates)
  let candidateBriefs: Array<{ id: number; name: string; filename: string | null; description: string | null; similarity: number }> = [];
  if (eventId) {
    const queryText = `${transcription}\n\nContact context: ${notes || ""}`;
    candidateBriefs = await findRelevantCollateral(eventId, queryText, 5);
    console.log(
      `[Pipeline] Top brief candidates: ${candidateBriefs
        .map((c) => `${c.name} (${c.similarity.toFixed(2)})`)
        .join(", ")}`,
    );
  }

  // Step 3: Single Claude call — classify + select + draft
  console.log(`[Pipeline] Calling Claude Sonnet 4.6 (classify + draft)...`);
  const analysis = await analyzeLead({
    transcription,
    contactName,
    company,
    notes,
    eventName,
    candidateBriefs,
  });
  console.log(
    `[Pipeline] Classification: ${analysis.classification} (${analysis.confidence.toFixed(2)})`,
  );

  // Resolve the selected brief
  const selectedBrief = analysis.selected_brief_id
    ? candidateBriefs.find((b) => b.id === analysis.selected_brief_id)
    : null;
  const briefName = selectedBrief?.name || null;
  const briefFilename = selectedBrief?.filename || null;
  if (selectedBrief) {
    console.log(`[Pipeline] Selected brief: ${selectedBrief.name}`);
  }

  // Append rep's signature
  let emailBody = analysis.email_body;
  const signature = profile.signature?.trim();
  if (signature) {
    emailBody += `\n\n${signature}`;
  } else {
    // Sensible default from profile fields
    const lines = [
      "",
      "Best regards,",
      "",
      profile.name,
      profile.title,
      "Telesign",
      profile.phone ? `Mobile: ${profile.phone}` : null,
    ].filter(Boolean) as string[];
    emailBody += "\n" + lines.join("\n");
  }

  // Step 4: Create review
  const [review] = await db
    .insert(reviews)
    .values({
      userId,
      eventId,
      contactName,
      contactEmail,
      company: company || "Unknown",
      classification: analysis.classification,
      confidence: String(analysis.confidence),
      whitePaper: briefFilename,
      subjectLine: analysis.subject_line,
      emailBody,
      transcription,
      keyInsights: analysis.key_insights,
      status: "pending_approval",
      timestamp: new Date().toISOString(),
    })
    .returning();

  // Update activity
  await db
    .update(activities)
    .set({
      status: "completed",
      theme: analysis.classification,
      emailDraft: emailBody,
    })
    .where(eq(activities.id, activityId));

  console.log(
    `[Pipeline] Done. Review ${review.id} created (${analysis.classification}${briefName ? `, brief: ${briefName}` : ""})`,
  );

  return {
    reviewId: review.id,
    classification: analysis.classification,
    confidence: String(analysis.confidence),
    subjectLine: analysis.subject_line,
    briefName,
  };
}
