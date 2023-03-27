import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Colors,
  EmbedBuilder,
  Events,
  GuildMember,
  Message,
  PermissionFlagsBits,
  StageChannel,
  TextChannel,
  User,
} from 'discord.js'
import Data from '../interfaces/data'
import { SERVER_ID, STAGE_TRACKING_CHANNEL_ID, TALK_ROLE_ID, VOID_ROLE_ID, WHITE_MARK_EMOJI_ID } from '../veganizer'

export const dataArray: Data[] = []

export default (client: Client): void => {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (oldState.guild.id !== SERVER_ID) return
    if (
      newState.channel?.type === ChannelType.GuildStageVoice &&
      null !== oldState.requestToSpeakTimestamp &&
      null === newState.requestToSpeakTimestamp &&
      !newState.suppress &&
      !newState.member?.permissions.has(PermissionFlagsBits.MoveMembers)
    ) {
      const member: GuildMember = newState.member!
      const user: User = member.user
      const channel: StageChannel = newState.channel
      const avatar = user.displayAvatarURL({ forceStatic: true })
      const embedBuilder: EmbedBuilder = new EmbedBuilder()
        .setTitle(`${member.displayName} joined ${member.voice.channel!.name}`)
        .setDescription('Time on Stage: 00:00:00')
        .setTimestamp(new Date())
        .setColor(Colors.Green)
        .setThumbnail(avatar === user.defaultAvatarURL ? avatar : avatar.replace('.png', '.webp?size=256'))
        .setFooter({
          text: `${newState.client.user.username} by Steinente`,
          iconURL: newState.client.user.displayAvatarURL({ forceStatic: true }),
        })
        .addFields(
          { name: 'User', value: member.toString(), inline: true },
          { name: 'User-ID', value: member.id, inline: true }
        )
      let initialTalkButton: ButtonBuilder = new ButtonBuilder()
        .setCustomId('talk-button')
        .setLabel('Add Talk')
        .setStyle(ButtonStyle.Success)
      let initialVoidButton: ButtonBuilder = new ButtonBuilder()
        .setCustomId('void-button')
        .setLabel('Add Void')
        .setStyle(ButtonStyle.Secondary)

      for (const role of member.roles.cache.values()) {
        if (role.id === TALK_ROLE_ID) initialTalkButton = initialTalkButton.setLabel('Remove Talk')
        if (role.id === VOID_ROLE_ID) initialVoidButton = initialVoidButton.setLabel('Remove Void')
        if (initialTalkButton.data.label === 'Remove Talk' && initialVoidButton.data.label === 'Remove Void') break
      }

      const buttonBuilders: ButtonBuilder[] = [
        new ButtonBuilder().setCustomId('summary-button').setLabel('Add Summary').setStyle(ButtonStyle.Primary),
        initialTalkButton,
        initialVoidButton,
        new ButtonBuilder().setCustomId('ban-button').setLabel('Ban').setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('mod-button')
          .setEmoji(WHITE_MARK_EMOJI_ID)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(),
      ]
      const message: Message = await (newState.guild.channels.cache.get(STAGE_TRACKING_CHANNEL_ID) as TextChannel).send(
        {
          embeds: [embedBuilder],
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttonBuilders)],
        }
      )

      const newData: Data = {
        member,
        channel,
        message,
        embedBuilder,
        buttonBuilders,
        startTime: new Date().getTime(),
        timer: null,
      }

      dataArray.push(newData)
      startTrackingMessageTimer(newData)
    } else if (oldState.channel?.type === ChannelType.GuildStageVoice) {
      if (
        // leave Stage
        (!oldState.member?.permissions.has(PermissionFlagsBits.MoveMembers) &&
          null === oldState.requestToSpeakTimestamp &&
          newState.suppress) ||
        (null !== oldState.channelId && null === newState.channelId)
      ) {
        const member: GuildMember = oldState.member!
        const dataIndex: number = findDataIndex(member.user.id, oldState.channel)
        if (dataIndex === -1) return
        const data: Data = dataArray[dataIndex]

        onLeaveStage(data)
      }
    }
  })
}

export function onLeaveStage(data: Data): void {
  data.embedBuilder.setColor(Colors.Red)
  updateTrackingMessage(data, true)
  clear(data)
}

export function findDataIndex(userId: string | undefined, channel: StageChannel): number {
  return dataArray.findIndex(data => data.member.user.id === userId && data.channel.id === channel.id)
}

function startTrackingMessageTimer(newData: Data): void {
  const dataIndex: number = findDataIndex(newData.member.user.id, newData.channel)
  if (dataIndex === -1) return
  const data: Data = dataArray[dataIndex]

  data.timer = setInterval(() => {
    updateTrackingMessage(data, false)
  }, 5 * 1000)
}

function updateTrackingMessage(data: Data, isLeaving: boolean): void {
  const secs = Math.floor((Date.now() - data.startTime) / 1000)
  const min = Math.floor((secs % 3600) / 60)
  const hours = Math.floor(secs / 3600)
  data.embedBuilder.setDescription(
    `Time on Stage: ${hours.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${(secs % 60)
      .toString()
      .padStart(2, '0')}`
  )
  if (hours >= 1 && !isLeaving) data.embedBuilder.setColor(Colors.Yellow)
  updateTrackingMessageEmbed(data, isLeaving)
}

function updateTrackingMessageEmbed(data: Data, isLeaving: boolean): void {
  data.buttonBuilders[4].setDisabled(!isLeaving)
  data.message
    .edit({
      embeds: [data.embedBuilder],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(data.buttonBuilders)],
    })
    .then(message => (data.message = message))
    .catch(() => clear(data))
}

function clear(data: Data): void {
  data.timer && clearTimeout(data.timer)
  const dataIndex: number = findDataIndex(data.member.user.id, data.channel)
  if (dataIndex === -1) return
  dataArray.splice(dataIndex, 1)
}
