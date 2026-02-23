import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  Download,
  Settings,
  Key,
  TestTube,
  Rocket,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Terminal,
  ExternalLink,
  Database,
  Info,
  Plug,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const deploymentSteps = [
  {
    phase: "Phase 1",
    title: "Environment Setup",
    icon: Download,
    time: "30 minutes",
    steps: [
      {
        title: "Install n8n",
        description:
          "Deploy n8n using Docker or npm. For Docker, run: docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n. For npm, run: npx n8n. Access the editor at http://localhost:5678.",
      },
      {
        title: "Create a Calendly Account",
        description:
          "Sign up for Calendly (free tier works for testing). Create an event type for 'Conference Follow-up Meeting' with your preferred duration and availability.",
      },
      {
        title: "Prepare White Paper Library",
        description:
          "Organize your white papers into a folder structure mapped to themes. For example: /white-papers/fraud-prevention.pdf, /white-papers/cloud-optimization.pdf. Upload these to a cloud storage service (Google Drive, S3) accessible via URL.",
      },
    ],
  },
  {
    phase: "Phase 2",
    title: "API Credentials",
    icon: Key,
    time: "15 minutes",
    steps: [
      {
        title: "OpenAI API Key",
        description:
          "Generate an API key from platform.openai.com. The GPT-4 model is recommended for accurate theme extraction. Store the key securely — it will be added to n8n credentials.",
      },
      {
        title: "Calendly API Token",
        description:
          "In Calendly Settings → Integrations, generate a Personal Access Token. This token allows n8n to listen for booking events and access scheduling data.",
      },
      {
        title: "Microsoft Outlook Credentials",
        description:
          "Register an application in Azure Active Directory (Azure AD). Under API Permissions, add Microsoft Graph → Mail.ReadWrite and Mail.Send (delegated). Create a client secret and note the Application (Client) ID, Directory (Tenant) ID, and Client Secret. In n8n, create a 'Microsoft Outlook OAuth2' credential with these values.",
      },
    ],
  },
  {
    phase: "Phase 3",
    title: "n8n Workflow Configuration",
    icon: Settings,
    time: "35 minutes",
    steps: [
      {
        title: "Step 3.1 — Create the Main Workflow & Webhook Trigger",
        description:
          "In n8n, click 'Add workflow' to create a new workflow. Drag a Webhook node onto the canvas. Set HTTP Method to POST. n8n will generate a unique webhook URL (e.g., https://your-n8n.com/webhook/abc123). Copy this URL — you will paste it into the microsite form's action endpoint. The webhook receives JSON with fields: contactName, contactEmail, company, and conversationNotes.",
      },
      {
        title: "Step 3.2 — Add the OpenAI Node for Theme Extraction",
        description:
          "Connect an OpenAI node after the Webhook. Select your OpenAI credential and set Model to 'gpt-4'. In the System Prompt field, paste: 'Analyze the following conversation notes from a conference interaction. Extract and return a JSON object with: themes (array of 1–3 key topics), white_paper_topic (single best match), email_subject (personalized subject line), email_body (3–4 paragraph HTML follow-up email), urgency (1–5 score), sentiment (positive/neutral/cautious).' In the User Message field, use the expression: {{ $json.conversationNotes }} to pass the webhook data.",
      },
    ],
  },
  {
    phase: "Phase 4",
    title: "Connect Integrations",
    icon: Plug,
    time: "20 minutes",
    steps: [
      {
        title: "Microsoft Outlook Node",
        description:
          "Add a Microsoft Outlook node after the OpenAI node. Use the 'Create Draft' operation. Set the To field to {{ $json.contactEmail }}, Subject to {{ $json.aiOutput.email_subject }}, and Body to {{ $json.aiOutput.email_body }}. Add a Message Attachment resource to attach the white paper PDF.",
      },
      {
        title: "Calendly Link Embedding",
        description:
          "In the email body template, append your Calendly booking URL. Use a Set node before the Outlook node to construct the full HTML body, combining the AI-generated content with your static Calendly link (e.g., https://calendly.com/your-name/conference-followup).",
      },
      {
        title: "Dashboard Webhook Node",
        description:
          "Add a final HTTP Request node that POSTs the conversation summary (contactName, company, themes, emailSent: true) back to your dashboard's data API endpoint. This keeps the activity log in sync.",
      },
    ],
  },
  {
    phase: "Phase 5",
    title: "Testing & Validation",
    icon: TestTube,
    time: "20 minutes",
    steps: [
      {
        title: "End-to-End Test",
        description:
          "Submit a test conversation through the microsite form. Verify that: (1) the n8n workflow triggers, (2) themes are correctly extracted, (3) a draft email appears in your queue with the right white paper and Calendly link, and (4) the dashboard reflects the new activity.",
      },
      {
        title: "Calendly Booking Test",
        description:
          "Click the Calendly link in the test email and book a meeting. Verify that the booking workflow triggers and the dashboard 'Meetings Booked' counter increments.",
      },
      {
        title: "Error Handling",
        description:
          "Test edge cases: duplicate emails, missing fields, API rate limits. Add Error Trigger nodes in n8n to catch failures and send Slack/email notifications to the admin.",
      },
    ],
  },
  {
    phase: "Phase 6",
    title: "Pre-Conference Deployment",
    icon: Rocket,
    time: "20 minutes",
    steps: [
      {
        title: "Deploy n8n to Production",
        description:
          "For production, deploy n8n to a cloud server (AWS, GCP, or DigitalOcean) with Docker Compose. Use a reverse proxy (Nginx) for HTTPS and set N8N_BASIC_AUTH_ACTIVE=true for security.",
      },
      {
        title: "Deploy the Microsite",
        description:
          "The dashboard microsite can be deployed as a static site. Update the webhook URL in the form to point to your production n8n instance.",
      },
      {
        title: "Pre-Conference Checklist",
        description:
          "Verify all API credentials are active. Test the full pipeline one more time. Ensure your white paper library is complete. Share the microsite URL with your team. Brief team members on how to submit conversation notes.",
      },
    ],
  },
];

const sfSteps = [
  {
    title: "Create a Salesforce Connected App",
    description:
      "In Salesforce Setup, navigate to App Manager and create a new Connected App. Enable OAuth settings with the scopes: 'api', 'refresh_token', and 'offline_access'. Save the Consumer Key and Consumer Secret for n8n.",
  },
  {
    title: "Add Salesforce Node to Main Workflow",
    description:
      "In your existing n8n main workflow, insert a Salesforce node between the OpenAI node and the Email node. First, use a 'Search' operation to check if the contact email already exists. Then use an IF node to branch: if found, use 'Update' to enrich the existing lead; if not found, use 'Create' to add a new lead.",
  },
  {
    title: "Add Custom Fields to Lead Object",
    description:
      "Create custom fields on the Salesforce Lead object: Conference_Themes__c (Text 255), White_Paper_Sent__c (Text 255), Follow_Up_Email_Sent__c (Checkbox), Meeting_Booked__c (Checkbox), Meeting_Time__c (Date/Time), and Conference_Name__c (Text 100).",
  },
  {
    title: "Extend the Calendly Booking Workflow",
    description:
      "Add a Salesforce Update node to the existing Calendly booking workflow. This updates the lead record with the meeting time and sets Meeting_Booked__c to true when a contact books through the Calendly link.",
  },
  {
    title: "Test the CRM Integration",
    description:
      "Run a full end-to-end test to verify: lead search and deduplication works correctly, new leads are created with all fields populated, existing leads are enriched (not duplicated), and Calendly bookings update the correct lead record.",
  },
];

const prerequisites = [
  { item: "n8n instance (self-hosted or cloud)", required: true },
  { item: "Calendly account (free or paid)", required: true },
  { item: "OpenAI API key (GPT-4 recommended)", required: true },
  { item: "Microsoft 365 account with Outlook", required: true },
  { item: "White paper PDF library", required: true },
  { item: "Cloud hosting for n8n (AWS, GCP, etc.)", required: false },
  { item: "Custom domain for the microsite", required: false },
  { item: "Salesforce org with API access", required: false, sfdc: true },
];

export default function Guide() {
  return (
    <Layout>
      <div className="container py-10 lg:py-14">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">Step-by-Step Guide</p>
          <h1
            className="font-serif text-3xl lg:text-4xl mb-5"
            style={{ color: "oklch(0.95 0.005 265)" }}
          >
            Deployment guide
          </h1>
          <p
            className="text-lg leading-relaxed"
            style={{ color: "oklch(0.52 0.02 265)" }}
          >
            This guide walks you through setting up the Conference Networking
            Agent from scratch. The core deployment takes approximately{" "}
            <strong style={{ color: "oklch(0.80 0.01 265)" }}>2 hours</strong>{" "}
            and covers the full pipeline — AI theme extraction, email
            follow-ups, Calendly scheduling, and the analytics dashboard.
            Salesforce CRM integration is available as a separate add-on phase
            when you're ready.
          </p>
        </div>

        {/* SFDC Notice */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
          className="mb-8"
        >
          <div
            className="glass flex items-start gap-4 p-5"
            style={{
              borderColor: "oklch(0.78 0.14 75 / 0.2)",
              background: "oklch(0.78 0.14 75 / 0.04)",
            }}
          >
            <div className="icon-wrap-amber flex-shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3
                className="font-semibold text-sm mb-1.5"
                style={{ color: "oklch(0.90 0.005 265)" }}
              >
                Salesforce integration is excluded from the core deployment
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "oklch(0.50 0.02 265)" }}>
                SFDC access can be challenging to obtain and configure. The
                core pipeline works fully without it — conversations are
                captured, themes are extracted, emails are drafted, and
                meetings are scheduled. When Salesforce access is confirmed,
                you can add CRM integration as a bolt-on phase without
                modifying the existing workflow.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Time Estimate */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={1}
          className="mb-10"
        >
          <div className="glass p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="icon-wrap">
                <Clock className="w-4 h-4" />
              </div>
              <h3
                className="font-semibold text-sm"
                style={{ color: "oklch(0.88 0.01 265)" }}
              >
                Core Deployment Time: ~2 hours
              </h3>
            </div>
            <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {deploymentSteps.map((step) => (
                <div key={step.phase}>
                  <p
                    className="text-[10px] mb-0.5"
                    style={{ color: "oklch(0.40 0.02 265)" }}
                  >
                    {step.phase}
                  </p>
                  <p
                    className="text-xs font-medium"
                    style={{ color: "oklch(0.72 0.18 275)" }}
                  >
                    {step.time}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Prerequisites */}
        <div className="mb-12">
          <h2
            className="font-serif text-xl mb-5"
            style={{ color: "oklch(0.95 0.005 265)" }}
          >
            Prerequisites
          </h2>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {prerequisites.map((prereq) => (
              <div
                key={prereq.item}
                className="flex items-center gap-2.5 text-sm py-2 px-3 rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                {prereq.required ? (
                  <CheckCircle2
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: "oklch(0.65 0.22 275)" }}
                  />
                ) : (
                  <AlertCircle
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: "oklch(0.35 0.02 265)" }}
                  />
                )}
                <span
                  className="text-xs"
                  style={{
                    color: prereq.required
                      ? "oklch(0.78 0.01 265)"
                      : "oklch(0.42 0.02 265)",
                  }}
                >
                  {prereq.item}
                </span>
                {!prereq.required && (
                  <span className="badge-amber ml-auto">
                    {(prereq as any).sfdc ? "Future" : "Optional"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="divider-glow mb-12" />

        {/* Deployment Steps */}
        <div className="space-y-12">
          {deploymentSteps.map((phase, phaseIdx) => (
            <motion.div
              key={phase.phase}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              custom={phaseIdx}
            >
              {/* Phase header */}
              <div className="flex items-center gap-4 mb-5">
                <div className="icon-wrap w-10 h-10">
                  <phase.icon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1">
                  <p
                    className="eyebrow text-[10px] mb-0.5"
                    style={{ fontSize: "0.6rem", letterSpacing: "0.12em" }}
                  >
                    {phase.phase}
                  </p>
                  <h2
                    className="font-serif text-xl"
                    style={{ color: "oklch(0.93 0.005 265)" }}
                  >
                    {phase.title}
                  </h2>
                </div>
                <span className="badge-indigo">
                  <Clock className="w-2.5 h-2.5" />
                  {phase.time}
                </span>
              </div>

              {/* Steps */}
              <div className="space-y-3 ml-14">
                {phase.steps.map((step, stepIdx) => (
                  <div
                    key={stepIdx}
                    className="glass-subtle p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                        style={{
                          background: "oklch(0.65 0.22 275 / 0.12)",
                          border: "1px solid oklch(0.65 0.22 275 / 0.25)",
                          color: "oklch(0.65 0.22 275)",
                        }}
                      >
                        {stepIdx + 1}
                      </span>
                      <div>
                        <h3
                          className="font-semibold text-sm mb-1.5"
                          style={{ color: "oklch(0.88 0.005 265)" }}
                        >
                          {step.title}
                        </h3>
                        <p
                          className="text-xs leading-relaxed"
                          style={{ color: "oklch(0.48 0.02 265)" }}
                        >
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Salesforce Future Phase */}
        <div className="divider-glow my-14" />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="icon-wrap-amber w-10 h-10">
              <Database className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1">
              <p
                className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-0.5"
                style={{ color: "oklch(0.78 0.14 75)" }}
              >
                Future Phase — When SFDC Access is Confirmed
              </p>
              <h2
                className="font-serif text-xl"
                style={{ color: "oklch(0.93 0.005 265)" }}
              >
                Salesforce CRM Integration
              </h2>
            </div>
            <span className="badge-amber">
              <Clock className="w-2.5 h-2.5" />
              ~30 min
            </span>
          </div>

          <p
            className="text-xs leading-relaxed ml-14 mb-6"
            style={{ color: "oklch(0.48 0.02 265)" }}
          >
            This phase adds Salesforce lead management to the existing pipeline.
            It plugs into the n8n workflows you've already built — no existing
            nodes need to be removed or reconfigured.
          </p>

          <div className="space-y-3 ml-14">
            {sfSteps.map((step, stepIdx) => (
              <div
                key={stepIdx}
                className="glass p-4"
                style={{
                  borderColor: "oklch(0.78 0.14 75 / 0.15)",
                  background: "oklch(0.78 0.14 75 / 0.03)",
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                    style={{
                      background: "oklch(0.78 0.14 75 / 0.12)",
                      border: "1px solid oklch(0.78 0.14 75 / 0.25)",
                      color: "oklch(0.78 0.14 75)",
                    }}
                  >
                    {stepIdx + 1}
                  </span>
                  <div>
                    <h3
                      className="font-semibold text-sm mb-1.5"
                      style={{ color: "oklch(0.88 0.005 265)" }}
                    >
                      {step.title}
                    </h3>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "oklch(0.48 0.02 265)" }}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* n8n JSON Note */}
        <div className="mt-14">
          <div className="glass p-6">
            <div className="flex items-start gap-4">
              <div className="icon-wrap w-10 h-10 flex-shrink-0">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3
                  className="font-semibold text-sm mb-2"
                  style={{ color: "oklch(0.90 0.005 265)" }}
                >
                  n8n Workflow Template
                </h3>
                <p
                  className="text-xs leading-relaxed mb-4"
                  style={{ color: "oklch(0.50 0.02 265)" }}
                >
                  The n8n workflow can be exported as a JSON file and imported
                  into any n8n instance. The template includes the main
                  follow-up workflow and the Calendly booking workflow. After
                  importing, you only need to update the credential connections.
                </p>
                <div
                  className="flex items-center gap-2 text-xs p-3 rounded-lg font-mono"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <Terminal
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: "oklch(0.65 0.22 275)" }}
                  />
                  <code style={{ color: "oklch(0.65 0.22 275)" }}>
                    n8n import:workflow --input=conference-agent-workflow.json
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="mt-10">
          <h2
            className="font-serif text-xl mb-5"
            style={{ color: "oklch(0.93 0.005 265)" }}
          >
            Useful Resources
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "n8n Documentation", url: "https://docs.n8n.io" },
              { label: "Calendly API Docs", url: "https://developer.calendly.com" },
              { label: "OpenAI API Reference", url: "https://platform.openai.com/docs" },
              { label: "n8n Microsoft Outlook Node", url: "https://n8n.io/integrations/microsoft-outlook/" },
              { label: "n8n Community Templates", url: "https://n8n.io/workflows/" },
              { label: "Azure AD App Registration Guide", url: "https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app" },
              { label: "n8n Salesforce Node (future phase)", url: "https://n8n.io/integrations/salesforce/" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs p-3 rounded-lg no-underline transition-all duration-200 group"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "oklch(0.50 0.02 265)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "oklch(0.65 0.22 275 / 0.25)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "oklch(0.65 0.22 275)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "oklch(0.50 0.02 265)";
                }}
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
