import Log from "./Log";
import Bot from "./Bot";

async function main(): Promise<void> {
	const log: Log = new Log("main");
	log.info(`Process started`);
	process.on("uncaughtException", (e) => log.error(`An uncaught exception has occurred\n${e.stack}`));
	process.on("SIGINT", process.exit);
	process.on("exit", () => log.fatal("Process has exited"));
	const bot: Bot = new Bot();
	await bot.setListeners()
		.loadFiles()
		.loadCommands()
		.then(mv => mv.login());
}

void main();
