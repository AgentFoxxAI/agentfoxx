import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import {
  Workflow,
  Calendar,
  Database,
  Brain,
  Mail,
  CheckCircle2,
  ArrowRight,
  Zap,
  Globe,
  Shield,
  Info,
  ArrowLeftRight,
  TrendingUp,
  Repeat,
  Code2,
  Server,
  FileCode,
  RefreshCw,
} from "lucide-react";

const WORKFLOW_IMG =
  "https://private-us-east-1.manuscdn.com/sessionFile/o5acm8r6Ps43bNojNMPrje/sandbox/OU4rDtVMv3Ir7hSHOM0toR-img-4_1771448548000_na1fn_d29ya2Zsb3ctaWxsdXN0cmF0aW9u.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbzVhY204cjZQczQzYk5vak5NUHJqZS9zYW5kYm94L09VNHJEdFZNdjNJcjdoU0hPTTB0b1ItaW1nLTRfMTc3MTQ0ODU0ODAwMF9uYTFmbl9kMjl5YTJac2IzY3RhV3hzZFhOMGNtRjBhVzl1LnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=A1fI2o41jd-N0~r~yxonEzLf4ngqZeE7172lQG4-N4x7pnFcY~6auNzQFD9iyevGVc8PbOg1oRuW3TI9hzjSbr5PuOP9BA0kqelYKvFQfnyDRtABPAVtIArlhj4ba032XH3MMpzAFv7w11nLxgSI~QSFKm4J5XJddWDOS2tnPE7IMO59TO~6XW2wzn5yp9Emg2kbVuSIYgHedms-jKVb4rW43AV3ojGrlMsZLtZlwdvnEr2C576~JkozfXgSJpEXYGsgo97leHhlftQbIz1TwXisGEIDpfSnPg0kGVHeyZVoHFro-XFFPpJlGIaBwH9rg3AH7KoDPk3SolEClxr~EQ__";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const coreIntegrations = [
  {
    name: "n8n",
    role: "Workflow Orchestrator",
    icon: Workflow,
    description:
      "n8n is the central automation engine that connects every component of the system. It receives conversation data via webhooks, routes it through the AI processing pipeline, triggers email sends, and updates the dashboard. Its visual workflow builder makes it easy to modify the pipeline without writing code — and to add new integrations (like Salesforce) later.",
    capabilities: [
      "Webhook triggers for form submissions",
      "OpenAI node for theme extraction",
      "Microsoft Outlook node for email drafting",
      "HTTP Request node for dashboard updates",
      "Extensible with 800+ native integrations",
    ],
  },
  {
    name: "Calendly",
    role: "Meeting Scheduler",
    icon: Calendar,
    description:
      "Calendly handles the scheduling complexity. A personalized booking link is embedded in every follow-up email, allowing contacts to self-schedule meetings at mutually convenient times. When a meeting is booked, Calendly's webhook triggers a separate n8n workflow that updates the dashboard.",
    capabilities: [
      "Event Created trigger (User & Org scope)",
      "Event Cancelled trigger for re-engagement",
      "Custom booking links per event type",
      "Automatic calendar conflict detection",
    ],
  },
  {
    name: "OpenAI (GPT-4)",
    role: "AI Theme Extraction",
    icon: Brain,
    description:
      "The LLM analyzes raw conversation notes and extracts structured data: key discussion themes, sentiment, urgency level, and the most relevant white paper to send. It also generates the personalized email body, ensuring each follow-up feels hand-crafted rather than templated.",
    capabilities: [
      "Theme identification from unstructured text",
      "White paper matching based on topic relevance",
      "Personalized email body generation",
      "Sentiment and urgency scoring",
    ],
  },
  {
    name: "Microsoft Outlook",
    role: "Email Delivery",
    icon: Mail,
    description:
      "n8n's native Microsoft Outlook node creates email drafts directly in your Outlook Drafts folder for manual review before sending. Each draft includes the AI-generated personalized body, white paper attachment (via the Message Attachment resource), and an embedded Calendly booking link. Authentication uses Azure AD OAuth2 with Microsoft Graph permissions.",
    capabilities: [
      "Draft creation in Outlook Drafts folder",
      "White paper PDF attachment via Message Attachment",
      "Embedded Calendly scheduling link",
      "Send draft after manual review",
    ],
  },
];

const outreachIntegration = {
  name: "Outreach.io",
  role: "Multi-Touch Sales Engagement — Game Changer",
  icon: TrendingUp,
  description:
    "Outreach.io transforms the workflow from a single follow-up email into a multi-touch, multi-channel engagement engine. Instead of one draft, each contact is enrolled in a theme-specific sequence — a 5–7 step cadence spanning email, phone, and LinkedIn over 2–3 weeks. If the first email gets no reply, Outreach automatically escalates. Its AI classifies replies as positive, negative, or neutral, so your team only spends time on engaged contacts. The n8n workflow creates an Outreach prospect via API and enrolls them in the matching sequence — all through HTTP Request nodes since there's no native n8n Outreach node.",
  capabilities: [
    "Multi-touch sequences: 5–7 steps across email, call, LinkedIn",
    "Theme-specific cadences mapped to AI-detected conversation topics",
    "AI sentiment analysis on replies (positive / negative / neutral)",
    "Auto-pause for out-of-office, auto-resume on return",
    "Built-in A/B testing for subject lines and email bodies",
    "Native Salesforce sync when SFDC access is confirmed",
  ],
};

const outreachComparison = [
  { feature: "Follow-up emails per contact", current: "1 draft", enhanced: "5–7 step automated sequence" },
  { feature: "Channels", current: "Email only", enhanced: "Email + Call + LinkedIn" },
  { feature: "If no reply", current: "Manual decision", enhanced: "Automatic escalation" },
  { feature: "Analytics", current: "Emails drafted", enhanced: "Open, click, reply, bounce rates" },
  { feature: "A/B testing", current: "None", enhanced: "Subject lines & email bodies" },
  { feature: "OOO handling", current: "None", enhanced: "Auto-pause & resume" },
];

const futureIntegration = {
  name: "Salesforce",
  role: "CRM & Lead Management — Future Phase",
  icon: Database,
  description:
    "Salesforce integration slots into the existing n8n workflow as an additional node — no existing logic needs to change. After OpenAI extracts themes, a Salesforce node searches for the contact email. If found, it updates the existing lead; if not, it creates a new one with all conference context. A second Salesforce node in the Calendly booking workflow marks the lead as 'Meeting Booked' when a contact schedules.",
  capabilities: [
    "Lead search, create, and update via n8n Salesforce node",
    "Custom fields: themes, white paper sent, meeting booked",
    "Deduplication via email-based lead search",
    "Calendly booking triggers lead update automatically",
  ],
};

export default function HowItWorks() {
  return (
    <Layout>
      <div className="container py-10 lg:py-14">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">Architecture & Integrations</p>
          <h1
            className="font-serif text-3xl lg:text-4xl mb-5"
            style={{ color: "oklch(0.95 0.005 265)" }}
          >
            How it works
          </h1>
          <p
            className="text-lg leading-relaxed"
            style={{ color: "oklch(0.52 0.02 265)" }}
          >
            The agent connects five services into a seamless post-conference
            automation pipeline. Here's the architecture behind each
            integration and how they work together.
          </p>
        </div>

        {/* Rationale card */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="mb-14"
        >
          <div className="glass p-7">
            <div className="flex items-start gap-4">
              <div className="icon-wrap w-10 h-10 flex-shrink-0 mt-0.5">
                <Zap className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2
                  className="font-serif text-2xl mb-3"
                  style={{ color: "oklch(0.95 0.005 265)" }}
                >
                  Should you use Calendly and n8n for this?
                </h2>
                <p
                  className="text-sm leading-relaxed mb-3"
                  style={{ color: "oklch(0.52 0.02 265)" }}
                >
                  <strong style={{ color: "oklch(0.85 0.01 265)" }}>
                    Yes — they are an excellent fit for this workflow.
                  </strong>{" "}
                  Calendly and n8n together provide the exact capabilities this
                  agentic model requires. n8n acts as the orchestration layer,
                  connecting every service in the pipeline through its visual
                  workflow builder. It has native nodes for OpenAI, Microsoft
                  Outlook, Calendly, and Salesforce.
                </p>
                <p
                  className="text-sm leading-relaxed mb-3"
                  style={{ color: "oklch(0.52 0.02 265)" }}
                >
                  Calendly specifically handles the scheduling complexity that
                  would otherwise require significant custom development. Its
                  booking links can be dynamically generated and embedded in
                  follow-up emails, and its webhook triggers feed meeting data
                  back into n8n for dashboard updates.
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "oklch(0.52 0.02 265)" }}
                >
                  The alternative would be building custom scheduling logic,
                  calendar integrations, and conflict detection from scratch —
                  which would add weeks of development time for functionality
                  Calendly provides out of the box.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Section header */}
        <div className="mb-8">
          <h2
            className="font-serif text-2xl mb-1"
            style={{ color: "oklch(0.95 0.005 265)" }}
          >
            Integration Components
          </h2>
          <p className="text-xs" style={{ color: "oklch(0.45 0.02 265)" }}>
            Each service plays a specific role in the automation pipeline.
          </p>
        </div>

        {/* Integration cards */}
        <div className="space-y-5 mb-14">
          {coreIntegrations.map((integration, i) => (
            <motion.div
              key={integration.name}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-30px" }}
              variants={fadeUp}
              custom={i}
            >
              <div className="glass p-6 group hover:border-indigo/20 transition-all duration-300">
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="icon-wrap">
                        <integration.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3
                          className="font-semibold text-sm"
                          style={{ color: "oklch(0.92 0.005 265)" }}
                        >
                          {integration.name}
                        </h3>
                        <p
                          className="text-[10px]"
                          style={{ color: "oklch(0.45 0.02 265)" }}
                        >
                          {integration.role}
                        </p>
                      </div>
                    </div>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "oklch(0.50 0.02 265)" }}
                    >
                      {integration.description}
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-3"
                      style={{ color: "oklch(0.38 0.02 265)" }}
                    >
                      Key Capabilities
                    </p>
                    <ul className="space-y-2">
                      {integration.capabilities.map((cap) => (
                        <li
                          key={cap}
                          className="flex items-start gap-2 text-xs"
                          style={{ color: "oklch(0.50 0.02 265)" }}
                        >
                          <CheckCircle2
                            className="w-3 h-3 mt-0.5 flex-shrink-0"
                            style={{ color: "oklch(0.65 0.22 275)" }}
                          />
                          {cap}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Outreach.io — Game Changer */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-30px" }}
            variants={fadeUp}
            custom={coreIntegrations.length}
          >
            <div
              className="glass p-6 transition-all duration-300"
              style={{
                borderColor: "oklch(0.72 0.20 155 / 0.25)",
                background: "oklch(0.72 0.20 155 / 0.04)",
              }}
            >
              <div className="flex items-center gap-2 mb-5">
                <Zap
                  className="w-3.5 h-3.5"
                  style={{ color: "oklch(0.72 0.20 155)" }}
                />
                <span
                  className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-[0.08em] uppercase"
                  style={{
                    background: "oklch(0.72 0.20 155 / 0.12)",
                    border: "1px solid oklch(0.72 0.20 155 / 0.25)",
                    color: "oklch(0.72 0.20 155)",
                  }}
                >
                  Game Changer — Pending Access
                </span>
              </div>
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: "oklch(0.72 0.20 155 / 0.12)",
                        border: "1px solid oklch(0.72 0.20 155 / 0.2)",
                      }}
                    >
                      <outreachIntegration.icon
                        className="w-4 h-4"
                        style={{ color: "oklch(0.72 0.20 155)" }}
                      />
                    </div>
                    <div>
                      <h3
                        className="font-semibold text-sm"
                        style={{ color: "oklch(0.92 0.005 265)" }}
                      >
                        {outreachIntegration.name}
                      </h3>
                      <p
                        className="text-[10px]"
                        style={{ color: "oklch(0.72 0.20 155)" }}
                      >
                        {outreachIntegration.role}
                      </p>
                    </div>
                  </div>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "oklch(0.50 0.02 265)" }}
                  >
                    {outreachIntegration.description}
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-3"
                    style={{ color: "oklch(0.38 0.02 265)" }}
                  >
                    Key Capabilities
                  </p>
                  <ul className="space-y-2">
                    {outreachIntegration.capabilities.map((cap) => (
                      <li
                        key={cap}
                        className="flex items-start gap-2 text-xs"
                        style={{ color: "oklch(0.50 0.02 265)" }}
                      >
                        <CheckCircle2
                          className="w-3 h-3 mt-0.5 flex-shrink-0"
                          style={{ color: "oklch(0.72 0.20 155)" }}
                        />
                        {cap}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Comparison table */}
              <div className="mt-6 pt-5" style={{ borderTop: "1px solid oklch(0.72 0.20 155 / 0.12)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Repeat className="w-3.5 h-3.5" style={{ color: "oklch(0.72 0.20 155)" }} />
                  <p
                    className="text-[10px] font-semibold tracking-[0.12em] uppercase"
                    style={{ color: "oklch(0.72 0.20 155)" }}
                  >
                    Current vs. Outreach.io-Enhanced
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: "0" }}>
                    <thead>
                      <tr>
                        <th className="text-left py-2 px-3 font-semibold" style={{ color: "oklch(0.70 0.01 265)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Capability</th>
                        <th className="text-left py-2 px-3 font-semibold" style={{ color: "oklch(0.70 0.01 265)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Current (Outlook)</th>
                        <th className="text-left py-2 px-3 font-semibold" style={{ color: "oklch(0.72 0.20 155)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>With Outreach.io</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outreachComparison.map((row) => (
                        <tr key={row.feature}>
                          <td className="py-2 px-3" style={{ color: "oklch(0.55 0.02 265)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{row.feature}</td>
                          <td className="py-2 px-3" style={{ color: "oklch(0.45 0.02 265)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{row.current}</td>
                          <td className="py-2 px-3 font-medium" style={{ color: "oklch(0.72 0.20 155)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{row.enhanced}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Salesforce — Future */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-30px" }}
            variants={fadeUp}
            custom={coreIntegrations.length}
          >
            <div
              className="glass p-6 transition-all duration-300"
              style={{
                borderColor: "oklch(0.78 0.14 75 / 0.18)",
                background: "oklch(0.78 0.14 75 / 0.03)",
              }}
            >
              <div className="flex items-center gap-2 mb-5">
                <Info
                  className="w-3.5 h-3.5"
                  style={{ color: "oklch(0.78 0.14 75)" }}
                />
                <span className="badge-amber">
                  Future Phase — Add When SFDC Access Confirmed
                </span>
              </div>
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="icon-wrap-amber">
                      <futureIntegration.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3
                        className="font-semibold text-sm"
                        style={{ color: "oklch(0.92 0.005 265)" }}
                      >
                        {futureIntegration.name}
                      </h3>
                      <p
                        className="text-[10px]"
                        style={{ color: "oklch(0.45 0.02 265)" }}
                      >
                        {futureIntegration.role}
                      </p>
                    </div>
                  </div>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "oklch(0.50 0.02 265)" }}
                  >
                    {futureIntegration.description}
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-3"
                    style={{ color: "oklch(0.38 0.02 265)" }}
                  >
                    Key Capabilities
                  </p>
                  <ul className="space-y-2">
                    {futureIntegration.capabilities.map((cap) => (
                      <li
                        key={cap}
                        className="flex items-start gap-2 text-xs"
                        style={{ color: "oklch(0.50 0.02 265)" }}
                      >
                        <CheckCircle2
                          className="w-3 h-3 mt-0.5 flex-shrink-0"
                          style={{ color: "oklch(0.78 0.14 75)" }}
                        />
                        {cap}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Workflow image */}
        <div className="mb-16">
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            <img
              src={WORKFLOW_IMG}
              alt="Workflow diagram"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Data Flow */}
        <div className="mb-16">
          <h2
            className="font-serif text-2xl mb-6"
            style={{ color: "oklch(0.95 0.005 265)" }}
          >
            End-to-end data flow
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: "01",
                title: "Ingest",
                desc: "Conversation notes submitted via web form or mobile input",
                icon: Globe,
              },
              {
                step: "02",
                title: "Process",
                desc: "n8n routes notes to GPT-4 for theme extraction and email drafting",
                icon: Brain,
              },
              {
                step: "03",
                title: "Execute",
                desc: "Email queued for review, Calendly link embedded, dashboard updated",
                icon: Zap,
              },
              {
                step: "04",
                title: "Track",
                desc: "Dashboard updated in real-time with analytics and activity log",
                icon: Shield,
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="glass h-full p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className="font-serif text-3xl leading-none"
                      style={{ color: "oklch(0.65 0.22 275 / 0.2)" }}
                    >
                      {item.step}
                    </span>
                    <ArrowRight
                      className="w-3 h-3"
                      style={{ color: "oklch(0.30 0.02 265)" }}
                    />
                  </div>
                  <div className="icon-wrap mb-4">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <h3
                    className="font-semibold text-sm mb-1.5"
                    style={{ color: "oklch(0.90 0.005 265)" }}
                  >
                    {item.title}
                  </h3>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "oklch(0.48 0.02 265)" }}
                  >
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Integration Bridge */}
        <div className="mb-12">
          <div className="max-w-3xl mb-10">
            <p className="eyebrow mb-4">Integration Bridge</p>
            <h2
              className="font-serif text-2xl lg:text-3xl mb-3"
              style={{ color: "oklch(0.95 0.005 265)" }}
            >
              How n8n connects back to this microsite
            </h2>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "oklch(0.52 0.02 265)" }}
            >
              The microsite and n8n are connected by{" "}
              <strong style={{ color: "oklch(0.80 0.01 265)" }}>
                two HTTP bridges
              </strong>{" "}
              — one in each direction. Right now the dashboard uses demo data.
              To make it live, you replace exactly two things: the form
              submission URL and the dashboard data source.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mb-10">
            {/* Direction 1 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
            >
              <div
                className="glass h-full p-6"
                style={{ borderColor: "oklch(0.65 0.22 275 / 0.15)" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="icon-wrap w-10 h-10">
                    <ArrowRight className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3
                      className="font-semibold text-sm"
                      style={{ color: "oklch(0.90 0.005 265)" }}
                    >
                      Direction 1: Microsite → n8n
                    </h3>
                    <p
                      className="text-[10px]"
                      style={{ color: "oklch(0.45 0.02 265)" }}
                    >
                      Form submission triggers the workflow
                    </p>
                  </div>
                </div>
                <p
                  className="text-xs leading-relaxed mb-4"
                  style={{ color: "oklch(0.50 0.02 265)" }}
                >
                  When someone fills out the "Log a Conversation" form and
                  clicks submit, the form sends a POST request to your n8n
                  webhook URL — the trigger that starts the entire automation
                  pipeline.
                </p>
                <div
                  className="rounded-xl p-4 mb-4"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <p
                    className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2"
                    style={{ color: "oklch(0.38 0.02 265)" }}
                  >
                    What you change in the code
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "oklch(0.50 0.02 265)" }}
                  >
                    In{" "}
                    <code
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "oklch(0.65 0.22 275)",
                      }}
                    >
                      Home.tsx
                    </code>
                    , replace the mock{" "}
                    <code
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "oklch(0.65 0.22 275)",
                      }}
                    >
                      handleSubmit
                    </code>{" "}
                    with a{" "}
                    <code
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "oklch(0.65 0.22 275)",
                      }}
                    >
                      fetch()
                    </code>{" "}
                    call to your n8n webhook URL.
                  </p>
                </div>
                <div
                  className="rounded-xl p-4 font-mono text-[11px]"
                  style={{
                    background: "oklch(0.08 0.02 265)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <p style={{ color: "oklch(0.38 0.02 265)" }}>
                    // After (live mode)
                  </p>
                  <p style={{ color: "oklch(0.65 0.22 275)" }}>
                    await fetch("https://your-n8n.com/webhook/abc123",{" {"} 
                  </p>
                  <p className="pl-4" style={{ color: "oklch(0.65 0.22 275)" }}>
                    method: "POST",
                  </p>
                  <p className="pl-4" style={{ color: "oklch(0.65 0.22 275)" }}>
                    body: JSON.stringify({"{"}contactName, ...{"}"})
                  </p>
                  <p style={{ color: "oklch(0.65 0.22 275)" }}>{"}"}) </p>
                </div>
              </div>
            </motion.div>

            {/* Direction 2 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
            >
              <div
                className="glass h-full p-6"
                style={{ borderColor: "oklch(0.65 0.22 275 / 0.15)" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="icon-wrap w-10 h-10">
                    <ArrowLeftRight className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3
                      className="font-semibold text-sm"
                      style={{ color: "oklch(0.90 0.005 265)" }}
                    >
                      Direction 2: n8n → Microsite
                    </h3>
                    <p
                      className="text-[10px]"
                      style={{ color: "oklch(0.45 0.02 265)" }}
                    >
                      Dashboard reads real activity data
                    </p>
                  </div>
                </div>
                <p
                  className="text-xs leading-relaxed mb-4"
                  style={{ color: "oklch(0.50 0.02 265)" }}
                >
                  After n8n processes a conversation, it sends the activity
                  data back to the microsite's data store. The Dashboard page
                  reads from this store instead of the demo data.
                </p>
                <div
                  className="rounded-xl p-4 mb-4"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <p
                    className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2"
                    style={{ color: "oklch(0.38 0.02 265)" }}
                  >
                    What you change in the code
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "oklch(0.50 0.02 265)" }}
                  >
                    Replace mock data in{" "}
                    <code
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "oklch(0.65 0.22 275)",
                      }}
                    >
                      mockData.ts
                    </code>{" "}
                    with API calls. The Dashboard uses{" "}
                    <code
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "oklch(0.65 0.22 275)",
                      }}
                    >
                      useEffect + fetch()
                    </code>{" "}
                    to load real data.
                  </p>
                </div>
                <div
                  className="rounded-xl p-4 font-mono text-[11px]"
                  style={{
                    background: "oklch(0.08 0.02 265)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <p style={{ color: "oklch(0.38 0.02 265)" }}>
                    // n8n POSTs here:
                  </p>
                  <p style={{ color: "oklch(0.65 0.22 275)" }}>
                    POST /api/activities {"{"}contactName, themes, ...{"}"}
                  </p>
                  <br />
                  <p style={{ color: "oklch(0.38 0.02 265)" }}>
                    // Dashboard reads:
                  </p>
                  <p style={{ color: "oklch(0.65 0.22 275)" }}>
                    const data = await fetch("/api/activities").then(r =&gt; r.json())
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Data Store Options */}
          <div className="mb-10">
            <h3
              className="font-serif text-xl mb-2"
              style={{ color: "oklch(0.95 0.005 265)" }}
            >
              Choosing a data store for the bridge
            </h3>
            <p
              className="text-xs leading-relaxed mb-6"
              style={{ color: "oklch(0.48 0.02 265)" }}
            >
              Both n8n and the dashboard need to read/write from the same
              place. Pick the option that matches your comfort level:
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  title: "Option A: Full-Stack Upgrade",
                  badge: "Recommended",
                  isRecommended: true,
                  icon: Server,
                  desc: "Upgrade this microsite to include a backend + PostgreSQL database. n8n POSTs to /api/activities, the Dashboard reads from the same endpoint. Everything lives in one place.",
                  pros: ["Single deployment", "Real-time queries", "No third-party dependency"],
                },
                {
                  title: "Option B: Google Sheets",
                  badge: "Low-Code",
                  isRecommended: false,
                  icon: FileCode,
                  desc: "Use a Google Sheet as a lightweight database. n8n writes rows via its native Google Sheets node. The microsite reads the sheet via the Sheets API.",
                  pros: ["No backend needed", "Easy to inspect data", "Free tier available"],
                },
                {
                  title: "Option C: Supabase / Airtable",
                  badge: "Managed DB",
                  isRecommended: false,
                  icon: Database,
                  desc: "Use a hosted database service. n8n writes via native nodes (Supabase, Airtable). The microsite reads via their public REST APIs.",
                  pros: ["Structured data", "Native n8n nodes", "Scales well"],
                },
              ].map((option, i) => (
                <motion.div
                  key={option.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={i}
                >
                  <div
                    className="glass h-full p-5"
                    style={
                      option.isRecommended
                        ? { borderColor: "oklch(0.65 0.22 275 / 0.2)" }
                        : {}
                    }
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="icon-wrap">
                        <option.icon className="w-4 h-4" />
                      </div>
                      {option.isRecommended ? (
                        <span className="badge-indigo">{option.badge}</span>
                      ) : (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-[0.06em] uppercase"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "oklch(0.42 0.02 265)",
                          }}
                        >
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <h4
                      className="font-semibold text-sm mb-2"
                      style={{ color: "oklch(0.88 0.005 265)" }}
                    >
                      {option.title}
                    </h4>
                    <p
                      className="text-xs leading-relaxed mb-3"
                      style={{ color: "oklch(0.48 0.02 265)" }}
                    >
                      {option.desc}
                    </p>
                    <ul className="space-y-1.5">
                      {option.pros.map((pro) => (
                        <li
                          key={pro}
                          className="flex items-center gap-1.5 text-xs"
                          style={{ color: "oklch(0.48 0.02 265)" }}
                        >
                          <CheckCircle2
                            className="w-3 h-3 flex-shrink-0"
                            style={{ color: "oklch(0.65 0.22 275)" }}
                          />
                          {pro}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Files to change */}
          <div className="glass p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="icon-wrap">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <h3
                  className="font-semibold text-sm"
                  style={{ color: "oklch(0.90 0.005 265)" }}
                >
                  Files you'll change to go live
                </h3>
                <p
                  className="text-[10px]"
                  style={{ color: "oklch(0.42 0.02 265)" }}
                >
                  The microsite is already structured for an easy swap from
                  demo to live mode
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                {
                  file: "Home.tsx",
                  change: "Replace mock handleSubmit() with fetch() to your n8n webhook URL",
                  icon: RefreshCw,
                },
                {
                  file: "lib/mockData.ts",
                  change: "Replace static arrays with API fetch functions to your data store",
                  icon: Database,
                },
                {
                  file: "Dashboard.tsx",
                  change: "Wire up useEffect + fetch() to load real activity data on mount",
                  icon: RefreshCw,
                },
                {
                  file: "App.tsx",
                  change: "No changes needed — routing and layout stay the same",
                  icon: CheckCircle2,
                },
              ].map((item) => (
                <div
                  key={item.file}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <item.icon
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: "oklch(0.65 0.22 275)" }}
                  />
                  <div>
                    <p
                      className="text-xs font-semibold font-mono mb-0.5"
                      style={{ color: "oklch(0.80 0.01 265)" }}
                    >
                      {item.file}
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: "oklch(0.45 0.02 265)" }}
                    >
                      {item.change}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
