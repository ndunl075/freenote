/* ============================================================================
   Audio capture

   Notability's defining feature: audio recorded alongside handwriting, so that
   tapping a word later jumps to what was being said while you wrote it.

   Everything here is local. getUserMedia gives us a stream, MediaRecorder gives
   us chunks, and the chunks go straight into IndexedDB. No audio ever leaves
   the device — there is nowhere for it to go.
   ========================================================================= */

export type RecorderState = "idle" | "recording" | "paused";

/** Picks the best container the browser will actually record. */
export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export class AudioRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  /** Wall-clock start, adjusted on resume so pauses don't inflate offsets. */
  private startedAt = 0;
  private pausedTotal = 0;
  private pausedAt = 0;

  state: RecorderState = "idle";

  async start(): Promise<void> {
    if (this.state !== "idle") return;
    if (!isRecordingSupported()) {
      throw new Error("Recording is not supported in this browser.");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    // A timeslice means we hold partial data continuously, so a crash mid-
    // lecture loses seconds rather than the whole recording.
    this.recorder.start(1000);
    this.startedAt = performance.now();
    this.pausedTotal = 0;
    this.state = "recording";
  }

  pause(): void {
    if (this.state !== "recording" || !this.recorder) return;
    this.recorder.pause();
    this.pausedAt = performance.now();
    this.state = "paused";
  }

  resume(): void {
    if (this.state !== "paused" || !this.recorder) return;
    this.recorder.resume();
    this.pausedTotal += performance.now() - this.pausedAt;
    this.state = "recording";
  }

  /** Milliseconds of audio captured so far, excluding paused time. */
  elapsed(): number {
    if (this.state === "idle") return 0;
    const now = this.state === "paused" ? this.pausedAt : performance.now();
    return now - this.startedAt - this.pausedTotal;
  }

  async stop(): Promise<{ blob: Blob; durationMs: number } | null> {
    if (!this.recorder || this.state === "idle") return null;

    const durationMs = this.elapsed();
    const recorder = this.recorder;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.stop();
    });

    this.teardown();
    return { blob, durationMs };
  }

  /** Abandon the recording without saving — used when the user cancels. */
  cancel(): void {
    if (this.recorder && this.state !== "idle") {
      this.recorder.onstop = null;
      try {
        this.recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    this.teardown();
  }

  private teardown(): void {
    // Releasing tracks is what turns off the browser's recording indicator.
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.state = "idle";
  }
}
