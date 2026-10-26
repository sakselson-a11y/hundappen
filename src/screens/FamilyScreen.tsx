import FamilyCard from '../components/FamilyCard.tsx'
import StatusCard from '../components/StatusCard.tsx'
import NotificationSettings from '../components/NotificationSettings.tsx'
import AccountCard from '../components/AccountCard.tsx'
import type { Dog } from '../lib/types.ts'

export default function FamilyScreen({ dog }: { dog: Dog }) {
  return (
    <>
      <FamilyCard dogName={dog.name} />
      <NotificationSettings dogName={dog.name} />
      <AccountCard dogName={dog.name} />
      <StatusCard />
    </>
  )
}
