import {
    ActivityType,
    Client,
    Collection,
    CommandInteraction,
    Events,
    GatewayIntentBits,
    userMention,
} from 'discord.js';
import {
    awaitOrTimeout,
    TimeoutError,
} from '../../global/util/awaitOrTimeout.js';
import { Module, ModuleStartReturn, ModuleStartupResponse } from '../Module.js';
import { CommandDeployer } from './CommandDeployer.js';
import { BalanceCommand } from './commands/Balance.js';
import { BaltopCommand } from './commands/Baltop.js';
import { Command } from './commands/Command.js';
import { EconomyAdmin } from './commands/EconomyAdmin.js';
import { LinkCommand } from './commands/Link.js';
import { PayoutsCommand } from './commands/Payouts.js';
import { StatusCommand } from './commands/Status.js';
import { UserCommand } from './commands/User.js';
import { ReactRoles } from './ReactRoles.js';

export class MainBotModule extends Module {
    private readonly client: Client<true>;

    private readonly commands: Collection<Command['name'], Command>;

    public constructor() {
        super();

        this.client = new Client<true>({ intents: [GatewayIntentBits.Guilds] });

        this.commands = new Collection(
            [
                new LinkCommand(),
                new StatusCommand(),
                new BalanceCommand(),
                new PayoutsCommand(),
                new BaltopCommand(),
                new UserCommand(),
                new EconomyAdmin(),
            ].map((command) => [command.name, command]),
        );

        this.client.on(Events.InteractionCreate, (interaction) => {
            if (!interaction.isCommand()) return;

            this.handleCommandInvoke(interaction).catch((error: unknown) => {
                this.handleError(interaction, error);
            });
        });
    }

    public override async *start(): ModuleStartReturn {
        yield await this.login();

        yield await Promise.all([
            this.deploySlashCommands(),
            ...this.setupReactRoles(),
        ]);
    }

    private async login(): Promise<ModuleStartupResponse> {
        const { token, loginTimeout } = AppGlobals.config.modules.mainBot;

        try {
            await awaitOrTimeout(this.client.login(token), loginTimeout);
        } catch (error) {
            if (!(error instanceof TimeoutError)) {
                throw error;
            }

            console.error(error.makeMessage('login to Discord'));
            process.exit(1);
        }

        this.client.user.setPresence({
            status: 'online',
            activities: [{ type: ActivityType.Competing, name: 'the tower' }],
        });

        return {
            message: `Logged in as`,
            variables: this.client.user.displayName,
            finishedAt: Date.now(),
        };
    }

    private async deploySlashCommands(): Promise<ModuleStartupResponse> {
        const rawCommands = this.commands.map((command) =>
            command.build().toJSON(),
        );

        const message = await new CommandDeployer(
            this.client,
            'mainBot.json',
            rawCommands,
        ).deploy();

        return {
            message,
            finishedAt: Date.now(),
        };
    }

    private setupReactRoles(): Promise<ModuleStartupResponse>[] {
        const { reactRoles } = AppGlobals.config.modules.mainBot;

        return reactRoles.map((configSource) => {
            return new Promise<ModuleStartupResponse>((resolve, reject) => {
                new ReactRoles(this.client, configSource)
                    .start()
                    .then((message) => {
                        resolve({
                            message,
                            finishedAt: Date.now(),
                        });
                    })
                    .catch((error: unknown) => {
                        console.log(error);
                        reject(
                            error instanceof Error
                                ? error
                                : new Error('An unknown error occurred'),
                        );
                    });
            });
        });
    }

    private async handleCommandInvoke(
        interaction: CommandInteraction,
    ): Promise<void> {
        if (!interaction.isChatInputCommand()) {
            await interaction.reply({
                content: `Not a chat input command`,
                ephemeral: true,
            });

            return;
        }

        const command = this.commands.get(interaction.commandName);

        if (!command) {
            await interaction.reply({
                content: `Command \`${interaction.commandName}\` not found`,
                ephemeral: true,
            });

            return;
        }

        await command.onInvoke(interaction);
    }

    private handleError(interaction: CommandInteraction, error: unknown): void {
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
