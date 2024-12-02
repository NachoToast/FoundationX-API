import { ChatInputCommandInteraction } from 'discord.js';
import { NotFoundError } from '../../../errors/NotFoundError.js';
import { UserService } from '../../../services/index.js';
import { Command } from './Command.js';
import { LinkCommand } from './Link.js';

export class BalanceCommand extends Command {
    public constructor() {
        super('balance', 'Check your balance');
    }

    public override async onInvoke(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        try {
            const user = await UserService.getUserByDiscordId(
                interaction.user.id,
            );

            await interaction.reply({
                content: `You have **${user.economy.balance.toLocaleString()}** FX Shots!`,
                ephemeral: true,
            });
        } catch (error) {
            if (error instanceof NotFoundError) {
                await new LinkCommand().onInvoke(interaction);
            } else {
                throw error;
            }
        }
    }
}
