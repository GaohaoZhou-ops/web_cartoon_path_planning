import { describe, expect, it } from 'vitest'
import {
  ALGORITHMS,
  createRunner,
  hasLineOfSight,
  isContinuousEdgeFree,
  pointKey,
  repairIncrementalRunner,
  stepRunner,
  type AlgorithmId,
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
      allowDiagonal: true,
    })

    for (const algorithm of ALGORITHMS) {
      const runner = finish(createRunner(algorithm.id, map), map)
      expect(runner.status).toBe('failed')
      if (algorithm.id === 'rrt-star' || algorithm.id === 'prm') {
        expect(runner.action).toMatch(/采样预算|采样路网/)
      } else {
        expect(runner.action).toContain('无可行路径')
      }
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

  it('keeps advanced optimal grid planners aligned with Dijkstra', () => {
    const algorithmIds: AlgorithmId[] = [
      'bidirectional-astar',
      'dstar-lite',
      'flow-field',
      'jps-plus',
      'lpa-star',
      'ad-star',
    ]
    const modes = [
      { allowDiagonal: false, preventCornerCutting: true },
      { allowDiagonal: true, preventCornerCutting: true },
      { allowDiagonal: true, preventCornerCutting: false },
    ]
    let seed = 0x1a2b3c4d
    const random = () => {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      return (seed >>> 0) / 2 ** 32
    }

    for (const mode of modes) {
      for (let sample = 0; sample < 60; sample += 1) {
        const obstacles = new Set<string>()
        for (let y = 0; y < 6; y += 1) {
          for (let x = 0; x < 8; x += 1) {
            if ((x !== 0 || y !== 0) && (x !== 7 || y !== 5) && random() < 0.26) {
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
        const oracle = finish(createRunner('dijkstra', map), map)
        for (const id of algorithmIds) {
          const runner = finish(createRunner(id, map), map)
          expect(runner.status, `${id} ${JSON.stringify(mode)} sample=${sample}`).toBe(oracle.status)
          if (runner.status === 'complete') {
            expect(runner.pathCost, `${id} ${JSON.stringify(mode)} sample=${sample}`).toBeCloseTo(
              oracle.pathCost,
              8,
            )
            expectValidPath(runner, map)
          }
        }
        const field = finish(createRunner('field-dstar', map), map)
        expect(field.status, `field-dstar ${JSON.stringify(mode)} sample=${sample}`).toBe(oracle.status)
        if (field.status === 'complete') {
          if (!mode.allowDiagonal) expect(field.pathCost).toBeCloseTo(oracle.pathCost, 8)
          for (let index = 1; index < field.path.length; index += 1) {
            expect(
              isContinuousEdgeFree(field.path[index - 1], field.path[index], map),
              `field edge ${JSON.stringify(mode)} sample=${sample}`,
            ).toBe(true)
          }
        }
      }
    }
  })

  it('builds direct and obstacle-safe any-angle Theta* paths', () => {
    const openMap = scenario({ cols: 7, rows: 5, end: { x: 6, y: 4 } })
    const direct = finish(createRunner('theta', openMap), openMap)
    expect(direct.status).toBe('complete')
    expect(direct.path).toEqual([openMap.start, openMap.end])
    expect(direct.pathCost).toBeCloseTo(Math.hypot(6, 4), 8)

    const blockedMap = scenario({
      cols: 8,
      rows: 6,
      end: { x: 7, y: 5 },
      obstacles: new Set(['2,1', '2,2', '2,3', '4,3', '5,3']),
    })
    const theta = finish(createRunner('theta', blockedMap), blockedMap)
    expect(theta.status).toBe('complete')
    let cost = 0
    for (let index = 1; index < theta.path.length; index += 1) {
      expect(hasLineOfSight(theta.path[index - 1], theta.path[index], blockedMap)).toBe(true)
      cost += Math.hypot(
        theta.path[index].x - theta.path[index - 1].x,
        theta.path[index].y - theta.path[index - 1].y,
      )
    }
    expect(cost).toBeCloseTo(theta.pathCost, 8)

    const cardinalMap = { ...blockedMap, obstacles: new Set(blockedMap.obstacles), allowDiagonal: false }
    const cardinalTheta = finish(createRunner('theta', cardinalMap), cardinalMap)
    const cardinalOracle = finish(createRunner('dijkstra', cardinalMap), cardinalMap)
    expect(cardinalTheta.pathCost).toBeCloseTo(cardinalOracle.pathCost, 8)
    expectValidPath(cardinalTheta, cardinalMap)
  })

  it('alternates balanced Bidirectional A* fronts and finishes on an expansion tick', () => {
    const map = scenario({ cols: 8, rows: 6, end: { x: 7, y: 5 } })
    const runner = createRunner('bidirectional-astar', map)

    stepRunner(runner, map)
    stepRunner(runner, map)
    expect(runner.visited.has(pointKey(map.start!))).toBe(true)
    expect(runner.visited.has(pointKey(map.end!))).toBe(true)

    while (runner.status === 'running') {
      const expansionsBefore = runner.expansions
      stepRunner(runner, map)
      if (runner.finishedAt !== null) {
        expect(runner.expansions).toBe(expansionsBefore + 1)
      }
    }
    expect(runner.status).toBe('complete')
  })

  it('applies corner rules symmetrically to Theta* line of sight', () => {
    const strict = scenario({
      cols: 4,
      rows: 2,
      start: { x: 0, y: 0 },
      end: { x: 3, y: 1 },
      obstacles: new Set(['1,1']),
      preventCornerCutting: true,
    })
    const permissive = {
      ...strict,
      obstacles: new Set(strict.obstacles),
      preventCornerCutting: false,
    }

    expect(hasLineOfSight(strict.start!, strict.end!, strict)).toBe(false)
    expect(hasLineOfSight(strict.end!, strict.start!, strict)).toBe(false)
    expect(hasLineOfSight(permissive.start!, permissive.end!, permissive)).toBe(true)
    expect(hasLineOfSight(permissive.end!, permissive.start!, permissive)).toBe(true)
  })

  it('runs D* Lite backward and completes the full Flow Field integration map', () => {
    const map = scenario({ cols: 4, rows: 3, end: { x: 3, y: 2 } })
    const dstar = createRunner('dstar-lite', map)
    stepRunner(dstar, map)
    expect(pointKey(dstar.current!)).toBe(pointKey(map.end!))

    const flow = finish(createRunner('flow-field', map), map)
    expect(flow.status).toBe('complete')
    expect(flow.visited.size).toBe(12)
    expectValidPath(flow, map)
  })

  it('invalidates JPS+ preprocessing when the same scenario object changes', () => {
    const map = scenario({
      cols: 5,
      rows: 1,
      end: { x: 4, y: 0 },
      allowDiagonal: false,
    })
    expect(finish(createRunner('jps-plus', map), map).status).toBe('complete')

    map.obstacles.add('2,0')
    const blocked = finish(createRunner('jps-plus', map), map)
    expect(blocked.status).toBe('failed')
  })

  it('runs LPA* forward and AD* through all epsilon refinements', () => {
    const map = scenario({ cols: 8, rows: 6, end: { x: 7, y: 5 } })
    const lpa = createRunner('lpa-star', map)
    stepRunner(lpa, map)
    expect(pointKey(lpa.current!)).toBe(pointKey(map.start!))
    finish(lpa, map)

    const ad = finish(createRunner('ad-star', map), map)
    const oracle = finish(createRunner('dijkstra', map), map)
    expect(lpa.pathCost).toBeCloseTo(oracle.pathCost, 8)
    expect(ad.pathCost).toBeCloseTo(oracle.pathCost, 8)
    expect(ad.anytime?.epsilon).toBe(1)
    expect(ad.anytime?.rounds).toBe(4)
  })

  it('improves a genuinely suboptimal AD* incumbent before epsilon reaches one', () => {
    const map = scenario({
      cols: 8,
      rows: 6,
      end: { x: 7, y: 5 },
      obstacles: new Set(
        '6,0 0,1 2,1 0,2 1,2 6,2 3,3 4,3 6,3 0,4 3,4 5,4 0,5'.split(' '),
      ),
    })
    const ad = finish(createRunner('ad-star', map), map)
    const oracle = finish(createRunner('dijkstra', map), map)
    const history = ad.anytime?.history ?? []
    expect(history.map((round) => round.epsilon)).toEqual([2.5, 2, 1.5, 1])
    expect(history[0].cost).toBeGreaterThan(history[history.length - 1].cost)
    for (let index = 1; index < history.length; index += 1) {
      expect(history[index].cost).toBeLessThanOrEqual(history[index - 1].cost + 1e-9)
    }
    expect(ad.pathCost).toBeCloseTo(oracle.pathCost, 8)
  })

  it('uses a fractional Field D* interpolation policy in open space', () => {
    const map = scenario({
      cols: 3,
      rows: 2,
      start: { x: 2, y: 1 },
      end: { x: 0, y: 0 },
    })
    const field = finish(createRunner('field-dstar', map), map)
    const discrete = finish(createRunner('dijkstra', map), map)
    expect(field.status).toBe('complete')
    expect(field.path.some((point) => !Number.isInteger(point.x) || !Number.isInteger(point.y))).toBe(true)
    expect(field.path[1].x).toBeCloseTo(1, 8)
    expect(field.path[1].y).toBeCloseTo(0.5449101394, 6)
    expect(field.pathCost).toBeLessThan(discrete.pathCost)
    for (let index = 1; index < field.path.length; index += 1) {
      expect(isContinuousEdgeFree(field.path[index - 1], field.path[index], map)).toBe(true)
    }

    const cardinal = { ...map, obstacles: new Set(map.obstacles), allowDiagonal: false }
    const cardinalField = finish(createRunner('field-dstar', cardinal), cardinal)
    const cardinalOracle = finish(createRunner('dijkstra', cardinal), cardinal)
    expect(cardinalField.pathCost).toBeCloseTo(cardinalOracle.pathCost, 8)
    expect(cardinalField.path.every((point) => Number.isInteger(point.x) && Number.isInteger(point.y))).toBe(true)
  })

  it('keeps Field D* face extraction no worse than the discrete grid detour', () => {
    const map = scenario({
      cols: 10,
      rows: 8,
      start: { x: 0, y: 0 },
      end: { x: 9, y: 7 },
      obstacles: new Set(
        '7,0 8,0 2,1 4,1 6,1 4,2 5,2 6,2 9,2 7,3 0,4 7,4 2,5 1,6 2,6 4,6 0,7 8,7'.split(' '),
      ),
    })
    const field = finish(createRunner('field-dstar', map), map)
    const discrete = finish(createRunner('dijkstra', map), map)
    expect(field.status).toBe('complete')
    expect(field.pathCost).toBeLessThanOrEqual(discrete.pathCost + 1e-8)

  })

  it('keeps continuous collision checks symmetric at blocked corners', () => {
    const strict = scenario({
      cols: 2,
      rows: 2,
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
      obstacles: new Set(['1,0', '0,1']),
      preventCornerCutting: true,
    })
    const permissive = {
      ...strict,
      obstacles: new Set(strict.obstacles),
      preventCornerCutting: false,
    }
    expect(isContinuousEdgeFree(strict.start!, strict.end!, strict)).toBe(false)
    expect(isContinuousEdgeFree(strict.end!, strict.start!, strict)).toBe(false)
    expect(isContinuousEdgeFree(permissive.start!, permissive.end!, permissive)).toBe(true)
    expect(isContinuousEdgeFree(permissive.end!, permissive.start!, permissive)).toBe(true)
  })

  it('builds deterministic collision-free RRT* trees and PRM roadmaps', () => {
    const map = scenario({
      cols: 8,
      rows: 6,
      end: { x: 7, y: 5 },
      obstacles: new Set(['2,1', '2,2', '2,3', '4,2', '5,2']),
    })
    for (const id of ['rrt-star', 'prm'] as AlgorithmId[]) {
      const first = finish(createRunner(id, map), map)
      const second = finish(createRunner(id, map), map)
      expect(first.status, id).toBe('complete')
      expect(second.status, id).toBe('complete')
      expect(first.path, id).toEqual(second.path)
      expect(first.pathCost, id).toBeCloseTo(second.pathCost, 10)
      expect(first.graphVisual?.edges.length, id).toBeGreaterThan(0)
      for (let index = 1; index < first.path.length; index += 1) {
        expect(isContinuousEdgeFree(first.path[index - 1], first.path[index], map), id).toBe(true)
      }
    }
  })

  it('requires any-angle movement for continuous sampling planners', () => {
    const map = scenario({ allowDiagonal: false })
    for (const id of ['rrt-star', 'prm'] as AlgorithmId[]) {
      const runner = createRunner(id, map)
      expect(runner.status).toBe('failed')
      expect(runner.action).toContain('需要启用斜向移动')
    }
  })

  it('repairs LPA*, Field D* and AD* state after a local obstacle change', () => {
    const original = scenario({
      cols: 5,
      rows: 3,
      start: { x: 0, y: 1 },
      end: { x: 4, y: 1 },
      allowDiagonal: false,
    })
    const changed = {
      ...original,
      obstacles: new Set(['2,1']),
    }
    const oracle = finish(createRunner('dijkstra', changed), changed)
    for (const id of ['lpa-star', 'field-dstar', 'ad-star'] as AlgorithmId[]) {
      const runner = finish(createRunner(id, original), original)
      expect(runner.path.map(pointKey)).toContain('2,1')
      repairIncrementalRunner(runner, changed, [{ x: 2, y: 1 }])
      finish(runner, changed)
      expect(runner.status, id).toBe('complete')
      expect(runner.path.map(pointKey), id).not.toContain('2,1')
      expect(runner.pathCost, id).toBeCloseTo(oracle.pathCost, 8)
    }
  })

  it('handles zero-length sampling legs without duplicate endpoints', () => {
    const map = scenario({
      start: { x: 2, y: 2 },
      end: { x: 2, y: 2 },
    })
    for (const id of ['rrt-star', 'prm'] as AlgorithmId[]) {
      const runner = finish(createRunner(id, map), map)
      expect(runner.status).toBe('complete')
      expect(runner.path).toEqual([{ x: 2, y: 2 }])
      expect(runner.pathCost).toBe(0)
    }

    const direct = scenario({ cols: 2, rows: 2, end: { x: 1, y: 0 } })
    const rrt = finish(createRunner('rrt-star', direct), direct)
    expect(rrt.path[rrt.path.length - 1]).toEqual(direct.end)
    for (let index = 1; index < rrt.path.length; index += 1) {
      expect(euclideanForTest(rrt.path[index - 1], rrt.path[index])).toBeGreaterThan(1e-8)
    }
  })

  it('finds a deterministic route through a one-cell-wide S corridor', () => {
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
    for (const id of ['rrt-star', 'prm'] as AlgorithmId[]) {
      const runner = finish(createRunner(id, map), map)
      expect(runner.status, id).toBe('complete')
      for (let index = 1; index < runner.path.length; index += 1) {
        expect(isContinuousEdgeFree(runner.path[index - 1], runner.path[index], map), id).toBe(true)
      }
    }
  })
})

function euclideanForTest(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
