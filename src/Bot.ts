import { Client, Message, TextChannel, GatewayIntentBits, CloseEvent } from "discord.js";
import Command from "./Command";
import CommandError from "./CommandError";
import Context from "./Context";
import { readdirSync } from "fs";
import { hasDuplicates } from "./util";
import Log from "./Log";
import { resolve } from "path";

export default class Bot {
	public client: Client = new Client({ intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.DirectMessages
	] });
	public commands: Command[];
	private readonly log: Log = new Log("bot");
	private auth: { token: string };

	loadFiles(): this {
		try {
			this.auth = require("../auth.json");
			return this;
		} catch (e) {
			this.log.fatal(`Could not load auth data (${e.name}: ${e.message})`);
			process.exit();
		}
	}
	
	async login(): Promise<void> {
		try {
			await this.client.login(this.auth.token);
			this.log.info(`${this.client.user.username} has successfully logged in`);
			await new Promise(res => { this.client.on("ready", res); });
		} catch (e) {
			this.log.fatal(`Could not log in: ${e.message}`);
			process.exit();
		}
	}
	
	async loadCommands(): Promise<this> {
		const path: string = resolve(__dirname, "./commands");
		this.commands = await Promise.all(readdirSync(path)
			.filter(x => x.slice(-3) == ".ts")
			.map(x => import(`${path}/${x}`))
			.map(x => x.then(cmd => new cmd.default)));
		this.commands.forEach(x => x.dirName = path);
		if (hasDuplicates(this.commands.map(x => x.name))) {
			this.log.fatal("Duplicate commands");
			process.exit();
		}
		try { await Promise.all(this.commands.filter(x => x.hasSubCommands).map(x => x.loadSubCommands())); }
		catch (e) {
			this.log.fatal(e.message);
			process.exit();
		}
		const count = (arr: Command[]): number => arr.reduce((acc, e) => acc + count(e.subCommands), 1);
		this.log.info(`Loaded ${count(this.commands) - 1} commands`);
		return this;
	}
	
	setListeners(): this {
		const onMessage = async (msg: Message): Promise<void> => {
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
