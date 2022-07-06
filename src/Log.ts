import * as chalk from "chalk";

export default class Log {
	private readonly cat: string;
	
	constructor(cat: string) {
		this.cat = cat;
	}

	private printDetail(lv: string, msg: string, [c1, c2, c3, c4]: chalk.Chalk[]): void {
		const date: string = new Date().toLocaleString().replace(",", "");
		console.log(`${c1(date)} ${c3(lv.padEnd(5))} ${c2(`[${this.cat}]`)} ${c4(msg)}`);
	}

	private print(lv: string, msg: string, color: chalk.Chalk): void {
		this.printDetail(lv, msg, [chalk.cyan, color.italic, color.bold, color]);
	}

	error(msg: string): void { this.print("ERROR", msg, chalk.red); }
	warn(msg: string): void { this.print("WARN", msg, chalk.yellow); }
	info(msg: string): void { this.print("INFO", msg, chalk.white); }
	debug(msg: string): void { this.print("DEBUG", msg, chalk.gray); }
	fatal(msg: string): void { this.print("FATAL", msg, chalk.magenta); }
}