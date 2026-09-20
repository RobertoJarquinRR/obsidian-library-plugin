import { requestUrl } from 'obsidian'

const AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize'
const API_BASE = 'https://api.myanimelist.net/v2'

export interface MalEntry {
	mediaId: number
	progress: number
	status: string
	score: number
}

export type MalListStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch'

function generateVerifier(length: number = 128): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	const charArray = chars.split('')
	const bytes = crypto.getRandomValues(new Uint8Array(length))
	let result = ''
	for (let i = 0; i < length; i++) {
		// @ts-expect-error - charArray[index] is always valid for our alphabet
		result += charArray[bytes[i] % charArray.length]
	}
	return result
}

export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
	const verifier = generateVerifier(128)
	// For 'plain' method, challenge = verifier (no hashing)
	return { verifier, challenge: verifier }
}

export async function generatePKCEAsync(): Promise<{ verifier: string; challenge: string }> {
	const verifier = generateVerifier(128)
	// For 'plain' method, challenge = verifier (no hashing)
	return { verifier, challenge: verifier }
}

export function malAuthUrl(clientId: string, challenge: string): string {
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		code_challenge: challenge,
		code_challenge_method: 'plain',
		state: crypto.randomUUID()
	})
	return `${AUTH_URL}?${params.toString()}`
}

export async function malViewer(token: string): Promise<{ id: number; name: string } | null> {
	const resp = await requestUrl({
		url: `${API_BASE}/users/@me`,
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
		throw: false
	})
	if (resp.status !== 200) return null
	return resp.json as { id: number; name: string }
}

export async function pushMalEntry(
	token: string,
	animeId: number,
	progress: number,
	status: MalListStatus,
	score: number | null
): Promise<boolean> {
	const body = new URLSearchParams({
		status,
		num_episodes_watched: String(progress)
	})
	if (score != null) body.append('score', String(score))

	const resp = await requestUrl({
		url: `${API_BASE}/anime/${animeId}/my_list_status`,
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: body.toString(),
		throw: false
	})
	return resp.status === 200
}

export async function fetchMalList(token: string): Promise<MalEntry[]> {
	const entries: MalEntry[] = []
	let url = `${API_BASE}/users/@me/animelist?fields=list_status&limit=1000`

	while (url) {
		const resp = await requestUrl({
			url,
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
			throw: false
		})
		if (resp.status !== 200) break
		const data = resp.json as {
			data: {
				node: { id: number };
				list_status?: { status: MalListStatus; score: number; num_episodes_watched: number };
			}[];
			paging?: { next: string };
		};
		for (const item of data.data) {
			entries.push({
				mediaId: item.node.id,
				progress: item.list_status?.num_episodes_watched ?? 0,
				status: item.list_status?.status ?? "",
				score: item.list_status?.score ?? 0
			});
		}
		url = data.paging?.next || ''
	}
	return entries
}

export function malListStatus(complete: boolean, watched: number): MalListStatus {
	if (complete) return 'completed'
	if (watched > 0) return 'watching'
	return 'plan_to_watch'
}