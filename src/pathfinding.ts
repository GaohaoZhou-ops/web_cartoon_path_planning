export const GRID_COLS = 24
export const GRID_ROWS = 15

export type AlgorithmId =
  | 'astar'
  | 'bidirectional-astar'
  | 'theta'
  | 'jps'
  | 'jps-plus'
  | 'dijkstra'
  | 'dstar-lite'
  | 'flow-field'
  | 'bfs'
  | 'greedy'
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
    id: 'bidirectional-astar',
    name: 'Bidirectional A*',
    shortName: 'Bi-A*',
    description: '起终点双向推进，以平衡启发式证明最优会合',
    accent: '#49e2c2',
    accentRgb: '73, 226, 194',
    optimality: '双向最优',
  },
  {
    id: 'theta',
    name: 'Theta*',
    shortName: 'THETA',
    description: '通过视线松弛生成不限于网格边的任意角路径',
    accent: '#f1df68',
    accentRgb: '241, 223, 104',
    optimality: '任意角近优',
  },
  {
    id: 'jps',
    name: 'Jump Point Search',
    shortName: 'JPS',
    description: '沿对称路径跳跃剪枝，快速定位关键转折',
    accent: '#c7a7ff',
    accentRgb: '199, 167, 255',
    optimality: '跳点剪枝最优',
  },
  {
    id: 'jps-plus',
    name: 'Jump Point Search+',
    shortName: 'JPS+',
    description: '预计算静态跳点距离，加速重复路径查询',
    accent: '#e889ff',
    accentRgb: '232, 137, 255',
    optimality: '预处理跳点最优',
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
    id: 'dstar-lite',
    name: 'D* Lite',
    shortName: 'D*L',
    description: '以 g/rhs 增量一致性从目标反向规划',
    accent: '#ff9364',
    accentRgb: '255, 147, 100',
    optimality: '增量最优',
  },
  {
    id: 'flow-field',
    name: 'Flow Field',
    shortName: 'FLOW',
    description: '构建目标积分场，为大量单位共享方向指引',
    accent: '#6da8ff',
    accentRgb: '109, 168, 255',
    optimality: '积分场最优',
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

  peek(): HeapNode | undefined {
    return this.data[0]
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
  bidirectional?: BidirectionalSearch
  dstar?: DStarSearch
  jpsPlus?: JpsPlusSearch
}

interface DirectionSearch {
  heap: MinHeap
  openKeys: Set<string>
  closedKeys: Set<string>
  gScore: Map<string, number>
  cameFrom: Map<string, string>
  insertionOrder: number
}

interface BidirectionalSearch {
  reverse: DirectionSearch
  bestCost: number
  meetingKey: string | null
}

interface DStarSearch {
  gScore: Map<string, number>
  rhsScore: Map<string, number>
  openVersion: Map<string, number>
  nextVersion: number
  km: number
}

interface JpsPlusEntry {
  limit: number
  jumpPoint: Point | null
}

interface JpsPlusSearch {
  lookup: Map<string, JpsPlusEntry>
}

interface JpsPlusCacheEntry {
  signature: string
  lookup: Map<string, JpsPlusEntry>
}

const jpsPlusLookupCache = new WeakMap<Scenario, JpsPlusCacheEntry>()

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
  const reverseSearch = runner.id === 'dstar-lite' || runner.id === 'flow-field'
  const root = reverseSearch ? target : start
  const rootKey = pointKey(root)
  const heap = new MinHeap()
  const segment: SegmentSearch = {
    start,
    target,
    heap,
    queue: [root],
    queueHead: 0,
    openKeys: new Set([rootKey]),
    closedKeys: new Set(),
    discovered: new Set([rootKey]),
    gScore: new Map([[rootKey, 0]]),
    cameFrom: new Map(),
    insertionOrder: 1,
  }

  if (runner.id === 'bidirectional-astar') {
    const targetKey = pointKey(target)
    const reverseHeap = new MinHeap()
    reverseHeap.push({
      point: target,
      priority: bidirectionalPriority(target, start, target, false, scenario),
      secondary: 0,
      g: 0,
      order: 0,
    })
    segment.bidirectional = {
      reverse: {
        heap: reverseHeap,
        openKeys: new Set([targetKey]),
        closedKeys: new Set(),
        gScore: new Map([[targetKey, 0]]),
        cameFrom: new Map(),
        insertionOrder: 1,
      },
      bestCost: Number.POSITIVE_INFINITY,
      meetingKey: null,
    }
    heap.push({
      point: start,
      priority: bidirectionalPriority(start, start, target, true, scenario),
      secondary: 0,
      g: 0,
      order: 0,
    })
  } else if (runner.id === 'dstar-lite') {
    segment.heap = new MinHeap()
    segment.openKeys.clear()
    segment.gScore.clear()
    segment.discovered.clear()
    segment.dstar = {
      gScore: new Map(),
      rhsScore: new Map([[pointKey(target), 0]]),
      openVersion: new Map(),
      nextVersion: 1,
      km: 0,
    }
    insertDStar(segment, target, scenario)
  } else if (runner.id === 'flow-field') {
    heap.push({ point: target, priority: 0, secondary: 0, g: 0, order: 0 })
  } else if (runner.id !== 'bfs') {
    const h = searchHeuristic(runner.id, start, target, scenario)
    heap.push({
      point: start,
      priority: runner.id === 'dijkstra' ? 0 : h,
      secondary: runner.id === 'greedy' ? 0 : h,
      g: 0,
      order: 0,
    })
  }

  if (runner.id === 'jps-plus') {
    segment.jpsPlus = { lookup: getJpsPlusLookup(scenario) }
  }

  runner.segment = segment
  runner.frontier =
    segment.bidirectional
      ? new Set([...segment.openKeys, ...segment.bidirectional.reverse.openKeys])
      : segment.openKeys
  const initialGenerated = segment.bidirectional ? 2 : 1
  runner.generated += initialGenerated
  runner.openPeak = Math.max(runner.openPeak, initialGenerated)
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

  if (runner.id === 'bidirectional-astar') {
    executeBidirectionalStep(runner, scenario)
    return
  }
  if (runner.id === 'dstar-lite') {
    executeDStarStep(runner, scenario)
    return
  }
  if (runner.id === 'flow-field') {
    executeFlowFieldStep(runner, scenario)
    return
  }

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

  if (runner.id === 'jps') {
    expandJumpSuccessors(runner, scenario, current, currentKey)
    return
  }
  if (runner.id === 'jps-plus') {
    expandJpsPlusSuccessors(runner, scenario, current, currentKey)
    return
  }

  const neighbors = getNeighbors(current, scenario)
  let updated = 0
  for (const neighbor of neighbors) {
    const neighborKey = pointKey(neighbor.point)
    if (segment.closedKeys.has(neighborKey)) continue

    let tentativeG = (segment.gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + neighbor.cost
    let parentKey = currentKey

    if (runner.id === 'theta' && scenario.allowDiagonal) {
      const currentParentKey = segment.cameFrom.get(currentKey)
      if (currentParentKey) {
        const currentParent = keyPoint(currentParentKey)
        if (hasLineOfSight(currentParent, neighbor.point, scenario)) {
          tentativeG =
            (segment.gScore.get(currentParentKey) ?? Number.POSITIVE_INFINITY) +
            euclidean(currentParent, neighbor.point)
          parentKey = currentParentKey
        }
      }
    }

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
    segment.cameFrom.set(neighborKey, parentKey)
    const h = searchHeuristic(runner.id, neighbor.point, segment.target, scenario)
    const priority =
      runner.id === 'astar' || runner.id === 'theta'
        ? tentativeG + h
        : runner.id === 'dijkstra'
          ? tentativeG
          : h
    const secondary =
      runner.id === 'astar' || runner.id === 'theta'
        ? h
        : runner.id === 'greedy'
          ? tentativeG
          : 0
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

function executeBidirectionalStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.bidirectional!
  const forward: DirectionSearch = {
    heap: segment.heap,
    openKeys: segment.openKeys,
    closedKeys: segment.closedKeys,
    gScore: segment.gScore,
    cameFrom: segment.cameFrom,
    insertionOrder: segment.insertionOrder,
  }
  const forwardTop = peekDirection(forward)
  const reverseTop = peekDirection(state.reverse)

  if (
    Number.isFinite(state.bestCost) &&
    (!forwardTop || !reverseTop || forwardTop.priority + reverseTop.priority >= state.bestCost - 1e-9)
  ) {
    finishBidirectionalSegment(runner, scenario)
    return
  }
  if (!forwardTop || !reverseTop) {
    if (Number.isFinite(state.bestCost)) finishBidirectionalSegment(runner, scenario)
    else failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
    return
  }

  const priorityDelta = forwardTop.priority - reverseTop.priority
  const expandingForward =
    Math.abs(priorityDelta) <= 1e-9
      ? forward.closedKeys.size <= state.reverse.closedKeys.size
      : priorityDelta < 0
  const wave = expandingForward ? forward : state.reverse
  const other = expandingForward ? state.reverse : forward
  const node = popDirection(wave)!
  const current = node.point
  const currentKey = pointKey(current)
  wave.openKeys.delete(currentKey)
  wave.closedKeys.add(currentKey)
  runner.current = current
  runner.relaxed = []
  runner.visited.add(currentKey)
  runner.expansions += 1

  updateBidirectionalMeeting(state, currentKey, wave, other)
  let updated = 0
  for (const neighbor of getNeighbors(current, scenario)) {
    const neighborKey = pointKey(neighbor.point)
    if (wave.closedKeys.has(neighborKey)) continue
    const tentativeG = node.g + neighbor.cost
    const knownG = wave.gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY
    if (tentativeG + 1e-9 >= knownG) continue

    wave.gScore.set(neighborKey, tentativeG)
    wave.cameFrom.set(neighborKey, currentKey)
    const priority =
      tentativeG +
      bidirectionalPriority(
        neighbor.point,
        segment.start,
        segment.target,
        expandingForward,
        scenario,
      )
    wave.heap.push({
      point: neighbor.point,
      priority,
      secondary: heuristic(
        neighbor.point,
        expandingForward ? segment.target : segment.start,
        scenario.allowDiagonal,
      ),
      g: tentativeG,
      order: wave.insertionOrder++,
    })
    if (!wave.openKeys.has(neighborKey)) runner.generated += 1
    wave.openKeys.add(neighborKey)
    runner.relaxations += 1
    runner.relaxed.push(neighbor.point)
    updateBidirectionalMeeting(state, neighborKey, wave, other)
    updated += 1
  }

  if (expandingForward) segment.insertionOrder = wave.insertionOrder
  runner.frontier = new Set([...segment.openKeys, ...state.reverse.openKeys])
  runner.openPeak = Math.max(
    runner.openPeak,
    segment.openKeys.size + state.reverse.openKeys.size,
  )
  runner.action = `${expandingForward ? '起点侧' : '终点侧'}展开 ${formatPoint(current)} · 更新 ${updated} 个邻居`

  const nextForwardTop = peekDirection(forward)
  const nextReverseTop = peekDirection(state.reverse)
  if (
    Number.isFinite(state.bestCost) &&
    (!nextForwardTop ||
      !nextReverseTop ||
      nextForwardTop.priority + nextReverseTop.priority >= state.bestCost - 1e-9)
  ) {
    finishBidirectionalSegment(runner, scenario)
  } else if (!nextForwardTop || !nextReverseTop) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
  }
}

function peekDirection(wave: DirectionSearch) {
  while (wave.heap.size > 0) {
    const node = wave.heap.peek()!
    const key = pointKey(node.point)
    const bestG = wave.gScore.get(key)
    if (wave.closedKeys.has(key) || bestG === undefined || Math.abs(bestG - node.g) > 1e-9) {
      wave.heap.pop()
      continue
    }
    return node
  }
  return undefined
}

function popDirection(wave: DirectionSearch) {
  const node = peekDirection(wave)
  if (node) wave.heap.pop()
  return node
}

function bidirectionalPriority(
  point: Point,
  start: Point,
  target: Point,
  forward: boolean,
  scenario: Scenario,
) {
  const potential =
    (heuristic(point, target, scenario.allowDiagonal) -
      heuristic(start, point, scenario.allowDiagonal)) /
    2
  return forward ? potential : -potential
}

function updateBidirectionalMeeting(
  state: BidirectionalSearch,
  key: string,
  wave: DirectionSearch,
  other: DirectionSearch,
) {
  const ownG = wave.gScore.get(key)
  const otherG = other.gScore.get(key)
  if (ownG === undefined || otherG === undefined) return
  const candidate = ownG + otherG
  if (candidate + 1e-9 < state.bestCost) {
    state.bestCost = candidate
    state.meetingKey = key
  }
}

function finishBidirectionalSegment(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.bidirectional!
  if (!state.meetingKey || !Number.isFinite(state.bestCost)) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
    return
  }
  const forwardPath = reconstructFrom(segment.cameFrom, pointKey(segment.start), state.meetingKey)
  const reversePath = [keyPoint(state.meetingKey)]
  let key = state.meetingKey
  const targetKey = pointKey(segment.target)
  while (key !== targetKey) {
    const next = state.reverse.cameFrom.get(key)
    if (!next) break
    reversePath.push(keyPoint(next))
    key = next
  }
  if (
    !samePoint(forwardPath[0] ?? null, segment.start) ||
    !samePoint(reversePath[reversePath.length - 1] ?? null, segment.target)
  ) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段双向路径无法回溯`)
    return
  }
  commitSegment(runner, scenario, [...forwardPath, ...reversePath.slice(1)], state.bestCost)
}

function executeFlowFieldStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const node = popNext(runner, segment)
  if (!node) {
    const startKey = pointKey(segment.start)
    const cost = segment.gScore.get(startKey)
    if (cost === undefined) {
      failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
      return
    }
    const path = followPointers(segment.start, segment.target, segment.cameFrom, scenario)
    if (!path) failRunner(runner, `第 ${runner.segmentIndex + 1} 段积分场无法回溯`)
    else commitSegment(runner, scenario, path, cost)
    return
  }

  const current = node.point
  const currentKey = pointKey(current)
  segment.openKeys.delete(currentKey)
  segment.closedKeys.add(currentKey)
  runner.current = current
  runner.relaxed = []
  runner.visited.add(currentKey)
  runner.expansions += 1
  let updated = 0

  for (const neighbor of getNeighbors(current, scenario)) {
    const neighborKey = pointKey(neighbor.point)
    if (segment.closedKeys.has(neighborKey)) continue
    const tentative = node.g + neighbor.cost
    const known = segment.gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY
    if (tentative + 1e-9 >= known) continue
    segment.gScore.set(neighborKey, tentative)
    segment.cameFrom.set(neighborKey, currentKey)
    segment.heap.push({
      point: neighbor.point,
      priority: tentative,
      secondary: 0,
      g: tentative,
      order: segment.insertionOrder++,
    })
    if (!segment.openKeys.has(neighborKey)) runner.generated += 1
    segment.openKeys.add(neighborKey)
    runner.relaxations += 1
    runner.relaxed.push(neighbor.point)
    updated += 1
  }

  runner.openPeak = Math.max(runner.openPeak, segment.openKeys.size)
  runner.action = `积分场扩散 ${formatPoint(current)} · 更新 ${updated} 个方向单元`
}

function executeDStarStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.dstar!
  const startKey = pointKey(segment.start)
  const startG = dstarValue(state.gScore, startKey)
  const startRhs = dstarValue(state.rhsScore, startKey)
  const top = peekDStar(segment)
  const topKey: [number, number] = top
    ? [top.priority, top.secondary]
    : [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const startPriority = calculateDStarKey(segment, segment.start, scenario)

  if (!keyLess(topKey, startPriority) && numbersEqual(startG, startRhs)) {
    if (!Number.isFinite(startG)) {
      failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
      return
    }
    const path = extractDStarPath(segment, scenario)
    if (!path) failRunner(runner, `第 ${runner.segmentIndex + 1} 段 D* 路径无法回溯`)
    else commitSegment(runner, scenario, path, startG)
    return
  }
  if (!top) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
    return
  }

  const node = popDStar(segment)!
  const current = node.point
  const currentKey = pointKey(current)
  const oldKey: [number, number] = [node.priority, node.secondary]
  const newKey = calculateDStarKey(segment, current, scenario)
  runner.current = current
  runner.relaxed = []

  if (keyLess(oldKey, newKey)) {
    insertDStar(segment, current, scenario)
    runner.action = `D* 键值更新 ${formatPoint(current)} · 重新入队`
  } else {
    const currentG = dstarValue(state.gScore, currentKey)
    const currentRhs = dstarValue(state.rhsScore, currentKey)
    if (currentG > currentRhs) {
      state.gScore.set(currentKey, currentRhs)
      for (const predecessor of getNeighbors(current, scenario)) {
        updateDStarVertex(runner, segment, predecessor.point, scenario)
      }
    } else {
      state.gScore.set(currentKey, Number.POSITIVE_INFINITY)
      updateDStarVertex(runner, segment, current, scenario)
      for (const predecessor of getNeighbors(current, scenario)) {
        updateDStarVertex(runner, segment, predecessor.point, scenario)
      }
    }
    runner.visited.add(currentKey)
    runner.expansions += 1
    runner.action = `D* 一致化 ${formatPoint(current)} · 更新 ${runner.relaxed.length} 个前驱`
  }

  runner.frontier = segment.openKeys
  runner.openPeak = Math.max(runner.openPeak, segment.openKeys.size)
}

function dstarValue(values: Map<string, number>, key: string) {
  return values.get(key) ?? Number.POSITIVE_INFINITY
}

function numbersEqual(a: number, b: number) {
  return a === b || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9)
}

function keyLess(a: [number, number], b: [number, number]) {
  if (!numbersEqual(a[0], b[0])) return a[0] < b[0]
  return a[1] < b[1] - 1e-9
}

function calculateDStarKey(
  segment: SegmentSearch,
  point: Point,
  scenario: Scenario,
): [number, number] {
  const state = segment.dstar!
  const key = pointKey(point)
  const minimum = Math.min(dstarValue(state.gScore, key), dstarValue(state.rhsScore, key))
  return [
    minimum + heuristic(segment.start, point, scenario.allowDiagonal) + state.km,
    minimum,
  ]
}

function insertDStar(segment: SegmentSearch, point: Point, scenario: Scenario) {
  const state = segment.dstar!
  const key = pointKey(point)
  const version = state.nextVersion++
  const [priority, secondary] = calculateDStarKey(segment, point, scenario)
  const firstDiscovery = !segment.discovered.has(key)
  segment.discovered.add(key)
  state.openVersion.set(key, version)
  segment.openKeys.add(key)
  segment.heap.push({ point, priority, secondary, g: 0, order: version })
  return firstDiscovery
}

function peekDStar(segment: SegmentSearch) {
  const state = segment.dstar!
  while (segment.heap.size > 0) {
    const node = segment.heap.peek()!
    const key = pointKey(node.point)
    if (state.openVersion.get(key) !== node.order) {
      segment.heap.pop()
      continue
    }
    return node
  }
  return undefined
}

function popDStar(segment: SegmentSearch) {
  const node = peekDStar(segment)
  if (!node) return undefined
  segment.heap.pop()
  const key = pointKey(node.point)
  segment.dstar!.openVersion.delete(key)
  segment.openKeys.delete(key)
  return node
}

function updateDStarVertex(
  runner: SearchRunner,
  segment: SegmentSearch,
  point: Point,
  scenario: Scenario,
) {
  const state = segment.dstar!
  const key = pointKey(point)
  const targetKey = pointKey(segment.target)
  const oldRhs = dstarValue(state.rhsScore, key)
  if (key !== targetKey) {
    let rhs = Number.POSITIVE_INFINITY
    for (const successor of getNeighbors(point, scenario)) {
      rhs = Math.min(rhs, successor.cost + dstarValue(state.gScore, pointKey(successor.point)))
    }
    state.rhsScore.set(key, rhs)
  }
  const newRhs = dstarValue(state.rhsScore, key)
  if (!numbersEqual(oldRhs, newRhs)) {
    runner.relaxations += 1
    runner.relaxed.push(point)
  }

  state.openVersion.delete(key)
  segment.openKeys.delete(key)
  const g = dstarValue(state.gScore, key)
  if (!numbersEqual(g, newRhs)) {
    if (insertDStar(segment, point, scenario)) runner.generated += 1
  }
}

function extractDStarPath(segment: SegmentSearch, scenario: Scenario) {
  const state = segment.dstar!
  const path = [{ ...segment.start }]
  let current = segment.start
  const targetKey = pointKey(segment.target)
  const seen = new Set([pointKey(current)])
  const limit = scenario.cols * scenario.rows + 1
  for (let step = 0; step < limit && pointKey(current) !== targetKey; step += 1) {
    let best: { point: Point; score: number } | null = null
    for (const neighbor of getNeighbors(current, scenario)) {
      const score = neighbor.cost + dstarValue(state.gScore, pointKey(neighbor.point))
      if (!best || score < best.score - 1e-9) best = { point: neighbor.point, score }
    }
    if (!best || !Number.isFinite(best.score) || seen.has(pointKey(best.point))) return null
    current = best.point
    seen.add(pointKey(current))
    path.push(current)
  }
  return pointKey(current) === targetKey ? path : null
}

function followPointers(
  start: Point,
  target: Point,
  pointers: Map<string, string>,
  scenario: Scenario,
) {
  const path = [{ ...start }]
  let key = pointKey(start)
  const targetKey = pointKey(target)
  const seen = new Set([key])
  const limit = scenario.cols * scenario.rows + 1
  for (let step = 0; step < limit && key !== targetKey; step += 1) {
    const next = pointers.get(key)
    if (!next || seen.has(next)) return null
    seen.add(next)
    path.push(keyPoint(next))
    key = next
  }
  return key === targetKey ? path : null
}

function expandJumpSuccessors(
  runner: SearchRunner,
  scenario: Scenario,
  current: Point,
  currentKey: string,
) {
  const segment = runner.segment!
  const candidates = getJumpNeighborCandidates(current, segment, scenario)
  const currentG = segment.gScore.get(currentKey) ?? Number.POSITIVE_INFINITY
  let scanned = 0
  let updated = 0

  for (const candidate of candidates) {
    const jumpPoint = findJumpPoint(candidate, current, segment.target, scenario, () => {
      scanned += 1
    })
    if (!jumpPoint) continue

    const jumpKey = pointKey(jumpPoint)
    if (segment.closedKeys.has(jumpKey)) continue

    const tentativeG = currentG + heuristic(current, jumpPoint, scenario.allowDiagonal)
    const knownG = segment.gScore.get(jumpKey) ?? Number.POSITIVE_INFINITY
    if (tentativeG + 1e-9 >= knownG) continue

    segment.gScore.set(jumpKey, tentativeG)
    segment.cameFrom.set(jumpKey, currentKey)
    const h = heuristic(jumpPoint, segment.target, scenario.allowDiagonal)
    segment.heap.push({
      point: jumpPoint,
      priority: tentativeG + h,
      secondary: h,
      g: tentativeG,
      order: segment.insertionOrder++,
    })
    if (!segment.openKeys.has(jumpKey)) runner.generated += 1
    segment.openKeys.add(jumpKey)
    runner.relaxations += 1
    runner.relaxed.push(jumpPoint)
    updated += 1
  }

  runner.openPeak = Math.max(runner.openPeak, segment.openKeys.size)
  runner.action = `展开跳点 ${formatPoint(current)} · 扫描 ${scanned} 格 / 更新 ${updated} 个跳点`
}

function expandJpsPlusSuccessors(
  runner: SearchRunner,
  scenario: Scenario,
  current: Point,
  currentKey: string,
) {
  const segment = runner.segment!
  const candidates = getJumpNeighborCandidates(current, segment, scenario)
  const currentG = segment.gScore.get(currentKey) ?? Number.POSITIVE_INFINITY
  let updated = 0

  for (const candidate of candidates) {
    const dx = Math.sign(candidate.x - current.x)
    const dy = Math.sign(candidate.y - current.y)
    const entry = segment.jpsPlus!.lookup.get(jpsPlusKey(current, dx, dy))
    if (!entry || entry.limit === 0) continue
    const induced = getGoalInducedJump(current, dx, dy, entry.limit, segment.target, scenario)
    const staticDistance = entry.jumpPoint
      ? Math.max(
          Math.abs(entry.jumpPoint.x - current.x),
          Math.abs(entry.jumpPoint.y - current.y),
        )
      : Number.POSITIVE_INFINITY
    const inducedDistance = induced
      ? Math.max(Math.abs(induced.x - current.x), Math.abs(induced.y - current.y))
      : Number.POSITIVE_INFINITY
    const jumpPoint = inducedDistance <= staticDistance ? induced : entry.jumpPoint
    if (!jumpPoint) continue

    const jumpKey = pointKey(jumpPoint)
    if (segment.closedKeys.has(jumpKey)) continue
    const tentativeG = currentG + heuristic(current, jumpPoint, scenario.allowDiagonal)
    const knownG = segment.gScore.get(jumpKey) ?? Number.POSITIVE_INFINITY
    if (tentativeG + 1e-9 >= knownG) continue

    segment.gScore.set(jumpKey, tentativeG)
    segment.cameFrom.set(jumpKey, currentKey)
    const h = heuristic(jumpPoint, segment.target, scenario.allowDiagonal)
    segment.heap.push({
      point: jumpPoint,
      priority: tentativeG + h,
      secondary: h,
      g: tentativeG,
      order: segment.insertionOrder++,
    })
    if (!segment.openKeys.has(jumpKey)) runner.generated += 1
    segment.openKeys.add(jumpKey)
    runner.relaxations += 1
    runner.relaxed.push(jumpPoint)
    updated += 1
  }

  runner.openPeak = Math.max(runner.openPeak, segment.openKeys.size)
  runner.action = `JPS+ 查询 ${formatPoint(current)} · 命中 ${updated} 个预计算跳点`
}

function getJpsPlusLookup(scenario: Scenario) {
  const signature = jpsPlusScenarioSignature(scenario)
  const cached = jpsPlusLookupCache.get(scenario)
  if (cached?.signature === signature) return cached.lookup
  const lookup = new Map<string, JpsPlusEntry>()
  const directions = scenario.allowDiagonal
    ? [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 0, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
        { x: -1, y: -1 },
        { x: 1, y: -1 },
      ]
    : [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 0, y: -1 },
      ]

  for (let y = 0; y < scenario.rows; y += 1) {
    for (let x = 0; x < scenario.cols; x += 1) {
      const origin = { x, y }
      if (!isWalkable(origin, scenario)) continue
      for (const direction of directions) {
        let limit = 0
        let cursor = origin
        while (canMoveDirection(cursor, direction.x, direction.y, scenario)) {
          cursor = { x: cursor.x + direction.x, y: cursor.y + direction.y }
          limit += 1
        }
        const first = { x: x + direction.x, y: y + direction.y }
        const jumpPoint =
          limit > 0 ? findJumpPoint(first, origin, null, scenario, () => undefined) : null
        lookup.set(jpsPlusKey(origin, direction.x, direction.y), { limit, jumpPoint })
      }
    }
  }
  jpsPlusLookupCache.set(scenario, { signature, lookup })
  return lookup
}

function jpsPlusScenarioSignature(scenario: Scenario) {
  return [
    scenario.cols,
    scenario.rows,
    scenario.allowDiagonal ? 1 : 0,
    scenario.preventCornerCutting ? 1 : 0,
    [...scenario.obstacles].sort().join(';'),
  ].join('|')
}

function jpsPlusKey(point: Point, dx: number, dy: number) {
  return `${pointKey(point)}|${dx},${dy}`
}

function getGoalInducedJump(
  origin: Point,
  dx: number,
  dy: number,
  limit: number,
  target: Point,
  scenario: Scenario,
) {
  const candidates: Array<{ point: Point; steps: number }> = []
  const directSteps = stepsOnRay(origin, target, dx, dy)
  if (directSteps !== null && directSteps <= limit) {
    candidates.push({ point: target, steps: directSteps })
  }

  if (dx !== 0 && dy !== 0) {
    const stepsToX = (target.x - origin.x) / dx
    if (Number.isInteger(stepsToX) && stepsToX > 0 && stepsToX <= limit) {
      const point = { x: target.x, y: origin.y + stepsToX * dy }
      if (isCardinalRayClear(point, target, scenario)) candidates.push({ point, steps: stepsToX })
    }
    const stepsToY = (target.y - origin.y) / dy
    if (Number.isInteger(stepsToY) && stepsToY > 0 && stepsToY <= limit) {
      const point = { x: origin.x + stepsToY * dx, y: target.y }
      if (isCardinalRayClear(point, target, scenario)) candidates.push({ point, steps: stepsToY })
    }
  } else if (!scenario.allowDiagonal) {
    const projectionSteps = dx === 0 ? (target.y - origin.y) / dy : (target.x - origin.x) / dx
    if (
      Number.isInteger(projectionSteps) &&
      projectionSteps > 0 &&
      projectionSteps <= limit
    ) {
      const point = {
        x: origin.x + projectionSteps * dx,
        y: origin.y + projectionSteps * dy,
      }
      if (isCardinalRayClear(point, target, scenario)) {
        candidates.push({ point, steps: projectionSteps })
      }
    }
  }

  candidates.sort((a, b) => a.steps - b.steps)
  return candidates[0]?.point ?? null
}

function stepsOnRay(origin: Point, target: Point, dx: number, dy: number) {
  const deltaX = target.x - origin.x
  const deltaY = target.y - origin.y
  if (dx === 0) {
    if (deltaX !== 0 || Math.sign(deltaY) !== dy) return null
    return Math.abs(deltaY)
  }
  if (dy === 0) {
    if (deltaY !== 0 || Math.sign(deltaX) !== dx) return null
    return Math.abs(deltaX)
  }
  if (Math.abs(deltaX) !== Math.abs(deltaY)) return null
  if (Math.sign(deltaX) !== dx || Math.sign(deltaY) !== dy) return null
  return Math.abs(deltaX)
}

function isCardinalRayClear(start: Point, target: Point, scenario: Scenario) {
  const dx = Math.sign(target.x - start.x)
  const dy = Math.sign(target.y - start.y)
  if (dx !== 0 && dy !== 0) return false
  let current = start
  while (!samePoint(current, target)) {
    if (!canMoveDirection(current, dx, dy, scenario)) return false
    current = { x: current.x + dx, y: current.y + dy }
  }
  return true
}

function getJumpNeighborCandidates(
  current: Point,
  segment: SegmentSearch,
  scenario: Scenario,
): Point[] {
  const parentKey = segment.cameFrom.get(pointKey(current))
  if (!parentKey) return getNeighbors(current, scenario).map((neighbor) => neighbor.point)

  const parent = keyPoint(parentKey)
  const dx = Math.sign(current.x - parent.x)
  const dy = Math.sign(current.y - parent.y)
  const candidates: Point[] = []
  const seen = new Set<string>()
  const add = (x: number, y: number) => {
    const point = { x, y }
    const key = pointKey(point)
    if (!seen.has(key) && isWalkable(point, scenario)) {
      seen.add(key)
      candidates.push(point)
    }
  }

  if (!scenario.allowDiagonal) {
    if (dx !== 0) {
      add(current.x, current.y - 1)
      add(current.x, current.y + 1)
      add(current.x + dx, current.y)
    } else if (dy !== 0) {
      add(current.x - 1, current.y)
      add(current.x + 1, current.y)
      add(current.x, current.y + dy)
    }
    return candidates
  }

  if (scenario.preventCornerCutting) {
    if (dx !== 0 && dy !== 0) {
      const verticalOpen = isWalkable({ x: current.x, y: current.y + dy }, scenario)
      const horizontalOpen = isWalkable({ x: current.x + dx, y: current.y }, scenario)
      if (verticalOpen) add(current.x, current.y + dy)
      if (horizontalOpen) add(current.x + dx, current.y)
      if (verticalOpen && horizontalOpen) add(current.x + dx, current.y + dy)
    } else if (dx !== 0) {
      const forwardOpen = isWalkable({ x: current.x + dx, y: current.y }, scenario)
      const topOpen = isWalkable({ x: current.x, y: current.y + 1 }, scenario)
      const bottomOpen = isWalkable({ x: current.x, y: current.y - 1 }, scenario)
      if (forwardOpen) {
        add(current.x + dx, current.y)
        if (topOpen) add(current.x + dx, current.y + 1)
        if (bottomOpen) add(current.x + dx, current.y - 1)
      }
      if (topOpen) add(current.x, current.y + 1)
      if (bottomOpen) add(current.x, current.y - 1)
    } else if (dy !== 0) {
      const forwardOpen = isWalkable({ x: current.x, y: current.y + dy }, scenario)
      const rightOpen = isWalkable({ x: current.x + 1, y: current.y }, scenario)
      const leftOpen = isWalkable({ x: current.x - 1, y: current.y }, scenario)
      if (forwardOpen) {
        add(current.x, current.y + dy)
        if (rightOpen) add(current.x + 1, current.y + dy)
        if (leftOpen) add(current.x - 1, current.y + dy)
      }
      if (rightOpen) add(current.x + 1, current.y)
      if (leftOpen) add(current.x - 1, current.y)
    }
    return candidates
  }

  if (dx !== 0 && dy !== 0) {
    add(current.x, current.y + dy)
    add(current.x + dx, current.y)
    add(current.x + dx, current.y + dy)
    if (!isWalkable({ x: current.x - dx, y: current.y }, scenario)) {
      add(current.x - dx, current.y + dy)
    }
    if (!isWalkable({ x: current.x, y: current.y - dy }, scenario)) {
      add(current.x + dx, current.y - dy)
    }
  } else if (dx !== 0) {
    add(current.x + dx, current.y)
    if (!isWalkable({ x: current.x, y: current.y + 1 }, scenario)) {
      add(current.x + dx, current.y + 1)
    }
    if (!isWalkable({ x: current.x, y: current.y - 1 }, scenario)) {
      add(current.x + dx, current.y - 1)
    }
  } else if (dy !== 0) {
    add(current.x, current.y + dy)
    if (!isWalkable({ x: current.x + 1, y: current.y }, scenario)) {
      add(current.x + 1, current.y + dy)
    }
    if (!isWalkable({ x: current.x - 1, y: current.y }, scenario)) {
      add(current.x - 1, current.y + dy)
    }
  }
  return candidates
}

function findJumpPoint(
  point: Point,
  parent: Point,
  target: Point | null,
  scenario: Scenario,
  onScan: () => void,
): Point | null {
  if (!isWalkable(point, scenario)) return null
  onScan()
  if (target && samePoint(point, target)) return point

  const dx = point.x - parent.x
  const dy = point.y - parent.y
  const walkable = (x: number, y: number) => isWalkable({ x, y }, scenario)

  if (!scenario.allowDiagonal) {
    if (dx !== 0) {
      if (
        (walkable(point.x, point.y - 1) && !walkable(point.x - dx, point.y - 1)) ||
        (walkable(point.x, point.y + 1) && !walkable(point.x - dx, point.y + 1))
      ) {
        return point
      }
    } else if (dy !== 0) {
      if (
        (walkable(point.x - 1, point.y) && !walkable(point.x - 1, point.y - dy)) ||
        (walkable(point.x + 1, point.y) && !walkable(point.x + 1, point.y - dy))
      ) {
        return point
      }
      if (
        findJumpPoint({ x: point.x + 1, y: point.y }, point, target, scenario, onScan) ||
        findJumpPoint({ x: point.x - 1, y: point.y }, point, target, scenario, onScan)
      ) {
        return point
      }
    }
    return findJumpPoint(
      { x: point.x + dx, y: point.y + dy },
      point,
      target,
      scenario,
      onScan,
    )
  }

  if (scenario.preventCornerCutting) {
    if (dx !== 0 && dy !== 0) {
      if (
        findJumpPoint({ x: point.x + dx, y: point.y }, point, target, scenario, onScan) ||
        findJumpPoint({ x: point.x, y: point.y + dy }, point, target, scenario, onScan)
      ) {
        return point
      }
    } else if (dx !== 0) {
      if (
        (walkable(point.x, point.y - 1) && !walkable(point.x - dx, point.y - 1)) ||
        (walkable(point.x, point.y + 1) && !walkable(point.x - dx, point.y + 1))
      ) {
        return point
      }
    } else if (dy !== 0) {
      if (
        (walkable(point.x - 1, point.y) && !walkable(point.x - 1, point.y - dy)) ||
        (walkable(point.x + 1, point.y) && !walkable(point.x + 1, point.y - dy))
      ) {
        return point
      }
    }

    if (walkable(point.x + dx, point.y) && walkable(point.x, point.y + dy)) {
      return findJumpPoint(
        { x: point.x + dx, y: point.y + dy },
        point,
        target,
        scenario,
        onScan,
      )
    }
    return null
  }

  if (dx !== 0 && dy !== 0) {
    if (
      (walkable(point.x - dx, point.y + dy) && !walkable(point.x - dx, point.y)) ||
      (walkable(point.x + dx, point.y - dy) && !walkable(point.x, point.y - dy))
    ) {
      return point
    }
    if (
      findJumpPoint({ x: point.x + dx, y: point.y }, point, target, scenario, onScan) ||
      findJumpPoint({ x: point.x, y: point.y + dy }, point, target, scenario, onScan)
    ) {
      return point
    }
  } else if (dx !== 0) {
    if (
      (walkable(point.x + dx, point.y + 1) && !walkable(point.x, point.y + 1)) ||
      (walkable(point.x + dx, point.y - 1) && !walkable(point.x, point.y - 1))
    ) {
      return point
    }
  } else if (dy !== 0) {
    if (
      (walkable(point.x + 1, point.y + dy) && !walkable(point.x + 1, point.y)) ||
      (walkable(point.x - 1, point.y + dy) && !walkable(point.x - 1, point.y))
    ) {
      return point
    }
  }

  return findJumpPoint(
    { x: point.x + dx, y: point.y + dy },
    point,
    target,
    scenario,
    onScan,
  )
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
  const jumpPath = reconstructPath(segment, targetKey)
  const segmentPath =
    runner.id === 'jps' || runner.id === 'jps-plus' ? expandJumpPath(jumpPath) : jumpPath
  commitSegment(runner, scenario, segmentPath, segment.gScore.get(targetKey) ?? 0)
}

function commitSegment(
  runner: SearchRunner,
  scenario: Scenario,
  segmentPath: Point[],
  segmentCost: number,
) {
  if (runner.path.length === 0) runner.path.push(...segmentPath)
  else runner.path.push(...segmentPath.slice(1))

  runner.pathCost += segmentCost
  runner.completedSegments += 1
  runner.relaxed = []

  const totalSegments = runner.route.length - 1
  if (runner.completedSegments >= totalSegments) {
    runner.status = 'complete'
    runner.frontier = new Set()
    runner.finishedAt = performance.now()
    const pathUnit = runner.id === 'theta' ? '折线段' : '步'
    runner.action = `航路锁定 · ${runner.path.length - 1} ${pathUnit} / 代价 ${runner.pathCost.toFixed(2)}`
    return
  }

  const completed = runner.segmentIndex + 1
  runner.segmentIndex += 1
  initializeSegment(runner, scenario)
  runner.action = `第 ${completed} 段已锁定 · 转入第 ${runner.segmentIndex + 1} 段`
}

function failRunner(runner: SearchRunner, action: string) {
  runner.status = 'failed'
  runner.current = null
  runner.relaxed = []
  runner.frontier = new Set()
  runner.finishedAt = performance.now()
  runner.action = action
}

function reconstructPath(segment: SegmentSearch, targetKey: string) {
  return reconstructFrom(segment.cameFrom, pointKey(segment.start), targetKey)
}

function reconstructFrom(cameFrom: Map<string, string>, rootKey: string, targetKey: string) {
  const result = [keyPoint(targetKey)]
  let currentKey = targetKey
  while (currentKey !== rootKey) {
    const previous = cameFrom.get(currentKey)
    if (!previous) break
    result.push(keyPoint(previous))
    currentKey = previous
  }
  return result.reverse()
}

function expandJumpPath(path: Point[]) {
  if (path.length < 2) return path
  const expanded: Point[] = [{ ...path[0] }]

  for (let index = 1; index < path.length; index += 1) {
    const target = path[index]
    let current = expanded[expanded.length - 1]
    const dx = Math.sign(target.x - current.x)
    const dy = Math.sign(target.y - current.y)

    while (!samePoint(current, target)) {
      current = { x: current.x + dx, y: current.y + dy }
      expanded.push(current)
    }
  }
  return expanded
}

function heuristic(a: Point, b: Point, diagonal: boolean) {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  if (!diagonal) return dx + dy
  const straight = Math.abs(dx - dy)
  const diagonalSteps = Math.min(dx, dy)
  return straight + diagonalSteps * Math.SQRT2
}

function euclidean(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function searchHeuristic(
  id: AlgorithmId,
  point: Point,
  target: Point,
  scenario: Scenario,
) {
  return id === 'theta' && scenario.allowDiagonal
    ? euclidean(point, target)
    : heuristic(point, target, scenario.allowDiagonal)
}

function isWalkable(point: Point, scenario: Scenario) {
  return (
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < scenario.cols &&
    point.y < scenario.rows &&
    !scenario.obstacles.has(pointKey(point))
  )
}

function canMoveDirection(point: Point, dx: number, dy: number, scenario: Scenario) {
  const next = { x: point.x + dx, y: point.y + dy }
  if (!isWalkable(next, scenario)) return false
  if (dx !== 0 && dy !== 0) {
    if (!scenario.allowDiagonal) return false
    if (scenario.preventCornerCutting) {
      if (
        !isWalkable({ x: point.x + dx, y: point.y }, scenario) ||
        !isWalkable({ x: point.x, y: point.y + dy }, scenario)
      ) {
        return false
      }
    }
  }
  return true
}

export function hasLineOfSight(start: Point, target: Point, scenario: Scenario) {
  if (!isWalkable(start, scenario) || !isWalkable(target, scenario)) return false
  if (samePoint(start, target)) return true
  const deltaX = target.x - start.x
  const deltaY = target.y - start.y
  const stepX = Math.sign(deltaX)
  const stepY = Math.sign(deltaY)
  const tDeltaX = deltaX === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(deltaX)
  const tDeltaY = deltaY === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(deltaY)
  let tMaxX = deltaX === 0 ? Number.POSITIVE_INFINITY : tDeltaX / 2
  let tMaxY = deltaY === 0 ? Number.POSITIVE_INFINITY : tDeltaY / 2
  let current = { ...start }

  while (!samePoint(current, target)) {
    if (Math.abs(tMaxX - tMaxY) <= 1e-10) {
      const sideX = { x: current.x + stepX, y: current.y }
      const sideY = { x: current.x, y: current.y + stepY }
      const diagonal = { x: current.x + stepX, y: current.y + stepY }
      if (!isWalkable(diagonal, scenario)) return false
      if (
        scenario.preventCornerCutting &&
        (!isWalkable(sideX, scenario) || !isWalkable(sideY, scenario))
      ) {
        return false
      }
      current = diagonal
      tMaxX += tDeltaX
      tMaxY += tDeltaY
    } else if (tMaxX < tMaxY) {
      current = { x: current.x + stepX, y: current.y }
      if (!isWalkable(current, scenario)) return false
      tMaxX += tDeltaX
    } else {
      current = { x: current.x, y: current.y + stepY }
      if (!isWalkable(current, scenario)) return false
      tMaxY += tDeltaY
    }
  }
  return true
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
    if (!isWalkable(next, scenario)) continue

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
