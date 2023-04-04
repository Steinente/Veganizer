import { ChannelType, Client, Colors, Embed, EmbedBuilder, Events, Message, TextChannel } from 'discord.js'
import Tracking from 'src/interfaces/tracking'
import {
  MOVE_MEMBERS_PERMISSION,
  SERVER_ID,
  STAGE_MODERATION_CHANNEL_ID,
  STAGE_TRACKING_CHANNEL_ID,
  moderationMessage,
  reloadModerationMessage,
} from '../veganizer'
import { appendLog, fixMessageIfBugged, getStageChannel, manageSummary } from './interaction-listener'
import { findTrackingIndex, trackingArray } from './voice-listener'

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
          const tracking: Tracking =
            trackingArray[
              findTrackingIndex(targetUserId, getStageChannel(referencedMessage.guild.channels.cache, embed)) ?? null
            ]
          appendLog(referencedMessage, embed, message.member!.user, targetUserId, 'Removed picture')
          referencedMessage.edit({ embeds: [new EmbedBuilder(embed.data).setThumbnail(null)] })
          if (referencedMessage.id === tracking?.message.id) tracking.embedBuilder.setThumbnail(null)
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

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (oldMessage.guild?.id !== SERVER_ID) return
    if (oldMessage.channel.id !== STAGE_TRACKING_CHANNEL_ID) return
    if (oldMessage.channel.type !== ChannelType.GuildText) return
    if (oldMessage.author?.id !== client.user?.id) return
    if (oldMessage.embeds[0].color !== Colors.Red && newMessage.embeds[0].color === Colors.Red) {
      const moderationChannel: TextChannel = client.channels.cache.get(STAGE_MODERATION_CHANNEL_ID) as TextChannel
      await moderationChannel.bulkDelete(100).then(() => {
        const newEmbeds = [
          ...moderationMessage.embeds,
          new EmbedBuilder().setDescription(`${newMessage.embeds[0].fields[0].value}: ${newMessage.url}`).data as Embed,
        ]
        moderationChannel
          .send({
            content: 'Zu moderierende Stage-Tracking-Nachrichten:',
            embeds: newEmbeds,
          })
          .catch(error => {
            if (error.code === 10008) reloadModerationMessage()
          })
        moderationMessage.embeds = newEmbeds
      })
    } else if (oldMessage.embeds[0].color === Colors.Red && newMessage.embeds[0].color !== Colors.Red) {
      const filteredEmbeds: Embed[] = moderationMessage.embeds.filter(
        embed => !embed.description?.includes(newMessage.url)
      )
      const embedsToSend: Embed[] = filteredEmbeds.length === 0 ? [] : [...filteredEmbeds]
      await moderationMessage
        .edit({
          content:
            filteredEmbeds.length === 0
              ? 'Derzeit keine Moderation notwendig.'
              : 'Zu moderierende Stage-Tracking-Nachrichten:',
          embeds: embedsToSend,
        })
        .catch(error => {
          if (error.code === 10008) reloadModerationMessage()
        })
    }
  })

  function reply(message: Message, value: string): void {
    const sentMessage = (message.channel as TextChannel).send(`${message.author.toString()} ${value}`)
    setTimeout(() => sentMessage.then(msg => msg.delete().catch(() => {})), 15000)
  }
}
