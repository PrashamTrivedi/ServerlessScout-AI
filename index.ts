import {Command, CompletionsCommand} from "commands"
import {colors} from "ansiColors"
import {chatCommand} from "./commands/chat.ts"
import {writeConfigCommand} from "./commands/writeConfig.ts"
import {listConfigCommand} from "./commands/listConfig.ts"
export type GlobalOptions = typeof cli extends
    Command<void, void, void, [], infer Options extends Record<string, unknown>>
    ? Options
    : never

const cli = new Command()
    .name("ServerlessScout")
    .alias("ssai")
    .version("0.1.0")
    .description("CLI tool for Serverless Scout")
    .globalOption("-d, --debug [debug:boolean]", "Print everything including prompts and responses", {
        default: false
    })

    .command("completions", new CompletionsCommand())


cli.command("chat", chatCommand)
    .command("writeConfig", writeConfigCommand)
    .command("listConfig", listConfigCommand)
if (import.meta.main) {
    await cli.parse(Deno.args)
}

export {cli};

