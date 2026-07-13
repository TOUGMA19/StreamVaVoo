import { useEffect } from "react";

/**
 * Remote control + phone keyboard handler.
 *
 * Supports:
 *  - D-Pad arrows (spatial focus navigation between [data-focusable] elements)
 *  - OK / Enter → activates focused element
 *  - Back / Escape / Backspace / keyCode 10009 (Tizen/webOS) → onBack
 *  - MediaPlayPause / Space → onPlayPause
 *  - Channel Up/Down (keyCode 427/428) & PageUp/Down → onNext / onPrevious
 *  - Volume Up/Down (AudioVolume* keys) → onVolumeUp / onVolumeDown
 *  - Color keys (403/404/405/406) → onRed/onGreen/onYellow/onBlue
 *  - Digits 0-9 → onDigit
 */
export interface RemoteHandlers {
  onBack?: () => void;
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onRed?: () => void;
  onGreen?: () => void;
  onYellow?: () => void;
  onBlue?: () => void;
  onDigit?: (n: number) => void;
}

function isTextInput(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

function moveFocusSpatial(dir: "up" | "down" | "left" | "right") {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>("[data-focusable]:not([disabled])")
  ).filter((n) => n.offsetParent !== null);
  if (nodes.length === 0) return;
  const active = (document.activeElement as HTMLElement) || nodes[0];
  const ar = active.getBoundingClientRect();
  const ax = ar.left + ar.width / 2;
  const ay = ar.top + ar.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const n of nodes) {
    if (n === active) continue;
    const r = n.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = cx - ax;
    const dy = cy - ay;
    let ok = false;
    let score = 0;
    switch (dir) {
      case "up":    ok = dy < -4; score = Math.abs(dy) + Math.abs(dx) * 2; break;
      case "down":  ok = dy > 4;  score = Math.abs(dy) + Math.abs(dx) * 2; break;
      case "left":  ok = dx < -4; score = Math.abs(dx) + Math.abs(dy) * 2; break;
      case "right": ok = dx > 4;  score = Math.abs(dx) + Math.abs(dy) * 2; break;
    }
    if (ok && score < bestScore) { bestScore = score; best = n; }
  }
  if (best) {
    best.focus({ preventScroll: false });
    best.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }
}

export function useRemoteControl(handlers: RemoteHandlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const textField = isTextInput(e.target);
      // Always mark remote-nav on the shell so focus rings light up.
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter","Tab"].includes(e.key)) {
        document.querySelector(".m3u-shell")?.classList.add("remote-nav");
      }

      // Back key (Tizen/webOS = 10009; Android TV also sends Backspace/Escape)
      if (e.key === "Escape" || e.keyCode === 10009 || (e.key === "Backspace" && !textField)) {
        handlers.onBack?.();
        e.preventDefault();
        return;
      }
      if (textField) return;

      switch (e.key) {
        case "ArrowUp":    moveFocusSpatial("up"); e.preventDefault(); break;
        case "ArrowDown":  moveFocusSpatial("down"); e.preventDefault(); break;
        case "ArrowLeft":  moveFocusSpatial("left"); e.preventDefault(); break;
        case "ArrowRight": moveFocusSpatial("right"); e.preventDefault(); break;
        case "Enter":
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.click();
            e.preventDefault();
          }
          break;
        case " ":
        case "MediaPlayPause":
        case "MediaPlay":
        case "MediaPause":
          handlers.onPlayPause?.(); e.preventDefault(); break;
        case "PageUp":
        case "MediaTrackNext":
        case "ChannelUp":
          handlers.onNext?.(); e.preventDefault(); break;
        case "PageDown":
        case "MediaTrackPrevious":
        case "ChannelDown":
          handlers.onPrevious?.(); e.preventDefault(); break;
        case "AudioVolumeUp": handlers.onVolumeUp?.(); break;
        case "AudioVolumeDown": handlers.onVolumeDown?.(); break;
      }

      // Numeric legacy keyCodes for TV remotes
      switch (e.keyCode) {
        case 427: handlers.onNext?.(); e.preventDefault(); break;      // ChannelUp
        case 428: handlers.onPrevious?.(); e.preventDefault(); break;  // ChannelDown
        case 403: handlers.onRed?.(); e.preventDefault(); break;
        case 404: handlers.onGreen?.(); e.preventDefault(); break;
        case 405: handlers.onYellow?.(); e.preventDefault(); break;
        case 406: handlers.onBlue?.(); e.preventDefault(); break;
        case 179: handlers.onPlayPause?.(); e.preventDefault(); break;
      }

      // Digits
      if (/^[0-9]$/.test(e.key)) {
        handlers.onDigit?.(parseInt(e.key, 10));
      }
    };

    const onPointer = () => {
      document.querySelector(".m3u-shell")?.classList.remove("remote-nav");
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onPointer, { passive: true });
    window.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onPointer);
      window.removeEventListener("touchstart", onPointer);
    };
  }, [handlers]);
}

/** Auto-detect TV: large screen, no fine pointer, or explicit UA. */
export function detectTv() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  if (/(smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast|tizen|web0s|webos|android\s?tv|bravia|aftt|aftb|afts|aftm|nexus\s?player|shield)/.test(ua)) return true;
  // Explicit override via query string (?tv=1) — used by the Capacitor Android TV wrapper.
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tv") === "1" || params.get("device") === "tv") return true;
    // Persistent flag set by the native wrapper on first load.
    if (window.localStorage.getItem("streamflow_force_tv") === "1") return true;
  } catch { /* ignore */ }
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const wide = window.innerWidth >= 1440;
  // A phone is coarse+noHover+narrow; a TV is coarse+noHover+wide, or big screen without touch.
  if (wide && !window.matchMedia("(pointer: fine)").matches) return true;
  if (wide && coarse && noHover) return true;
  return false;
}

export function detectMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}