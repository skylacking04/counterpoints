import type { SourceProfile } from '@/types'

interface Props {
  profile: SourceProfile | null
  className?: string
}

const BIAS_COLORS: Record<string, string> = {
  left:        'text-blue-400',
  'left-center': 'text-blue-300',
  center:      'text-gray-300',
  'right-center': 'text-orange-300',
  right:       'text-red-400',
  alt:         'text-purple-400',
}

export function SourceBadge({ profile, className = '' }: Props) {
  if (!profile) return null

  const stars = '★'.repeat(profile.reliability) + '☆'.repeat(5 - profile.reliability)
  const color = BIAS_COLORS[profile.bias] ?? 'text-gray-400'

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${className}`}>
      <span className={`${color} font-medium`}>
        {profile.allSidesRating ?? profile.bias}
      </span>
      <span className="text-yellow-500/60 tracking-tighter">{stars}</span>
      {profile.label && (
        <span className="text-gray-600">· {profile.label}</span>
      )}
    </span>
  )
}
