package de.steinente;

import de.steinente.listeners.BanListener;
import de.steinente.listeners.ChatListener;
import de.steinente.listeners.InteractionListener;
import de.steinente.listeners.VoiceListener;
import de.steinente.utils.LiteSQL;
import net.dv8tion.jda.api.JDABuilder;
import net.dv8tion.jda.api.entities.Activity;
import net.dv8tion.jda.api.requests.GatewayIntent;
import net.dv8tion.jda.api.utils.MemberCachePolicy;

import java.awt.*;

public class Veganizer {
    public final static long SERVER_ID = Long.parseLong(System.getenv("server_id"));
    public final static long STAGE_TRACKING_CHANNEL_ID = Long.parseLong(System.getenv("stage_tracking_channel_id"));
    public final static long VOID_ROLE_ID = Long.parseLong(System.getenv("void_role_id"));
    public final static long TALK_ROLE_ID = Long.parseLong(System.getenv("talk_role_id"));
    public final static long NEW_ROLE_ID = Long.parseLong(System.getenv("new_role_id"));
    public final static String NO_PERMISSIONS = "You do not have enough permissions.";
    public final static String NOT_ON_SERVER = "User is currently not on the server.";
    public final static Color GREEN = new Color(100, 221, 23);
    public final static Color YELLOW = new Color(255, 214, 0);
    public final static Color RED = new Color(221, 44, 0);

    public static void main(String[] args) {
        LiteSQL.connect();
        final JDABuilder builder = JDABuilder.createDefault(System.getenv("token"));

        builder.setActivity(Activity.watching("auf die Stage."));
        builder.enableIntents(
                GatewayIntent.MESSAGE_CONTENT,
                GatewayIntent.GUILD_MEMBERS,
                GatewayIntent.GUILD_VOICE_STATES,
                GatewayIntent.GUILD_PRESENCES
        );
        builder.setMemberCachePolicy(MemberCachePolicy.ALL);
        builder.addEventListeners(
                new VoiceListener(),
                new InteractionListener(),
                new BanListener(),
                new ChatListener()
        );

        builder.build();
    }
}
