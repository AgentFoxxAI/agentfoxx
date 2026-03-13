import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Play, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob | null) => void;
  isProcessing?: boolean;
}

export function AudioRecorder({ onRecordingComplete, isProcessing = false }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startTimer = useCallback(() => {
    setRecordingTime(0);
    timerRef.current = window.setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        onRecordingComplete(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      startTimer();

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioBlob(null);
      setAudioUrl(null);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required to record audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  const discardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    onRecordingComplete(null);
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-card rounded-2xl border border-border shadow-sm">

      {/* Visualizer / Status */}
      <div className="relative flex items-center justify-center w-full mb-6 h-24 sm:h-32">
        {isRecording ? (
          <div className="flex items-center gap-1 h-16">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-destructive rounded-full wave-bar"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  height: `${Math.max(20, Math.random() * 100)}%`
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center text-muted-foreground">
            {audioUrl ? (
              <div className="text-primary font-medium text-base sm:text-lg">Recording saved ✓</div>
            ) : (
              <>
                <Mic className="w-10 h-10 sm:w-12 sm:h-12 mb-2 opacity-20" />
                <p className="text-sm sm:text-base">Ready to record</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="text-3xl sm:text-4xl font-display font-light mb-6 tabular-nums tracking-wider">
        {formatTime(recordingTime)}
      </div>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-5 sm:gap-4">
        {!isRecording && !audioUrl && (
          <Button
            size="lg"
            onClick={startRecording}
            data-testid="button-start-recording"
            className="rounded-full w-24 h-24 sm:w-20 sm:h-20 bg-primary hover:bg-primary/90 text-white shadow-lg hover-elevate active-elevate-2 group transition-all"
          >
            <Mic className="w-10 h-10 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" />
          </Button>
        )}

        {isRecording && (
          <Button
            size="lg"
            variant="destructive"
            onClick={stopRecording}
            data-testid="button-stop-recording"
            className="rounded-full w-24 h-24 sm:w-20 sm:h-20 recording-pulse shadow-lg hover-elevate active-elevate-2"
          >
            <Square className="w-10 h-10 sm:w-8 sm:h-8 fill-current" />
          </Button>
        )}

        {audioUrl && !isRecording && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={discardRecording}
              data-testid="button-discard-recording"
              className="rounded-full w-14 h-14 border-destructive/20 text-destructive hover:bg-destructive/10 hover-elevate active-elevate-2"
              disabled={isProcessing}
            >
              <Trash2 className="w-6 h-6" />
            </Button>

            <Button
              variant="default"
              size="icon"
              onClick={togglePlayback}
              data-testid="button-playback"
              className="rounded-full w-20 h-20 sm:w-16 sm:h-16 bg-secondary text-secondary-foreground hover:bg-secondary/80 hover-elevate active-elevate-2"
              disabled={isProcessing}
            >
              {isPlaying ? <Square className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current" />}
            </Button>
          </>
        )}
      </div>

      {isProcessing && (
        <div className="mt-5 flex items-center text-sm text-muted-foreground animate-pulse">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Processing audio and starting agent workflow...
        </div>
      )}
    </div>
  );
}
