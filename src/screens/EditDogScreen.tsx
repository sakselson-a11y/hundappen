import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { deleteDogPhoto, resizeImage, uploadDogPhoto } from '../lib/photos.ts'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import DogForm, { type DogFormValues } from '../components/DogForm.tsx'
import type { Dog } from '../lib/types.ts'

export default function EditDogScreen({ dog, onDone }: { dog: Dog; onDone: () => void }) {
  const { t } = useTranslation()
  const { reload } = useHousehold()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(values: DogFormValues) {
    setBusy(true)
    setError(null)
    try {
      let photoPath = dog.photo_path
      if (values.photo) {
        const image = await resizeImage(values.photo)
        photoPath = await uploadDogPhoto(dog.household_id, dog.id, image)
      } else if (values.photo === null) {
        photoPath = null
      }
      const { error } = await supabase
        .from('dogs')
        .update({
          name: values.name,
          breed: values.breed || null,
          birth_date: values.birthDate || null,
          photo_path: photoPath,
        })
        .eq('id', dog.id)
      if (error) throw error
      if (dog.photo_path && dog.photo_path !== photoPath) await deleteDogPhoto(dog.photo_path)
      await reload()
      onDone()
    } catch {
      setError(t('errors.generic'))
      setBusy(false)
    }
  }

  return (
    <DogForm
      title={t('editDog.title', { name: dog.name })}
      submitLabel={t('common.save')}
      initial={{ name: dog.name, breed: dog.breed, birthDate: dog.birth_date, photoPath: dog.photo_path }}
      busy={busy}
      error={error}
      onSubmit={save}
      onCancel={onDone}
    />
  )
}
