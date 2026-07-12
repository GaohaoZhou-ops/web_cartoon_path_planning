export const GRID_COLS = 24
export const GRID_ROWS = 15

export type AlgorithmId = 'astar' | 'dijkstra' | 'bfs' | 'greedy'
export type RunnerStatus = 'ready' | 'running' | 'complete' | 'failed'

export interface Point {
  x: number
  y: number
}

export interface Scenario {
  cols: number
  rows: number
  start: Point | null
  waypoints: Point[]
  end: Point | null
  obstacles: Set<string>
  allowDiagonal: boolean
  preventCornerCutting: boolean
}

export interface AlgorithmMeta {
  id: AlgorithmId
  name: string
  shortName: string
  description: string
  accent: string
  accentRgb: string
  optimality: string
}

export const ALGORITHMS: AlgorithmMeta[] = [
  {
    id: 'astar',
    name: 'A* Search',
    shortName: 'A*',
    description: '代价 + 启发式，兼顾方向与最优性',
    accent: '#b8f36a',
    accentRgb: '184, 243, 106',
    optimality: '启发式最优',
  },
  {
    id: 'dijkstra',
    name: 'Dijkstra',
    shortName: 'DJK',
    description: '按累计代价向外均匀扩张',
    accent: '#63d8ff',
    accentRgb: '99, 216, 255',
    optimality: '保证最优',
  },
  {
    id: 'bfs',
    name: 'Breadth-First',
    shortName: 'BFS',
    description: '逐层搜索，优先最少移动步数',
    accent: '#ffb65c',
    accentRgb: '255, 182, 92',
    optimality: '步数最少',
  },
  {
    id: 'greedy',
    name: 'Greedy Best-First',
    shortName: 'GBF',
    description: '只追逐目标，速度快但不保证最优',
    accent: '#ff718d',
    accentRgb: '255, 113, 141',
    optimality: '不保证最优',
  },
]

interface HeapNode {
  point: Point
  priority: number
  secondary: number
  g: number
  order: number
}

class MinHeap {
  private data: HeapNode[] = []

  get size() {
    return this.data.length
  }

  push(node: HeapNode) {
    this.data.push(node)
    this.bubbleUp(this.data.length - 1)
  }

  pop(): HeapNode | undefined {
    if (this.data.length === 0) return undefined
    const root = this.data[0]
    const tail = this.data.pop()!
    if (this.data.length > 0) {
      this.data[0] = tail
      this.sinkDown(0)
    }
    return root
  }

  private isBefore(a: HeapNode, b: HeapNode) {
    if (Math.abs(a.priority - b.priority) > 1e-9) {
      return a.priority < b.priority
    }
    if (Math.abs(a.secondary - b.secondary) > 1e-9) {
      return a.secondary < b.secondary
    }
    return a.order < b.order
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.isBefore(this.data[parent], this.data[index])) break
      ;[this.data[parent], this.data[index]] = [this.data[index], this.data[parent]]
      index = parent
    }
  }

  private sinkDown(index: number) {
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      let smallest = index
      if (left < this.data.length && this.isBefore(this.data[left], this.data[smallest])) {
        smallest = left
      }
      if (right < this.data.length && this.isBefore(this.data[right], this.data[smallest])) {
        smallest = right
      }
      if (smallest === index) break
      ;[this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]]
      index = smallest
    }
  }
}

interface SegmentSearch {
  start: Point
  target: Point
  heap: MinHeap
  queue: Point[]
  queueHead: number
  openKeys: Set<string>
  closedKeys: Set<string>
  discovered: Set<string>
  gScore: Map<string, number>
  cameFrom: Map<string, string>
  insertionOrder: number
}

export interface SearchRunner {
  id: AlgorithmId
  status: RunnerStatus
  route: Point[]
  segmentIndex: number
  segment: SegmentSearch | null
  visited: Set<string>
  frontier: Set<string>
  path: Point[]
  current: Point | null
  relaxed: Point[]
  expansions: number
  generated: number
  relaxations: number
  openPeak: number
  cpuMs: number
  pathCost: number
  completedSegments: number
  action: string
  startedAt: number
  finishedAt: number | null
}

export const pointKey = (point: Point) => `${point.x},${point.y}`

export const keyPoint = (key: string): Point => {
  const [x, y] = key.split(',').map(Number)
  return { x, y }
}

export const samePoint = (a: Point | null, b: Point | null) =>
  Boolean(a && b && a.x === b.x && a.y === b.y)

export const cloneScenario = (scenario: Scenario): Scenario => ({
  ...scenario,
  start: scenario.start ? { ...scenario.start } : null,
  end: scenario.end ? { ...scenario.end } : null,
  waypoints: scenario.waypoints.map((point) => ({ ...point })),
  obstacles: new Set(scenario.obstacles),
})

export function createRunner(id: AlgorithmId, scenario: Scenario): SearchRunner {
  if (!scenario.start || !scenario.end) {
    throw new Error('起点和终点必须存在')
  }

  const runner: SearchRunner = {
    id,
    status: 'running',
    route: [scenario.start, ...scenario.waypoints, scenario.end].map((point) => ({ ...point })),
    segmentIndex: 0,
    segment: null,
    visited: new Set(),
    frontier: new Set(),
    path: [],
    current: null,
    relaxed: [],
    expansions: 0,
    generated: 0,
    relaxations: 0,
    openPeak: 0,
    cpuMs: 0,
    pathCost: 0,
    completedSegments: 0,
    action: '装载地图快照…',
    startedAt: performance.now(),
    finishedAt: null,
  }

  initializeSegment(runner, scenario)
  return runner
}

function initializeSegment(runner: SearchRunner, scenario: Scenario) {
  const start = runner.route[runner.segmentIndex]
  const target = runner.route[runner.segmentIndex + 1]
  const startKey = pointKey(start)
  const heap = new MinHeap()
  const segment: SegmentSearch = {
    start,
    target,
    heap,
    queue: [start],
    queueHead: 0,
    openKeys: new Set([startKey]),
    closedKeys: new Set(),
    discovered: new Set([startKey]),
    gScore: new Map([[startKey, 0]]),
    cameFrom: new Map(),
    insertionOrder: 1,
  }

  if (runner.id !== 'bfs') {
    const h = heuristic(start, target, scenario.allowDiagonal)
    heap.push({
      point: start,
      priority: runner.id === 'dijkstra' ? 0 : h,
      secondary: runner.id === 'greedy' ? 0 : h,
      g: 0,
      order: 0,
    })
  }

  runner.segment = segment
  runner.frontier = segment.openKeys
  runner.generated += 1
  runner.openPeak = Math.max(runner.openPeak, 1)
  runner.current = null
  runner.relaxed = []
  runner.action = `准备第 ${runner.segmentIndex + 1} 段 · ${formatPoint(start)} → ${formatPoint(target)}`
}

export function stepRunner(runner: SearchRunner, scenario: Scenario) {
  if (runner.status !== 'running' || !runner.segment) return
  const tickStart = performance.now()

  executeSearchStep(runner, scenario)

  runner.cpuMs += performance.now() - tickStart
}

function executeSearchStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const node = popNext(runner, segment)

  if (!node) {
    runner.status = 'failed'
    runner.current = null
    runner.relaxed = []
    runner.finishedAt = performance.now()
    runner.action = `第 ${runner.segmentIndex + 1} 段无可行路径`
    return
  }

  const current = node.point
  const currentKey = pointKey(current)
  segment.openKeys.delete(currentKey)
  segment.closedKeys.add(currentKey)
  runner.visited.add(currentKey)
  runner.current = current
  runner.relaxed = []
  runner.expansions += 1

  if (samePoint(current, segment.target)) {
    finishSegment(runner, scenario, currentKey)
    return
  }

  const neighbors = getNeighbors(current, scenario)
  let updated = 0
  for (const neighbor of neighbors) {
    const neighborKey = pointKey(neighbor.point)
    if (segment.closedKeys.has(neighborKey)) continue

    const tentativeG = (segment.gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + neighbor.cost

    if (runner.id === 'bfs') {
      if (segment.discovered.has(neighborKey)) continue
      segment.discovered.add(neighborKey)
      segment.gScore.set(neighborKey, tentativeG)
      segment.cameFrom.set(neighborKey, currentKey)
      segment.queue.push(neighbor.point)
      segment.openKeys.add(neighborKey)
      runner.generated += 1
      runner.relaxations += 1
      runner.relaxed.push(neighbor.point)
      updated += 1
      continue
    }

    const knownG = segment.gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY
    if (tentativeG + 1e-9 >= knownG) continue

    segment.gScore.set(neighborKey, tentativeG)
    segment.cameFrom.set(neighborKey, currentKey)
    const h = heuristic(neighbor.point, segment.target, scenario.allowDiagonal)
    const priority =
      runner.id === 'astar' ? tentativeG + h : runner.id === 'dijkstra' ? tentativeG : h
    const secondary = runner.id === 'astar' ? h : runner.id === 'greedy' ? tentativeG : 0
    segment.heap.push({
      point: neighbor.point,
      priority,
      secondary,
      g: tentativeG,
      order: segment.insertionOrder++,
    })
    if (!segment.openKeys.has(neighborKey)) runner.generated += 1
    segment.openKeys.add(neighborKey)
    runner.relaxations += 1
    runner.relaxed.push(neighbor.point)
    updated += 1
  }

  runner.openPeak = Math.max(runner.openPeak, segment.openKeys.size)
  runner.action = `展开 ${formatPoint(current)} · 更新 ${updated} 个邻居`
}

function popNext(runner: SearchRunner, segment: SegmentSearch): HeapNode | undefined {
  if (runner.id === 'bfs') {
    while (segment.queueHead < segment.queue.length) {
      const point = segment.queue[segment.queueHead++]
      if (!segment.closedKeys.has(pointKey(point))) {
        return { point, priority: 0, secondary: 0, g: segment.gScore.get(pointKey(point)) ?? 0, order: 0 }
      }
    }
    return undefined
  }

  while (segment.heap.size > 0) {
    const node = segment.heap.pop()!
    const key = pointKey(node.point)
    if (segment.closedKeys.has(key)) continue
    const bestG = segment.gScore.get(key)
    if (bestG === undefined || Math.abs(bestG - node.g) > 1e-9) continue
    return node
  }
  return undefined
}

function finishSegment(runner: SearchRunner, scenario: Scenario, targetKey: string) {
  const segment = runner.segment!
  const segmentPath = reconstructPath(segment, targetKey)
  if (runner.path.length === 0) runner.path.push(...segmentPath)
  else runner.path.push(...segmentPath.slice(1))

  runner.pathCost += segment.gScore.get(targetKey) ?? 0
  runner.completedSegments += 1
  runner.relaxed = []

  const totalSegments = runner.route.length - 1
  if (runner.completedSegments >= totalSegments) {
    runner.status = 'complete'
    runner.frontier = new Set()
    runner.finishedAt = performance.now()
    runner.action = `航路锁定 · ${runner.path.length - 1} 步 / 代价 ${runner.pathCost.toFixed(2)}`
    return
  }

  const completed = runner.segmentIndex + 1
  runner.segmentIndex += 1
  initializeSegment(runner, scenario)
  runner.action = `第 ${completed} 段已锁定 · 转入第 ${runner.segmentIndex + 1} 段`
}

function reconstructPath(segment: SegmentSearch, targetKey: string) {
  const result = [keyPoint(targetKey)]
  let currentKey = targetKey
  const startKey = pointKey(segment.start)
  while (currentKey !== startKey) {
    const previous = segment.cameFrom.get(currentKey)
    if (!previous) break
    result.push(keyPoint(previous))
    currentKey = previous
  }
  return result.reverse()
}

function heuristic(a: Point, b: Point, diagonal: boolean) {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  if (!diagonal) return dx + dy
  const straight = Math.abs(dx - dy)
  const diagonalSteps = Math.min(dx, dy)
  return straight + diagonalSteps * Math.SQRT2
}

function getNeighbors(point: Point, scenario: Scenario) {
  const cardinal = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ]
  const diagonal = [
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
  ]
  const directions = scenario.allowDiagonal ? [...cardinal, ...diagonal] : cardinal
  const neighbors: Array<{ point: Point; cost: number }> = []

  for (const direction of directions) {
    const next = { x: point.x + direction.x, y: point.y + direction.y }
    if (next.x < 0 || next.y < 0 || next.x >= scenario.cols || next.y >= scenario.rows) continue
    if (scenario.obstacles.has(pointKey(next))) continue

    const isDiagonal = direction.x !== 0 && direction.y !== 0
    if (isDiagonal && scenario.preventCornerCutting) {
      const sideA = pointKey({ x: point.x + direction.x, y: point.y })
      const sideB = pointKey({ x: point.x, y: point.y + direction.y })
      if (scenario.obstacles.has(sideA) || scenario.obstacles.has(sideB)) continue
    }

    neighbors.push({ point: next, cost: isDiagonal ? Math.SQRT2 : 1 })
  }

  return neighbors
}

const formatPoint = (point: Point) => `[${String(point.x).padStart(2, '0')},${String(point.y).padStart(2, '0')}]`

export function createSampleScenario(): Scenario {
  const obstacles = new Set<string>()
  const addLine = (points: Point[]) => points.forEach((point) => obstacles.add(pointKey(point)))

  addLine(Array.from({ length: 12 }, (_, index) => ({ x: 6, y: index + 1 })).filter((p) => p.y !== 3 && p.y !== 10))
  addLine(Array.from({ length: 12 }, (_, index) => ({ x: index + 6, y: 5 })).filter((p) => p.x !== 10 && p.x !== 14))
  addLine(Array.from({ length: 11 }, (_, index) => ({ x: 17, y: index + 3 })).filter((p) => p.y !== 8 && p.y !== 12))
  addLine(Array.from({ length: 15 }, (_, index) => ({ x: index + 3, y: 11 })).filter((p) => p.x !== 6 && p.x !== 15))
  addLine([
    { x: 11, y: 7 },
    { x: 12, y: 7 },
    { x: 13, y: 7 },
    { x: 11, y: 8 },
    { x: 20, y: 7 },
    { x: 20, y: 8 },
    { x: 21, y: 8 },
    { x: 3, y: 6 },
    { x: 3, y: 7 },
  ])

  return {
    cols: GRID_COLS,
    rows: GRID_ROWS,
    start: { x: 2, y: 12 },
    waypoints: [
      { x: 9, y: 2 },
      { x: 15, y: 9 },
    ],
    end: { x: 21, y: 3 },
    obstacles,
    allowDiagonal: true,
    preventCornerCutting: true,
  }
}

export function randomizeObstacles(scenario: Scenario, density = 0.18): Scenario {
  const protectedKeys = new Set(
    [scenario.start, ...scenario.waypoints, scenario.end]
      .filter((point): point is Point => point !== null)
      .map(pointKey),
  )
  const obstacles = new Set<string>()
  for (let y = 0; y < scenario.rows; y += 1) {
    for (let x = 0; x < scenario.cols; x += 1) {
      const key = pointKey({ x, y })
      if (!protectedKeys.has(key) && Math.random() < density) obstacles.add(key)
    }
  }
  return { ...scenario, obstacles }
}
