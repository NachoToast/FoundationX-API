import { SecondaryRequestError } from '../../errors/SecondaryRequestError.js';
import { ServerStats } from '../../public/ServerStats.js';

/**
 * Fetches server stats via SCP: SL server ID.
 *
 * @throws Throws a {@link NotFoundError} if the server does not exist in the
 * database.
 */
export async function getStatsById(serverId: string): Promise<ServerStats> {
    const response = await fetch(`https://api.scplist.kr/api/servers/${serverId}`);

    if (!response.ok) {
        throw new SecondaryRequestError(
            'Server Stats API Request Failure',
            `The server stats API returned an HTTP ${response.status.toString()} (${response.statusText}) response`,
            response,
        );
    }

    let parsed: unknown;

    try {
        parsed = await response.json();
    } catch (error) {
        throw new SecondaryRequestError(
            'Server Stats API Parse Failure',
            'The server stats API response could not be parsed, the provided server ID may be invalid',
            error
        );
    }

    if (typeof parsed !== 'object' || parsed === null || !('players' in parsed) || typeof parsed.players !== 'string') {
        throw new SecondaryRequestError(
            'Server Stats API Parse Failure',
            'Failed to find player count string in server stats API response',
            parsed,
        );
    }

    let playerCount = 0;
    let playerCap = 0;

    const [newCount, newCap] = parsed.players.trim().split('/').map(x => {
        const asNumber = Number(x);

        if (Number.isInteger(asNumber) && asNumber >= 0) {
            return asNumber;
        }

        return undefined;
    });

    if (newCount !== undefined) {
        playerCount = newCount;
    }

    if (newCap !== undefined) {
        playerCap = newCap;
    }

    return { _id: serverId, playerCap, playerCount, reportedAt: Date.now() }
}
