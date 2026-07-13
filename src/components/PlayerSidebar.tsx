import { useState, useEffect } from 'react';
import {
  Search, Upload, Grid3X3, List, Layers,
  ChevronDown, ChevronRight, X, FileText, Trash2,
  FolderOpen, Heart, Clock, Zap
} from 'lucide-react';
import type { M3UChannel } from '../utils/m3uParser';
import { getGroups } from '../utils/m3uParser';
import ChannelCard from './ChannelCard';
import { cn } from '../utils/cn';
import logo from '../assets/logo.png';

interface SidebarProps {
  channels: M3UChannel[];
  activeChannel: M3UChannel | null;
  favorites: Set<string>;
  recentChannels: M3UChannel[];
  onSelectChannel: (channel: M3UChannel) => void;
  onToggleFavorite: (channel: M3UChannel) => void;
  onLoadFile: (content: string) => void;
  onLoadUrl: (url: string) => void;
  onClearPlaylist: () => void;
}

type FilterTab = 'all' | 'favorites' | 'recent';

export default function Sidebar({
  channels, activeChannel, favorites, recentChannels,
  onSelectChannel, onToggleFavorite, onLoadFile, onLoadUrl, onClearPlaylist
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [urlInput, setUrlInput] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  // Cross-component signals from HomeLauncher / M3UApp
  useEffect(() => {
    const openImport = () => setShowImportModal(true);
    const filter = (e: Event) => {
      const detail = (e as CustomEvent<{ kind: string }>).detail;
      if (!detail) return;
      const k = detail.kind;
      if (k === 'favorites') { setFilterTab('favorites'); setSelectedGroup(null); setSearch(''); }
      else if (k === 'recent') { setFilterTab('recent'); setSelectedGroup(null); setSearch(''); }
      else if (k === 'movies') { setFilterTab('all'); setSearch('film'); setSelectedGroup(null); }
      else if (k === 'series') { setFilterTab('all'); setSearch('serie'); setSelectedGroup(null); }
    };
    window.addEventListener('streamflow:open-import', openImport);
    window.addEventListener('streamflow:filter', filter as EventListener);
    return () => {
      window.removeEventListener('streamflow:open-import', openImport);
      window.removeEventListener('streamflow:filter', filter as EventListener);
    };
  }, []);

  const groups = getGroups(channels);

  // Filter channels
  let filteredChannels = channels;

  if (filterTab === 'favorites') {
    filteredChannels = channels.filter(ch => favorites.has(ch.id));
  } else if (filterTab === 'recent') {
    filteredChannels = recentChannels;
  }

  if (selectedGroup) {
    filteredChannels = filteredChannels.filter(ch => ch.groupTitle === selectedGroup);
  }

  if (search) {
    const q = search.toLowerCase();
    filteredChannels = filteredChannels.filter(ch =>
      ch.displayName.toLowerCase().includes(q) ||
      ch.groupTitle.toLowerCase().includes(q) ||
      ch.tvgName.toLowerCase().includes(q)
    );
  }

  const toggleGroup = (group: string) => {
    const next = new Set(expandedGroups);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    setExpandedGroups(next);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      onLoadFile(content);
      setShowImportModal(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUrlLoad = () => {
    if (urlInput.trim()) {
      onLoadUrl(urlInput.trim());
      setUrlInput('');
      setShowImportModal(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        onLoadFile(content);
      };
      reader.readAsText(file);
    }
  };

  // Group channels by group
  const channelsByGroup: Record<string, M3UChannel[]> = {};
  filteredChannels.forEach(ch => {
    const g = ch.groupTitle || 'Non classé';
    if (!channelsByGroup[g]) channelsByGroup[g] = [];
    channelsByGroup[g].push(ch);
  });

  return (
    <div className="flex flex-col h-full bg-[#0c0805]/60 backdrop-blur-xl relative">
      {/* subtle top glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-40 bg-orange-500/[0.10] blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="p-4 border-b border-orange-500/[0.08] relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 flex-shrink-0">
              <div className="absolute inset-0 bg-orange-500/40 rounded-xl blur-md" />
              <img src={logo} alt="StreamFlow" className="relative w-9 h-9 rounded-xl shadow-lg" />
            </div>
            <div>
              <h1 className="text-white font-display font-bold text-sm tracking-tight">StreamFlow</h1>
              <p className="text-stone-500 text-[10px]">{channels.length} chaînes</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowImportModal(true)}
              className="w-8 h-8 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 flex items-center justify-center transition-colors"
              title="Importer M3U"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            {channels.length > 0 && (
              <button
                onClick={onClearPlaylist}
                className="w-8 h-8 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 flex items-center justify-center transition-colors"
                title="Vider la playlist"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une chaîne..."
            className="w-full pl-9 pr-8 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-stone-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & View Mode */}
      <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2">
        <div className="flex-1 flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
          {([
            { key: 'all' as FilterTab, icon: Layers, label: 'Tout' },
            { key: 'favorites' as FilterTab, icon: Heart, label: 'Favoris' },
            { key: 'recent' as FilterTab, icon: Clock, label: 'Récents' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilterTab(tab.key); setSelectedGroup(null); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all',
                filterTab === tab.key
                  ? 'bg-orange-600/30 text-orange-300 shadow-sm'
                  : 'text-stone-500 hover:text-stone-300'
              )}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 bg-white/[0.03] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={cn('p-1.5 rounded-md transition-all', viewMode === 'list' ? 'bg-white/10 text-white' : 'text-stone-500 hover:text-stone-300')}
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn('p-1.5 rounded-md transition-all', viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-stone-500 hover:text-stone-300')}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Group pills */}
      {filterTab === 'all' && groups.length > 1 && (
        <div className="px-4 py-2 border-b border-white/5">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedGroup(null)}
              className={cn(
                'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-all border',
                !selectedGroup
                  ? 'bg-orange-600/20 text-orange-300 border-orange-500/30'
                  : 'bg-white/[0.03] text-stone-400 border-white/[0.06] hover:bg-white/[0.06]'
              )}
            >
              Tous ({channels.length})
            </button>
            {groups.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
                className={cn(
                  'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-all border',
                  selectedGroup === g
                    ? 'bg-orange-600/20 text-orange-300 border-orange-500/30'
                    : 'bg-white/[0.03] text-stone-400 border-white/[0.06] hover:bg-white/[0.06]'
                )}
              >
                {g} ({channels.filter(c => c.groupTitle === g).length})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Channel List */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {channels.length === 0 ? (
              <>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/15 to-amber-500/5 flex items-center justify-center mb-4 border border-orange-500/10">
                  <FolderOpen className="w-7 h-7 text-orange-400/70" />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">Aucune playlist chargée</h3>
                <p className="text-stone-500 text-xs mb-4 max-w-[200px]">
                  Importez un fichier M3U ou glissez-le ici pour commencer
                </p>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="btn-brand px-4 py-2 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Importer M3U
                </button>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 text-stone-600 mb-3" />
                <p className="text-stone-400 text-sm">Aucun résultat</p>
                <p className="text-stone-600 text-xs mt-1">Essayez un autre terme</p>
              </>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredChannels.map(ch => (
              <ChannelCard
                key={ch.id}
                channel={ch}
                isActive={activeChannel?.id === ch.id}
                isFavorite={favorites.has(ch.id)}
                onSelect={onSelectChannel}
                onToggleFavorite={onToggleFavorite}
                viewMode="grid"
              />
            ))}
          </div>
        ) : (
          // List mode with group headers
          filterTab === 'all' && !selectedGroup && !search ? (
            Object.entries(channelsByGroup).map(([group, chs]) => (
              <div key={group} className="mb-2">
                <button
                  onClick={() => toggleGroup(group)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-white/[0.03] rounded-lg transition-colors"
                >
                  {expandedGroups.has(group) ? (
                    <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
                  )}
                  <span className="text-stone-400 text-xs font-semibold uppercase tracking-wider">{group}</span>
                  <span className="text-stone-600 text-[10px] ml-auto">{chs.length}</span>
                </button>
                {expandedGroups.has(group) && (
                  <div className="space-y-1 mt-1">
                    {chs.map(ch => (
                      <ChannelCard
                        key={ch.id}
                        channel={ch}
                        isActive={activeChannel?.id === ch.id}
                        isFavorite={favorites.has(ch.id)}
                        onSelect={onSelectChannel}
                        onToggleFavorite={onToggleFavorite}
                        viewMode="list"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            filteredChannels.map(ch => (
              <ChannelCard
                key={ch.id}
                channel={ch}
                isActive={activeChannel?.id === ch.id}
                isFavorite={favorites.has(ch.id)}
                onSelect={onSelectChannel}
                onToggleFavorite={onToggleFavorite}
                viewMode="list"
              />
            ))
          )
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowImportModal(false)}>
          <div className="bg-[#120b06] border border-orange-500/10 rounded-2xl w-full max-w-md shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-orange-500/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/25 to-amber-500/10 flex items-center justify-center border border-orange-500/10">
                  <FileText className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold">Importer une playlist</h2>
                  <p className="text-stone-500 text-xs">Fichier M3U ou URL</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-stone-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* File upload */}
              <label
                className="block border-2 border-dashed border-white/10 hover:border-orange-500/40 hover:bg-orange-500/[0.03] rounded-xl p-6 text-center cursor-pointer transition-all group"
              >
                <input type="file" accept=".m3u,.m3u8,.txt" onChange={handleFileUpload} className="hidden" />
                <Upload className="w-8 h-8 text-stone-500 group-hover:text-orange-400 mx-auto mb-2 transition-colors" />
                <p className="text-sm text-stone-300 font-medium">Cliquez pour sélectionner un fichier</p>
                <p className="text-xs text-stone-600 mt-1">.m3u, .m3u8, .txt</p>
              </label>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-stone-600 text-xs">OU</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* URL input */}
              <div>
                <label className="text-xs text-stone-400 font-medium mb-2 block">URL de la playlist M3U</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/playlist.m3u"
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-stone-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
                    onKeyDown={(e) => e.key === 'Enter' && handleUrlLoad()}
                  />
                  <button
                    onClick={handleUrlLoad}
                    disabled={!urlInput.trim()}
                    className="px-4 py-2.5 btn-brand disabled:bg-stone-700 disabled:shadow-none disabled:text-stone-500 text-white rounded-xl text-sm font-medium transition-all"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Paste M3U content */}
              <div>
                <label className="text-xs text-stone-400 font-medium mb-2 block">Ou collez le contenu M3U directement</label>
                <textarea
                  placeholder="#EXTM3U&#10;#EXTINF:-1,Nom de la chaîne&#10;http://url-du-flux"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-mono placeholder-stone-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 resize-none h-28"
                  onPaste={(e) => {
                    setTimeout(() => {
                      const val = (e.target as HTMLTextAreaElement).value;
                      if (val.includes('#EXTM3U') || val.includes('#EXTINF')) {
                        onLoadFile(val);
                        setShowImportModal(false);
                      }
                    }, 100);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes('#EXTM3U') || val.includes('#EXTINF')) {
                      // Enable submit
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      const val = (e.target as HTMLTextAreaElement).value;
                      if (val.trim()) {
                        onLoadFile(val);
                        setShowImportModal(false);
                      }
                    }
                  }}
                />
                <p className="text-stone-600 text-[10px] mt-1">Ctrl+Entrée pour charger</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
