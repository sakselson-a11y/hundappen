import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { resizeImage, uploadEventPhoto } from '../lib/photos.ts'
import { toLocalInputValue } from '../lib/time.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useEvents } from '../household/EventsProvider.tsx'
import Sheet from './Sheet.tsx'
import WalkLengthPicker from './WalkLengthPicker.tsx'
import type { Dog, DogEvent, EventType, WalkLength } from '../lib/types.ts'

export default function LogSheet({ dog, type, onClose }: { dog: Dog; type: EventType; onClose: () => void }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { addLocal } = useEvents()
  const [walkLength, setWalkLength] = useState<WalkLength>('short')
  const [pee, setPee] = useState(false)
  const [poop, setPoop] = useState(false)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [customTime, setCustomTime] = useState<string | null>(null)
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

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setBusy(true)
    setError(null)
    const id = crypto.randomUUID()
    const occurredAt = customTime ? new Date(customTime) : new Date()
    if (occurredAt.getTime() > Date.now() + 60000) {
      setError(t('log.futureTime'))
      setBusy(false)
      return
    }

    let photoPath: string | null = null
    if (photo) {
      try {
        photoPath = await uploadEventPhoto(dog.household_id, id, await resizeImage(photo))
      } catch {
        setError(t('log.photoFailed'))
        setBusy(false)
        return
      }
    }

    const row = {
      id,
      household_id: dog.household_id,
      dog_id: dog.id,
      type,
      walk_length: isWalk ? walkLength : null,
      occurred_at: occurredAt.toISOString(),
      logged_by: session.user.id,
      pee: isWalk ? pee : null,
      poop: isWalk ? poop : null,
      note: note.trim() || null,
      photo_path: photoPath,
    }
    const { data, error } = await supabase.from('events').insert(row).select().single()
    if (error || !data) {
      setError(t('errors.generic'))
      setBusy(false)
      return
    }
    addLocal(data as DogEvent)
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <form className="form" onSubmit={save}>
        <h2>{isWalk ? t('log.walkTitle', { dog: dog.name }) : t('log.mealTitle', { dog: dog.name })}</h2>

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
            {preview ? (
              <>
                <img src={preview} alt="" />
                <button type="button" className="link danger" onClick={() => setPhoto(null)}>
                  {t('dog.removePhoto')}
                </button>
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
          {busy ? t('common.wait') : t('common.save')}
        </button>
        <button type="button" className="link" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </button>
      </form>
    </Sheet>
  )
}
