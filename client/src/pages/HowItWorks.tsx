import { Mic, Cpu, Mail, Settings, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function HowItWorks() {
  const steps = [
    {
      icon: <Mic className="w-7 h-7 text-primary" />,
      title: "1. Capture",
      description: "Record a quick voice memo after a meeting using the web app. Speak naturally about the prospect's needs and action items."
    },
    {
      icon: <Settings className="w-7 h-7 text-blue-500" />,
      title: "2. Webhook",
      description: "The audio file and contact details are sent securely to an n8n automation workflow via webhook."
    },
    {
      icon: <Cpu className="w-7 h-7 text-purple-500" />,
      title: "3. Analyze",
      description: "OpenAI's Whisper transcribes the audio, and GPT-4o analyzes it to extract core themes and draft a highly contextual email."
    },
    {
      icon: <Mail className="w-7 h-7 text-amber-500" />,
      title: "4. Review & Send",
      description: "The AI-drafted email is sent to the approval queue for human review. Once approved, the email is sent through Outlook to the prospect."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      <div className="text-center mb-10 sm:mb-16">
        <h1 className="text-3xl sm:text-5xl font-display font-bold text-foreground tracking-tight mb-3">
          How AgentFoxx Works
        </h1>
        <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          The autonomous architecture behind your networking workflow.
        </p>
      </div>

      {/* Steps — single column on mobile, zigzag on desktop */}
      <div className="relative">
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-border to-transparent -translate-x-1/2" />

        {/* Mobile: simple vertical stack */}
        <div className="flex flex-col gap-4 md:hidden">
          {steps.map((step, index) => (
            <Card key={index} className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="bg-muted/50 w-12 h-12 rounded-xl flex items-center justify-center border border-border shadow-sm shrink-0">
                    {step.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-display font-semibold mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop: zigzag layout */}
        <div className="hidden md:block space-y-12">
          {steps.map((step, index) => (
            <div key={index} className={`flex flex-row items-center gap-8 ${index % 2 === 1 ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-1 flex ${index % 2 === 1 ? 'justify-start' : 'justify-end'} w-full`}>
                <Card className="glass-card w-full max-w-sm hover-elevate transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="bg-muted/50 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border border-border shadow-sm">
                      {step.icon}
                    </div>
                    <h3 className="text-xl font-display font-semibold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="relative z-10 w-12 h-12 rounded-full bg-background border-4 border-primary flex items-center justify-center shadow-lg shrink-0">
                <span className="font-bold text-primary">{index + 1}</span>
              </div>
              <div className="flex-1 w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 sm:mt-20 bg-primary/5 border border-primary/20 rounded-2xl sm:rounded-3xl p-6 sm:p-12 text-center">
        <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary mx-auto mb-4" />
        <h2 className="text-xl sm:text-2xl font-display font-bold mb-2">Ready to scale your networking?</h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 max-w-lg mx-auto">
          AgentFoxx handles the administrative burden so you can focus on building relationships.
        </p>
      </div>

    </div>
  );
}
