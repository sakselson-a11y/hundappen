// Typer som speglar tabellerna i supabase/migrations.

export interface Profile {
  id: string
  display_name: string | null
  locale: string
  time_zone: string
  created_at: string
}
