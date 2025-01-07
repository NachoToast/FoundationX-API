import { Db } from 'mongodb';
import { Config } from '../global/types/Config.js';

const mockedConfig: Config = {
    production: false,
    services: {
        mongoDb: {
            uri: '',
            dbName: '',
            connectTimeout: 0,
        },
        discordAuth: {
            clientId: '',
            clientSecret: '',
            redirectUri: '',
        },
    },
    modules: {
        mainBot: {
            enabled: false,
            embedColour: '#',
            token: '',
            loginTimeout: 0,
            deployTimeout: 0,
            histogramEmoji: '',
            reactRoles: [],
        },
        serverStatsBots: {
            enabled: false,
            updateInterval: 0,
            loginTimeout: 0,
            bots: [],
        },
        webApi: {
            enabled: false,
            port: 0,
            clientUrls: [],
            rateLimit: 0,
            proxyCount: 0,
            jwtSecret: '',
            serverStatsBots: [],
            economyBotTokens: [],
        },
    },
};

export function mockGlobals(): void {
    globalThis.AppGlobals = {
        config: mockedConfig,
        db: {} as Db,
        startTime: new Date(),
    };
}
