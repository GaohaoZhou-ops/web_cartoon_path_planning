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

function expectValidPath(runner: SearchRunner, map: Scenario) {
  expect(pointKey(runner.path[0])).toBe(pointKey(map.start!))
  expect(pointKey(runner.path[runner.path.length - 1])).toBe(pointKey(map.end!))
  let cost = 0

  for (let index = 1; index < runner.path.length; index += 1) {
    const previous = runner.path[index - 1]
    const current = runner.path[index]
    const dx = Math.abs(current.x - previous.x)
    const dy = Math.abs(current.y - previous.y)
    expect(map.obstacles.has(pointKey(current))).toBe(false)
    expect(Math.max(dx, dy)).toBe(1)
    expect(dx + dy).toBeGreaterThan(0)

    if (dx === 1 && dy === 1) {
      expect(map.allowDiagonal).toBe(true)
      if (map.preventCornerCutting) {
        expect(map.obstacles.has(`${current.x},${previous.y}`)).toBe(false)
        expect(map.obstacles.has(`${previous.x},${current.y}`)).toBe(false)
      }
      cost += Math.SQRT2
    } else {
      cost += 1
    }
  }
  expect(cost).toBeCloseTo(runner.pathCost, 8)
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

  it('keeps JPS optimal in every supported movement mode', () => {
    const modes = [
      { allowDiagonal: false, preventCornerCutting: true },
      { allowDiagonal: true, preventCornerCutting: true },
      { allowDiagonal: true, preventCornerCutting: false },
    ]
    const cells = Array.from({ length: 12 }, (_, index) => ({ x: index % 4, y: Math.floor(index / 4) }))
      .filter((point) => pointKey(point) !== '0,0' && pointKey(point) !== '3,2')

    for (const mode of modes) {
      for (let mask = 0; mask < 2 ** cells.length; mask += 1) {
        const obstacles = new Set(
          cells.filter((_, index) => mask & (1 << index)).map(pointKey),
        )
        const map = scenario({
          cols: 4,
          rows: 3,
          start: { x: 0, y: 0 },
          end: { x: 3, y: 2 },
          obstacles,
          ...mode,
        })
        const jps = finish(createRunner('jps', map), map)
        const dijkstra = finish(createRunner('dijkstra', map), map)

        expect(jps.status, `${JSON.stringify(mode)} mask=${mask}`).toBe(dijkstra.status)
        if (jps.status === 'complete') {
          expect(jps.pathCost, `${JSON.stringify(mode)} mask=${mask}`).toBeCloseTo(dijkstra.pathCost, 8)
        }
      }
    }
  })

  it('matches Dijkstra on larger seeded obstacle fields', () => {
    const modes = [
      { allowDiagonal: false, preventCornerCutting: true },
      { allowDiagonal: true, preventCornerCutting: true },
      { allowDiagonal: true, preventCornerCutting: false },
    ]
    let seed = 0x5f3759df
    const random = () => {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      return (seed >>> 0) / 2 ** 32
    }

    for (const mode of modes) {
      for (let sample = 0; sample < 80; sample += 1) {
        const obstacles = new Set<string>()
        for (let y = 0; y < 6; y += 1) {
          for (let x = 0; x < 8; x += 1) {
            if ((x !== 0 || y !== 0) && (x !== 7 || y !== 5) && random() < 0.28) {
              obstacles.add(`${x},${y}`)
            }
          }
        }
        const map = scenario({
          cols: 8,
          rows: 6,
          start: { x: 0, y: 0 },
          end: { x: 7, y: 5 },
          obstacles,
          ...mode,
        })
        const jps = finish(createRunner('jps', map), map)
        const dijkstra = finish(createRunner('dijkstra', map), map)

        expect(jps.status, `${JSON.stringify(mode)} sample=${sample}`).toBe(dijkstra.status)
        if (jps.status === 'complete') {
          expect(jps.pathCost, `${JSON.stringify(mode)} sample=${sample}`).toBeCloseTo(dijkstra.pathCost, 8)
          expectValidPath(jps, map)
        }
      }
    }
  })

  it('expands jump paths into valid adjacent grid steps', () => {
    const map = scenario({ cols: 12, rows: 8, end: { x: 11, y: 6 } })
    const jps = finish(createRunner('jps', map), map)
    const astar = finish(createRunner('astar', map), map)

    expect(jps.status).toBe('complete')
    expect(jps.pathCost).toBeCloseTo(astar.pathCost, 8)
    expect(jps.expansions).toBeLessThan(astar.expansions)
    for (let index = 1; index < jps.path.length; index += 1) {
      const dx = Math.abs(jps.path[index].x - jps.path[index - 1].x)
      const dy = Math.abs(jps.path[index].y - jps.path[index - 1].y)
      expect(Math.max(dx, dy)).toBe(1)
      expect(dx + dy).toBeGreaterThan(0)
    }
  })
})
