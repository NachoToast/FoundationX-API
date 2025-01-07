import { ButtonStyle, HexColorString, Snowflake } from 'discord.js';
import { DiscordIdString } from '../../public/DiscordIdString.js';

/**
 * Global app config, this must be kept up-to-date with the schema file (see
 * `.github/config-schema.json`).
 */
export interface Config {
    production: boolean;
    services: {
        mongoDb: {
            uri: string;
            dbName: string;
            connectTimeout: number;
        };
        discordAuth: {
            clientId: string;
            clientSecret: string;
            redirectUri: string;
        };
    };
    modules: {
        mainBot: {
            enabled: boolean;
            embedColour: HexColorString;
            token: string;
            loginTimeout: number;
            deployTimeout: number;
            developerId?: DiscordIdString;
            histogramEmoji: string;
            reactRoles: {
                id: string;
                title: string;
                description: string;
                guildId: Snowflake;
                channelId: Snowflake;
                roles: {
                    roleId: Snowflake;
                    label: string;
                    style: Exclude<ButtonStyle, ButtonStyle.Link>;
                    emoji: string;
                    addMessage?: string;
                    removeMessage?: string;
                }[];
            }[];
        };
        serverStatsBots: {
            enabled: boolean;
            updateInterval: number;
            loginTimeout: number;
            bots: { token: string; serverId: string }[];
        };
        webApi: {
            enabled: boolean;
            port: number;
            clientUrls: string[];
            rateLimit: number;
            proxyCount: number;
            jwtSecret: string;
            serverStatsBots: { siteToken: string; serverId: string }[];
            economyBotTokens: string[];
        };
    };
}
