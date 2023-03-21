import { EmbedBuilder, GuildMember, Message, StageChannel } from "discord.js"

export default interface Data {
    member: GuildMember | null
    channel: StageChannel | null
    message: Message | null
    embedBuilder: EmbedBuilder | null
    startTime: number | null
    timer: NodeJS.Timeout | null
}