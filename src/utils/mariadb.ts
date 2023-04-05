import { APIEmbedField, Collection, GuildMember, Message, Role, User } from 'discord.js'
import mariadb from 'mariadb'
import moment from 'moment'
import Talk from 'src/interfaces/talk'
import Tracking from 'src/interfaces/tracking'

export class MariaDB {
  private dbConn: mariadb.Connection | null = null

  public async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      mariadb
        .createConnection({
          host: process.env.DB_HOST!,
          port: +process.env.DB_PORT!,
          user: process.env.DB_USERNAME!,
          password: process.env.DB_PASSWORD!,
          database: process.env.DB_DATABASE!,
        })
        .then(conn => {
          this.dbConn = conn
          resolve()
        })
        .catch(err => {
          console.error(`Error connecting to database: ${err.message}`)
          reject(err)
        })
    })
  }

  public async disconnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.dbConn) {
        resolve()
        return
      }
      this.dbConn
        .end()
        .then(() => {
          resolve()
        })
        .catch(err => {
          console.error(`Error disconnecting from database: ${err.message}`)
          reject(err)
        })
    })
  }

  public async query(sql: string, values?: any[]): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
      if (!this.dbConn) {
        reject(new Error('Not connected to database'))
        return
      }
      this.dbConn
        .execute(sql, values)
        .then(rows => {
          resolve(rows)
        })
        .catch(err => {
          console.error(`Error executing query: ${err.message}`)
          reject(err)
        })
    })
  }

  public async selectTalks(): Promise<Talk[]> {
    return this.query(`SELECT * FROM talks`)
  }

  public async selectTalkCountByUserId(targetUserId: string): Promise<any[]> {
    return this.query(`SELECT count(message_id) FROM talks WHERE user_id=? AND user_time_on_stage >= 60`, [
      targetUserId,
    ])
  }

  public async insertTalk(message: Message, member: GuildMember): Promise<any[]> {
    return this.query(
      `INSERT INTO talks
      (message_id, user_id, user_nickname, user_tag, user_roles, message_datetime, user_banned)
      VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [
        message.id,
        member.user.id,
        member.nickname,
        member.user.tag,
        this.getRolesAsString(member.roles.cache),
        moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
      ]
    )
  }

  public async updateTalkOnLeave(tracking: Tracking, timeOnStage: number): Promise<any[]> {
    return this.query(`UPDATE talks SET user_time_on_stage=? WHERE message_id=? AND user_id=?`, [
      timeOnStage,
      tracking.message.id,
      tracking.member.user.id,
    ])
  }

  public async updateTalkOnSummary(message: Message, targetUserId: string, interactionUser: User): Promise<any[]> {
    const fields: APIEmbedField[] = message.embeds[0].fields
    const summaryIndex: number = fields.findIndex(field => field.name.startsWith('Summary by '))
    return this.query(`UPDATE talks SET summary=?, last_summary_mod_id=? WHERE message_id=? AND user_id=?`, [
      fields[summaryIndex]?.value,
      interactionUser.id,
      message.id,
      targetUserId,
    ])
  }

  public async updateTalkOnRoleChange(
    message: Message,
    targetMember: GuildMember,
    interactionMember: GuildMember,
    buttonName: string
  ): Promise<any[]> {
    return this.query(`UPDATE talks SET user_roles=?, last_${buttonName}_mod_id=? WHERE message_id=? AND user_id=?`, [
      this.getRolesAsString(targetMember.roles.cache),
      interactionMember.user.id,
      message.id,
      targetMember.user.id,
    ])
  }

  public async updateTalkOnBan(message: Message, targetUserId: string, interactionMember: GuildMember): Promise<any[]> {
    const banList = await interactionMember.guild.bans.fetch()
    const isBanned = banList?.some(ban => ban.user.id === targetUserId) ?? false
    return this.query(`UPDATE talks SET user_banned=?, last_ban_mod_id=? WHERE message_id=? AND user_id=?`, [
      isBanned,
      interactionMember.user.id,
      message.id,
      targetUserId,
    ])
  }

  private getRolesAsString(roles: Collection<string, Role>): string {
    return roles.map(role => role.name).join(', ')
  }
}
