import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { deleteDogPhoto, eventPhotoPath, resizeImage, uploadEventPhoto, usePhotoUrl } from '../lib/photos.ts'
import { isNetworkError } from '../lib/offlineQueue.ts'
import { relativeTime, toLocalInputValue } from '../lib/time.ts'
import { activityLabel } from '../lib/labels.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import { useEvents } from '../household/EventsProvider.tsx'
import Sheet from './Sheet.tsx'
import WalkLengthPicker from './WalkLengthPicker.tsx'
import type { Dog, DogEvent, EventType, WalkLength } from '../lib/types.ts'

// Hur nära i tid en tidigare logg av samma sort ger en varning om dubbelloggning.
const DUPLICATE_WINDOW_MINUTES = 15

interface Props {
  dog: Dog
  type: EventType
  // Finns den: ändra en befintlig logg i stället för att skapa en ny.
  event?: DogEvent
  initialLength?: WalkLength
  onClose: () => void
  onQueued?: () => void
}

export default function LogSheet({ dog, type, event, initialLength, onClose, onQueued }: Props) {
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const { memberName } = useHousehold()
  const { events, addLocal, logEvent } = useEvents()
  const editing = !!event
  const [walkLength, setWalkLength] = useState<WalkLength>(event?.walk_length ?? initialLength ?? 'short')
  const [pee, setPee] = useState(event?.pee ?? false)
  const [poop, setPoop] = useState(event?.poop ?? false)
  const [note, setNote] = useState(event?.note ?? '')
  // undefined = oförändrat, null = ta bort, File = nytt foto
  const [photo, setPhoto] = useState<File | null | undefined>(undefined)
  const [preview, setPreview] = useState<string | null>(null)
  const existingPhotoUrl = usePhotoUrl(photo === undefined ? (event?.photo_path ?? null) : null)
  const [customTime, setCustomTime] = useState<string | null>(
    event ? toLocalInputValue(new Date(event.occurred_at)) : null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const isWalk = type === 'walk'

  useEffect(() => {
    if (!photo) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  // Har någon nyss loggat samma sak? (Bara när man skapar en ny logg.)
  const recent = useMemo(() => {
    if (editing) return undefined
    const now = Date.now()
    return events.find((e) => {
      const ago = now - new Date(e.occurred_at).getTime()
      return e.type === type && e.dog_id === dog.id && ago >= -60000 && ago < DUPLICATE_WINDOW_MINUTES * 60000
    })
  }, [editing, events, type, dog.id])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setBusy(true)
    setError(null)
    const occurredAt = customTime ? new Date(customTime) : new Date()
    if (occurredAt.getTime() > Date.now() + 60000) {
      setError(t('log.futureTime'))
      setBusy(false)
      return
    }
    const fields = {
      walk_length: isWalk ? walkLength : null,
      occurred_at: occurredAt.toISOString(),
      pee: isWalk ? pee : null,
      poop: isWalk ? poop : null,
      note: note.trim() || null,
    }

    try {
      if (event) await saveEdit(event, fields)
      else await saveNew(fields)
    } catch (err) {
      setError(
        editing && isNetworkError(err)
          ? t('log.editNeedsNetwork')
          : photo && !editing
            ? t('log.photoFailed')
            : t('errors.generic'),
      )
      setBusy(false)
    }
  }

  async function saveNew(fields: Partial<DogEvent>) {
    const id = crypto.randomUUID()
    // Fotot skalas ner direkt (fungerar utan nät) och laddas upp när loggen skickas.
    const image = photo ? await resizeImage(photo) : null
    const result = await logEvent({
      row: {
        id,
        household_id: dog.household_id,
        dog_id: dog.id,
        type,
        logged_by: session!.user.id,
        photo_path: image ? eventPhotoPath(dog.household_id, id) : null,
        ...(fields as Pick<DogEvent, 'walk_length' | 'occurred_at' | 'pee' | 'poop' | 'note'>),
      },
      photo: image,
    })
    if (result === 'queued') onQueued?.()
    onClose()
  }

  async function saveEdit(original: DogEvent, fields: Partial<DogEvent>) {
    let photoPath = original.photo_path
    if (photo) photoPath = await uploadEventPhoto(dog.household_id, original.id, await resizeImage(photo))
    else if (photo === null) photoPath = null
    const { data, error } = await supabase
      .from('events')
      .update({ ...fields, photo_path: photoPath })
      .eq('id', original.id)
      .select()
      .single()
    if (error || !data) throw error ?? new Error('Ingen rad uppdaterades')
    if (original.photo_path && original.photo_path !== photoPath) await deleteDogPhoto(original.photo_path)
    addLocal(data as DogEvent)
    onClose()
  }

  const shownPhoto = preview ?? existingPhotoUrl
  const title = editing
    ? t('log.editTitle')
    : isWalk
      ? t('log.walkTitle', { dog: dog.name })
      : t('log.mealTitle', { dog: dog.name })

  return (
    <Sheet onClose={onClose}>
      <form className="form" onSubmit={save}>
        <h2>{title}</h2>

        {recent && (
          <div className="warning-box" role="alert">
            ⚠️{' '}
            {t('log.recentWarning', {
              name: recent.logged_by === session?.user.id ? t('log.you') : (memberName(recent.logged_by) ?? t('history.formerMember')),
              what: activityLabel(t, recent.type, recent.walk_length, false).toLowerCase(),
              when: relativeTime(t, recent.occurred_at, i18n.language),
            })}
          </div>
        )}

        {isWalk && <WalkLengthPicker value={walkLength} onChange={setWalkLength} />}

        {isWalk && (
          <div className="chips">
            <button type="button" className={`chip ${pee ? 'on' : ''}`} aria-pressed={pee} onClick={() => setPee(!pee)}>
              💧 {t('log.pee')}
            </button>
            <button type="button" className={`chip ${poop ? 'on' : ''}`} aria-pressed={poop} onClick={() => setPoop(!poop)}>
              💩 {t('log.poop')}
            </button>
          </div>
        )}

        <label>
          <span>
            {t('log.note')} <em className="optional">{t('common.optional')}</em>
          </span>
          <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {isWalk && (
          <div className="log-photo">
            {shownPhoto ? (
              <>
                <img src={shownPhoto} alt="" />
                <span className="photo-actions">
                  <button type="button" className="link" onClick={() => fileInput.current?.click()}>
                    {t('dog.changePhoto')}
                  </button>
                  <button type="button" className="link danger" onClick={() => setPhoto(null)}>
                    {t('dog.removePhoto')}
                  </button>
                </span>
              </>
            ) : (
              <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
                📷 {t('log.addPhoto')}
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setPhoto(file)
                e.target.value = ''
              }}
            />
          </div>
        )}

        {customTime === null ? (
          <button type="button" className="link left" onClick={() => setCustomTime(toLocalInputValue(new Date()))}>
            🕒 {t('log.now')} · {t('log.changeTime')}
          </button>
        ) : (
          <label>
            <span>{t('log.when')}</span>
            <input
              type="datetime-local"
              max={toLocalInputValue(new Date())}
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
            />
          </label>
        )}

        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? t('common.wait') : recent ? t('log.saveAnyway') : t('common.save')}
        </button>
        <button type="button" className="link" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </button>
      </form>
    </Sheet>
  )
}
