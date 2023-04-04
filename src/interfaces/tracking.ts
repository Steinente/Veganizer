import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, GuildMember, Message, StageChannel } from 'discord.js'

export default interface Tracking {
  member: GuildMember
  channel: StageChannel
  message: Message
  embedBuilder: EmbedBuilder
  actionRowBuilders: ActionRowBuilder<ButtonBuilder>[]
  startTime: number
  timer: NodeJS.Timeout | null
}
