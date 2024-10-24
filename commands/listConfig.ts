import {Command} from "commands"
import {colors} from "ansiColors"
import {ReadConfig} from '../utils.ts'

export const listConfigCommand = new Command()
    .name("listConfig")
    
    .description("List current configuration")
    .action(() => {
        try {
            const config = ReadConfig()
            console.log(colors.green("Current configuration:"))
            console.log(JSON.stringify(config, null, 2))
        } catch (error) {
            console.error(colors.red("Error reading configuration:"), error instanceof Error ? error.message : String(error))
            Deno.exit(1)
        }
    })
