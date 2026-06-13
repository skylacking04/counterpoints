import type { SourceProfile } from '@/types'

export const SOURCE_DB: SourceProfile[] = [

  // ── WIRE SERVICES (highest reliability, no political agenda) ──────────────
  { domain: 'reuters.com',           bias: 'center',       reliability: 5, allSidesRating: 'Center',       label: 'Wire service' },
  { domain: 'apnews.com',            bias: 'center',       reliability: 5, allSidesRating: 'Center',       label: 'Wire service' },
  { domain: 'bbc.com',               bias: 'center',       reliability: 4, allSidesRating: 'Center',       label: 'British public broadcaster' },
  { domain: 'bbc.co.uk',             bias: 'center',       reliability: 4, allSidesRating: 'Center',       label: 'British public broadcaster' },

  // ── ENCYCLOPEDIAS / PRIMARY REFERENCE (highest for historical/factual claims) ─
  { domain: 'en.wikipedia.org',      bias: 'center',       reliability: 4, label: 'Wikipedia — community-edited encyclopedia' },
  { domain: 'wikipedia.org',         bias: 'center',       reliability: 4, label: 'Wikipedia' },
  { domain: 'britannica.com',        bias: 'center',       reliability: 5, label: 'Encyclopædia Britannica' },
  { domain: 'history.com',           bias: 'center',       reliability: 4, label: 'History Channel editorial' },

  // ── FACT-CHECKERS ─────────────────────────────────────────────────────────
  { domain: 'factcheck.org',         bias: 'center',       reliability: 5, allSidesRating: 'Center',       label: 'Fact-checker' },
  { domain: 'politifact.com',        bias: 'center',       reliability: 4, allSidesRating: 'Center',       label: 'Fact-checker' },
  { domain: 'snopes.com',            bias: 'center',       reliability: 4, allSidesRating: 'Center',       label: 'Fact-checker' },
  { domain: 'fullfact.org',          bias: 'center',       reliability: 4, allSidesRating: 'Center',       label: 'UK fact-checker' },

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
  { domain: 'cdc.gov',               bias: 'center',       reliability: 4, label: 'CDC' },
  { domain: 'nih.gov',               bias: 'center',       reliability: 5, label: 'NIH' },
  { domain: 'fda.gov',               bias: 'center',       reliability: 4, label: 'FDA' },

  // ── TECH / BUSINESS ───────────────────────────────────────────────────────
  { domain: 'techcrunch.com',        bias: 'center',       reliability: 4, label: 'Tech news' },
  { domain: 'wired.com',             bias: 'left-center',  reliability: 4, label: 'Tech/culture' },
  { domain: 'arstechnica.com',       bias: 'center',       reliability: 4, label: 'Tech/science' },
  { domain: 'theverge.com',          bias: 'left-center',  reliability: 3, label: 'Tech news' },
  { domain: 'forbes.com',            bias: 'center',       reliability: 3, label: 'Business' },
  { domain: 'fortune.com',           bias: 'center',       reliability: 3, label: 'Business' },
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
