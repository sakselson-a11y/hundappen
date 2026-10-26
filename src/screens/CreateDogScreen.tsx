import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { resizeImage, uploadDogPhoto } from '../lib/photos.ts'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import DogForm, { type DogFormValues } from '../components/DogForm.tsx'
import type { Dog } from '../lib/types.ts'

export default function CreateDogScreen() {
  const { t } = useTranslation()
  const { reload } = useHousehold()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(values: DogFormValues) {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_household_with_dog', {
      dog_name: values.name,
      dog_breed: values.breed || null,
      dog_birth_date: values.birthDate || null,
      household_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    if (error || !data) {
      if (error?.message === 'already_in_household') await reload()
      else setError(t('errors.generic'))
      setBusy(false)
      return
    }
    const dog = data as Dog

    // Hunden finns nu. Om fotot misslyckas går det att lägga till senare.
    if (values.photo) {
      try {
        const image = await resizeImage(values.photo)
        const path = await uploadDogPhoto(dog.household_id, dog.id, image)
        await supabase.from('dogs').update({ photo_path: path }).eq('id', dog.id)
      } catch {
        // Ignoreras medvetet; användaren kan välja foto igen under "Redigera".
      }
    }
    await reload()
  }

  return (
    <>
      <section className="card">
        <h2>{t('createDog.welcome')}</h2>
        <p className="muted">{t('createDog.intro')}</p>
      </section>
      <DogForm title={t('createDog.title')} submitLabel={t('createDog.submit')} busy={busy} error={error} onSubmit={create} />
      <section className="card">
        <h2>{t('createDog.joinTitle')}</h2>
        <p className="muted">{t('createDog.joinText')}</p>
      </section>
    </>
  )
}
