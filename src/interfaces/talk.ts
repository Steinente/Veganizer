export default interface Talk {
  id: number
  message_id: number
  user_id: number
  user_nickname: string | null
  user_tag: string
  user_roles: string | null
  message_datetime: string
  user_time_on_stage: number | null
  summary: string | null
  user_banned: boolean
  last_summary_mod_id: number | null
  last_void_mod_id: number | null
  last_talk_mod_id: number | null
  last_timeout_mod_id: number | null
  last_ban_mod_id: number | null
}