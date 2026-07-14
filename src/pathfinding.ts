import {
  createLocalPlannerState,
  stepLocalPlanner,
  type LocalPlannerId,
  type LocalPlannerState,
} from './localPlanners'

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
  | 'field-dstar'
  | 'lpa-star'
  | 'ad-star'
  | 'hpa-star'
  | 'hybrid-astar'
  | 'state-lattice'
  | 'fast-marching'
  | 'rrt-star'
  | 'prm'
  | 'teb'
  | 'dwa'
  | 'vfh'
  | 'potential-field'
  | 'trajopt'
export type RunnerStatus = 'ready' | 'running' | 'complete' | 'failed'

export type AlgorithmCategoryId =
  | 'static-grid'
  | 'dynamic-replanning'
  | 'game-pathfinding'
  | 'continuous-navigation'
  | 'local-trajectory'

export interface AlgorithmCategory {
  id: AlgorithmCategoryId
  label: string
  description: string
}

export const ALGORITHM_CATEGORIES: AlgorithmCategory[] = [
  {
    id: 'static-grid',
    label: '静态网格搜索',
    description: '在固定占据栅格上比较启发式、剪枝与任意角搜索',
  },
  {
    id: 'dynamic-replanning',
    label: '动态环境与重新规划',
    description: '复用历史搜索状态，应对局部代价或障碍变化',
  },
  {
    id: 'game-pathfinding',
    label: '游戏寻路',
    description: '面向重复查询、大规模单位与层级地图的路径规划',
  },
  {
    id: 'continuous-navigation',
    label: '连续空间与机器人导航',
    description: '考虑连续几何、运动朝向或数值到达时间场',
  },
  {
    id: 'local-trajectory',
    label: '局部避障与轨迹规划',
    description: '根据局部环境生成速度控制或优化短时轨迹',
  },
]

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
  category: AlgorithmCategoryId
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
    category: 'static-grid',
    name: 'A* Search',
    shortName: 'A*',
    description: '代价 + 启发式，兼顾方向与最优性',
    accent: '#b8f36a',
    accentRgb: '184, 243, 106',
    optimality: '启发式最优',
  },
  {
    id: 'bidirectional-astar',
    category: 'static-grid',
    name: 'Bidirectional A*',
    shortName: 'Bi-A*',
    description: '起终点双向推进，以平衡启发式证明最优会合',
    accent: '#49e2c2',
    accentRgb: '73, 226, 194',
    optimality: '双向最优',
  },
  {
    id: 'theta',
    category: 'static-grid',
    name: 'Theta*',
    shortName: 'THETA',
    description: '通过视线松弛生成不限于网格边的任意角路径',
    accent: '#f1df68',
    accentRgb: '241, 223, 104',
    optimality: '任意角近优',
  },
  {
    id: 'jps',
    category: 'game-pathfinding',
    name: 'Jump Point Search',
    shortName: 'JPS',
    description: '沿对称路径跳跃剪枝，快速定位关键转折',
    accent: '#c7a7ff',
    accentRgb: '199, 167, 255',
    optimality: '跳点剪枝最优',
  },
  {
    id: 'jps-plus',
    category: 'game-pathfinding',
    name: 'Jump Point Search+',
    shortName: 'JPS+',
    description: '预计算静态跳点距离，加速重复路径查询',
    accent: '#e889ff',
    accentRgb: '232, 137, 255',
    optimality: '预处理跳点最优',
  },
  {
    id: 'dijkstra',
    category: 'static-grid',
    name: 'Dijkstra',
    shortName: 'DJK',
    description: '按累计代价向外均匀扩张',
    accent: '#63d8ff',
    accentRgb: '99, 216, 255',
    optimality: '保证最优',
  },
  {
    id: 'dstar-lite',
    category: 'dynamic-replanning',
    name: 'D* Lite',
    shortName: 'D*L',
    description: '以 g/rhs 增量一致性从目标反向规划',
    accent: '#ff9364',
    accentRgb: '255, 147, 100',
    optimality: '增量最优',
  },
  {
    id: 'flow-field',
    category: 'game-pathfinding',
    name: 'Flow Field',
    shortName: 'FLOW',
    description: '构建目标积分场，为大量单位共享方向指引',
    accent: '#6da8ff',
    accentRgb: '109, 168, 255',
    optimality: '积分场最优',
  },
  {
    id: 'hpa-star',
    category: 'game-pathfinding',
    name: 'Hierarchical Pathfinding A*',
    shortName: 'HPA*',
    description: '先搜索分块层级走廊，再在局部网格中逐段细化',
    accent: '#58d68d',
    accentRgb: '88, 214, 141',
    optimality: '层级走廊近优',
  },
  {
    id: 'bfs',
    category: 'static-grid',
    name: 'Breadth-First',
    shortName: 'BFS',
    description: '逐层搜索，优先最少移动步数',
    accent: '#ffb65c',
    accentRgb: '255, 182, 92',
    optimality: '步数最少',
  },
  {
    id: 'greedy',
    category: 'static-grid',
    name: 'Greedy Best-First',
    shortName: 'GBF',
    description: '只追逐目标，速度快但不保证最优',
    accent: '#ff718d',
    accentRgb: '255, 113, 141',
    optimality: '不保证最优',
  },
  {
    id: 'field-dstar',
    category: 'dynamic-replanning',
    name: 'Field D*',
    shortName: 'FD*',
    description: '在反向增量值场上插值，生成连续折线路径',
    accent: '#4ff0a8',
    accentRgb: '79, 240, 168',
    optimality: '插值近优',
  },
  {
    id: 'lpa-star',
    category: 'dynamic-replanning',
    name: 'Lifelong Planning A*',
    shortName: 'LPA*',
    description: '以前向 g/rhs 一致性复用增量搜索状态',
    accent: '#ffd166',
    accentRgb: '255, 209, 102',
    optimality: '增量最优',
  },
  {
    id: 'ad-star',
    category: 'dynamic-replanning',
    name: 'Anytime Dynamic A*',
    shortName: 'AD*',
    description: '从快速有界解逐轮降低 ε，并以 INCONS 修复',
    accent: '#ff5fa2',
    accentRgb: '255, 95, 162',
    optimality: '任意时有界',
  },
  {
    id: 'hybrid-astar',
    category: 'continuous-navigation',
    name: 'Hybrid A*',
    shortName: 'HA*',
    description: '在连续位姿上积分转向原语，并以离散朝向合并状态',
    accent: '#35d0ba',
    accentRgb: '53, 208, 186',
    optimality: '运动学近优',
  },
  {
    id: 'state-lattice',
    category: 'continuous-navigation',
    name: 'State Lattice',
    shortName: 'LAT',
    description: '在位置与朝向格点上搜索预计算的安全运动原语',
    accent: '#8ce99a',
    accentRgb: '140, 233, 154',
    optimality: '格点原语近优',
  },
  {
    id: 'fast-marching',
    category: 'continuous-navigation',
    name: 'Fast Marching Method',
    shortName: 'FMM',
    description: '反向求解 Eikonal 到达时间场，再沿下降方向提取路径',
    accent: '#74c0fc',
    accentRgb: '116, 192, 252',
    optimality: 'Eikonal 数值近优',
  },
  {
    id: 'rrt-star',
    category: 'continuous-navigation',
    name: 'RRT*',
    shortName: 'RRT*',
    description: '确定性混合采样、最优父选择与树重连',
    accent: '#a78bfa',
    accentRgb: '167, 139, 250',
    optimality: '预算内渐近优化',
  },
  {
    id: 'prm',
    category: 'continuous-navigation',
    name: 'Probabilistic Roadmap',
    shortName: 'PRM',
    description: '采样构建路线图，再执行图上的增量最短路查询',
    accent: '#38d9ff',
    accentRgb: '56, 217, 255',
    optimality: '采样路网最短',
  },
  {
    id: 'teb',
    category: 'local-trajectory',
    name: 'Timed Elastic Band',
    shortName: 'TEB',
    description: '以可行参考线初始化时空弹性带，联合优化形状与时间间隔',
    accent: '#ff8fab',
    accentRgb: '255, 143, 171',
    optimality: '时空带局部优化',
  },
  {
    id: 'dwa',
    category: 'local-trajectory',
    name: 'Dynamic Window Approach',
    shortName: 'DWA',
    description: '在速度动态窗口内滚动采样，并执行最优安全短轨迹',
    accent: '#ffca3a',
    accentRgb: '255, 202, 58',
    optimality: '局部滚动优化',
  },
  {
    id: 'vfh',
    category: 'local-trajectory',
    name: 'Vector Field Histogram',
    shortName: 'VFH',
    description: '构建局部极坐标障碍直方图，在安全方向谷中选择航向',
    accent: '#2ec4b6',
    accentRgb: '46, 196, 182',
    optimality: '直方图局部避障',
  },
  {
    id: 'potential-field',
    category: 'local-trajectory',
    name: 'Artificial Potential Field',
    shortName: 'APF',
    description: '叠加目标吸引力与障碍排斥力，并检测局部极小进行恢复',
    accent: '#f77f00',
    accentRgb: '247, 127, 0',
    optimality: '势场局部引导',
  },
  {
    id: 'trajopt',
    category: 'local-trajectory',
    name: 'Trajectory Optimization',
    shortName: 'TrajOpt',
    description: '以信赖域和碰撞代价迭代优化整条二维空间轨迹',
    accent: '#c77dff',
    accentRgb: '199, 125, 255',
    optimality: '轨迹局部优化',
  },
]

const LOCAL_PLANNER_IDS = new Set<AlgorithmId>([
  'teb',
  'dwa',
  'vfh',
  'potential-field',
  'trajopt',
])

function isLocalPlannerId(id: AlgorithmId): id is LocalPlannerId {
  return LOCAL_PLANNER_IDS.has(id)
}

interface HeapNode {
  point: Point
  priority: number
  secondary: number
  g: number
  order: number
  stateKey?: string
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
  lpaStar?: LpaStarSearch
  fieldDStar?: FieldDStarSearch
  adStar?: AdStarSearch
  hpaStar?: HpaStarSearch
  kinematic?: KinematicSearch
  fastMarching?: FastMarchingSearch
  localPlanner?: LocalPlannerState
  rrtStar?: RrtStarSearch
  prm?: PrmSearch
}

type HpaPhase = 'prepare' | 'abstract' | 'corridor' | 'fallback'

interface HpaStarSearch {
  phase: HpaPhase
  clusterSize: number
  clusterCols: number
  clusterRows: number
  adjacency: Map<string, Map<string, number>>
  representatives: Map<string, Point>
  abstractHeap: MinHeap
  abstractOpen: Set<string>
  abstractClosed: Set<string>
  abstractG: Map<string, number>
  abstractParent: Map<string, string>
  abstractOrder: number
  corridor: Set<string>
  fallbackUsed: boolean
}

interface KinematicNode {
  key: string
  point: Point
  theta: number
  g: number
  geometricCost: number
  parentKey: string | null
  motion: Point[]
  steering: number
  gear: 1 | -1
}

interface KinematicSearch {
  mode: 'hybrid' | 'lattice'
  headingBins: number
  heap: MinHeap
  nodes: Map<string, KinematicNode>
  openKeys: Set<string>
  closedKeys: Set<string>
  insertionOrder: number
}

interface HybridGoalConnector {
  points: Point[]
  theta: number
  gear: 1 | -1
}

interface FastMarchingSearch {
  arrival: Map<string, number>
  state: Map<string, 'narrow' | 'frozen'>
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

interface IncrementalQueueState {
  gScore: Map<string, number>
  rhsScore: Map<string, number>
  openVersion: Map<string, number>
  nextVersion: number
}

interface LpaStarSearch extends IncrementalQueueState {
  parent: Map<string, string>
}

interface FieldPolicy {
  kind: 'vertex' | 'edge'
  next?: Point
  edgeA?: Point
  edgeB?: Point
  t?: number
}

interface FieldDStarSearch extends IncrementalQueueState {
  policy: Map<string, FieldPolicy>
  km: number
}

interface AdStarRound {
  epsilon: number
  cost: number
  expansions: number
}

interface AdStarSearch extends IncrementalQueueState {
  epsilon: number
  closed: Set<string>
  incons: Set<string>
  policy: Map<string, string>
  phase: 'improve' | 'refine'
  incumbent: Point[] | null
  incumbentCost: number
  firstSolutionCpuMs: number | null
  rounds: AdStarRound[]
}

interface RrtStarNode {
  id: number
  point: Point
  parentId: number | null
  children: Set<number>
  cost: number
}

interface RrtStarSearch {
  nodes: RrtStarNode[]
  attempts: number
  accepted: number
  maxAttempts: number
  finishAttempt: number | null
  firstSolutionAttempt: number | null
  sampleIndex: number
  centerIndex: number
  freeCenters: Point[]
  rotationX: number
  rotationY: number
  goalEdges: Map<number, number>
  bestGoalParent: number | null
  bestCost: number
  rewires: number
  collisionChecks: number
}

interface PrmEdge {
  to: number
  cost: number
}

interface PrmSearch {
  phase: 'sampling' | 'connecting' | 'searching'
  nodes: Point[]
  freeCenters: Point[]
  centerIndex: number
  sampleIndex: number
  attempts: number
  maxAttempts: number
  targetSamples: number
  rotationX: number
  rotationY: number
  connectIndex: number
  adjacency: Map<number, PrmEdge[]>
  edgeKeys: Set<string>
  searchHeap: MinHeap
  pointToNode: Map<string, number>
  searchG: Map<number, number>
  searchParent: Map<number, number>
  searchOpen: Set<number>
  searchClosed: Set<number>
  searchOrder: number
  collisionChecks: number
  startNodeId: number
  targetNodeId: number
  queryNodeIds: Set<number>
  reused: boolean
}

interface PrmRoadmap {
  nodes: Point[]
  adjacency: Map<number, PrmEdge[]>
  edgeKeys: Set<string>
  pointToNode: Map<string, number>
  queryNodeIds: Set<number>
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

export interface GraphVisualNode {
  id: number
  point: Point
  state?: 'idle' | 'open' | 'closed'
}

export interface GraphVisualEdge {
  from: Point
  to: Point
  kind: 'tree' | 'roadmap' | 'rewire'
}

export interface GraphVisual {
  kind: 'rrt-star' | 'prm'
  nodes: GraphVisualNode[]
  edges: GraphVisualEdge[]
  bestPath?: Point[]
  sample?: { point: Point; status: 'accepted' | 'rejected' }
}

export interface SamplingStats {
  phase: string
  attempts: number
  accepted: number
  collisionChecks: number
  edges: number
  rewires: number
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
  previewPath?: Point[]
  previewCost?: number
  graphVisual?: GraphVisual
  samplingStats?: SamplingStats
  samplingTotals?: Omit<SamplingStats, 'phase'>
  anytime?: {
    epsilon: number
    firstSolutionCpuMs: number | null
    rounds: number
    history: Array<{ epsilon: number; cost: number }>
  }
  committedLegs: Array<{
    segmentIndex: number
    pathStartLength: number
    cost: number
  }>
  scenarioConfig: Pick<Scenario, 'cols' | 'rows' | 'allowDiagonal' | 'preventCornerCutting'>
  visualPreparationMs: number
  prmRoadmap?: PrmRoadmap
  kinematicArrival?: { theta: number; gear: 1 | -1 }
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
    committedLegs: [],
    scenarioConfig: {
      cols: scenario.cols,
      rows: scenario.rows,
      allowDiagonal: scenario.allowDiagonal,
      preventCornerCutting: scenario.preventCornerCutting,
    },
    visualPreparationMs: 0,
  }

  initializeSegment(runner, scenario)
  return runner
}

function initializeSegment(runner: SearchRunner, scenario: Scenario) {
  const start = runner.route[runner.segmentIndex]
  const target = runner.route[runner.segmentIndex + 1]
  const reverseSearch =
    runner.id === 'dstar-lite' ||
    runner.id === 'flow-field' ||
    runner.id === 'field-dstar' ||
    runner.id === 'ad-star' ||
    runner.id === 'fast-marching'
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

  runner.segment = segment
  if (samePoint(start, target)) {
    commitSegment(runner, scenario, [{ ...start }], 0)
    return
  }

  if (
    (runner.id === 'rrt-star' ||
      runner.id === 'prm' ||
      runner.id === 'hybrid-astar' ||
      runner.id === 'state-lattice' ||
      isLocalPlannerId(runner.id)) &&
    !scenario.allowDiagonal
  ) {
    failRunner(runner, '连续空间规划器需要启用斜向移动')
    return
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
  } else if (runner.id === 'lpa-star') {
    segment.heap = new MinHeap()
    segment.openKeys.clear()
    segment.gScore.clear()
    segment.discovered.clear()
    segment.lpaStar = {
      gScore: new Map(),
      rhsScore: new Map([[pointKey(start), 0]]),
      openVersion: new Map(),
      nextVersion: 1,
      parent: new Map(),
    }
    insertLpa(segment, start, scenario)
  } else if (runner.id === 'field-dstar') {
    segment.heap = new MinHeap()
    segment.openKeys.clear()
    segment.gScore.clear()
    segment.discovered.clear()
    segment.fieldDStar = {
      gScore: new Map(),
      rhsScore: new Map([[pointKey(target), 0]]),
      openVersion: new Map(),
      nextVersion: 1,
      policy: new Map(),
      km: 0,
    }
    insertFieldDStar(segment, target, scenario)
  } else if (runner.id === 'ad-star') {
    segment.heap = new MinHeap()
    segment.openKeys.clear()
    segment.gScore.clear()
    segment.discovered.clear()
    segment.adStar = {
      gScore: new Map(),
      rhsScore: new Map([[pointKey(target), 0]]),
      openVersion: new Map(),
      nextVersion: 1,
      epsilon: 2.5,
      closed: new Set(),
      incons: new Set(),
      policy: new Map(),
      phase: 'improve',
      incumbent: null,
      incumbentCost: Number.POSITIVE_INFINITY,
      firstSolutionCpuMs: null,
      rounds: [],
    }
    insertAdStar(segment, target, scenario)
    runner.anytime = { epsilon: 2.5, firstSolutionCpuMs: null, rounds: 0, history: [] }
  } else if (runner.id === 'hpa-star') {
    segment.heap = new MinHeap()
    segment.openKeys.clear()
    segment.discovered.clear()
    segment.gScore.clear()
    segment.hpaStar = createHpaStarState(scenario)
  } else if (runner.id === 'hybrid-astar' || runner.id === 'state-lattice') {
    segment.heap = new MinHeap()
    segment.openKeys.clear()
    segment.discovered.clear()
    segment.gScore.clear()
    segment.kinematic = createKinematicState(
      runner.id === 'hybrid-astar' ? 'hybrid' : 'lattice',
      start,
      target,
      runner.kinematicArrival?.theta,
    )
  } else if (runner.id === 'fast-marching') {
    segment.heap = new MinHeap()
    segment.openKeys = new Set([pointKey(target)])
    segment.closedKeys.clear()
    segment.discovered = new Set([pointKey(target)])
    segment.gScore = new Map([[pointKey(target), 0]])
    segment.cameFrom.clear()
    segment.fastMarching = {
      arrival: segment.gScore,
      state: new Map([[pointKey(target), 'narrow']]),
    }
    segment.heap.push({ point: target, priority: 0, secondary: 0, g: 0, order: 0 })
  } else if (isLocalPlannerId(runner.id)) {
    segment.heap = new MinHeap()
    segment.openKeys = new Set([pointKey(start)])
    segment.closedKeys.clear()
    segment.discovered = new Set([pointKey(start)])
    segment.gScore = new Map([[pointKey(start), 0]])
    segment.cameFrom.clear()
    segment.localPlanner = createLocalPlannerState(runner.id, start, target, scenario)
  } else if (runner.id === 'rrt-star') {
    segment.heap = new MinHeap()
    segment.openKeys.clear()
    segment.discovered.clear()
    segment.gScore.clear()
    segment.rrtStar = createRrtStarState(start, target, scenario, runner.segmentIndex)
    syncRrtVisual(runner, segment.rrtStar)
  } else if (runner.id === 'prm') {
    segment.heap = new MinHeap()
    segment.openKeys.clear()
    segment.discovered.clear()
    segment.gScore.clear()
    segment.prm = createPrmState(
      start,
      target,
      scenario,
      runner.segmentIndex,
      runner.route,
      runner.prmRoadmap,
    )
    syncPrmVisual(runner, segment.prm)
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
      : segment.kinematic
        ? projectKinematicKeys(segment.kinematic, segment.kinematic.openKeys, scenario)
      : segment.openKeys
  const initialGenerated = segment.bidirectional
    ? 2
    : segment.prm
      ? segment.prm.reused
        ? 0
        : segment.prm.nodes.length
      : 1
  runner.generated += initialGenerated
  if (!segment.prm) runner.openPeak = Math.max(runner.openPeak, initialGenerated)
  else if (segment.prm.reused) runner.openPeak = Math.max(runner.openPeak, 1)
  runner.current = null
  runner.relaxed = []
  runner.previewPath = undefined
  runner.previewCost = undefined
  runner.action = `准备第 ${runner.segmentIndex + 1} 段 · ${formatPoint(start)} → ${formatPoint(target)}`
}

export function stepRunner(runner: SearchRunner, scenario: Scenario) {
  if (runner.status !== 'running' || !runner.segment) return
  const tickStart = performance.now()
  const visualBefore = runner.visualPreparationMs

  executeSearchStep(runner, scenario)

  const visualCost = runner.visualPreparationMs - visualBefore
  runner.cpuMs += Math.max(0, performance.now() - tickStart - visualCost)
}

export function repairIncrementalRunner(
  runner: SearchRunner,
  scenario: Scenario,
  changedCells: Point[],
) {
  if (runner.id !== 'lpa-star' && runner.id !== 'field-dstar' && runner.id !== 'ad-star') {
    throw new Error(`${runner.id} 不支持增量地图修复`)
  }
  if (!runner.segment || changedCells.length === 0) return
  if (
    scenario.cols !== runner.scenarioConfig.cols ||
    scenario.rows !== runner.scenarioConfig.rows ||
    scenario.allowDiagonal !== runner.scenarioConfig.allowDiagonal ||
    scenario.preventCornerCutting !== runner.scenarioConfig.preventCornerCutting
  ) throw new Error('网格尺寸或移动规则变化需要重新创建规划器')
  const route = [scenario.start, ...scenario.waypoints, scenario.end].filter(
    (point): point is Point => point !== null,
  )
  if (
    !samePoint(route[runner.segmentIndex] ?? null, runner.segment.start) ||
    !samePoint(route[runner.segmentIndex + 1] ?? null, runner.segment.target)
  ) {
    throw new Error('当前航段端点变化需要重新创建规划器')
  }

  if (runner.status === 'complete') {
    const committed = runner.committedLegs.pop()
    if (!committed || committed.segmentIndex !== runner.segmentIndex) {
      throw new Error('无法回滚当前已提交航段')
    }
    runner.path.length = committed.pathStartLength
    runner.pathCost = Math.max(0, runner.pathCost - committed.cost)
    runner.completedSegments = Math.max(0, runner.completedSegments - 1)
  }
  runner.status = 'running'
  runner.finishedAt = null
  runner.previewPath = undefined
  runner.previewCost = undefined
  runner.current = null
  runner.relaxed = []

  const affected = new Map<string, Point>()
  for (const changed of changedCells) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const point = { x: changed.x + dx, y: changed.y + dy }
        if (point.x >= 0 && point.y >= 0 && point.x < scenario.cols && point.y < scenario.rows) {
          affected.set(pointKey(point), point)
        }
      }
    }
  }

  if (runner.id === 'lpa-star') {
    for (const point of affected.values()) updateLpaVertex(runner, runner.segment, point, scenario)
  } else if (runner.id === 'field-dstar') {
    for (const point of affected.values()) updateFieldDStarVertex(runner, runner.segment, point, scenario)
  } else {
    const state = runner.segment.adStar!
    for (const point of affected.values()) updateAdStarVertex(runner, runner.segment, point, scenario)
    state.epsilon = 2.5
    state.phase = 'improve'
    state.incumbent = null
    state.incumbentCost = Number.POSITIVE_INFINITY
    state.firstSolutionCpuMs = null
    state.rounds = []
    const candidates = new Set([...runner.segment.openKeys, ...state.incons])
    runner.segment.heap = new MinHeap()
    runner.segment.openKeys.clear()
    state.openVersion.clear()
    state.incons.clear()
    state.closed.clear()
    for (const key of candidates) {
      if (!numbersEqual(dstarValue(state.gScore, key), dstarValue(state.rhsScore, key))) {
        insertAdStar(runner.segment, keyPoint(key), scenario)
      }
    }
    runner.anytime = { epsilon: 2.5, firstSolutionCpuMs: null, rounds: 0, history: [] }
  }
  const adIncons = runner.segment.adStar?.incons ?? new Set<string>()
  runner.frontier = new Set([...runner.segment.openKeys, ...adIncons])
  runner.openPeak = Math.max(runner.openPeak, runner.frontier.size)
  runner.action = `地图变化 · 复用 ${affected.size} 个局部状态进行增量修复`
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
  if (runner.id === 'lpa-star') {
    executeLpaStarStep(runner, scenario)
    return
  }
  if (runner.id === 'field-dstar') {
    executeFieldDStarStep(runner, scenario)
    return
  }
  if (runner.id === 'ad-star') {
    executeAdStarStep(runner, scenario)
    return
  }
  if (runner.id === 'hpa-star') {
    executeHpaStarStep(runner, scenario)
    return
  }
  if (runner.id === 'hybrid-astar' || runner.id === 'state-lattice') {
    executeKinematicStep(runner, scenario)
    return
  }
  if (runner.id === 'fast-marching') {
    executeFastMarchingStep(runner, scenario)
    return
  }
  if (isLocalPlannerId(runner.id)) {
    executeLocalPlannerStep(runner, scenario)
    return
  }
  if (runner.id === 'rrt-star') {
    executeRrtStarStep(runner, scenario)
    return
  }
  if (runner.id === 'prm') {
    executePrmStep(runner, scenario)
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

function executeLocalPlannerStep(runner: SearchRunner, scenario: Scenario) {
  const state = runner.segment!.localPlanner!
  const result = stepLocalPlanner(state, scenario)

  runner.current = result.current
  runner.relaxed = result.relaxed
  for (const point of result.visited) runner.visited.add(pointKey(point))
  runner.frontier = new Set(
    result.frontier.map((point) =>
      pointKey({
        x: Math.max(0, Math.min(scenario.cols - 1, Math.round(point.x))),
        y: Math.max(0, Math.min(scenario.rows - 1, Math.round(point.y))),
      }),
    ),
  )
  runner.previewPath = result.previewPath.length > 0 ? result.previewPath : undefined
  runner.expansions += result.metrics.expansions
  runner.generated += result.metrics.generated
  runner.relaxations += result.metrics.relaxations
  runner.openPeak = Math.max(runner.openPeak, result.metrics.openSize)
  runner.action = result.action

  if (result.status === 'failed') {
    failRunner(runner, result.action)
    return
  }
  if (result.status === 'complete') {
    if (!result.path || result.pathCost === undefined) {
      failRunner(runner, `第 ${runner.segmentIndex + 1} 段轨迹结果无效 · 无可行路径`)
      return
    }
    commitSegment(runner, scenario, result.path, result.pathCost)
  }
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

function executeLpaStarStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  if (finishLpaIfReady(runner, scenario)) return
  const state = segment.lpaStar!
  const node = popLpa(segment)
  if (!node) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
    return
  }

  const current = node.point
  const currentKey = pointKey(current)
  const oldKey: [number, number] = [node.priority, node.secondary]
  const newKey = calculateLpaKey(segment, current, scenario)
  runner.current = current
  runner.relaxed = []

  if (keyLess(oldKey, newKey)) {
    insertLpa(segment, current, scenario)
    runner.action = `LPA* 键值更新 ${formatPoint(current)} · 重新入队`
  } else {
    const g = dstarValue(state.gScore, currentKey)
    const rhs = dstarValue(state.rhsScore, currentKey)
    if (g > rhs) {
      state.gScore.set(currentKey, rhs)
      for (const successor of getRawNeighbors(current, scenario, true)) {
        updateLpaVertex(runner, segment, successor, scenario)
      }
    } else {
      state.gScore.set(currentKey, Number.POSITIVE_INFINITY)
      updateLpaVertex(runner, segment, current, scenario)
      for (const successor of getRawNeighbors(current, scenario, true)) {
        updateLpaVertex(runner, segment, successor, scenario)
      }
    }
    runner.visited.add(currentKey)
    runner.expansions += 1
    runner.action = `LPA* 一致化 ${formatPoint(current)} · 更新 ${runner.relaxed.length} 个后继`
  }

  runner.frontier = segment.openKeys
  runner.openPeak = Math.max(runner.openPeak, segment.openKeys.size)
  finishLpaIfReady(runner, scenario)
}

function finishLpaIfReady(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.lpaStar!
  const goalKey = pointKey(segment.target)
  const top = peekLpa(segment)
  const topKey: [number, number] = top
    ? [top.priority, top.secondary]
    : [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const goalPriority = calculateLpaKey(segment, segment.target, scenario)
  const goalG = dstarValue(state.gScore, goalKey)
  const goalRhs = dstarValue(state.rhsScore, goalKey)
  if (keyLess(topKey, goalPriority) || !numbersEqual(goalG, goalRhs)) return false
  if (!Number.isFinite(goalG)) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
    return true
  }
  const path = extractLpaPath(segment, scenario)
  if (!path) failRunner(runner, `第 ${runner.segmentIndex + 1} 段 LPA* 路径无法回溯`)
  else commitSegment(runner, scenario, path, goalG)
  return true
}

function calculateLpaKey(
  segment: SegmentSearch,
  point: Point,
  scenario: Scenario,
): [number, number] {
  const state = segment.lpaStar!
  const key = pointKey(point)
  const minimum = Math.min(dstarValue(state.gScore, key), dstarValue(state.rhsScore, key))
  return [minimum + heuristic(point, segment.target, scenario.allowDiagonal), minimum]
}

function insertLpa(segment: SegmentSearch, point: Point, scenario: Scenario) {
  const state = segment.lpaStar!
  const key = pointKey(point)
  const version = state.nextVersion++
  const [priority, secondary] = calculateLpaKey(segment, point, scenario)
  const firstDiscovery = !segment.discovered.has(key)
  segment.discovered.add(key)
  state.openVersion.set(key, version)
  segment.openKeys.add(key)
  segment.heap.push({ point, priority, secondary, g: 0, order: version })
  return firstDiscovery
}

function peekLpa(segment: SegmentSearch) {
  const state = segment.lpaStar!
  while (segment.heap.size > 0) {
    const node = segment.heap.peek()!
    if (state.openVersion.get(pointKey(node.point)) !== node.order) {
      segment.heap.pop()
      continue
    }
    return node
  }
  return undefined
}

function popLpa(segment: SegmentSearch) {
  const node = peekLpa(segment)
  if (!node) return undefined
  segment.heap.pop()
  const key = pointKey(node.point)
  segment.lpaStar!.openVersion.delete(key)
  segment.openKeys.delete(key)
  return node
}

function updateLpaVertex(
  runner: SearchRunner,
  segment: SegmentSearch,
  point: Point,
  scenario: Scenario,
) {
  const state = segment.lpaStar!
  const key = pointKey(point)
  const sourceKey = pointKey(segment.start)
  const oldRhs = dstarValue(state.rhsScore, key)
  if (key !== sourceKey) {
    let rhs = Number.POSITIVE_INFINITY
    let parent: string | null = null
    if (isWalkable(point, scenario)) {
      for (const predecessor of getNeighbors(point, scenario)) {
        const candidate = predecessor.cost + dstarValue(state.gScore, pointKey(predecessor.point))
        if (candidate < rhs - 1e-9) {
          rhs = candidate
          parent = pointKey(predecessor.point)
        }
      }
    }
    state.rhsScore.set(key, rhs)
    if (parent) state.parent.set(key, parent)
    else state.parent.delete(key)
  }
  const rhs = dstarValue(state.rhsScore, key)
  if (!numbersEqual(oldRhs, rhs)) {
    runner.relaxations += 1
    runner.relaxed.push(point)
  }

  state.openVersion.delete(key)
  segment.openKeys.delete(key)
  if (!numbersEqual(dstarValue(state.gScore, key), rhs)) {
    if (insertLpa(segment, point, scenario)) runner.generated += 1
  }
}

function extractLpaPath(segment: SegmentSearch, scenario: Scenario) {
  const state = segment.lpaStar!
  const reversed = [{ ...segment.target }]
  let current = segment.target
  const startKey = pointKey(segment.start)
  const seen = new Set([pointKey(current)])
  const limit = scenario.cols * scenario.rows + 1
  for (let step = 0; step < limit && pointKey(current) !== startKey; step += 1) {
    let best: { point: Point; score: number } | null = null
    for (const predecessor of getNeighbors(current, scenario)) {
      const score = predecessor.cost + dstarValue(state.gScore, pointKey(predecessor.point))
      if (!best || score < best.score - 1e-9) best = { point: predecessor.point, score }
    }
    if (!best || !Number.isFinite(best.score) || seen.has(pointKey(best.point))) return null
    current = best.point
    seen.add(pointKey(current))
    reversed.push(current)
  }
  return pointKey(current) === startKey ? reversed.reverse() : null
}

function executeFieldDStarStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  if (finishFieldDStarIfReady(runner, scenario)) return
  const state = segment.fieldDStar!
  const node = popFieldDStar(segment)
  if (!node) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
    return
  }

  const current = node.point
  const currentKey = pointKey(current)
  const oldKey: [number, number] = [node.priority, node.secondary]
  const newKey = calculateFieldDStarKey(segment, current, scenario)
  runner.current = current
  runner.relaxed = []

  if (keyLess(oldKey, newKey)) {
    insertFieldDStar(segment, current, scenario)
    runner.action = `Field D* 键值更新 ${formatPoint(current)} · 重新入队`
  } else {
    const g = dstarValue(state.gScore, currentKey)
    const rhs = dstarValue(state.rhsScore, currentKey)
    if (g > rhs) {
      state.gScore.set(currentKey, rhs)
      for (const predecessor of getRawNeighbors(current, scenario, true)) {
        updateFieldDStarVertex(runner, segment, predecessor, scenario)
      }
    } else {
      state.gScore.set(currentKey, Number.POSITIVE_INFINITY)
      updateFieldDStarVertex(runner, segment, current, scenario)
      for (const predecessor of getRawNeighbors(current, scenario, true)) {
        updateFieldDStarVertex(runner, segment, predecessor, scenario)
      }
    }
    runner.visited.add(currentKey)
    runner.expansions += 1
    runner.action = `Field D* 插值一致化 ${formatPoint(current)} · 更新 ${runner.relaxed.length} 个场顶点`
  }

  runner.frontier = segment.openKeys
  runner.openPeak = Math.max(runner.openPeak, segment.openKeys.size)
  finishFieldDStarIfReady(runner, scenario)
}

function finishFieldDStarIfReady(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.fieldDStar!
  const startKey = pointKey(segment.start)
  const top = peekFieldDStar(segment)
  const topKey: [number, number] = top
    ? [top.priority, top.secondary]
    : [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const startPriority = calculateFieldDStarKey(segment, segment.start, scenario)
  const startG = dstarValue(state.gScore, startKey)
  const startRhs = dstarValue(state.rhsScore, startKey)
  if (keyLess(topKey, startPriority) || !numbersEqual(startG, startRhs)) return false
  if (!Number.isFinite(startG)) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
    return true
  }
  const path = extractFieldDStarPath(segment, scenario)
  if (!path) failRunner(runner, `第 ${runner.segmentIndex + 1} 段 Field D* 连续路径无法提取`)
  else commitSegment(runner, scenario, path, polylineCost(path))
  return true
}

function calculateFieldDStarKey(
  segment: SegmentSearch,
  point: Point,
  scenario: Scenario,
): [number, number] {
  const state = segment.fieldDStar!
  const key = pointKey(point)
  const minimum = Math.min(dstarValue(state.gScore, key), dstarValue(state.rhsScore, key))
  const h = scenario.allowDiagonal
    ? euclidean(segment.start, point)
    : heuristic(segment.start, point, false)
  return [minimum + h + state.km, minimum]
}

function insertFieldDStar(segment: SegmentSearch, point: Point, scenario: Scenario) {
  const state = segment.fieldDStar!
  const key = pointKey(point)
  const version = state.nextVersion++
  const [priority, secondary] = calculateFieldDStarKey(segment, point, scenario)
  const firstDiscovery = !segment.discovered.has(key)
  segment.discovered.add(key)
  state.openVersion.set(key, version)
  segment.openKeys.add(key)
  segment.heap.push({ point, priority, secondary, g: 0, order: version })
  return firstDiscovery
}

function peekFieldDStar(segment: SegmentSearch) {
  const state = segment.fieldDStar!
  while (segment.heap.size > 0) {
    const node = segment.heap.peek()!
    if (state.openVersion.get(pointKey(node.point)) !== node.order) {
      segment.heap.pop()
      continue
    }
    return node
  }
  return undefined
}

function popFieldDStar(segment: SegmentSearch) {
  const node = peekFieldDStar(segment)
  if (!node) return undefined
  segment.heap.pop()
  const key = pointKey(node.point)
  segment.fieldDStar!.openVersion.delete(key)
  segment.openKeys.delete(key)
  return node
}

function updateFieldDStarVertex(
  runner: SearchRunner,
  segment: SegmentSearch,
  point: Point,
  scenario: Scenario,
) {
  const state = segment.fieldDStar!
  const key = pointKey(point)
  const targetKey = pointKey(segment.target)
  const oldRhs = dstarValue(state.rhsScore, key)
  if (key !== targetKey) {
    const backup = fieldDStarBackup(point, state.gScore, scenario)
    state.rhsScore.set(key, backup.value)
    if (backup.policy) state.policy.set(key, backup.policy)
    else state.policy.delete(key)
  }
  const rhs = dstarValue(state.rhsScore, key)
  if (!numbersEqual(oldRhs, rhs)) {
    runner.relaxations += 1
    runner.relaxed.push(point)
  }
  state.openVersion.delete(key)
  segment.openKeys.delete(key)
  if (!numbersEqual(dstarValue(state.gScore, key), rhs)) {
    if (insertFieldDStar(segment, point, scenario)) runner.generated += 1
  }
}

function fieldDStarBackup(
  point: Point,
  gScore: Map<string, number>,
  scenario: Scenario,
): { value: number; policy: FieldPolicy | null } {
  if (!isWalkable(point, scenario)) {
    return { value: Number.POSITIVE_INFINITY, policy: null }
  }
  let bestValue = Number.POSITIVE_INFINITY
  let bestPolicy: FieldPolicy | null = null
  for (const neighbor of getNeighbors(point, scenario)) {
    const value = neighbor.cost + dstarValue(gScore, pointKey(neighbor.point))
    if (value < bestValue - 1e-9) {
      bestValue = value
      bestPolicy = { kind: 'vertex', next: neighbor.point }
    }
  }
  if (!scenario.allowDiagonal) return { value: bestValue, policy: bestPolicy }

  const pairs = [
    [[1, 0], [1, 1], [0, 1]],
    [[0, 1], [1, 1], [1, 0]],
    [[0, 1], [-1, 1], [-1, 0]],
    [[-1, 0], [-1, 1], [0, 1]],
    [[-1, 0], [-1, -1], [0, -1]],
    [[0, -1], [-1, -1], [-1, 0]],
    [[0, -1], [1, -1], [1, 0]],
    [[1, 0], [1, -1], [0, -1]],
  ] as const
  for (const [aOffset, bOffset, cornerOffset] of pairs) {
    const a = { x: point.x + aOffset[0], y: point.y + aOffset[1] }
    const b = { x: point.x + bOffset[0], y: point.y + bOffset[1] }
    const corner = { x: point.x + cornerOffset[0], y: point.y + cornerOffset[1] }
    if (!isWalkable(a, scenario) || !isWalkable(b, scenario) || !isWalkable(corner, scenario)) {
      continue
    }
    const candidate = interpolateFieldEdge(
      dstarValue(gScore, pointKey(a)),
      dstarValue(gScore, pointKey(b)),
    )
    if (!candidate || candidate.value >= bestValue - 1e-9) continue
    bestValue = candidate.value
    if (candidate.t <= 1e-7) bestPolicy = { kind: 'vertex', next: a }
    else if (candidate.t >= 1 - 1e-7) bestPolicy = { kind: 'vertex', next: b }
    else bestPolicy = { kind: 'edge', edgeA: a, edgeB: b, t: candidate.t }
  }
  return { value: bestValue, policy: bestPolicy }
}

function interpolateFieldEdge(gA: number, gB: number) {
  if (!Number.isFinite(gA) && !Number.isFinite(gB)) return null
  if (!Number.isFinite(gB)) return { value: 1 + gA, t: 0 }
  if (!Number.isFinite(gA)) return { value: Math.SQRT2 + gB, t: 1 }
  const difference = gA - gB
  if (difference <= 0) return { value: 1 + gA, t: 0 }
  if (difference >= Math.SQRT1_2) return { value: Math.SQRT2 + gB, t: 1 }
  const t = difference / Math.sqrt(1 - difference * difference)
  return { value: gA + Math.sqrt(1 - difference * difference), t }
}

function extractFieldDStarPath(segment: SegmentSearch, scenario: Scenario) {
  const state = segment.fieldDStar!
  if (!scenario.allowDiagonal) return extractFieldVertexPath(segment, scenario)
  const path: Point[] = [{ ...segment.start }]
  let current = segment.start
  const targetKey = pointKey(segment.target)
  const seen = new Set([pointKey(current)])
  const limit = scenario.cols * scenario.rows * 3 + 1
  for (let step = 0; step < limit && pointKey(current) !== targetKey; step += 1) {
    const policy = state.policy.get(pointKey(current))
    if (!policy) return null
    if (policy.kind === 'vertex' && policy.next) {
      current = policy.next
      if (seen.has(pointKey(current))) return null
      path.push(current)
      seen.add(pointKey(current))
      continue
    }
    if (!policy.edgeA || !policy.edgeB || policy.t === undefined) return null
    const q = {
      x: policy.edgeA.x + (policy.edgeB.x - policy.edgeA.x) * policy.t,
      y: policy.edgeA.y + (policy.edgeB.y - policy.edgeA.y) * policy.t,
    }
    if (euclidean(path[path.length - 1], q) > 1e-7) path.push(q)
    const incomingSquare = fieldPolicySquare(current, policy.edgeA, policy.edgeB)
    const nextSquare = adjacentFieldSquare(policy.edgeA, policy.edgeB, incomingSquare, scenario)
    const candidateSquares = [nextSquare, incomingSquare].filter(
      (square): square is FieldSquare => Boolean(square && isFieldSquareWalkable(square, scenario)),
    )
    for (const candidateSquare of candidateSquares) {
      const marched = marchFieldDStar(
        q,
        policy.edgeA,
        policy.edgeB,
        candidateSquare,
        state.gScore,
        segment.target,
        scenario,
      )
      if (marched) return [...path, ...marched]
    }
    return extractFieldVertexPath(segment, scenario)
  }
  return pointKey(current) === targetKey ? path : null
}

interface FieldSquare {
  x: number
  y: number
}

function fieldPolicySquare(origin: Point, edgeA: Point, edgeB: Point): FieldSquare {
  return {
    x: Math.min(origin.x, edgeA.x, edgeB.x),
    y: Math.min(origin.y, edgeA.y, edgeB.y),
  }
}

function fieldEdgeKey(a: Point, b: Point) {
  const aKey = pointKey(a)
  const bKey = pointKey(b)
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`
}

function fieldSquareEdges(square: FieldSquare) {
  const nw = { x: square.x, y: square.y }
  const ne = { x: square.x + 1, y: square.y }
  const sw = { x: square.x, y: square.y + 1 }
  const se = { x: square.x + 1, y: square.y + 1 }
  return [
    [nw, ne],
    [ne, se],
    [sw, se],
    [nw, sw],
  ] as Array<[Point, Point]>
}

function isFieldSquareWalkable(square: FieldSquare, scenario: Scenario) {
  return (
    square.x >= 0 &&
    square.y >= 0 &&
    square.x + 1 < scenario.cols &&
    square.y + 1 < scenario.rows &&
    [
      { x: square.x, y: square.y },
      { x: square.x + 1, y: square.y },
      { x: square.x, y: square.y + 1 },
      { x: square.x + 1, y: square.y + 1 },
    ].every((point) => isWalkable(point, scenario))
  )
}

function adjacentFieldSquare(
  edgeA: Point,
  edgeB: Point,
  current: FieldSquare,
  scenario: Scenario,
) {
  let candidate: FieldSquare
  if (edgeA.x === edgeB.x) {
    const edgeX = edgeA.x
    candidate = {
      x: current.x === edgeX ? edgeX - 1 : edgeX,
      y: Math.min(edgeA.y, edgeB.y),
    }
  } else {
    const edgeY = edgeA.y
    candidate = {
      x: Math.min(edgeA.x, edgeB.x),
      y: current.y === edgeY ? edgeY - 1 : edgeY,
    }
  }
  return isFieldSquareWalkable(candidate, scenario) ? candidate : null
}

function marchFieldDStar(
  start: Point,
  entryA: Point,
  entryB: Point,
  initialSquare: FieldSquare,
  gScore: Map<string, number>,
  target: Point,
  scenario: Scenario,
) {
  const result: Point[] = []
  let current = start
  let square = initialSquare
  let incomingKey = fieldEdgeKey(entryA, entryB)
  let currentFieldValue =
    (1 - fieldEdgeParameter(start, entryA, entryB)) * dstarValue(gScore, pointKey(entryA)) +
    fieldEdgeParameter(start, entryA, entryB) * dstarValue(gScore, pointKey(entryB))
  const seen = new Set<string>()
  const limit = scenario.cols * scenario.rows * 4

  for (let step = 0; step < limit; step += 1) {
    if (euclidean(current, target) <= 1e-7) return result
    const stateKey = `${square.x},${square.y}|${incomingKey}|${current.x.toFixed(6)},${current.y.toFixed(6)}`
    if (seen.has(stateKey)) return null
    seen.add(stateKey)
    let best:
      | {
          point: Point
          fieldValue: number
          total: number
          edgeA: Point
          edgeB: Point
          nextSquare: FieldSquare | null
        }
      | null = null
    for (const [edgeA, edgeB] of fieldSquareEdges(square)) {
      if (fieldEdgeKey(edgeA, edgeB) === incomingKey) continue
      const candidate = minimizeFieldExit(current, edgeA, edgeB, gScore)
      if (!candidate || euclidean(current, candidate.point) <= 1e-7) continue
      const isTarget = euclidean(candidate.point, target) <= 1e-6
      if (!isTarget && candidate.fieldValue > currentFieldValue + 1e-6) continue
      const nextSquare = isTarget ? null : adjacentFieldSquare(edgeA, edgeB, square, scenario)
      if (!isTarget && !nextSquare) continue
      if (!best || candidate.total < best.total - 1e-9) {
        best = { ...candidate, edgeA, edgeB, nextSquare }
      }
    }
    if (!best) return null
    const snapped = snapFieldPoint(best.point, best.edgeA, best.edgeB)
    if (!isContinuousEdgeFree(current, snapped, scenario)) return null
    result.push(snapped)
    current = snapped
    currentFieldValue = best.fieldValue
    if (euclidean(current, target) <= 1e-6) {
      result[result.length - 1] = { ...target }
      return result
    }
    if (!best.nextSquare) return null
    incomingKey = fieldEdgeKey(best.edgeA, best.edgeB)
    square = best.nextSquare
  }
  return null
}

function fieldEdgeParameter(point: Point, edgeA: Point, edgeB: Point) {
  const lengthSquared =
    (edgeB.x - edgeA.x) * (edgeB.x - edgeA.x) +
    (edgeB.y - edgeA.y) * (edgeB.y - edgeA.y)
  if (lengthSquared <= 1e-12) return 0
  return Math.max(
    0,
    Math.min(
      1,
      ((point.x - edgeA.x) * (edgeB.x - edgeA.x) +
        (point.y - edgeA.y) * (edgeB.y - edgeA.y)) /
        lengthSquared,
    ),
  )
}

function minimizeFieldExit(
  point: Point,
  edgeA: Point,
  edgeB: Point,
  gScore: Map<string, number>,
) {
  const gA = dstarValue(gScore, pointKey(edgeA))
  const gB = dstarValue(gScore, pointKey(edgeB))
  if (!Number.isFinite(gA) && !Number.isFinite(gB)) return null
  const evaluate = (t: number) => {
    const candidate = {
      x: edgeA.x + (edgeB.x - edgeA.x) * t,
      y: edgeA.y + (edgeB.y - edgeA.y) * t,
    }
    const fieldValue = !Number.isFinite(gA)
      ? gB
      : !Number.isFinite(gB)
        ? gA
        : (1 - t) * gA + t * gB
    return { point: candidate, fieldValue, total: euclidean(point, candidate) + fieldValue }
  }
  if (!Number.isFinite(gA)) return evaluate(1)
  if (!Number.isFinite(gB)) return evaluate(0)
  let left = 0
  let right = 1
  for (let iteration = 0; iteration < 36; iteration += 1) {
    const first = left + (right - left) / 3
    const second = right - (right - left) / 3
    if (evaluate(first).total <= evaluate(second).total) right = second
    else left = first
  }
  const candidates = [evaluate(0), evaluate((left + right) / 2), evaluate(1)]
  return candidates.reduce((best, candidate) =>
    candidate.total < best.total ? candidate : best,
  )
}

function snapFieldPoint(point: Point, edgeA: Point, edgeB: Point) {
  if (euclidean(point, edgeA) <= 1e-6) return { ...edgeA }
  if (euclidean(point, edgeB) <= 1e-6) return { ...edgeB }
  return point
}

function extractFieldVertexPath(segment: SegmentSearch, scenario: Scenario) {
  const state = segment.fieldDStar!
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

function polylineCost(path: Point[]) {
  let cost = 0
  for (let index = 1; index < path.length; index += 1) cost += euclidean(path[index - 1], path[index])
  return cost
}

function executeAdStarStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.adStar!
  if (state.phase === 'refine') {
    prepareAdStarRefinement(runner, segment, scenario)
    return
  }
  if (finishAdStarRoundIfReady(runner, scenario)) return
  const node = popAdStar(segment)
  if (!node) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
    return
  }

  const current = node.point
  const currentKey = pointKey(current)
  const g = dstarValue(state.gScore, currentKey)
  const rhs = dstarValue(state.rhsScore, currentKey)
  runner.current = current
  runner.relaxed = []
  if (g >= rhs) {
    state.closed.add(currentKey)
    state.gScore.set(currentKey, rhs)
    for (const predecessor of getRawNeighbors(current, scenario, true)) {
      updateAdStarVertex(runner, segment, predecessor, scenario)
    }
  } else {
    state.closed.delete(currentKey)
    state.gScore.set(currentKey, Number.POSITIVE_INFINITY)
    updateAdStarVertex(runner, segment, current, scenario)
    for (const predecessor of getRawNeighbors(current, scenario, true)) {
      updateAdStarVertex(runner, segment, predecessor, scenario)
    }
  }
  runner.visited.add(currentKey)
  runner.expansions += 1
  runner.frontier = new Set([...segment.openKeys, ...state.incons])
  runner.openPeak = Math.max(runner.openPeak, runner.frontier.size)
  runner.action = `AD* ε=${state.epsilon.toFixed(1)} 修复 ${formatPoint(current)} · 更新 ${runner.relaxed.length} 个状态`
  finishAdStarRoundIfReady(runner, scenario)
}

function finishAdStarRoundIfReady(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.adStar!
  const startKey = pointKey(segment.start)
  const top = peekAdStar(segment)
  const topKey: [number, number] = top
    ? [top.priority, top.secondary]
    : [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const queryKey = calculateAdStarKey(segment, segment.start, scenario)
  const settled = dstarValue(state.gScore, startKey)
  const rhs = dstarValue(state.rhsScore, startKey)
  const queryUnderconsistent = rhs > settled + 1e-9
  if (keyLess(topKey, queryKey) || queryUnderconsistent) return false
  if (!Number.isFinite(rhs)) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
    return true
  }

  const path = extractAdStarPath(segment, scenario)
  if (!path) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段 AD* 路径无法回溯`)
    return true
  }
  const cost = polylineCost(path)
  state.incumbent = path
  state.incumbentCost = cost
  state.rounds.push({ epsilon: state.epsilon, cost, expansions: runner.expansions })
  if (state.firstSolutionCpuMs === null) state.firstSolutionCpuMs = runner.cpuMs
  runner.previewPath = path
  runner.previewCost = cost
  runner.anytime = {
    epsilon: state.epsilon,
    firstSolutionCpuMs: state.firstSolutionCpuMs,
    rounds: state.rounds.length,
    history: state.rounds.map((round) => ({ epsilon: round.epsilon, cost: round.cost })),
  }

  if (state.epsilon > 1 + 1e-9) {
    state.phase = 'refine'
    runner.action = `AD* 发布 ε=${state.epsilon.toFixed(1)} 有界解 · 代价 ${cost.toFixed(2)}`
    return true
  }
  runner.previewPath = undefined
  runner.previewCost = undefined
  commitSegment(runner, scenario, path, cost)
  return true
}

function calculateAdStarKey(
  segment: SegmentSearch,
  point: Point,
  scenario: Scenario,
): [number, number] {
  const state = segment.adStar!
  const key = pointKey(point)
  const settled = dstarValue(state.gScore, key)
  const rhs = dstarValue(state.rhsScore, key)
  const h = heuristic(segment.start, point, scenario.allowDiagonal)
  return settled >= rhs
    ? [rhs + state.epsilon * h, 1]
    : [settled + h, 0]
}

function insertAdStar(segment: SegmentSearch, point: Point, scenario: Scenario) {
  const state = segment.adStar!
  const key = pointKey(point)
  const version = state.nextVersion++
  const [priority, secondary] = calculateAdStarKey(segment, point, scenario)
  const firstDiscovery = !segment.discovered.has(key)
  segment.discovered.add(key)
  state.openVersion.set(key, version)
  segment.openKeys.add(key)
  segment.heap.push({ point, priority, secondary, g: 0, order: version })
  return firstDiscovery
}

function peekAdStar(segment: SegmentSearch) {
  const state = segment.adStar!
  while (segment.heap.size > 0) {
    const node = segment.heap.peek()!
    if (state.openVersion.get(pointKey(node.point)) !== node.order) {
      segment.heap.pop()
      continue
    }
    return node
  }
  return undefined
}

function popAdStar(segment: SegmentSearch) {
  const node = peekAdStar(segment)
  if (!node) return undefined
  segment.heap.pop()
  const key = pointKey(node.point)
  segment.adStar!.openVersion.delete(key)
  segment.openKeys.delete(key)
  return node
}

function updateAdStarVertex(
  runner: SearchRunner,
  segment: SegmentSearch,
  point: Point,
  scenario: Scenario,
) {
  const state = segment.adStar!
  const key = pointKey(point)
  const targetKey = pointKey(segment.target)
  const oldRhs = dstarValue(state.rhsScore, key)
  if (key !== targetKey) {
    let rhs = Number.POSITIVE_INFINITY
    let next: string | null = null
    if (isWalkable(point, scenario)) {
      for (const successor of getNeighbors(point, scenario)) {
        const candidate = successor.cost + dstarValue(state.gScore, pointKey(successor.point))
        if (candidate < rhs - 1e-9) {
          rhs = candidate
          next = pointKey(successor.point)
        }
      }
    }
    state.rhsScore.set(key, rhs)
    if (next) state.policy.set(key, next)
    else state.policy.delete(key)
  }
  const rhs = dstarValue(state.rhsScore, key)
  if (!numbersEqual(oldRhs, rhs)) {
    runner.relaxations += 1
    runner.relaxed.push(point)
  }
  state.openVersion.delete(key)
  segment.openKeys.delete(key)
  state.incons.delete(key)
  if (numbersEqual(dstarValue(state.gScore, key), rhs)) return

  const firstDiscovery = !segment.discovered.has(key)
  if (state.closed.has(key)) {
    segment.discovered.add(key)
    state.incons.add(key)
  } else {
    insertAdStar(segment, point, scenario)
  }
  if (firstDiscovery) runner.generated += 1
}

function prepareAdStarRefinement(
  runner: SearchRunner,
  segment: SegmentSearch,
  scenario: Scenario,
) {
  const state = segment.adStar!
  state.epsilon = Math.max(1, state.epsilon - 0.5)
  const candidates = new Set([...segment.openKeys, ...state.incons])
  segment.heap = new MinHeap()
  segment.openKeys.clear()
  state.openVersion.clear()
  state.incons.clear()
  state.closed.clear()
  for (const key of candidates) {
    if (!numbersEqual(dstarValue(state.gScore, key), dstarValue(state.rhsScore, key))) {
      insertAdStar(segment, keyPoint(key), scenario)
    }
  }
  state.phase = 'improve'
  runner.frontier = new Set(segment.openKeys)
  runner.openPeak = Math.max(runner.openPeak, runner.frontier.size)
  runner.anytime = {
    epsilon: state.epsilon,
    firstSolutionCpuMs: state.firstSolutionCpuMs,
    rounds: state.rounds.length,
    history: state.rounds.map((round) => ({ epsilon: round.epsilon, cost: round.cost })),
  }
  runner.action = `AD* 降低界限至 ε=${state.epsilon.toFixed(1)} · 合并 OPEN / INCONS`
}

function extractAdStarPath(segment: SegmentSearch, scenario: Scenario) {
  const state = segment.adStar!
  const path = [{ ...segment.start }]
  let current = segment.start
  const targetKey = pointKey(segment.target)
  const seen = new Set([pointKey(current)])
  const limit = scenario.cols * scenario.rows + 1
  for (let step = 0; step < limit && pointKey(current) !== targetKey; step += 1) {
    let best: { point: Point; score: number } | null = null
    for (const successor of getNeighbors(current, scenario)) {
      const score = successor.cost + dstarValue(state.gScore, pointKey(successor.point))
      if (!best || score < best.score - 1e-9) best = { point: successor.point, score }
    }
    if (!best || !Number.isFinite(best.score) || seen.has(pointKey(best.point))) return null
    current = best.point
    seen.add(pointKey(current))
    path.push(current)
  }
  return pointKey(current) === targetKey ? path : null
}

const HPA_CLUSTER_SIZE = 5

function createHpaStarState(scenario: Scenario): HpaStarSearch {
  return {
    phase: 'prepare',
    clusterSize: HPA_CLUSTER_SIZE,
    clusterCols: Math.ceil(scenario.cols / HPA_CLUSTER_SIZE),
    clusterRows: Math.ceil(scenario.rows / HPA_CLUSTER_SIZE),
    adjacency: new Map(),
    representatives: new Map(),
    abstractHeap: new MinHeap(),
    abstractOpen: new Set(),
    abstractClosed: new Set(),
    abstractG: new Map(),
    abstractParent: new Map(),
    abstractOrder: 0,
    corridor: new Set(),
    fallbackUsed: false,
  }
}

function hpaClusterPoint(point: Point, state: HpaStarSearch) {
  return {
    x: Math.floor(point.x / state.clusterSize),
    y: Math.floor(point.y / state.clusterSize),
  }
}

function buildHpaHierarchy(state: HpaStarSearch, scenario: Scenario) {
  state.adjacency.clear()
  state.representatives.clear()
  for (let y = 0; y < scenario.rows; y += 1) {
    for (let x = 0; x < scenario.cols; x += 1) {
      const point = { x, y }
      if (!isWalkable(point, scenario)) continue
      const cluster = hpaClusterPoint(point, state)
      const clusterKey = pointKey(cluster)
      if (!state.representatives.has(clusterKey)) state.representatives.set(clusterKey, point)
      if (!state.adjacency.has(clusterKey)) state.adjacency.set(clusterKey, new Map())

      for (const neighbor of getNeighbors(point, scenario)) {
        const neighborCluster = hpaClusterPoint(neighbor.point, state)
        const neighborKey = pointKey(neighborCluster)
        if (neighborKey === clusterKey) continue
        const edges = state.adjacency.get(clusterKey)!
        const clusterCost = euclidean(cluster, neighborCluster)
        const known = edges.get(neighborKey) ?? Number.POSITIVE_INFINITY
        if (clusterCost < known) edges.set(neighborKey, clusterCost)
      }
    }
  }
}

function executeHpaStarStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.hpaStar!
  if (state.phase === 'prepare') {
    buildHpaHierarchy(state, scenario)
    const startCluster = hpaClusterPoint(segment.start, state)
    const startKey = pointKey(startCluster)
    const targetCluster = hpaClusterPoint(segment.target, state)
    state.abstractG.set(startKey, 0)
    state.abstractOpen.add(startKey)
    state.abstractHeap.push({
      point: startCluster,
      priority: heuristic(startCluster, targetCluster, scenario.allowDiagonal),
      secondary: heuristic(startCluster, targetCluster, scenario.allowDiagonal),
      g: 0,
      order: state.abstractOrder++,
    })
    state.phase = 'abstract'
    runner.current = null
    runner.relaxed = []
    runner.frontier = projectHpaClusters(state, state.abstractOpen)
    runner.openPeak = Math.max(runner.openPeak, state.abstractOpen.size)
    runner.action = `HPA* 构建 ${state.clusterCols}×${state.clusterRows} 层级地图 · 转入抽象搜索`
    return
  }
  if (state.phase === 'abstract') {
    executeHpaAbstractStep(runner, scenario)
    return
  }
  executeHpaGridStep(runner, scenario)
}

function executeHpaAbstractStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.hpaStar!
  let node: HeapNode | undefined
  while (state.abstractHeap.size > 0) {
    const candidate = state.abstractHeap.pop()!
    const key = pointKey(candidate.point)
    if (state.abstractClosed.has(key)) continue
    const best = state.abstractG.get(key)
    if (best === undefined || Math.abs(best - candidate.g) > 1e-9) continue
    node = candidate
    break
  }
  if (!node) {
    beginHpaGridSearch(runner, scenario, null, true)
    return
  }

  const current = node.point
  const currentKey = pointKey(current)
  const targetCluster = hpaClusterPoint(segment.target, state)
  const targetKey = pointKey(targetCluster)
  state.abstractOpen.delete(currentKey)
  state.abstractClosed.add(currentKey)
  const representative = state.representatives.get(currentKey) ?? hpaClusterRepresentative(current, state, scenario)
  runner.current = representative
  runner.relaxed = []
  runner.visited.add(pointKey(representative))
  runner.expansions += 1

  if (currentKey === targetKey) {
    const corridor = new Set<string>()
    let key = currentKey
    corridor.add(key)
    while (state.abstractParent.has(key)) {
      key = state.abstractParent.get(key)!
      corridor.add(key)
    }
    state.corridor = corridor
    beginHpaGridSearch(runner, scenario, corridor, false)
    return
  }

  let updated = 0
  for (const [neighborKey, edgeCost] of state.adjacency.get(currentKey) ?? []) {
    if (state.abstractClosed.has(neighborKey)) continue
    const tentative = node.g + edgeCost
    const known = state.abstractG.get(neighborKey) ?? Number.POSITIVE_INFINITY
    if (tentative + 1e-9 >= known) continue
    const neighbor = keyPoint(neighborKey)
    const firstDiscovery = !state.abstractG.has(neighborKey)
    state.abstractG.set(neighborKey, tentative)
    state.abstractParent.set(neighborKey, currentKey)
    const h = heuristic(neighbor, targetCluster, scenario.allowDiagonal)
    state.abstractHeap.push({
      point: neighbor,
      priority: tentative + h,
      secondary: h,
      g: tentative,
      order: state.abstractOrder++,
    })
    state.abstractOpen.add(neighborKey)
    if (firstDiscovery) runner.generated += 1
    runner.relaxations += 1
    runner.relaxed.push(
      state.representatives.get(neighborKey) ?? hpaClusterRepresentative(neighbor, state, scenario),
    )
    updated += 1
  }
  runner.frontier = projectHpaClusters(state, state.abstractOpen)
  runner.openPeak = Math.max(runner.openPeak, state.abstractOpen.size)
  runner.action = `HPA* 展开分块 [${current.x},${current.y}] · 更新 ${updated} 条层级边`
}

function hpaClusterRepresentative(cluster: Point, state: HpaStarSearch, scenario: Scenario) {
  return {
    x: Math.min(
      scenario.cols - 1,
      cluster.x * state.clusterSize + Math.floor(state.clusterSize / 2),
    ),
    y: Math.min(
      scenario.rows - 1,
      cluster.y * state.clusterSize + Math.floor(state.clusterSize / 2),
    ),
  }
}

function projectHpaClusters(state: HpaStarSearch, keys: Set<string>) {
  return new Set(
    [...keys].map((key) => pointKey(state.representatives.get(key) ?? keyPoint(key))),
  )
}

function beginHpaGridSearch(
  runner: SearchRunner,
  scenario: Scenario,
  corridor: Set<string> | null,
  fallback: boolean,
) {
  const segment = runner.segment!
  const state = segment.hpaStar!
  const startKey = pointKey(segment.start)
  segment.heap = new MinHeap()
  segment.openKeys = new Set([startKey])
  segment.closedKeys.clear()
  segment.discovered = new Set([startKey])
  segment.gScore = new Map([[startKey, 0]])
  segment.cameFrom.clear()
  segment.insertionOrder = 1
  const h = heuristic(segment.start, segment.target, scenario.allowDiagonal)
  segment.heap.push({ point: segment.start, priority: h, secondary: h, g: 0, order: 0 })
  state.phase = fallback ? 'fallback' : 'corridor'
  state.fallbackUsed ||= fallback
  if (corridor) state.corridor = corridor
  runner.generated += 1
  runner.current = null
  runner.relaxed = []
  runner.frontier = segment.openKeys
  runner.openPeak = Math.max(runner.openPeak, segment.openKeys.size)
  runner.action = fallback
    ? 'HPA* 层级走廊未连通 · 启动可靠全局回退'
    : `HPA* 锁定 ${state.corridor.size} 个分块走廊 · 开始局部细化`
}

function executeHpaGridStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.hpaStar!
  const node = popNext(runner, segment)
  if (!node) {
    if (state.phase === 'corridor') {
      beginHpaGridSearch(runner, scenario, null, true)
    } else {
      failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
    }
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
  if (samePoint(current, segment.target)) {
    finishSegment(runner, scenario, currentKey)
    return
  }

  let updated = 0
  for (const neighbor of getNeighbors(current, scenario)) {
    const neighborKey = pointKey(neighbor.point)
    if (segment.closedKeys.has(neighborKey)) continue
    if (
      state.phase === 'corridor' &&
      !state.corridor.has(pointKey(hpaClusterPoint(neighbor.point, state)))
    ) continue
    const tentative = node.g + neighbor.cost
    const known = segment.gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY
    if (tentative + 1e-9 >= known) continue
    const firstDiscovery = !segment.discovered.has(neighborKey)
    segment.discovered.add(neighborKey)
    segment.gScore.set(neighborKey, tentative)
    segment.cameFrom.set(neighborKey, currentKey)
    const h = heuristic(neighbor.point, segment.target, scenario.allowDiagonal)
    segment.heap.push({
      point: neighbor.point,
      priority: tentative + h,
      secondary: h,
      g: tentative,
      order: segment.insertionOrder++,
    })
    segment.openKeys.add(neighborKey)
    if (firstDiscovery) runner.generated += 1
    runner.relaxations += 1
    runner.relaxed.push(neighbor.point)
    updated += 1
  }
  runner.frontier = segment.openKeys
  runner.openPeak = Math.max(runner.openPeak, segment.openKeys.size)
  runner.action = `${state.phase === 'fallback' ? 'HPA* 全局回退' : 'HPA* 走廊细化'} ${formatPoint(current)} · 更新 ${updated} 个邻居`
}

function createKinematicState(
  mode: KinematicSearch['mode'],
  start: Point,
  target: Point,
  initialTheta?: number,
): KinematicSearch {
  const headingBins = mode === 'hybrid' ? 16 : 4
  const inferredTheta = initialTheta ?? Math.atan2(target.y - start.y, target.x - start.x)
  const theta =
    mode === 'hybrid' && initialTheta !== undefined
      ? normalizeAngle(initialTheta)
      : quantizeHeading(inferredTheta, headingBins)
  const key = kinematicStateKey(start, theta, headingBins)
  const startNode: KinematicNode = {
    key,
    point: { ...start },
    theta,
    g: 0,
    geometricCost: 0,
    parentKey: null,
    motion: [],
    steering: 0,
    gear: 1,
  }
  const heap = new MinHeap()
  heap.push({ point: start, priority: euclidean(start, target), secondary: euclidean(start, target), g: 0, order: 0, stateKey: key })
  return {
    mode,
    headingBins,
    heap,
    nodes: new Map([[key, startNode]]),
    openKeys: new Set([key]),
    closedKeys: new Set(),
    insertionOrder: 1,
  }
}

function normalizeAngle(angle: number) {
  let normalized = angle % (Math.PI * 2)
  if (normalized >= Math.PI) normalized -= Math.PI * 2
  if (normalized < -Math.PI) normalized += Math.PI * 2
  return normalized
}

function headingIndex(theta: number, bins: number) {
  const unit = Math.PI * 2 / bins
  return ((Math.round(normalizeAngle(theta) / unit) % bins) + bins) % bins
}

function quantizeHeading(theta: number, bins: number) {
  return normalizeAngle(headingIndex(theta, bins) * (Math.PI * 2 / bins))
}

function kinematicStateKey(point: Point, theta: number, bins: number) {
  return `${Math.round(point.x)},${Math.round(point.y)},${headingIndex(theta, bins)}`
}

function projectKinematicKeys(
  state: KinematicSearch,
  keys: Set<string>,
  scenario: Scenario,
) {
  const result = new Set<string>()
  for (const key of keys) {
    const node = state.nodes.get(key)
    if (!node) continue
    result.add(
      pointKey({
        x: Math.max(0, Math.min(scenario.cols - 1, Math.round(node.point.x))),
        y: Math.max(0, Math.min(scenario.rows - 1, Math.round(node.point.y))),
      }),
    )
  }
  return result
}

function executeKinematicStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.kinematic!
  let current: KinematicNode | undefined
  while (state.heap.size > 0) {
    const heapNode = state.heap.pop()!
    const key = heapNode.stateKey
    if (!key || state.closedKeys.has(key)) continue
    const node = state.nodes.get(key)
    if (!node || Math.abs(node.g - heapNode.g) > 1e-9) continue
    state.openKeys.delete(key)
    current = node
    break
  }
  if (!current) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径（运动学约束）`)
    return
  }

  state.closedKeys.add(current.key)
  runner.current = current.point
  runner.relaxed = []
  runner.visited.add(
    pointKey({ x: Math.round(current.point.x), y: Math.round(current.point.y) }),
  )
  runner.expansions += 1

  const connector =
    state.mode === 'hybrid'
      ? hybridGoalConnector(current, segment.target, scenario)
      : samePoint(current.point, segment.target)
        ? { points: [], theta: current.theta, gear: current.gear }
        : null
  if (connector) {
    const path = reconstructKinematicPath(state, current.key, connector.points)
    runner.kinematicArrival = { theta: connector.theta, gear: connector.gear }
    commitSegment(runner, scenario, path, polylineCost(path))
    return
  }

  const primitives =
    state.mode === 'hybrid'
      ? createHybridPrimitives(current, scenario)
      : createLatticePrimitives(current, scenario)
  let updated = 0
  for (const primitive of primitives) {
    const key = kinematicStateKey(primitive.point, primitive.theta, state.headingBins)
    if (key === current.key || state.closedKeys.has(key)) continue
    const reverseMultiplier = primitive.gear === -1 ? 1.22 : 1
    const steeringPenalty =
      state.mode === 'hybrid'
        ? Math.abs(primitive.steering) * 0.08 + Math.abs(primitive.steering - current.steering) * 0.04
        : Math.abs(primitive.steering) * 0.04
    const tentative = current.g + primitive.cost * reverseMultiplier + steeringPenalty
    const known = state.nodes.get(key)
    if (known && tentative + 1e-9 >= known.g) continue
    const node: KinematicNode = {
      key,
      point: primitive.point,
      theta: primitive.theta,
      g: tentative,
      geometricCost: current.geometricCost + primitive.cost,
      parentKey: current.key,
      motion: primitive.motion,
      steering: primitive.steering,
      gear: primitive.gear,
    }
    const firstDiscovery = !known
    state.nodes.set(key, node)
    state.openKeys.add(key)
    const h = euclidean(node.point, segment.target)
    state.heap.push({
      point: node.point,
      priority: tentative + h,
      secondary: h,
      g: tentative,
      order: state.insertionOrder++,
      stateKey: key,
    })
    if (firstDiscovery) runner.generated += 1
    runner.relaxations += 1
    runner.relaxed.push(node.point)
    updated += 1
  }
  runner.frontier = projectKinematicKeys(state, state.openKeys, scenario)
  runner.openPeak = Math.max(runner.openPeak, state.openKeys.size)
  runner.action = `${state.mode === 'hybrid' ? 'Hybrid A*' : 'State Lattice'} 展开 ${formatContinuousPoint(current.point)} · 更新 ${updated} 个姿态`
}

interface KinematicPrimitive {
  point: Point
  theta: number
  motion: Point[]
  cost: number
  steering: number
  gear: 1 | -1
}

function createHybridPrimitives(current: KinematicNode, scenario: Scenario) {
  const result: KinematicPrimitive[] = []
  for (const gear of [1, -1] as const) {
    for (const curvature of [-0.68, 0, 0.68]) {
      const steps = 8
      const signedStep = gear / steps
      let point = { ...current.point }
      let theta = current.theta
      const motion: Point[] = []
      let valid = true
      for (let step = 0; step < steps; step += 1) {
        const middleTheta = theta + curvature * signedStep * 0.5
        const next = {
          x: point.x + signedStep * Math.cos(middleTheta),
          y: point.y + signedStep * Math.sin(middleTheta),
        }
        if (!isContinuousEdgeFree(point, next, scenario)) {
          valid = false
          break
        }
        motion.push(next)
        point = next
        theta = normalizeAngle(theta + curvature * signedStep)
      }
      if (!valid || motion.length !== steps) continue
      result.push({
        point,
        theta,
        motion,
        cost: 1,
        steering: curvature,
        gear,
      })
    }
  }
  return result
}

function createLatticePrimitives(current: KinematicNode, scenario: Scenario) {
  const result: KinematicPrimitive[] = []
  for (const gear of [1, -1] as const) {
    for (const turn of [-1, 0, 1]) {
      const distance = turn === 0 ? 1 : Math.PI / 2
      const steps = turn === 0 ? 4 : 8
      const motion: Point[] = []
      let previous = current.point
      let valid = true
      for (let step = 1; step <= steps; step += 1) {
        const travelled = gear * distance * (step / steps)
        const next =
          turn === 0
            ? {
                x: current.point.x + travelled * Math.cos(current.theta),
                y: current.point.y + travelled * Math.sin(current.theta),
              }
            : {
                x:
                  current.point.x +
                  (Math.sin(current.theta + turn * travelled) - Math.sin(current.theta)) / turn,
                y:
                  current.point.y +
                  (-Math.cos(current.theta + turn * travelled) + Math.cos(current.theta)) / turn,
              }
        if (!isContinuousEdgeFree(previous, next, scenario)) {
          valid = false
          break
        }
        motion.push(next)
        previous = next
      }
      if (!valid || motion.length !== steps) continue
      const endpoint = {
        x: Math.round(motion[motion.length - 1].x),
        y: Math.round(motion[motion.length - 1].y),
      }
      if (
        !isContinuousEdgeFree(motion[motion.length - 1], endpoint, scenario) ||
        (motion.length > 1 && !isContinuousEdgeFree(motion[motion.length - 2], endpoint, scenario))
      ) continue
      motion[motion.length - 1] = endpoint
      result.push({
        point: endpoint,
        theta: quantizeHeading(current.theta + turn * gear * Math.PI / 2, 4),
        motion,
        cost: distance,
        steering: turn,
        gear,
      })
    }
  }
  return result
}

function hybridGoalConnector(
  current: KinematicNode,
  target: Point,
  scenario: Scenario,
): HybridGoalConnector | null {
  const distance = euclidean(current.point, target)
  if (distance > 1.5) return null
  if (distance <= 1e-9) {
    return { points: [], theta: current.theta, gear: current.gear }
  }

  const candidates = ([1, -1] as const)
    .map((gear) => buildHybridArcConnector(current, target, gear, scenario))
    .filter((candidate): candidate is HybridGoalConnector & { length: number } => candidate !== null)
  if (candidates.length === 0) return null
  candidates.sort((left, right) => left.length - right.length || right.gear - left.gear)
  const { length: _length, ...connector } = candidates[0]
  return connector
}

function buildHybridArcConnector(
  current: KinematicNode,
  target: Point,
  gear: 1 | -1,
  scenario: Scenario,
): (HybridGoalConnector & { length: number }) | null {
  const travelHeading = normalizeAngle(current.theta + (gear === -1 ? Math.PI : 0))
  const deltaX = target.x - current.point.x
  const deltaY = target.y - current.point.y
  const localX = Math.cos(travelHeading) * deltaX + Math.sin(travelHeading) * deltaY
  const localY = -Math.sin(travelHeading) * deltaX + Math.cos(travelHeading) * deltaY
  if (localX <= 1e-6) return null

  const chordSquared = localX * localX + localY * localY
  const curvature = (2 * localY) / chordSquared
  if (Math.abs(curvature) > 0.68 + 1e-9) return null
  const turnAngle = Math.abs(curvature) <= 1e-9 ? 0 : 2 * Math.atan2(localY, localX)
  const length = Math.abs(curvature) <= 1e-9 ? localX : turnAngle / curvature
  if (!Number.isFinite(length) || length <= 0 || length > 1.8) return null

  const steps = Math.max(2, Math.ceil(length / 0.125))
  const points: Point[] = []
  let previous = current.point
  for (let index = 1; index <= steps; index += 1) {
    const travelled = length * (index / steps)
    const localPoint =
      Math.abs(curvature) <= 1e-9
        ? { x: travelled, y: 0 }
        : {
            x: Math.sin(curvature * travelled) / curvature,
            y: (1 - Math.cos(curvature * travelled)) / curvature,
          }
    const point =
      index === steps
        ? { ...target }
        : {
            x:
              current.point.x +
              Math.cos(travelHeading) * localPoint.x -
              Math.sin(travelHeading) * localPoint.y,
            y:
              current.point.y +
              Math.sin(travelHeading) * localPoint.x +
              Math.cos(travelHeading) * localPoint.y,
          }
    if (!isContinuousEdgeFree(previous, point, scenario)) return null
    points.push(point)
    previous = point
  }
  const finalTravelHeading = normalizeAngle(travelHeading + curvature * length)
  return {
    points,
    theta: normalizeAngle(finalTravelHeading - (gear === -1 ? Math.PI : 0)),
    gear,
    length,
  }
}

function reconstructKinematicPath(
  state: KinematicSearch,
  targetKey: string,
  connector: Point[],
) {
  const chain: KinematicNode[] = []
  let key: string | null = targetKey
  const seen = new Set<string>()
  while (key) {
    if (seen.has(key)) break
    seen.add(key)
    const node = state.nodes.get(key)
    if (!node) break
    chain.push(node)
    key = node.parentKey
  }
  chain.reverse()
  const path: Point[] = chain.length > 0 ? [{ ...chain[0].point }] : []
  for (let index = 1; index < chain.length; index += 1) {
    for (const point of chain[index].motion) appendDistinctPoint(path, point)
  }
  for (const point of connector) appendDistinctPoint(path, point)
  return path
}

function appendDistinctPoint(path: Point[], point: Point) {
  if (path.length === 0 || euclidean(path[path.length - 1], point) > 1e-9) {
    path.push({ ...point })
  }
}

function executeFastMarchingStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.fastMarching!
  let node: HeapNode | undefined
  while (segment.heap.size > 0) {
    const candidate = segment.heap.pop()!
    const key = pointKey(candidate.point)
    if (state.state.get(key) === 'frozen') continue
    const best = state.arrival.get(key)
    if (best === undefined || Math.abs(best - candidate.g) > 1e-9) continue
    node = candidate
    break
  }
  if (!node) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段无可行路径`)
    return
  }

  const current = node.point
  const currentKey = pointKey(current)
  state.state.set(currentKey, 'frozen')
  segment.openKeys.delete(currentKey)
  segment.closedKeys.add(currentKey)
  runner.current = current
  runner.relaxed = []
  runner.visited.add(currentKey)
  runner.expansions += 1
  if (samePoint(current, segment.start)) {
    const path = extractFastMarchingPath(segment, scenario)
    if (!path) {
      failRunner(runner, `第 ${runner.segmentIndex + 1} 段 FMM 路径无法回溯`)
      return
    }
    commitSegment(runner, scenario, path, polylineCost(path))
    return
  }

  let updated = 0
  for (const neighbor of getNeighbors(current, scenario)) {
    const point = neighbor.point
    const key = pointKey(point)
    if (state.state.get(key) === 'frozen') continue
    const arrival = solveFastMarchingArrival(point, segment, scenario)
    if (!Number.isFinite(arrival)) continue
    const known = state.arrival.get(key) ?? Number.POSITIVE_INFINITY
    if (arrival + 1e-9 >= known) continue
    const parent = fastMarchingDescentNeighbor(point, segment, scenario)
    if (!parent) continue
    const firstDiscovery = !state.arrival.has(key)
    state.arrival.set(key, arrival)
    state.state.set(key, 'narrow')
    segment.cameFrom.set(key, pointKey(parent))
    segment.openKeys.add(key)
    segment.discovered.add(key)
    segment.heap.push({
      point,
      priority: arrival,
      secondary: euclidean(point, segment.start),
      g: arrival,
      order: segment.insertionOrder++,
    })
    if (firstDiscovery) runner.generated += 1
    runner.relaxations += 1
    runner.relaxed.push(point)
    updated += 1
  }
  runner.frontier = segment.openKeys
  runner.openPeak = Math.max(runner.openPeak, segment.openKeys.size)
  runner.action = `FMM 冻结 ${formatPoint(current)} · 到达时间 ${node.g.toFixed(2)} · 更新 ${updated} 个窄带节点`
}

function frozenArrival(segment: SegmentSearch, point: Point) {
  const key = pointKey(point)
  return segment.fastMarching!.state.get(key) === 'frozen'
    ? segment.fastMarching!.arrival.get(key) ?? Number.POSITIVE_INFINITY
    : Number.POSITIVE_INFINITY
}

function solveFastMarchingArrival(point: Point, segment: SegmentSearch, scenario: Scenario) {
  const horizontal = Math.min(
    frozenArrival(segment, { x: point.x - 1, y: point.y }),
    frozenArrival(segment, { x: point.x + 1, y: point.y }),
  )
  const vertical = Math.min(
    frozenArrival(segment, { x: point.x, y: point.y - 1 }),
    frozenArrival(segment, { x: point.x, y: point.y + 1 }),
  )
  let eikonal = Number.POSITIVE_INFINITY
  if (Number.isFinite(horizontal) && Number.isFinite(vertical)) {
    const difference = Math.abs(horizontal - vertical)
    eikonal =
      difference >= 1
        ? Math.min(horizontal, vertical) + 1
        : (horizontal + vertical + Math.sqrt(Math.max(0, 2 - difference * difference))) / 2
  } else if (Number.isFinite(horizontal) || Number.isFinite(vertical)) {
    eikonal = Math.min(horizontal, vertical) + 1
  }

  if (!scenario.allowDiagonal) return eikonal
  let diagonal = Number.POSITIVE_INFINITY
  for (const neighbor of getNeighbors(point, scenario)) {
    if (neighbor.cost < Math.SQRT2 - 1e-9) continue
    const arrival = frozenArrival(segment, neighbor.point)
    if (Number.isFinite(arrival)) diagonal = Math.min(diagonal, arrival + Math.SQRT2)
  }
  return Math.min(eikonal, diagonal)
}

function fastMarchingDescentNeighbor(
  point: Point,
  segment: SegmentSearch,
  scenario: Scenario,
) {
  let best: { point: Point; score: number } | null = null
  for (const neighbor of getNeighbors(point, scenario)) {
    const arrival = frozenArrival(segment, neighbor.point)
    if (!Number.isFinite(arrival)) continue
    const score = arrival + neighbor.cost
    if (!best || score < best.score - 1e-9) best = { point: neighbor.point, score }
  }
  return best?.point ?? null
}

function extractFastMarchingPath(segment: SegmentSearch, scenario: Scenario) {
  const targetKey = pointKey(segment.target)
  const discrete = [{ ...segment.start }]
  const seen = new Set([pointKey(segment.start)])
  let key = pointKey(segment.start)
  const limit = scenario.cols * scenario.rows + 1
  while (key !== targetKey && discrete.length <= limit) {
    const nextKey = segment.cameFrom.get(key)
    if (!nextKey || seen.has(nextKey)) return null
    seen.add(nextKey)
    discrete.push(keyPoint(nextKey))
    key = nextKey
  }
  if (key !== targetKey || !scenario.allowDiagonal) return key === targetKey ? discrete : null
  return stringPullPath(discrete, scenario)
}

function stringPullPath(path: Point[], scenario: Scenario) {
  if (path.length < 3) return path
  const result = [{ ...path[0] }]
  let anchor = 0
  while (anchor < path.length - 1) {
    let next = anchor + 1
    while (
      next + 1 < path.length &&
      isContinuousEdgeFree(path[anchor], path[next + 1], scenario)
    ) {
      next += 1
    }
    result.push({ ...path[next] })
    anchor = next
  }
  return result
}

function createRrtStarState(
  start: Point,
  target: Point,
  scenario: Scenario,
  segmentIndex: number,
): RrtStarSearch {
  const seed = scenarioSeed('rrt-star', scenario, start, target, segmentIndex)
  const freeCenters = deterministicFreeCenters(scenario, seed)
  const freeCount = freeCenters.length
  return {
    nodes: [{ id: 0, point: { ...start }, parentId: null, children: new Set(), cost: 0 }],
    attempts: 0,
    accepted: 0,
    maxAttempts: Math.max(360, Math.min(900, freeCount * 3 + 120)),
    finishAttempt: null,
    firstSolutionAttempt: null,
    sampleIndex: 1,
    centerIndex: 0,
    freeCenters,
    rotationX: ((seed >>> 8) & 0xffff) / 0x10000,
    rotationY: ((seed >>> 16) & 0xffff) / 0x10000,
    goalEdges: new Map(),
    bestGoalParent: null,
    bestCost: Number.POSITIVE_INFINITY,
    rewires: 0,
    collisionChecks: 0,
  }
}

function executeRrtStarStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.rrtStar!
  if (settleRrtBudget(runner, scenario)) return

  state.attempts += 1
  const sample = nextRrtSample(state, segment.target, scenario)
  const nearest = state.nodes.reduce((best, node) =>
    euclidean(node.point, sample) < euclidean(best.point, sample) - 1e-9 ? node : best,
  )
  const qNew = steerPoint(nearest.point, sample, 1)
  runner.current = qNew
  runner.relaxed = []
  const reject = (message: string) => {
    runner.current = null
    syncRrtVisual(runner, state, { point: qNew, status: 'rejected' })
    runner.action = `RRT* 采样 ${formatContinuousPoint(qNew)} · ${message}`
    settleRrtBudget(runner, scenario)
  }
  if (
    !isContinuousPointFree(qNew, scenario) ||
    state.nodes.some((node) => euclidean(node.point, qNew) < 0.08)
  ) {
    reject('拒绝重复或障碍样本')
    return
  }

  const n = state.nodes.length + 1
  const radius = Math.max(
    1.3,
    Math.min(3.2, 2.8 * Math.sqrt(Math.log(n + 1) / n) * Math.sqrt(Math.max(1, state.freeCenters.length / 45))),
  )
  const near = state.nodes
    .filter((node) => euclidean(node.point, qNew) <= radius)
    .sort((a, b) => a.id - b.id)
  if (!near.some((node) => node.id === nearest.id)) near.push(nearest)
  let parent: RrtStarNode | null = null
  let parentCost = Number.POSITIVE_INFINITY
  for (const candidate of near) {
    const edgeCost = euclidean(candidate.point, qNew)
    const cost = candidate.cost + edgeCost
    if (cost >= parentCost - 1e-9) continue
    state.collisionChecks += 1
    if (!isContinuousEdgeFree(candidate.point, qNew, scenario)) continue
    parent = candidate
    parentCost = cost
  }
  if (!parent) {
    reject('局部连接被障碍阻断')
    return
  }

  const node: RrtStarNode = {
    id: state.nodes.length,
    point: qNew,
    parentId: parent.id,
    children: new Set(),
    cost: parentCost,
  }
  state.nodes.push(node)
  parent.children.add(node.id)
  state.accepted += 1
  runner.expansions += 1
  runner.generated += 1
  runner.relaxed.push(parent.point)

  for (const candidate of near) {
    if (candidate.id === parent.id || candidate.id === 0) continue
    const edgeCost = euclidean(node.point, candidate.point)
    const proposed = node.cost + edgeCost
    if (proposed >= candidate.cost - 1e-9 || isRrtAncestor(state, candidate.id, node.id)) continue
    state.collisionChecks += 1
    if (!isContinuousEdgeFree(node.point, candidate.point, scenario)) continue
    const oldParent = candidate.parentId === null ? null : state.nodes[candidate.parentId]
    oldParent?.children.delete(candidate.id)
    candidate.parentId = node.id
    node.children.add(candidate.id)
    const delta = proposed - candidate.cost
    propagateRrtCostDelta(state, candidate.id, delta)
    state.rewires += 1
    runner.relaxations += 1
    runner.relaxed.push(candidate.point)
  }

  const goalDistance = euclidean(node.point, segment.target)
  if (goalDistance <= 1.75) {
    state.collisionChecks += 1
    if (isContinuousEdgeFree(node.point, segment.target, scenario)) {
      state.goalEdges.set(node.id, goalDistance)
    }
  }
  refreshRrtBestGoal(state, segment.target)
  if (state.bestGoalParent !== null && state.firstSolutionAttempt === null) {
    state.firstSolutionAttempt = state.attempts
    const tail = Math.max(45, Math.min(110, Math.floor(state.freeCenters.length * 0.3)))
    state.finishAttempt = Math.min(state.maxAttempts, state.attempts + tail)
  }

  runner.openPeak = Math.max(runner.openPeak, state.nodes.length)
  syncRrtVisual(runner, state, { point: qNew, status: 'accepted' })
  runner.action = state.bestGoalParent === null
    ? `RRT* 接受节点 ${formatContinuousPoint(qNew)} · 树规模 ${state.nodes.length}`
    : `RRT* 优化中 · 当前代价 ${state.bestCost.toFixed(2)} / 重连 ${state.rewires}`
  settleRrtBudget(runner, scenario)
}

function settleRrtBudget(runner: SearchRunner, scenario: Scenario) {
  const state = runner.segment!.rrtStar!
  if (
    state.bestGoalParent !== null &&
    state.finishAttempt !== null &&
    state.attempts >= state.finishAttempt
  ) {
    finishRrtStarSegment(runner, scenario)
    return true
  }
  if (state.attempts < state.maxAttempts) return false
  if (state.bestGoalParent !== null) finishRrtStarSegment(runner, scenario)
  else failRunner(runner, `第 ${runner.segmentIndex + 1} 段在采样预算内未找到路径`)
  return true
}

function nextRrtSample(state: RrtStarSearch, target: Point, scenario: Scenario) {
  if (state.attempts % 10 === 0) return { ...target }
  if (state.attempts % 2 === 1 && state.freeCenters.length > 0) {
    const point = state.freeCenters[state.centerIndex % state.freeCenters.length]
    state.centerIndex += 1
    return { ...point }
  }
  const point = haltonScenarioPoint(state.sampleIndex++, state.rotationX, state.rotationY, scenario)
  if (isContinuousPointFree(point, scenario)) return point
  const fallback = state.freeCenters[state.centerIndex % Math.max(1, state.freeCenters.length)]
  state.centerIndex += 1
  return fallback ? { ...fallback } : { ...target }
}

function steerPoint(from: Point, target: Point, stepSize: number) {
  const distance = euclidean(from, target)
  if (distance <= stepSize) return { ...target }
  const scale = stepSize / distance
  return {
    x: from.x + (target.x - from.x) * scale,
    y: from.y + (target.y - from.y) * scale,
  }
}

function isRrtAncestor(state: RrtStarSearch, possibleAncestor: number, nodeId: number) {
  let current: number | null = nodeId
  while (current !== null) {
    if (current === possibleAncestor) return true
    current = state.nodes[current].parentId
  }
  return false
}

function propagateRrtCostDelta(state: RrtStarSearch, nodeId: number, delta: number) {
  const stack = [nodeId]
  while (stack.length > 0) {
    const current = state.nodes[stack.pop()!]
    current.cost += delta
    current.children.forEach((child) => stack.push(child))
  }
}

function refreshRrtBestGoal(state: RrtStarSearch, target: Point) {
  let bestParent: number | null = null
  let bestCost = Number.POSITIVE_INFINITY
  for (const [nodeId, edgeCost] of state.goalEdges) {
    const cost = state.nodes[nodeId].cost + edgeCost
    if (cost < bestCost - 1e-9 || (Math.abs(cost - bestCost) <= 1e-9 && nodeId < (bestParent ?? Infinity))) {
      bestCost = cost
      bestParent = nodeId
    }
  }
  state.bestGoalParent = bestParent
  state.bestCost = bestCost
  void target
}

function buildRrtPath(state: RrtStarSearch, target: Point) {
  if (state.bestGoalParent === null) return null
  const reversed: Point[] = []
  let node: RrtStarNode | undefined = state.nodes[state.bestGoalParent]
  const seen = new Set<number>()
  while (node) {
    if (seen.has(node.id)) return null
    seen.add(node.id)
    reversed.push({ ...node.point })
    node = node.parentId === null ? undefined : state.nodes[node.parentId]
  }
  const path = reversed.reverse()
  if (euclidean(path[path.length - 1], target) > 1e-7) path.push({ ...target })
  return path
}

function finishRrtStarSegment(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.rrtStar!
  const path = buildRrtPath(state, segment.target)
  if (!path) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段在采样预算内未找到路径`)
    return
  }
  syncRrtVisual(runner, state)
  commitSegment(runner, scenario, path, polylineCost(path))
}

function syncRrtVisual(
  runner: SearchRunner,
  state: RrtStarSearch,
  sample?: { point: Point; status: 'accepted' | 'rejected' },
) {
  const visualStart = performance.now()
  const totals = runner.samplingTotals ?? {
    attempts: 0,
    accepted: 0,
    collisionChecks: 0,
    edges: 0,
    rewires: 0,
  }
  runner.graphVisual = {
    kind: 'rrt-star',
    nodes: state.nodes.map((node) => ({ id: node.id, point: node.point })),
    edges: state.nodes.flatMap((node) =>
      node.parentId === null
        ? []
        : [{ from: state.nodes[node.parentId].point, to: node.point, kind: 'tree' as const }],
    ),
    bestPath: state.bestGoalParent === null ? undefined : buildRrtPath(state, runner.segment?.target ?? state.nodes[0].point) ?? undefined,
    sample,
  }
  runner.previewPath = runner.graphVisual.bestPath
  runner.previewCost = Number.isFinite(state.bestCost) ? state.bestCost : undefined
  runner.samplingStats = {
    phase: state.bestGoalParent === null ? '探索' : '优化',
    attempts: totals.attempts + state.attempts,
    accepted: totals.accepted + state.accepted,
    collisionChecks: totals.collisionChecks + state.collisionChecks,
    edges: totals.edges + Math.max(0, state.nodes.length - 1),
    rewires: totals.rewires + state.rewires,
  }
  runner.visualPreparationMs += performance.now() - visualStart
}

function createPrmState(
  start: Point,
  target: Point,
  scenario: Scenario,
  segmentIndex: number,
  route: Point[],
  cached?: PrmRoadmap,
): PrmSearch {
  const seed = scenarioSeed('prm', scenario, start, target, segmentIndex)
  if (cached) {
    const startNodeId = cached.pointToNode.get(pointKey(start))
    const targetNodeId = cached.pointToNode.get(pointKey(target))
    if (startNodeId === undefined || targetNodeId === undefined) {
      throw new Error('PRM 复用路线图缺少航段端点')
    }
    const searchHeap = new MinHeap()
    searchHeap.push({ point: cached.nodes[startNodeId], priority: 0, secondary: 0, g: 0, order: 0 })
    return {
      phase: 'searching',
      nodes: cached.nodes,
      freeCenters: [],
      centerIndex: 0,
      sampleIndex: 1,
      attempts: 0,
      maxAttempts: 0,
      targetSamples: cached.nodes.length,
      rotationX: 0,
      rotationY: 0,
      connectIndex: cached.nodes.length,
      adjacency: cached.adjacency,
      edgeKeys: cached.edgeKeys,
      searchHeap,
      pointToNode: cached.pointToNode,
      searchG: new Map([[startNodeId, 0]]),
      searchParent: new Map(),
      searchOpen: new Set([startNodeId]),
      searchClosed: new Set(),
      searchOrder: 1,
      collisionChecks: 0,
      startNodeId,
      targetNodeId,
      queryNodeIds: cached.queryNodeIds,
      reused: true,
    }
  }
  const freeCenters = deterministicFreeCenters(scenario, seed)
  const targetSamples = freeCenters.length <= 90
    ? Math.max(2, freeCenters.length)
    : Math.max(70, Math.min(180, Math.ceil(freeCenters.length * 0.58)))
  const nodes: Point[] = []
  for (const point of route) {
    if (!nodes.some((node) => samePoint(node, point))) nodes.push({ ...point })
  }
  if (!nodes.some((node) => samePoint(node, start))) nodes.push({ ...start })
  if (!nodes.some((node) => samePoint(node, target))) nodes.push({ ...target })
  const pointToNode = new Map(nodes.map((point, index) => [pointKey(point), index]))
  const startNodeId = pointToNode.get(pointKey(start))!
  const targetNodeId = pointToNode.get(pointKey(target))!
  const queryNodeIds = new Set(route.map((point) => pointToNode.get(pointKey(point))!))
  return {
    phase: 'sampling',
    nodes,
    freeCenters,
    centerIndex: 0,
    sampleIndex: 1,
    attempts: 0,
    maxAttempts: targetSamples * 5,
    targetSamples,
    rotationX: ((seed >>> 6) & 0xffff) / 0x10000,
    rotationY: ((seed >>> 18) & 0x3fff) / 0x4000,
    connectIndex: 0,
    adjacency: new Map(nodes.map((_, id) => [id, [] as PrmEdge[]])),
    edgeKeys: new Set(),
    searchHeap: new MinHeap(),
    pointToNode,
    searchG: new Map(),
    searchParent: new Map(),
    searchOpen: new Set(),
    searchClosed: new Set(),
    searchOrder: 0,
    collisionChecks: 0,
    startNodeId,
    targetNodeId,
    queryNodeIds,
    reused: false,
  }
}

function executePrmStep(runner: SearchRunner, scenario: Scenario) {
  const segment = runner.segment!
  const state = segment.prm!
  if (state.phase === 'sampling') executePrmSamplingStep(runner, segment, state, scenario)
  else if (state.phase === 'connecting') executePrmConnectingStep(runner, segment, state, scenario)
  else executePrmSearchStep(runner, segment, state, scenario)
}

function executePrmSamplingStep(
  runner: SearchRunner,
  segment: SegmentSearch,
  state: PrmSearch,
  scenario: Scenario,
) {
  if (state.nodes.length >= state.targetSamples || state.attempts >= state.maxAttempts) {
    beginPrmConnecting(runner, state)
    return
  }
  state.attempts += 1
  let sample: Point
  if (state.attempts % 2 === 1 && state.freeCenters.length > 0) {
    sample = { ...state.freeCenters[state.centerIndex % state.freeCenters.length] }
    state.centerIndex += 1
  } else {
    sample = haltonScenarioPoint(state.sampleIndex++, state.rotationX, state.rotationY, scenario)
    if (!isContinuousPointFree(sample, scenario)) {
      const fallback = state.freeCenters[state.centerIndex % Math.max(1, state.freeCenters.length)]
      state.centerIndex += 1
      if (fallback) sample = { ...fallback }
    }
  }
  runner.current = sample
  runner.relaxed = []
  if (
    !isContinuousPointFree(sample, scenario) ||
    state.nodes.some((point) => euclidean(point, sample) < 0.12)
  ) {
    runner.current = null
    runner.action = `PRM 拒绝样本 ${formatContinuousPoint(sample)} · 重复或位于障碍`
    syncPrmVisual(runner, state, { point: sample, status: 'rejected' })
    if (state.attempts >= state.maxAttempts) beginPrmConnecting(runner, state)
    return
  }
  const id = state.nodes.length
  state.nodes.push(sample)
  state.pointToNode.set(pointKey(sample), id)
  state.adjacency.set(id, [])
  runner.generated += 1
  runner.action = `PRM 接受样本 ${formatContinuousPoint(sample)} · ${state.nodes.length}/${state.targetSamples}`
  syncPrmVisual(runner, state, { point: sample, status: 'accepted' })
  if (state.nodes.length >= state.targetSamples) beginPrmConnecting(runner, state)
}

function beginPrmConnecting(runner: SearchRunner, state: PrmSearch) {
  state.phase = 'connecting'
  runner.action = `PRM 采样完成 · ${state.nodes.length} 个路网节点`
  syncPrmVisual(runner, state)
}

function executePrmConnectingStep(
  runner: SearchRunner,
  segment: SegmentSearch,
  state: PrmSearch,
  scenario: Scenario,
) {
  if (state.connectIndex >= state.nodes.length) {
    beginPrmSearch(runner, state)
    return
  }
  const id = state.connectIndex++
  const point = state.nodes[id]
  runner.current = point
  runner.relaxed = []
  const baseK = Math.max(8, Math.min(16, 8 + Math.floor(Math.log2(Math.max(2, state.nodes.length)))))
  const limit = state.queryNodeIds.has(id) ? baseK * 2 : baseK
  const candidates = state.nodes
    .map((other, otherId) => ({ id: otherId, distance: euclidean(point, other) }))
    .filter((candidate) => candidate.id !== id)
    .sort((a, b) => a.distance - b.distance || a.id - b.id)
    .slice(0, limit)
  if (id === state.startNodeId && !candidates.some((candidate) => candidate.id === state.targetNodeId)) {
    candidates.push({
      id: state.targetNodeId,
      distance: euclidean(point, state.nodes[state.targetNodeId]),
    })
  }
  let connected = 0
  for (const candidate of candidates) {
    const a = Math.min(id, candidate.id)
    const b = Math.max(id, candidate.id)
    const edgeKey = `${a}|${b}`
    if (state.edgeKeys.has(edgeKey)) continue
    state.collisionChecks += 1
    if (!isContinuousEdgeFree(point, state.nodes[candidate.id], scenario)) continue
    state.edgeKeys.add(edgeKey)
    state.adjacency.get(id)!.push({ to: candidate.id, cost: candidate.distance })
    state.adjacency.get(candidate.id)!.push({ to: id, cost: candidate.distance })
    runner.relaxed.push(state.nodes[candidate.id])
    connected += 1
  }
  runner.action = `PRM 连接节点 ${id + 1}/${state.nodes.length} · 新增 ${connected} 条边`
  syncPrmVisual(runner, state)
  if (state.connectIndex >= state.nodes.length) beginPrmSearch(runner, state)
  void segment
}

function beginPrmSearch(runner: SearchRunner, state: PrmSearch) {
  state.phase = 'searching'
  state.searchG.set(state.startNodeId, 0)
  state.searchOpen.add(state.startNodeId)
  state.searchHeap.push({
    point: state.nodes[state.startNodeId],
    priority: 0,
    secondary: 0,
    g: 0,
    order: state.searchOrder++,
  })
  runner.openPeak = Math.max(runner.openPeak, 1)
  runner.action = `PRM 路网锁定 · ${state.edgeKeys.size} 条边 / 转入最短路查询`
  runner.prmRoadmap ??= {
    nodes: state.nodes,
    adjacency: state.adjacency,
    edgeKeys: state.edgeKeys,
    pointToNode: state.pointToNode,
    queryNodeIds: state.queryNodeIds,
  }
  syncPrmVisual(runner, state)
}

function executePrmSearchStep(
  runner: SearchRunner,
  segment: SegmentSearch,
  state: PrmSearch,
  scenario: Scenario,
) {
  let node: HeapNode | undefined
  let id = -1
  while (state.searchHeap.size > 0) {
    const candidate = state.searchHeap.pop()!
    const candidateId = state.pointToNode.get(pointKey(candidate.point))
    if (candidateId === undefined || state.searchClosed.has(candidateId)) continue
    if (Math.abs((state.searchG.get(candidateId) ?? Number.POSITIVE_INFINITY) - candidate.g) > 1e-9) continue
    node = candidate
    id = candidateId
    break
  }
  if (!node || id < 0) {
    failRunner(runner, `第 ${runner.segmentIndex + 1} 段当前采样路网未连通`)
    return
  }
  state.searchOpen.delete(id)
  state.searchClosed.add(id)
  runner.current = state.nodes[id]
  runner.relaxed = []
  runner.expansions += 1
  if (id === state.targetNodeId) {
    const path = reconstructPrmPath(state)
    if (!path) failRunner(runner, `第 ${runner.segmentIndex + 1} 段 PRM 路径无法回溯`)
    else {
      syncPrmVisual(runner, state)
      commitSegment(
        runner,
        scenario,
        path,
        state.searchG.get(state.targetNodeId) ?? polylineCost(path),
      )
    }
    return
  }
  const currentG = state.searchG.get(id) ?? Number.POSITIVE_INFINITY
  for (const edge of state.adjacency.get(id) ?? []) {
    if (state.searchClosed.has(edge.to)) continue
    const candidate = currentG + edge.cost
    const known = state.searchG.get(edge.to) ?? Number.POSITIVE_INFINITY
    if (candidate >= known - 1e-9) continue
    state.searchG.set(edge.to, candidate)
    state.searchParent.set(edge.to, id)
    state.searchOpen.add(edge.to)
    state.searchHeap.push({
      point: state.nodes[edge.to],
      priority: candidate,
      secondary: 0,
      g: candidate,
      order: state.searchOrder++,
    })
    runner.relaxations += 1
    runner.relaxed.push(state.nodes[edge.to])
  }
  runner.openPeak = Math.max(runner.openPeak, state.searchOpen.size)
  runner.action = `PRM 图搜索展开 #${id} · 更新 ${runner.relaxed.length} 个邻接节点`
  syncPrmVisual(runner, state)
  void segment
}

function reconstructPrmPath(state: PrmSearch) {
  const reversed = [{ ...state.nodes[state.targetNodeId] }]
  let id = state.targetNodeId
  const seen = new Set([id])
  while (id !== state.startNodeId) {
    const parent = state.searchParent.get(id)
    if (parent === undefined || seen.has(parent)) return null
    id = parent
    seen.add(id)
    reversed.push({ ...state.nodes[id] })
  }
  return reversed.reverse()
}

function syncPrmVisual(
  runner: SearchRunner,
  state: PrmSearch,
  sample?: { point: Point; status: 'accepted' | 'rejected' },
) {
  const visualStart = performance.now()
  const totals = runner.samplingTotals ?? {
    attempts: 0,
    accepted: 0,
    collisionChecks: 0,
    edges: 0,
    rewires: 0,
  }
  const edges: GraphVisualEdge[] = []
  for (const edgeKey of state.edgeKeys) {
    const [a, b] = edgeKey.split('|').map(Number)
    edges.push({ from: state.nodes[a], to: state.nodes[b], kind: 'roadmap' })
  }
  runner.graphVisual = {
    kind: 'prm',
    nodes: state.nodes.map((point, id) => ({
      id,
      point,
      state: state.searchClosed.has(id) ? 'closed' : state.searchOpen.has(id) ? 'open' : 'idle',
    })),
    edges,
    sample,
  }
  runner.samplingStats = {
    phase: state.phase === 'sampling' ? '采样' : state.phase === 'connecting' ? '建图' : '查询',
    attempts: totals.attempts + state.attempts,
    accepted: totals.accepted + (state.reused ? 0 : state.nodes.length),
    collisionChecks: totals.collisionChecks + state.collisionChecks,
    edges: totals.edges + (state.reused ? 0 : state.edgeKeys.size),
    rewires: 0,
  }
  runner.visualPreparationMs += performance.now() - visualStart
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
  accumulateSamplingLeg(runner)
  runner.previewPath = undefined
  runner.previewCost = undefined
  const pathStartLength = runner.path.length
  if (runner.path.length === 0) runner.path.push(...segmentPath)
  else runner.path.push(...segmentPath.slice(1))

  runner.pathCost += segmentCost
  runner.committedLegs.push({
    segmentIndex: runner.segmentIndex,
    pathStartLength,
    cost: segmentCost,
  })
  runner.completedSegments += 1
  runner.relaxed = []

  const totalSegments = runner.route.length - 1
  if (runner.completedSegments >= totalSegments) {
    runner.status = 'complete'
    runner.frontier = new Set()
    runner.finishedAt = performance.now()
    const pathUnit =
      runner.id === 'theta' ||
      runner.id === 'field-dstar' ||
      runner.id === 'hybrid-astar' ||
      runner.id === 'state-lattice' ||
      runner.id === 'fast-marching' ||
      runner.id === 'rrt-star' ||
      runner.id === 'prm' ||
      isLocalPlannerId(runner.id)
        ? '折线段'
        : '步'
    runner.action = `航路锁定 · ${runner.path.length - 1} ${pathUnit} / 代价 ${runner.pathCost.toFixed(2)}`
    return
  }

  const completed = runner.segmentIndex + 1
  runner.segmentIndex += 1
  initializeSegment(runner, scenario)
  runner.action = `第 ${completed} 段已锁定 · 转入第 ${runner.segmentIndex + 1} 段`
}

function accumulateSamplingLeg(runner: SearchRunner) {
  const rrt = runner.segment?.rrtStar
  const prm = runner.segment?.prm
  if (!rrt && !prm) return
  const leg = rrt
    ? {
        attempts: rrt.attempts,
        accepted: rrt.accepted,
        collisionChecks: rrt.collisionChecks,
        edges: Math.max(0, rrt.nodes.length - 1),
        rewires: rrt.rewires,
      }
    : {
        attempts: prm!.attempts,
        accepted: prm!.reused ? 0 : prm!.nodes.length,
        collisionChecks: prm!.collisionChecks,
        edges: prm!.reused ? 0 : prm!.edgeKeys.size,
        rewires: 0,
      }
  const previous = runner.samplingTotals ?? {
    attempts: 0,
    accepted: 0,
    collisionChecks: 0,
    edges: 0,
    rewires: 0,
  }
  runner.samplingTotals = {
    attempts: previous.attempts + leg.attempts,
    accepted: previous.accepted + leg.accepted,
    collisionChecks: previous.collisionChecks + leg.collisionChecks,
    edges: previous.edges + leg.edges,
    rewires: previous.rewires + leg.rewires,
  }
  runner.samplingStats = { phase: '完成', ...runner.samplingTotals }
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

function getRawNeighbors(point: Point, scenario: Scenario, includeDiagonal: boolean) {
  const result: Point[] = []
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if ((dx === 0 && dy === 0) || (!includeDiagonal && dx !== 0 && dy !== 0)) continue
      const next = { x: point.x + dx, y: point.y + dy }
      if (next.x >= 0 && next.y >= 0 && next.x < scenario.cols && next.y < scenario.rows) {
        result.push(next)
      }
    }
  }
  return result
}

export function isContinuousPointFree(point: Point, scenario: Scenario) {
  if (
    point.x < -0.5 + 1e-9 ||
    point.y < -0.5 + 1e-9 ||
    point.x > scenario.cols - 0.5 - 1e-9 ||
    point.y > scenario.rows - 0.5 - 1e-9
  ) {
    return false
  }
  const cell = { x: Math.floor(point.x + 0.5), y: Math.floor(point.y + 0.5) }
  return !scenario.obstacles.has(pointKey(cell))
}

export function isContinuousEdgeFree(start: Point, target: Point, scenario: Scenario) {
  if (!isContinuousPointFree(start, scenario) || !isContinuousPointFree(target, scenario)) return false
  const padding = scenario.preventCornerCutting ? -1e-9 : 1e-8
  const firstX = Math.max(0, Math.floor(Math.min(start.x, target.x) - 0.5))
  const lastX = Math.min(scenario.cols - 1, Math.ceil(Math.max(start.x, target.x) + 0.5))
  const firstY = Math.max(0, Math.floor(Math.min(start.y, target.y) - 0.5))
  const lastY = Math.min(scenario.rows - 1, Math.ceil(Math.max(start.y, target.y) + 0.5))
  for (let y = firstY; y <= lastY; y += 1) {
    for (let x = firstX; x <= lastX; x += 1) {
      if (!scenario.obstacles.has(`${x},${y}`)) continue
      const minX = x - 0.5 + padding
      const maxX = x + 0.5 - padding
      const minY = y - 0.5 + padding
      const maxY = y + 0.5 - padding
      if (minX > maxX || minY > maxY) continue
      if (segmentIntersectsAabb(start, target, minX, maxX, minY, maxY)) return false
    }
  }
  return true
}

function segmentIntersectsAabb(
  start: Point,
  target: Point,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
) {
  let enter = 0
  let exit = 1
  const axes = [
    { origin: start.x, delta: target.x - start.x, minimum: minX, maximum: maxX },
    { origin: start.y, delta: target.y - start.y, minimum: minY, maximum: maxY },
  ]
  for (const axis of axes) {
    if (Math.abs(axis.delta) <= 1e-12) {
      if (axis.origin < axis.minimum || axis.origin > axis.maximum) return false
      continue
    }
    let first = (axis.minimum - axis.origin) / axis.delta
    let second = (axis.maximum - axis.origin) / axis.delta
    if (first > second) [first, second] = [second, first]
    enter = Math.max(enter, first)
    exit = Math.min(exit, second)
    if (enter > exit + 1e-12) return false
  }
  return exit >= -1e-12 && enter <= 1 + 1e-12
}

function scenarioSeed(
  label: string,
  scenario: Scenario,
  start: Point,
  target: Point,
  segmentIndex: number,
) {
  const input = [
    label,
    segmentIndex,
    scenario.cols,
    scenario.rows,
    start.x,
    start.y,
    target.x,
    target.y,
    scenario.preventCornerCutting ? 1 : 0,
    [...scenario.obstacles].sort().join(';'),
  ].join('|')
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function deterministicFreeCenters(scenario: Scenario, seed: number) {
  const critical: Point[] = []
  const regular: Point[] = []
  for (let y = 0; y < scenario.rows; y += 1) {
    for (let x = 0; x < scenario.cols; x += 1) {
      const point = { x, y }
      if (!isWalkable(point, scenario)) continue
      const nearObstacle = getRawNeighbors(point, scenario, true).some((neighbor) =>
        scenario.obstacles.has(pointKey(neighbor)),
      )
      ;(nearObstacle ? critical : regular).push(point)
    }
  }
  const random = seededRandom(seed)
  shufflePoints(critical, random)
  shufflePoints(regular, random)
  return [...critical, ...regular]
}

function seededRandom(initialSeed: number) {
  let seed = initialSeed || 0x9e3779b9
  return () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return (seed >>> 0) / 2 ** 32
  }
}

function shufflePoints(points: Point[], random: () => number) {
  for (let index = points.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[points[index], points[swapIndex]] = [points[swapIndex], points[index]]
  }
}

function halton(index: number, base: number) {
  let fraction = 1
  let result = 0
  let value = index
  while (value > 0) {
    fraction /= base
    result += fraction * (value % base)
    value = Math.floor(value / base)
  }
  return result
}

function haltonScenarioPoint(
  index: number,
  rotationX: number,
  rotationY: number,
  scenario: Scenario,
) {
  const xUnit = (halton(index, 2) + rotationX) % 1
  const yUnit = (halton(index, 3) + rotationY) % 1
  return {
    x: scenario.cols <= 1 ? 0 : xUnit * (scenario.cols - 1),
    y: scenario.rows <= 1 ? 0 : yUnit * (scenario.rows - 1),
  }
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
const formatContinuousPoint = (point: Point) => `[${point.x.toFixed(1)},${point.y.toFixed(1)}]`

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
