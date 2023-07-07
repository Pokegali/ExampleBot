import { GuildMember } from "discord.js";

const modroles: string[] = []

export function chkmod(u: GuildMember): boolean {
	return u.roles.cache.some(x => modroles.includes(x.id)) || modroles.includes(u.user.id) || u.permissions.has(8n) || u.guild.ownerId == u.id;
}

export function hasDuplicates<T>(arr: T[]): boolean { return arr.some(x => arr.indexOf(x) != arr.lastIndexOf(x)); }

export function findLike<T>(query: string, arr: T[], keyFn: (x: T) => string): T[] {
	const match: T[] = arr.filter(x => keyFn(x).toLowerCase().includes(query.toLowerCase()));
	const exactMatch: T = match.find(x => keyFn(x).toLowerCase() == query.toLowerCase());
	return exactMatch ? [exactMatch] : match;
}

export function escape(str: string): string { return str.replace(/'/g, "''"); }