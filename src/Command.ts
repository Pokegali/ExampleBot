import Context from "./Context";
import { readdirSync } from "fs";
import { ArgArray } from "./ArgType";
import CommandError from "./CommandError";
import { chkmod, hasDuplicates } from "./util";
import { Embed } from "discord.js";

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
type Constructor<T extends unknown[]> = { new (...args: any[]): Command<T> };

export function CommandInfo<T extends unknown[] = []>({ name, hasSubCommands = false, noArgError = false, help = "", longHelp = "", mod = false, admin = false, args = [] as ArgArray<T>}: CommandParams<T>): (arg0: Constructor<T>) => Constructor<T> {
	return function<U extends Constructor<T>>(ctor: U): U {
		return class extends ctor {
			name = name;
			hasSubCommands = hasSubCommands;
			noArgError = noArgError;
			help = help;
			longHelp = longHelp;
			mod = mod;
			admin = admin;
			args = args;
		}
	}
}

export default abstract class Command<T extends unknown[] = unknown[]> {
	public name: string;
	public dirName: string;
	public hasSubCommands: boolean;
	public subCommands: Command[] = [];
	public parent: Command;
	public noArgError: boolean;
	public help: string;
	public longHelp: string;
	public mod: boolean;
	public admin: boolean;
	public args: ArgArray<T>;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async run(_ctx: Context, _args?: T): Promise<void> { throw new Error("You can't 'run' the base command"); }
	
	async loadSubCommands(): Promise<void> {
		const path = `${this.dirName}/${this.name}`;
		this.subCommands = (await Promise.all(readdirSync(path)
				.filter(x => x.slice(-3) == ".ts")
				.map(x => import(`${path}/${x}`))))
			.map(x => new x.default());
		this.subCommands.forEach(x => {
			x.dirName = path;
			x.parent = this;
		});
		await Promise.all(this.subCommands.filter(x => x.hasSubCommands).map(x => x.loadSubCommands()));
		if (hasDuplicates(this.subCommands.map(x => x.name))) { throw new Error(`Duplicate subcommands for cmd ${this.name}`); }
	}

	getSubCommandFromArgs(args: string[]): [Command, string[]] { // Subcommand and remaining args
		const subCmdName: (string | undefined) = args[0];
		const subCmd: Command = this.subCommands.find(x => x.name == subCmdName);
		if (subCmd) { return subCmd.getSubCommandFromArgs(args.slice(1)); }
		if (this.hasSubCommands && subCmdName) { throw new CommandError("Cette sous commande n'existe pas"); }
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

	async parseArgs<T extends unknown[]>(args: string[], ctx: Context): Promise<T> {
		args = args.slice();
		const parsed: T = await Promise.all(this.args.map(x => {
			const n: number = x.extended <= 0 ? args.length + x.extended : x.extended;
			return x.parse(args.splice(0, n).join(" "), ctx);
		})) as T
		if (args.length > 0) { throw new CommandError(`Trop d'arguments ont été passés (max ${this.args.length} étaient attendus)`); }
		return parsed;
	}

	getLongHelp(): string { return this.longHelp == "" ? this.help : this.longHelp; }

	getFullName(): string { return this.parent ? `${this.parent.getFullName()} ${this.name}` : `+${this.name}` }

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
