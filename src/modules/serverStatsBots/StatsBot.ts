import {
    ActivityType,
    Client,
    PresenceData,
    PresenceStatusData,
} from 'discord.js';
import { readFileSync } from 'fs';
import { NotFoundError } from '../../errors/NotFoundError.js';
import {
    awaitOrTimeout,
    TimeoutError,
} from '../../global/util/awaitOrTimeout.js';
import { ServerStatsService } from '../../services/index.js';
import { ModuleStartupResponse } from '../Module.js';

export class StatsBot {
    private static GAMES?: string[];

    private static readonly IDLE_GAME_CHANCE = 0.15;

    private static readonly BUFFER_SECONDS = 10;

    private static readonly OFFLINE_STATE: PresenceData = {
        activities: [{ type: ActivityType.Watching, name: 'offline' }],
        status: 'invisible',
    };

    private readonly client: Client<true>;

    private readonly token: string;

    private readonly serverId: string;

    private readonly index: number;

    private latestPlayerCount: number;

    private latestPlayerCap: number;

    private isShowingAsOffline: boolean;

    public constructor(token: string, serverId: string, index: number) {
        this.client = new Client({ intents: [] });
        this.token = token;
        this.serverId = serverId;
        this.index = index;
        this.latestPlayerCount = -1;
        this.latestPlayerCap = -1;
        this.isShowingAsOffline = false;
    }

    private static chooseRandomGame(): string {
        this.GAMES ??= readFileSync('games.txt', 'utf-8')
            .split('\n')
            .filter((e) => e.trim().length > 0);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.GAMES[Math.floor(Math.random() * this.GAMES.length)]!;
    }

    public async start(): Promise<ModuleStartupResponse> {
        const { loginTimeout } = AppGlobals.config.modules.serverStatsBots;

        try {
            await awaitOrTimeout(this.client.login(this.token), loginTimeout);
        } catch (error) {
            if (!(error instanceof TimeoutError)) {
                throw error;
            }

            console.error(
                error.makeMessage(
                    `login to Discord (cluster bot ${(this.index + 1).toString()})`,
                ),
            );

            process.exit(1);
        }

        await this.update();

        return {
            message: 'Initialised',
            variables: this.client.user.displayName,
            finishedAt: Date.now(),
        };
    }

    public async update(): Promise<void> {
        let newStats;

        try {
            newStats = await ServerStatsService.getStatsById(this.serverId);
        } catch (error) {
            if (!(error instanceof NotFoundError)) {
                throw error;
            }

            // Stats don't exist in database, so show as offline.
            if (!this.isShowingAsOffline) {
                this.client.user.setPresence(StatsBot.OFFLINE_STATE);
                this.isShowingAsOffline = true;
            }

            return;
        }

        const secondsSinceReport = Math.floor(
            (Date.now() - newStats.reportedAt) / 1_000,
        );

        const { updateInterval } = AppGlobals.config.modules.serverStatsBots;

        if (secondsSinceReport > updateInterval + StatsBot.BUFFER_SECONDS) {
            // Stats haven't been updated in a while, so show as offline.

            if (!this.isShowingAsOffline) {
                this.client.user.setPresence(StatsBot.OFFLINE_STATE);
                this.isShowingAsOffline = true;
            }

            return;
        }

        if (
            newStats.playerCount === this.latestPlayerCount &&
            newStats.playerCap === this.latestPlayerCap &&
            newStats.playerCount > 0
        ) {
            // No significant change in displayed stats, so skip update.
            return;
        }

        let status: PresenceStatusData;

        switch (newStats.playerCount) {
            case 0:
                status = 'idle'; // An empty server shows as idle.
                break;
            case newStats.playerCap:
                status = 'dnd'; // A full server shows as do not disturb.
                break;
            default:
                status = 'online'; // A partially full server shows as online.
                break;
        }

        if (status === 'idle' && Math.random() < StatsBot.IDLE_GAME_CHANCE) {
            this.client.user.setPresence({
                activities: [
                    {
                        type: ActivityType.Custom,
                        name: `Playing ${StatsBot.chooseRandomGame()}`,
                    },
                ],
                status,
            });
        } else {
            this.client.user.setPresence({
                activities: [
                    {
                        type: ActivityType.Watching,
                        name: `${newStats.playerCount.toString()}/${newStats.playerCap.toString()}`,
                    },
                ],
                status,
            });
        }

        this.latestPlayerCap = newStats.playerCap;
        this.latestPlayerCount = newStats.playerCount;
        this.isShowingAsOffline = false;
    }
}
