// Typer som speglar tabellerna i supabase/migrations.

export interface Profile {
  id: string
  display_name: string | null
  locale: string
  time_zone: string
  created_at: string
}

export type MemberRole = 'owner' | 'member'

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
