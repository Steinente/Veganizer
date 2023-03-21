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
  PermissionsBitField,
  StageChannel,
  TextChannel,
  User,
} from 'discord.js'
import Data from '../interfaces/data'
import { SERVER_ID, STAGE_TRACKING_CHANNEL_ID, TALK_ROLE_ID, VOID_ROLE_ID } from '../veganizer'

export const dataArray: Data[] = []
const summaryButton: ButtonBuilder = new ButtonBuilder()
  .setCustomId('summary-button')
  .setLabel('Add Summary')
  .setStyle(ButtonStyle.Primary)
const talkButton: ButtonBuilder = new ButtonBuilder()
  .setCustomId('talk-button')
  .setLabel('Add Talk')
  .setStyle(ButtonStyle.Success)
const voidButton: ButtonBuilder = new ButtonBuilder()
  .setCustomId('void-button')
  .setLabel('Add Void')
  .setStyle(ButtonStyle.Secondary)
const banButton: ButtonBuilder = new ButtonBuilder()
  .setCustomId('ban-button')
  .setLabel('Ban')
  .setStyle(ButtonStyle.Danger)

export default (client: Client): void => {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (oldState.guild.id !== SERVER_ID) return
    if (
      newState.channel?.type === ChannelType.GuildStageVoice &&
      null !== oldState.requestToSpeakTimestamp &&
      null === newState.requestToSpeakTimestamp &&
      !newState.suppress &&
      !newState.member?.permissions.has(PermissionsBitField.Flags.MoveMembers)
    ) {
      const member: GuildMember = newState.member!
      const user: User = member.user
      const channel: StageChannel = newState.channel

      const embedBuilder: EmbedBuilder = new EmbedBuilder()
        .setTitle(`${member.displayName} joined ${member.voice.channel!.name}`)
        .setDescription('Time on Stage: 00:00:00')
        .setTimestamp(new Date())
        .setColor(Colors.Green)
        .setThumbnail(user.displayAvatarURL({ forceStatic: true }).replace('.png', '.webp?size=256'))
        .setFooter({
          text: `${newState.client.user.username} by Steinente`,
          iconURL: newState.client.user.displayAvatarURL({ forceStatic: true }),
        })
        .addFields(
          { name: 'User', value: member.toString(), inline: true },
          { name: 'User-ID', value: member.id, inline: true }
        )

      const initialTalkButton: ButtonBuilder = member.roles.cache.some(role => role.id === TALK_ROLE_ID)
        ? talkButton.setLabel('Remove Talk')
        : talkButton
      const initialVoidButton: ButtonBuilder = member.roles.cache.some(role => role.id === VOID_ROLE_ID)
        ? voidButton.setLabel('Remove Void')
        : voidButton

      const message: Message = await (newState.guild.channels.cache.get(STAGE_TRACKING_CHANNEL_ID) as TextChannel).send(
        {
          embeds: [embedBuilder],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              summaryButton,
              initialTalkButton,
              initialVoidButton,
              banButton
            ),
          ],
        }
      )

      const newData: Data = {
        member,
        channel,
        message,
        embedBuilder,
        startTime: new Date().getTime(),
        timer: null,
      }

      dataArray.push(newData)
      startTrackingMessageTimer(newData)
    } else if (oldState.channel?.type === ChannelType.GuildStageVoice) {
      if ( // leave Stage
        (!oldState.member?.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
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
  data.embedBuilder!.setColor(Colors.Red)
  updateTrackingMessage(data)
  clear(data)
}

export function findDataIndex(userId: string | undefined, channel: StageChannel): number {
  return dataArray.findIndex(data => data.member?.user.id === userId && data.channel?.id === channel.id)
}

function startTrackingMessageTimer(newData: Data): void {
  const dataIndex: number = findDataIndex(newData.member!.user.id, newData.channel!)
  if (dataIndex === -1) return
  const data: Data = dataArray[dataIndex]

  data.timer = setInterval(() => {
    updateTrackingMessage(data)
  }, 5 * 1000)
}

function updateTrackingMessage(data: Data): void {
  const secs = Math.floor((Date.now() - data.startTime!) / 1000)
  const min = Math.floor((secs % 3600) / 60)
  const hours = Math.floor(secs / 3600)
  data.embedBuilder!.setDescription(
    `Time on Stage: ${hours.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${(secs % 60)
      .toString()
      .padStart(2, '0')}`
  )
  if (hours >= 1) data.embedBuilder!.setColor(Colors.Yellow)
  updateTrackingMessageEmbed(data)
}

function updateTrackingMessageEmbed(data: Data): void {
  if (!data.message) return
  data.message
    .edit({ embeds: [data.embedBuilder!] })
    .then(message => (data.message = message))
    .catch(() => clear(data))
}

function clear(data: Data): void {
  data.timer && clearTimeout(data.timer)
  const dataIndex: number = findDataIndex(data.member!.user.id, data.channel!)
  if (dataIndex === -1) return
  dataArray.splice(dataIndex, 1)
}
