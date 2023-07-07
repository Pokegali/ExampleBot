import { Client, Message, GatewayIntentBits, CloseEvent } from "discord.js";
import Command from "./Command";
import CommandError from "./CommandError";
import Context from "./Context"
import Log from "./Log";
import { ArgArray } from "./ArgType";

export default class Bot {
	public client: Client = new Client({ intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.DirectMessages
	] });
	public baseCommand: Command;
	private readonly log: Log = new Log("bot");
	public config: { token: string, prefix: string };

	loadFiles(): this {
		try {
			this.config = require("../config.json");
			return this;
		} catch (e) {
			this.log.fatal(`Could not load auth data (${e.name}: ${e.message})`);
			process.exit();
		}
	}
	
	async login(): Promise<void> {
		try {
			await this.client.login(this.config.token);
			this.log.info(`${this.client.user.username} has successfully logged in`);
			await new Promise(res => { this.client.on("ready", res); });
		} catch (e) {
			this.log.fatal(`Could not log in: ${e.message}`);
			process.exit();
		}
	}
	
	async loadCommands(): Promise<this> {
		if (this.baseCommand) {
			this.log.warn("Commands are already loaded");
			return this;
		}
		this.baseCommand = new class extends Command<[]> {
			override isBase = true;
			override name = "";
			override path = "";
			override hasSubCommands = true;
			override parent: Command = null;
			override noArgError = false;
			override mod = false;
			override admin = false;
			override args: ArgArray<[]> = [];

			override async run(): Promise<void> { /* no command was run */ }
			override async parseArgs(): Promise<[]> { return []; }
		};
		try { await this.baseCommand.loadSubCommands(); }
		catch (e) {
			this.log.fatal("Could not load Mavis commands");
			this.log.fatal(`${e.name}: ${e.message}`);
			process.exit(0);
		}
		const count = (arr: Command[]): number => arr.reduce((acc, e) => acc + count(e.subCommands), 1);
		this.log.info(`Loaded ${this.getAllCommands().length} commands`);
		return this;
	}

	getAllCommands(): Command[] {
		const flatten = (x: Command[]): Command[] => x.flatMap(c => c.hasSubCommands ? flatten(c.subCommands).concat(c) : c);
		return flatten([this.baseCommand]).slice(0, -1);
	}

	setListeners(): this {
		const onMessage = async (msg: Message): Promise<void> => {
			if (msg.author.bot) { return; }
			const ctx: Context = new Context(msg, this);
			try { await ctx.parse(); }
			catch (e) {
				if (e instanceof CommandError) { await ctx.sendError(e.message); }
				else {
					this.log.warn(`Error while handling message\n${e.stack}`);
					await ctx.send(`${e.name}: ${e.message}`);
				}
			}
		}
		const onError = (e: Error): void => this.log.error(`${e.name}: ${e.message}`);
		const onShardError = (e: Error, id: number): void => this.log.warn(`Shard ${id} encountered an error: ${e.name}: ${e.message}`);
		const onShardReady = (id: number): void => this.log.info(`Shard ${id} is ready`);
		const onShardDisconnect = (evt: CloseEvent, id: number): void => this.log.error(`Shard ${id} has disconnected (reason: ${evt.reason})`);
		const onShardReconnecting = (id: number): void => this.log.debug(`Shard ${id} is reconnecting`);
		const onShardResume = (id: number): void => this.log.debug(`Shard ${id} has resumed successfully`)
		const onReady = (): void => this.log.info("Everything is ready !");
		this.client.on("messageCreate", onMessage);
		this.client.on("error", onError);
		this.client.on("shardError", onShardError);
		this.client.on("shardReady", onShardReady);
		this.client.on("shardDisconnect", onShardDisconnect);
		this.client.on("shardReconnecting", onShardReconnecting);
		this.client.on("shardResume", onShardResume);
		this.client.on("ready", onReady);
		this.log.info("Listeners ready to listen");
		return this;
	}
}
