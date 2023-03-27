import { ButtonBuilder, EmbedBuilder, GuildMember, Message, StageChannel } from 'discord.js'

export default interface Data {
  member: GuildMember
  channel: StageChannel
  message: Message
  embedBuilder: EmbedBuilder
  buttonBuilders: ButtonBuilder[]
  startTime: number
  timer: NodeJS.Timeout | null
}
