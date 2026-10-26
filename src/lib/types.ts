// Typer som speglar tabellerna i supabase/migrations.

export interface Profile {
  id: string
  display_name: string | null
  locale: string
  time_zone: string
  created_at: string
}

export type MemberRole = 'owner' | 'member'
export type ReminderPref = 'all' | 'mine' | 'none'

export interface MemberPrefs {
  notify_events: boolean
  notify_reminders: ReminderPref
}

export interface Household {
  id: string
  name: string
  time_zone: string
  created_by: string | null
  created_at: string
}

export interface Dog {
  id: string
  household_id: string
  name: string
  breed: string | null
  birth_date: string | null
  photo_path: string | null
  created_at: string
  archived_at: string | null
}

export interface Member {
  user_id: string
  role: MemberRole
  display_name: string | null
}

export type EventType = 'walk' | 'meal'

export interface DogEvent {
  id: string
  household_id: string
  dog_id: string
  type: EventType
  occurred_at: string
  logged_by: string | null
  pee: boolean | null
  poop: boolean | null
  note: string | null
  photo_path: string | null
  created_at: string
}
