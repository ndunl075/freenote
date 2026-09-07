"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Mic, Pause, Play, Square, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { IconButton, Tooltip, toast } from "@/components/ui";
import { activityHistogram } from "@/lib/media/playback";
import { spring } from "@/lib/motion/springs";
import { clock } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useRecording } from "./recordingStore";

/**
 * The recording strip. Recording tags every stroke with its offset into the
 * audio, so playback can replay handwriting in time and the scrubber can show
 * an activity histogram of where note-taking was densest.
 */
export function RecordingBar({ noteId }: { noteId: string }) {
  const supported = useRecording((s) => s.supported);
  const status = useRecording((s) => s.status);
  const elapsed = useRecording((s) => s.elapsed);
  const error = useRecording((s) => s.error);
  const recordings = useRecording((s) => s.recordings);
  const playingId = useRecording((s) => s.playingId);
  const playbackTime = useRecording((s) => s.playbackTime);
  const playbackDuration = useRecording((s) => s.playbackDuration);

  const loadFor = useRecording((s) => s.loadFor);
  const start = useRecording((s) => s.start);
  const pause = useRecording((s) => s.pause);
  const resume = useRecording((s) => s.resume);
  const stop = useRecording((s) => s.stop);
  const cancel = useRecording((s) => s.cancel);
  const play = useRecording((s) => s.play);
  const pausePlayback = useRecording((s) => s.pausePlayback);
  const seek = useRecording((s) => s.seek);
  const remove = useRecording((s) => s.remove);

  useEffect(() => {
    void loadFor(noteId);
  }, [noteId, loadFor]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  if (!supported && recordings.length === 0) return null;

  const latest = recordings[recordings.length - 1];
  const isPlaying = playingId === latest?.id;

  return (
    <div className="pointer-events-auto fixed bottom-5 left-5 z-30 flex flex-col gap-2">
      <AnimatePresence>
        {status !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={spring.snap}
            className="flex items-center gap-3 rounded-full bg-[#0a092d] px-4 py-2.5 shadow-[var(--shadow-lg)]"
          >
            <motion.span
              animate={
                status === "recording" ? { opacity: [1, 0.25, 1] } : { opacity: 0.4 }
              }
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="h-2.5 w-2.5 rounded-full bg-[var(--incorrect)]"
            />
            <span className="min-w-[52px] text-[14px] font-bold tabular-nums text-white">
              {clock(elapsed)}
            </span>

            <button
              onClick={() => (status === "recording" ? pause() : resume())}
              aria-label={status === "recording" ? "Pause recording" : "Resume recording"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
            >
              {status === "recording" ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={() => void stop(noteId)}
              aria-label="Stop and save recording"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--incorrect)] text-white hover:brightness-110"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>

            <button
              onClick={cancel}
              aria-label="Discard recording"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {status === "idle" && latest && (
        <div className="flex items-center gap-3 rounded-full border border-[var(--border-soft)] bg-[var(--surface)] py-2 pl-2 pr-4 shadow-[var(--shadow-lg)]">
          <IconButton
            label={isPlaying ? "Pause playback" : "Play recording"}
            size="sm"
            onClick={() => (isPlaying ? pausePlayback() : void play(latest.id))}
            className="bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] hover:text-white"
          >
            {isPlaying ? <Pause /> : <Play />}
          </IconButton>

          <Scrubber
            marks={latest.marks}
            duration={playbackDuration || latest.durationMs}
            position={playbackTime}
            onSeek={seek}
          />

          <span className="text-[12px] font-bold tabular-nums text-[var(--text-muted)]">
            {clock(playbackTime)} / {clock(latest.durationMs)}
          </span>

          <Tooltip label="Delete recording">
            <IconButton label="Delete recording" size="sm" onClick={() => void remove(latest.id)}>
              <Trash2 />
            </IconButton>
          </Tooltip>
        </div>
      )}

      {status === "idle" && supported && (
        <Tooltip label="Record audio while you write" side="right">
          <button
            onClick={() => void start(noteId)}
            aria-label="Start recording"
            className={cn(
              "inline-flex h-12 w-12 items-center justify-center rounded-full",
              "bg-[var(--incorrect)] text-white shadow-[var(--shadow-lg)]",
              "transition-transform hover:scale-105 active:scale-95",
            )}
          >
            <Mic className="h-5 w-5" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

/** Scrubber with an activity histogram showing where writing was densest. */
function Scrubber({
  marks,
  duration,
  position,
  onSeek,
}: {
  marks: { strokeId: string; t: number }[];
  duration: number;
  position: number;
  onSeek: (ms: number) => void;
}) {
  const bars = activityHistogram(marks, duration, 48);
  const pct = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Recording position"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(position)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onSeek(Math.max(0, position - 5000));
        if (e.key === "ArrowRight") onSeek(Math.min(duration, position + 5000));
      }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek(((e.clientX - rect.left) / rect.width) * duration);
      }}
      className="relative flex h-8 w-[180px] cursor-pointer items-end gap-[2px]"
    >
      {bars.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-full transition-colors"
          style={{
            height: `${Math.max(12, v * 100)}%`,
            background: i / bars.length <= pct ? "var(--brand)" : "var(--track)",
          }}
        />
      ))}
    </div>
  );
}
