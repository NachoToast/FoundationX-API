import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    Snowflake,
} from 'discord.js';
import { NotFoundError } from '../../../errors/NotFoundError.js';
import { UserService } from '../../../services/index.js';
import { Command } from './Command.js';

export class EconomyAdmin extends Command {
    private readonly allowedIds: Set<Snowflake>;

    public constructor() {
        super('economyadmin', 'Admin-related economy commands');

        this.allowedIds = new Set([
            '240312568273436674',
            '396060103242940426',
            '739787323033518164',
            '700548055220617297',
            '980374069109227570',
        ]);
    }

    public override async onInvoke(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        if (!this.allowedIds.has(interaction.user.id)) {
            await interaction.reply({
                content: 'You are not allowed to use this command',
                ephemeral: true,
            });

            return;
        }

        const subCommand = interaction.options.getSubcommand();

        if (subCommand === 'stat') {
            const user = interaction.options.getUser('user', true);

            try {
                const stats = await UserService.getUserByDiscordId(user.id);

                await interaction.reply({
                    content: [
                        '```json',
                        JSON.stringify(stats.economy, null, 4),
                        '```',
                    ].join('\n'),
                    allowedMentions: { parse: [] },
                });
            } catch (error) {
                if (error instanceof NotFoundError) {
                    await interaction.reply({
                        content: 'No data found for this user.',
                    });
                } else {
                    throw error;
                }
            }
        } else if (subCommand === 'setbalance') {
            const user = interaction.options.getUser('user', true);
            const balance = interaction.options.getInteger('balance', true);

            if (balance < 0) {
                throw new Error('New balance cannot be negative');
            }

            const success = await UserService.setBalanceDirect(
                user.id,
                balance,
            );

            if (success) {
                await interaction.reply({
                    content: `Set balance of ${user.username} to ${balance.toLocaleString()}`,
                    allowedMentions: { parse: [] },
                });
            } else {
                await interaction.reply({
                    content: `User does not exist.`,
                });
            }
        }
    }

    public override build(): SlashCommandBuilder {
        const base = super.build();

        base.addSubcommand((sub) => {
            return sub
                .setName('stat')
                .setDescription('Get the economy stats of a user')
                .addUserOption((option) => {
                    return option
                        .setName('user')
                        .setDescription('The user to get the balance of')
                        .setRequired(true);
                });
        });

        base.addSubcommand((sub) => {
            return sub
                .setName('setbalance')
                .setDescription('Set the balance of a user (non-lifetime)')
                .addUserOption((option) => {
                    return option
                        .setName('user')
                        .setDescription('The user to set the balance of')
                        .setRequired(true);
                })
                .addIntegerOption((option) => {
                    return option
                        .setName('balance')
                        .setDescription('The balance to set')
                        .setRequired(true);
                });
        });

        return base;
    }
}
