import { useTranslation } from 'react-i18next'
import { usePhotoUrl } from '../lib/photos.ts'
import { formatAge } from '../lib/age.ts'
import type { Dog } from '../lib/types.ts'

export default function DogCard({ dog, onEdit }: { dog: Dog; onEdit: () => void }) {
  const { t } = useTranslation()
  const photoUrl = usePhotoUrl(dog.photo_path)
  const details = [dog.breed, dog.birth_date ? formatAge(t, dog.birth_date) : null].filter(Boolean).join(' · ')

  return (
    <section className="card dog-card">
      <div className="dog-photo">{photoUrl ? <img src={photoUrl} alt="" /> : <span>🐕</span>}</div>
      <div className="dog-info">
        <h2>{dog.name}</h2>
        {details && <p className="muted">{details}</p>}
      </div>
      <button className="link" onClick={onEdit}>
        {t('common.edit')}
      </button>
    </section>
  )
}
