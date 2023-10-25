import { ActivityType, Client, PresenceStatusData } from 'discord.js';
import { fetchServerStats } from '../cluster/fetchServerStats';
import { Config } from '../types/Config';

async function clusterUpdate(
    bot: Client<true>,
    serverId: string,
): Promise<void> {
    const stats = await fetchServerStats(serverId);
    if (stats.online === 'ERROR') {
        bot.user.setPresence({
            activities: [
                {
                    type: ActivityType.Watching,
                    name:
                        stats.code !== undefined
                            ? `Error ${stats.code}`
                            : 'Unknown Error',
                },
            ],
            status: 'dnd',
        });
    } else if (stats.online) {
        let status: PresenceStatusData;
        switch (stats.playersOnline) {
            case 0:
                status = 'idle';
                break;
            case stats.playerCap:
                status = 'dnd';
                break;
            default:
                status = 'online';
                break;
        }

        bot.user.setPresence({
            activities: [
                {
                    type: ActivityType.Watching,
                    name: `${stats.playersOnline}/${stats.playerCap}`,
                },
            ],
            status,
        });
    } else {
        bot.user.setPresence({
            activities: [
                {
                    type: ActivityType.Watching,
                    name: 'Offline',
                },
            ],
            status: 'invisible',
        });
    }
}

export async function loadCluster(config: Config): Promise<void> {
    const clusters = await Promise.all(
        config.cluster.map(async (cluster, i) => {
            const client = new Client<true>({ intents: [] });
            await client.login(cluster.discordBotToken);
            console.log(`Cluster-${i}${client.user.displayName} logged in`);
            return client;
        }),
    );

    for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        clusterUpdate(cluster, config.cluster[i].serverId).catch(console.error);
        setInterval(
            () =>
                void clusterUpdate(cluster, config.cluster[i].serverId).catch(
                    () => null,
                ),
            1000 * 60,
        );
    }

    await fetchServerStats(config.cluster[0].serverId);
}