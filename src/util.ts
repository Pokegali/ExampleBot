import { GuildMember } from "discord.js";

const modroles: string[] = []

export function chkmod(u: GuildMember): boolean {
	return u.roles.cache.some(x => modroles.includes(x.id)) || modroles.includes(u.user.id) || u.permissions.has(8n) || u.guild.ownerId == u.id;
}

export function hasDuplicates<T>(arr: T[]): boolean { return arr.some(x => arr.indexOf(x) != arr.lastIndexOf(x)); }
