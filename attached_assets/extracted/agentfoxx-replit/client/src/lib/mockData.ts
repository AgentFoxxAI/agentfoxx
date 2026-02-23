// Mock data for the Conference Networking Agent Dashboard
// In production, this data would come from n8n webhooks and Salesforce API

export interface ConversationEntry {
  id: string;
  contactName: string;
  contactEmail: string;
  company: string;
  themes: string[];
  whitePaperSent: string;
  emailSentAt: string;
  meetingBooked: boolean;
  meetingTime?: string;
  salesforceStatus: "new_lead" | "existing_lead" | "updated";
  notes: string;
}

export interface DailyMetric {
  date: string;
  emailsSent: number;
  meetingsBooked: number;
  leadsCreated: number;
}

export interface ThemeCount {
  theme: string;
  count: number;
}

export const conversations: ConversationEntry[] = [
  {
    id: "conv-001",
    contactName: "Sarah Chen",
    contactEmail: "sarah.chen@fintech.io",
    company: "FinTech Innovations",
    themes: ["Fraud Prevention", "AI/ML"],
    whitePaperSent: "Fraud Detection with Machine Learning",
    emailSentAt: "2026-02-18T10:30:00Z",
    meetingBooked: true,
    meetingTime: "2026-02-20T14:00:00Z",
    salesforceStatus: "new_lead",
    notes: "Discussed real-time fraud detection challenges in payment processing. Very interested in our ML pipeline approach.",
  },
  {
    id: "conv-002",
    contactName: "Marcus Johnson",
    contactEmail: "m.johnson@cloudscale.com",
    company: "CloudScale Systems",
    themes: ["Cloud Infrastructure", "Cost Optimization"],
    whitePaperSent: "Cloud Cost Optimization Strategies",
    emailSentAt: "2026-02-18T11:15:00Z",
    meetingBooked: false,
    salesforceStatus: "existing_lead",
    notes: "Currently evaluating multi-cloud strategies. Concerned about rising infrastructure costs.",
  },
  {
    id: "conv-003",
    contactName: "Priya Sharma",
    contactEmail: "priya@databridge.ai",
    company: "DataBridge AI",
    themes: ["Data Governance", "Compliance"],
    whitePaperSent: "Data Governance Framework for AI",
    emailSentAt: "2026-02-18T13:45:00Z",
    meetingBooked: true,
    meetingTime: "2026-02-21T10:00:00Z",
    salesforceStatus: "new_lead",
    notes: "Building a data governance platform. Needs compliance automation for GDPR and CCPA.",
  },
  {
    id: "conv-004",
    contactName: "James O'Brien",
    contactEmail: "jobrien@secureops.net",
    company: "SecureOps",
    themes: ["Cybersecurity", "Zero Trust"],
    whitePaperSent: "Zero Trust Architecture Guide",
    emailSentAt: "2026-02-18T14:20:00Z",
    meetingBooked: true,
    meetingTime: "2026-02-19T16:00:00Z",
    salesforceStatus: "updated",
    notes: "Implementing zero trust across their enterprise. Looking for identity verification partners.",
  },
  {
    id: "conv-005",
    contactName: "Elena Rodriguez",
    contactEmail: "elena.r@greenlogistics.co",
    company: "Green Logistics",
    themes: ["Supply Chain", "Sustainability"],
    whitePaperSent: "Sustainable Supply Chain Optimization",
    emailSentAt: "2026-02-18T15:00:00Z",
    meetingBooked: false,
    salesforceStatus: "new_lead",
    notes: "Focused on reducing carbon footprint in last-mile delivery. Interested in route optimization.",
  },
  {
    id: "conv-006",
    contactName: "David Kim",
    contactEmail: "dkim@healthai.org",
    company: "HealthAI Solutions",
    themes: ["Healthcare AI", "Compliance"],
    whitePaperSent: "AI in Healthcare: Compliance & Ethics",
    emailSentAt: "2026-02-17T09:30:00Z",
    meetingBooked: true,
    meetingTime: "2026-02-20T11:00:00Z",
    salesforceStatus: "existing_lead",
    notes: "Developing diagnostic AI tools. Needs HIPAA-compliant infrastructure.",
  },
  {
    id: "conv-007",
    contactName: "Aisha Patel",
    contactEmail: "aisha@retailnext.com",
    company: "RetailNext",
    themes: ["Retail Analytics", "Customer Experience"],
    whitePaperSent: "Next-Gen Retail Analytics",
    emailSentAt: "2026-02-17T11:00:00Z",
    meetingBooked: false,
    salesforceStatus: "new_lead",
    notes: "Exploring in-store analytics and personalization. Interested in real-time customer journey mapping.",
  },
  {
    id: "conv-008",
    contactName: "Robert Tanaka",
    contactEmail: "rtanaka@edgecompute.io",
    company: "EdgeCompute",
    themes: ["Edge Computing", "IoT"],
    whitePaperSent: "Edge Computing for IoT at Scale",
    emailSentAt: "2026-02-17T14:30:00Z",
    meetingBooked: true,
    meetingTime: "2026-02-19T09:00:00Z",
    salesforceStatus: "new_lead",
    notes: "Building edge computing solutions for manufacturing IoT. Needs low-latency processing.",
  },
];

export const dailyMetrics: DailyMetric[] = [
  { date: "Feb 12", emailsSent: 3, meetingsBooked: 1, leadsCreated: 2 },
  { date: "Feb 13", emailsSent: 5, meetingsBooked: 2, leadsCreated: 3 },
  { date: "Feb 14", emailsSent: 7, meetingsBooked: 3, leadsCreated: 4 },
  { date: "Feb 15", emailsSent: 4, meetingsBooked: 2, leadsCreated: 2 },
  { date: "Feb 16", emailsSent: 6, meetingsBooked: 3, leadsCreated: 5 },
  { date: "Feb 17", emailsSent: 8, meetingsBooked: 4, leadsCreated: 4 },
  { date: "Feb 18", emailsSent: 5, meetingsBooked: 3, leadsCreated: 3 },
];

export const themeDistribution: ThemeCount[] = [
  { theme: "Fraud Prevention", count: 12 },
  { theme: "AI/ML", count: 18 },
  { theme: "Cloud Infrastructure", count: 9 },
  { theme: "Cybersecurity", count: 14 },
  { theme: "Data Governance", count: 7 },
  { theme: "Supply Chain", count: 6 },
  { theme: "Compliance", count: 11 },
  { theme: "IoT", count: 5 },
];

export const summaryStats = {
  totalEmailsSent: 38,
  totalMeetingsBooked: 18,
  totalLeadsCreated: 23,
  conversionRate: 47.4,
  avgResponseTime: "4.2 min",
  topTheme: "AI/ML",
};
