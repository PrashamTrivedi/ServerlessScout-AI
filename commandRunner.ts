
export async function executeAwsCommand(command: string, isVerbose: boolean): Promise<any> {
    if (isVerbose) {
        console.log(JSON.stringify({level: "info", message: "Executing AWS command", command, args: command.split(" ").splice}))
    }

    try {


        const commandOutput = new Deno.Command("sh", {
            args: ["-c", command],
            stdout: "piped",
            stderr: "piped",
        })

        const {code, stdout, stderr} = await commandOutput.output()
        const commandError = new TextDecoder().decode(stderr)
        const output = new TextDecoder().decode(stdout)

        if (code === 0) {
            if (isVerbose) {
                console.log(JSON.stringify({level: "info", message: "AWS command executed successfully", command, output}))
            }
            return JSON.parse(output)
        } else {

            throw new Error(`Command failed: ${commandError}`)
        }
    } catch (error) {
        if (isVerbose) {
            console.error(
                JSON.stringify({
                    level: "error",
                    message: "Error executing AWS command",
                    command,
                    details: (error instanceof Error ? error.message : String(error)),
                })
            )
        } else {
            console.error(
                JSON.stringify({
                    level: "error",
                    message: "Error executing AWS command",
                    command,
                    error: (error as Error).message,
                })
            )
        }
        throw error
    }
}
