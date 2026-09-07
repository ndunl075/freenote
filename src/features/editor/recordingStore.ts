"use client";

import { create } from "zustand";
import { blobs, db, type ID, type Recording } from "@/lib/db";
import { AudioRecorder, isRecordingSupported } from "@/lib/media/recorder";
import { buildMarks } from "@/lib/media/playback";
import { newId } from "@/lib/utils/id";
import { useEditor } from "./store";

interface RecordingState {
  supported: boolean;
  status: "idle" | "recording" | "paused";
  elapsed: number;
  error: string | null;

  recordings: Recording[];
  /** Non-null while a saved recording is playing back. */
  playingId: ID | null;
  playbackTime: number;
  playbackDuration: number;

  loadFor: (noteId: ID) => Promise<void>;
  start: (noteId: ID) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: (noteId: ID) => Promise<void>;
  cancel: () => void;

  play: (recordingId: ID) => Promise<void>;
  pausePlayback: () => void;
  seek: (ms: number) => void;
  stopPlayback: () => void;
  remove: (recordingId: ID) => Promise<void>;

  /** Offset to stamp on a stroke, or undefined when not recording. */
  offsetForStroke: () => number | undefined;
}

const recorder = new AudioRecorder();
let tick: ReturnType<typeof setInterval> | null = null;
let audio: HTMLAudioElement | null = null;
let audioUrl: string | null = null;

export const useRecording = create<RecordingState>((set, get) => ({
  supported: false,
  status: "idle",
  elapsed: 0,
  error: null,

  recordings: [],
  playingId: null,
  playbackTime: 0,
  playbackDuration: 0,

  async loadFor(noteId) {
    set({
      supported: isRecordingSupported(),
      recordings: await db().recordings.where("noteId").equals(noteId).toArray(),
    });
  },

  async start(noteId) {
    void noteId;
    try {
      await recorder.start();
      set({ status: "recording", elapsed: 0, error: null });
      if (tick) clearInterval(tick);
      tick = setInterval(() => set({ elapsed: recorder.elapsed() }), 200);
    } catch (err) {
      // Almost always a denied microphone permission — say so plainly rather
      // than surfacing a DOMException name.
      set({
        error:
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "freenote needs microphone access to record."
            : "Could not start recording on this device.",
      });
    }
  },

  pause() {
    recorder.pause();
    set({ status: "paused" });
  },

  resume() {
    recorder.resume();
    set({ status: "recording" });
  },

  async stop(noteId) {
    if (tick) {
      clearInterval(tick);
      tick = null;
    }
    const result = await recorder.stop();
    set({ status: "idle", elapsed: 0 });
    if (!result || result.durationMs < 500) return;

    const blobId = await blobs.put(result.blob);

    // Marks come from the strokes written during this recording, which is what
    // lets the scrubber show where note-taking was densest.
    const strokes = useEditor.getState().pages.flatMap((p) => p.strokes);
    const recording: Recording = {
      id: newId("rec"),
      noteId,
      blobId,
      durationMs: result.durationMs,
      createdAt: Date.now(),
      marks: buildMarks(strokes),
    };
    await db().recordings.put(recording);
    set({ recordings: [...get().recordings, recording] });
  },

  cancel() {
    if (tick) {
      clearInterval(tick);
      tick = null;
    }
    recorder.cancel();
    set({ status: "idle", elapsed: 0 });
  },

  async play(recordingId) {
    const recording = get().recordings.find((r) => r.id === recordingId);
    if (!recording) return;

    get().stopPlayback();
    const url = await blobs.url(recording.blobId);
    if (!url) return;

    audioUrl = url;
    audio = new Audio(url);
    audio.ontimeupdate = () => set({ playbackTime: (audio?.currentTime ?? 0) * 1000 });
    audio.onended = () => get().stopPlayback();
    audio.onloadedmetadata = () => {
      // Blob durations can read Infinity until the browser has scanned the
      // stream; fall back to the duration we measured while recording.
      const d = audio?.duration;
      set({ playbackDuration: d && Number.isFinite(d) ? d * 1000 : recording.durationMs });
    };

    await audio.play();
    set({
      playingId: recordingId,
      playbackTime: 0,
      playbackDuration: recording.durationMs,
    });
  },

  pausePlayback() {
    audio?.pause();
    set({ playingId: null });
  },

  seek(ms) {
    if (audio) audio.currentTime = ms / 1000;
    set({ playbackTime: ms });
  },

  stopPlayback() {
    audio?.pause();
    audio = null;
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }
    set({ playingId: null, playbackTime: 0 });
  },

  async remove(recordingId) {
    const recording = get().recordings.find((r) => r.id === recordingId);
    if (!recording) return;
    get().stopPlayback();
    await db().recordings.delete(recordingId);
    await blobs.remove(recording.blobId);
    set({ recordings: get().recordings.filter((r) => r.id !== recordingId) });
  },

  offsetForStroke() {
    return get().status === "recording" ? recorder.elapsed() : undefined;
  },
}));
