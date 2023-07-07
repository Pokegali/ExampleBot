import * as chalk from "chalk";

export default class Log {
	private readonly cat: string;

	constructor(cat: string) {
		this.cat = cat;
	}

	private print(lv: string, msg: string, color: chalk.Chalk): void {
		const date: string = new Date().toLocaleString("FR-fr", { timeZone: "Europe/Paris" }).replace(",", "");
		console.log(`${chalk.cyan(date)} ${color.bold(lv.padEnd(5))} ${color.italic(`[${this.cat}]`)} ${color(msg)}`);
	}

	error(msg: string): void { this.print("ERROR", msg, chalk.red); }
	warn(msg: string): void { this.print("WARN", msg, chalk.yellow); }
	info(msg: string): void { this.print("INFO", msg, chalk.white); }
	debug(msg: string): void { this.print("DEBUG", msg, chalk.gray); }
	fatal(msg: string): void { this.print("FATAL", msg, chalk.magenta); }
}