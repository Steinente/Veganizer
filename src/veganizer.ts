import {
  ActivityType,
  Client,
  Collection,
  Colors,
  EmbedBuilder,
  GatewayIntentBits,
  Message,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js'
import dotenv from 'dotenv'
import ChatListener from './listeners/chat-listener'
import InteractionListener from './listeners/interaction-listener'
import VoiceListener from './listeners/voice-listener'
import { MariaDB } from './utils/mariadb'

dotenv.config({ override: true })

export const mariaDB = new MariaDB()
export const SERVER_ID: string = process.env.SERVER_ID!
export const NEW_ROLE_ID: string = process.env.NEW_ROLE_ID!
export const TALK_ROLE_ID: string = process.env.TALK_ROLE_ID!
export const VOID_ROLE_ID: string = process.env.VOID_ROLE_ID!
export const BOT_APPROVED_ROLE_ID: string = process.env.BOT_APPROVED_ROLE_ID!
export const STAGE_TRACKING_CHANNEL_ID: string = process.env.STAGE_TRACKING_CHANNEL_ID!
export const STAGE_MODERATION_CHANNEL_ID: string = process.env.STAGE_MODERATION_CHANNEL_ID!
export const MOVE_MEMBERS_PERMISSION: bigint = PermissionFlagsBits.MoveMembers
export const MANAGE_ROLES_PERMISSION: bigint = PermissionFlagsBits.ManageRoles
export const BAN_MEMBERS_PERMISSION: bigint = PermissionFlagsBits.BanMembers
export let moderationMessage: Message<true>

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
})

VoiceListener(client)
InteractionListener(client)
ChatListener(client)

client.login(process.env.TOKEN).then(() => {
  console.log('Bot started')
  client.user!.setActivity('auf die Stage.', { type: ActivityType.Watching })
  mariaDB.connect()
})

client.on('ready', async () => reloadModerationMessage())

export async function reloadModerationMessage(): Promise<void> {
  const trackingChannel: TextChannel = client.channels.cache.get(STAGE_TRACKING_CHANNEL_ID) as TextChannel
  const moderationChannel: TextChannel = client.channels.cache.get(STAGE_MODERATION_CHANNEL_ID) as TextChannel
  const trackingMessages: Collection<string, Message<true>> = await trackingChannel.messages.fetch({ limit: 30 })
  const moderationTrackingMessages: Collection<string, Message<true>> = trackingMessages.filter(
    m => m.author.bot && m.embeds[0].color === Colors.Red
  )
  await moderationChannel.bulkDelete(100)
  moderationMessage = await moderationChannel.send({
    content:
      moderationTrackingMessages.size === 0
        ? 'Derzeit keine Moderation notwendig.'
        : 'Zu moderierende Stage-Tracking-Nachrichten:',
    embeds: moderationTrackingMessages
      .reverse()
      .map(message => new EmbedBuilder().setDescription(`${message.embeds[0].fields[0].value}: ${message.url}`)),
  })
}
