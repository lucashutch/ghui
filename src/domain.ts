export type PullRequestState = "open" | "closed" | "merged"

export const pullRequestQueueModes = ["authored", "review", "assigned", "mentioned"] as const

export type PullRequestQueueMode = typeof pullRequestQueueModes[number]

export const pullRequestQueueLabels = {
	authored: "authored",
	review: "review requested",
	assigned: "assigned",
	mentioned: "mentioned",
} as const satisfies Record<PullRequestQueueMode, string>

export const pullRequestQueueSearchQualifier = (mode: PullRequestQueueMode, author: string) => {
	const qualifiers = {
		authored: `author:${author}`,
		review: "review-requested:@me",
		assigned: "assignee:@me",
		mentioned: "mentions:@me",
	} as const satisfies Record<PullRequestQueueMode, string>
	return qualifiers[mode]
}

export type CheckConclusion = "success" | "failure" | "neutral" | "skipped" | "cancelled" | "timed_out"

export interface CheckItem {
	readonly name: string
	readonly status: "completed" | "in_progress" | "queued" | "pending"
	readonly conclusion: CheckConclusion | null
}

export interface PullRequestLabel {
	readonly name: string
	readonly color: string | null
}

export type DiffCommentSide = "LEFT" | "RIGHT"

export interface CreatePullRequestCommentInput {
	readonly repository: string
	readonly number: number
	readonly commitId: string
	readonly path: string
	readonly line: number
	readonly side: DiffCommentSide
	readonly body: string
}

export interface PullRequestReviewComment {
	readonly id: string
	readonly path: string
	readonly line: number
	readonly side: DiffCommentSide
	readonly author: string
	readonly body: string
	readonly createdAt: Date | null
	readonly url: string | null
}

export interface PullRequestItem {
	readonly repository: string
	readonly author: string
	readonly headRefOid: string
	readonly number: number
	readonly title: string
	readonly body: string
	readonly labels: readonly PullRequestLabel[]
	readonly additions: number
	readonly deletions: number
	readonly changedFiles: number
	readonly state: PullRequestState
	readonly reviewStatus: "draft" | "approved" | "changes" | "review" | "none"
	readonly checkStatus: "passing" | "pending" | "failing" | "none"
	readonly checkSummary: string | null
	readonly checks: readonly CheckItem[]
	readonly autoMergeEnabled: boolean
	readonly detailLoaded: boolean
	readonly createdAt: Date
	readonly closedAt: Date | null
	readonly url: string
}

export interface PullRequestMergeInfo {
	readonly repository: string
	readonly number: number
	readonly title: string
	readonly state: PullRequestState
	readonly isDraft: boolean
	readonly mergeable: "mergeable" | "conflicting" | "unknown"
	readonly reviewStatus: PullRequestItem["reviewStatus"]
	readonly checkStatus: PullRequestItem["checkStatus"]
	readonly checkSummary: string | null
	readonly autoMergeEnabled: boolean
}

export type PullRequestMergeAction = "squash" | "auto" | "admin" | "disable-auto"
