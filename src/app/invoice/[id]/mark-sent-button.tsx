"use client";

import { useState, useEffect, useRef } from "react";
import { fetchAddressTxs, txPaysToAddress } from "@/lib/mempool";
import { mempoolAddressUrl } from "@/lib/btc-network";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { Invoice } from "@/lib/invoice-public";

type Status = Invoice["status"];

// Front-loaded tiered poll schedule: 5×2s + 5×3s + 3×5s + 2×10s = 60s, 15 polls
const POLL_DELAYS_MS = [
  2000, 2000, 2000, 2000, 2000,
  3000, 3000, 3000, 3000, 3000,
  5000, 5000, 5000,
  10000, 10000,
];
const TOTAL_MS = 60_000;
// Pause between the progress bar reaching 100% and the flip to the detected view.
// Gives the payer a visual beat that "we found it" instead of a jarring instant swap.
const DETECTED_ANIMATION_MS = 400;

type Phase = "polling" | "detected" | "timed-out";

interface Props {
  invoiceId: string;
  btcAddress: string;
  status: Status;
  onStatusChange: (s: Status) => void;
  showButton?: boolean;
}

function isPayable(s: Status): boolean {
  return s === "pending" || s === "overdue";
}

function isDetected(s: Status): boolean {
  return s === "payment_detected" || s === "paid";
}

export function MarkSentButton({
  invoiceId,
  btcAddress,
  status,
  onStatusChange,
  showButton = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("polling");
  const prevStatusRef = useRef<Status>(status);

  // Auto-open the detected dialog when status transitions payable → detected.
  // Covers both our own polling finding the payment and the background PaymentWatcher
  // catching it while this dialog is closed (or the user never opened it).
  useEffect(() => {
    const wasPayable = isPayable(prevStatusRef.current);
    const nowDetected = isDetected(status);
    prevStatusRef.current = status;
    if (wasPayable && nowDetected) {
      setPhase("detected");
      setOpen(true);
    }
  }, [status]);

  const buttonVisible = showButton && isPayable(status);

  function handleOpenPolling() {
    setPhase("polling");
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      {buttonVisible && (
        <Button
          id="invoice-view--mark-sent-button"
          className="w-full"
          onClick={handleOpenPolling}
        >
          Mark as Payment Sent
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <AlertDialogContent id="invoice-view--mark-sent-dialog">
          {open && phase === "polling" && (
            <PollingSession
              invoiceId={invoiceId}
              btcAddress={btcAddress}
              onTimedOut={() => setPhase("timed-out")}
              onStatusChange={onStatusChange}
            />
          )}
          {open && phase === "detected" && (
            <DetectedView onClose={handleClose} />
          )}
          {open && phase === "timed-out" && (
            <TimedOutView btcAddress={btcAddress} />
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface SessionProps {
  invoiceId: string;
  btcAddress: string;
  onTimedOut: () => void;
  onStatusChange: (s: Status) => void;
}

function PollingSession({ invoiceId, btcAddress, onTimedOut, onStatusChange }: SessionProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let pollIndex = 0;
    let activeTimeout: ReturnType<typeof setTimeout> | null = null;
    let animationTimeout: ReturnType<typeof setTimeout> | null = null;
    const startTime = Date.now();

    const progressTimer = setInterval(() => {
      if (cancelled) return;
      setElapsedMs(Math.min(Date.now() - startTime, TOTAL_MS));
    }, 250);

    const schedule = () => {
      if (cancelled) return;
      if (pollIndex >= POLL_DELAYS_MS.length) {
        clearInterval(progressTimer);
        setElapsedMs(TOTAL_MS);
        onTimedOut();
        return;
      }
      const delay = POLL_DELAYS_MS[pollIndex];
      pollIndex += 1;
      activeTimeout = setTimeout(async () => {
        const txs = await fetchAddressTxs(btcAddress);
        if (cancelled) return;
        if (txs === null) { schedule(); return; }
        const hit = txs.find((tx) => txPaysToAddress(tx, btcAddress));
        if (hit) {
          const res = await fetch(`/api/invoices/${invoiceId}/payment-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              txid: hit.txid,
              status: hit.status.confirmed ? "paid" : "payment_detected",
            }),
          });
          if (cancelled) return;
          if (res.ok) {
            const data = await res.json();
            if (!cancelled && data.status) {
              clearInterval(progressTimer);
              setElapsedMs(TOTAL_MS);
              animationTimeout = setTimeout(() => {
                if (!cancelled) onStatusChange(data.status);
              }, DETECTED_ANIMATION_MS);
              return;
            }
          }
        }
        schedule();
      }, delay);
    };
    schedule();

    return () => {
      cancelled = true;
      clearInterval(progressTimer);
      if (activeTimeout) clearTimeout(activeTimeout);
      if (animationTimeout) clearTimeout(animationTimeout);
    };
  }, [invoiceId, btcAddress, onTimedOut, onStatusChange]);

  const progressPercent = Math.min(100, (elapsedMs / TOTAL_MS) * 100);

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Checking for your payment...</AlertDialogTitle>
        <AlertDialogDescription>
          We&apos;re watching the Bitcoin network for your transaction. This usually takes a few seconds but can take up to 30 minutes depending on network conditions.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div
        id="invoice-view--mark-sent-progress"
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Checking progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
      >
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <AlertDialogFooter className="flex-col sm:flex-col sm:items-stretch">
        <AlertDialogCancel id="invoice-view--mark-sent-cancel" variant="outline">
          Cancel
        </AlertDialogCancel>
        <p className="text-center text-xs text-muted-foreground">
          Click here if you have not yet made the Bitcoin payment
        </p>
      </AlertDialogFooter>
    </>
  );
}

function DetectedView({ onClose }: { onClose: () => void }) {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Your payment has been detected</AlertDialogTitle>
        <AlertDialogDescription>
          Your transaction is in the Bitcoin mempool. The invoice will be marked as paid once the transaction confirms in a block.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogAction id="invoice-view--mark-sent-ok" onClick={onClose}>
          OK
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

function TimedOutView({ btcAddress }: { btcAddress: string }) {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>We haven&apos;t seen your payment yet</AlertDialogTitle>
        <AlertDialogDescription>
          Your transaction may still be propagating. We&apos;ll keep watching in the background. If you just sent it, this usually resolves within a few minutes.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="text-sm">
        <a
          id="invoice-view--mempool-link"
          href={mempoolAddressUrl(btcAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4 hover:no-underline"
        >
          View address on mempool.space
        </a>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>Close</AlertDialogCancel>
      </AlertDialogFooter>
    </>
  );
}
