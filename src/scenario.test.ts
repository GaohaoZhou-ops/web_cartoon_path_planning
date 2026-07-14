import { describe, expect, it } from 'vitest'
import { pointKey, type Point, type Scenario } from './pathfinding'
import {
  MAX_EDITOR_GRID_SIZE,
  MIN_EDITOR_GRID_SIZE,
  isPointInGrid,
  normalizeEditorGridDimension,
  randomizeReachableObstacles,
  resizeScenario,
} from './scenario'

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    cols: 8,
    rows: 7,
    start: { x: 0, y: 0 },
    waypoints: [
      { x: 4, y: 4 },
      { x: 6, y: 5 },
    ],
    end: { x: 7, y: 6 },
    obstacles: new Set(['1,1', '4,4', '5,4', '7,6', '-1,0']),
    allowDiagonal: true,
    preventCornerCutting: true,
    ...overrides,
  }
}

function cardinallyReachable(map: Scenario, start: Point, end: Point): boolean {
  const queue = [start]
  const seen = new Set([pointKey(start)])
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    if (current.x === end.x && current.y === end.y) return true
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, y: current.y + dy }
      const key = pointKey(next)
      if (!isPointInGrid(next, map) || map.obstacles.has(key) || seen.has(key)) continue
      seen.add(key)
      queue.push(next)
    }
  }
  return false
}

function expectFullRouteReachable(map: Scenario) {
  const route = [map.start, ...map.waypoints, map.end].filter(
    (point): point is Point => point !== null,
  )
  for (let index = 1; index < route.length; index += 1) {
    expect(cardinallyReachable(map, route[index - 1], route[index])).toBe(true)
  }
}

describe('editor grid resizing', () => {
  it('normalizes finite dimensions to integers within the editor limits', () => {
    expect(normalizeEditorGridDimension(4, 12)).toBe(MIN_EDITOR_GRID_SIZE)
    expect(normalizeEditorGridDimension(7.9, 12)).toBe(7)
    expect(normalizeEditorGridDimension(101, 12)).toBe(MAX_EDITOR_GRID_SIZE)
    expect(normalizeEditorGridDimension(Number.NaN, 12)).toBe(12)
    expect(normalizeEditorGridDimension(Number.POSITIVE_INFINITY, 3)).toBe(
      MIN_EDITOR_GRID_SIZE,
    )
    expect(normalizeEditorGridDimension(Number.NaN, 120)).toBe(MAX_EDITOR_GRID_SIZE)
  })

  it('keeps colliding endpoints and waypoints distinct after shrinking', () => {
    const resized = resizeScenario(
      scenario({
        start: { x: 7, y: 6 },
        end: { x: 9, y: 9 },
        waypoints: [
          { x: 8, y: 8 },
          { x: 7, y: 7 },
        ],
      }),
      { cols: 5, rows: 5 },
      { density: 1, random: () => 0 },
    )
    const route = [resized.start!, ...resized.waypoints, resized.end!]
    const routeKeys = route.map(pointKey)

    expect(resized.start).not.toBeNull()
    expect(resized.end).not.toBeNull()
    expect(route.every((point) => isPointInGrid(point, resized))).toBe(true)
    expect(new Set(routeKeys).size).toBe(routeKeys.length)
    expect(route.every((point) => !resized.obstacles.has(pointKey(point)))).toBe(true)
    expect(resized.obstacles.size).toBeGreaterThan(0)
    expectFullRouteReachable(resized)
  })

  it('always preserves endpoints and drops only excess waypoints when the grid is full', () => {
    const waypoints = Array.from({ length: 30 }, () => ({ x: 99, y: 99 }))
    const resized = resizeScenario(
      scenario({ start: { x: 99, y: 99 }, end: { x: 98, y: 98 }, waypoints }),
      { cols: 5, rows: 5 },
      { density: 0, random: () => 1 },
    )
    const route = [resized.start!, resized.end!, ...resized.waypoints]

    expect(resized.start).not.toBeNull()
    expect(resized.end).not.toBeNull()
    expect(resized.waypoints).toHaveLength(23)
    expect(new Set(route.map(pointKey)).size).toBe(25)
    expectFullRouteReachable(resized)
  })

  it('replaces old obstacles on expansion and leaves the source scenario unchanged', () => {
    const original = scenario({ obstacles: new Set(['1,1', '6,5']) })
    const originalSnapshot = {
      start: { ...original.start! },
      waypoints: original.waypoints.map((point) => ({ ...point })),
      end: { ...original.end! },
      obstacles: [...original.obstacles],
    }
    const resized = resizeScenario(
      original,
      { cols: 12, rows: 9 },
      { density: 0, random: () => 1 },
    )

    expect(resized).toMatchObject({
      cols: 12,
      rows: 9,
      start: originalSnapshot.start,
      waypoints: originalSnapshot.waypoints,
      end: originalSnapshot.end,
    })
    expect(resized.obstacles.size).toBe(0)
    expect(resized.obstacles).not.toBe(original.obstacles)
    expect(resized.waypoints).not.toBe(original.waypoints)
    expect(original).toMatchObject({
      cols: 8,
      rows: 7,
      start: originalSnapshot.start,
      waypoints: originalSnapshot.waypoints,
      end: originalSnapshot.end,
    })
    expect([...original.obstacles]).toEqual(originalSnapshot.obstacles)
  })

  it('does not rerandomize or consume randomness when the dimensions are unchanged', () => {
    const original = scenario({ obstacles: new Set(['1,1', '2,2']) })
    let randomCalls = 0
    const unchanged = resizeScenario(original, { cols: 8, rows: 7 }, {
      random: () => {
        randomCalls += 1
        return 0
      },
    })

    expect(randomCalls).toBe(0)
    expect([...unchanged.obstacles]).toEqual([...original.obstacles])
    expect(unchanged).not.toBe(original)
    expect(unchanged.obstacles).not.toBe(original.obstacles)
  })

  it('does not invent missing endpoints while still generating bounded obstacles', () => {
    const resized = resizeScenario(
      scenario({ start: null, end: null, waypoints: [{ x: 9, y: -1 }] }),
      { cols: 5, rows: 6 },
      { density: 1, random: () => 0 },
    )

    expect(resized.start).toBeNull()
    expect(resized.end).toBeNull()
    expect(resized.waypoints).toEqual([{ x: 4, y: 0 }])
    expect([...resized.obstacles].every((key) => {
      const [x, y] = key.split(',').map(Number)
      return isPointInGrid({ x, y }, resized)
    })).toBe(true)
  })

  it('keeps the random-obstacle action reachable across the full waypoint route', () => {
    const randomized = randomizeReachableObstacles(
      scenario({ allowDiagonal: false, preventCornerCutting: true }),
      { density: 1, random: () => 0 },
    )

    expect(randomized.obstacles.size).toBeGreaterThan(0)
    expectFullRouteReachable(randomized)
  })
})
