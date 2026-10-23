export const SITE: string
export const LOCAL: string
export const SCENES: string
export const WINDOW: { x: number; y: number; w: number; h: number; bar: number }
export function narration(json: unknown): { text: string; times: number[]; at: (phrase: string, after?: string) => number; sentences: unknown[] }
export function plan(o: { edit: 'short' | 'long'; lang: 'zh' | 'en'; beats: number[]; vo: ReturnType<typeof narration> | null }): { shots: unknown[]; marks: Record<string, unknown>; duration: number }
