import type { SourceProfile, SpectrumLens, TopicCategory } from '@/types'

export const SOURCE_DB: SourceProfile[] = [

  // ── WIRE SERVICES (highest reliability, no political agenda) ──────────────
  { domain: 'reuters.com',           bias: 'center',       reliability: 5, allSidesRating: 'Center',       label: 'Wire service' },
  { domain: 'apnews.com',            bias: 'center',       reliability: 5, allSidesRating: 'Center',       label: 'Wire service' },
  { domain: 'bbc.com',               bias: 'center',       reliability: 4, allSidesRating: 'Center',       label: 'British public broadcaster' },
  { domain: 'bbc.co.uk',             bias: 'center',       reliability: 4, allSidesRating: 'Center',       label: 'British public broadcaster' },

  // ── ENCYCLOPEDIAS / PRIMARY REFERENCE (highest for historical/factual claims) ─
  // Wikipedia is flagged establishment — community-edited but enforces an institutional
  // consensus narrative on contested topics (the COVID/vaccine editorial example).
  { domain: 'en.wikipedia.org',      bias: 'center',       reliability: 4, establishment: true, label: 'Wikipedia — community-edited encyclopedia' },
  { domain: 'wikipedia.org',         bias: 'center',       reliability: 4, establishment: true, label: 'Wikipedia' },
  { domain: 'britannica.com',        bias: 'center',       reliability: 5, label: 'Encyclopædia Britannica' },
  { domain: 'history.com',           bias: 'center',       reliability: 4, label: 'History Channel editorial' },

  // ── FACT-CHECKERS (institutional gatekeepers → establishment) ──────────────
  { domain: 'factcheck.org',         bias: 'center',       reliability: 5, establishment: true, allSidesRating: 'Center', label: 'Fact-checker' },
  { domain: 'politifact.com',        bias: 'center',       reliability: 4, establishment: true, allSidesRating: 'Center', label: 'Fact-checker' },
  { domain: 'snopes.com',            bias: 'center',       reliability: 4, establishment: true, allSidesRating: 'Center', label: 'Fact-checker' },
  { domain: 'fullfact.org',          bias: 'center',       reliability: 4, establishment: true, allSidesRating: 'Center', label: 'UK fact-checker' },

  // ── CENTER / MAINSTREAM ───────────────────────────────────────────────────
  { domain: 'thehill.com',           bias: 'center',       reliability: 4, allSidesRating: 'Center' },
  { domain: 'axios.com',             bias: 'center',       reliability: 4, allSidesRating: 'Center' },
  { domain: 'politico.com',          bias: 'center',       reliability: 4, allSidesRating: 'Center' },
  { domain: 'propublica.org',        bias: 'center',       reliability: 5, allSidesRating: 'Center',       label: 'Investigative' },
  { domain: 'usatoday.com',          bias: 'center',       reliability: 3, allSidesRating: 'Center' },
  { domain: 'pbs.org',               bias: 'center',       reliability: 4, allSidesRating: 'Center' },
  { domain: 'npr.org',               bias: 'left-center',  reliability: 4, allSidesRating: 'Lean Left',    label: 'Public radio' },

  // ── BIPARTISAN / INDEPENDENT ──────────────────────────────────────────────
  { domain: 'breakingpoints.com',    bias: 'center',       reliability: 4, allSidesRating: 'Center',       label: 'Bipartisan podcast' },
  { domain: 'theatlantic.com',       bias: 'left-center',  reliability: 4, allSidesRating: 'Lean Left' },
  { domain: 'substack.com',          bias: 'alt',          reliability: 3, label: 'Independent writers (varies)' },
  { domain: 'racket.news',           bias: 'alt',          reliability: 4, label: 'Matt Taibbi / TK News' },

  // ── LEFT-LEANING MAINSTREAM ───────────────────────────────────────────────
  { domain: 'nytimes.com',           bias: 'left-center',  reliability: 3, allSidesRating: 'Lean Left' },
  { domain: 'washingtonpost.com',    bias: 'left-center',  reliability: 3, allSidesRating: 'Lean Left' },
  { domain: 'abcnews.go.com',        bias: 'left-center',  reliability: 3, allSidesRating: 'Lean Left' },
  { domain: 'nbcnews.com',           bias: 'left-center',  reliability: 3, allSidesRating: 'Lean Left' },
  { domain: 'cbsnews.com',           bias: 'left-center',  reliability: 3, allSidesRating: 'Lean Left' },
  { domain: 'cnn.com',               bias: 'left-center',  reliability: 3, allSidesRating: 'Lean Left' },
  { domain: 'guardian.com',          bias: 'left-center',  reliability: 4, allSidesRating: 'Lean Left' },
  { domain: 'theguardian.com',       bias: 'left-center',  reliability: 4, allSidesRating: 'Lean Left' },

  // ── LEFT ──────────────────────────────────────────────────────────────────
  { domain: 'msnbc.com',             bias: 'left',         reliability: 2, allSidesRating: 'Left' },
  { domain: 'theintercept.com',      bias: 'left',         reliability: 4, allSidesRating: 'Left',         label: 'Investigative' },
  { domain: 'motherjones.com',       bias: 'left',         reliability: 3, allSidesRating: 'Left' },
  { domain: 'jacobinmag.com',        bias: 'left',         reliability: 3, allSidesRating: 'Left' },
  { domain: 'democracynow.org',      bias: 'left',         reliability: 4, allSidesRating: 'Left' },
  { domain: 'vox.com',               bias: 'left',         reliability: 3, allSidesRating: 'Lean Left' },
  { domain: 'tytnetwork.com',        bias: 'left',         reliability: 3, label: 'The Young Turks' },
  { domain: 'majorityreportradio.com', bias: 'left',       reliability: 4, label: 'Sam Seder — sourced progressive breakdown' },

  // ── RIGHT-CENTER ──────────────────────────────────────────────────────────
  { domain: 'wsj.com',               bias: 'right-center', reliability: 4, allSidesRating: 'Center-Right' },
  { domain: 'businessinsider.com',   bias: 'right-center', reliability: 3, allSidesRating: 'Center-Right' },
  { domain: 'bloomberg.com',         bias: 'center',       reliability: 4, allSidesRating: 'Center' },

  // ── RIGHT ─────────────────────────────────────────────────────────────────
  { domain: 'foxnews.com',           bias: 'right',        reliability: 2, allSidesRating: 'Lean Right' },
  { domain: 'nypost.com',            bias: 'right',        reliability: 3, allSidesRating: 'Lean Right' },
  { domain: 'nationalreview.com',    bias: 'right',        reliability: 3, allSidesRating: 'Right' },
  { domain: 'dailywire.com',         bias: 'right',        reliability: 2, allSidesRating: 'Right' },
  { domain: 'thefederalist.com',     bias: 'right',        reliability: 3, allSidesRating: 'Right' },
  { domain: 'washingtonexaminer.com',bias: 'right',        reliability: 3, allSidesRating: 'Lean Right' },
  { domain: 'breitbart.com',         bias: 'right',        reliability: 2, allSidesRating: 'Right' },
  { domain: 'thenationalpulse.com',  bias: 'right',        reliability: 3, label: 'Conservative news' },
  { domain: 'justthenews.com',       bias: 'right',        reliability: 3, label: 'John Solomon' },

  // ── ALTERNATIVE / INDEPENDENT MEDIA ──────────────────────────────────────
  { domain: 'thegrayzone.com',       bias: 'alt',          reliability: 4, label: 'Investigative anti-imperialist' },
  { domain: 'jimmydore.com',         bias: 'alt',          reliability: 4, label: 'Anti-establishment left' },
  { domain: 'jimmydoreshow.com',     bias: 'alt',          reliability: 4, label: 'The Jimmy Dore Show' },
  { domain: 'valuetainment.com',     bias: 'alt',          reliability: 3, label: 'Patrick Bet-David — biz/politics' },
  { domain: 'vigilantfox.news',      bias: 'right',        reliability: 3, label: 'Conservative news clips' },
  { domain: 'theepochtimes.com',     bias: 'right',        reliability: 2, label: 'Conservative, China-critical', allSidesRating: 'Right' },
  { domain: 'greenwald.substack.com',bias: 'alt',          reliability: 4, label: 'Glenn Greenwald' },
  { domain: 'systemupdate.news',     bias: 'alt',          reliability: 4, label: 'Glenn Greenwald show' },
  { domain: 'redactednews.com',      bias: 'alt',          reliability: 3, label: 'Independent, anti-establishment' },
  { domain: 'mintpressnews.com',     bias: 'alt',          reliability: 3, label: 'Anti-imperialist' },
  { domain: 'commondreams.org',      bias: 'left',         reliability: 3, label: 'Progressive' },

  // ── ACADEMIC / SCIENCE ────────────────────────────────────────────────────
  { domain: 'arxiv.org',             bias: 'center',       reliability: 4, label: 'Academic preprints (not peer-reviewed)' },
  { domain: 'nature.com',            bias: 'center',       reliability: 5, label: 'Peer-reviewed science' },
  { domain: 'sciencedirect.com',     bias: 'center',       reliability: 5, label: 'Peer-reviewed science' },
  { domain: 'pubmed.ncbi.nlm.nih.gov',bias: 'center',      reliability: 5, label: 'Medical research index' },
  { domain: 'ncbi.nlm.nih.gov',      bias: 'center',       reliability: 5, label: 'NIH research' },

  // ── GOVERNMENT / PRIMARY SOURCES ─────────────────────────────────────────
  { domain: 'sec.gov',               bias: 'center',       reliability: 5, label: 'SEC filings' },
  { domain: 'census.gov',            bias: 'center',       reliability: 5, label: 'US Census Bureau' },
  { domain: 'cbo.gov',               bias: 'center',       reliability: 5, label: 'Congressional Budget Office' },
  { domain: 'bls.gov',               bias: 'center',       reliability: 5, label: 'Bureau of Labor Statistics' },
  { domain: 'cdc.gov',               bias: 'center',       reliability: 4, establishment: true, label: 'CDC — official health authority' },
  { domain: 'who.int',               bias: 'center',       reliability: 4, establishment: true, label: 'WHO — official global health authority' },
  { domain: 'nih.gov',               bias: 'center',       reliability: 5, label: 'NIH' },
  { domain: 'fda.gov',               bias: 'center',       reliability: 4, label: 'FDA' },

  // ── TECH / BUSINESS / FINANCE ─────────────────────────────────────────────
  { domain: 'techcrunch.com',        bias: 'center',       reliability: 4, label: 'Tech/startups' },
  { domain: 'wired.com',             bias: 'left-center',  reliability: 4, label: 'Tech/culture' },
  { domain: 'arstechnica.com',       bias: 'center',       reliability: 4, label: 'Tech/science' },
  { domain: 'theverge.com',          bias: 'left-center',  reliability: 3, label: 'Tech news' },
  { domain: 'forbes.com',            bias: 'center',       reliability: 3, label: 'Business' },
  { domain: 'fortune.com',           bias: 'center',       reliability: 3, label: 'Business' },
  { domain: 'ft.com',                bias: 'center',       reliability: 4, label: 'Financial Times' },
  { domain: 'crunchbase.com',        bias: 'center',       reliability: 4, label: 'Startup/funding database' },
  { domain: 'cnbc.com',              bias: 'center',       reliability: 3, label: 'Business/markets' },
  { domain: 'investopedia.com',      bias: 'center',       reliability: 3, label: 'Finance reference' },
  { domain: 'espn.com',              bias: 'center',       reliability: 4, label: 'Sports' },
]

export function getSourceProfile(url: string): SourceProfile | null {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    return SOURCE_DB.find(s => hostname.includes(s.domain)) ?? null
  } catch {
    return null
  }
}

export const SPECTRUM_DOMAINS = {
  left:   [
    'abcnews.go.com', 'msnbc.com', 'theintercept.com', 'motherjones.com',
    'jacobinmag.com', 'democracynow.org', 'vox.com', 'nbcnews.com', 'cnn.com',
    'theguardian.com', 'tytnetwork.com',
  ],
  center: [
    'en.wikipedia.org', 'britannica.com',
    'reuters.com', 'apnews.com', 'thehill.com', 'factcheck.org', 'politifact.com',
    'snopes.com', 'axios.com', 'propublica.org', 'breakingpoints.com', 'bbc.com', 'pbs.org',
    // Primary legal/financial sources — SEC filings are sworn documents, lying = criminal
    'sec.gov', 'efts.sec.gov', 'cbo.gov', 'bls.gov', 'census.gov',
  ],
  right:  [
    'wsj.com', 'foxnews.com', 'nypost.com', 'nationalreview.com',
    'dailywire.com', 'washingtonexaminer.com', 'thefederalist.com', 'nypost.com',
  ],
  alt:    [
    'thegrayzone.com', 'racket.news', 'jimmydoreshow.com', 'breakingpoints.com',
    'valuetainment.com', 'greenwald.substack.com', 'redactednews.com',
  ],
}

// Political-specific domains — used when a claim is flagged as political
export const POLITICAL_DOMAINS = {
  left:   ['msnbc.com', 'theintercept.com', 'democracynow.org', 'tytnetwork.com', 'motherjones.com'],
  center: ['reuters.com', 'apnews.com', 'thehill.com', 'breakingpoints.com', 'factcheck.org'],
  right:  ['foxnews.com', 'wsj.com', 'nationalreview.com', 'washingtonexaminer.com', 'thefederalist.com'],
  alt:    ['thegrayzone.com', 'jimmydoreshow.com', 'valuetainment.com', 'greenwald.substack.com', 'vigilantfox.news'],
}

// ── ESTABLISHMENT lens ──────────────────────────────────────────────────────
// The institutional/consensus narrative — gatekeepers that "oversee and share" the official
// line: Wikipedia, the major fact-checkers. Surfaced as ONE perspective to CONTRAST against
// independent/alt sources, NEVER as automatic ground truth (the COVID/Wikipedia example).
export const ESTABLISHMENT_DOMAINS = [
  'en.wikipedia.org', 'snopes.com', 'politifact.com', 'factcheck.org', 'fullfact.org',
]

// Universal high-trust baseline appended to every category's Center pool.
// (Wikipedia deliberately excluded — it's the Establishment lens, and was over-dominating Center.)
const CENTER_BASELINE = ['reuters.com', 'apnews.com']

// Per-category authoritative/Center source pools — the core of "every topic, never assume
// politics." `general` is the safe catch-all for random/unexpected topics.
// NOTE: Wikipedia is intentionally NOT in these Center pools — it lives in the Establishment lens.
// Center should return wire services / category news, not the encyclopedia (which was dominating).
export const CATEGORY_CENTER_DOMAINS: Record<TopicCategory, string[]> = {
  political:      POLITICAL_DOMAINS.center,
  business:       ['bloomberg.com', 'cnbc.com', 'fortune.com', 'crunchbase.com', 'reuters.com', 'sec.gov'],
  finance:        ['bloomberg.com', 'cnbc.com', 'sec.gov', 'cbo.gov', 'bls.gov', 'investopedia.com', 'reuters.com'],
  tech:           ['techcrunch.com', 'arstechnica.com', 'theverge.com', 'reuters.com'],
  science:        ['nature.com', 'sciencedirect.com', 'pubmed.ncbi.nlm.nih.gov', 'arxiv.org'],
  health:         ['nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'cdc.gov', 'fda.gov', 'who.int'],
  history:        ['britannica.com', 'history.com', 'reuters.com'],
  sports:         ['espn.com', 'apnews.com', 'reuters.com'],
  entertainment:  ['apnews.com', 'reuters.com', 'variety.com'],
  travel:         ['britannica.com', 'reuters.com', 'apnews.com'],
  food:           ['reuters.com', 'apnews.com'],
  environment:    ['nature.com', 'reuters.com', 'apnews.com'],
  world:          ['reuters.com', 'apnews.com', 'bbc.com'],
  general:        ['reuters.com', 'apnews.com', 'britannica.com'],
}

// Per-category LEFT pools. Default to the general SPECTRUM left set for categories without a
// specific lean split. Every topic gets a left perspective now ("there's always a perspective").
const CATEGORY_LEFT_DOMAINS: Partial<Record<TopicCategory, string[]>> = {
  business:      ['nytimes.com', 'theguardian.com', 'vox.com', 'cnn.com'],
  finance:       ['nytimes.com', 'theguardian.com', 'vox.com'],
  tech:          ['theverge.com', 'wired.com', 'theguardian.com', 'vox.com'],
  science:       ['theguardian.com', 'vox.com', 'nytimes.com'],
  health:        ['theguardian.com', 'vox.com', 'nytimes.com'],
  environment:   ['theguardian.com', 'vox.com', 'nytimes.com', 'motherjones.com'],
  entertainment: ['theguardian.com', 'nytimes.com', 'vox.com'],
  world:         POLITICAL_DOMAINS.left,
  political:     POLITICAL_DOMAINS.left,
}

// Per-category RIGHT pools. Default to the general SPECTRUM right set otherwise.
const CATEGORY_RIGHT_DOMAINS: Partial<Record<TopicCategory, string[]>> = {
  business:      ['wsj.com', 'forbes.com', 'nypost.com', 'washingtonexaminer.com'],
  finance:       ['wsj.com', 'forbes.com', 'nypost.com'],
  tech:          ['foxnews.com', 'nypost.com', 'dailywire.com', 'washingtonexaminer.com'],
  science:       ['nationalreview.com', 'washingtonexaminer.com', 'foxnews.com'],
  health:        ['foxnews.com', 'nypost.com', 'washingtonexaminer.com'],
  environment:   ['wsj.com', 'nationalreview.com', 'foxnews.com'],
  entertainment: ['nypost.com', 'foxnews.com', 'dailywire.com'],
  world:         POLITICAL_DOMAINS.right,
  political:     POLITICAL_DOMAINS.right,
}

// Categories with a meaningful partisan split — used ONLY for merging learned political domains,
// NOT for hiding lenses. Every category now surfaces Left/Right perspectives (see lensDomains).
const PARTISAN_CATEGORIES: TopicCategory[] = ['political', 'world']
export function hasPartisanFraming(category?: TopicCategory): boolean {
  return !!category && PARTISAN_CATEGORIES.includes(category)
}

// The domain set for a given (category, lens). Left/Right now resolve for EVERY category (category
// pool when defined, else the general spectrum set) so all topics get all sides. The route loosens
// to an unrestricted search when a non-empty set still returns nothing.
export function lensDomains(category: TopicCategory | undefined, lens: SpectrumLens): string[] {
  const cat = category ?? 'general'
  switch (lens) {
    case 'establishment': {
      const officials = cat === 'health' ? ['cdc.gov', 'who.int', 'nih.gov', 'fda.gov'] : []
      return [...new Set([...ESTABLISHMENT_DOMAINS, ...officials])]
    }
    case 'center': return [...new Set([...(CATEGORY_CENTER_DOMAINS[cat] ?? CATEGORY_CENTER_DOMAINS.general), ...CENTER_BASELINE])]
    case 'alt':    return hasPartisanFraming(cat) ? POLITICAL_DOMAINS.alt : SPECTRUM_DOMAINS.alt
    case 'left':   return CATEGORY_LEFT_DOMAINS[cat]  ?? SPECTRUM_DOMAINS.left
    case 'right':  return CATEGORY_RIGHT_DOMAINS[cat] ?? SPECTRUM_DOMAINS.right
    default:       return []
  }
}
