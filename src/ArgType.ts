import { GuildBasedChannel, GuildMember, Role, User } from "discord.js";
import CommandError from "./CommandError";
import MessageContext from "./Context";
import { escape, findLike } from "./util";
import Context from "./Context";

export type ArgArray<T extends unknown[]> = {
	[P in keyof T]: ArgType<T[P]>
}

export class ArgType<T> {
	public static STRING(name: string): ArgType<string> { return new ArgType(name, "string", /^.+$/m, async x => escape(x)); }
	public static CHANNEL(name: string): ArgType<GuildBasedChannel> {
		return new ArgType(name, "channel", /^<#\d+>$|^\d+$/, async (arg, ctx) => {
			const id: string = arg.replace(/[<#>]/g, "");
			try { return await ctx.msg.guild.channels.fetch(id); }
			catch (e) { throw new CommandError(`Le salon fourni comme ${name} n'existe pas`); }
		});
	}
	public static MENTION(name: string): ArgType<GuildMember> {
		return new ArgType(name, "mention", /^<@!?\d+>$|^\d+$/, async (arg, ctx) => {
			const id: string = arg.replace(/[<@!>]/g, "");
			try { return await ctx.msg.guild.members.fetch(id); }
			catch (e) { throw new CommandError(`L'utilisateur fourni comme ${name} n'existe pas sur ce serveur`); }
		});
	}
	public static USERNAME(name: string): ArgType<User> {
		return new ArgType(name, "username", /^.+$/m, async (arg, ctx) => {
			const match: User[] = findLike(arg, [...ctx.bot.client.users.cache.values()], x => x.tag);
			if (match.length > 1) { throw new CommandError("La recherche par pseudo n'est pas assez précise"); }
			if (match.length == 0) { throw new CommandError("Aucun utilisateur en cache ne possède ce pseudo"); }
			return match[0];
		});
	}
	public static ROLE(name: string): ArgType<Role> {
		return new ArgType(name, "role", /^<@&\d+>$|^\d+$/, async (arg, ctx) => {
			const id: string = arg.replace(/[<@&>]/g, "");
			const role: Role = await ctx.msg.guild.roles.fetch(id);
			if (!role) { return new Promise((_res, rej) => rej(new CommandError(`Le rôle fourni comme ${name} n'existe pas`))); }
			return role;
		});
	}
	public static INTEGER(name: string): ArgType<number> {
		return new ArgType(name, "integer", /^-?\d+$/, async arg => {
			const n = parseInt(arg);
			if (n > 1e20 || n < -1e20) { throw new CommandError("Non. Pas plus de 10^20. Genre stop."); }
			return n;
		});
	}
	public static RANGE(name: string, from: number, to = 1e20): ArgType<number> {
		return new ArgType(name, "integer", /^-?\d+$/, async arg => {
			const n: number = parseInt(arg);
			if (n < from || n >= to) { throw new CommandError(`La valeur de ${name} doit être entre ${from} et ${to}`); }
			return n;
		});
	}
	public static FLOAT(name: string): ArgType<number> {
		return new ArgType(name, "float", /^-?\d+.?\d*$/, async arg => {
			const n = parseFloat(arg);
			if (n > 1e20 || n < -1e20) { throw new CommandError("Non. Pas plus de 10^20. Genre stop."); }
			return n;
		});
	}
	public static FLOATRANGE(name: string, from: number, to = 1e20): ArgType<number> {
		return new ArgType(name, "float", /^-?\d+.?\d*$/, async arg => {
			const n: number = parseFloat(arg);
			if (n < from || n >= to) { throw new CommandError(`La valeur de ${name} doit être entre ${from} et ${to}`); }
			return n;
		});
	}
	public static CHOICE<T extends readonly string[]>(name: string, values: T): ArgType<typeof values[number]> {
		return new ArgType(name, "string", /^.+$/, async arg => {
			if (!values.map(x => x.toLowerCase()).includes(arg)) { throw new CommandError(`L'argument ${name} doit être parmi : ${values.join(",")}`); }
			return arg;
		});
	}
	public static LINK(name: string): ArgType<string> { return new ArgType(name, "url", /^.+\..+$/, async x => x); }

	public readonly regex: RegExp;
	private readonly read: (arg: string, ctx: Context) => Promise<T>;
	public readonly name: string;
	public readonly type: string;
	private optional: boolean;
	public extended = 1;
	public fallback: T = null;
	private readonly other: ArgType<unknown>[] = [];

	private constructor(name: string, type: string, regex: RegExp, read: (arg: string, ctx: MessageContext) => Promise<T>) {
		this.regex = regex;
		this.read = read;
		this.name = name;
		this.type = type;
		this.optional = false;
	}

	makeOptional(): ArgType<T | null> {
		this.optional = true;
		return this;
	}

	extend(n = 0): ArgType<T> {
		this.extended = n;
		return this;
	}

	default(def: NonNullable<T>): ArgType<T> {
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
		const read: Promise<T | Error>[] = [this as ArgType<unknown>].concat(this.other).map(x => {
			if (!x.regex.test(arg)) { return new Promise(res => res(new CommandError(`L'argument ${x.name} n'est pas de la bonne forme`))); }
			return x.read(arg, ctx).catch(e => e) as Promise<T | Error>;
		});
		const resl: (T | Error)[] = await Promise.all(read);
		if (resl.every(x => x instanceof Error)) {
			if (resl.length == 1) { throw resl[0]; }
			throw new CommandError(`Aucune des possibilités pour l'argument n'a fonctionné\n${resl.map(x => "- " + (x as Error).message).join("\n")}`);
		} else { return resl.find(x => !(x instanceof Error)) as T; }
	}

	toString(): string {
		return this.optional ? `*(${this.name})*` : `*<${this.name}>*`;
	}
}
