import {
  ActionRow,
  ActionRowBuilder,
  APIEmbedField,
  ButtonBuilder,
  ButtonComponent,
  ButtonInteraction,
  ChannelType,
  Client,
  Collection,
  Colors,
  Embed,
  EmbedBuilder,
  Events,
  Guild,
  GuildBasedChannel,
  GuildMember,
  Message,
  MessageActionRowComponent,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionsBitField,
  Role,
  RoleResolvable,
  StageChannel,
  TextInputBuilder,
  TextInputStyle,
  User,
} from 'discord.js'
import Talk from 'src/interfaces/talk'
import Tracking from 'src/interfaces/tracking'
import {
  BAN_MEMBERS_PERMISSION,
  MANAGE_ROLES_PERMISSION,
  mariaDB,
  MOVE_MEMBERS_PERMISSION,
  NEW_ROLE_ID,
  reloadActivityMessage,
  SERVER_ID,
  STAGE_ACTIVITY_CHANNEL_ID,
  STAGE_TRACKING_CHANNEL_ID,
  TALK_ROLE_ID,
  VOID_ROLE_ID,
} from '../veganizer'
import { findTrackingIndex, trackingArray } from './voice-listener'

export default (client: Client): void => {
  client.on(Events.InteractionCreate, async interaction => {
    const guild = interaction.guild
    if (guild?.id !== SERVER_ID) return
    const member: GuildMember = interaction.member as GuildMember
    const user: User = member.user
    if (interaction.isButton()) {
      const buttonInteraction: ButtonInteraction = interaction as ButtonInteraction
      if (interaction.channelId === STAGE_ACTIVITY_CHANNEL_ID) {
        switch (buttonInteraction.customId) {
          case 'activity-button':
            reloadActivityMessage(false)
            buttonInteraction.deferUpdate()
            break
        }
      } else {
        const permissions: PermissionsBitField = member.permissions
        const roles: Collection<string, Role> = guild.roles.cache
        const talkRole: RoleResolvable = roles.get(TALK_ROLE_ID)!
        const voidRole: RoleResolvable = roles.get(VOID_ROLE_ID)!
        const newRole: RoleResolvable = roles.get(NEW_ROLE_ID)!
        const message: Message = buttonInteraction.message
        const embed: Embed = message.embeds[0]
        const fields: APIEmbedField[] = embed.fields
        const targetUserId: string = fields[1].value
        const targetUser = client.users.cache.get(targetUserId)
        const targetUserName: string = targetUser?.username ?? ''
        const targetMember: GuildMember = (await guild.members.fetch(targetUserId).catch(() => {})) as GuildMember
        const modComponents: MessageActionRowComponent[] = message.components[0].components
        const additionalActionRow: ActionRow<ButtonComponent> = message.components[1] as ActionRow<ButtonComponent>
        const label: string = buttonInteraction.component.label!
        const stageChannel: StageChannel = getStageChannel(guild.channels.cache, embed)
        const trackingIndex: number = findTrackingIndex(targetUserId, stageChannel)
        const tracking: Tracking = trackingArray[trackingIndex] ?? null
        const isOnStage: boolean = message.id === tracking?.message.id

        switch (buttonInteraction.customId) {
          case 'summary-button':
            const summaryIndex: number = fields.findIndex(field => field.name.startsWith('Summary by '))
            if (permissions.has(MOVE_MEMBERS_PERMISSION)) {
              createModalBuilder(
                'summary-message',
                true,
                'E.g.: Has played soundboard, screamed the N-word, ...',
                targetUserName,
                buttonInteraction,
                -1 !== summaryIndex ? fields[summaryIndex].value : ''
              )
            } else replyNoPermissions(buttonInteraction)
            break
          case 'talk-button':
            if (permissions.has(MANAGE_ROLES_PERMISSION) && member.roles.highest.comparePositionTo(talkRole)) {
              if (targetMember) {
                const hasTalk = targetMember.roles.cache.has(talkRole.id)

                if (label === 'Add Talk') {
                  if (hasTalk) {
                    await buttonInteraction.reply({ content: 'User already has Talk.', ephemeral: true }).then(() => {
                      if (isOnStage) tracking.actionRowBuilders[0].components[1].setLabel('Remove Talk')
                      message.edit({
                        components: [
                          new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder(modComponents[0].data),
                            new ButtonBuilder(modComponents[1].data).setLabel('Remove Talk'),
                            new ButtonBuilder(modComponents[2].data),
                            new ButtonBuilder(modComponents[3].data),
                            new ButtonBuilder(modComponents[4].data)
                          ),
                          additionalActionRow,
                        ],
                      })
                    })
                  } else {
                    await targetMember.roles.add(talkRole).then(() => {
                      appendLog(message, embed, user, targetUserId, 'Added Talk')
                      if (isOnStage) tracking.actionRowBuilders[0].components[1].setLabel('Remove Talk')
                      const newEmbedBuilder: EmbedBuilder = getColoredEmbed(embed, isOnStage, tracking)
                      message.edit({
                        embeds: [newEmbedBuilder],
                        components: [
                          new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder(modComponents[0].data),
                            new ButtonBuilder(modComponents[1].data).setLabel('Remove Talk'),
                            new ButtonBuilder(modComponents[2].data),
                            new ButtonBuilder(modComponents[3].data),
                            new ButtonBuilder(modComponents[4].data).setDisabled(
                              newEmbedBuilder.data.color === Colors.Blue
                            )
                          ),
                          additionalActionRow,
                        ],
                      })
                      mariaDB.updateTalkOnRoleChange(message, targetMember, member, 'talk')
                      buttonInteraction.deferUpdate()
                    })
                  }
                } else if (label === 'Remove Talk') {
                  if (hasTalk) {
                    await targetMember.roles.remove(talkRole).then(() => {
                      appendLog(message, embed, user, targetUserId, 'Removed Talk')
                      if (isOnStage) tracking.actionRowBuilders[0].components[1].setLabel('Add Talk')
                      const newEmbedBuilder: EmbedBuilder = getColoredEmbed(embed, isOnStage, tracking)
                      message.edit({
                        embeds: [newEmbedBuilder],
                        components: [
                          new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder(modComponents[0].data),
                            new ButtonBuilder(modComponents[1].data).setLabel('Add Talk'),
                            new ButtonBuilder(modComponents[2].data),
                            new ButtonBuilder(modComponents[3].data),
                            new ButtonBuilder(modComponents[4].data).setDisabled(
                              newEmbedBuilder.data.color === Colors.Blue
                            )
                          ),
                          additionalActionRow,
                        ],
                      })
                      mariaDB.updateTalkOnRoleChange(message, targetMember, member, 'talk')
                      buttonInteraction.deferUpdate()
                    })
                  } else {
                    await buttonInteraction.reply({ content: "User doesn't have Talk.", ephemeral: true }).then(() => {
                      if (isOnStage) tracking.actionRowBuilders[0].components[1].setLabel('Add Talk')
                      message.edit({
                        components: [
                          new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder(modComponents[0].data),
                            new ButtonBuilder(modComponents[1].data).setLabel('Add Talk'),
                            new ButtonBuilder(modComponents[2].data),
                            new ButtonBuilder(modComponents[3].data),
                            new ButtonBuilder(modComponents[4].data)
                          ),
                          additionalActionRow,
                        ],
                      })
                    })
                  }
                }
              } else replyNotOnServer(buttonInteraction)
            } else replyNoPermissions(buttonInteraction)
            break
          case 'void-button':
            if (permissions.has(MANAGE_ROLES_PERMISSION) && member.roles.highest.comparePositionTo(voidRole)) {
              if (targetMember) {
                const hasVoid = targetMember.roles.cache.has(voidRole.id)

                if (label === 'Add Void') {
                  if (hasVoid) {
                    await buttonInteraction.reply({ content: 'User already has Void.', ephemeral: true }).then(() => {
                      if (isOnStage) tracking.actionRowBuilders[0].components[2].setLabel('Remove Void')
                      message.edit({
                        components: [
                          new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder(modComponents[0].data),
                            new ButtonBuilder(modComponents[1].data),
                            new ButtonBuilder(modComponents[2].data).setLabel('Remove Void'),
                            new ButtonBuilder(modComponents[3].data),
                            new ButtonBuilder(modComponents[4].data)
                          ),
                          additionalActionRow,
                        ],
                      })
                    })
                  } else {
                    await targetMember.roles.add(voidRole).then(() => {
                      appendLog(message, embed, user, targetUserId, 'Added Void')
                      if (isOnStage) {
                        tracking.actionRowBuilders[0].components[1].setLabel('Add Talk')
                        tracking.actionRowBuilders[0].components[2].setLabel('Remove Void')
                      }
                      const newEmbedBuilder: EmbedBuilder = getColoredEmbed(embed, isOnStage, tracking)
                      message.edit({
                        embeds: [newEmbedBuilder],
                        components: [
                          new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder(modComponents[0].data),
                            new ButtonBuilder(modComponents[1].data).setLabel('Add Talk'),
                            new ButtonBuilder(modComponents[2].data).setLabel('Remove Void'),
                            new ButtonBuilder(modComponents[3].data),
                            new ButtonBuilder(modComponents[4].data).setDisabled(
                              newEmbedBuilder.data.color === Colors.Blue
                            )
                          ),
                          additionalActionRow,
                        ],
                      })
                      targetMember.roles.remove(newRole).then(() => {
                        targetMember.roles.remove(talkRole).then(() => {
                          mariaDB.updateTalkOnRoleChange(message, targetMember, member, 'void')
                        })
                      })
                      buttonInteraction.deferUpdate()
                    })
                  }
                } else if (label === 'Remove Void') {
                  if (hasVoid) {
                    await targetMember.roles.remove(voidRole).then(() => {
                      appendLog(message, embed, user, targetUserId, 'Removed Void')
                      if (isOnStage) tracking.actionRowBuilders[0].components[2].setLabel('Add Void')
                      const newEmbedBuilder: EmbedBuilder = getColoredEmbed(embed, isOnStage, tracking)
                      message.edit({
                        embeds: [newEmbedBuilder],
                        components: [
                          new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder(modComponents[0].data),
                            new ButtonBuilder(modComponents[1].data),
                            new ButtonBuilder(modComponents[2].data).setLabel('Add Void'),
                            new ButtonBuilder(modComponents[3].data),
                            new ButtonBuilder(modComponents[4].data).setDisabled(
                              newEmbedBuilder.data.color === Colors.Blue
                            )
                          ),
                          additionalActionRow,
                        ],
                      })
                      mariaDB.updateTalkOnRoleChange(message, targetMember, member, 'void')
                      buttonInteraction.deferUpdate()
                    })
                  } else {
                    await buttonInteraction.reply({ content: "User doesn't have Void.", ephemeral: true }).then(() => {
                      if (isOnStage) tracking.actionRowBuilders[0].components[2].setLabel('Add Void')
                      message.edit({
                        components: [
                          new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder(modComponents[0].data),
                            new ButtonBuilder(modComponents[1].data),
                            new ButtonBuilder(modComponents[2].data).setLabel('Add Void'),
                            new ButtonBuilder(modComponents[3].data),
                            new ButtonBuilder(modComponents[4].data)
                          ),
                          additionalActionRow,
                        ],
                      })
                    })
                  }
                }
              } else replyNotOnServer(buttonInteraction)
            } else replyNoPermissions(buttonInteraction)
            break
          case 'ban-button':
            if (permissions.has(BAN_MEMBERS_PERMISSION)) {
              const banList = await guild.bans.fetch()
              const isBanned = banList?.some(ban => ban.user.id === targetUserId) ?? false
              if (label === 'Ban') {
                if (isBanned) {
                  await buttonInteraction.reply({ content: 'User is already banned.', ephemeral: true }).then(() => {
                    if (isOnStage) tracking.actionRowBuilders[0].components[3].setLabel('Unban')
                    message.edit({
                      components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                          new ButtonBuilder(modComponents[0].data),
                          new ButtonBuilder(modComponents[1].data),
                          new ButtonBuilder(modComponents[2].data),
                          new ButtonBuilder(modComponents[3].data).setLabel('Unban'),
                          new ButtonBuilder(modComponents[4].data)
                        ),
                        additionalActionRow,
                      ],
                    })
                  })
                } else {
                  createModalBuilder(
                    'ban-reason',
                    false,
                    'E.g.: Has offended, made racist remarks, ...',
                    targetUserName,
                    buttonInteraction,
                    ''
                  )
                }
              } else if (label === 'Unban') {
                if (isBanned) {
                  guild.members.unban(targetUserId).then(() => {
                    appendLog(message, embed, user, targetUserId, 'Unbanned')
                    if (isOnStage) tracking.actionRowBuilders[0].components[3].setLabel('Ban')
                    message.edit({
                      embeds: [embed],
                      components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                          new ButtonBuilder(modComponents[0].data),
                          new ButtonBuilder(modComponents[1].data),
                          new ButtonBuilder(modComponents[2].data),
                          new ButtonBuilder(modComponents[3].data).setLabel('Ban'),
                          new ButtonBuilder(modComponents[4].data)
                        ),
                        additionalActionRow,
                      ],
                    })
                    mariaDB.updateTalkOnBan(message, targetUserId, member)
                    buttonInteraction.deferUpdate()
                  })
                } else {
                  await buttonInteraction.reply({ content: 'User is already unbanned.', ephemeral: true }).then(() => {
                    if (isOnStage) tracking.actionRowBuilders[0].components[3].setLabel('Ban')
                    message.edit({
                      components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                          new ButtonBuilder(modComponents[0].data),
                          new ButtonBuilder(modComponents[1].data),
                          new ButtonBuilder(modComponents[2].data),
                          new ButtonBuilder(modComponents[3].data).setLabel('Ban'),
                          new ButtonBuilder(modComponents[4].data)
                        ),
                        additionalActionRow,
                      ],
                    })
                  })
                }
              }
            } else replyNoPermissions(buttonInteraction)
            break
          case 'mod-button':
            if (
              permissions.has(MANAGE_ROLES_PERMISSION) &&
              member.roles.highest.comparePositionTo(voidRole) &&
              member.roles.highest.comparePositionTo(talkRole)
            ) {
              if (isOnStage) tracking.actionRowBuilders[0].components[4].setDisabled()
              message.edit({
                embeds: [getColoredEmbed(embed, isOnStage, tracking)],
                components: [
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder(modComponents[0].data),
                    new ButtonBuilder(modComponents[1].data),
                    new ButtonBuilder(modComponents[2].data),
                    new ButtonBuilder(modComponents[3].data),
                    new ButtonBuilder(modComponents[4].data).setDisabled()
                  ),
                  additionalActionRow,
                ],
              })
              buttonInteraction.deferUpdate()
            } else replyNoPermissions(buttonInteraction)
            break
          case 'history-button':
            const historyTalkArray: Talk[] = (await mariaDB.selectTalksByUserId(targetUserId)).reverse()
            const filteredTalks: Talk[] = historyTalkArray.filter(talk => talk.user_time_on_stage)
            const userTimeOnStage: number = filteredTalks.reduce((sum, talk) => {
              return sum + (talk.user_time_on_stage as number)
            }, 0)
            if (isOnStage && historyTalkArray.length) historyTalkArray.shift()
            const lastConversation: string = historyTalkArray.length
              ? new Date(historyTalkArray[0].message_datetime).toLocaleString()
              : '-'

            historyTalkArray.sort((a, b) => {
              if (a.summary !== null && b.summary === null) {
                return -1
              } else if (a.summary === null && b.summary !== null) {
                return 1
              }

              if (a.summary !== null && b.summary !== null) {
                return new Date(b.message_datetime).getTime() - new Date(a.message_datetime).getTime()
              }

              return new Date(b.message_datetime).getTime() - new Date(a.message_datetime).getTime()
            })

            const history: string[] = [
              `__**${targetUserName}'s History:**__`,
              `Number of conversations: ${filteredTalks.length}`,
              `Last conversation: ${lastConversation}`,
              `Total talk time: ${getFormattedTime(userTimeOnStage)}`,
            ]

            if (historyTalkArray.length) {
              history.push('', '**Last conversations (summary prioritized):**')
              historyTalkArray.slice(0, 3).forEach(talk => {
                history.push(
                  `> Date and time: ${new Date(talk.message_datetime).toLocaleString()}`,
                  `> Talk time: ${getFormattedTime(talk.user_time_on_stage)}`,
                  `> Summary:${
                    talk.summary !== null ? (talk.summary.includes('\n') ? '\n' : ' ') + '`' + talk.summary + '`' : ' -'
                  }`,
                  `> Tracking-Message: https://discord.com/channels/${SERVER_ID}/${STAGE_TRACKING_CHANNEL_ID}/${talk.message_id}`,
                  '',
                  ''
                )
              })
            }
            await buttonInteraction.reply({ content: history.join('\n'), ephemeral: true })
            break
          case 'legend-button':
            const legendParts: string[] = [
              '__**Legend:**__',
              ':green_circle: User is currently on the stage.',
              ':yellow_circle: User has been on stage for over an hour.',
              ':red_circle: Tracking message must be moderated.',
              ':blue_circle: No interaction necessary.',
            ]
            await buttonInteraction.reply({ content: legendParts.join('\n'), ephemeral: true })
            break
          case 'stats-button':
            const talkArray: Talk[] = await mariaDB.selectTalks()
            const { timeOnStage, talksWithTime, talkNumber, voidNumber, banNumber } = talkArray.reduce(
              (acc, talk) => {
                if (talk.user_time_on_stage) {
                  acc.timeOnStage += talk.user_time_on_stage
                  acc.talksWithTime++
                }
                if (talk.last_void_mod_id && talk.user_roles?.includes('void')) acc.voidNumber++
                if (talk.last_talk_mod_id && talk.user_roles?.includes('Talk')) acc.talkNumber++
                if (talk.last_ban_mod_id) acc.banNumber++
                return acc
              },
              { timeOnStage: 0, talksWithTime: 0, talkNumber: 0, voidNumber: 0, banNumber: 0 }
            )

            const stats: string[] = [
              '__**Overall Stats:**__',
              `Number of conversations: ${talkArray.length}`,
              `Average talk duration: ${getFormattedTime(Math.round(timeOnStage / talksWithTime))}`,
              `Total talk time: ${getFormattedTime(timeOnStage)}`,
              `Given talks: ${talkNumber}`,
              `Given voids: ${voidNumber}`,
              `Executed bans: ${banNumber}`,
              '',
              '*Statistics since 03/29/2023',
            ]
            await buttonInteraction.reply({ content: stats.join('\n'), ephemeral: true })
            break
        }
        fixMessageIfBugged(message)
      }
    } else if (interaction.isModalSubmit()) {
      const modalSubmitInteraction: ModalSubmitInteraction = interaction as ModalSubmitInteraction
      const message: Message = modalSubmitInteraction.message!
      const embed: Embed = message.embeds[0]
      const targetUserId: string = embed.fields[1].value
      const modComponents: MessageActionRowComponent[] = message.components[0].components
      const stageChannel: StageChannel = getStageChannel(guild.channels.cache, embed)
      const trackingIndex = findTrackingIndex(targetUserId, stageChannel)
      const tracking: Tracking = trackingArray[trackingIndex] ?? null
      const isOnStage: boolean = message.id === tracking?.message.id

      switch (modalSubmitInteraction.customId) {
        case 'summary-modal':
          manageSummary(
            user,
            modalSubmitInteraction.fields.getTextInputValue('summary-message'),
            guild,
            embed,
            message,
            targetUserId,
            modComponents
          )
          modalSubmitInteraction.deferUpdate()
          break
        case 'ban-modal':
          guild.members.ban(targetUserId).then(() => {
            appendLog(message, embed, user, targetUserId, 'Banned')
            if (isOnStage) {
              tracking.actionRowBuilders[0].components[3].setLabel('Unban')
              tracking.actionRowBuilders[0].components[4].setDisabled()
            }
            message.edit({
              embeds: [getColoredEmbed(embed, isOnStage, tracking, true)],
              components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder(modComponents[0].data),
                  new ButtonBuilder(modComponents[1].data),
                  new ButtonBuilder(modComponents[2].data),
                  new ButtonBuilder(modComponents[3].data).setLabel('Unban'),
                  new ButtonBuilder(modComponents[4].data).setDisabled()
                ),
                message.components[1],
              ],
            })
            mariaDB.updateTalkOnBan(message, targetUserId, member)
            modalSubmitInteraction.deferUpdate()
          })
          break
      }
    }
  })
}

async function replyNoPermissions(buttonInteraction: ButtonInteraction): Promise<void> {
  await buttonInteraction.reply({ content: 'You do not have enough permissions.', ephemeral: true })
}

async function replyNotOnServer(button: ButtonInteraction): Promise<void> {
  await button.reply({ content: 'User is currently not on the server.', ephemeral: true })
}

export async function appendLog(
  message: Message,
  embed: Embed,
  user: User,
  targetUserId: string,
  logBody: string
): Promise<void> {
  const fields: APIEmbedField[] = embed.fields
  const logIndex: number = fields.findIndex(field => field.name === 'Log')
  const oldLogField: string = fields[logIndex]?.value ?? null
  const log: string = `${logBody} by ${user.username} [${new Date().toLocaleString()}]`
  const stageChannel: StageChannel = getStageChannel(message.guild!.channels.cache, embed)
  const trackingIndex = findTrackingIndex(targetUserId, stageChannel)
  const tracking: Tracking = trackingArray[trackingIndex] ?? null
  const isUserOnStage: boolean = message.id === tracking?.message.id

  if (oldLogField) {
    const newLogField = {
      name: 'Log',
      value: `${oldLogField}\n${log}`,
      inline: false,
    }
    if (newLogField.value.length <= 1024) {
      fields[logIndex] = newLogField
      if (isUserOnStage) tracking.embedBuilder.spliceFields(logIndex, 1, newLogField)
    }
  } else {
    const newLogField = {
      name: 'Log',
      value: log,
      inline: false,
    }
    if (newLogField.value.length <= 1024) {
      fields.push(newLogField)
      if (isUserOnStage) tracking.embedBuilder.addFields(newLogField)
    }
  }
}

export function getStageChannel(channels: Collection<string, GuildBasedChannel>, embed: Embed): StageChannel {
  return channels
    .filter(
      channel => channel.type === ChannelType.GuildStageVoice && channel.name === embed.title!.split(' joined ')[1]
    )
    .first() as StageChannel
}

async function createModalBuilder(
  customId: string,
  required: boolean,
  placeholder: string,
  targetUserName: string,
  buttonInteraction: ButtonInteraction,
  summaryMessage: string
): Promise<void> {
  const [prefix, suffix] = customId.split('-')
  const capitalizedPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1)

  const textInputBuilder: TextInputBuilder = new TextInputBuilder()
    .setCustomId(customId)
    .setStyle(TextInputStyle.Paragraph)
    .setLabel(`${capitalizedPrefix} ${suffix}`)
    .setMinLength(4)
    .setMaxLength(512)
    .setRequired(required)
    .setPlaceholder(placeholder)

  if (required && summaryMessage.length >= textInputBuilder.data.min_length!) textInputBuilder.setValue(summaryMessage)

  const modalBuilder: ModalBuilder = new ModalBuilder()
    .setCustomId(`${prefix}-modal`)
    .setTitle(`${capitalizedPrefix} ${targetUserName}`)
    .setComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInputBuilder))

  await buttonInteraction.showModal(modalBuilder).catch(() => {})
}

export async function fixMessageIfBugged(message: Message): Promise<void> {
  const embed: Embed = message.embeds[0]
  const targetUserId: string = embed.fields[1].value
  const stageChannel: StageChannel = getStageChannel(message.guild!.channels.cache, embed)
  const trackingIndex = findTrackingIndex(targetUserId, stageChannel)
  const tracking: Tracking = trackingArray[trackingIndex] ?? null
  const isOnStage: boolean = message.id === tracking?.message.id
  const modComponents: MessageActionRowComponent[] = message.components[0].components
  if (!isOnStage && (embed.color === Colors.Green || embed.color === Colors.Yellow)) {
    const embedBuilder: EmbedBuilder = new EmbedBuilder(embed.data)
      .setColor(Colors.Red)
      .setDescription(`${embed.description} (Maybe incorrect)`)
    await message.edit({
      embeds: [embedBuilder],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder(modComponents[0].data),
          new ButtonBuilder(modComponents[1].data),
          new ButtonBuilder(modComponents[2].data),
          new ButtonBuilder(modComponents[3].data),
          new ButtonBuilder(modComponents[4].data).setDisabled(false)
        ),
        message.components[1],
      ],
    })
  }
}

export async function manageSummary(
  user: User,
  summary: string,
  guild: Guild,
  embed: Embed,
  message: Message,
  targetUserId: string,
  modComponents: MessageActionRowComponent[]
): Promise<void> {
  const fields: APIEmbedField[] = embed.fields
  const summaryIndex: number = fields.findIndex(field => field.name.startsWith('Summary by '))
  const stageChannel: StageChannel = getStageChannel(guild.channels.cache, embed)
  const trackingIndex = findTrackingIndex(targetUserId, stageChannel)
  const tracking: Tracking = trackingArray[trackingIndex] ?? null
  const isOnStage: boolean = message.id === tracking?.message.id
  const summaryField = {
    name: `Summary by ${user.username}`,
    value: summary,
    inline: false,
  }
  let logIndex: number = fields.findIndex(field => field.name === 'Log')

  if (-1 === summaryIndex) {
    // If log exists, but summary not
    if (logIndex === 2) {
      fields.push(fields[logIndex])
      fields[logIndex] = summaryField
      logIndex++
      if (isOnStage) {
        tracking.embedBuilder.addFields(fields[logIndex])
        tracking.embedBuilder.spliceFields(logIndex - 1, 1, summaryField)
      }
    } else {
      fields.push(summaryField)
      if (isOnStage) tracking.embedBuilder.addFields(summaryField)
    }

    appendLog(message, embed, user, targetUserId, 'Added Summary')
    if (isOnStage) tracking.actionRowBuilders[0].components[0].setLabel('Edit Summary')
    await message
      .edit({
        embeds: [embed.color === Colors.Blue ? new EmbedBuilder(embed.data).setColor(Colors.Red) : embed],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder(modComponents[0].data).setLabel('Edit Summary'),
            new ButtonBuilder(modComponents[1].data),
            new ButtonBuilder(modComponents[2].data),
            new ButtonBuilder(modComponents[3].data),
            new ButtonBuilder(modComponents[4].data).setDisabled(isOnStage)
          ),
          message.components[1],
        ],
      })
      .then(() => mariaDB.updateTalkOnSummary(message, targetUserId, user))
  } else {
    fields[summaryIndex] = summaryField
    if (isOnStage) tracking.embedBuilder.spliceFields(summaryIndex, 1, summaryField)
    appendLog(message, embed, user, targetUserId, 'Edited Summary')
    await message
      .edit({
        embeds: [embed.color === Colors.Blue ? new EmbedBuilder(embed.data).setColor(Colors.Red) : embed],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder(modComponents[0].data),
            new ButtonBuilder(modComponents[1].data),
            new ButtonBuilder(modComponents[2].data),
            new ButtonBuilder(modComponents[3].data),
            new ButtonBuilder(modComponents[4].data).setDisabled(isOnStage)
          ),
          message.components[1],
        ],
      })
      .then(() => mariaDB.updateTalkOnSummary(message, targetUserId, user))
  }
}

function getColoredEmbed(embed: Embed, isOnStage: boolean, tracking: Tracking, isBan: boolean = false): EmbedBuilder {
  if (embed.color === Colors.Red || isBan) {
    if (isOnStage) tracking.embedBuilder.setColor(Colors.Blue)
    return new EmbedBuilder(embed.data).setColor(Colors.Blue)
  } else {
    return new EmbedBuilder(embed.data)
  }
}

function getFormattedTime(secs: number | null): string {
  if (typeof secs === 'number') {
    const min = Math.floor((secs % 3600) / 60)
    const hours = Math.floor(secs / 3600)
    return `${hours.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${(secs % 60)
      .toString()
      .padStart(2, '0')}`
  } else return '-'
}
