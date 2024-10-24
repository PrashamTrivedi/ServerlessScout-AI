import {figuringOutCommands} from "./anthropic.ts"

export enum PromptType {
    WEAK = 'weak',
    STRONG = 'strong',
    MIDDLE = 'middle'
}

export type PromptData = {
    prompt: string
    defaultModel?: PromptType
}

export const prompts: Record<string, PromptData> = {
    figuringOutIac: {
        prompt: `Above is a project layout of aws serverless project in <ProjectLayout> tag. 
        Tell me the names files handling IaC in this project. 
        Give me only comma separated file names without any backtick or quotes. 
        Those files can be serverless.yml, CDK files or terraform files in TF`,
        defaultModel: PromptType.WEAK
    },
    figuringOutStackName: {
        prompt:
            `Infer the cloudformation stack name from this serverless configuration file in <ServerlessConfig> tag for given stage in <Stage> tag.
            Consider it has already been deployed on given staggeg. 
            Only give me stack name and nothing else. No yapping`,
        defaultModel: PromptType.WEAK
    },
    figuringOutResources: {
        prompt: `Based on the content of IaC files provided in <IaCFilesContent> tag, list out all the resources created by this IaC.
        Each file's content is enclosed in XML tags with the file name as the tag name.
        I only need the names mentioned in the file and actual names of the resources as if the stack managed by IaC files are already deployed in given stage.
        If it requires stage-specific mention, you have the Stage name provided in <Stage> tag.
        E.g. UserPhotosBucket: user-photos-dev
        Pay attention to the file names and their hierarchies as indicated by the XML tags.
        Give me only resources, this output will be passed in next prompt, so make sure we don't pass anything which confuses the LLM.No yapping.`,
        defaultModel: PromptType.STRONG
    },
    figuringOutCommands: {
        prompt: `You have resources list in <ResourceList> tag. 
        Existing deployed cloudformation stack in <ExistingStack> tag.
        Stack resources in <StackResources> tag.
        And you will have user query in <UserQuery> tag. 
        Based on Resources, existing stack, stack resources, and Query, answer the question of user, default to answer from existing resources
        if you think an aws CLI command will give more clarity, respond with cli command to help answer the query, 
        the user will run the command and provide you the answer. If you are creating CLI Command, start with command: text otherwise start with answer: text your 
        your response must always start with either of these two words and nothing else.
        Try to answer with existing resources, but be open to create a command to run it. 
        Sometimes it's better to use existing data to answer the user, sometimes it's command. Decide it yourself and provide the answer accordingly
        When creating AWS CLI Command, it should always return JSON output and should use given profile in <Profile> tag and <Region>. 
        User is working on wsl2, uses fish shell and has jq installed, use it to generate your commands`,
        defaultModel: PromptType.STRONG
    },
    figuringOutOriginal: {
        prompt: `You have resources list in <ResourceList> tag. 
        And you will have user query in <UserQuery> tag. 
        First, based on user query, list relevant resources in <RelevantResources> tag. 
        And based on that answer, create aws cli command in <AwsCliCommand> tag.
        This AWS ClI Command should always return JSON output. 
        Your output should always be the AWS Command and nothing else. No yapping`,
        defaultModel: PromptType.STRONG
    },
    explainingOutput: {
        prompt: `You have following things with you.
        User query in <UserQuery> tag. 
        Aws cli command in <AwsCliCommand> tag.
        An tool earlier has run the command and it's response is in <CommandResponse> tag.
        Explain the output of this command in <OutputExplanation> tag such a way that it answers user query.`,
        defaultModel: PromptType.STRONG
    },
}
