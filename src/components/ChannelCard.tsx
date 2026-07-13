import type { M3UChannel } from '../utils/m3uParser';
import { Play, Star, StarOff, ExternalLink } from 'lucide-react';
import { cn } from '../utils/cn';
import { proxyImage } from '../utils/proxy';

interface ChannelCardProps {
  channel: M3UChannel;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: (channel: M3UChannel) => void;
  onToggleFavorite: (channel: M3UChannel) => void;
  viewMode: 'grid' | 'list';
}

export default function ChannelCard({ channel, isActive, isFavorite, onSelect, onToggleFavorite, viewMode }: ChannelCardProps) {
  const openExternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(channel.url, '_blank', 'noopener,noreferrer');
  };
  const logoSrc = proxyImage(channel.tvgLogo);

  if (viewMode === 'list') {
    return (
      <div
        className={cn(
          'group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 cv-auto',
          isActive
            ? 'bg-[color:var(--brand-500)]/20 border border-[color:var(--brand-500)]/50 shadow-lg shadow-[color:var(--brand-glow)]'
            : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/10'
        )}
        data-focusable
        tabIndex={0}
        onClick={() => onSelect(channel)}
      >
        {/* Logo */}
        <div className={cn(
          'w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden',
          isActive ? 'bg-[color:var(--brand-500)]/25' : 'bg-white/5'
        )}>
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const fallback = img.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
          ) : null}
          <span className={cn('text-lg font-bold', logoSrc ? 'hidden' : '', isActive ? 'text-[color:var(--brand-300)]' : 'text-stone-500')}>
            {channel.displayName.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className={cn(
            'font-medium text-sm truncate',
            isActive ? 'text-[color:var(--brand-300)]' : 'text-white'
          )}>
            {channel.displayName}
          </h4>
          <p className="text-[11px] text-stone-500 truncate font-mono">{channel.url}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel); }}
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center transition-all',
              isFavorite ? 'text-yellow-400 hover:text-yellow-300' : 'text-stone-600 hover:text-stone-400 opacity-0 group-hover:opacity-100'
            )}
            title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            {isFavorite ? <Star className="w-3.5 h-3.5 fill-current" /> : <StarOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={openExternal}
            className="w-7 h-7 rounded-full flex items-center justify-center text-stone-600 hover:text-amber-300 opacity-0 group-hover:opacity-100 transition-all"
            title="Ouvrir dans un nouvel onglet"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center transition-all',
            isActive ? 'btn-brand text-white' : 'bg-white/5 text-stone-400 opacity-0 group-hover:opacity-100'
          )}>
            <Play className="w-3 h-3 ml-0.5" />
          </div>
        </div>
      </div>
    );
  }

  // Grid mode
  return (
    <div
      className={cn(
        'group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border cv-auto',
        isActive
          ? 'ring-2 ring-[color:var(--brand-500)] shadow-lg shadow-[color:var(--brand-glow)] scale-[1.02] border-[color:var(--brand-500)]/50'
          : 'hover:scale-[1.02] hover:shadow-lg border-white/[0.06] hover:border-white/10'
      )}
      data-focusable
      tabIndex={0}
      onClick={() => onSelect(channel)}
    >
      {/* Card background */}
      <div className={cn(
        'aspect-[4/3] flex items-center justify-center p-4 relative',
        isActive
          ? 'bg-gradient-to-br from-red-950/40 to-red-900/20'
          : 'bg-gradient-to-br from-white/[0.05] to-white/[0.02]'
      )}>
        {/* Logo */}
        {logoSrc ? (
          <img
            src={logoSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-16 h-16 object-contain rounded-xl"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.display = 'none';
              const fallback = img.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={cn(
          'w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold',
          logoSrc ? 'hidden' : '',
          isActive ? 'bg-[color:var(--brand-500)]/25 text-[color:var(--brand-300)]' : 'bg-white/5 text-stone-500'
        )}>
          {channel.displayName.charAt(0).toUpperCase()}
        </div>

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <div className="w-11 h-11 rounded-full btn-brand flex items-center justify-center" title="Charger dans le lecteur">
            <Play className="w-5 h-5 text-white ml-0.5" />
          </div>
          <button
            onClick={openExternal}
            className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
            title="Ouvrir dans un nouvel onglet"
          >
            <ExternalLink className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Favorite button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel); }}
          className={cn(
            'absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all',
            isFavorite
              ? 'text-yellow-400 bg-black/40 backdrop-blur-sm'
              : 'text-white/50 opacity-0 group-hover:opacity-100 bg-black/30 backdrop-blur-sm'
          )}
        >
          {isFavorite ? <Star className="w-3.5 h-3.5 fill-current" /> : <Star className="w-3.5 h-3.5" />}
        </button>

        {/* Active indicator */}
        {isActive && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-orange-300 text-[10px] font-bold">ACTIF</span>
          </div>
        )}
      </div>

      {/* Card info */}
      <div className={cn(
        'p-3 border-t',
        isActive ? 'bg-orange-950/20 border-orange-500/20' : 'bg-white/[0.02] border-white/[0.05]'
      )}>
        <h4 className={cn(
          'font-semibold text-xs truncate',
          isActive ? 'text-orange-300' : 'text-white'
        )}>
          {channel.displayName}
        </h4>
        <p className="text-[10px] text-stone-500 mt-0.5 truncate">{channel.groupTitle}</p>
      </div>
    </div>
  );
}
