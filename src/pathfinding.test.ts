import { describe, expect, it } from 'vitest'
import {
  ALGORITHMS,
  createRunner,
  pointKey,
  stepRunner,
  type Point,
  type Scenario,
  type SearchRunner,
} from './pathfinding'

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    cols: 6,
    rows: 6,
    start: { x: 0, y: 0 },
    waypoints: [],
    end: { x: 5, y: 5 },
    obstacles: new Set(),
    allowDiagonal: true,
    preventCornerCutting: true,
    ...overrides,
  }
}

function finish(runner: SearchRunner, map: Scenario, limit = 10_000) {
  let steps = 0
  while (runner.status === 'running' && steps < limit) {
    stepRunner(runner, map)
    steps += 1
  }
  expect(steps).toBeLessThan(limit)
  return runner
}

describe('incremental pathfinding runners', () => {
  it('plans all ordered waypoint legs for every algorithm', () => {
    const waypoint: Point = { x: 2, y: 3 }
    const map = scenario({
      waypoints: [waypoint],
      obstacles: new Set(['1,1', '1,2', '3,3', '4,3']),
    })

    for (const algorithm of ALGORITHMS) {
      const runner = finish(createRunner(algorithm.id, map), map)
      expect(runner.status, algorithm.name).toBe('complete')
      expect(runner.completedSegments).toBe(2)
      expect(runner.path.map(pointKey)).toContain(pointKey(waypoint))
      expect(runner.expansions).toBeGreaterThan(0)
      expect(runner.pathCost).toBeGreaterThan(0)
    }
  })

  it('keeps A* and Dijkstra optimal costs equal on the same weighted diagonal grid', () => {
    const map = scenario({
      obstacles: new Set(['1,1', '2,1', '3,1', '3,2', '3,3', '1,4', '2,4']),
    })
    const astar = finish(createRunner('astar', map), map)
    const dijkstra = finish(createRunner('dijkstra', map), map)

    expect(astar.status).toBe('complete')
    expect(dijkstra.status).toBe('complete')
    expect(astar.pathCost).toBeCloseTo(dijkstra.pathCost, 8)
  })

  it('reports failure when a route segment is sealed off', () => {
    const map = scenario({
      cols: 3,
      rows: 3,
      start: { x: 0, y: 1 },
      end: { x: 2, y: 1 },
      obstacles: new Set(['1,0', '1,1', '1,2']),
      allowDiagonal: false,
    })

    for (const algorithm of ALGORITHMS) {
      const runner = finish(createRunner(algorithm.id, map), map)
      expect(runner.status).toBe('failed')
      expect(runner.action).toContain('无可行路径')
    }
  })

  it('prevents diagonal corner cutting when enabled', () => {
    const blockedCorner = scenario({
      cols: 2,
      rows: 2,
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
      obstacles: new Set(['1,0', '0,1']),
      preventCornerCutting: true,
    })
    const openCorner = { ...blockedCorner, obstacles: new Set(blockedCorner.obstacles), preventCornerCutting: false }

    expect(finish(createRunner('astar', blockedCorner), blockedCorner).status).toBe('failed')
    const runner = finish(createRunner('astar', openCorner), openCorner)
    expect(runner.status).toBe('complete')
    expect(runner.pathCost).toBeCloseTo(Math.SQRT2, 8)
  })
})
