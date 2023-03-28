import { ButtonBuilder, EmbedBuilder, GuildMember, Message, StageChannel } from 'discord.js'

export default interface Tracking {
  member: GuildMember
  channel: StageChannel
  message: Message
  embedBuilder: EmbedBuilder
  buttonBuilders: ButtonBuilder[]
  startTime: number
  timer: NodeJS.Timeout | null
}
