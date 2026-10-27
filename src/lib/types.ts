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
  household_id: string
  role: MemberRole
  display_name: string | null
  // Hundvakt: medlemskapet gäller till den här tidpunkten.
  expires_at: string | null
}

export type EventType = 'walk' | 'meal'
export type WalkLength = 'short' | 'long'

export interface DogEvent {
  id: string
  household_id: string
  dog_id: string
  type: EventType
  walk_length: WalkLength | null
  occurred_at: string
  logged_by: string | null
  pee: boolean | null
  poop: boolean | null
  note: string | null
  photo_path: string | null
  created_at: string
  // Sparad i telefonen, väntar på nät (finns inte i databasen än).
  pending?: boolean
}

export interface Schedule {
  id: string
  household_id: string
  dog_id: string
  type: EventType
  walk_length: WalkLength | null
  local_time: string // "07:00:00"
  days_of_week: number[] // 1 = måndag … 7 = söndag
  responsible_user_id: string | null
  remind_minutes_before: number | null
  skip_window_minutes: number
  active: boolean
  created_by: string | null
  created_at: string
}

// Byt tur för ett tillfälle (en schemarad en viss dag i hushållets tidszon).
export interface ScheduleOverride {
  schedule_id: string
  occurrence_date: string // YYYY-MM-DD
  household_id: string
  responsible_user_id: string | null
  changed_by: string | null
}
