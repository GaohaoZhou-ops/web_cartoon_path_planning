import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Crosshair,
  Eraser,
  Flag,
  Gauge,
  Info,
  LockKeyhole,
  Layers3,
  MapPin,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Route,
  Shuffle,
  StepForward,
  Timer,
  Trash2,
  Undo2,
  Waypoints,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import GridCanvas, { isRoutePoint, type EditTool } from './GridCanvas'
import {
  ALGORITHMS,
  cloneScenario,
  createRunner,
  createSampleScenario,
  pointKey,
  randomizeObstacles,
  samePoint,
  stepRunner,
  type AlgorithmId,
  type AlgorithmMeta,
  type Point,
  type Scenario,
  type SearchRunner,
} from './pathfinding'
import { appendFinishedAlgorithms, orderAlgorithmsByFinish } from './ranking'

type Phase = 'editing' | 'running' | 'paused' | 'complete'

const TOOL_DEFINITIONS: Array<{
  id: EditTool
  label: string
  hint: string
  icon: LucideIcon
}> = [
  { id: 'obstacle', label: '障碍画笔', hint: '1', icon: Pencil },
  { id: 'erase', label: '橡皮擦', hint: '2', icon: Eraser },
  { id: 'start', label: '设置起点', hint: '3', icon: Crosshair },
  { id: 'waypoint', label: '添加途径点', hint: '4', icon: MapPin },
  { id: 'end', label: '设置终点', hint: '5', icon: Flag },
]

const SPEEDS = [0.5, 1, 2, 4, 8]
const CORE_ALGORITHM_IDS: AlgorithmId[] = ['astar', 'jps', 'dijkstra', 'bfs', 'greedy']
const NEW_ALGORITHM_IDS = new Set<AlgorithmId>([
  'bidirectional-astar',
  'theta',
  'jps-plus',
  'dstar-lite',
  'flow-field',
  'field-dstar',
  'lpa-star',
  'ad-star',
  'rrt-star',
  'prm',
])
const CONTINUOUS_SAMPLING_IDS = new Set<AlgorithmId>(['rrt-star', 'prm'])

function catalogOrder(ids: AlgorithmId[]) {
  const selected = new Set(ids)
  return ALGORITHMS.filter((algorithm) => selected.has(algorithm.id)).map((algorithm) => algorithm.id)
}

export default function App() {
  const [scenario, setScenario] = useState<Scenario>(() => createSampleScenario())
  const [snapshot, setSnapshot] = useState<Scenario | null>(null)
  const [tool, setTool] = useState<EditTool>('obstacle')
  const [phase, setPhase] = useState<Phase>('editing')
  const [speed, setSpeed] = useState(2)
  const [visualTick, setVisualTick] = useState(0)
  const [algorithmPickerOpen, setAlgorithmPickerOpen] = useState(false)
  const [selectedAlgorithmIds, setSelectedAlgorithmIds] = useState<AlgorithmId[]>(() =>
    ALGORITHMS.map((algorithm) => algorithm.id),
  )
  const [draftAlgorithmIds, setDraftAlgorithmIds] = useState<AlgorithmId[]>([])
  const [activeAlgorithmIds, setActiveAlgorithmIds] = useState<AlgorithmId[]>([])
  const runnersRef = useRef<SearchRunner[]>([])
  const finishOrderRef = useRef<AlgorithmId[]>([])
  const historyRef = useRef<Scenario[]>([])
  const schedulerRef = useRef({ lastTime: 0, accumulator: 0 })

  const activeScenario = snapshot ?? scenario
  const runners = runnersRef.current
  const routeLength = activeScenario.waypoints.length + 1
  const canRun = Boolean(scenario.start && scenario.end)
  const activeAlgorithms = activeAlgorithmIds
    .map((id) => ALGORITHMS.find((algorithm) => algorithm.id === id))
    .filter((algorithm): algorithm is AlgorithmMeta => Boolean(algorithm))

  const stepAllRunners = (map: Scenario) => {
    runnersRef.current.forEach((runner) => stepRunner(runner, map))
    finishOrderRef.current = appendFinishedAlgorithms(finishOrderRef.current, runnersRef.current)
  }

  useEffect(() => {
    if (phase !== 'editing' || algorithmPickerOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return
      const shortcuts: Record<string, EditTool> = {
        '1': 'obstacle',
        '2': 'erase',
        '3': 'start',
        '4': 'waypoint',
        '5': 'end',
      }
      if (shortcuts[event.key]) setTool(shortcuts[event.key])
      if (event.key === 'Enter' && canRun) openAlgorithmPicker()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  useEffect(() => {
    if (phase !== 'running' || !snapshot) return
    let animationFrame = 0
    schedulerRef.current = { lastTime: performance.now(), accumulator: 0 }

    const animate = (now: number) => {
      const scheduler = schedulerRef.current
      const delta = Math.min(100, now - scheduler.lastTime)
      scheduler.lastTime = now
      scheduler.accumulator += delta
      const tickDuration = 66 / speed
      const rounds = Math.min(32, Math.floor(scheduler.accumulator / tickDuration))

      if (rounds > 0) {
        scheduler.accumulator -= rounds * tickDuration
        for (let round = 0; round < rounds; round += 1) {
          stepAllRunners(snapshot)
        }
        setVisualTick((tick) => tick + rounds)
      }

      const stillRunning = runnersRef.current.some((runner) => runner.status === 'running')
      if (!stillRunning) {
        setPhase('complete')
        setVisualTick((tick) => tick + 1)
        return
      }
      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [phase, snapshot, speed])

  const saveHistory = () => {
    historyRef.current = [...historyRef.current.slice(-19), cloneScenario(scenario)]
  }

  const updateScenario = (updater: (previous: Scenario) => Scenario, recordHistory = true) => {
    if (phase !== 'editing') return
    if (recordHistory) saveHistory()
    setScenario(updater)
  }

  const handleCellAction = (point: Point, selectedTool: EditTool) => {
    updateScenario((previous) => {
      const next = cloneScenario(previous)
      const key = pointKey(point)

      if (selectedTool === 'obstacle') {
        if (!isRoutePoint(previous, point)) next.obstacles.add(key)
      } else if (selectedTool === 'erase') {
        next.obstacles.delete(key)
        if (samePoint(next.start, point)) next.start = null
        if (samePoint(next.end, point)) next.end = null
        next.waypoints = next.waypoints.filter((waypoint) => !samePoint(waypoint, point))
      } else if (selectedTool === 'start') {
        next.obstacles.delete(key)
        next.waypoints = next.waypoints.filter((waypoint) => !samePoint(waypoint, point))
        if (samePoint(next.end, point)) next.end = null
        next.start = point
      } else if (selectedTool === 'end') {
        next.obstacles.delete(key)
        next.waypoints = next.waypoints.filter((waypoint) => !samePoint(waypoint, point))
        if (samePoint(next.start, point)) next.start = null
        next.end = point
      } else if (
        !samePoint(next.start, point) &&
        !samePoint(next.end, point) &&
        !next.waypoints.some((waypoint) => samePoint(waypoint, point))
      ) {
        next.obstacles.delete(key)
        next.waypoints.push(point)
      }
      return next
    })
  }

  const undo = () => {
    const previous = historyRef.current.pop()
    if (previous) setScenario(previous)
  }

  const loadSample = () => {
    updateScenario(() => createSampleScenario())
  }

  const clearObstacles = () => {
    updateScenario((previous) => ({ ...cloneScenario(previous), obstacles: new Set() }))
  }

  const randomize = () => {
    updateScenario((previous) => randomizeObstacles(cloneScenario(previous)))
  }

  const setScenarioOption = (option: 'allowDiagonal' | 'preventCornerCutting', value: boolean) => {
    updateScenario((previous) => ({ ...cloneScenario(previous), [option]: value }))
  }

  const removeWaypoint = (index: number) => {
    updateScenario((previous) => {
      const next = cloneScenario(previous)
      next.waypoints.splice(index, 1)
      return next
    })
  }

  const moveWaypoint = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= scenario.waypoints.length) return
    updateScenario((previous) => {
      const next = cloneScenario(previous)
      ;[next.waypoints[index], next.waypoints[nextIndex]] = [
        next.waypoints[nextIndex],
        next.waypoints[index],
      ]
      return next
    })
  }

  const openAlgorithmPicker = () => {
    if (!scenario.start || !scenario.end) return
    setDraftAlgorithmIds(
      catalogOrder(selectedAlgorithmIds).filter(
        (id) => scenario.allowDiagonal || !CONTINUOUS_SAMPLING_IDS.has(id),
      ),
    )
    setAlgorithmPickerOpen(true)
  }

  const startPlanning = (algorithmIds: AlgorithmId[]) => {
    if (!scenario.start || !scenario.end || algorithmIds.length === 0) return
    const orderedAlgorithmIds = catalogOrder(algorithmIds).filter(
      (id) => scenario.allowDiagonal || !CONTINUOUS_SAMPLING_IDS.has(id),
    )
    if (orderedAlgorithmIds.length === 0) return
    const frozen = cloneScenario(scenario)
    finishOrderRef.current = []
    runnersRef.current = orderedAlgorithmIds.map((id) => createRunner(id, frozen))
    setSelectedAlgorithmIds(orderedAlgorithmIds)
    setActiveAlgorithmIds(orderedAlgorithmIds)
    setAlgorithmPickerOpen(false)
    setSnapshot(frozen)
    setVisualTick(0)
    setPhase('running')
  }

  const restartPlanning = () => {
    if (!snapshot || activeAlgorithmIds.length === 0) return
    finishOrderRef.current = []
    runnersRef.current = activeAlgorithmIds.map((id) => createRunner(id, snapshot))
    setVisualTick(0)
    setPhase('running')
  }

  const returnToEditor = () => {
    finishOrderRef.current = []
    runnersRef.current = []
    setActiveAlgorithmIds([])
    setSnapshot(null)
    setPhase('editing')
    setVisualTick(0)
  }

  const togglePlayback = () => {
    if (phase === 'running') setPhase('paused')
    else if (phase === 'paused') setPhase('running')
    else if (phase === 'complete') restartPlanning()
  }

  const stepOnce = () => {
    if (!snapshot || phase === 'complete') return
    if (phase === 'running') setPhase('paused')
    stepAllRunners(snapshot)
    setVisualTick((tick) => tick + 1)
    if (!runnersRef.current.some((runner) => runner.status === 'running')) setPhase('complete')
  }

  const completedCount = runners.filter((runner) => runner.status !== 'running').length

  return (
    <div className="app-shell">
      <Header
        phase={phase}
        scenario={activeScenario}
        canRun={canRun}
        onRun={openAlgorithmPicker}
        onEdit={returnToEditor}
      />

      <div className={`workspace workspace--${phase === 'editing' ? 'editing' : 'running'}`}>
        {phase === 'editing' ? (
          <EditorSidebar
            scenario={scenario}
            tool={tool}
            canRun={canRun}
            historyCount={historyRef.current.length}
            onToolChange={setTool}
            onUndo={undo}
            onSample={loadSample}
            onRandomize={randomize}
            onClearObstacles={clearObstacles}
            onRun={openAlgorithmPicker}
            onRemoveWaypoint={removeWaypoint}
            onMoveWaypoint={moveWaypoint}
            onSetOption={setScenarioOption}
          />
        ) : (
          <BenchmarkSidebar
            scenario={activeScenario}
            runners={runners}
            algorithms={activeAlgorithms}
            phase={phase}
            visualTick={visualTick}
          />
        )}

        <main className="main-stage">
          {phase === 'editing' ? (
            <EditorStage
              scenario={scenario}
              tool={tool}
              onCellAction={handleCellAction}
            />
          ) : (
            <ComparisonStage
              scenario={activeScenario}
              runners={runners}
              algorithms={activeAlgorithms}
              finishOrder={finishOrderRef.current}
              visualTick={visualTick}
              completedCount={completedCount}
            />
          )}
        </main>
      </div>

      {phase !== 'editing' && (
        <PlaybackBar
          phase={phase}
          speed={speed}
          completedCount={completedCount}
          algorithmCount={activeAlgorithms.length}
          routeLength={routeLength}
          visualTick={visualTick}
          onSpeedChange={setSpeed}
          onToggle={togglePlayback}
          onStep={stepOnce}
          onRestart={restartPlanning}
        />
      )}

      {algorithmPickerOpen && (
        <AlgorithmPicker
          selectedIds={draftAlgorithmIds}
          disabledIds={scenario.allowDiagonal ? [] : [...CONTINUOUS_SAMPLING_IDS]}
          onSelectedIdsChange={setDraftAlgorithmIds}
          onCancel={() => setAlgorithmPickerOpen(false)}
          onConfirm={() => startPlanning(draftAlgorithmIds)}
        />
      )}
    </div>
  )
}

function AlgorithmPicker({
  selectedIds,
  disabledIds,
  onSelectedIdsChange,
  onCancel,
  onConfirm,
}: {
  selectedIds: AlgorithmId[]
  disabledIds: AlgorithmId[]
  onSelectedIdsChange: (ids: AlgorithmId[]) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  const selectedSet = new Set(selectedIds)
  const disabledSet = new Set(disabledIds)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancelRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [],
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const selectPreset = (ids: AlgorithmId[]) =>
    onSelectedIdsChange(catalogOrder(ids).filter((id) => !disabledSet.has(id)))
  const toggleAlgorithm = (id: AlgorithmId) => {
    if (disabledSet.has(id)) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedIdsChange(catalogOrder([...next]))
  }

  return (
    <div
      className="algorithm-picker-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        ref={dialogRef}
        className="algorithm-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="algorithm-picker-title"
        aria-describedby="algorithm-picker-description"
      >
        <header className="algorithm-picker-header">
          <div className="algorithm-picker-title-lockup">
            <span className="algorithm-picker-icon" aria-hidden="true">
              <Layers3 size={18} />
            </span>
            <div>
              <span className="eyebrow">RUN MANIFEST / 运行编队</span>
              <h2 id="algorithm-picker-title">选择本轮执行算法</h2>
              <p id="algorithm-picker-description">
                仅为选中的算法创建实时画布；完成排名与终局图表也会按本轮编队生成。
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            className="algorithm-picker-close"
            type="button"
            onClick={onCancel}
            aria-label="关闭算法选择"
          >
            <X size={18} />
          </button>
        </header>

        <div className="algorithm-picker-toolbar">
          <div>
            <span>已选择</span>
            <strong>{String(selectedIds.length).padStart(2, '0')}</strong>
            <small>/ {ALGORITHMS.length}</small>
          </div>
          <div className="algorithm-picker-presets" aria-label="算法快捷选择">
            <button type="button" onClick={() => selectPreset(ALGORITHMS.map((algorithm) => algorithm.id))}>
              全选
            </button>
            <button type="button" onClick={() => selectPreset(CORE_ALGORITHM_IDS)}>
              仅基础
            </button>
            <button type="button" onClick={() => selectPreset([])} disabled={selectedIds.length === 0}>
              清空
            </button>
          </div>
        </div>

        <div className="algorithm-picker-grid" role="group" aria-label="可执行算法">
          {ALGORITHMS.map((algorithm, index) => {
            const selected = selectedSet.has(algorithm.id)
            const disabled = disabledSet.has(algorithm.id)
            return (
              <button
                className={`algorithm-picker-card ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
                type="button"
                key={algorithm.id}
                aria-pressed={selected}
                disabled={disabled}
                data-picker-algorithm-id={algorithm.id}
                onClick={() => toggleAlgorithm(algorithm.id)}
                style={
                  {
                    '--accent': algorithm.accent,
                    '--accent-rgb': algorithm.accentRgb,
                  } as React.CSSProperties
                }
              >
                <span className="algorithm-picker-card-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="algorithm-picker-card-copy">
                  <span>
                    <strong>{algorithm.name}</strong>
                    {NEW_ALGORITHM_IDS.has(algorithm.id) && <em>新增</em>}
                    {disabled && <em>需八向</em>}
                  </span>
                  <small>{algorithm.description}</small>
                  <i>{algorithm.optimality}</i>
                </span>
                <span className="algorithm-picker-check" aria-hidden="true">
                  {selected && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>

        <footer className="algorithm-picker-footer">
          <p>
            <Info size={13} />
            Flow Field 计算完整积分场；RRT* / PRM 为连续空间采样器，需启用斜向移动。
          </p>
          <div>
            <button className="algorithm-picker-cancel" type="button" onClick={onCancel}>
              取消
            </button>
            <button
              className="algorithm-picker-confirm"
              type="button"
              disabled={selectedIds.length === 0}
              onClick={onConfirm}
            >
              <Play size={16} fill="currentColor" />
              运行 {selectedIds.length} 个算法
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function Header({
  phase,
  scenario,
  canRun,
  onRun,
  onEdit,
}: {
  phase: Phase
  scenario: Scenario
  canRun: boolean
  onRun: () => void
  onEdit: () => void
}) {
  const stateLabel =
    phase === 'editing' ? '场景配置' : phase === 'running' ? '同步运行' : phase === 'paused' ? '已暂停' : '分析完成'

  return (
    <header className="lab-header">
      <div className="brand-lockup">
        <div className="brand-sigil" aria-hidden="true">
          <span>R</span>
          <span>L</span>
        </div>
        <div>
          <div className="brand-name">ROUTE/LAB</div>
          <div className="brand-subtitle">路径规划 · 同步观测台</div>
        </div>
      </div>

      <div className="header-readouts" aria-label="当前场景信息">
        <div className="readout">
          <span>GRID</span>
          <strong>{scenario.cols}×{scenario.rows}</strong>
        </div>
        <div className="readout">
          <span>VIA</span>
          <strong>{String(scenario.waypoints.length).padStart(2, '0')}</strong>
        </div>
        <div className="readout">
          <span>BLOCK</span>
          <strong>{String(scenario.obstacles.size).padStart(3, '0')}</strong>
        </div>
      </div>

      <div className="header-actions">
        <div className={`phase-indicator phase-indicator--${phase}`}>
          <span className="phase-dot" />
          {stateLabel}
        </div>
        {phase === 'editing' ? (
          <button className="primary-action" disabled={!canRun} onClick={onRun}>
            <LockKeyhole size={17} />
            选择并开始
          </button>
        ) : (
          <button className="secondary-action" onClick={onEdit}>
            <Undo2 size={16} />
            返回编辑
          </button>
        )}
      </div>
    </header>
  )
}

interface EditorSidebarProps {
  scenario: Scenario
  tool: EditTool
  canRun: boolean
  historyCount: number
  onToolChange: (tool: EditTool) => void
  onUndo: () => void
  onSample: () => void
  onRandomize: () => void
  onClearObstacles: () => void
  onRun: () => void
  onRemoveWaypoint: (index: number) => void
  onMoveWaypoint: (index: number, direction: -1 | 1) => void
  onSetOption: (option: 'allowDiagonal' | 'preventCornerCutting', value: boolean) => void
}

function EditorSidebar({
  scenario,
  tool,
  canRun,
  historyCount,
  onToolChange,
  onUndo,
  onSample,
  onRandomize,
  onClearObstacles,
  onRun,
  onRemoveWaypoint,
  onMoveWaypoint,
  onSetOption,
}: EditorSidebarProps) {
  return (
    <aside className="side-panel editor-panel">
      <section className="panel-section">
        <SectionTitle index="01" title="绘制场景" />
        <div className="tool-grid">
          {TOOL_DEFINITIONS.map((definition) => {
            const Icon = definition.icon
            return (
              <button
                key={definition.id}
                className={`tool-button ${tool === definition.id ? 'is-active' : ''}`}
                onClick={() => onToolChange(definition.id)}
                aria-pressed={tool === definition.id}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{definition.label}</span>
                <kbd>{definition.hint}</kbd>
              </button>
            )
          })}
        </div>
        <div className="compact-actions">
          <button onClick={onUndo} disabled={historyCount === 0}>
            <Undo2 size={14} /> 撤销
          </button>
          <button onClick={onRandomize}>
            <Shuffle size={14} /> 随机障碍
          </button>
          <button onClick={onSample}>
            <RotateCcw size={14} /> 示例场景
          </button>
          <button onClick={onClearObstacles}>
            <Trash2 size={14} /> 清空障碍
          </button>
        </div>
      </section>

      <section className="panel-section route-section">
        <SectionTitle index="02" title="行程顺序" accessory={`${scenario.waypoints.length + 1} 段`} />
        <div className="route-list">
          <RouteNode type="start" label="起点 / START" point={scenario.start} />
          {scenario.waypoints.map((point, index) => (
            <RouteNode
              key={`${pointKey(point)}-${index}`}
              type="waypoint"
              label={`途径点 ${String(index + 1).padStart(2, '0')}`}
              point={point}
              actions={
                <div className="route-node-actions">
                  <button
                    aria-label={`上移途径点 ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => onMoveWaypoint(index, -1)}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    aria-label={`下移途径点 ${index + 1}`}
                    disabled={index === scenario.waypoints.length - 1}
                    onClick={() => onMoveWaypoint(index, 1)}
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button aria-label={`删除途径点 ${index + 1}`} onClick={() => onRemoveWaypoint(index)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              }
            />
          ))}
          {scenario.waypoints.length === 0 && (
            <div className="empty-waypoint">选择“添加途径点”，可连续放置多个节点</div>
          )}
          <RouteNode type="end" label="终点 / END" point={scenario.end} />
        </div>
      </section>

      <section className="panel-section movement-section">
        <SectionTitle index="03" title="移动规则" />
        <ToggleRow
          label="允许斜向移动"
          description="八邻域 · 斜边代价 √2"
          checked={scenario.allowDiagonal}
          onChange={(checked) => onSetOption('allowDiagonal', checked)}
        />
        <ToggleRow
          label="禁止穿越墙角"
          description="斜移时两侧均须可通行"
          checked={scenario.preventCornerCutting}
          disabled={!scenario.allowDiagonal}
          onChange={(checked) => onSetOption('preventCornerCutting', checked)}
        />
      </section>

      <div className="panel-run-zone">
        {!canRun && <p>请先在网格中设置起点与终点</p>}
        <button className="run-button" disabled={!canRun} onClick={onRun}>
          <Play size={18} fill="currentColor" />
          选择算法并开始
        </button>
      </div>
    </aside>
  )
}

function EditorStage({
  scenario,
  tool,
  onCellAction,
}: {
  scenario: Scenario
  tool: EditTool
  onCellAction: (point: Point, tool: EditTool) => void
}) {
  const activeTool = TOOL_DEFINITIONS.find((definition) => definition.id === tool)
  return (
    <div className="editor-stage">
      <div className="stage-heading">
        <div>
          <span className="eyebrow">MISSION CANVAS / 任务画布</span>
          <h1>编排一条<span>必须依次经过</span>的航路</h1>
        </div>
        <div className="stage-hint">
          <CircleDot size={15} />
          当前工具 · {activeTool?.label}
        </div>
      </div>

      <div className="editor-map-frame">
        <div className="map-coordinates map-coordinates--top">
          {Array.from({ length: scenario.cols }, (_, index) => (
            <span key={index}>{index % 3 === 0 ? String(index).padStart(2, '0') : '·'}</span>
          ))}
        </div>
        <div className="map-coordinates map-coordinates--left">
          {Array.from({ length: scenario.rows }, (_, index) => (
            <span key={index}>{index % 2 === 0 ? String(index).padStart(2, '0') : '·'}</span>
          ))}
        </div>
        <GridCanvas
          scenario={scenario}
          editing
          tool={tool}
          onCellAction={onCellAction}
          className="editor-canvas"
        />
        <div className="map-overlay map-overlay--top">
          <span>LIVE EDIT</span>
          <strong>{scenario.obstacles.size} BLOCKS</strong>
        </div>
        <div className="map-overlay map-overlay--bottom">
          按住拖动连续绘制 · 右键临时擦除
        </div>
      </div>

      <div
        className="algorithm-manifest"
        style={{ '--manifest-columns': 5 } as React.CSSProperties}
      >
        <div className="manifest-intro">
          <span>算法目录</span>
          <strong>{ALGORITHMS.length} AVAILABLE</strong>
        </div>
        {ALGORITHMS.map((algorithm, index) => (
          <div className="manifest-item" key={algorithm.id} style={{ '--accent': algorithm.accent } as React.CSSProperties}>
            <span className="manifest-index">0{index + 1}</span>
            <div>
              <strong>{algorithm.name}</strong>
              <small>{algorithm.description}</small>
            </div>
            <i />
          </div>
        ))}
      </div>
    </div>
  )
}

function ComparisonStage({
  scenario,
  runners,
  algorithms,
  finishOrder,
  visualTick,
  completedCount,
}: {
  scenario: Scenario
  runners: SearchRunner[]
  algorithms: AlgorithmMeta[]
  finishOrder: AlgorithmId[]
  visualTick: number
  completedCount: number
}) {
  const displayAlgorithms = orderAlgorithmsByFinish(algorithms, finishOrder)
  const algorithmGridRef = useRef<HTMLDivElement>(null)
  const finalReportRef = useRef<HTMLElement>(null)
  const previousFinishCountRef = useRef(finishOrder.length)
  const layoutFinishCountRef = useRef(finishOrder.length)
  const previousCardRectsRef = useRef(new Map<AlgorithmId, { left: number; top: number }>())
  const cardAnimationsRef = useRef(new Map<AlgorithmId, Animation>())
  const nextUnfinishedId = displayAlgorithms.find(
    (algorithm) => !finishOrder.includes(algorithm.id),
  )?.id
  const allFinished =
    algorithms.length > 0 &&
    completedCount === algorithms.length &&
    finishOrder.length === algorithms.length
  const finishAnnouncement =
    finishOrder.length > 0
      ? `${finishOrder
          .map((id, index) => {
            const runner = runners.find((item) => item.id === id)
            return `第 ${index + 1} ${algorithmName(id)}，${
              runner?.status === 'complete' ? '路线完成' : '未找到路线'
            }`
          })
          .join('；')}。${allFinished ? '全部算法结束，终局统计图已生成。' : ''}`
      : ''

  useLayoutEffect(() => {
    const grid = algorithmGridRef.current
    if (!grid) return

    cardAnimationsRef.current.forEach((animation) => animation.cancel())
    cardAnimationsRef.current.clear()

    const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-algorithm-id]'))
    const currentRects = new Map<AlgorithmId, { left: number; top: number }>()
    cards.forEach((card) => {
      const id = card.dataset.algorithmId as AlgorithmId | undefined
      if (id) {
        const rect = card.getBoundingClientRect()
        currentRects.set(id, {
          left: rect.left + window.scrollX,
          top: rect.top + window.scrollY,
        })
      }
    })

    const previousFinishCount = layoutFinishCountRef.current
    const shouldAnimate =
      finishOrder.length > previousFinishCount &&
      previousCardRectsRef.current.size > 0 &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    layoutFinishCountRef.current = finishOrder.length

    if (shouldAnimate) {
      cards.forEach((card) => {
        const id = card.dataset.algorithmId as AlgorithmId | undefined
        if (!id) return
        const previousRect = previousCardRectsRef.current.get(id)
        const currentRect = currentRects.get(id)
        if (!previousRect || !currentRect) return
        const deltaX = previousRect.left - currentRect.left
        const deltaY = previousRect.top - currentRect.top
        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return

        card.style.zIndex = '4'
        const animation = card.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: 'translate(0, 0)' },
          ],
          { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        )
        cardAnimationsRef.current.set(id, animation)
        const clearAnimation = () => {
          if (cardAnimationsRef.current.get(id) === animation) {
            cardAnimationsRef.current.delete(id)
            card.style.zIndex = ''
          }
        }
        animation.addEventListener('finish', clearAnimation, { once: true })
        animation.addEventListener('cancel', clearAnimation, { once: true })
      })
    }

    previousCardRectsRef.current = currentRects
  }, [finishOrder.length])

  useEffect(
    () => () => {
      cardAnimationsRef.current.forEach((animation) => animation.cancel())
      cardAnimationsRef.current.clear()
    },
    [],
  )

  useEffect(() => {
    const previousFinishCount = previousFinishCountRef.current
    previousFinishCountRef.current = finishOrder.length
    if (finishOrder.length <= previousFinishCount) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const delay = reduceMotion ? 0 : 560
    let animationFrame = 0
    const timer = window.setTimeout(() => {
      animationFrame = requestAnimationFrame(() => {
        const target = nextUnfinishedId
          ? algorithmGridRef.current?.querySelector<HTMLElement>(
              `[data-algorithm-id="${nextUnfinishedId}"]`,
            )
          : finalReportRef.current
        target?.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'start',
          inline: 'nearest',
        })
      })
    }, delay)

    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(animationFrame)
    }
  }, [finishOrder.length, nextUnfinishedId, allFinished])

  return (
    <div className="comparison-stage">
      <div className="comparison-heading">
        <div>
          <span className="eyebrow">SYNCHRONIZED EXPANSION / 同步扩展</span>
          <h1>同一地图快照，同一逻辑时钟</h1>
        </div>
        <div className="sync-readout">
          <span className="sync-pulse" />
          TICK {String(visualTick).padStart(4, '0')} · {completedCount}/{algorithms.length} 结束
        </div>
      </div>
      <div className="algorithm-grid" ref={algorithmGridRef}>
        {displayAlgorithms.map((algorithm) => {
          const runner = runners.find((item) => item.id === algorithm.id)
          if (!runner) return null
          const index = ALGORITHMS.findIndex((item) => item.id === algorithm.id)
          const finishRank = finishOrder.indexOf(algorithm.id) + 1
          return (
            <AlgorithmCard
              key={algorithm.id}
              index={index}
              finishRank={finishRank || undefined}
              algorithm={algorithm}
              scenario={scenario}
              runner={runner}
              visualTick={visualTick}
            />
          )
        })}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {finishAnnouncement}
      </div>
      {allFinished && (
        <FinalTelemetry
          reportRef={finalReportRef}
          runners={runners}
          algorithms={algorithms}
          finishOrder={finishOrder}
        />
      )}
    </div>
  )
}

function AlgorithmCard({
  index,
  finishRank,
  algorithm,
  scenario,
  runner,
  visualTick,
}: {
  index: number
  finishRank?: number
  algorithm: AlgorithmMeta
  scenario: Scenario
  runner: SearchRunner
  visualTick: number
}) {
  const samplingPlanner = algorithm.id === 'rrt-star' || algorithm.id === 'prm'
  const statusText =
    runner.status === 'complete'
      ? '已完成'
      : runner.status === 'failed'
        ? samplingPlanner
          ? '预算未连通'
          : '无路径'
        : '搜索中'
  const totalSegments = runner.route.length - 1
  const activeSegment = Math.min(runner.segmentIndex + 1, totalSegments)
  const workloadLabel =
    algorithm.id === 'rrt-star' ? '接受节点' : algorithm.id === 'prm' ? '图扩展' : '扩展节点'
  const peakLabel = algorithm.id === 'rrt-star' ? '树峰值' : '峰值队列'
  const displayedCost = runner.path.length ? runner.pathCost : runner.previewCost
  const footerDetail = runner.samplingStats
    ? `${runner.samplingStats.phase} · ${runner.samplingStats.accepted} 点 / ${runner.samplingStats.edges} 边`
    : runner.anytime
      ? `ε ${runner.anytime.epsilon.toFixed(1)} · ${runner.anytime.rounds} 轮`
      : `${runner.generated} 已发现`

  return (
    <article
      className={`algorithm-card algorithm-card--${runner.status} ${finishRank ? 'algorithm-card--ranked' : ''}`}
      data-algorithm-id={algorithm.id}
      aria-label={`${algorithm.name}${finishRank ? `，第 ${finishRank} 名结束` : ''}`}
      style={{ '--accent': algorithm.accent, '--accent-rgb': algorithm.accentRgb } as React.CSSProperties}
    >
      <header className="algorithm-card-header">
        <div className="algorithm-identity">
          <span className={finishRank ? 'finish-rank' : ''}>
            {finishRank ? `#${String(finishRank).padStart(2, '0')}` : String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <h2>{algorithm.name}</h2>
            <p>{algorithm.description}</p>
          </div>
        </div>
        <div className={`runner-status runner-status--${runner.status}`}>
          <i />
          {statusText}
        </div>
      </header>

      <div className="algorithm-canvas-wrap">
        <GridCanvas
          scenario={scenario}
          runner={runner}
          algorithm={algorithm}
          visualTick={visualTick}
        />
        <div className="segment-badge">
          LEG {String(activeSegment).padStart(2, '0')} / {String(totalSegments).padStart(2, '0')}
        </div>
        <div className="canvas-legend">
          {samplingPlanner ? (
            <>
              <span><i className="legend-frontier" /> 采样点</span>
              <span><i className="legend-visited" /> 图连线</span>
              <span><i className="legend-path" /> 当前解</span>
            </>
          ) : (
            <>
              <span><i className="legend-frontier" /> 前沿</span>
              <span><i className="legend-visited" /> 已扩展</span>
              <span><i className="legend-path" /> 路径</span>
            </>
          )}
        </div>
      </div>

      <div className="metric-strip">
        <Metric label={workloadLabel} value={runner.expansions.toLocaleString('zh-CN')} emphasize />
        <Metric label="计算耗时" value={formatCpu(runner.cpuMs)} unit="ms" />
        <Metric label="路径代价" value={displayedCost === undefined ? '—' : displayedCost.toFixed(2)} />
        <Metric label={peakLabel} value={String(runner.openPeak)} />
      </div>
      <footer className="algorithm-action">
        <Activity size={13} />
        <span>{runner.action}</span>
        <small>{footerDetail}</small>
      </footer>
    </article>
  )
}

interface FinalMetricDefinition {
  id: string
  label: string
  unit: string
  note: string
  icon: LucideIcon
  showBest: boolean
  value: (runner: SearchRunner) => number | null
  format: (value: number) => string
}

function FinalTelemetry({
  reportRef,
  runners,
  algorithms,
  finishOrder,
}: {
  reportRef: React.RefObject<HTMLElement>
  runners: SearchRunner[]
  algorithms: AlgorithmMeta[]
  finishOrder: AlgorithmId[]
}) {
  const orderedAlgorithms = orderAlgorithmsByFinish(algorithms, finishOrder).filter((algorithm) =>
    finishOrder.includes(algorithm.id),
  )
  const runnerById = new Map(runners.map((runner) => [runner.id, runner]))
  const completedRoutes = runners.filter((runner) => runner.status === 'complete').length
  const includesSamplingPlanner = algorithms.some(
    (algorithm) => algorithm.id === 'rrt-star' || algorithm.id === 'prm',
  )
  const metrics: FinalMetricDefinition[] = [
    {
      id: 'expansions',
      label: '扩展 / 工作量',
      unit: 'NODES',
      note: '行为观测 · 跳点、积分场、采样树与路网查询口径不同',
      icon: Activity,
      showBest: false,
      value: (runner) => runner.expansions,
      format: (value) => value.toLocaleString('zh-CN'),
    },
    {
      id: 'cpu',
      label: '计算耗时',
      unit: 'MS',
      note: '仅累计在线搜索与回溯；JPS+ 静态表预处理不计',
      icon: Timer,
      showBest: true,
      value: (runner) => runner.cpuMs,
      format: formatCpu,
    },
    {
      id: 'cost',
      label: '完整路径代价',
      unit: 'COST',
      note: '失败路线不参与本项比较',
      icon: Route,
      showBest: true,
      value: (runner) => (runner.status === 'complete' ? runner.pathCost : null),
      format: (value) => value.toFixed(2),
    },
    {
      id: 'queue',
      label: '峰值队列',
      unit: 'NODES',
      note: '行为观测 · RRT* 此项表示树节点峰值，其余为活动队列',
      icon: Waypoints,
      showBest: false,
      value: (runner) => runner.openPeak,
      format: (value) => value.toLocaleString('zh-CN'),
    },
  ]

  return (
    <section className="final-report" ref={reportRef} aria-labelledby="final-report-title">
      <header className="final-report-header">
        <div>
          <span className="eyebrow">FINAL TELEMETRY / 终局对比</span>
          <h2 id="final-report-title">
            {completedRoutes > 0
              ? '终局性能剖面'
              : includesSamplingPlanner
                ? '预算未连通观测剖面'
                : '不可达判定剖面'}
          </h2>
          <p>各图按本项最大观测值归一化，横条越短表示该项消耗越低。</p>
        </div>
        <div className={`final-report-stamp ${completedRoutes === 0 ? 'is-failed' : ''}`}>
          <span>ROUTE STATUS</span>
          <strong>
            {completedRoutes > 0
              ? `${completedRoutes}/${algorithms.length} LOCKED`
              : includesSamplingPlanner
                ? 'UNRESOLVED'
                : 'NO ROUTE'}
          </strong>
        </div>
      </header>

      <section className="final-ranking-panel" aria-labelledby="finish-order-title">
        <div className="final-panel-heading">
          <div>
            <span>RANK SEQUENCE</span>
            <h3 id="finish-order-title">结束顺序</h3>
          </div>
          <small>按逻辑 tick 锁定</small>
        </div>
        <div className="final-ranking-track" role="list">
          {finishOrder.map((id, index) => {
            const algorithm = algorithms.find((item) => item.id === id)
            const runner = runnerById.get(id)
            if (!algorithm || !runner) return null
            const succeeded = runner.status === 'complete'
            return (
              <div
                className={`final-rank-item ${succeeded ? 'is-complete' : 'is-failed'}`}
                key={id}
                role="listitem"
                data-algorithm-id={id}
                style={
                  {
                    '--accent': algorithm.accent,
                    '--accent-rgb': algorithm.accentRgb,
                    animationDelay: `${120 + index * 110}ms`,
                  } as React.CSSProperties
                }
                aria-label={`第 ${index + 1}，${algorithm.name}，${succeeded ? '路线完成' : '未找到路线'}`}
              >
                <span className="final-rank-number">#{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{algorithm.shortName}</strong>
                  <small>{algorithm.name}</small>
                </div>
                <em>{succeeded ? 'LOCKED' : 'NO ROUTE'}</em>
                <i aria-hidden="true" />
              </div>
            )
          })}
        </div>
      </section>

      <div className="final-charts-grid">
        {metrics.map((metric, metricIndex) => {
          const Icon = metric.icon
          const rows = orderedAlgorithms.flatMap((algorithm) => {
            const runner = runnerById.get(algorithm.id)
            return runner ? [{ algorithm, runner, value: metric.value(runner) }] : []
          })
          const observedValues = rows
            .map((row) => row.value)
            .filter((value): value is number => value !== null)
          const successfulValues = rows
            .filter((row) => row.runner.status === 'complete')
            .map((row) => row.value)
            .filter((value): value is number => value !== null)
          const maxValue = observedValues.length > 0 ? Math.max(...observedValues) : 0
          const bestValue =
            metric.showBest && successfulValues.length > 0 ? Math.min(...successfulValues) : null

          return (
            <article
              className="final-chart-card"
              key={metric.id}
              data-metric={metric.id}
              aria-label={`${metric.label}对比图`}
              style={{ animationDelay: `${280 + metricIndex * 90}ms` }}
            >
              <header>
                <div className="final-chart-title">
                  <Icon size={15} />
                  <h3>{metric.label}</h3>
                </div>
                <span>{metric.unit}</span>
              </header>
              <p>{metric.note}</p>
              <div className="final-chart-rows" role="list">
                {rows.map(({ algorithm, runner, value }, rowIndex) => {
                  const isBest =
                    runner.status === 'complete' &&
                    value !== null &&
                    bestValue !== null &&
                    Math.abs(value - bestValue) < 1e-9
                  const barWidth =
                    value === null || value === 0 || maxValue === 0
                      ? 0
                      : Math.max(3, (value / maxValue) * 100)
                  return (
                    <div
                      className={`final-chart-row ${runner.status === 'failed' ? 'is-failed' : ''} ${
                        isBest ? 'is-best' : ''
                      }`}
                      key={algorithm.id}
                      role="listitem"
                      data-algorithm-id={algorithm.id}
                      data-value={value ?? undefined}
                      data-status={runner.status}
                      style={
                        {
                          '--accent': algorithm.accent,
                          '--accent-rgb': algorithm.accentRgb,
                        } as React.CSSProperties
                      }
                    >
                      <div className="final-chart-label">
                        <i aria-hidden="true" />
                        <span>{algorithm.shortName}</span>
                      </div>
                      <div className="final-chart-track" aria-hidden="true">
                        {value !== null && (
                          <span
                            className="final-chart-fill"
                            style={{
                              width: `${barWidth}%`,
                              animationDelay: `${420 + metricIndex * 90 + rowIndex * 70}ms`,
                            }}
                          />
                        )}
                      </div>
                      <div className="final-chart-value">
                        <strong>{value === null ? '—' : metric.format(value)}</strong>
                        {isBest && <em>BEST</em>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>

      <footer className="final-report-note">
        <Info size={14} />
        <p>
          结束顺序不等同于综合性能评分；同一逻辑 tick 内按算法编队顺序排位。RRT* / PRM 的失败仅表示固定采样预算内未连通，并非不可达证明。
        </p>
      </footer>
    </section>
  )
}

function BenchmarkSidebar({
  scenario,
  runners,
  algorithms,
  phase,
  visualTick,
}: {
  scenario: Scenario
  runners: SearchRunner[]
  algorithms: AlgorithmMeta[]
  phase: Phase
  visualTick: number
}) {
  void visualTick
  const completed = runners.filter((runner) => runner.status === 'complete')
  const failed = runners.filter((runner) => runner.status === 'failed')
  const includesSamplingPlanner = algorithms.some(
    (algorithm) => algorithm.id === 'rrt-star' || algorithm.id === 'prm',
  )
  const bestExpanded = completed.length
    ? completed.reduce((best, runner) => (runner.expansions < best.expansions ? runner : best))
    : null
  const bestCpu = completed.length
    ? completed.reduce((best, runner) => (runner.cpuMs < best.cpuMs ? runner : best))
    : null
  const maxExpanded = Math.max(1, ...runners.map((runner) => runner.expansions))

  return (
    <aside className="side-panel benchmark-panel">
      <section className="panel-section">
        <SectionTitle index="LIVE" title="性能观测" accessory={phase === 'complete' ? 'FINAL' : 'STREAM'} />
        <div className="telemetry-hero">
          <div>
            <span>逻辑调度</span>
            <strong>{Array.from({ length: algorithms.length }, () => '1').join(' : ')}</strong>
          </div>
          <Zap size={26} />
        </div>
        <p className="telemetry-note">每个逻辑 tick 为每个未结束算法推进一次有效算法步骤。</p>
      </section>

      <section className="panel-section">
        <SectionTitle index="ROUTE" title="任务序列" accessory={`${scenario.waypoints.length + 1} 段`} />
        <div className="compact-route">
          <span className="compact-route-node start">S</span>
          {scenario.waypoints.map((point, index) => (
            <span className="compact-route-group" key={pointKey(point)}>
              <i />
              <span className="compact-route-node waypoint">{index + 1}</span>
            </span>
          ))}
          <span className="compact-route-group">
            <i />
            <span className="compact-route-node end">E</span>
          </span>
        </div>
      </section>

      <section className="panel-section ranking-section">
        <SectionTitle index="RANK" title="工作量观测" accessory="口径见说明" />
        <div className="ranking-list">
          {algorithms.map((algorithm) => {
            const runner = runners.find((item) => item.id === algorithm.id)
            if (!runner) return null
            return (
              <div className="ranking-row" key={algorithm.id}>
                <div className="ranking-label">
                  <i style={{ backgroundColor: algorithm.accent }} />
                  <span>{algorithm.shortName}</span>
                  <strong>{runner.expansions.toLocaleString('zh-CN')}</strong>
                </div>
                <div className="ranking-track">
                  <span
                    style={{
                      width: `${Math.max(2, (runner.expansions / maxExpanded) * 100)}%`,
                      backgroundColor: algorithm.accent,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel-section live-table-section">
        <SectionTitle index="DATA" title="实时数据" />
        <div className="live-table" role="table" aria-label="算法实时统计">
          <div className="live-table-head" role="row">
            <span>算法</span><span>工作</span><span>计算 ms</span><span>代价</span>
          </div>
          {algorithms.map((algorithm) => {
            const runner = runners.find((item) => item.id === algorithm.id)
            if (!runner) return null
            return (
              <div className="live-table-row" role="row" key={algorithm.id}>
                <span style={{ color: algorithm.accent }}>{algorithm.shortName}</span>
                <span>{runner.expansions}</span>
                <span>{formatCpu(runner.cpuMs)}</span>
                <span>{runner.path.length ? runner.pathCost.toFixed(2) : runner.previewCost?.toFixed(2) ?? '—'}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className={`analysis-callout ${phase === 'complete' ? 'is-ready' : ''}`}>
        <div className="analysis-callout-title">
          <Gauge size={16} />
          {phase === 'complete'
            ? completed.length
              ? '本轮观测'
              : includesSamplingPlanner
                ? '预算未连通'
                : '路线不可达'
            : '等待完整样本'}
        </div>
        {phase === 'complete' && bestExpanded && bestCpu ? (
          <p>
            本轮单次观测中，<strong>{algorithmName(bestExpanded.id)}</strong> 扩展搜索单元最少；
            <strong>{algorithmName(bestCpu.id)}</strong> 累计计算耗时最低。
            {failed.length > 0 && ` ${failed.length} 个算法未找到完整路线。`}
          </p>
        ) : phase === 'complete' && failed.length > 0 ? (
          <p>{algorithms.length} 种算法均未完成第 {failed[0].segmentIndex + 1} 航段，请返回编辑调整障碍、节点或采样设置。</p>
        ) : (
          <p>算法完成后自动生成本轮对比摘要。</p>
        )}
      </section>

      <div className="method-note">
        <Info size={14} />
        <p><strong>统计口径</strong>耗时仅累计在线规划与回溯；Flow Field 生成完整积分场，RRT* / PRM 使用固定采样预算，工作量不可与网格扩展数直接等同。</p>
      </div>
    </aside>
  )
}

function PlaybackBar({
  phase,
  speed,
  completedCount,
  algorithmCount,
  routeLength,
  visualTick,
  onSpeedChange,
  onToggle,
  onStep,
  onRestart,
}: {
  phase: Phase
  speed: number
  completedCount: number
  algorithmCount: number
  routeLength: number
  visualTick: number
  onSpeedChange: (speed: number) => void
  onToggle: () => void
  onStep: () => void
  onRestart: () => void
}) {
  return (
    <div className="playback-dock">
      <div className="playback-context">
        <span>SYNC CONTROL</span>
        <strong>{completedCount}/{algorithmCount} 结束 · {routeLength} 航段</strong>
      </div>
      <div className="transport-controls">
        <button onClick={onRestart} aria-label="重新运行">
          <RotateCcw size={17} />
        </button>
        <button className="transport-primary" onClick={onToggle} aria-label={phase === 'running' ? '暂停' : '播放'}>
          {phase === 'running' ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
        </button>
        <button onClick={onStep} disabled={phase === 'complete'} aria-label="所有算法单步前进">
          <StepForward size={18} />
        </button>
      </div>
      <div className="timeline-readout">
        <span>TICK</span>
        <div className={`timeline-track ${phase === 'running' ? 'is-running' : ''}`}>
          <i />
        </div>
        <strong>{String(visualTick).padStart(4, '0')}</strong>
      </div>
      <div className="speed-control">
        <span><Gauge size={14} /> 速度</span>
        <div className="speed-options">
          {SPEEDS.map((option) => (
            <button
              key={option}
              className={speed === option ? 'is-active' : ''}
              onClick={() => onSpeedChange(option)}
            >
              {option}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ index, title, accessory }: { index: string; title: string; accessory?: string }) {
  return (
    <div className="section-title">
      <span>{index}</span>
      <h2>{title}</h2>
      {accessory && <small>{accessory}</small>}
    </div>
  )
}

function RouteNode({
  type,
  label,
  point,
  actions,
}: {
  type: 'start' | 'waypoint' | 'end'
  label: string
  point: Point | null
  actions?: React.ReactNode
}) {
  return (
    <div className={`route-node route-node--${type} ${!point ? 'is-missing' : ''}`}>
      <span className="route-node-marker">
        {type === 'start' ? 'S' : type === 'end' ? 'E' : <MapPin size={12} fill="currentColor" />}
      </span>
      <div>
        <strong>{label}</strong>
        <small>{point ? `X ${String(point.x).padStart(2, '0')} · Y ${String(point.y).padStart(2, '0')}` : '尚未设置'}</small>
      </div>
      {actions}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <div>
        <strong>{label}</strong>
        <small>{description}</small>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-visual"><i /></span>
    </label>
  )
}

function Metric({ label, value, unit, emphasize = false }: { label: string; value: string; unit?: string; emphasize?: boolean }) {
  return (
    <div className={`metric ${emphasize ? 'metric--emphasize' : ''}`}>
      <span>{label}</span>
      <strong>{value}{unit && <small>{unit}</small>}</strong>
    </div>
  )
}

function formatCpu(value: number) {
  if (value === 0) return '0.00'
  if (value < 0.01) return '<0.01'
  return value.toFixed(2)
}

function algorithmName(id: SearchRunner['id']) {
  return ALGORITHMS.find((algorithm) => algorithm.id === id)?.shortName ?? id
}
