import { ButtonStyle } from 'discord.js';
import { Validator } from './classes/Validator.js';
import { Colour } from './types/Colour.js';
import { Config } from './types/Config.js';

/** Validates config against the expected shape. */
export function validateConfig(config: Config): void {
    const fileName = Colour.FgRed + 'config.json' + Colour.Reset + ' file';

    const validate = Validator.for(config, fileName);

    validate('production', ['boolean']);

    validate('services', ['object'])
        .child('mongoDb', ['object'], (mongoDb) => {
            mongoDb
                .child('uri', ['string'])
                .child('dbName', ['string'], (dbName) => dbName.min(1).max(38))
                .child('connectTimeout', ['number'], (connectTimeout) => {
                    connectTimeout.integer().finite().min(0);
                });
        })
        .child('discordAuth', ['object'], (discordAuth) => {
            discordAuth
                .child('clientId', ['string'])
                .child('clientSecret', ['string'])
                .child('redirectUri', ['string'], (redirectUri) => {
                    redirectUri.custom((x) => {
                        new URL(x); // Throws if invalid.
                    });
                });
        });

    validate('modules', ['object'])
        .child('mainBot', ['object', 'undefined'], (mainBot) => {
            mainBot
                .child('enabled', ['boolean'])
                .if((mainBot) => mainBot.enabled)
                ?.child('embedColour', ['string'], (embedColour) => {
                    embedColour.custom((x) => {
                        if (!/^#[0-9a-fA-F]{6}$/.test(x)) {
                            throw new Error('should be a valid hex colour');
                        }
                    });
                })
                .child('token', ['string'])
                .child('loginTimeout', ['number'], (loginTimeout) => {
                    loginTimeout.integer().finite().min(0);
                })
                .child('deployTimeout', ['number'], (deployTimeout) => {
                    deployTimeout.integer().finite().min(0);
                })
                .child('developerId', ['string', 'undefined'])
                .child('histogramEmoji', ['string'])
                .child('reactRoles', ['array'], (reactRoles) => {
                    reactRoles.forEach(['object'], (reactRole) => {
                        reactRole
                            .child('id', ['string'])
                            .child('title', ['string'])
                            .child('description', ['string'])
                            .child('guildId', ['string'])
                            .child('channelId', ['string'])
                            .child('roles', ['array'], (roles) => {
                                roles.forEach(['object'], (role) => {
                                    role.child('roleId', ['string'])
                                        .child('label', ['string'])
                                        .child('style', ['number'], (style) => {
                                            style
                                                .integer()
                                                .min(ButtonStyle.Primary)
                                                .max(ButtonStyle.Danger);
                                        })
                                        .child('emoji', ['string'], (emoji) => {
                                            emoji.min(1);
                                        })
                                        .child('addMessage', [
                                            'string',
                                            'undefined',
                                        ])
                                        .child('removeMessage', [
                                            'string',
                                            'undefined',
                                        ]);
                                });
                            });
                    });
                });
        })
        .child(
            'serverStatsBots',
            ['object', 'undefined'],
            (serverStatsBots) => {
                serverStatsBots
                    .child('enabled', ['boolean'])
                    .if((serverStatsBots) => serverStatsBots.enabled)
                    ?.child('updateInterval', ['number'], (updateInterval) => {
                        updateInterval.integer().finite().min(1);
                    })
                    .child('loginTimeout', ['number'], (loginTimeout) => {
                        loginTimeout.integer().finite().min(0);
                    })
                    .child('bots', ['array'], (bots) => {
                        bots.forEach(['object'], (bot) => {
                            bot.child('token', ['string']).child('serverId', [
                                'string',
                            ]);
                        });
                    });
            },
        )
        .child('webApi', ['object', 'undefined'], (webApi) => {
            webApi
                .child('enabled', ['boolean'])
                .if((webApi) => webApi.enabled)
                ?.child('port', ['number'], (port) => {
                    port.integer().finite().min(0).max(65535);
                })
                .child('clientUrls', ['array'], (clientUrls) => {
                    clientUrls
                        .min(1)
                        .custom((x) => {
                            if (x.includes('*') && x.length > 1) {
                                throw new Error(
                                    'cannot have other origins when using the wildcard',
                                );
                            }
                        })
                        .forEach(['string'], (clientUrl) => {
                            clientUrl.custom((x) => {
                                if (x === '*') return;

                                new URL(x); // Throws if invalid.
                            });
                        });
                })
                .child('rateLimit', ['number'], (rateLimit) => {
                    rateLimit.integer().finite().min(0);
                })
                .child('proxyCount', ['number'], (proxyCount) => {
                    proxyCount.integer().finite().min(0);
                })
                .child('jwtSecret', ['string'], (jwtSecret) => jwtSecret.min(8))
                .child('serverStatsBots', ['array'], (serverStatsBots) => {
                    serverStatsBots.forEach(['object'], (bots) => {
                        bots.child('siteToken', ['string'], (siteToken) => {
                            siteToken.min(8);
                        }).child('serverId', ['string']);
                    });
                })
                .child('economyBotTokens', ['array'], (economyBotTokens) => {
                    economyBotTokens.forEach(['string'], (economyBotToken) => {
                        economyBotToken.min(8);
                    });
                });
        });
}
