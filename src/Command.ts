import Context from "./Context";
import { readdirSync, existsSync } from "fs";
import { ArgArray } from "./ArgType";
import CommandError from "./CommandError";
import { chkmod, hasDuplicates } from "./util";
import { Embed } from "discord.js";
import { resolve } from "path";
import Log from "./Log";

interface CommandParams<T extends unknown[]> {
	name: string,
	hasSubCommands?: boolean,
	noArgError?: boolean,
	help?: string,
	longHelp?: string,
	mod?: boolean,
	admin?: boolean,
	args?: ArgArray<T>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommandConstructor<T extends unknown[]> = { new (...args: any[]): Command<T> };

export function CommandInfo<T extends unknown[] = []>(params: CommandParams<T>): <U extends CommandConstructor<T>>(ctor: U) => U {
	return function<U extends CommandConstructor<T>>(ctor: U): U {
		return class extends ctor {
			override name = params.name;
			override hasSubCommands = params.hasSubCommands ?? false;
			override noArgError = params.noArgError ?? false;
			override help = params.help ?? "";
			override longHelp = params.longHelp ?? "";
			override mod = params.mod ?? false;
			override admin = params.admin ?? false;
			override args = params.args ?? [] as ArgArray<T>;
		};
	};
}


export default abstract class Command<T extends unknown[] = unknown[]> {
	public isBase = false;
	public name: string;
	public path: string;
	public hasSubCommands: boolean;
	public subCommands: Command[] = [];
	public parent?: Command;
	public noArgError: boolean;
	public help: string;
	public longHelp: string;
	public mod: boolean;
	public admin: boolean;
	public args: ArgArray<T>;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async run(_ctx: Context, _args?: T): Promise<void> { throw new CommandError("Cette sous commande n'existe pas"); }
	
	async loadSubCommands(): Promise<void> {
		const path = resolve(__dirname, `./commands/${this.path}/${this.name}`);
		const log: Log = new Log("cmdLoader");
		if (!existsSync(path)) { return void log.warn(`Could not read subcommands of ${this.getFullName()}`); }
		this.subCommands = (await Promise.all(readdirSync(path, { withFileTypes: true })
			.filter(x => x.isFile())
			.map(x => import(`./commands/${this.path}/${this.name}/${x.name}`))))
			.map(x => new x.default());
		this.subCommands.forEach(x => {
			x.path = `${this.path}/${this.name}`;
			x.parent = this;
		});
		await Promise.all(this.subCommands.filter(x => x.hasSubCommands).map(x => x.loadSubCommands()));
		if (hasDuplicates(this.subCommands.map(x => x.name))) { throw new Error(`Duplicate subcommands for cmd ${this.name}`); }
	}

	getSubCommandFromArgs(args: string[]): [Command, string[]] { // Subcommand and remaining args
		const subCmdName: (string | undefined) = args[0]?.toLowerCase();
		const subCmd: Command = this.subCommands.find(x => x.name == subCmdName);
		if (subCmd) { return subCmd.getSubCommandFromArgs(args.slice(1)); }
		return [this, args];
	}

	async runWithRawArgs(args: string[], ctx: Context): Promise<void> {
		const [cmd, remArgs] = this.getSubCommandFromArgs(args);
		if (cmd.noArgError && remArgs.length == 0) { throw new CommandError("Cette commande ne peut pas être appelée sans arguments."); }
		await cmd.checkPermissions(ctx);
		return await cmd.run(ctx, await cmd.parseArgs(remArgs, ctx));
	}

	async checkPermissions(ctx: Context): Promise<void> {
		if (this.admin && !ctx.msg.member.permissions.has("Administrator")) { throw new CommandError("Seulement un administrateur peut faire cette commande"); }
		if (this.mod && !chkmod(ctx.msg.member)) { throw new CommandError("Tu n'as pas ma permission pour faire cette action"); }
	}

	async parseArgs(args: string[], ctx: Context): Promise<T> {
		args = args.slice();
		const parsed: T = await Promise.all(this.args.map(x => {
			const n: number = x.extended <= 0 ? args.length + x.extended : x.extended;
			return x.parse(args.splice(0, n).join(" "), ctx);
		})) as T;
		if (args.length > 0) {
			let errorText = `Trop d'arguments ont été passés (max ${this.args.length} étaient attendus)`;
			if (this.hasSubCommands) { errorText += "\nOu bien la sous commande que vous essayez d'exécuter n'existe pas"; }
			throw new CommandError(errorText);
		}
		return parsed;
	}

	getLongHelp(): string { return this.longHelp == "" ? this.help : this.longHelp; }

	getFullName(): string { return !this.parent || this.parent.isBase ? `+${this.name}` : `${this.parent.getFullName()} ${this.name}`; }

	generateHelpEmbed(): Partial<Embed> {
		let res = `${this.toString()}\n\n${this.getLongHelp()}\n\n`;
		if (this.noArgError) { res += "Cette commande ne peut pas être appelée sans arguments\n\n"; }
		if (this.hasSubCommands) {
			res += this.subCommands.map(x => `${x.toString()} | ${x.help}` + (this.mod ? "(staff)" : "")).join("\n");
		} else { res += "Cette commande n'a pas de sous commandes"; }
		return { title: "Page d'aide", color: 150, description: res };
	}
	
	toString(): string { return `**${this.getFullName()}** ${this.args.map(x => x.toString()).join(" ")} ${this.hasSubCommands ? "***(...)***" : ""}`; }
}
