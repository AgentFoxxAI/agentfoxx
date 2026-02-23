import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  Mail,
  CalendarCheck,
  UserPlus,
  TrendingUp,
  Clock,
  Tag,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  conversations,
  dailyMetrics,
  themeDistribution,
  summaryStats,
} from "@/lib/mockData";

const CHART_COLORS = [
  "oklch(0.65 0.22 275)",
  "oklch(0.62 0.22 300)",
  "oklch(0.55 0.18 265)",
  "oklch(0.72 0.15 290)",
  "oklch(0.45 0.16 280)",
  "oklch(0.68 0.20 285)",
  "oklch(0.50 0.19 270)",
  "oklch(0.75 0.14 295)",
];

const statCards = [
  {
    label: "Emails Sent",
    value: summaryStats.totalEmailsSent,
    icon: Mail,
    change: "+5 today",
  },
  {
    label: "Meetings Booked",
    value: summaryStats.totalMeetingsBooked,
    icon: CalendarCheck,
    change: "+3 today",
  },
  {
    label: "Leads Created",
    value: summaryStats.totalLeadsCreated,
    icon: UserPlus,
    change: "+3 today",
  },
  {
    label: "Conversion Rate",
    value: `${summaryStats.conversionRate}%`,
    icon: TrendingUp,
    change: "Email → Meeting",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

// Custom tooltip for recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="glass-strong px-4 py-3 text-xs"
        style={{ minWidth: 140 }}
      >
        <p
          className="font-semibold mb-2"
          style={{ color: "oklch(0.85 0.01 265)" }}
        >
          {label}
        </p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: entry.fill }}
            />
            <span style={{ color: "oklch(0.58 0.02 265)" }}>{entry.name}:</span>
            <span style={{ color: "oklch(0.90 0.005 265)" }}>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  return (
    <Layout>
      <div className="container py-10 lg:py-14">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="live-dot" />
            <p className="eyebrow">Live Analytics</p>
          </div>
          <h1
            className="font-serif text-3xl lg:text-4xl mb-2"
            style={{ color: "oklch(0.95 0.005 265)" }}
          >
            Conference Dashboard
          </h1>
          <p style={{ color: "oklch(0.50 0.02 265)" }}>
            Real-time overview of networking activity, follow-ups, and CRM
            updates.
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={i}
            >
              <div className="glass p-5 h-full group hover:border-indigo/20 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="icon-wrap group-hover:scale-105 transition-transform duration-300">
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <span
                    className="text-xs flex items-center gap-0.5"
                    style={{ color: "oklch(0.42 0.02 265)" }}
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    {stat.change}
                  </span>
                </div>
                <p
                  className="font-serif text-3xl mb-0.5"
                  style={{ color: "oklch(0.95 0.005 265)" }}
                >
                  {stat.value}
                </p>
                <p className="text-xs" style={{ color: "oklch(0.48 0.02 265)" }}>
                  {stat.label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-5 mb-10">
          {/* Daily Activity */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
            className="lg:col-span-2"
          >
            <div className="glass p-5 h-full">
              <h3
                className="text-sm font-medium mb-4"
                style={{ color: "oklch(0.80 0.01 265)" }}
              >
                Daily Activity
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyMetrics} barGap={2}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "oklch(0.42 0.02 265)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "oklch(0.42 0.02 265)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar
                      dataKey="emailsSent"
                      name="Emails Sent"
                      fill="oklch(0.65 0.22 275)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="meetingsBooked"
                      name="Meetings Booked"
                      fill="oklch(0.62 0.22 300)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="leadsCreated"
                      name="Leads Created"
                      fill="oklch(0.55 0.18 265)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>

          {/* Theme Distribution */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={5}
          >
            <div className="glass p-5 h-full">
              <h3
                className="text-sm font-medium mb-4"
                style={{ color: "oklch(0.80 0.01 265)" }}
              >
                Theme Distribution
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={themeDistribution}
                      dataKey="count"
                      nameKey="theme"
                      cx="50%"
                      cy="42%"
                      outerRadius={72}
                      innerRadius={36}
                      strokeWidth={2}
                      stroke="oklch(0.10 0.02 265)"
                    >
                      {themeDistribution.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.06)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        fontSize: "12px",
                        color: "oklch(0.85 0.01 265)",
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: "10px",
                        color: "oklch(0.48 0.02 265)",
                      }}
                      iconSize={7}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quick Stats */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {[
            {
              icon: Clock,
              value: summaryStats.avgResponseTime,
              label: "Avg. follow-up response time",
            },
            {
              icon: Tag,
              value: summaryStats.topTheme,
              label: "Most discussed theme this conference",
            },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={6 + i}
            >
              <div className="glass p-5 flex items-center gap-4">
                <div className="icon-wrap">
                  <item.icon className="w-4 h-4" />
                </div>
                <div>
                  <p
                    className="font-serif text-xl mb-0.5"
                    style={{ color: "oklch(0.92 0.005 265)" }}
                  >
                    {item.value}
                  </p>
                  <p className="text-xs" style={{ color: "oklch(0.48 0.02 265)" }}>
                    {item.label}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Activity Log */}
        <div>
          <div className="mb-6">
            <h2
              className="font-serif text-2xl mb-1"
              style={{ color: "oklch(0.95 0.005 265)" }}
            >
              Recent Activity
            </h2>
            <p className="text-xs" style={{ color: "oklch(0.48 0.02 265)" }}>
              Latest conversations processed by the networking agent.
            </p>
          </div>

          <div className="space-y-3">
            {conversations.map((conv, i) => (
              <motion.div
                key={conv.id}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div
                  className="glass-subtle group hover:border-indigo/15 transition-all duration-200 p-4"
                  style={{
                    borderRadius: "12px",
                    borderColor: "rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Contact */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className="font-semibold text-sm truncate"
                          style={{ color: "oklch(0.90 0.005 265)" }}
                        >
                          {conv.contactName}
                        </h3>
                        <Separator
                          orientation="vertical"
                          className="h-3.5"
                          style={{ background: "rgba(255,255,255,0.10)" }}
                        />
                        <span
                          className="text-xs truncate"
                          style={{ color: "oklch(0.48 0.02 265)" }}
                        >
                          {conv.company}
                        </span>
                      </div>
                      <p
                        className="text-xs line-clamp-1"
                        style={{ color: "oklch(0.42 0.02 265)" }}
                      >
                        {conv.notes}
                      </p>
                    </div>

                    {/* Themes */}
                    <div className="flex flex-wrap gap-1.5 lg:justify-end">
                      {conv.themes.map((theme) => (
                        <span
                          key={theme}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "oklch(0.55 0.02 265)",
                          }}
                        >
                          {theme}
                        </span>
                      ))}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-3 lg:ml-2 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs">
                        <Mail
                          className="w-3 h-3"
                          style={{ color: "oklch(0.65 0.22 275)" }}
                        />
                        <span style={{ color: "oklch(0.48 0.02 265)" }}>
                          Sent
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {conv.meetingBooked ? (
                          <>
                            <CheckCircle2
                              className="w-3 h-3"
                              style={{ color: "oklch(0.65 0.22 275)" }}
                            />
                            <span style={{ color: "oklch(0.48 0.02 265)" }}>
                              Booked
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle
                              className="w-3 h-3"
                              style={{ color: "oklch(0.32 0.02 265)" }}
                            />
                            <span style={{ color: "oklch(0.35 0.02 265)" }}>
                              Pending
                            </span>
                          </>
                        )}
                      </div>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={
                          conv.salesforceStatus === "new_lead"
                            ? {
                                background: "oklch(0.65 0.22 275 / 0.12)",
                                border: "1px solid oklch(0.65 0.22 275 / 0.25)",
                                color: "oklch(0.72 0.18 275)",
                              }
                            : {
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                color: "oklch(0.48 0.02 265)",
                              }
                        }
                      >
                        {conv.salesforceStatus === "new_lead"
                          ? "New Lead"
                          : conv.salesforceStatus === "existing_lead"
                          ? "Existing"
                          : "Updated"}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
