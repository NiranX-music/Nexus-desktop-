import { IpcMain, App } from 'electron'
import fs from 'fs'
import path from 'path'

export interface KnowledgeTriple {
  id: string
  subject: string
  predicate: string
  object: string
  confidence: number
  context?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export interface KnowledgeGraphQuery {
  subject?: string
  predicate?: string
  object?: string
  query?: string
  tag?: string
  limit?: number
}

export interface GraphSummary {
  totalFacts: number
  uniqueSubjects: number
  uniquePredicates: number
  recentFacts: KnowledgeTriple[]
}

export class CognitiveKnowledgeGraph {
  private triples: Map<string, KnowledgeTriple> = new Map()
  private storagePath: string
  private saveDebounceTimer: NodeJS.Timeout | null = null

  constructor(app: App) {
    const kgDir = path.resolve(app.getPath('userData'), 'KnowledgeGraph')
    if (!fs.existsSync(kgDir)) {
      fs.mkdirSync(kgDir, { recursive: true })
    }
    this.storagePath = path.join(kgDir, 'knowledge_graph.json')
    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf-8')
        if (raw.trim()) {
          const parsed: KnowledgeTriple[] = JSON.parse(raw)
          this.triples.clear()
          for (const item of parsed) {
            if (item.id && item.subject && item.predicate) {
              this.triples.set(item.id, item)
            }
          }
        }
      }
    } catch (err) {
      console.error('[KnowledgeGraph] Failed to load triples from disk:', err)
    }
  }

  private persist(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
    }
    this.saveDebounceTimer = setTimeout(() => {
      try {
        const arr = Array.from(this.triples.values())
        const tempPath = `${this.storagePath}.tmp`
        fs.writeFileSync(tempPath, JSON.stringify(arr, null, 2), 'utf-8')
        fs.renameSync(tempPath, this.storagePath)
      } catch (err) {
        console.error('[KnowledgeGraph] Failed to persist triples:', err)
      }
    }, 400)
  }

  public upsertFact(payload: {
    subject: string
    predicate: string
    object: string
    confidence?: number
    context?: string
    tags?: string[]
  }): KnowledgeTriple {
    const sub = payload.subject.trim()
    const pred = payload.predicate.trim().toLowerCase()
    const obj = payload.object.trim()
    const conf = Math.max(0, Math.min(1, payload.confidence ?? 1.0))
    const now = Date.now()

    // Check if matching triple exists
    for (const triple of this.triples.values()) {
      if (
        triple.subject.toLowerCase() === sub.toLowerCase() &&
        triple.predicate.toLowerCase() === pred
      ) {
        triple.object = obj
        triple.confidence = conf
        triple.updatedAt = now
        if (payload.context) triple.context = payload.context
        if (payload.tags) triple.tags = payload.tags
        this.persist()
        return triple
      }
    }

    // New triple
    const id = `kg_${now}_${Math.random().toString(36).slice(2, 7)}`
    const newTriple: KnowledgeTriple = {
      id,
      subject: sub,
      predicate: pred,
      object: obj,
      confidence: conf,
      context: payload.context,
      tags: payload.tags || [],
      createdAt: now,
      updatedAt: now
    }

    this.triples.set(id, newTriple)
    this.persist()
    return newTriple
  }

  public query(query: KnowledgeGraphQuery): KnowledgeTriple[] {
    const qSub = query.subject?.toLowerCase()
    const qPred = query.predicate?.toLowerCase()
    const qObj = query.object?.toLowerCase()
    const qText = query.query?.toLowerCase()
    const qTag = query.tag?.toLowerCase()
    const limit = query.limit || 50

    const results: KnowledgeTriple[] = []

    for (const t of this.triples.values()) {
      if (qSub && !t.subject.toLowerCase().includes(qSub)) continue
      if (qPred && !t.predicate.toLowerCase().includes(qPred)) continue
      if (qObj && !t.object.toLowerCase().includes(qObj)) continue
      if (qTag && (!t.tags || !t.tags.some((tag) => tag.toLowerCase() === qTag))) continue

      if (qText) {
        const match =
          t.subject.toLowerCase().includes(qText) ||
          t.predicate.toLowerCase().includes(qText) ||
          t.object.toLowerCase().includes(qText) ||
          (t.context && t.context.toLowerCase().includes(qText))
        if (!match) continue
      }

      results.push(t)
    }

    // Sort by recent update first
    results.sort((a, b) => b.updatedAt - a.updatedAt)
    return results.slice(0, limit)
  }

  public getRelated(entity: string): {
    entity: string
    outbound: KnowledgeTriple[]
    inbound: KnowledgeTriple[]
    connectedEntities: string[]
  } {
    const e = entity.toLowerCase().trim()
    const outbound: KnowledgeTriple[] = []
    const inbound: KnowledgeTriple[] = []
    const connectedSet = new Set<string>()

    for (const t of this.triples.values()) {
      if (t.subject.toLowerCase() === e) {
        outbound.push(t)
        connectedSet.add(t.object)
      } else if (t.object.toLowerCase() === e) {
        inbound.push(t)
        connectedSet.add(t.subject)
      }
    }

    return {
      entity,
      outbound,
      inbound,
      connectedEntities: Array.from(connectedSet)
    }
  }

  public deleteFact(idOrSubject: string, predicate?: string): boolean {
    if (this.triples.has(idOrSubject)) {
      this.triples.delete(idOrSubject)
      this.persist()
      return true
    }

    let deleted = false
    const sub = idOrSubject.toLowerCase()
    const pred = predicate?.toLowerCase()

    for (const [id, t] of this.triples.entries()) {
      if (t.subject.toLowerCase() === sub) {
        if (!pred || t.predicate.toLowerCase() === pred) {
          this.triples.delete(id)
          deleted = true
        }
      }
    }

    if (deleted) this.persist()
    return deleted
  }

  public getSummary(): GraphSummary {
    const subjects = new Set<string>()
    const predicates = new Set<string>()
    const all = Array.from(this.triples.values())

    for (const t of all) {
      subjects.add(t.subject.toLowerCase())
      predicates.add(t.predicate.toLowerCase())
    }

    all.sort((a, b) => b.updatedAt - a.updatedAt)

    return {
      totalFacts: all.length,
      uniqueSubjects: subjects.size,
      uniquePredicates: predicates.size,
      recentFacts: all.slice(0, 10)
    }
  }
}

export default function registerKnowledgeGraph({ ipcMain, app }: { ipcMain: IpcMain; app: App }) {
  const kg = new CognitiveKnowledgeGraph(app)

  ipcMain.handle('kg:upsert-fact', (_event, payload) => {
    try {
      const fact = kg.upsertFact(payload)
      return { success: true, fact }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  })

  ipcMain.handle('kg:query', (_event, query: KnowledgeGraphQuery) => {
    try {
      return { success: true, facts: kg.query(query || {}) }
    } catch (err: any) {
      return { success: false, facts: [], error: err?.message || String(err) }
    }
  })

  ipcMain.handle('kg:get-related', (_event, entity: string) => {
    try {
      return { success: true, ...kg.getRelated(entity) }
    } catch (err: any) {
      return { success: false, outbound: [], inbound: [], connectedEntities: [], error: err?.message || String(err) }
    }
  })

  ipcMain.handle('kg:delete-fact', (_event, idOrSubject: string, predicate?: string) => {
    try {
      const success = kg.deleteFact(idOrSubject, predicate)
      return { success }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  })

  ipcMain.handle('kg:summary', () => {
    try {
      return { success: true, summary: kg.getSummary() }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  })
}
