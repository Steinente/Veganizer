import { ActivityType, Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js'
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
export const STAGE_TRACKING_CHANNEL_ID: string = process.env.STAGE_TRACKING_CHANNEL_ID!
export const MOVE_MEMBERS_PERMISSION: bigint = PermissionFlagsBits.MoveMembers
export const MANAGE_ROLES_PERMISSION: bigint = PermissionFlagsBits.ManageRoles
export const BAN_MEMBERS_PERMISSION: bigint = PermissionFlagsBits.BanMembers
export const WHITE_MARK_EMOJI_ID: string = '1089867992189382667'

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
