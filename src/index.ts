import * as core from '@actions/core'
import * as github from '@actions/github'
import { PullRequest, PullRequestEvent } from '@octokit/webhooks-definitions/schema'
import { Octokit } from '@octokit/core'

main().catch(err => core.setFailed((err as Error).message))

async function main(){
    const context = github.context
    if(context.payload.pull_request === undefined){
        core.warning('This action is only meant to be run on pull requests. No PR found in the payload.')
        return
    }

    const client = github.getOctokit(core.getInput('github-token'))
    const prPayload = github.context.payload as PullRequestEvent
    const primaryBranch = core.getInput('primary-branch')
    const [abovePrs, belowPrs] = await Promise.all([
        fetchRelatedPRs(client, prPayload, primaryBranch, 'up'), 
        fetchRelatedPRs(client, prPayload, primaryBranch, 'down')
    ])

    
    
}

async function fetchRelatedPRs(client: ReturnType<typeof github.getOctokit>, prEvent: PullRequestEvent, primaryBranch: string, direction: 'up' | 'down'){
    const listPRs = async (pr: PullRequest, ref: string) => {
        return await client.rest.pulls.list({
            owner: prEvent.repository.owner.login,
            repo: prEvent.repository.name,
            [direction === 'up' ? 'head' : 'base']: ref
        })
    }

    let relatedPRs: Array<PullRequest> = []
    let pr = prEvent.pull_request
    while((direction === 'up' ? pr.base.ref : pr.head.ref) !== primaryBranch){
        const prResponse = await listPRs(pr, direction === 'up' ? pr.base.ref : pr.head.ref)
        if (prResponse.data.length === 0){
            throw new Error(`No ${direction} PR found for ${(direction === 'up' ? pr.base.ref : pr.head.ref)}`)
        } else if (prResponse.data.length > 1){
            throw new Error(`Multiple ${direction} PRs found for ${(direction === 'up' ? pr.base.ref : pr.head.ref)}`)
        }
        pr = prResponse.data[0] as PullRequest
        relatedPRs.push(pr)
    }
    return relatedPRs
}

