import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import appIcon from "../root/logos/logo_atomic_crm_dark.svg";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "leads-install-dismissed";

// Chrome/Android fires this once, often before React mounts, so it is caught at
// module load and kept until the banner asks for it.
let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event as InstallPromptEvent;
  notify();
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  notify();
});

const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Phone-only nudge to add the app to the home screen, where it opens full
 * screen with no browser bars. Android gets a real Install button; iPhone has
 * no install API, so it shows the two taps instead. Hidden once installed or dismissed.
 */
export const InstallAppBanner = () => {
  const [, setVersion] = useState(0);
  const [dismissed, setDismissed] = useState(readDismissed);
  useEffect(() => {
    const listener = () => setVersion((version) => version + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const ios = isIos();
  if (dismissed || isInstalled() || (!deferredPrompt && !ios)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private mode: the banner simply comes back next visit.
    }
    setDismissed(true);
  };
  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === "accepted") dismiss();
    else notify();
  };

  return (
    <aside
      aria-label="Install the app"
      className="relative flex items-start gap-3 rounded-3xl bg-primary p-4 text-primary-foreground"
    >
      <img src={appIcon} alt="" className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 pr-8">
        <p className="font-semibold">Put this app on your home screen</p>
        {ios ? (
          <p className="mt-1 text-sm text-primary-foreground/80">
            Tap <Share className="inline size-4 -translate-y-px" aria-label="Share" />{" "}
            then “Add to Home Screen”. It opens full screen, like an app.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-primary-foreground/80">
              Opens full screen with its own icon, straight to Today.
            </p>
            <Button
              size="sm"
              className="mt-3 bg-lime text-lime-foreground hover:bg-lime/85"
              onClick={install}
            >
              <Download aria-hidden />
              Install app
            </Button>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 grid size-10 place-items-center rounded-full hover:bg-primary-foreground/10"
      >
        <X className="size-4" />
      </button>
    </aside>
  );
};
