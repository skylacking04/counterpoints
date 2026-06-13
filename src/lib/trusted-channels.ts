export interface TrustedChannel {
  name: string
  channelId: string
  lens: 'alt' | 'center' | 'left' | 'right'
  domain?: string
  description?: string
  topics: ('political' | 'tech' | 'business' | 'science' | 'culture' | 'general')[]
}

export const TRUSTED_CHANNELS: TrustedChannel[] = [

  // ── BIPARTISAN / CENTER ────────────────────────────────────────────────────
  { name: 'Breaking Points',     channelId: 'UCwjA3ot9D7NcEhyaTBGgHrw', lens: 'center',
    description: 'Krystal Ball + Saagar Enjeti — left+right co-hosts, anti-corporate',
    topics: ['political', 'general'] },
  { name: 'AP Archive',          channelId: 'UCFpuoJKFB1yU3PVDUCGieyw',  lens: 'center',
    description: 'Associated Press raw footage',
    topics: ['political', 'general'] },
  { name: 'Reuters',             channelId: 'UChqUTb7kYRX8-EiaN3XFrSQ',  lens: 'center',
    description: 'Wire-service video',
    topics: ['political', 'general'] },
  { name: 'The Hill',            channelId: 'UCamCHHMwiqANHwbJ1WAgBgQ',  lens: 'center',
    description: 'DC political news, centrist',
    topics: ['political'] },

  // ── INDEPENDENT / ALT-MEDIA ────────────────────────────────────────────────
  { name: 'The Jimmy Dore Show', channelId: 'UC3M7l8ved_rYQ45AVzS0RGA', lens: 'alt',
    domain: 'jimmydoreshow.com',
    description: 'Anti-establishment left, calls out both parties',
    topics: ['political'] },
  { name: 'Kim Iversen',         channelId: 'UCxfQQOArHrdAt_bU91CaQUQ', lens: 'alt',
    description: 'Independent, skeptical of corporate media narratives',
    topics: ['political', 'culture'] },
  { name: 'Glenn Greenwald',     channelId: 'UCRd1DCZXL0ipwzjTH1iMVoA', lens: 'alt',
    domain: 'greenwald.substack.com',
    description: 'Pulitzer-winning journalist, civil liberties focus',
    topics: ['political'] },
  { name: 'The Grayzone',        channelId: 'UCEXR8pR7oT3AJNMkSBXGZoA', lens: 'alt',
    domain: 'thegrayzone.com',
    description: 'Investigative, anti-imperialist journalism',
    topics: ['political'] },
  { name: 'Russell Brand',       channelId: 'UCdzQqyalvRPqRxq3I0BLCQA', lens: 'alt',
    description: 'Anti-establishment commentary (note: controversial)',
    topics: ['political', 'culture'] },
  { name: 'System Update',       channelId: 'UCnBfFj-6T4FhYEf_Mu01UyA', lens: 'alt',
    description: "Glenn Greenwald's daily show on Rumble/YouTube",
    topics: ['political'] },

  // ── CENTER-RIGHT / LIBERTARIAN ────────────────────────────────────────────
  { name: 'Valuetainment',       channelId: 'UCIix0UuvFPDcyRhP7n9_qUA', lens: 'right',
    domain: 'valuetainment.com',
    description: 'Patrick Bet-David — business/political, center-right',
    topics: ['political', 'business'] },
  { name: 'Timcast IRL',         channelId: 'UCe02lGcO-ahAURWuxAJnjdA', lens: 'right',
    description: 'Tim Pool — indie right-leaning commentary',
    topics: ['political', 'culture'] },

  // ── RIGHT / CONSERVATIVE ──────────────────────────────────────────────────
  { name: 'Vigilant Fox',        channelId: 'UCBCFEyLgGqMSHTRYzF0JGHQ', lens: 'right',
    domain: 'vigilantfox.news',
    description: 'Conservative news clips, medical/government skepticism',
    topics: ['political', 'science'] },
  { name: 'Tucker Carlson',      channelId: 'UCa3wzvBcDvxMW-S0l5c7MZg',  lens: 'right',
    description: 'Tucker Carlson Network — independent right-wing',
    topics: ['political'] },
  { name: 'Epoch Times',         channelId: 'UC7vMKA4L8EbCq8fvdl3NHHA',  lens: 'right',
    domain: 'theepochtimes.com',
    description: 'Conservative, China-critical, sometimes disputed claims',
    topics: ['political'] },

  // ── LEFT / PROGRESSIVE ────────────────────────────────────────────────────
  { name: 'The Young Turks',     channelId: 'UC1yBKRuGpC1tSM73A0ZjYjQ',  lens: 'left',
    domain: 'tytnetwork.com',
    description: 'Progressive commentary — Cenk Uygur',
    topics: ['political'] },
  { name: 'The Majority Report', channelId: 'UCmmitGHlHT4MQBd7CVU4P_Q',  lens: 'left',
    domain: 'majorityreportradio.com',
    description: 'Sam Seder — progressive politics, detailed source breakdowns',
    topics: ['political'] },
  { name: 'Democracy Now!',      channelId: 'UCzuqE7-t13O4NIDYJfakrhw',  lens: 'left',
    description: 'Leftist independent journalism — Amy Goodman',
    topics: ['political'] },

  // ── TECH / BUSINESS ───────────────────────────────────────────────────────
  { name: 'Y Combinator',        channelId: 'UCcefcZRL2oaA_uBNeo5UOWg',  lens: 'center',
    description: 'Startup / tech talks, official YC',
    topics: ['tech', 'business'] },
  { name: 'Lex Fridman',         channelId: 'UCSHZKyawb77ixDdsGog4iWA',  lens: 'center',
    description: 'Long-form interviews — AI, science, politics',
    topics: ['tech', 'science', 'political', 'general'] },
  { name: 'MKBHD',               channelId: 'UCBcRF18a7Qf58cCRy5xuWwQ',  lens: 'center',
    description: 'Consumer tech reviews',
    topics: ['tech'] },

  // ── SCIENCE / HEALTH ──────────────────────────────────────────────────────
  { name: 'Dr. John Campbell',   channelId: 'UCf9337thkXa0TCWZOZD3vsg',  lens: 'center',
    description: 'Medical/health analysis — was pro-establishment, became skeptical',
    topics: ['science'] },
  { name: 'MedCram',             channelId: 'UCG-iShlqj4kK7Ca8yZnLSkw',  lens: 'center',
    description: 'Medical education, Dr. Seheult',
    topics: ['science'] },
]

// Channels specifically useful for political claim verification
export const POLITICAL_CHANNELS = TRUSTED_CHANNELS.filter(c => c.topics.includes('political'))

// Channels by topic — used to select the right sources based on claim type
export const CHANNELS_BY_TOPIC: Record<string, TrustedChannel[]> = {
  political: POLITICAL_CHANNELS,
  tech:      TRUSTED_CHANNELS.filter(c => c.topics.includes('tech')),
  business:  TRUSTED_CHANNELS.filter(c => c.topics.includes('business')),
  science:   TRUSTED_CHANNELS.filter(c => c.topics.includes('science')),
  general:   TRUSTED_CHANNELS,
}
