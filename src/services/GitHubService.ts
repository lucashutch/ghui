import { config } from "../config.js"
import type { CheckItem, PullRequestItem, PullRequestLabel } from "../domain.js"
import { run, runJson } from "./CommandRunner.js"

interface GitHubListPullRequest {
	readonly number: number
	readonly title: string
	readonly body: string
	readonly labels: readonly {
		readonly name: string
		readonly color?: string | null
	}[]
	readonly isDraft: boolean
	readonly reviewDecision: string
	readonly statusCheckRollup: readonly {
		readonly name?: string | null
		readonly context?: string | null
		readonly status?: string | null
		readonly conclusion?: string | null
		readonly state?: string | null
	}[]
	readonly state: string
	readonly createdAt: string
	readonly closedAt?: string | null
	readonly url: string
}

interface GitHubSearchPullRequest {
	readonly number: number
	readonly repository: {
		readonly nameWithOwner: string
	}
}

interface GitHubViewer {
	readonly login: string
}

const searchJsonFields = "repository,number"
const detailJsonFields = "number,title,body,labels,isDraft,reviewDecision,statusCheckRollup,state,createdAt,closedAt,url"

const normalizeDate = (value: string | null | undefined) => {
	if (!value || value.startsWith("0001-01-01")) return null
	return new Date(value)
}

const getReviewStatus = (item: GitHubListPullRequest): PullRequestItem["reviewStatus"] => {
	if (item.isDraft) return "draft"
	if (item.reviewDecision === "APPROVED") return "approved"
	if (item.reviewDecision === "CHANGES_REQUESTED") return "changes"
	if (item.reviewDecision === "REVIEW_REQUIRED") return "review"
	return "none"
}

const normalizeCheckStatus = (raw?: string | null): CheckItem["status"] => {
	if (raw === "COMPLETED") return "completed"
	if (raw === "IN_PROGRESS") return "in_progress"
	if (raw === "QUEUED") return "queued"
	return "pending"
}

const normalizeCheckConclusion = (raw?: string | null): CheckItem["conclusion"] => {
	if (raw === "SUCCESS") return "success"
	if (raw === "FAILURE" || raw === "ERROR") return "failure"
	if (raw === "NEUTRAL") return "neutral"
	if (raw === "SKIPPED") return "skipped"
	if (raw === "CANCELLED") return "cancelled"
	if (raw === "TIMED_OUT") return "timed_out"
	return null
}

const getCheckInfo = (item: GitHubListPullRequest): Pick<PullRequestItem, "checkStatus" | "checkSummary" | "checks"> => {
	if (item.statusCheckRollup.length === 0) {
		return { checkStatus: "none", checkSummary: null, checks: [] }
	}

	let completed = 0
	let successful = 0
	let pending = false
	let failing = false
	const checks: CheckItem[] = []

	for (const check of item.statusCheckRollup) {
		const name = check.name ?? check.context ?? "check"

		checks.push({
			name,
			status: normalizeCheckStatus(check.status),
			conclusion: normalizeCheckConclusion(check.conclusion),
		})

		if (check.status === "COMPLETED") {
			completed += 1
		} else {
			pending = true
		}

		if (check.conclusion === "SUCCESS" || check.conclusion === "NEUTRAL" || check.conclusion === "SKIPPED") {
			successful += 1
		} else if (check.conclusion && check.conclusion !== "SUCCESS") {
			failing = true
		}
	}

	if (pending) {
		return { checkStatus: "pending", checkSummary: `checks ${completed}/${item.statusCheckRollup.length}`, checks }
	}

	if (failing) {
		return { checkStatus: "failing", checkSummary: `checks ${successful}/${item.statusCheckRollup.length}`, checks }
	}

	return { checkStatus: "passing", checkSummary: `checks ${successful}/${item.statusCheckRollup.length}`, checks }
}

const parsePullRequest = (repository: string, item: GitHubListPullRequest): PullRequestItem => {
	const checkInfo = getCheckInfo(item)

	return {
		repository,
		number: item.number,
		title: item.title,
		body: item.body,
		labels: item.labels.map((label) => ({
			name: label.name,
			color: label.color ? `#${label.color}` : null,
		})),
		state: item.state.toLowerCase() === "open" ? "open" : "closed",
		reviewStatus: getReviewStatus(item),
		checkStatus: checkInfo.checkStatus,
		checkSummary: checkInfo.checkSummary,
		checks: checkInfo.checks,
		createdAt: new Date(item.createdAt),
		closedAt: normalizeDate(item.closedAt),
		url: item.url,
	}
}

const searchOpenArgs = (author: string) => [
	"search",
	"prs",
	"--author",
	author,
	"--state",
	"open",
	"--limit",
	String(config.prFetchLimit),
	"--sort",
	"created",
	"--order",
	"desc",
	"--json",
	searchJsonFields,
] as const

export const listOpenPullRequests = async (): Promise<readonly PullRequestItem[]> => {
	const searchResults = await runJson<readonly GitHubSearchPullRequest[]>("gh", [...searchOpenArgs(config.author)])
	const pullRequests = await Promise.all(
		searchResults.map(async (searchResult) => {
			const repository = searchResult.repository.nameWithOwner
			const pullRequest = await runJson<GitHubListPullRequest>("gh", [
				"pr", "view", String(searchResult.number), "--repo", repository, "--json", detailJsonFields,
			])
			return parsePullRequest(repository, pullRequest)
		}),
	)

	return pullRequests.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
}

export const getAuthenticatedUser = async () => {
	const viewer = await runJson<GitHubViewer>("gh", ["api", "user"])
	return viewer.login
}

export const toggleDraftStatus = async (repository: string, number: number, isDraft: boolean) => {
	await run("gh", ["pr", "ready", String(number), "--repo", repository, ...(isDraft ? [] : ["--undo"])])
}

export const listRepoLabels = async (repository: string): Promise<readonly PullRequestLabel[]> => {
	const labels = await runJson<readonly { name: string; color: string }[]>("gh", [
		"label", "list", "--repo", repository, "--json", "name,color", "--limit", "100",
	])
	return labels.map((label) => ({ name: label.name, color: `#${label.color}` }))
}

export const addPullRequestLabel = async (repository: string, number: number, label: string) => {
	await run("gh", ["pr", "edit", String(number), "--repo", repository, "--add-label", label])
}

export const removePullRequestLabel = async (repository: string, number: number, label: string) => {
	await run("gh", ["pr", "edit", String(number), "--repo", repository, "--remove-label", label])
}
