"use client";

import { AlertTriangle, Database, Download, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusOnOpen } from "@/components/focus/useFocusOnOpen";
import { useBackupImport } from "@/components/backup/useBackupImport";
import { BoxInput, Button, Dialog, Progress, toast } from "@/components/ui";
import { requestPersistence, storageEstimate } from "@/lib/db";
import { downloadBackup, wipeAll } from "@/lib/io/backup";
import { confirmsWipe, formatBytes, usagePercent, WIPE_PHRASE } from "../format";
import { SettingRow, SettingsSection } from "../SettingRow";

type Estimate = { usage: number; quota: number } | null | "loading";

/** Storage usage plus whether the browser has granted persistence. */
async function measure(): Promise<{ est: Estimate; isPersisted: boolean | null }> {
  const [est, isPersisted] = await Promise.all([
    storageEstimate(),
    typeof navigator !== "undefined" && navigator.storage?.persisted
      ? navigator.storage.persisted().catch(() => null)
      : Promise.resolve(null),
  ]);
  return { est, isPersisted };
}

export function DataSection({ onWiped }: { onWiped: () => Promise<void> }) {
  const [estimate, setEstimate] = useState<Estimate>("loading");
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [exporting, setExporting] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState("");
  const [wiping, setWiping] = useState(false);
  const wipeInputRef = useRef<HTMLInputElement>(null);
  useFocusOnOpen(wipeOpen, wipeInputRef);

  const refresh = useCallback(
    () =>
      measure().then(({ est, isPersisted }) => {
        setEstimate(est);
        setPersisted(isPersisted);
      }),
    [],
  );

  useEffect(() => {
    let alive = true;
    measure().then(({ est, isPersisted }) => {
      if (!alive) return;
      setEstimate(est);
      setPersisted(isPersisted);
    });
    return () => {
      alive = false;
    };
  }, []);

  const importer = useBackupImport(() => void refresh());

  const keepSafe = async () => {
    const ok = await requestPersistence();
    setPersisted(ok);
    if (ok) toast.success("Your data is marked persistent — the browser won't clear it to free space.");
    else toast.error("The browser declined. Installing freenote to your home screen usually helps.");
  };

  const exportNow = async () => {
    setExporting(true);
    try {
      await downloadBackup();
      toast.success("Backup downloaded. Keep it somewhere safe.");
    } catch {
      toast.error("Couldn't build the backup.");
    } finally {
      setExporting(false);
    }
  };

  const closeWipe = useCallback(() => {
    if (!wiping) {
      setWipeOpen(false);
      setWipeText("");
    }
  }, [wiping]);

  const wipe = async () => {
    if (!confirmsWipe(wipeText) || wiping) return;
    setWiping(true);
    try {
      await wipeAll();
      await onWiped();
      await refresh();
      setWipeOpen(false);
      setWipeText("");
      toast.show("Everything has been deleted from this device.");
    } catch {
      toast.error("Couldn't delete everything — some data may remain.");
    } finally {
      setWiping(false);
    }
  };

  const pct = estimate && estimate !== "loading" ? usagePercent(estimate.usage, estimate.quota) : 0;

  return (
    <>
      <SettingsSection
        id="data"
        title="Your data"
        icon={<Database />}
        description="Everything freenote knows is in this browser's storage. Nothing is sent anywhere."
      >
        <SettingRow
          id="storage"
          title="Storage used"
          stacked
          description={
            estimate === "loading"
              ? "Measuring…"
              : estimate === null
                ? "This browser doesn't report storage usage."
                : `${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)} available (${pct}%). Audio recordings and images take up most of it.`
          }
          control={
            <Progress
              value={pct}
              max={100}
              tone={pct > 90 ? "star" : "brand"}
              height={10}
              className="max-w-[520px]"
            />
          }
        />
        <SettingRow
          id="persist"
          title="Keep my data safe"
          description={
            persisted === true
              ? "Persistent storage is on. The browser has agreed not to evict your notes under disk pressure."
              : persisted === false
                ? "Browsers may clear site data when the disk runs low. Ask for persistent storage so your notes are exempt."
                : "Ask the browser to protect your notes from being cleared when the disk runs low."
          }
          control={
            <Button
              variant={persisted ? "secondary" : "primary"}
              size="sm"
              onClick={keepSafe}
              disabled={persisted === true}
              leading={<ShieldCheck className="h-4 w-4" aria-hidden />}
            >
              {persisted ? "Protected" : "Keep my data safe"}
            </Button>
          }
        />
        <SettingRow
          id="export"
          title="Export backup"
          description="Download everything — subjects, notes, ink, recordings, sets and progress — as one readable JSON file."
          control={
            <Button
              variant="secondary"
              size="sm"
              onClick={exportNow}
              disabled={exporting}
              leading={<Download className="h-4 w-4" aria-hidden />}
            >
              {exporting ? "Preparing…" : "Export backup"}
            </Button>
          }
        />
        <SettingRow
          id="import"
          title="Import backup"
          description="Restore a freenote backup file. You'll choose whether to merge it with what's here or replace everything."
          control={
            <Button
              variant="secondary"
              size="sm"
              onClick={importer.pick}
              disabled={importer.busy}
              leading={<Upload className="h-4 w-4" aria-hidden />}
            >
              Import backup
            </Button>
          }
        />
      </SettingsSection>

      <SettingsSection
        id="danger"
        title="Delete everything"
        icon={<AlertTriangle />}
        tone="danger"
        description="Wipe every note, set, recording and setting from this device."
      >
        <SettingRow
          id="wipe"
          title="Erase all local data"
          description="There is no undo and no copy anywhere else. Export a backup first if there's any chance you'll want this back."
          control={
            <Button
              variant="danger"
              size="sm"
              onClick={() => setWipeOpen(true)}
              leading={<Trash2 className="h-4 w-4" aria-hidden />}
            >
              Delete everything…
            </Button>
          }
        />
      </SettingsSection>

      {importer.element}

      <Dialog
        open={wipeOpen}
        onClose={closeWipe}
        width="sm"
        title="Delete everything?"
        description="This permanently erases every note, study set, recording and setting stored in this browser."
        footer={
          <>
            <Button variant="ghost" onClick={closeWipe} disabled={wiping}>
              Cancel
            </Button>
            <Button variant="danger" onClick={wipe} disabled={!confirmsWipe(wipeText) || wiping}>
              {wiping ? "Deleting…" : "Delete everything"}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void wipe();
          }}
        >
          <label htmlFor="wipe-confirm" className="mb-1.5 block text-[13px] font-bold text-[var(--text-muted)]">
            Type <span className="font-mono text-[var(--text)]">{WIPE_PHRASE}</span> to confirm
          </label>
          <BoxInput
            id="wipe-confirm"
            ref={wipeInputRef}
            value={wipeText}
            onChange={(e) => setWipeText(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={WIPE_PHRASE}
          />
        </form>
      </Dialog>
    </>
  );
}
