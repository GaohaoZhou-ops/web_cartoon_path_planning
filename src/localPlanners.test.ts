import { describe, expect, it } from 'vitest'
import { isContinuousEdgeFree, type Point, type Scenario } from './pathfinding'
import {
  createLocalPlannerState,
  stepLocalPlanner,
  type LocalPlannerId,
  type LocalPlannerStepResult,
} from './localPlanners'

const LOCAL_PLANNERS: LocalPlannerId[] = [
  'teb',
  'dwa',
  'vfh',
  'potential-field',
  'trajopt',
]

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    cols: 8,
    rows: 6,
    start: { x: 0, y: 0 },
    waypoints: [],
    end: { x: 7, y: 5 },
    obstacles: new Set(),
    allowDiagonal: true,
    preventCornerCutting: true,
    ...overrides,
  }
}

function finish(id: LocalPlannerId, map: Scenario, limit = 20_000) {
  const state = createLocalPlannerState(id, map.start!, map.end!, map)
  const trace: Array<{
    action: string
    metrics: LocalPlannerStepResult['metrics']
    visitedLength: number
  }> = []
  for (let step = 0; step < limit; step += 1) {
    const result = stepLocalPlanner(state, map)
    trace.push({
      action: result.action,
      metrics: { ...result.metrics },
      visitedLength: result.visited.length,
    })
    if (result.status !== 'running') return { result, trace }
  }
  throw new Error(`${id} did not settle within ${limit} steps`)
}

function expectSafeResult(result: LocalPlannerStepResult, map: Scenario) {
  expect(result.status).toBe('complete')
  const path = result.path!
  expect(path[0]).toEqual(map.start)
  expect(path[path.length - 1]).toEqual(map.end)
  let cost = 0
  for (let index = 1; index < path.length; index += 1) {
    expect(isContinuousEdgeFree(path[index - 1], path[index], map)).toBe(true)
    cost += Math.hypot(
      path[index].x - path[index - 1].x,
      path[index].y - path[index - 1].y,
    )
  }
  expect(result.pathCost).toBeCloseTo(cost, 8)
}

describe('static local planner adapters', () => {
  it('finishes deterministic collision-free paths for every adapter', () => {
    const map = scenario({
      obstacles: new Set(['2,1', '2,2', '2,3', '4,2', '5,2', '5,3', '5,4']),
    })
    for (const id of LOCAL_PLANNERS) {
      const first = finish(id, map)
      const second = finish(id, map)
      expectSafeResult(first.result, map)
      expect(first.result.path, id).toEqual(second.result.path)
      expect(first.result.pathCost, id).toBeCloseTo(second.result.pathCost!, 10)
      expect(first.trace.some((step) => step.action.includes('A* 参考线')), id).toBe(true)
      expect(first.trace.some((step) => step.action.includes(plannerToken(id))), id).toBe(true)
    }
  })

  it('reliably traverses a one-cell-wide S corridor', () => {
    const cols = 12
    const rows = 8
    const free = new Set<string>()
    for (let x = 0; x <= 8; x += 1) free.add(`${x},1`)
    for (let y = 1; y <= 5; y += 1) free.add(`8,${y}`)
    for (let x = 3; x <= 8; x += 1) free.add(`${x},5`)
    for (let y = 5; y <= 7; y += 1) free.add(`3,${y}`)
    for (let x = 3; x < cols; x += 1) free.add(`${x},7`)
    const obstacles = new Set<string>()
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) if (!free.has(`${x},${y}`)) obstacles.add(`${x},${y}`)
    }
    const map = scenario({
      cols,
      rows,
      start: { x: 0, y: 1 },
      end: { x: 11, y: 7 },
      obstacles,
    })

    for (const id of LOCAL_PLANNERS) {
      const completed = finish(id, map)
      expectSafeResult(completed.result, map)
      if (id === 'dwa' || id === 'vfh' || id === 'potential-field') {
        expect(completed.trace.some((step) => step.action.includes('安全恢复')), id).toBe(true)
      }
    }
  })

  it('fails sealed segments with an explicit no-path action', () => {
    const map = scenario({
      cols: 5,
      rows: 5,
      start: { x: 0, y: 2 },
      end: { x: 4, y: 2 },
      obstacles: new Set(['2,0', '2,1', '2,2', '2,3', '2,4']),
    })
    for (const id of LOCAL_PLANNERS) {
      const { result } = finish(id, map)
      expect(result.status, id).toBe('failed')
      expect(result.action, id).toContain('无可行路径')
      expect(result.path, id).toBeUndefined()
    }
  })

  it('keeps each tick bounded and reports delta rather than cumulative metrics', () => {
    const map = scenario({
      cols: 12,
      rows: 10,
      end: { x: 11, y: 9 },
      obstacles: new Set(['3,2', '3,3', '3,4', '6,5', '7,5', '8,5']),
    })
    for (const id of LOCAL_PLANNERS) {
      const { trace } = finish(id, map)
      for (const step of trace) {
        expect(step.metrics.expansions, id).toBeGreaterThanOrEqual(0)
        expect(step.metrics.expansions, id).toBeLessThanOrEqual(192)
        expect(step.metrics.generated, id).toBeGreaterThanOrEqual(0)
        expect(step.metrics.relaxations, id).toBeGreaterThanOrEqual(0)
        expect(step.metrics.openSize, id).toBeGreaterThanOrEqual(0)
        expect(step.visitedLength, id).toBeLessThanOrEqual(1)
      }
      expect(trace.some((step) => step.metrics.expansions > 0), id).toBe(true)
    }
  })

  it('completes seeded obstacle fields with a reserved feasible corridor', () => {
    let seed = 0x6d2b79f5
    const random = () => {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      return (seed >>> 0) / 2 ** 32
    }
    for (let sample = 0; sample < 12; sample += 1) {
      const obstacles = new Set<string>()
      for (let y = 0; y < 6; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const protectedCorridor = y === 0 || x === 7
          if (!protectedCorridor && random() < 0.3) obstacles.add(`${x},${y}`)
        }
      }
      const map = scenario({ obstacles })
      for (const id of LOCAL_PLANNERS) {
        const { result } = finish(id, map)
        expectSafeResult(result, map)
      }
    }
  })

  it('handles a zero-length leg without duplicate endpoints', () => {
    const map = scenario({ start: { x: 3, y: 2 }, end: { x: 3, y: 2 } })
    for (const id of LOCAL_PLANNERS) {
      const { result, trace } = finish(id, map)
      expect(result.status, id).toBe('complete')
      expect(result.path, id).toEqual([{ x: 3, y: 2 }])
      expect(result.pathCost, id).toBe(0)
      expect(trace).toHaveLength(1)
    }
  })

  it('lets TEB and TrajOpt smooth an open-space grid bend continuously', () => {
    const map = scenario({
      cols: 8,
      rows: 5,
      start: { x: 0, y: 0 },
      end: { x: 7, y: 4 },
    })
    for (const id of ['teb', 'trajopt'] as LocalPlannerId[]) {
      const { result } = finish(id, map)
      expectSafeResult(result, map)
      expect(
        result.path!.slice(1, -1).some(
          (point: Point) => !Number.isInteger(point.x) || !Number.isInteger(point.y),
        ),
        id,
      ).toBe(true)
    }
  })

  it('bounds APF local wandering before recovering on a large serpentine corridor', () => {
    const cols = 50
    const rows = 50
    const free = new Set<string>()
    let end: Point = { x: 0, y: 1 }
    for (let band = 0, y = 1; y < rows; band += 1, y += 2) {
      for (let x = 0; x < cols; x += 1) free.add(`${x},${y}`)
      const connectorX = band % 2 === 0 ? cols - 1 : 0
      end = { x: connectorX, y }
      if (y + 1 < rows) free.add(`${connectorX},${y + 1}`)
    }
    const obstacles = new Set<string>()
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) if (!free.has(`${x},${y}`)) obstacles.add(`${x},${y}`)
    }
    const map = scenario({
      cols,
      rows,
      start: { x: 0, y: 1 },
      end,
      obstacles,
    })

    const completed = finish('potential-field', map)
    expectSafeResult(completed.result, map)
    expect(completed.trace.length).toBeLessThan(2_000)
    expect(completed.trace.some((step) => step.action.includes('沿 A* 参考线安全恢复'))).toBe(
      true,
    )
  })
})

function plannerToken(id: LocalPlannerId) {
  return id === 'potential-field' ? 'APF' : id === 'trajopt' ? 'TrajOpt' : id.toUpperCase()
}
