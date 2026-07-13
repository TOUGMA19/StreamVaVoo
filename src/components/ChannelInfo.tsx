import type { M3UChannel } from '../utils/m3uParser';
import { Globe, Tag, Hash, Link2, Star, ExternalLink, Copy, Check, Play } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../utils/cn';

interface ChannelInfoProps {
  channel: M3UChannel | null;
  isFavorite: boolean;
  onToggleFavorite: (channel: M3UChannel) => void;
}

export default function ChannelInfo({ channel, isFavorite, onToggleFavorite }: ChannelInfoProps) {
  const [copied, setCopied] = useState(false);

  if (!channel) return null;

  const copyUrl = () => {
    navigator.clipboard.writeText(channel.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const openExternal = () => {
    window.open(channel.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-white/[0.02] border border-orange-500/[0.08] rounded-2xl p-5 backdrop-blur-sm">
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-400/10 border border-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {channel.tvgLogo ? (
            <img
              src={channel.tvgLogo}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="text-2xl font-bold text-orange-400">
              {channel.displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-white font-bold text-lg truncate">{channel.displayName}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-medium">
                  <Tag className="w-2.5 h-2.5" />
                  {channel.groupTitle}
                </span>
                <span className="flex items-center gap-1 text-stone-500 text-[10px]">
                  <Hash className="w-2.5 h-2.5" />
                  {channel.tvgId || 'N/A'}
                </span>
              </div>
            </div>
            <button
              onClick={() => onToggleFavorite(channel)}
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center transition-all border flex-shrink-0',
                isFavorite
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  : 'bg-white/[0.03] border-white/[0.06] text-stone-500 hover:text-yellow-400 hover:bg-yellow-500/10'
              )}
            >
              <Star className={cn('w-4 h-4', isFavorite && 'fill-current')} />
            </button>
          </div>
        </div>
      </div>

      {/* Infos détaillées */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-medium uppercase tracking-wider mb-1">
            <Globe className="w-3 h-3" />
            TVG Name
          </div>
          <p className="text-white text-xs truncate">{channel.tvgName || 'Non défini'}</p>
        </div>
        <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-medium uppercase tracking-wider mb-1">
            <Hash className="w-3 h-3" />
            TVG ID
          </div>
          <p className="text-white text-xs truncate">{channel.tvgId || 'Non défini'}</p>
        </div>
      </div>

      {/* URL du lien */}
      <div className="mt-3 bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-medium uppercase tracking-wider">
            <Link2 className="w-3 h-3" />
            Lien de la chaîne
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={copyUrl}
              className="p-1.5 rounded-lg hover:bg-white/5 text-stone-500 hover:text-stone-300 transition-colors"
              title="Copier le lien"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
            <button
              onClick={openExternal}
              className="p-1.5 rounded-lg hover:bg-white/5 text-stone-500 hover:text-stone-300 transition-colors"
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
        <a
          href={channel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-400 hover:text-orange-300 text-[11px] font-mono break-all underline underline-offset-2 decoration-orange-500/30 hover:decoration-orange-400/50 transition-colors"
        >
          {channel.url}
        </a>
      </div>

      {/* Bouton ouvrir */}
      <button
        onClick={openExternal}
        className="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30"
      >
        <Play className="w-4 h-4" />
        Ouvrir le lien dans un nouvel onglet
      </button>
    </div>
  );
}
