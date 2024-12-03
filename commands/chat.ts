import {Command} from "commands"
import {colors} from "ansiColors"
import {getDirStructure, FileNode} from "../directoryProcessor.ts"
import {existsSync} from "https://deno.land/std/fs/mod.ts"
import {join} from "https://deno.land/std/path/mod.ts"
import {
    figuringOutIaC,
    figuringOutResources,
    figuringOutCommands,
    explainingOutput,
    continueConversation,
    figuringOutStackName
} from "../anthropic.ts"
import {getLogFileName, listStackResources, writeJsonToFile} from "../utils.ts"
import {executeAwsCommand} from "../commandRunner.ts"
import type {GlobalOptions} from "../index.ts"
import {wait} from "jsr:@denosaurs/wait"
import {getStringFromStringIterator} from "../utils.ts"
import {format} from "jsr:@std/datetime@0.219.1"
import * as log from "jsr:@std/log@0.219.1"

function extractFileNames(node: FileNode): string[] {
    let fileNames: string[] = []
    if (node.name) {
        fileNames.push(node.name)
    }
    if (node.children) {
        for (const child of node.children) {
            fileNames = fileNames.concat(extractFileNames(child))
        }
    }
    return fileNames
}



await log.setup({
    handlers: {
        console: new log.ConsoleHandler("WARN", {
            formatter: log.formatters.jsonFormatter,
        }),
        file: new log.FileHandler("DEBUG", {
            filename: getLogFileName(),
            mode: "w",
            formatter: log.formatters.jsonFormatter,
        })
    },
    loggers: {
        default: {
            level: "DEBUG",
            handlers: ["console", "file"],
        },
    },
})
// Initialize logger
const logger = log.getLogger()

export const chatCommand = new Command<GlobalOptions>()
    .name("chat")
    .description("Chat with the model")
    .option("-p, --profile <profile:string>", "AWS profile name")
    .option("-r, --region <region:string>", "AWS region")
    .option("-c, --code-base <codeBase:string>", "Code base to use", {required: true})
    .option("-m, --model <model:string>", "Model to use", {default: "haiku-3"})
    .option("-s, --stage <stage:string>", "Stage to query", {default: "prod"})
    .option("-P, --prompts [prompts:boolean]", "Print only LLM prompts and their responses",
        {default: false})
    .action(async (options) => {
        try {
            console.log({options})
            const args = options['args']
            console.log({args})
            const config = {
                profile: options['profile'],
                region: options['region'],
                codeBase: options['codeBase'],
                model: options['model'],
                debug: options['debug'],
                stage: options['stage'],
                prompts: options['prompts']
            }

            const isVerbose = config.debug || config.prompts
            if (isVerbose) {
                console.log(colors.blue("Verbose mode enabled"))
            }

            // Check if codebase exists
            if (!existsSync(config.codeBase)) {
                throw new Error(`Codebase directory does not exist: ${config.codeBase}`)
            }

            console.log(colors.green("Chat configuration set successfully."))
            console.log(colors.blue("Processing codebase..."))

            const isCurrentDir = config.codeBase === '.'
            const projectName = isCurrentDir ? Deno.cwd().split('/').pop() ?? "" : config.codeBase

            // Create JSON file of codebase
            const codebaseStructure = await getDirStructure(config.codeBase, [], isVerbose)
            if (isVerbose) {
                console.log(JSON.stringify(codebaseStructure, null, 2))
            }

            if (!codebaseStructure) {
                throw new Error("Failed to process codebase")
            }


            await writeJsonToFile(projectName, "codebase_structure.json", codebaseStructure)

            console.log(colors.green("Codebase structure saved to codebase_structure.json"))
            const spinner = wait("Processing codebase...")
            spinner.start()
            try {
                // Extract file names and pass them to figuringOutIaC
                const fileNames = extractFileNames(codebaseStructure)
                const fileNamesJson = JSON.stringify(fileNames, null, 2)
                const iacResponse = await figuringOutIaC(fileNamesJson, false, isVerbose)
                const iacResponseAsString = await ensureString(iacResponse)
                spinner.text = "Processing resources..."

                // Read the content of identified IaC files
                const iacFiles = iacResponseAsString.split(',').map(file => file.trim())
                let iacFilesContent = ''
                for (const file of iacFiles) {
                    try {
                        const content = await Deno.readTextFile(join(config.codeBase, file))
                        const fileName = file.split('/').pop() || file // Get the file name without the path
                        iacFilesContent += `<${fileName}>${content}</${fileName}>\n\n`
                    } catch (error) {
                        console.error(`Error reading file ${file}:`, error)
                    }
                }

                // Figure out the stack name
                const stackNameResponse = await figuringOutStackName(iacFilesContent, config.stage, false, isVerbose)
                const stackName = await ensureString(stackNameResponse)

                spinner.text = `Processing stack resources for ${stackName}...`
                // List stack resources
                const stackResources = await listStackResources(stackName, config.profile, config.region)

                // If verbose, write debug data to JSON

                const debugData = {
                    stackName: stackName,
                    stackResources: stackResources,
                    timestamp: new Date().toISOString()
                }
                await writeJsonToFile(
                    projectName,
                    "debug_data.json",
                    debugData
                )

                // Pass IaC file contents to figuringOutResources
                const resourcesResponse = await figuringOutResources(iacFilesContent, config.stage, true, isVerbose)

                spinner.succeed(colors.green("Prerequisite steps completed. Starting chat..."))

                const encoder = new TextEncoder()

                const messages: Array<{role: "user" | "assistant", content: string}> = []
                while (true) {
                    const prompt = colors.yellow("You: ")
                    Deno.stdout.writeSync(encoder.encode(prompt))
                    const buf = new Uint8Array(1024)
                    const n = <number>await Deno.stdin.read(buf)
                    if (n === null) break
                    const userInput = new TextDecoder().decode(buf.subarray(0, n)).trim()

                    if (userInput.toLowerCase() === 'exit') {
                        console.log(colors.blue("Exiting chat. Goodbye!"))
                        break
                    }

                    spinner.text = colors.blue("Processing your question...")
                    try {

                        let command: string | AsyncIterable<string> = ""
                        if (messages.length === 0) {

                            const resourcesResponseAsString = await ensureString(resourcesResponse)
                            // spinner.text = "Processing your question..."
                            spinner.stop()
                            // Get command from AI
                            command = await figuringOutCommands(resourcesResponseAsString, userInput, config.profile, config.region, stackName, JSON.stringify(stackResources), true, isVerbose)

                            const message: {role: "user", content: string} = {role: "user", content: `<ResourceList>${resourcesResponseAsString}</ResourceList>\n<ExistingStack>${stackName}</ExistingStack>\n<StackResources>${JSON.stringify(stackResources)}</StackResources>\n<UserQuery>${userInput}</UserQuery>`}

                            messages.push(message)
                        } else {
                            const message: {role: "user", content: string} = {role: "user", content: userInput}
                            if (!spinner.isSpinning) {
                                spinner.start()
                            }
                            // spinner.text = "Thinking..."
                            spinner.stop()

                            messages.push(message)
                            command = await continueConversation(messages, true, isVerbose)
                            spinner.succeed()
                        }
                        const commandString = await ensureString(command)

                        let commandData = commandString

                        logger.debug({commandData})
                        if (commandData.startsWith("answer:")) {
                            commandData = commandData.substring("answer:".length)
                            console.log(commandData)
                        } else if (commandData.startsWith("command:")) {
                            logger.info(`Command: ${commandData}`)
                            logger.debug('Starts with command')
                            commandData = commandData.substring("command:".length).trim()
                            logger.info({commandData})
                            console.log(colors.yellow("Assistant:"), commandString)
                            spinner.text = "Executing command..."
                            const commandResult = await executeAwsCommand(commandData, isVerbose, logger)
                            spinner.stop()

                            logger.info({commandResult})

                            // Explain the output
                            const explanation = await explainingOutput(userInput, commandData, JSON.stringify(commandResult), true, isVerbose)
                            let explanationStr = ""
                            if (typeof explanation === "string") {

                                explanationStr = explanation
                                console.log(colors.yellow("Assistant:"), explanationStr)
                            } else {
                                console.log(colors.yellow("Assistant:"))
                                for await (const chunk of explanation as AsyncIterable<string>) {
                                    explanationStr += chunk
                                    Deno.stdout.write(new TextEncoder().encode(chunk))

                                }

                            }
                            commandData = explanationStr
                        }
                        // 
                        // Execute the command

                        const response: {role: "assistant", content: string} =
                            {role: "assistant", content: commandData}
                        messages.push(response)
                        spinner.succeed()
                    } catch (error) {
                        spinner.fail(colors.red("Error processing your question:"))
                        console.error(colors.red(error instanceof Error ? error.message : String(error)))
                    }
                }
            } catch (error) {
                spinner.fail(colors.red("Error during initialization:"))
                console.error(colors.red(error instanceof Error ? error.message : String(error)))
            }
        } catch (error) {
            console.error(colors.red("Error:"), error instanceof Error ? error.message : String(error))
            if (options['debug']) {
                console.error(error)
            }
        }
    })

async function ensureString(llmMessage: string | AsyncIterable<string>) {
    return typeof llmMessage === "string" ? llmMessage : await getStringFromStringIterator(llmMessage)
}
