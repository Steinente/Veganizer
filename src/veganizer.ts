import { ActivityType, Client, IntentsBitField, PermissionsBitField } from 'discord.js'
import dotenv from 'dotenv'
import ChatListener from './listeners/chat-listener'
import InteractionListener from './listeners/interaction-listener'
import VoiceListener from './listeners/voice-listener'

dotenv.config()

export const SERVER_ID: string = process.env.SERVER_ID!
export const NEW_ROLE_ID: string = process.env.NEW_ROLE_ID!
export const TALK_ROLE_ID: string = process.env.TALK_ROLE_ID!
export const VOID_ROLE_ID: string = process.env.VOID_ROLE_ID!
export const STAGE_TRACKING_CHANNEL_ID: string = process.env.STAGE_TRACKING_CHANNEL_ID!
export const MOVE_MEMBERS_PERMISSION = PermissionsBitField.Flags.MoveMembers
export const MANAGE_ROLES_PERMISSION = PermissionsBitField.Flags.ManageRoles
export const BAN_MEMBERS_PERMISSION = PermissionsBitField.Flags.BanMembers

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.MessageContent,
  ],
})

VoiceListener(client)
InteractionListener(client)
ChatListener(client)

client.login(process.env.TOKEN).then(() => client.user!.setActivity('auf die Stage.', { type: ActivityType.Watching }))
