import {
  ActionRowBuilder,
  APIEmbedField,
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
import Tracking from '../interfaces/tracking'
import {
  BOT_APPROVED_ROLE_ID,
  mariaDB,
  SERVER_ID,
  STAGE_TRACKING_CHANNEL_ID,
  TALK_ROLE_ID,
  VOID_ROLE_ID
} from '../veganizer'

export const trackingArray: Tracking[] = []

export default (client: Client): void => {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (oldState.guild.id !== SERVER_ID) return
    if ( // join Stage
      newState.channel?.type === ChannelType.GuildStageVoice &&
      null !== oldState.requestToSpeakTimestamp &&
      null === newState.requestToSpeakTimestamp &&
      !newState.suppress &&
      !newState.member?.permissions.has(PermissionFlagsBits.MoveMembers) &&
      !newState.member?.roles.cache.has(BOT_APPROVED_ROLE_ID)
    ) {
      const member: GuildMember = newState.member!
      const user: User = member.user
      const channel: StageChannel = newState.channel
      const avatar: string = user.displayAvatarURL({ forceStatic: true })
      const embedBuilder: EmbedBuilder = new EmbedBuilder()
        .setTitle(`${member.displayName} joined ${member.voice.channel!.name}`)
        .setDescription(
          `Number conversations: ${
            (await mariaDB.selectTalkCountByUserId(user.id))[0]['count(message_id)']
          }\nTime on Stage: 00:00:00`
        )
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

      const actionRowBuilders: ActionRowBuilder<ButtonBuilder>[] = [
        // ModerationActionRow
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('summary-button').setLabel('Add Summary').setStyle(ButtonStyle.Primary),
          initialTalkButton,
          initialVoidButton,
          new ButtonBuilder().setCustomId('ban-button').setLabel('Ban').setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('mod-button')
            .setEmoji('1089867992189382667')
            .setStyle(ButtonStyle.Primary)
            .setDisabled()
        ),
        // AdditionalActionRow
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('history-button')
            .setEmoji('1093149473695334400')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('legend-button')
            .setEmoji('1092740381491339314')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('stats-button')
            .setEmoji('1092740397077381130')
            .setStyle(ButtonStyle.Secondary)
        ),
      ]
      const message: Message = await (newState.guild.channels.cache.get(STAGE_TRACKING_CHANNEL_ID) as TextChannel).send(
        {
          embeds: [embedBuilder],
          components: actionRowBuilders,
        }
      )

      const newTracking: Tracking = {
        member,
        channel,
        message,
        embedBuilder,
        actionRowBuilders,
        startTime: new Date().getTime(),
        timer: null,
      }

      trackingArray.push(newTracking)
      startTrackingMessageTimer(newTracking)
      await mariaDB.insertTalk(message, member)
    } else if (oldState.channel?.type === ChannelType.GuildStageVoice) {
      if ( // leave Stage
        (!oldState.member?.permissions.has(PermissionFlagsBits.MoveMembers) &&
          null === oldState.requestToSpeakTimestamp &&
          newState.suppress) ||
        (null !== oldState.channelId && null === newState.channelId)
      ) {
        const member: GuildMember = oldState.member!
        const trackingIndex: number = findTrackingIndex(member.user.id, oldState.channel)
        if (trackingIndex === -1) return
        const tracking: Tracking = trackingArray[trackingIndex]

        onLeaveStage(tracking)
      }
    }
  })
}

function onLeaveStage(tracking: Tracking): void {
  const fields: APIEmbedField[] = tracking.embedBuilder.data.fields!
  if (fields.length > 2 && fields[2].name.startsWith('Summary by ')) {
    tracking.embedBuilder.setColor(Colors.Red)
    tracking.actionRowBuilders[0].components[4].setDisabled(false)
  } else tracking.embedBuilder.setColor(Colors.Blue)
  updateTrackingMessage(tracking, true)
  clear(tracking)
}

export function findTrackingIndex(userId: string | undefined, channel: StageChannel): number {
  return trackingArray.findIndex(tracking => tracking.member.user.id === userId && tracking.channel.id === channel.id)
}

function startTrackingMessageTimer(newTracking: Tracking): void {
  const trackingIndex: number = findTrackingIndex(newTracking.member.user.id, newTracking.channel)
  if (trackingIndex === -1) return
  const tracking: Tracking = trackingArray[trackingIndex]

  tracking.timer = setInterval(() => updateTrackingMessage(tracking), 5 * 1000)
}

function updateTrackingMessage(tracking: Tracking, isLeaving: boolean = false): void {
  const descriptionWithoutTime = tracking.embedBuilder.data.description!.replace(/\d{2}:\d{2}:\d{2}/, '')
  const secs = Math.floor((Date.now() - tracking.startTime) / 1000)
  const min = Math.floor((secs % 3600) / 60)
  const hours = Math.floor(secs / 3600)
  tracking.embedBuilder.setDescription(
    `${descriptionWithoutTime}${hours.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${(secs % 60)
      .toString()
      .padStart(2, '0')}`
  )
  if (hours >= 1 && !isLeaving && tracking.embedBuilder.data.color !== Colors.Yellow) {
    tracking.embedBuilder.setColor(Colors.Yellow)
    tracking.channel.client.users.cache.get('417355342142504960')?.send(`Über eine Stunde auf der Stage -> ${tracking.message.url}`)
  }
  updateTrackingMessageEmbed(tracking, isLeaving, secs)
}

async function updateTrackingMessageEmbed(tracking: Tracking, isLeaving: boolean, timeOnStage: number): Promise<void> {
  tracking.message
    .edit({
      embeds: [tracking.embedBuilder],
      components: tracking.actionRowBuilders,
    })
    .then(message => (tracking.message = message))
    .catch(() => clear(tracking))

  if (isLeaving) await mariaDB.updateTalkOnLeave(tracking, timeOnStage)
}

function clear(tracking: Tracking): void {
  tracking.timer && clearTimeout(tracking.timer)
  const trackingIndex: number = findTrackingIndex(tracking.member.user.id, tracking.channel)
  if (trackingIndex === -1) return
  trackingArray.splice(trackingIndex, 1)
}
