import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Mic,
  Brain,
  Mail,
  CalendarCheck,
  Database,
  Sparkles,
  Zap,
  Square,
  Pause,
  Play,
  Upload,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";

const HERO_IMG =
  "https://private-us-east-1.manuscdn.com/sessionFile/o5acm8r6Ps43bNojNMPrje/sandbox/OU4rDtVMv3Ir7hSHOM0toR-img-1_1771448549000_na1fn_aGVyby1jb25mZXJlbmNl.jpg?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbzVhY204cjZQczQzYk5vak5NUHJqZS9zYW5kYm94L09VNHJEdFZNdjNJcjdoU0hPTTB0b1ItaW1nLTFfMTc3MTQ0ODU0OTAwMF9uYTFmbl9hR1Z5YnkxamIyNW1aWEpsYm1ObC5qcGc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=TZlOnj-mBSNqnQwxdcW~xB1Di~SiHvsJYcOKL-5BlzDF29TrEwv~F~NnFpH-~ziabeDTw-5HxCaqVZccRtXYPKHJp2XOCUe2gsLf0TCDjXpQyAYk2aWLgFtkvx2RT6UyFuEQHzeQP~y1XOS20TQEfZTshTZHJyCDTWuAZqUu2yWCeK9ufvjNMICQnU~S~AH0oy83DAiNr4SqH~h-70j6OG6yLsWX7fsE8CQjKw9rVA06gcgRA7ohYQUvHVUQmM2mZ4xsgR1CiOJctLWeV8hu6H0zubLq7xUauBB1DMkC6i6Iap4yj4aeb0GRrRQq7JDOzBzeTjXy0It3-QLp3DW-7g__";;

const NETWORK_IMG =
  "https://private-us-east-1.manuscdn.com/sessionFile/o5acm8r6Ps43bNojNMPrje/sandbox/OU4rDtVMv3Ir7hSHOM0toR-img-2_1771448551000_na1fn_YWJzdHJhY3QtbmV0d29yaw.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbzVhY204cjZQczQzYk5vak5NUHJqZS9zYW5kYm94L09VNHJEdFZNdjNJcjdoU0hPTTB0b1ItaW1nLTJfMTc3MTQ0ODU1MTAwMF9uYTFmbl9ZV0p6ZEhKaFkzUXRibVYwZDI5eWF3LnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=EiyHeX4DgBd~w2GDgs6lvW0ma8FRZggUGsfcEZwsqt~fclgSFVw3QCv6Cx8hvBUe1o9FT-le2oK7pOPVQWYYlgK-9AaPvRYB8qC7U8Ko8HrB~UbfS2zqozVN3JYXIisLRe~AbWdMmsYLlMwclNHDyP9FGb5mCltYN3V0vP1y~H1M-ihxZeSFwtUH5u3pzs8DMRybsBFXgHeWm4xWcOLEcIgTb7nLmIauO0dZp2c1A1t2qKTBQA-ZqDD~QEUSHrv466puID4h~QbcM8HjpnE83~vXmvC-sC2Bfy4G4dNCyhskmf394-T~IrXbCYx9xGKPEQMWytehCBgg9P4PQr6wDw__";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const steps = [
  {
    icon: Mic,
    title: "Capture",
    desc: "Record conversation audio in-browser — transcribed automatically via OpenAI Whisper.",
    num: "01",
  },
  {
    icon: Brain,
    title: "Analyze",
    desc: "AI identifies key themes like fraud prevention, compliance, or cost optimization.",
    num: "02",
  },
  {
    icon: Mail,
    title: "Follow Up",
    desc: "A personalized email with a relevant white paper is drafted in Outreach for your review.",
    num: "03",
  },
  {
    icon: CalendarCheck,
    title: "Schedule",
    desc: "A Calendly link is included so the contact can book a follow-up meeting instantly.",
    num: "04",
  },
  {
    icon: Database,
    title: "Sync CRM",
    desc: "Activity is logged to the dashboard — and optionally synced to Salesforce via Outreach.",
    num: "05",
  },
];

type RecordingState = "idle" | "recording" | "paused" | "stopped";

export default function Home() {
  const [formData, setFormData] = useState({
    contactName: "",
    contactEmail: "",
    company: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === "recording") {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recordingState]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Capture audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // On stop, create Blob
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        // Stop all tracks to release microphone
        streamRef.current?.getTracks().forEach((track) => track.stop());
      };

      // Start recording
      mediaRecorder.start();
      setRecordingState("recording");
      setRecordingDuration(0);
      toast.success("Recording started", {
        description: "Speak clearly into your microphone.",
      });
    } catch (error) {
      console.error("Recording error:", error);
      toast.error("Microphone access denied", {
        description: "Please allow microphone access to record audio.",
      });
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setRecordingState("paused");
      toast.info("Recording paused");
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setRecordingState("recording");
      toast.info("Recording resumed");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setRecordingState("stopped");
      toast.success("Recording stopped", {
        description: "Click 'Finish & Submit' to process the conversation.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Replace with your actual n8n webhook URL
    const N8N_WEBHOOK_URL = "https://your-n8n-instance.app.n8n.cloud/webhook/netagent-conference";

    try {
      let audioFileURL = audioURL;

      // If audio was recorded, upload to Manus S3 first
      if (audioBlob && !audioURL) {
        toast.info("Uploading audio...", { description: "This may take a moment." });
        
        // Create FormData for file upload
        const formData = new FormData();
        const fileName = `conference-${Date.now()}.webm`;
        formData.append("file", audioBlob, fileName);

        // Upload to Manus file storage (or use manus-upload-file CLI)
        // For now, we'll simulate this - in production, you'd call your backend endpoint
        // that runs `manus-upload-file` and returns the CDN URL
        
        // Simulated upload - replace with actual Manus S3 upload endpoint
        // const uploadResponse = await fetch("/api/upload-audio", {
        //   method: "POST",
        //   body: formData,
        // });
        // const { url } = await uploadResponse.json();
        // audioFileURL = url;

        // For demo: create local object URL
        audioFileURL = URL.createObjectURL(audioBlob);
        setAudioURL(audioFileURL);
      }

      const payload = {
        meeting_title: `Meeting with ${formData.contactName}`,
        attendee_name: formData.contactName,
        attendee_email: formData.contactEmail,
        company: formData.company,
        conversation_notes: formData.notes,
        audio_file_url: audioFileURL,
        recording_duration: recordingDuration,
        timestamp: new Date().toISOString(),
      };

      // Uncomment when n8n webhook is ready:
      // const response = await fetch(N8N_WEBHOOK_URL, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(payload),
      // });
      // if (!response.ok) throw new Error("Failed to submit");

      // Demo mode: simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Conversation submitted to n8n workflow", {
        description: `Transcription and follow-up for ${formData.contactName} is being processed.`,
      });
      setFormData({ contactName: "", contactEmail: "", company: "", notes: "" });
      setRecordingState("idle");
      setRecordingDuration(0);
      setAudioBlob(null);
      setAudioURL(null);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Submission failed", {
        description: "Please try again or contact support.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${HERO_IMG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-indigo-900/90" />
        </div>

        <div className="container relative z-10 py-20">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-300 uppercase tracking-wider">
                Agentic Networking Model
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-white mb-6 leading-tight">
              Turn every conversation into a{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 italic">
                qualified lead
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              An AI-powered agent that captures conference conversations, identifies key themes,
              sends personalized follow-ups with relevant white papers, and books meetings — with a
              dashboard tracking every interaction.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/dashboard">
                <Button size="lg" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                  View Dashboard <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/guide">
                <Button size="lg" variant="outline" className="gap-2 border-slate-600 text-white hover:bg-slate-800">
                  Deployment Guide
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="mt-16 grid grid-cols-3 gap-8 max-w-2xl"
          >
            <div>
              <div className="text-4xl font-serif font-bold text-white mb-2">5</div>
              <div className="text-sm text-slate-400">Workflow steps</div>
            </div>
            <div>
              <div className="text-4xl font-serif font-bold text-white mb-2">&lt;2h</div>
              <div className="text-sm text-slate-400">Setup time</div>
            </div>
            <div>
              <div className="text-4xl font-serif font-bold text-white mb-2">100%</div>
              <div className="text-sm text-slate-400">Human-reviewed</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Workflow Steps ── */}
      <section className="py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url(${NETWORK_IMG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        <div className="container relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-300 uppercase tracking-wider">
                How It Works
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
              Five steps from handshake to pipeline
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              The agent automates the entire post-conversation workflow, ensuring no opportunity
              slips through the cracks.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="glass p-6 rounded-xl relative group hover:bg-white/5 transition-all"
              >
                <div className="text-6xl font-serif font-bold text-indigo-500/20 mb-4">
                  {step.num}
                </div>
                <div className="icon-wrap mb-4">
                  <step.icon className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Form ── */}
      <section className="py-24">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
              <Mic className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-300 uppercase tracking-wider">
                Start Here
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
              Log a new interaction
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Capture meeting details and let the agent handle the follow-up workflow.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="max-w-2xl mx-auto"
          >
            <form onSubmit={handleSubmit} className="glass p-8 rounded-xl space-y-6">
              {/* Audio Recording Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-white font-semibold">In-Browser Recording</Label>
                  {recordingState !== "idle" && (
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${recordingState === "recording" ? "bg-red-500 animate-pulse" : recordingState === "paused" ? "bg-yellow-500" : "bg-green-500"}`} />
                      <span className="text-sm text-slate-400 font-mono">
                        {formatDuration(recordingDuration)}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-slate-400">
                  {recordingState === "idle" && "Start recording to capture conversation audio"}
                  {recordingState === "recording" && "Recording in progress — speak clearly into your microphone"}
                  {recordingState === "paused" && "Recording paused — resume when ready"}
                  {recordingState === "stopped" && "Recording complete — fill in details below and submit"}
                </p>

                <div className="flex flex-wrap gap-3">
                  {recordingState === "idle" && (
                    <Button
                      type="button"
                      onClick={handleStartRecording}
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Mic className="w-4 h-4" />
                      Start Recording
                    </Button>
                  )}

                  {recordingState === "recording" && (
                    <>
                      <Button
                        type="button"
                        onClick={handlePauseRecording}
                        variant="outline"
                        className="gap-2 border-yellow-600 text-yellow-400 hover:bg-yellow-600/10"
                      >
                        <Pause className="w-4 h-4" />
                        Pause
                      </Button>
                      <Button
                        type="button"
                        onClick={handleStopRecording}
                        variant="outline"
                        className="gap-2 border-red-600 text-red-400 hover:bg-red-600/10"
                      >
                        <Square className="w-4 h-4" />
                        Stop
                      </Button>
                    </>
                  )}

                  {recordingState === "paused" && (
                    <>
                      <Button
                        type="button"
                        onClick={handleResumeRecording}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Play className="w-4 h-4" />
                        Resume
                      </Button>
                      <Button
                        type="button"
                        onClick={handleStopRecording}
                        variant="outline"
                        className="gap-2 border-red-600 text-red-400 hover:bg-red-600/10"
                      >
                        <Square className="w-4 h-4" />
                        Stop
                      </Button>
                    </>
                  )}

                  {recordingState === "stopped" && audioBlob && (
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <Upload className="w-4 h-4" />
                      Audio ready ({(audioBlob.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-700 pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName" className="text-white">
                      Contact Name
                    </Label>
                    <Input
                      id="contactName"
                      type="text"
                      placeholder="Sarah Chen"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      required
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactEmail" className="text-white">
                      Email
                    </Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="sarah@company.com"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      required
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company" className="text-white">
                    Company
                  </Label>
                  <Input
                    id="company"
                    type="text"
                    placeholder="FinTech Innovations"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    required
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-white">
                    Conversation Notes
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Discussed fraud detection challenges in real-time payment processing. Interested in ML pipeline approach and compliance frameworks..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 resize-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Finish & Submit to n8n"}
              </Button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* ── Powered By ── */}
      <section className="py-16 border-t border-slate-800">
        <div className="container">
          <div className="text-center mb-8">
            <p className="text-sm text-slate-500 uppercase tracking-wider font-medium">
              Powered By
            </p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {["n8n", "Otter.ai", "Calendly", "OpenAI", "Microsoft Outlook", "Outreach.io"].map(
              (tech, i) => (
                <div key={i} className="text-slate-600 font-medium text-sm md:text-base">
                  {tech}
                </div>
              )
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
