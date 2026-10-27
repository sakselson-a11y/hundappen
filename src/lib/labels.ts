import type { TFunction } from 'i18next'
import type { EventType, WalkLength } from './types.ts'

// "🦮 Kort rastning", "🦮 Lång promenad", "🦮 Rastning" (äldre utan längd) eller "🍖 Mat".
export function activityLabel(t: TFunction, type: EventType, walkLength: WalkLength | null, withIcon = true): string {
  const text = type === 'meal' ? t('overview.logMeal') : walkLength ? t(`walk.${walkLength}`) : t('overview.logWalk')
  return withIcon ? `${type === 'meal' ? '🍖' : '🦮'} ${text}` : text
}
