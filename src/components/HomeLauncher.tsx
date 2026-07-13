import { Tv, Film, Clapperboard, Star, Upload, RefreshCw, Settings, Radio } from 'lucide-react';
import type { M3UChannel } from '../utils/m3uParser';
import { cn } from '../utils/cn';
import logo from '../assets/logo.png';

interface HomeLauncherProps {
  channels: M3UChannel[];
  favorites: Set<string>;
  recent: M3UChannel[];
  onOpenLive: () => void;
  onOpenFavorites: () => void;
  onOpenRecent: () => void;
  onOpenGroup: (group: string) => void;
  onImport: () => void;
  onClear: () => void;
  isTv: boolean;
}

function classifyGroup(name: string): 'movies' | 'series' | 'live' | 'other' {
  const n = name.toLowerCase();
  if (/(vod|film|movie|cin[eé]ma)/.test(n)) return 'movies';
  if (/(s[eé]rie|serie|show|tv show)/.test(n)) return 'series';
  if (/(sport|news|tv|live|actu|kids|music|doc|entert)/.test(n)) return 'live';
  return 'other';
}

export default function HomeLauncher({
  channels, favorites, recent,
  onOpenLive, onOpenFavorites, onOpenRecent, onOpenGroup,
  onImport, onClear, isTv,
}: HomeLauncherProps) {
  const byKind = { movies: [] as M3UChannel[], series: [] as M3UChannel[], live: [] as M3UChannel[], other: [] as M3UChannel[] };
  for (const ch of channels) byKind[classifyGroup(ch.groupTitle)].push(ch);

  const now = new Date().toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="ibo-bg -m-3 sm:-m-4 rounded-3xl p-4 sm:p-8 relative overflow-hidden">
      {/* Header brand */}
      <div className="flex items-center gap-4 mb-6 sm:mb-10 tile-in">
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0">
          <div className="absolute inset-0 rounded-2xl bg-[color:var(--brand-500)]/50 blur-xl animate-logo-glow" />
          <img src={logo} alt="StreamFlow" className="relative w-full h-full rounded-2xl shadow-2xl" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className={cn('font-display font-black shimmer-text truncate', isTv ? 'text-5xl' : 'text-2xl sm:text-4xl')}>
            StreamFlow <span className="opacity-80">PRO</span>
          </h1>
          <p className="text-white/60 text-xs sm:text-sm capitalize truncate">{now}</p>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-widest">Chaînes</p>
            <p className="text-white font-bold text-2xl">{channels.length}</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-widest">Favoris</p>
            <p className="text-[color:var(--brand-300)] font-bold text-2xl">{favorites.size}</p>
          </div>
        </div>
      </div>

      {/* IBO tile grid — 2 columns on mobile, 3 on desktop; big Live TV tile spans 2 rows */}
      <div
        className={cn(
          'grid gap-3 sm:gap-5',
          isTv ? 'grid-cols-3 auto-rows-[minmax(180px,1fr)]' : 'grid-cols-2 sm:grid-cols-3 auto-rows-[minmax(140px,1fr)] sm:auto-rows-[minmax(170px,1fr)]',
        )}
      >
        <button
          data-focusable
          onClick={onOpenLive}
          className="ibo-tile primary tile-in col-span-2 row-span-2 p-6 sm:p-8 flex flex-col justify-between text-left"
          style={{ animationDelay: '0ms' }}
        >
          <div className="flex items-center gap-3">
            <Tv className={cn('shrink-0', isTv ? 'w-14 h-14' : 'w-10 h-10 sm:w-12 sm:h-12')} strokeWidth={1.6} />
            <span className="text-white/70 text-[10px] sm:text-xs font-semibold tracking-[0.2em]">DIRECT</span>
          </div>
          <div>
            <p className={cn('font-display font-black leading-none', isTv ? 'text-6xl' : 'text-4xl sm:text-6xl')}>Live TV</p>
            <p className="mt-2 text-white/80 text-xs sm:text-base">
              {byKind.live.length + byKind.other.length} chaînes prêtes à lire — anti-blocage activé
            </p>
          </div>
        </button>

        <button data-focusable onClick={() => onOpenGroup('__movies__')} className="ibo-tile tile-in p-4 sm:p-5 flex flex-col justify-between text-left" style={{ animationDelay: '60ms' }}>
          <Film className={cn('text-[color:var(--brand-300)]', isTv ? 'w-12 h-12' : 'w-8 h-8 sm:w-10 sm:h-10')} strokeWidth={1.6} />
          <div>
            <p className={cn('font-display font-bold', isTv ? 'text-3xl' : 'text-lg sm:text-2xl')}>Movies</p>
            <p className="text-white/60 text-[11px] sm:text-sm">{byKind.movies.length} titres</p>
          </div>
        </button>

        <button data-focusable onClick={() => onOpenGroup('__series__')} className="ibo-tile tile-in p-4 sm:p-5 flex flex-col justify-between text-left" style={{ animationDelay: '120ms' }}>
          <Clapperboard className={cn('text-[color:var(--brand-300)]', isTv ? 'w-12 h-12' : 'w-8 h-8 sm:w-10 sm:h-10')} strokeWidth={1.6} />
          <div>
            <p className={cn('font-display font-bold', isTv ? 'text-3xl' : 'text-lg sm:text-2xl')}>Series</p>
            <p className="text-white/60 text-[11px] sm:text-sm">{byKind.series.length} séries</p>
          </div>
        </button>

        <button data-focusable onClick={onOpenFavorites} className="ibo-tile tile-in p-4 sm:p-5 flex flex-col justify-between text-left" style={{ animationDelay: '180ms' }}>
          <Star className={cn('text-[color:var(--brand-300)]', isTv ? 'w-12 h-12' : 'w-8 h-8 sm:w-10 sm:h-10')} strokeWidth={1.6} />
          <div>
            <p className={cn('font-display font-bold', isTv ? 'text-3xl' : 'text-lg sm:text-2xl')}>Favoris</p>
            <p className="text-white/60 text-[11px] sm:text-sm">{favorites.size} chaînes</p>
          </div>
        </button>

        <button data-focusable onClick={onOpenRecent} className="ibo-tile tile-in p-4 sm:p-5 flex flex-col justify-between text-left" style={{ animationDelay: '240ms' }}>
          <Radio className={cn('text-[color:var(--brand-300)]', isTv ? 'w-12 h-12' : 'w-8 h-8 sm:w-10 sm:h-10')} strokeWidth={1.6} />
          <div>
            <p className={cn('font-display font-bold', isTv ? 'text-3xl' : 'text-lg sm:text-2xl')}>Récents</p>
            <p className="text-white/60 text-[11px] sm:text-sm">{recent.length} vus</p>
          </div>
        </button>

        <button data-focusable onClick={onImport} className="ibo-tile tile-in p-4 sm:p-5 flex flex-col justify-between text-left" style={{ animationDelay: '300ms' }}>
          <Upload className={cn('text-[color:var(--brand-300)]', isTv ? 'w-12 h-12' : 'w-8 h-8 sm:w-10 sm:h-10')} strokeWidth={1.6} />
          <div>
            <p className={cn('font-display font-bold', isTv ? 'text-3xl' : 'text-lg sm:text-2xl')}>Import M3U</p>
            <p className="text-white/60 text-[11px] sm:text-sm">Fichier ou URL</p>
          </div>
        </button>

        <button data-focusable onClick={onClear} className="ibo-tile tile-in p-4 sm:p-5 flex flex-col justify-between text-left" style={{ animationDelay: '360ms' }}>
          <RefreshCw className={cn('text-[color:var(--brand-300)]', isTv ? 'w-12 h-12' : 'w-8 h-8 sm:w-10 sm:h-10')} strokeWidth={1.6} />
          <div>
            <p className={cn('font-display font-bold', isTv ? 'text-3xl' : 'text-lg sm:text-2xl')}>Reset</p>
            <p className="text-white/60 text-[11px] sm:text-sm">Vider la playlist</p>
          </div>
        </button>

        <button data-focusable onClick={onOpenLive} className="ibo-tile tile-in p-4 sm:p-5 flex flex-col justify-between text-left" style={{ animationDelay: '420ms' }}>
          <Settings className={cn('text-[color:var(--brand-300)]', isTv ? 'w-12 h-12' : 'w-8 h-8 sm:w-10 sm:h-10')} strokeWidth={1.6} />
          <div>
            <p className={cn('font-display font-bold', isTv ? 'text-3xl' : 'text-lg sm:text-2xl')}>Serveur</p>
            <p className="text-white/60 text-[11px] sm:text-sm">Anti-block ON</p>
          </div>
        </button>
      </div>

      <p className="mt-6 sm:mt-8 text-center text-white/40 text-[11px] sm:text-xs">
        Utilise la télécommande D-Pad ▲ ▼ ◄ ► puis OK — Retour pour revenir au menu.
      </p>
    </div>
  );
}
