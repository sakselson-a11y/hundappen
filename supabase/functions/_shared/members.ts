// Medlemmar vars hundvaktsuppdrag gått ut räknas inte (de städas bort varje natt).
export function activeMembersFilter(): string {
  return `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`
}
