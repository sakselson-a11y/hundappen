import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { usePhotoUrl } from '../lib/photos.ts'

export interface DogFormValues {
  name: string
  breed: string
  birthDate: string
  // undefined = oförändrat, null = ta bort, File = nytt foto
  photo: File | null | undefined
}

interface Props {
  title: string
  submitLabel: string
  initial?: { name: string; breed: string | null; birthDate: string | null; photoPath: string | null }
  busy: boolean
  error: string | null
  onSubmit: (values: DogFormValues) => void
  onCancel?: () => void
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DogForm({ title, submitLabel, initial, busy, error, onSubmit, onCancel }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const [breed, setBreed] = useState(initial?.breed ?? '')
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '')
  const [photo, setPhoto] = useState<File | null | undefined>(undefined)
  const [preview, setPreview] = useState<string | null>(null)
  const existingUrl = usePhotoUrl(photo === undefined ? (initial?.photoPath ?? null) : null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!photo) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const shownPhoto = preview ?? existingUrl

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({ name: name.trim(), breed: breed.trim(), birthDate, photo })
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{title}</h2>

      <div className="photo-picker">
        <button
          type="button"
          className="photo-circle"
          onClick={() => fileInput.current?.click()}
          aria-label={t('dog.choosePhoto')}
        >
          {shownPhoto ? <img src={shownPhoto} alt="" /> : <span>📷</span>}
        </button>
        <div className="photo-actions">
          <button type="button" className="link" onClick={() => fileInput.current?.click()}>
            {shownPhoto ? t('dog.changePhoto') : t('dog.choosePhoto')}
          </button>
          {shownPhoto && (
            <button type="button" className="link danger" onClick={() => setPhoto(null)}>
              {t('dog.removePhoto')}
            </button>
          )}
        </div>
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

      <label>
        <span>{t('dog.name')}</span>
        <input maxLength={40} required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        <span>
          {t('dog.breed')} <em className="optional">{t('common.optional')}</em>
        </span>
        <input maxLength={60} value={breed} onChange={(e) => setBreed(e.target.value)} />
      </label>
      <label>
        <span>
          {t('dog.birthDate')} <em className="optional">{t('common.optional')}</em>
        </span>
        <input type="date" max={todayIso()} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
      </label>

      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy || !name.trim()}>
        {busy ? t('common.wait') : submitLabel}
      </button>
      {onCancel && (
        <button type="button" className="link" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </button>
      )}
    </form>
  )
}
