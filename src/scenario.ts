import { cloneScenario, pointKey, type Point, type Scenario } from './pathfinding'

export const MIN_EDITOR_GRID_SIZE = 5
export const MAX_EDITOR_GRID_SIZE = 100

export interface GridSize {
  cols: number
  rows: number
}

export interface ReachableObstacleOptions {
  density?: number
  random?: () => number
}

const DEFAULT_OBSTACLE_DENSITY = 0.18

export function normalizeEditorGridDimension(value: number, fallback: number): number {
  const safeFallback = Number.isFinite(fallback)
    ? Math.min(MAX_EDITOR_GRID_SIZE, Math.max(MIN_EDITOR_GRID_SIZE, Math.trunc(fallback)))
    : MIN_EDITOR_GRID_SIZE
  if (!Number.isFinite(value)) return safeFallback
  return Math.min(MAX_EDITOR_GRID_SIZE, Math.max(MIN_EDITOR_GRID_SIZE, Math.trunc(value)))
}

export function isPointInGrid(point: Point, size: GridSize): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < size.cols && point.y < size.rows
}

function clampPointToGrid(point: Point, size: GridSize): Point {
  const x = Number.isFinite(point.x) ? Math.trunc(point.x) : 0
  const y = Number.isFinite(point.y) ? Math.trunc(point.y) : 0
  return {
    x: Math.min(size.cols - 1, Math.max(0, x)),
    y: Math.min(size.rows - 1, Math.max(0, y)),
  }
}

function nearestUnoccupiedPoint(
  point: Point,
  size: GridSize,
  occupied: Set<string>,
): Point | null {
  const origin = clampPointToGrid(point, size)
  const maxDistance = size.cols + size.rows - 2

  for (let distance = 0; distance <= maxDistance; distance += 1) {
    for (let y = 0; y < size.rows; y += 1) {
      const remainingX = distance - Math.abs(y - origin.y)
      if (remainingX < 0) continue
      const candidates =
        remainingX === 0
          ? [origin.x]
          : [origin.x - remainingX, origin.x + remainingX]
      for (const x of candidates) {
        if (x < 0 || x >= size.cols) continue
        const candidate = { x, y }
        if (!occupied.has(pointKey(candidate))) return candidate
      }
    }
  }

  return null
}

function relocateRoutePoints(scenario: Scenario, size: GridSize): Pick<Scenario, 'start' | 'end' | 'waypoints'> {
  const occupied = new Set<string>()
  const reserve = (point: Point | null) => {
    if (!point) return null
    const relocated = nearestUnoccupiedPoint(point, size, occupied)
    if (relocated) occupied.add(pointKey(relocated))
    return relocated
  }

  const start = reserve(scenario.start)
  const end = reserve(scenario.end)
  const waypoints = scenario.waypoints.flatMap((point) => {
    const relocated = reserve(point)
    return relocated ? [relocated] : []
  })

  return { start, end, waypoints }
}

function carveCardinalCorridor(
  from: Point,
  to: Point,
  protectedCells: Set<string>,
  random: () => number,
) {
  const current = { ...from }
  protectedCells.add(pointKey(current))

  while (current.x !== to.x || current.y !== to.y) {
    const canMoveX = current.x !== to.x
    const canMoveY = current.y !== to.y
    const moveX = canMoveX && (!canMoveY || random() < 0.5)
    if (moveX) current.x += Math.sign(to.x - current.x)
    else current.y += Math.sign(to.y - current.y)
    protectedCells.add(pointKey(current))
  }
}

export function randomizeReachableObstacles(
  scenario: Scenario,
  { density = DEFAULT_OBSTACLE_DENSITY, random = Math.random }: ReachableObstacleOptions = {},
): Scenario {
  const randomized = cloneScenario(scenario)
  const safeDensity = Number.isFinite(density) ? Math.min(1, Math.max(0, density)) : DEFAULT_OBSTACLE_DENSITY
  const route = [randomized.start, ...randomized.waypoints, randomized.end].filter(
    (point): point is Point => point !== null,
  )
  const protectedCells = new Set(route.map(pointKey))

  for (let index = 1; index < route.length; index += 1) {
    carveCardinalCorridor(route[index - 1], route[index], protectedCells, random)
  }

  const obstacles = new Set<string>()
  for (let y = 0; y < randomized.rows; y += 1) {
    for (let x = 0; x < randomized.cols; x += 1) {
      const key = pointKey({ x, y })
      if (!protectedCells.has(key) && random() < safeDensity) obstacles.add(key)
    }
  }
  randomized.obstacles = obstacles
  return randomized
}

export function resizeScenario(
  scenario: Scenario,
  requestedSize: GridSize,
  options?: ReachableObstacleOptions,
): Scenario {
  const size = {
    cols: normalizeEditorGridDimension(requestedSize.cols, scenario.cols),
    rows: normalizeEditorGridDimension(requestedSize.rows, scenario.rows),
  }
  if (size.cols === scenario.cols && size.rows === scenario.rows) return cloneScenario(scenario)

  const resized = cloneScenario(scenario)
  resized.cols = size.cols
  resized.rows = size.rows
  const route = relocateRoutePoints(resized, size)
  resized.start = route.start
  resized.end = route.end
  resized.waypoints = route.waypoints
  return randomizeReachableObstacles(resized, options)
}
