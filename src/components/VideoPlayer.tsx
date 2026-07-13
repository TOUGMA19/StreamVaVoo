import { useEffect, useRef, useState, useCallback } from 'react';
import type { M3UChannel } from '../utils/m3uParser';
import Hls from 'hls.js';
import {
  Maximize, Minimize, ExternalLink, SkipBack, SkipForward,
  RefreshCw, AlertCircle, Play, Pause, Volume2, VolumeX, Loader2,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { proxyUrl, proxyImage } from '../utils/proxy';

interface VideoPlayerProps {
  channel: M3UChannel | null;
  onNext?: () => void;
  onPrevious?: () => void;
}

function isProbablyHls(url: string) {
  const l = url.toLowerCase();
  return (
    l.includes('.m3u8') ||
    l.includes('.m3u') ||
    l.includes('/hls/') ||
    l.includes('/live/') ||
    l.includes('/play/') ||
    l.includes('type=m3u') ||
    l.includes('output=ts') ||
    l.includes('/stream/')
  );
}

function isProbablyDirectMedia(url: string) {
  return /\.(mp4|webm|mkv|mov|ogv|ts|aac|mp3)(\?|$)/i.test(url);
}

export default function VideoPlayer({ channel, onNext, onPrevious }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [useIframe, setUseIframe] = useState(false);

  // Decide render mode: native <video> for streams, iframe for plain web pages.
  useEffect(() => {
    if (!channel) return;
    const playable = isProbablyHls(channel.url) || isProbablyDirectMedia(channel.url);
    setUseIframe(!playable);
    setError(null);
    setLoading(true);
    setAttempt(0);
  }, [channel?.url]);

  // HLS / video loader with retry ladder.
  const loadVideo = useCallback((tryN: number) => {
    const video = videoRef.current;
    const ch = channel;
    if (!video || !ch || useIframe) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setError(null); setLoading(true); setAttempt(tryN);

    const src = proxyUrl(ch.url);

    const scheduleRetry = (msg: string) => {
      if (tryN >= 4) { setError(msg); setLoading(false); return; }
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => loadVideo(tryN + 1), Math.min(800 * 2 ** tryN, 5000));
    };

    try {
      if (isProbablyHls(ch.url) && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startFragPrefetch: true,
          backBufferLength: 30,
          manifestLoadingMaxRetry: 4,
          manifestLoadingRetryDelay: 800,
          levelLoadingMaxRetry: 4,
          levelLoadingRetryDelay: 800,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 800,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          video.play().then(() => setIsPlaying(true)).catch(() => {
            // Autoplay refused — mute and retry (mobile / TV browsers).
            video.muted = true; setMuted(true);
            video.play().then(() => setIsPlaying(true)).catch(() => {});
          });
        });
        hls.on(Hls.Events.ERROR, (_e: unknown, data: { fatal?: boolean; type?: string }) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { scheduleRetry('Erreur réseau'); return; }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { try { hls.recoverMediaError(); } catch { scheduleRetry('Erreur média'); } return; }
          scheduleRetry('Flux illisible');
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl') && isProbablyHls(ch.url)) {
        // Safari native HLS
        video.src = src;
        const ok = () => { setLoading(false); video.play().then(() => setIsPlaying(true)).catch(() => { video.muted = true; setMuted(true); video.play().catch(() => {}); }); };
        video.addEventListener('loadedmetadata', ok, { once: true });
        video.addEventListener('error', () => scheduleRetry('Erreur Safari HLS'), { once: true });
      } else {
        // Direct file
        video.src = src;
        const ok = () => { setLoading(false); video.play().then(() => setIsPlaying(true)).catch(() => { video.muted = true; setMuted(true); video.play().catch(() => {}); }); };
        video.addEventListener('loadedmetadata', ok, { once: true });
        video.addEventListener('error', () => scheduleRetry('Erreur de lecture'), { once: true });
      }
    } catch {
      scheduleRetry('Erreur critique');
    }
  }, [channel, useIframe]);

  useEffect(() => {
    if (!channel || useIframe) return;
    loadVideo(0);
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      const v = videoRef.current;
      if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* noop */ } }
    };
  }, [channel?.url, useIframe, loadVideo]);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    else document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
  };
  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play().then(() => setIsPlaying(true)).catch(() => {}); }
    else { v.pause(); setIsPlaying(false); }
  };
  const toggleMute = () => {
    const v = videoRef.current; if (!v) return;
    v.muted = !v.muted; setMuted(v.muted);
  };
  const openExternal = () => {
    if (!channel) return;
    window.open(channel.url, '_blank', 'noopener,noreferrer');
  };

  if (!channel) return null;

  const logo = proxyImage(channel.tvgLogo);

  return (
    <div ref={containerRef} id="player-container" className="relative w-full rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-black/60 border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {logo ? (
            <img src={logo} alt="" loading="lazy" decoding="async" className="w-9 h-9 rounded-lg object-cover bg-white/10 shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[color:var(--brand-500)]/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[color:var(--brand-300)]">{channel.displayName.charAt(0)}</span>
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm sm:text-base truncate">{channel.displayName}</h3>
            <p className="text-stone-400 text-[11px] truncate">{channel.groupTitle}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-[10px] font-semibold tracking-wider">LIVE</span>
        </span>
      </div>

      {/* Video / iframe surface */}
      <div className="relative aspect-video bg-black">
        {useIframe ? (
          <iframe
            key={channel.url}
            src={channel.url}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            referrerPolicy="no-referrer"
            title={channel.displayName}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError('Iframe bloquée par le site distant'); }}
          />
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full bg-black"
            playsInline
            autoPlay
            controls={false}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setLoading(true)}
            onPlaying={() => setLoading(false)}
            onClick={togglePlay}
          />
        )}

        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
            <div className="text-center">
              <Loader2 className="w-12 h-12 mx-auto text-[color:var(--brand-500)] animate-spin" />
              <p className="text-white/80 text-sm mt-3">Chargement du flux…</p>
              {attempt > 0 && <p className="text-white/50 text-xs mt-1">Tentative {attempt + 1}/5 — contournement des blocages</p>}
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm">
            <div className="text-center p-6 max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/15 flex items-center justify-center border border-red-500/30">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-white font-bold mb-2">{error}</h3>
              <p className="text-stone-400 text-sm mb-5">Le proxy anti-blocage a échoué. Réessaie ou ouvre le lien directement.</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button data-focusable onClick={() => loadVideo(0)} className="px-5 py-2.5 btn-brand rounded-xl text-sm font-semibold flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Réessayer
                </button>
                <button data-focusable onClick={openExternal} className="px-5 py-2.5 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-medium flex items-center gap-2 border border-white/15">
                  <ExternalLink className="w-4 h-4" /> Ouvrir le lien
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-black/60 border-t border-white/5 backdrop-blur-sm">
        <button data-focusable onClick={onPrevious} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-300 hover:text-white transition-all" title="Chaîne précédente">
          <SkipBack className="w-4 h-4" />
        </button>
        {!useIframe && (
          <button data-focusable onClick={togglePlay} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-300 hover:text-white transition-all" title="Lecture / Pause">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        )}
        <button data-focusable onClick={onNext} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-300 hover:text-white transition-all" title="Chaîne suivante">
          <SkipForward className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        {!useIframe && (
          <button data-focusable onClick={toggleMute} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-300 hover:text-white transition-all" title="Muet">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}
        <button data-focusable onClick={() => loadVideo(0)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-300 hover:text-white transition-all" title="Recharger">
          <RefreshCw className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button data-focusable onClick={openExternal} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-300 hover:text-white transition-all" title="Ouvrir">
          <ExternalLink className="w-4 h-4" />
        </button>
        <button data-focusable onClick={toggleFullscreen} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-300 hover:text-white transition-all" title="Plein écran">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
