import {
    ActionRowBuilder,
    BaseMessageOptions,
    ButtonBuilder,
    ButtonInteraction,
    ChannelType,
    Client,
    ComponentType,
    EmbedBuilder,
    Guild,
    Message,
    Snowflake,
    TextChannel,
    userMention,
} from 'discord.js';
import { Collection } from 'mongodb';
import { Config } from '../../global/types/Config.js';

interface MessageDocument {
    /** User ID of the bot combined with `dev` or `prod` based on config. */
    _id: string;

    /** ID of the message. */
    messageId: Snowflake;
}

type ReactRole = Config['modules']['mainBot']['reactRoles']['roles'][number];

export class ReactRoles {
    private readonly client: Client<true>;

    private readonly messageDb: Collection<MessageDocument>;

    private readonly id: string;

    private readonly roleIdMap: Map<Snowflake, ReactRole>;

    private guild: Guild | null;

    private channel: TextChannel | null;

    private message: Message<true> | null;

    public constructor(client: Client<true>) {
        this.client = client;
        this.messageDb = AppGlobals.db.collection('react-role-messages');
        this.id = `${client.user.id}-${AppGlobals.config.production ? 'prod' : 'dev'}`;

        this.guild = null;
        this.channel = null;
        this.message = null;

        this.roleIdMap = new Map(
            AppGlobals.config.modules.mainBot.reactRoles.roles.map((role) => [
                role.roleId,
                role,
            ]),
        );
    }

    public async start(): Promise<string> {
        let message;

        await this.fetchGuild();

        await Promise.all([this.fetchChannel(), this.validateRolePositions()]);

        if (await this.fetchMessage()) {
            await this.updateExistingMessage();
            message = 'React roles setup on existing message';
        } else {
            await this.sendNewMessage();
            message = 'React roles setup on new message';
        }

        this.makeInteractionListeners();

        return message;
    }

    private async validateRolePositions(): Promise<void> {
        const guild = this.guild;

        if (guild === null) {
            throw new Error(
                `Tried to validate role positions but guild is null`,
            );
        }

        // Attempt cache of bot role.
        await guild.roles.fetch(undefined);

        const selfRolePosition = guild.members.me?.roles.botRole?.position;

        if (selfRolePosition === undefined) {
            throw new Error(
                `Bot role not found in ${guild.name} (${guild.id})`,
            );
        }

        await Promise.all(
            Array.from(this.roleIdMap.values()).map(
                async ({ roleId, label }) => {
                    const roleInGuild = await guild.roles.fetch(roleId);

                    if (roleInGuild === null) {
                        throw new Error(
                            `Role for ${label} (${roleId}) not found in ${guild.name}`,
                        );
                    }

                    const rolePosition = roleInGuild.position;

                    if (rolePosition >= selfRolePosition) {
                        throw new Error(
                            `Role for ${label} (${roleInGuild.name}) is higher than the bot role in ${guild.name}`,
                        );
                    }
                },
            ),
        );
    }

    private async getSavedMessageId(): Promise<Snowflake | null> {
        const result = await this.messageDb.findOne({ _id: this.id });

        return result?.messageId ?? null;
    }

    private async setSavedMessageId(messageId: Snowflake): Promise<void> {
        await this.messageDb.updateOne(
            { _id: this.id },
            { $set: { messageId } },
            { upsert: true },
        );
    }

    /** Attempts to find the existing guild for react-roles. */
    private async fetchGuild(): Promise<void> {
        const { guildId } = AppGlobals.config.modules.mainBot.reactRoles;

        const guild = await (await this.client.guilds.fetch(guildId)).fetch();

        if (guild instanceof Collection) {
            throw new Error(
                `Received a collection when fetching guild ${guildId}`,
            );
        }

        this.guild = guild;
    }

    /** Attempts to find the existing channel for react-roles. */
    private async fetchChannel(): Promise<void> {
        const { channelId } = AppGlobals.config.modules.mainBot.reactRoles;

        if (this.guild === null) {
            throw new Error(`Tried to fetch channel but guild is null`);
        }

        const channel = await this.guild.channels.fetch(channelId);

        if (channel instanceof Collection) {
            throw new Error(
                `Received a collection when fetching channel ${channelId}`,
            );
        }

        if (channel === null) {
            throw new Error(`Channel ${channelId} not found`);
        }

        if (channel.type !== ChannelType.GuildText) {
            throw new Error(
                `Channel ${channelId} (${channel.name}) is not a text channel (got ${ChannelType[channel.type]})`,
            );
        }

        this.channel = channel;
    }

    /** Attempts to find the existing message for react-roles. */
    private async fetchMessage(): Promise<boolean> {
        if (this.channel === null) {
            throw new Error(`Tried to fetch message but channel is null`);
        }

        const messageId = await this.getSavedMessageId();

        if (messageId === null) {
            this.message = null;
            return false;
        }

        const message = await this.channel.messages.fetch(messageId);

        if (message instanceof Collection) {
            throw new Error(
                `Received a collection when fetching message ${messageId}`,
            );
        }

        this.message = message;
        return true;
    }

    private async sendNewMessage(): Promise<void> {
        if (this.channel === null) {
            throw new Error(`Tried to send new message but channel is null`);
        }

        const messageContents = this.makeMessageContents();

        this.message = await this.channel.send(messageContents);

        await this.setSavedMessageId(this.message.id);
    }

    private async updateExistingMessage(): Promise<void> {
        if (this.message === null) {
            throw new Error(`Tried to update existing message but is null`);
        }

        const messageContents = this.makeMessageContents();

        await this.message.edit(messageContents);
    }

    private makeMessageContents(): BaseMessageOptions {
        const { embedColour } = AppGlobals.config.modules.mainBot;

        const embed = new EmbedBuilder()
            .setColor(embedColour)
            .setTitle('Personal Roles')
            .setDescription('Click on a button to add/remove a role!');

        const buttons = new Array<ButtonBuilder>();

        for (const { roleId, style, label, emoji } of this.roleIdMap.values()) {
            const button = new ButtonBuilder()
                .setCustomId(roleId)
                .setStyle(style)
                .setLabel(label)
                .setEmoji(emoji);

            buttons.push(button);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            buttons,
        );

        return { embeds: [embed], components: [row] };
    }

    private makeInteractionListeners(): void {
        if (this.message === null) {
            throw new Error(
                `Tried to make interaction listeners but message is null`,
            );
        }

        this.message
            .createMessageComponentCollector<ComponentType.Button>()
            .on('collect', (interaction) => {
                this.handleButtonPress(interaction).catch((error: unknown) => {
                    this.handleError(interaction, error);
                });
            })
            .on('end', () => {
                console.log(
                    `[${new Date().toLocaleString()}] Regenerating collector`,
                );

                void this.start().catch((error: unknown) => {
                    console.warn(
                        `Error while regenerating react roles:\n`,
                        error,
                    );
                });
            });
    }

    private async handleButtonPress(
        interaction: ButtonInteraction<'cached'>,
    ): Promise<void> {
        const roleId = interaction.customId;

        const role = this.roleIdMap.get(roleId);

        if (role === undefined) {
            throw new Error(`Role not found (ID ${roleId})`);
        }

        let action: 'add' | 'remove';

        if (interaction.member.roles.cache.has(roleId)) {
            // Member already has the role, so remove it.
            action = 'remove';
        } else {
            // Member does not have the role, so add it.
            action = 'add';
        }

        await interaction.member.roles[action](roleId);

        await this.sendFeedbackMessage(interaction, action, role);
    }

    private async sendFeedbackMessage(
        interaction: ButtonInteraction<'cached'>,
        action: 'add' | 'remove',
        role: ReactRole,
    ): Promise<void> {
        const { addMessage, removeMessage, label } = role;

        let feedbackMessage: string;

        if (action === 'add') {
            if (addMessage === undefined) {
                feedbackMessage = `You now have the **${label}** role`;
            } else {
                feedbackMessage = addMessage.replaceAll('%s', label);
            }
        } else {
            if (removeMessage === undefined) {
                feedbackMessage = `You no longer have the **${label}** role`;
            } else {
                feedbackMessage = removeMessage.replaceAll('%s', label);
            }
        }

        await interaction.reply({ content: feedbackMessage, ephemeral: true });
    }

    private handleError(interaction: ButtonInteraction, error: unknown): void {
        const { developerId } = AppGlobals.config.modules.mainBot;

        console.error(error);

        const errorMessage = [];

        if (developerId) {
            errorMessage.push(`Notifying ${userMention(developerId)}`);
        }

        if (error instanceof Error) {
            errorMessage.push('```js', error.name, error.message, '```');
        } else {
            errorMessage.push('An unknown error occurred :(');
        }

        interaction
            .reply({
                content: errorMessage.join('\n'),
                allowedMentions: {
                    parse: [],
                    users: developerId ? [developerId] : undefined,
                },
            })
            .catch(() => null);
    }
}
