import { APIEmbedField, Collection, GuildMember, Message, Role, User } from 'discord.js'
import mariadb from 'mariadb'
import moment from 'moment'
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

  public async query(sql: string): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
      if (!this.dbConn) {
        reject(new Error('Not connected to database'))
        return
      }
      this.dbConn
        .query(sql)
        .then(rows => {
          resolve(rows)
        })
        .catch(err => {
          console.error(`Error executing query: ${err.message}`)
          reject(err)
        })
    })
  }

  public async insertTalk(message: Message, member: GuildMember): Promise<any[]> {
    return this.query(`INSERT INTO talks
    (message_id, user_id, user_nickname, user_tag, user_roles, message_datetime, user_banned)
    VALUES(${message.id}, ${member.user.id}, '${member.nickname}', '${member.user.tag}', '${this.getRolesAsString(
      member.roles.cache
    )}', '${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}', 0)`)
  }

  public async updateTalkOnLeave(tracking: Tracking, timeOnStage: number): Promise<any[]> {
    const fields: APIEmbedField[] = tracking.embedBuilder.data.fields!
    const summary: string = fields[fields.findIndex(field => field.name === 'Log')]?.value ?? ''
    const banList = await tracking.member.guild.bans.fetch()
    const isBanned = banList?.some(ban => ban.user.id === tracking.member.user.id) ?? false
    return this.query(`UPDATE talks
    SET user_time_on_stage=${timeOnStage}
    WHERE message_id=${tracking.message.id} AND user_id=${tracking.member.user.id}`)
  }

  public async updateTalkOnSummary(message: Message, targetUserId: string, interactionUser: User): Promise<any[]> {
    const fields: APIEmbedField[] = message.embeds[0].fields
    const summaryIndex: number = fields.findIndex(field => field.name.startsWith('Summary by '))
    return this.query(`UPDATE talks
    SET summary='${fields[summaryIndex]?.value}', last_summary_mod_id=${interactionUser.id}
    WHERE message_id=${message.id} AND user_id=${targetUserId}`)
  }

  public async updateTalkOnRoleChange(
    message: Message,
    targetMember: GuildMember,
    interactionMember: GuildMember,
    buttonName: string
  ): Promise<any[]> {
    return this.query(`UPDATE talks
    SET user_roles='${this.getRolesAsString(targetMember.roles.cache)}', last_${buttonName}_mod_id=${
      interactionMember.user.id
    }
    WHERE message_id=${message.id} AND user_id=${targetMember.user.id}`)
  }

  public async updateTalkOnBan(message: Message, targetUserId: string, interactionMember: GuildMember): Promise<any[]> {
    const banList = await interactionMember.guild.bans.fetch()
    const isBanned = banList?.some(ban => ban.user.id === targetUserId) ?? false
    return this.query(`UPDATE talks
    SET user_banned=${isBanned}, last_ban_mod_id=${interactionMember.user.id}
    WHERE message_id=${message.id} AND user_id=${targetUserId}`)
  }

  public async selectTalkCountByUser(targetUserId: string): Promise<any[]> {
    return this.query(`SELECT count(message_id)
    FROM talks
    WHERE user_id=${targetUserId} AND user_time_on_stage >= 60`)
  }

  private getRolesAsString(roles: Collection<string, Role>): string {
    return roles.map(role => role.name).join(', ')
  }
}
