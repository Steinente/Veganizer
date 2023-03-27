import {
  ActionRowBuilder,
  APIEmbedField,
  ButtonBuilder,
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
import Data from 'src/interfaces/data'
import {
  BAN_MEMBERS_PERMISSION,
  MANAGE_ROLES_PERMISSION,
  MOVE_MEMBERS_PERMISSION,
  NEW_ROLE_ID,
  SERVER_ID,
  TALK_ROLE_ID,
  VOID_ROLE_ID,
  WHITE_MARK_EMOJI_ID,
} from '../veganizer'
import { dataArray, findDataIndex } from './voice-listener'

export default (client: Client): void => {
  client.on(Events.InteractionCreate, async interaction => {
    const guild = interaction.guild
    if (guild?.id !== SERVER_ID) return
    const member: GuildMember = interaction.member as GuildMember
    const user: User = member.user
    if (interaction.isButton()) {
      const buttonInteraction: ButtonInteraction = interaction as ButtonInteraction
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
      const targetUserName = targetUser?.username ?? ''
      const targetMember = await guild.members.fetch(targetUserId).catch(() => {})
      const components: MessageActionRowComponent[] = message.components[0].components
      const label = buttonInteraction.component.label
      const stageChannel: StageChannel = getStageChannel(guild.channels.cache, embed)
      const dataIndex = findDataIndex(targetUserId, stageChannel)
      const data: Data = dataArray[dataIndex] ?? null
      const isOnStage: boolean = message.id === data?.message?.id

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
                    if (isOnStage) data.buttonBuilders[1].setLabel('Remove Talk')
                    message.edit({
                      components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                          new ButtonBuilder(components[0].data),
                          new ButtonBuilder(components[1].data).setLabel('Remove Talk'),
                          new ButtonBuilder(components[2].data),
                          new ButtonBuilder(components[3].data),
                          new ButtonBuilder(components[4].data)
                        ),
                      ],
                    })
                  })
                } else {
                  await targetMember.roles.add(talkRole).then(() => {
                    appendLog(message, embed, user, targetUserId, 'Added Talk')
                    if (isOnStage) data.buttonBuilders[1].setLabel('Remove Talk')
                    message.edit({
                      embeds: [getColoredEmbed(embed, isOnStage, data)],
                      components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                          new ButtonBuilder(components[0].data),
                          new ButtonBuilder(components[1].data).setLabel('Remove Talk'),
                          new ButtonBuilder(components[2].data),
                          new ButtonBuilder(components[3].data),
                          new ButtonBuilder(components[4].data)
                        ),
                      ],
                    })
                    buttonInteraction.deferUpdate()
                  })
                }
              } else if (label === 'Remove Talk') {
                if (hasTalk) {
                  await targetMember.roles.remove(talkRole).then(() => {
                    appendLog(message, embed, user, targetUserId, 'Removed Talk')
                    if (isOnStage) data.buttonBuilders[1].setLabel('Add Talk')
                    message.edit({
                      embeds: [getColoredEmbed(embed, isOnStage, data)],
                      components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                          new ButtonBuilder(components[0].data),
                          new ButtonBuilder(components[1].data).setLabel('Add Talk'),
                          new ButtonBuilder(components[2].data),
                          new ButtonBuilder(components[3].data),
                          new ButtonBuilder(components[4].data)
                        ),
                      ],
                    })
                  })
                  buttonInteraction.deferUpdate()
                } else {
                  await buttonInteraction.reply({ content: "User doesn't have Talk.", ephemeral: true }).then(() => {
                    if (isOnStage) data.buttonBuilders[1].setLabel('Add Talk')
                    message.edit({
                      components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                          new ButtonBuilder(components[0].data),
                          new ButtonBuilder(components[1].data).setLabel('Add Talk'),
                          new ButtonBuilder(components[2].data),
                          new ButtonBuilder(components[3].data),
                          new ButtonBuilder(components[4].data)
                        ),
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
                    if (isOnStage) data.buttonBuilders[2].setLabel('Remove Void')
                    message.edit({
                      components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                          new ButtonBuilder(components[0].data),
                          new ButtonBuilder(components[1].data),
                          new ButtonBuilder(components[2].data).setLabel('Remove Void'),
                          new ButtonBuilder(components[3].data),
                          new ButtonBuilder(components[4].data)
                        ),
                      ],
                    })
                  })
                } else {
                  await targetMember.roles.add(voidRole).then(() => {
                    appendLog(message, embed, user, targetUserId, 'Added Void')
                    if (isOnStage) {
                      data.buttonBuilders[1].setLabel('Add Talk')
                      data.buttonBuilders[2].setLabel('Remove Void')
                    }
                    message.edit({
                      embeds: [getColoredEmbed(embed, isOnStage, data)],
                      components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                          new ButtonBuilder(components[0].data),
                          new ButtonBuilder(components[1].data).setLabel('Add Talk'),
                          new ButtonBuilder(components[2].data).setLabel('Remove Void'),
                          new ButtonBuilder(components[3].data),
                          new ButtonBuilder(components[4].data)
                        ),
                      ],
                    })
                    targetMember.roles.remove(newRole)
                    targetMember.roles.remove(talkRole)
                  })
                  buttonInteraction.deferUpdate()
                }
              } else if (label === 'Remove Void') {
                if (hasVoid) {
                  await targetMember.roles.remove(voidRole).then(() => {
                    appendLog(message, embed, user, targetUserId, 'Removed Void')
                    if (isOnStage) data.buttonBuilders[2].setLabel('Add Void')
                    message.edit({
                      embeds: [getColoredEmbed(embed, isOnStage, data)],
                      components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                          new ButtonBuilder(components[0].data),
                          new ButtonBuilder(components[1].data),
                          new ButtonBuilder(components[2].data).setLabel('Add Void'),
                          new ButtonBuilder(components[3].data),
                          new ButtonBuilder(components[4].data)
                        ),
                      ],
                    })
                  })
                  buttonInteraction.deferUpdate()
                } else {
                  await buttonInteraction.reply({ content: "User doesn't have Void.", ephemeral: true }).then(() => {
                    if (isOnStage) data.buttonBuilders[2].setLabel('Add Void')
                    message.edit({
                      components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                          new ButtonBuilder(components[0].data),
                          new ButtonBuilder(components[1].data),
                          new ButtonBuilder(components[2].data).setLabel('Add Void'),
                          new ButtonBuilder(components[3].data),
                          new ButtonBuilder(components[4].data)
                        ),
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
                  if (isOnStage) data.buttonBuilders[3].setLabel('Unban')
                  message.edit({
                    components: [
                      new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder(components[0].data),
                        new ButtonBuilder(components[1].data),
                        new ButtonBuilder(components[2].data),
                        new ButtonBuilder(components[3].data).setLabel('Unban'),
                        new ButtonBuilder(components[4].data)
                      ),
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
                  if (isOnStage) data.buttonBuilders[3].setLabel('Ban')
                  message.edit({
                    embeds: [embed],
                    components: [
                      new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder(components[0].data),
                        new ButtonBuilder(components[1].data),
                        new ButtonBuilder(components[2].data),
                        new ButtonBuilder(components[3].data).setLabel('Ban'),
                        new ButtonBuilder(components[4].data)
                      ),
                    ],
                  })
                  buttonInteraction.deferUpdate()
                })
              } else {
                await buttonInteraction.reply({ content: 'User is already unbanned.', ephemeral: true }).then(() => {
                  if (isOnStage) data.buttonBuilders[3].setLabel('Ban')
                  message.edit({
                    components: [
                      new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder(components[0].data),
                        new ButtonBuilder(components[1].data),
                        new ButtonBuilder(components[2].data),
                        new ButtonBuilder(components[3].data).setLabel('Ban'),
                        new ButtonBuilder(components[4].data)
                      ),
                    ],
                  })
                })
              }
            }
          } else replyNoPermissions(buttonInteraction)
          break
        default:
          if (buttonInteraction.component.emoji?.id === WHITE_MARK_EMOJI_ID) {
            if (isOnStage) data.buttonBuilders[4].setDisabled()
            message.edit({
              embeds: [getColoredEmbed(embed, isOnStage, data)],
              components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder(components[0].data),
                  new ButtonBuilder(components[1].data),
                  new ButtonBuilder(components[2].data),
                  new ButtonBuilder(components[3].data),
                  new ButtonBuilder(components[4].data).setDisabled()
                ),
              ],
            })
            buttonInteraction.deferUpdate()
          }
          break
      }
      fixMessageIfBugged(message)
    } else if (interaction.isModalSubmit()) {
      const modalSubmitInteraction: ModalSubmitInteraction = interaction as ModalSubmitInteraction
      const message: Message = modalSubmitInteraction.message!
      const embed: Embed = message.embeds[0]
      const targetUserId: string = embed.fields[1].value
      const components: MessageActionRowComponent[] = message.components[0].components
      const stageChannel: StageChannel = getStageChannel(guild.channels.cache, embed)
      const dataIndex = findDataIndex(targetUserId, stageChannel)
      const data: Data = dataArray[dataIndex] ?? null
      const isOnStage: boolean = message.id === data?.message?.id

      switch (modalSubmitInteraction.customId) {
        case 'summary-modal':
          manageSummary(
            user,
            modalSubmitInteraction.fields.getTextInputValue('summary-message'),
            guild,
            embed,
            message,
            targetUserId,
            components
          )
          modalSubmitInteraction.deferUpdate()
          break
        case 'ban-modal':
          guild.members.ban(targetUserId).then(() => {
            appendLog(message, embed, user, targetUserId, 'Banned')
            if (isOnStage) {
              data.buttonBuilders[3].setLabel('Unban')
              data.buttonBuilders[4].setDisabled()
            }
            message.edit({
              embeds: [getColoredEmbed(embed, isOnStage, data, true)],
              components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder(components[0].data),
                  new ButtonBuilder(components[1].data),
                  new ButtonBuilder(components[2].data),
                  new ButtonBuilder(components[3].data).setLabel('Unban'),
                  new ButtonBuilder(components[4].data).setDisabled()
                ),
              ],
            })
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
  const dataIndex = findDataIndex(targetUserId, stageChannel)
  const data: Data = dataArray[dataIndex] ?? null
  const isUserOnStage: boolean = message.id === data?.message?.id

  if (oldLogField) {
    const newLogField = {
      name: 'Log',
      value: `${oldLogField}\n${log}`,
      inline: false,
    }
    if (newLogField.value.length <= 1024) {
      fields[logIndex] = newLogField
      if (isUserOnStage) data.embedBuilder?.spliceFields(logIndex, 1, newLogField)
    }
  } else {
    const newLogField = {
      name: 'Log',
      value: log,
      inline: false,
    }
    if (newLogField.value.length <= 1024) {
      fields.push(newLogField)
      if (isUserOnStage) data.embedBuilder?.addFields(newLogField)
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
) {
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

  await buttonInteraction.showModal(modalBuilder)
}

export async function fixMessageIfBugged(message: Message) {
  const embed: Embed = message.embeds[0]
  const targetUserId: string = embed.fields[1].value
  const stageChannel: StageChannel = getStageChannel(message.guild!.channels.cache, embed)
  const dataIndex = findDataIndex(targetUserId, stageChannel)
  const data: Data = dataArray[dataIndex] ?? null
  const isOnStage: boolean = message.id === data?.message?.id
  if (!isOnStage && (embed.color === Colors.Green || embed.color === Colors.Yellow)) {
    const embedBuilder: EmbedBuilder = new EmbedBuilder(embed.data)
      .setColor(Colors.Red)
      .setDescription(`${embed.description} (Maybe incorrect)`)
    await message.edit({
      embeds: [embedBuilder],
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
  components: MessageActionRowComponent[]
) {
  const fields: APIEmbedField[] = embed.fields
  const summaryIndex: number = fields.findIndex(field => field.name.startsWith('Summary by '))
  const stageChannel: StageChannel = getStageChannel(guild.channels.cache, embed)
  const dataIndex = findDataIndex(targetUserId, stageChannel)
  const data: Data = dataArray[dataIndex] ?? null
  const isOnStage: boolean = message.id === data?.message?.id
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
        data.embedBuilder?.addFields(fields[logIndex])
        data.embedBuilder?.spliceFields(logIndex - 1, 1, summaryField)
      }
    } else {
      fields.push(summaryField)
      if (isOnStage) data.embedBuilder?.addFields(summaryField)
    }

    appendLog(message, embed, user, targetUserId, 'Added Summary')
    if (isOnStage) data.buttonBuilders[0].setLabel('Edit Summary')
    await message.edit({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder(components[0].data).setLabel('Edit Summary'),
          new ButtonBuilder(components[1].data),
          new ButtonBuilder(components[2].data),
          new ButtonBuilder(components[3].data),
          new ButtonBuilder(components[4].data)
        ),
      ],
    })
  } else {
    fields[summaryIndex] = summaryField
    if (isOnStage) data.embedBuilder?.spliceFields(summaryIndex, 1, summaryField)
    appendLog(message, embed, user, targetUserId, 'Edited Summary')
    await message.edit({
      embeds: [embed],
    })
  }
}

function getColoredEmbed(embed: Embed, isOnStage: boolean, data: Data, isBan: boolean = false): EmbedBuilder {
  if (embed.color === Colors.Red || isBan) {
    if (isOnStage) data.embedBuilder?.setColor(Colors.Blue)
    return new EmbedBuilder(embed.data).setColor(Colors.Blue)
  } else {
    return new EmbedBuilder(embed.data)
  }
}
