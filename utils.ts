
import {join} from "https://deno.land/std/path/mod.ts"

const CONFIG_DIR = join(Deno.env.get("HOME") || ".", 'serverlessScout')
const CONFIG_FILE = join(Deno.env.get("HOME") || ".", "serverlessScout", "config.json")


export async function getStringFromStringIterator(iterator: AsyncIterable<string>) {
  let data = ""
  for await (const chunk of iterator) {
    data += chunk
  }
  return data
}

export function RunCommand(command: string): void {
  console.log(`Executing command: ${command}`)
  // Here you would implement the actual command execution logic
  // For now, we'll just log the command
}



export type CurrentChat = {
  systemPrompt: string
  modelId: string
}

interface Config {
  anthropicKey: string
  awsProfile: string
  awsRegion: string,
  currentChat?: CurrentChat
}

export async function WriteConfig(config: Config): Promise<void> {
  try {
    await Deno.mkdir(CONFIG_DIR, {recursive: true})
    await Deno.writeTextFile(CONFIG_FILE, JSON.stringify(config, null, 2))
  } catch (error) {
    console.log(error)
    throw new Error(`Failed to write config: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function UpdateCurrentChat(chat: CurrentChat) {
  const config = ReadConfig()
  config.currentChat = chat
  WriteConfig(config)
}

export function ReadConfig(): Config {
  try {
    const configStr = Deno.readTextFileSync(CONFIG_FILE)
    return JSON.parse(configStr) as Config
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error("Config file not found. Please run writeConfig first.")
    }
    throw new Error(`Failed to read config: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function listStackResources(
  stackName: string,
  profile: string,
  region: string,
): Promise<any> {
  const command = new Deno.Command("aws", {
    args: [
      "cloudformation",
      "list-stack-resources",
      "--stack-name",
      stackName,
      "--profile",
      profile,
      "--region",
      region,
    ],
    stdout: "piped",
    stderr: "piped",
  })

  const {code, stdout, stderr} = await command.output()
  if (code !== 0 || stderr.length > 0) {
    throw new Error(new TextDecoder().decode(stderr))
  }

  return JSON.parse(new TextDecoder().decode(stdout))
}
