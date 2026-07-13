export interface M3UChannel {
  id: string;
  tvgId: string;
  tvgLogo: string;
  tvgName: string;
  groupTitle: string;
  displayName: string;
  url: string;
}

export function parseM3U(content: string): M3UChannel[] {
  const channels: M3UChannel[] = [];
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let i = 0;
  // Skip #EXTM3U header
  if (lines[0]?.startsWith('#EXTM3U')) {
    i = 1;
  }

  let idCounter = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('#EXTINF:')) {
      const infoLine = lines[i];
      const urlLine = lines[i + 1] || '';

      // Parse attributes
      const tvgId = extractAttribute(infoLine, 'tvg-id') || '';
      const tvgLogo = extractAttribute(infoLine, 'tvg-logo') || '';
      const tvgName = extractAttribute(infoLine, 'tvg-name') || '';
      const groupTitle = extractAttribute(infoLine, 'group-title') || 'Non classé';

      // Parse display name (after the last comma)
      const commaIndex = infoLine.lastIndexOf(',');
      const displayName = commaIndex !== -1 ? infoLine.substring(commaIndex + 1).trim() : tvgName || 'Sans nom';

      if (urlLine && !urlLine.startsWith('#')) {
        channels.push({
          id: `channel-${idCounter++}`,
          tvgId,
          tvgLogo,
          tvgName,
          groupTitle,
          displayName,
          url: urlLine,
        });
        i += 2;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return channels;
}

function extractAttribute(line: string, attr: string): string {
  // Match attribute="value" pattern
  const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
  const match = line.match(regex);
  return match ? match[1] : '';
}

export function getGroups(channels: M3UChannel[]): string[] {
  const groups = new Set<string>();
  channels.forEach(ch => {
    if (ch.groupTitle) {
      groups.add(ch.groupTitle);
    }
  });
  return Array.from(groups).sort();
}

export const DEFAULT_M3U = `#EXTM3U
#EXTINF:-1, tvg-id="BeinSport1.fr" tvg-logo="https://static.epg.best/fr/13erue.fr.png" tvg-name="BeIn Sports 1 FHD" group-title="Sports",13e Rue FHD
https://vavoo.to/watch?live=3310959922c9c7628ee636

#EXTINF:-1, tvg-id="BeinSport1.fr" tvg-logo="https://static.epg.best/fr/syfy.fr.png" tvg-name="BeIn Sports 1 FHD" group-title="Sports",SYFY FHD
https://vavoo.to/watch?live=303282550000e34f35d8e7

#EXTINF:-1, tvg-id="BeinSport1.fr" tvg-logo="https://static.epg.best/fr/canalfoot.fr.png" tvg-name="BeIn Sports 1 FHD" group-title="Sports",Canal+ Foot FHD
https://vavoo.to/watch?live=3271278010f4217cd17c4c

#EXTINF:-1, tvg-id="BeinSport1.fr" tvg-logo="https://static.epg.best/fr/BeinSports1.fr.png" tvg-name="BeIn Sports 1 FHD" group-title="Sports",Canal+ Sports 360 FHD
https://vavoo.to/watch?live=3411759213e112d2746c32

#EXTINF:-1, tvg-id="BeinSport1.fr" tvg-logo="https://static.epg.best/fr/BeinSports1.fr.png" tvg-name="BeIn Sports 1 FHD" group-title="Sports",Canal+ Sports 4 FHD
https://vavoo.to/watch?live=1905836261d2b61c2c0344`;
