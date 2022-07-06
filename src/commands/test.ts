import Context from "../Context";
import Command, { CommandInfo } from "../Command";

@CommandInfo({ name: "test", help: "Renvoie 'Test réussi !'" })
export default class TestCommand extends Command<[]> {
	async run(ctx: Context): Promise<void> {
		await ctx.send("Test réussi !");
	}
}
