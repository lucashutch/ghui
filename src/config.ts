const parsePositiveInt = (value: string | undefined, fallback: number) => {
	const parsed = Number.parseInt(value ?? "", 10)
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
	author: process.env.GHUI_AUTHOR?.trim() || "@me",
	prFetchLimit: parsePositiveInt(process.env.GHUI_PR_FETCH_LIMIT, 200),
} as const
