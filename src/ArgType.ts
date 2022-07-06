import { GuildChannel, GuildMember, Role } from "discord.js";
import CommandError from "./CommandError";
import Context from "./Context";

export type ArgArray<T extends unknown[]> = {
	[P in keyof T]: ArgType<T[P]>
}

export class ArgType<T> {
	public static STRING(name: string): ArgType<string> { return new ArgType(name, /.+/, async x => x); }
	public static CHANNEL(name: string): ArgType<GuildChannel> { 
		return new ArgType(name, /<#\d+>|\d+/, async (arg, ctx) => {
			const id: string = arg.replace(/[<#>]/g, "");
			return await ctx.msg.guild.channels.fetch(id);
		});
	}
	public static MENTION(name: string): ArgType<GuildMember> { 
		return new ArgType(name, /<@!?\d+>|\d+/, async (arg, ctx) => {
			const id: string = arg.replace(/[<@!>]/g, "");
			return await ctx.msg.guild.members.fetch(id);
		});
	}
	public static ROLE(name: string): ArgType<Role> {
		return new ArgType(name, /<@&\d+>|\d+/, async (arg, ctx) => {
			const id: string = arg.replace(/[<@&>]/g, "");
			return await ctx.msg.guild.roles.fetch(id);
		});
	}
	public static INTEGER(name: string): ArgType<number> { return new ArgType(name, /\d+/, async arg => parseInt(arg)); }
	public static RANGE(name: string, from: number, to = Infinity): ArgType<number> {
		return new ArgType(name, /\d+/, async arg => {
			const n: number = parseInt(arg);
			if (n < from || n >= to) { throw new CommandError(`La valeur de ${name} doit être entre ${from} et ${to}`); }
			return n;
		});
	}
	public static FLOAT(name: string): ArgType<number> { return new ArgType(name, /\d+.?\d*/, async arg => parseFloat(arg)); }
	public static FLOATRANGE(name: string, from: number, to = Infinity): ArgType<number> {
		return new ArgType(name, /\d+/, async arg => {
			const n: number = parseFloat(arg);
			if (n < from || n >= to) { throw new CommandError(`La valeur de ${name} doit être entre ${from} et ${to}`); }
			return n;
		});
	}
	public static CHOICE<T extends readonly string[]>(name: string, values: T): ArgType<typeof values[number]> {
		return new ArgType(name, /.+/, async arg => {
			if (!values.map(x => x.toLowerCase()).includes(arg)) { throw new CommandError(`L'argument ${name} doit être parmi : ${values.join(",")}`) }
			return arg;
		});
	}
	public static LINK(name: string): ArgType<string> { return new ArgType(name, /^.+\..+$/, async x => x) }
	
	private readonly regex: RegExp;
	private readonly read: (arg: string, ctx: Context) => Promise<T>;
	public readonly name: string;
	private optional: boolean;
	public extended = 1;
	private fallback: T = null;
	private readonly other: ArgType<unknown>[] = [];

	private constructor(name: string, regex: RegExp, read: (arg: string, ctx: Context) => Promise<T>) {
		this.regex = regex;
		this.read = read;
		this.name = name;
		this.optional = false;
	}

	makeOptional(): ArgType<T> {
		this.optional = true;
		return this;
	}

	extend(n = 0): ArgType<T> {
		this.extended = n;
		return this;
	}

	default(def: T): ArgType<T> {
		this.fallback = def;
		return this;
	}

	or<U>(type: ArgType<U>): ArgType<T | U> {
		this.other.push(type);
		return this;
	}

	async parse(arg: string, ctx: Context): Promise<T> {
		if (!arg) { 
			if (this.optional) { return this.fallback; }
			else { throw new CommandError(`L'argument requis <${this.name}> doit être renseigné`); }
		}
		const read: Promise<T>[] = [this as ArgType<unknown>].concat(this.other).map(x => {
			if (!arg.match(x.regex)) { return new Promise((_res, rej) => rej(new CommandError(`L'argument ${x.name} n'est pas de la bonne forme`))); }
			return x.read(arg, ctx) as Promise<T>;
		});
		const resl: (T | Error)[] = [];
		for (const i of read) {
			try { resl.push(await i); }
			catch (e) { resl.push(e); }
		}
		if (resl.every(x => x instanceof Error)) {
			if (resl.length == 1) { throw resl[0]; }
			throw new CommandError(`Impossible de trouver u${resl.map(x => "- " + (x as Error).message).join("\n")}`)
		} else { return resl.find(x => !(x instanceof Error)) as T; }
	}

	toString(): string {
		return this.optional ? `*(${this.name})*` : `*<${this.name}>*`;
	}
}
