export function log(message: string, source = 'server') {
  const formattedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

export function generatePlayerColor(index: number): string {
  return COLORS[index % COLORS.length];
}

const FIRST_NAMES = [
  'Alex', 'Blake', 'Casey', 'Dana', 'Emma', 'Felix', 'Grace', 'Hunter', 'Iris', 'Jack',
  'Kai', 'Luna', 'Max', 'Nova', 'Owen', 'Piper', 'Quinn', 'Riley', 'Sage', 'Tyler',
];

const CLAN_NAMES = [
  'StarForge', 'VoidHunters', 'NebulaRise', 'CosmicFury', 'SolarFlare', 'DarkMatter',
  'GalaxyCorp', 'NovaStrike', 'CelestialWar', 'SpaceRaiders', 'StellarWolves', 'OrbitClan',
];

export function generateAIName(index: number): string {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const clanName = CLAN_NAMES[Math.floor(index / FIRST_NAMES.length) % CLAN_NAMES.length];
  return `[${clanName}] ${firstName}`;
}