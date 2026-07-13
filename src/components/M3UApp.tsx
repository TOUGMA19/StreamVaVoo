import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { parseM3U, DEFAULT_M3U } from "../utils/m3uParser";
import type { M3UChannel } from "../utils/m3uParser";
import VideoPlayer from "./VideoPlayer";
import Sidebar from "./PlayerSidebar";
import HomeLauncher from "./HomeLauncher";
import { Menu, X, ChevronLeft, Tv, Smartphone, Monitor, Home } from "lucide-react";
import { cn } from "../utils/cn";
import logo from "../assets/logo.png";
import { useRemoteControl, detectTv, detectMobile } from "../hooks/useRemoteControl";
import { fetchViaProxy } from "../utils/proxy";

const STORAGE_KEYS = {
  favorites: "streamflow_favorites",
  recent: "streamflow_recent",
  playlist: "streamflow_playlist",
  device: "streamflow_device_pref",
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch { return fallback; }
}
function saveToStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

type DeviceMode = "auto" | "mobile" | "desktop" | "tv";

export default function M3UApp() {
  const [channels, setChannels] = useState<M3UChannel[]>(() => {
    const saved = loadFromStorage<string>(STORAGE_KEYS.playlist, "");
    return saved ? parseM3U(saved) : parseM3U(DEFAULT_M3U);
  });
  const [activeChannel, setActiveChannel] = useState<M3UChannel | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(loadFromStorage<string[]>(STORAGE_KEYS.favorites, [])));
  const [recentChannels, setRecentChannels] = useState<M3UChannel[]>(() => loadFromStorage<M3UChannel[]>(STORAGE_KEYS.recent, []));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTv, setIsTv] = useState(false);
  const [devicePref, setDevicePref] = useState<DeviceMode>(() => loadFromStorage<DeviceMode>(STORAGE_KEYS.device, "auto"));
  const [hint, setHint] = useState<string | null>(null);
  const digitBufferRef = useRef<string>("");
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  // Responsive detection
  useEffect(() => {
    const compute = () => {
      let mobile = false, tv = false;
      if (devicePref === "auto") { mobile = detectMobile(); tv = detectTv(); }
      else if (devicePref === "mobile") mobile = true;
      else if (devicePref === "tv") tv = true;
      setIsMobile(mobile);
      setIsTv(tv);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, [devicePref]);

  useEffect(() => { saveToStorage(STORAGE_KEYS.favorites, Array.from(favorites)); }, [favorites]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.recent, recentChannels); }, [recentChannels]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.device, devicePref); }, [devicePref]);

  const showHint = useCallback((msg: string) => {
    setHint(msg);
    setTimeout(() => setHint(null), 1600);
  }, []);

  const handleSelectChannel = useCallback((channel: M3UChannel) => {
    setActiveChannel(channel);
    setRecentChannels((prev) => [channel, ...prev.filter((c) => c.id !== channel.id)].slice(0, 20));
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const handleToggleFavorite = useCallback((channel: M3UChannel) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(channel.id)) next.delete(channel.id); else next.add(channel.id);
      return next;
    });
  }, []);

  const handleLoadFile = useCallback((content: string) => {
    const parsed = parseM3U(content);
    if (parsed.length > 0) {
      setChannels(parsed); setActiveChannel(null);
      saveToStorage(STORAGE_KEYS.playlist, content);
    }
  }, []);

  const handleLoadUrl = useCallback((url: string) => {
    fetchViaProxy(url, { retries: 4, timeoutMs: 30_000 })
      .then((content) => {
        const parsed = parseM3U(content);
        if (parsed.length > 0) {
          setChannels(parsed);
          setActiveChannel(null);
          saveToStorage(STORAGE_KEYS.playlist, content);
        }
      })
      .catch((e) => console.error("Failed M3U URL:", e));
  }, []);

  const handleClearPlaylist = useCallback(() => {
    setChannels([]); setActiveChannel(null);
    localStorage.removeItem(STORAGE_KEYS.playlist);
  }, []);

  const goHome = useCallback(() => {
    setActiveChannel(null);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const openImport = useCallback(() => {
    setSidebarOpen(true);
    // The import modal is inside the sidebar; toggle via a custom event.
    setTimeout(() => window.dispatchEvent(new CustomEvent('streamflow:open-import')), 30);
  }, []);

  const openGroupByKind = useCallback((token: string) => {
    setSidebarOpen(true);
    const kind = token.replace(/__/g, '');
    window.dispatchEvent(new CustomEvent('streamflow:filter', { detail: { kind } }));
  }, []);

  const openFavorites = useCallback(() => {
    setSidebarOpen(true);
    window.dispatchEvent(new CustomEvent('streamflow:filter', { detail: { kind: 'favorites' } }));
  }, []);

  const openRecent = useCallback(() => {
    setSidebarOpen(true);
    window.dispatchEvent(new CustomEvent('streamflow:filter', { detail: { kind: 'recent' } }));
  }, []);

  const handleNext = useCallback(() => {
    if (channels.length === 0) return;
    const idx = activeChannel ? channels.findIndex((c) => c.id === activeChannel.id) : -1;
    handleSelectChannel(channels[(idx + 1) % channels.length]);
  }, [activeChannel, channels, handleSelectChannel]);

  const handlePrevious = useCallback(() => {
    if (channels.length === 0) return;
    const idx = activeChannel ? channels.findIndex((c) => c.id === activeChannel.id) : 0;
    handleSelectChannel(channels[(idx - 1 + channels.length) % channels.length]);
  }, [activeChannel, channels, handleSelectChannel]);

  // Remote control / phone keys
  useRemoteControl({
    onBack: () => {
      if (isMobile && sidebarOpen) { setSidebarOpen(false); return; }
      if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
      if (activeChannel) { setActiveChannel(null); showHint("Retour à l’accueil"); }
    },
    onPlayPause: () => {
      const v = document.querySelector<HTMLVideoElement>("#player-container video");
      if (v) { if (v.paused) v.play(); else v.pause(); showHint(v.paused ? "▶︎ Lecture" : "❚❚ Pause"); }
    },
    onNext: () => { handleNext(); showHint("Chaîne suivante"); },
    onPrevious: () => { handlePrevious(); showHint("Chaîne précédente"); },
    onVolumeUp: () => {
      const v = document.querySelector<HTMLVideoElement>("#player-container video");
      if (v) { v.volume = Math.min(1, v.volume + 0.1); showHint(`Volume ${Math.round(v.volume*100)}%`); }
    },
    onVolumeDown: () => {
      const v = document.querySelector<HTMLVideoElement>("#player-container video");
      if (v) { v.volume = Math.max(0, v.volume - 0.1); showHint(`Volume ${Math.round(v.volume*100)}%`); }
    },
    onRed: () => { if (activeChannel) { handleToggleFavorite(activeChannel); showHint("★ Favori basculé"); } },
    onGreen: () => { setSidebarOpen((s) => !s); },
    onYellow: () => {
      if (activeChannel) window.open(activeChannel.url, "_blank", "noopener,noreferrer");
    },
    onBlue: () => { document.getElementById("player-container")?.requestFullscreen?.().catch(() => {}); },
    onDigit: (n) => {
      digitBufferRef.current += String(n);
      if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
      digitTimerRef.current = setTimeout(() => {
        const idx = parseInt(digitBufferRef.current, 10) - 1;
        digitBufferRef.current = "";
        if (!isNaN(idx) && idx >= 0 && idx < channels.length) {
          handleSelectChannel(channels[idx]);
          showHint(`Chaîne ${idx + 1}`);
        }
      }, 700);
      showHint(`→ ${digitBufferRef.current}`);
    },
  });

  const recentAsChannels = useMemo(() => recentChannels, [recentChannels]);

  // Swipe gestures on player (phones)
  const playerAreaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isMobile) return;
    const el = playerAreaRef.current;
    if (!el) return;
    let startX = 0, startY = 0, tracking = false;
    const onStart = (e: PointerEvent) => { startX = e.clientX; startY = e.clientY; tracking = true; };
    const onEnd = (e: PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) { handleNext(); showHint("↤ Suivante"); }
        else { handlePrevious(); showHint("↦ Précédente"); }
      }
    };
    el.addEventListener("pointerdown", onStart);
    el.addEventListener("pointerup", onEnd);
    el.addEventListener("pointercancel", () => { tracking = false; });
    return () => {
      el.removeEventListener("pointerdown", onStart);
      el.removeEventListener("pointerup", onEnd);
    };
  }, [isMobile, handleNext, handlePrevious]);

  // Edge swipe: open sidebar from left edge on mobile
  useEffect(() => {
    if (!isMobile) return;
    let sx = 0, active = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches[0].clientX < 24) { sx = e.touches[0].clientX; active = true; }
    };
    const onMove = (e: TouchEvent) => {
      if (active && e.touches[0].clientX - sx > 60) { setSidebarOpen(true); active = false; }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
    };
  }, [isMobile]);

  return (
    <div
      ref={shellRef}
      className={cn(
        "m3u-shell relative flex h-screen w-screen overflow-hidden bg-[#0a0704] text-white",
        isTv && "tv-mode"
      )}
    >
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,122,18,0.10),transparent)]" />
        <div className="absolute top-0 left-1/4 w-[550px] h-[550px] bg-orange-600/[0.06] rounded-full blur-[130px] animate-float-slow" />
        <div className="absolute bottom-0 right-1/4 w-[550px] h-[550px] bg-amber-500/[0.05] rounded-full blur-[130px] animate-float-slow-rev" />
      </div>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={cn(
        "relative z-40 flex-shrink-0 border-r border-orange-500/[0.08] transition-all duration-300 bg-[#0c0805]/95 backdrop-blur-xl",
        isMobile
          ? cn("fixed inset-y-0 left-0 w-[85vw] max-w-sm", sidebarOpen ? "translate-x-0" : "-translate-x-full")
          : isTv
            ? cn(sidebarOpen ? "w-[420px]" : "w-0 overflow-hidden border-r-0")
            : cn(sidebarOpen ? "w-80" : "w-0 overflow-hidden border-r-0")
      )}>
        <Sidebar
          channels={channels}
          activeChannel={activeChannel}
          favorites={favorites}
          recentChannels={recentChannels}
          onSelectChannel={handleSelectChannel}
          onToggleFavorite={handleToggleFavorite}
          onLoadFile={handleLoadFile}
          onLoadUrl={handleLoadUrl}
          onClearPlaylist={handleClearPlaylist}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top bar */}
        <div className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl flex-shrink-0",
          isTv ? "px-6 py-4" : "px-3 py-3 sm:px-4"
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              data-focusable
              onClick={() => setSidebarOpen((s) => !s)}
              aria-label={sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
              className={cn(
                "touch-target shrink-0 rounded-xl bg-white/[0.05] hover:bg-[color:var(--brand-500)]/10 border border-white/[0.06] hover:border-[color:var(--brand-500)]/40 flex items-center justify-center text-stone-300 hover:text-[color:var(--brand-300)] transition-all",
                isTv ? "w-14 h-14" : "w-11 h-11"
              )}
            >
              {sidebarOpen ? (isMobile ? <X className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />) : <Menu className="w-5 h-5" />}
            </button>
            {activeChannel && (
              <button
                data-focusable
                onClick={goHome}
                aria-label="Retour à l'accueil"
                className={cn(
                  "touch-target shrink-0 rounded-xl bg-white/[0.05] hover:bg-[color:var(--brand-500)]/10 border border-white/[0.06] hover:border-[color:var(--brand-500)]/40 flex items-center justify-center text-stone-300 hover:text-[color:var(--brand-300)] transition-all",
                  isTv ? "w-14 h-14" : "w-11 h-11"
                )}
                title="Accueil"
              >
                <Home className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={logo} alt="StreamFlow" className={cn("rounded-[9px] shrink-0 animate-logo-glow", isTv ? "w-10 h-10" : "w-8 h-8")} />
              <h1 className={cn("text-white font-display font-semibold truncate", isTv ? "text-xl" : "text-sm")}>
                {activeChannel ? activeChannel.displayName : "StreamFlow PRO"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-3 mr-2 text-center">
              <div>
                <p className="text-stone-500 text-[10px] uppercase tracking-wider">Chaînes</p>
                <p className="text-white font-bold text-sm">{channels.length}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-stone-500 text-[10px] uppercase tracking-wider">Favoris</p>
                <p className="text-amber-400 font-bold text-sm">{favorites.size}</p>
              </div>
            </div>

            {/* Device switcher */}
            <div className="flex gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
              {([
                { k: "auto" as DeviceMode, label: "Auto", icon: null },
                { k: "mobile" as DeviceMode, label: "Mobile", icon: <Smartphone className="w-3.5 h-3.5" /> },
                { k: "desktop" as DeviceMode, label: "PC", icon: <Monitor className="w-3.5 h-3.5" /> },
                { k: "tv" as DeviceMode, label: "TV", icon: <Tv className="w-3.5 h-3.5" /> },
              ]).map((opt) => (
                <button
                  key={opt.k}
                  data-focusable
                  onClick={() => setDevicePref(opt.k)}
                  className={cn(
                    "touch-target px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1",
                    devicePref === opt.k ? "bg-[color:var(--brand-500)]/30 text-[color:var(--brand-300)]" : "text-stone-400 hover:text-white"
                  )}
                  title={`Mode ${opt.label}`}
                >
                  {opt.icon}
                  <span className={isTv ? "" : "hidden sm:inline"}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div ref={playerAreaRef} className={cn("flex-1 min-h-0 overflow-y-auto smooth-scroll", isTv ? "p-6" : "p-3 sm:p-4")}>
          <div className={cn("mx-auto", isTv ? "max-w-[1600px]" : "max-w-6xl")}>
            {activeChannel ? (
              <VideoPlayer channel={activeChannel} onNext={handleNext} onPrevious={handlePrevious} />
            ) : (
              <HomeLauncher
                channels={channels}
                favorites={favorites}
                recent={recentAsChannels}
                onOpenLive={() => setSidebarOpen(true)}
                onOpenFavorites={openFavorites}
                onOpenRecent={openRecent}
                onOpenGroup={openGroupByKind}
                onImport={openImport}
                onClear={handleClearPlaylist}
                isTv={isTv}
              />
            )}

            {(isTv || (!isMobile && !activeChannel)) && (
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-stone-400">
                {[
                  ["◀ ▶", "Chaîne préc./suiv."],
                  ["OK / Entrée", "Lire"],
                  ["Retour", "Fermer"],
                  ["Play/Pause", "Lecture"],
                  ["🔴 Rouge", "Favori"],
                  ["🟢 Vert", "Menu"],
                  ["🟡 Jaune", "Ouvrir lien"],
                  ["🔵 Bleu", "Plein écran"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">{k}</kbd>
                    <span className="truncate">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {hint && <div className="remote-hint">{hint}</div>}
    </div>
  );
}