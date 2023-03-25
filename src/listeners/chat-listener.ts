import { ChannelType, Client, Events, Message, TextChannel } from 'discord.js'
import { MOVE_MEMBERS_PERMISSION, SERVER_ID, STAGE_TRACKING_CHANNEL_ID } from '../veganizer'
import { fixMessageIfBugged, manageSummary } from './interaction-listener'

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
      if (
        referencedMessage.guild.members.cache.get(message.author.id)!.permissions.has(MOVE_MEMBERS_PERMISSION)
      ) {
        fixMessageIfBugged(referencedMessage)
        if (message.content === '!fix') {
          fixMessageIfBugged(referencedMessage)
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
