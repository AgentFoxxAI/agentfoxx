import { db } from "./db";
import { reviews, profiles } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Send an approved email via Power Automate or Microsoft Graph.
 *
 * Phase 3: Power Automate HTTP webhook
 * Phase 4: Will add Microsoft Graph per-rep OAuth
 */
export async function sendApprovedEmail(reviewId: number): Promise<{ success: boolean; message: string }> {
  // Look up review
  const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId));
  if (!review) throw new Error(`Review ${reviewId} not found`);
  if (review.status !== "approved") throw new Error(`Review ${reviewId} is not approved`);

  // Look up rep's profile for sender identity
  let senderName = "Telesign Team";
  let senderEmail = "";
  let senderSignature = "";

  if (review.userId) {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, review.userId));
    if (profile) {
      senderName = profile.name;
      senderEmail = profile.msEmail || profile.email;
      senderSignature = profile.signature || "";
    }
  }

  // Power Automate endpoint (if configured)
  const powerAutomateUrl = process.env.POWER_AUTOMATE_URL;

  if (powerAutomateUrl) {
    try {
      console.log(`[Email] Sending via Power Automate for review ${reviewId}`);

      const payload = {
        to: review.contactEmail,
        subject: review.subjectLine || "Following up from our conversation",
        body: review.emailBody,
        senderName,
        senderEmail,
        senderSignature,
        contactName: review.contactName,
        company: review.company,
        classification: review.classification,
        attachmentName: review.whitePaper || null,
      };

      const response = await fetch(powerAutomateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "no body");
        console.error(`[Email] Power Automate failed: ${response.status} - ${text}`);
        return {
          success: false,
          message: `Email service returned ${response.status}. The approval was saved but the email may not have been sent.`,
        };
      }

      console.log(`[Email] Power Automate succeeded for review ${reviewId}`);
      return { success: true, message: "Email approved and sent successfully." };
    } catch (err: any) {
      console.error(`[Email] Power Automate error: ${err.message}`);
      return {
        success: false,
        message: `Could not reach email service: ${err.message}. The approval was saved.`,
      };
    }
  }

  // TODO (Phase 4): Microsoft Graph per-rep OAuth
  // if (profile.msRefreshToken) { ... }

  // No email service configured — just log it
  console.log(`[Email] No email service configured. Review ${reviewId} approved but email not sent.`);
  return {
    success: true,
    message: "Email approved. No email service configured yet — email will need to be sent manually.",
  };
}
