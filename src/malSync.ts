import { requestUrl } from 'obsidian'

const AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize'
const API_BASE = 'https://api.myanimelist.net/v2'

export interface MalEntry {
    mediaId: number;
    title: string; 
    progress: number;
    status: string;
    score: number;
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
	return { verifier, challenge: verifier }
}

export async function generatePKCEAsync(): Promise<{ verifier: string; challenge: string }> {
	const verifier = generateVerifier(128)
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
	try {
		const safeStatus = status || 'plan_to_watch'
		const safeProgress = Math.max(0, Number(progress) || 0)

		const body = new URLSearchParams({
			status: safeStatus,
			num_watched_episodes: String(safeProgress)
		})

		if (score !== null && score !== undefined && score > 0) {
			body.append('score', String(score))
		}

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

		if (resp.status !== 200) {
			console.error(`Library: MAL push failed for ID ${animeId} [HTTP ${resp.status}]:`, resp.text)
			return false
		}

		return true

	} catch (error) {
		console.error('Library: Exception in pushMalEntry:', error)
		return false
	}
}

export async function fetchMalList(token: string): Promise<MalEntry[]> {
    const entries: MalEntry[] = [];
    
    let url: string = `${API_BASE}/users/@me/animelist?fields=list_status,alternative_titles&limit=100`;

    while (url) {
        const resp = await requestUrl({
            url,
            headers: { Authorization: `Bearer ${token}` },
            throw: false
        });

        if (resp.status !== 200) break;

        const data = resp.json as {
            data: {
                node: {
                    id: number;
                    title: string;
                    alternative_titles?: {
                        synonyms?: string[];
                        en?: string;
                        ja?: string;
                    };
                };
                list_status?: {
                    status?: MalListStatus;
                    score?: number;
                    num_episodes_watched?: number;
                };
            }[];
            paging?: { next?: string };
        };

        for (const item of data.data) {
            const romajiTitle = item.node.alternative_titles?.synonyms?.[0] 
                ?? item.node.title;

            entries.push({
                mediaId: item.node.id,
                title: romajiTitle, 
                progress: item.list_status?.num_episodes_watched ?? 0,
                status: item.list_status?.status ?? "",
                score: item.list_status?.score ?? 0
            });
        }

        url = data.paging?.next || "";
    }

    return entries;
}

export function malListStatus(complete: boolean, watched: number): MalListStatus {
	if (complete) return 'completed'
	if (watched > 0) return 'watching'
	return 'plan_to_watch'
}