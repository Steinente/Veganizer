package de.steinente.utils;

public class SQLManager {


    public static void onCreate() {

        //id   guildid   channelid   messageid   emote   rollenid

        LiteSQL.onUpdate("CREATE TABLE IF NOT EXISTS users(id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, wieoftaufderstage INTEGER, vegan BOOL, troll BOOL)");

    }

    public static void getData(String what, String targetid) {
        LiteSQL.onUpdate("SELECT " + what + " FROM users WHERE id = '" + targetid + "';");
    }

    public static void setData(Integer userid, Integer onstage, Boolean vegan, Boolean troll) {
        LiteSQL.onUpdate("INSERT INTO users(id, wieoftaufderstage, vegan, troll) VALUES('" + userid + "', " + onstage + ", " + vegan + ", " + troll + ");");
    }

}
