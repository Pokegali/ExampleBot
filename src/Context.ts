import { Message, Embed } from "discord.js"
import Bot from "./Bot";

export default class Context {
	public readonly msg: Message;
	public readonly bot: Bot;

	constructor(msg: Message, bot: Bot) {
		this.msg = msg;
		this.bot = bot;
	}
	
	async send(txt: string): Promise<Message> { return await this.msg.channel.send(txt); }
	
	async sendEmbed(embed: Partial<Embed>): Promise<Message> { return await this.msg.channel.send({ embeds: [embed] }); }
	
	async parse(): Promise<void> {
		if (this.msg.channel.isDMBased() || this.msg.author.bot) { return; }
		await this.runCommand();
	}

	async runCommand(): Promise<void> {
		const args: string[] = this.msg.content.substring(1).split(/ +/);
		if (this.msg.author.bot || args.length == 0 || !this.msg.content.startsWith("+")) { return; }
		const name: string = args.shift();
		await this.bot.commands.find(x => x.name == name)?.runWithRawArgs(args, this);
	}
	
	async sendError(txt: string): Promise<void> {
		await this.sendEmbed({
			timestamp: new Date().toISOString(),
			color: 0xff0000,
			description: `**${txt}**`,
			author: { name: "Erreur !" }
		});
	}
	
	async sendSuccess(txt: string): Promise<void> {
		await this.sendEmbed({
			timestamp: new Date().toISOString(),
			color: 0x00ff00,
			description: `**${txt}**`,
			author: { name: "Succès !" }
		});
	}
}
