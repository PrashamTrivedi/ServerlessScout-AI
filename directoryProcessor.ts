import {extname} from "https://deno.land/std@0.224.0/path/extname.ts"
import {join} from "https://deno.land/std@0.224.0/path/join.ts"
import {relative} from "https://deno.land/std@0.224.0/path/relative.ts"
import ignore from "npm:ignore"

const pathsToIgnore = ['.git']
const extentionsToSkipContent = ['.jpg', '.jpeg', '.png', '.gif', '.ico', '.mp4', '.svg', '.pdf', '.doc', '.db', '.sqlite', '.docx', '.xls', '.xlsx']

export interface FileNode {
    name: string
    content: string | undefined | null
    children?: FileNode[]
}

export async function getDirStructure(dirPath: string, otherIgnorePaths: string[], verbose: boolean = false) {
    try {
        const gitignorePath = `${dirPath}/.gitignore`
        const gitignoreStats = await Deno.stat(gitignorePath)
        if (gitignoreStats.isFile) {
            const gitIgnore = Deno.readTextFileSync(gitignorePath)
                .split('\n')
                .filter(line => !line.startsWith('#') && line !== '')
            pathsToIgnore.push(...gitIgnore)
        }
    } catch (error) {
        // .gitignore file doesn't exist, do nothing
        if (verbose) {
            console.error(error)
        }
    }

    if (verbose) {
        console.log({otherIgnorePaths})
    }
    if (otherIgnorePaths.length > 0) {
        pathsToIgnore.push(...otherIgnorePaths)
    }
    if (verbose) {
        console.log(pathsToIgnore)
    }

    const ig = ignore.default({
        allowRelativePaths: true,
        ignoreCase: true,
        ignorecase: true,
    }).add(pathsToIgnore)

    function matchesWildcard(path: string, pattern: string): boolean {
        const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
        const regex = new RegExp(`^${regexPattern}$`)
        return regex.test(path)
    }

    function customIgnores(path: string): boolean {
        if (path.includes('node_modules')) return true
        return pathsToIgnore.some(ignoredPath => {
            if (ignoredPath.includes('*') || ignoredPath.includes('?')) {
                return matchesWildcard(path, ignoredPath)
            }
            if (ignoredPath.endsWith('/')) {
                return path.startsWith(ignoredPath) || path === ignoredPath.slice(0, -1)
            }
            return path === ignoredPath || path.startsWith(`${ignoredPath}/`)
        })
    }

    function getJsonFromDirectory(dirPath: string): FileNode | undefined {
        const rootFile: string = dirPath.split('/').pop() || ''
        const dirPathWithoutRootDir: string = dirPath.substring(dirPath.indexOf('/') + 1)
        if (verbose) console.log({dirPath, dirPathWithoutRootDir, ignoresRoot: customIgnores(dirPathWithoutRootDir), ignores: customIgnores(dirPath)})
        if (customIgnores(`${rootFile}/`) || customIgnores(rootFile) || customIgnores(`${dirPathWithoutRootDir}/`)) {
            return undefined
        }

        const result: FileNode = {
            name: rootFile,
            content: null,
            children: []
        }

        // Check if the current directory is 'node_modules'
        if (rootFile === 'node_modules') {
            return undefined
        }

        // Check for .gitignore in the current directory
        const gitignorePath: string = join(dirPath, '.gitignore')
        try {
            if (Deno.statSync(gitignorePath).isFile) {
                const gitignoreContent: string = Deno.readTextFileSync(gitignorePath)
                ig.add(gitignoreContent.split('\n')) // Add new rules to the ignore object
            }

        } catch (error) {
            if (verbose) {
                console.error(error)
            }
        }

        const files: string[] = Array.from(Deno.readDirSync(dirPath)).map((file: Deno.DirEntry) => file.name)


        for (const file of files) {
            const fullPath: string = `${dirPath}/${file}`
            const relativePath: string = relative(dirPath, fullPath)

            if (verbose) console.log({
                file, fullPath, relativePath, ignores: customIgnores(relativePath),
                fullPathIg: customIgnores(fullPath), dirPathIg: customIgnores(dirPath),
                fileIg: customIgnores(file)
            })
            if (customIgnores(relativePath)) {
                if (verbose) console.log({ignored: file})
                continue
            }

            const isDirectory: boolean = Deno.statSync(fullPath).isDirectory
            if (isDirectory) {
                const dirChildren = getJsonFromDirectory(fullPath)
                if (dirChildren && dirChildren.children && dirChildren.children.length > 0) {
                    result.children?.push(dirChildren)
                }
            } else {
                const fileExtension: string = extname(file).toLowerCase()

                if (extentionsToSkipContent.includes(fileExtension)) {
                    result.children?.push({name: file, content: null})
                } else {
                    const fileContent: string = Deno.readTextFileSync(fullPath)
                    result.children?.push({name: file, content: fileContent})
                }
            }
        }

        return result.children && result.children.length > 0 ? result : undefined
    }



    const dirToReturn = getJsonFromDirectory(dirPath)

    if (verbose) {
        console.log({dirToReturn})
        console.log({dirs: JSON.stringify(dirToReturn)})
    }


    return dirToReturn
}
