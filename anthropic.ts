import Anthropic from 'npm:@anthropic-ai/sdk@0.29.0'
import {prompts, PromptType} from "./prompts.ts"
import {ReadConfig, UpdateCurrentChat, WriteConfig, type CurrentChat} from "./utils.ts"
import {Stream} from "npm:@anthropic-ai/sdk@0.29.0/streaming"
import {RawMessageStreamEvent} from "npm:@anthropic-ai/sdk@0.27.3/resources/messages"

let currentChat: CurrentChat | null = null



type modelType = keyof typeof modelMapping

const modelMapping = {
    "claude-3-haiku": 'claude-3-haiku-20240307',
    'claude-3-sonnet': 'claude-3-sonnet-20240229',
    'claude-3-opus': 'claude-3-opus-20240229',
    'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
    'claude-3.5-sonnet-legacy': 'claude-3-5-sonnet-20240620',
    'claude-3.5-sonnet-latest': 'claude-3-5-sonnet-latest',
    'haiku-3': 'claude-3-haiku-20240307',
    'sonnet-3': 'claude-3-sonnet-20240229',
    'opus-3': 'claude-3-opus-20240229',
    'sonnet-3.5': 'claude-3-5-sonnet-20241022',
    'sonnet-3.5-legacy': 'claude-3-5-sonnet-20240620',
    'sonnet-3.5-latest': 'claude-3-5-sonnet-latest',
}
function getClient() {
    const config = ReadConfig()
    return new Anthropic({
        apiKey: config?.anthropicKey, // This is the default and can be omitted
    })
}

function getModelPerPromptType(promptType?: PromptType): string {
    switch (promptType) {
        case PromptType.WEAK:
            return 'claude-3-haiku-20240307'
        case PromptType.MIDDLE:
            return 'claude-3-opus-20240229'
        case PromptType.STRONG:
            return 'claude-3-5-sonnet-20241022'
        default:
            return 'claude-3-haiku-20240307'
    }
}

export async function figuringOutIaC(projectLayout: string, stream: boolean = true, isVerbose: boolean = false) {
    const prompt = prompts.figuringOutIac
    const modelId = getModelPerPromptType(prompt.defaultModel)
    const systemPrompt = prompt.prompt
    const userPrompt = `<ProjectLayout>${projectLayout}</ProjectLayout>`
    return await generateAIResponse(modelId, systemPrompt, userPrompt, stream, isVerbose)
}

export async function figuringOutResources(iacFilesContent: string, stage: string, stream: boolean = true, isVerbose: boolean = false) {
    const prompt = prompts.figuringOutResources
    const modelId = getModelPerPromptType(prompt.defaultModel)
    const systemPrompt = prompt.prompt
    const userPrompt = `<IaCFilesContent>${iacFilesContent}</IaCFilesContent>\n<Stage>${stage}</Stage>`
    return await generateAIResponse(modelId, systemPrompt, userPrompt, stream, isVerbose)
}

export async function figuringOutStackName(iacFilesContent: string, stage: string, stream: boolean = true, isVerbose: boolean = false) {
    const prompt = prompts.figuringOutStackName
    const modelId = getModelPerPromptType(prompt.defaultModel)
    const systemPrompt = prompt.prompt
    const userPrompt = `<ServerlessConfig>${iacFilesContent}</ServerlessConfig>\n<Stage>${stage}</Stage>`
    return await generateAIResponse(modelId, systemPrompt, userPrompt, stream, isVerbose)
}

async function generateAIResponse(modelId: string, systemPrompt: string, userPrompt: string, stream: boolean = true, isVerbose: boolean = false) {
    const client = getClient()

    if (isVerbose) {
        console.log(JSON.stringify({
            level: "info",
            message: "Generating AI Response",
            modelId,
            systemPrompt,
            userPrompt
        }))
    }

    const response = await client.messages.create({
        max_tokens: 1024,
        model: modelId,
        system: systemPrompt,
        messages: [
            {
                role: 'user',
                content: userPrompt
            }
        ],
        stream: stream
    })

    if (isVerbose) {
        console.log(JSON.stringify({
            level: "info",
            message: "Response received from Anthropic API"
        }))
    }

    if (stream) {
        if (isVerbose) {
            console.log(JSON.stringify({
                level: "info",
                message: "Streaming response"
            }))
        }
        return convertStreamToStringStream(response as Stream<RawMessageStreamEvent>, isVerbose)
    } else {
        const message = response as Anthropic.Message

        if (message.stop_reason === 'tool_use') {
            if (isVerbose) {
                console.log(JSON.stringify({
                    level: "info",
                    message: "Tool use detected in response"
                }))
            }
            const toolContent = message.content.find(contentData => contentData.type === 'tool_use')
            if (toolContent) {
                const result = JSON.stringify(toolContent.input)
                if (isVerbose) {
                    console.log(JSON.stringify({
                        level: "info",
                        message: "Tool use content",
                        content: result
                    }))
                }
                return result
            } else {
                if (isVerbose) {
                    console.log(JSON.stringify({
                        level: "info",
                        message: "No tool content found"
                    }))
                }
                return ""
            }
        }
        const data = message.content.filter(content => content.type === 'text').map(content => content.text).join("\n")
        if (isVerbose) {
            console.log(JSON.stringify({
                level: "info",
                message: "Response data",
                data
            }))
        }
        return data
    }
}
export async function figuringOutCommands(resourceList: string, userQuery: string,
    profile: string, region: string, stackName: string, existingStack: string, stream: boolean = true, isVerbose: boolean = false) {
    const prompt = prompts.figuringOutCommands
    const modelId = getModelPerPromptType(prompt.defaultModel)
    const systemPrompt = prompt.prompt
    const userPrompt = `<ExistingStack>${existingStack}</ExistingStack><StackName>${stackName}</StackName><ResourceList>${resourceList}</ResourceList>\n<UserQuery>${userQuery}</UserQuery>, <Profile>${profile}</Profile>, <Region>${region}</Region>`

    // Save the current chat configuration
    currentChat = {
        systemPrompt: systemPrompt,
        modelId: modelId
    }

    if (isVerbose) {
        console.log(JSON.stringify({
            level: "info",
            message: "Current chat configuration saved",
            currentChat
        }))
    }

    const aiResponse = await generateAIResponse(modelId, systemPrompt, userPrompt, stream, isVerbose)
    UpdateCurrentChat(currentChat)
    return aiResponse
}

export async function explainingOutput(userQuery: string, awsCliCommand: string, commandResponse: string, stream: boolean = true, isVerbose: boolean = false) {
    const prompt = prompts.explainingOutput
    const modelId = getModelPerPromptType(prompt.defaultModel)
    const systemPrompt = prompt.prompt
    const userPrompt = `<UserQuery>${userQuery}</UserQuery>\n<AwsCliCommand>${awsCliCommand}</AwsCliCommand>\n<CommandResponse>${commandResponse}</CommandResponse>`
    return await generateAIResponse(modelId, systemPrompt, userPrompt, stream, isVerbose)
}

export async function continueConversation(userMessages: Array<{role: "user" | "assistant", content: string}>, stream: boolean = true, isVerbose: boolean = false) {
    const client = getClient()
    const config = ReadConfig()
    if (!config.currentChat) {
        console.log('no current chat')
        throw new Error("No current chat found. Please run figuringOutCommands first.")
    }
    const {systemPrompt, modelId} = config.currentChat ?? {}

    if (isVerbose) {
        console.log(JSON.stringify({
            level: "info",
            message: "Continuing Conversation",
            modelId,
            systemPrompt,
            userMessages
        }))
    }
    const response = await client.messages.create({
        max_tokens: 8192,
        model: modelId,
        system: systemPrompt,
        messages: userMessages,
        stream: stream
    })

    if (isVerbose) {
        console.log(JSON.stringify({
            level: "info",
            message: "Response received from Anthropic API"
        }))
    }

    if (stream) {
        if (isVerbose) {
            console.log(JSON.stringify({
                level: "info",
                message: "Streaming response"
            }))
        }
        return convertStreamToStringStream(response as Stream<RawMessageStreamEvent>, isVerbose)
    } else {
        const message = response as Anthropic.Message

        if (message.stop_reason === 'tool_use') {
            if (isVerbose) {
                console.log(JSON.stringify({
                    level: "info",
                    message: "Tool use detected in response"
                }))
            }
            const toolContent = message.content.find(contentData => contentData.type === 'tool_use')
            if (toolContent) {
                const result = JSON.stringify(toolContent.input)
                if (isVerbose) {
                    console.log(JSON.stringify({
                        level: "info",
                        message: "Tool use content",
                        content: result
                    }))
                }
                return result
            } else {
                if (isVerbose) {
                    console.log(JSON.stringify({
                        level: "info",
                        message: "No tool content found"
                    }))
                }
                return ""
            }
        }
        const data = message.content.filter(content => content.type === 'text').map(content => content.text).join("\n")
        if (isVerbose) {
            console.log(JSON.stringify({
                level: "info",
                message: "Response data",
                data
            }))
        }
        return data
    }
}

async function* convertStreamToStringStream(response: Stream<RawMessageStreamEvent>,
    isVerbose: boolean): AsyncIterable<string> {
    if (isVerbose) {
        console.log(JSON.stringify({
            level: "info",
            message: "Starting to process stream"
        }))
    }
    for await (const chunk of response) {
        if (chunk.type === 'content_block_delta') {
            if (chunk.delta.type === 'text_delta') {
                if (isVerbose) {
                    console.log(JSON.stringify({
                        level: "info",
                        message: "Received chunk",
                        chunk: chunk.delta.text
                    }))
                }
                yield chunk.delta.text
            }
        }
        yield ""
    }
    if (isVerbose) {
        console.log(JSON.stringify({
            level: "info",
            message: "Finished processing stream"
        }))
    }
}

