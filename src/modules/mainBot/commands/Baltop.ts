import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js';
import { UserService } from '../../../services/index.js';
import { UserDocument } from '../../../services/user/db.js';
import { getBestName } from '../util/getBestName.js';
import { makeHistogramLine } from '../util/histogram.js';
import { medalGenerator } from '../util/medalGenerator.js';
import { Command } from './Command.js';

export class BaltopCommand extends Command {
    public constructor() {
        super('baltop', 'Check the richest 10 users');
    }

    public override async onInvoke(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const { embedColour } = AppGlobals.config.modules.mainBot;

        await interaction.deferReply();

        const isCurrent = !interaction.options.getBoolean('lifetime');

        const getValue = isCurrent
            ? (user: UserDocument): number => user.economy.balance
            : (user: UserDocument): number => user.economy.lifetimeBalance;

        const [leaderboard, thisUser] = await Promise.all([
            UserService.getTopEarners(!isCurrent),
            UserService.getRank(
                interaction.user.id,
                isCurrent ? 'economy.balance' : 'economy.lifetimeBalance',
            ),
        ]);

        if (leaderboard.length === 0) {
            await interaction.editReply({
                content: 'No users in the database',
            });
            return;
        }

        const output = new Array<string>(leaderboard.length);

        const maxValue = Math.max(...leaderboard.map((e) => getValue(e)));

        const medals = medalGenerator();

        for (let i = 0; i < leaderboard.length; i++) {
            const user = leaderboard[i];

            if (user === undefined) {
                output[i] = '???';
                continue;
            }

            const balance = getValue(user);

            output[i] =
                `${makeHistogramLine(balance, maxValue, 10, '')} ${medals.next().value} ${getBestName(user)} - ${balance.toLocaleString()}`;
        }

        if (
            thisUser?.rankingForStat !== undefined &&
            thisUser.rankingForStat > 10
        ) {
            if (thisUser.rankingForStat > 11) {
                output.push('...');
            }

            const balance = getValue(thisUser);

            output.push(
                `${makeHistogramLine(balance, maxValue, 10, '')} **#${thisUser.rankingForStat.toString()}** ${getBestName(thisUser)} - ${balance.toLocaleString()}`,
            );
        }

        const embed = new EmbedBuilder()
            .setColor(embedColour)
            .setTitle(`Richest Users${isCurrent ? '' : ` (Lifetime)`}`)
            .setDescription(output.join('\n'));

        await interaction.editReply({ embeds: [embed] });
    }

    public override build(): SlashCommandBuilder {
        const base = super.build();

        base.addBooleanOption((option) => {
            return option
                .setName('lifetime')
                .setDescription('Show lifetime balance instead of current')
        });

        return base;
    }
}
