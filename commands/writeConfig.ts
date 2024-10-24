import {Command} from "commands"
import {colors} from "ansiColors"
import {WriteConfig} from '../utils.ts'

export const writeConfigCommand = new Command()
    .name("writeConfig")
    .description("Write configuration to file")

    .option("-a, --anthropic-key <key:string>", "Anthropic SDK key", {required: true})
    .option("-p, --aws-profile <profile:string>", "Default AWS profile name", {default: "default"})
    .option("-r, --aws-region <region:string>", "Default AWS region", {default: "us-east-1"})

    .action(async (options) => {
        try {
            const config = {
                anthropicKey: options.anthropicKey,
                awsProfile: options.awsProfile,
                awsRegion: options.awsRegion,
            }
            await WriteConfig(config)
            console.log(colors.green("Configuration written successfully."))
        } catch (error) {
            console.error(colors.red("Error writing configuration:"), error instanceof Error ? error.message : String(error))
            Deno.exit(1)
        }
    })
