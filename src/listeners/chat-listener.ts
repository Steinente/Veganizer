import { ChannelType, Client, Embed, EmbedBuilder, Events, Message, TextChannel } from 'discord.js'
import Data from 'src/interfaces/data'
import { MOVE_MEMBERS_PERMISSION, SERVER_ID, STAGE_TRACKING_CHANNEL_ID } from '../veganizer'
import { appendLog, fixMessageIfBugged, getStageChannel, manageSummary } from './interaction-listener'
import { dataArray, findDataIndex } from './voice-listener'

export default (client: Client): void => {
  client.on(Events.MessageCreate, async message => {
    if (message.guild?.id !== SERVER_ID) return
    if (message.channel.id !== STAGE_TRACKING_CHANNEL_ID) return
    if (message.channel.type !== ChannelType.GuildText) return
    if (null === message.reference) return
    const referencedMessage = await message.channel.messages.fetch(message.reference!.messageId!)
    if (referencedMessage.author.id !== client.user!.id) return
    if (null === referencedMessage.embeds[0]) return
    await message.delete().then(() => {
      if (referencedMessage.guild.members.cache.get(message.author.id)!.permissions.has(MOVE_MEMBERS_PERMISSION)) {
        fixMessageIfBugged(referencedMessage)
        if (message.content === '!rmpp' || message.content === '!removeprofilepicture') {
          const embed: Embed = referencedMessage.embeds[0]
          const targetUserId = embed.fields[1].value
          const data: Data =
            dataArray[
              findDataIndex(targetUserId, getStageChannel(referencedMessage.guild.channels.cache, embed)) ?? null
            ]
          appendLog(referencedMessage, embed, message.member!.user, targetUserId, 'Removed picture')
          referencedMessage.edit({ embeds: [new EmbedBuilder(embed.data).setThumbnail(null)] })
          if (referencedMessage.id === data?.message.id) data.embedBuilder.setThumbnail(null)
        } else if (message.content.length < 4 || message.content.length > 512) {
          reply(
            message,
            `The summary must contain at least 4 and a maximum of 512 characters. Here is your summary:\n\n${message.content}`
          )
        } else {
          manageSummary(
            message.author,
            message.content,
            message.guild!,
            referencedMessage.embeds[0],
            referencedMessage,
            referencedMessage.embeds[0].fields[1].value,
            referencedMessage.components[0].components
          )
        }
      } else reply(message, 'You do not have enough permissions.')
    })
  })

  function reply(message: Message, value: string) {
    const sentMessage = (message.channel as TextChannel).send(`${message.author.toString()} ${value}`)
    setTimeout(() => {
      sentMessage.then(msg => msg.delete().catch(() => {}))
    }, 15000)
  }
}
