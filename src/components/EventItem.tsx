import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePhotoUrl } from '../lib/photos.ts'
import { formatTime } from '../lib/time.ts'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import Sheet from './Sheet.tsx'
import type { DogEvent } from '../lib/types.ts'

interface Props {
  event: DogEvent
  // Egen logg: kan ändras och tas bort.
  isOwn: boolean
  onEdit: (event: DogEvent) => void
  onDelete: (event: DogEvent) => void
}

export default function EventItem({ event, isOwn, onEdit, onDelete }: Props) {
  const { t, i18n } = useTranslation()
  const { memberName } = useHousehold()
  const photoUrl = usePhotoUrl(event.photo_path)
  const [showPhoto, setShowPhoto] = useState(false)
  const who = memberName(event.logged_by) ?? t('history.formerMember')

  return (
    <li className="event">
      <span className="event-icon" aria-hidden>
        {event.type === 'walk' ? '🦮' : '🍖'}
      </span>
      <div className="event-body">
        <div className="event-head">
          <strong>{formatTime(event.occurred_at, i18n.language)}</strong>
          <span>{event.type === 'walk' ? t('history.walkBy', { name: who }) : t('history.mealBy', { name: who })}</span>
        </div>
        {(event.pending || event.walk_length || event.pee || event.poop) && (
          <div className="tags">
            {event.pending && <span className="tag pending">⏳ {t('history.pending')}</span>}
            {event.walk_length && <span className="tag">{t(`walk.${event.walk_length}`)}</span>}
            {event.pee && <span className="tag">💧 {t('log.pee')}</span>}
            {event.poop && <span className="tag">💩 {t('log.poop')}</span>}
          </div>
        )}
        {event.note && <p className="event-note">{event.note}</p>}
        {isOwn && (
          <span className="event-actions">
            {!event.pending && (
              <button className="link small" onClick={() => onEdit(event)}>
                {t('common.edit')}
              </button>
            )}
            <button className="link danger small" onClick={() => onDelete(event)}>
              {t('history.delete')}
            </button>
          </span>
        )}
      </div>
      {photoUrl && (
        <button className="event-thumb" onClick={() => setShowPhoto(true)} aria-label={t('history.showPhoto')}>
          <img src={photoUrl} alt="" />
        </button>
      )}
      {showPhoto && photoUrl && (
        <Sheet onClose={() => setShowPhoto(false)}>
          <img className="photo-full" src={photoUrl} alt="" />
          <button className="secondary" onClick={() => setShowPhoto(false)}>
            {t('common.close')}
          </button>
        </Sheet>
      )}
    </li>
  )
}
