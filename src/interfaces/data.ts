import { ButtonBuilder, EmbedBuilder, GuildMember, Message, StageChannel } from 'discord.js'

export default interface Data {
  member: GuildMember | null
  channel: StageChannel | null
  message: Message | null
  embedBuilder: EmbedBuilder | null
  buttonBuilders: ButtonBuilder[]
  startTime: number | null
  timer: NodeJS.Timeout | null
}
