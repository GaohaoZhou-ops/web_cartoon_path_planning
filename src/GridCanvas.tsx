import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { AlgorithmMeta, Point, Scenario, SearchRunner } from './pathfinding'
import { pointKey, samePoint } from './pathfinding'

export type EditTool = 'obstacle' | 'erase' | 'start' | 'waypoint' | 'end'

interface GridCanvasProps {
  scenario: Scenario
  runner?: SearchRunner
  algorithm?: AlgorithmMeta
  editing?: boolean
  tool?: EditTool
  visualTick?: number
  onCellAction?: (point: Point, tool: EditTool) => void
  className?: string
}

export default function GridCanvas({
  scenario,
  runner,
  algorithm,
  editing = false,
  tool = 'obstacle',
  visualTick = 0,
  onCellAction,
  className = '',
}: GridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const paintingRef = useRef(false)
  const paintToolRef = useRef<EditTool>(tool)
  const lastCellRef = useRef('')
  const lastPointRef = useRef<Point | null>(null)
  const touchStartRef = useRef<{
    clientX: number
    clientY: number
    point: Point
    tool: EditTool
  } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0 || size.height === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size.width * dpr)
    canvas.height = Math.round(size.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawGrid(ctx, size.width, size.height, scenario, runner, algorithm, editing, visualTick)
  }, [algorithm, editing, runner, scenario, size, visualTick])

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): Point | null => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * scenario.cols)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * scenario.rows)
    if (x < 0 || y < 0 || x >= scenario.cols || y >= scenario.rows) return null
    return { x, y }
  }

  const applyPointer = (event: ReactPointerEvent<HTMLCanvasElement>, ignoreDuplicate = false) => {
    if (!editing || !onCellAction) return
    const point = pointFromEvent(event)
    if (!point) return
    const key = pointKey(point)
    if (!ignoreDuplicate && lastCellRef.current === key) return
    const points =
      !ignoreDuplicate &&
      lastPointRef.current &&
      (paintToolRef.current === 'obstacle' || paintToolRef.current === 'erase')
        ? interpolateGridLine(lastPointRef.current, point).slice(1)
        : [point]
    points.forEach((cell) => onCellAction(cell, paintToolRef.current))
    lastCellRef.current = key
    lastPointRef.current = point
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!editing) return
    paintToolRef.current = event.button === 2 ? 'erase' : tool
    lastCellRef.current = ''
    lastPointRef.current = null

    if (event.pointerType === 'touch') {
      const point = pointFromEvent(event)
      if (!point) return
      touchStartRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        point,
        tool: paintToolRef.current,
      }
      return
    }

    event.preventDefault()
    paintingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    applyPointer(event, true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'touch') return
    if (!paintingRef.current) return
    if (paintToolRef.current !== 'obstacle' && paintToolRef.current !== 'erase') return
    applyPointer(event)
  }

  const stopPainting = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'touch') {
      const start = touchStartRef.current
      touchStartRef.current = null
      if (
        start &&
        Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < 10
      ) {
        onCellAction?.(start.point, start.tool)
      }
      return
    }
    paintingRef.current = false
    lastCellRef.current = ''
    lastPointRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const cancelPainting = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    touchStartRef.current = null
    paintingRef.current = false
    lastCellRef.current = ''
    lastPointRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className={`grid-canvas ${className}`}
      style={{ aspectRatio: `${scenario.cols} / ${scenario.rows}` }}
      data-tool={editing ? tool : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopPainting}
      onPointerCancel={cancelPainting}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={editing ? '可编辑路径规划网格，右键可擦除' : `${algorithm?.name ?? ''} 搜索过程`}
    />
  )
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scenario: Scenario,
  runner: SearchRunner | undefined,
  algorithm: AlgorithmMeta | undefined,
  editing: boolean,
  visualTick: number,
) {
  const cellWidth = width / scenario.cols
  const cellHeight = height / scenario.rows
  const accent = algorithm?.accent ?? '#b8f36a'
  const accentRgb = algorithm?.accentRgb ?? '184, 243, 106'

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#081311'
  ctx.fillRect(0, 0, width, height)

  for (let y = 0; y < scenario.rows; y += 1) {
    for (let x = 0; x < scenario.cols; x += 1) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.009)'
        ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight)
      }
    }
  }

  if (runner) {
    runner.visited.forEach((key) => {
      const point = parseKey(key)
      ctx.fillStyle = `rgba(${accentRgb}, 0.13)`
      ctx.fillRect(point.x * cellWidth + 1, point.y * cellHeight + 1, cellWidth - 2, cellHeight - 2)
    })

    runner.frontier.forEach((key) => {
      const point = parseKey(key)
      const x = point.x * cellWidth
      const y = point.y * cellHeight
      ctx.fillStyle = `rgba(${accentRgb}, 0.28)`
      ctx.fillRect(x + 1.5, y + 1.5, cellWidth - 3, cellHeight - 3)
      ctx.strokeStyle = `rgba(${accentRgb}, 0.72)`
      ctx.lineWidth = 1
      ctx.strokeRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4)
    })

    if (runner.current) {
      for (const relaxed of runner.relaxed) {
        ctx.beginPath()
        ctx.moveTo((runner.current.x + 0.5) * cellWidth, (runner.current.y + 0.5) * cellHeight)
        ctx.lineTo((relaxed.x + 0.5) * cellWidth, (relaxed.y + 0.5) * cellHeight)
        ctx.strokeStyle = `rgba(${accentRgb}, 0.58)`
        ctx.lineWidth = Math.max(1, Math.min(cellWidth, cellHeight) * 0.055)
        ctx.stroke()
      }
    }
  }

  scenario.obstacles.forEach((key) => {
    const point = parseKey(key)
    const x = point.x * cellWidth
    const y = point.y * cellHeight
    ctx.fillStyle = '#26312f'
    ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.055)'
    ctx.fillRect(x + 2, y + 2, cellWidth - 4, Math.max(1, cellHeight * 0.1))
    ctx.beginPath()
    ctx.moveTo(x + cellWidth * 0.25, y + cellHeight * 0.75)
    ctx.lineTo(x + cellWidth * 0.75, y + cellHeight * 0.25)
    ctx.strokeStyle = 'rgba(7, 17, 15, 0.65)'
    ctx.lineWidth = 1
    ctx.stroke()
  })

  ctx.beginPath()
  for (let x = 0; x <= scenario.cols; x += 1) {
    const px = Math.round(x * cellWidth) + 0.5
    ctx.moveTo(px, 0)
    ctx.lineTo(px, height)
  }
  for (let y = 0; y <= scenario.rows; y += 1) {
    const py = Math.round(y * cellHeight) + 0.5
    ctx.moveTo(0, py)
    ctx.lineTo(width, py)
  }
  ctx.strokeStyle = 'rgba(184, 243, 106, 0.075)'
  ctx.lineWidth = 1
  ctx.stroke()

  const routePoints = [scenario.start, ...scenario.waypoints, scenario.end].filter(
    (point): point is Point => point !== null,
  )
  if (editing && routePoints.length > 1) {
    ctx.beginPath()
    routePoints.forEach((point, index) => {
      const x = (point.x + 0.5) * cellWidth
      const y = (point.y + 0.5) * cellHeight
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.setLineDash([Math.max(3, cellWidth * 0.22), Math.max(3, cellWidth * 0.2)])
    ctx.strokeStyle = 'rgba(240, 244, 224, 0.28)'
    ctx.lineWidth = Math.max(1, Math.min(cellWidth, cellHeight) * 0.07)
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (runner && runner.path.length > 1) {
    ctx.beginPath()
    runner.path.forEach((point, index) => {
      const x = (point.x + 0.5) * cellWidth
      const y = (point.y + 0.5) * cellHeight
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(244, 247, 226, 0.92)'
    ctx.lineWidth = Math.max(2.2, Math.min(cellWidth, cellHeight) * 0.22)
    ctx.shadowColor = accent
    ctx.shadowBlur = 8
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.strokeStyle = accent
    ctx.lineWidth = Math.max(1, Math.min(cellWidth, cellHeight) * 0.065)
    ctx.stroke()
  }

  if (runner?.current) {
    const x = (runner.current.x + 0.5) * cellWidth
    const y = (runner.current.y + 0.5) * cellHeight
    const pulse = 0.34 + (Math.sin(visualTick * 0.62) + 1) * 0.045
    ctx.beginPath()
    ctx.arc(x, y, Math.min(cellWidth, cellHeight) * pulse, 0, Math.PI * 2)
    ctx.fillStyle = '#f4f7e2'
    ctx.shadowColor = accent
    ctx.shadowBlur = 13
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#07110f'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  if (scenario.start) drawMarker(ctx, scenario.start, 'S', '#78efc0', 'circle', cellWidth, cellHeight)
  scenario.waypoints.forEach((point, index) =>
    drawMarker(ctx, point, String(index + 1), '#ffc866', 'diamond', cellWidth, cellHeight),
  )
  if (scenario.end) drawMarker(ctx, scenario.end, 'E', '#ff7e6b', 'square', cellWidth, cellHeight)

  ctx.strokeStyle = runner?.status === 'failed' ? 'rgba(255, 113, 141, 0.72)' : `rgba(${accentRgb}, 0.3)`
  ctx.lineWidth = 1.5
  ctx.strokeRect(0.75, 0.75, width - 1.5, height - 1.5)
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  point: Point,
  label: string,
  color: string,
  shape: 'circle' | 'diamond' | 'square',
  cellWidth: number,
  cellHeight: number,
) {
  const x = (point.x + 0.5) * cellWidth
  const y = (point.y + 0.5) * cellHeight
  const radius = Math.min(cellWidth, cellHeight) * 0.35
  ctx.save()
  ctx.translate(x, y)
  ctx.beginPath()
  if (shape === 'circle') {
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
  } else if (shape === 'diamond') {
    ctx.moveTo(0, -radius * 1.1)
    ctx.lineTo(radius * 1.1, 0)
    ctx.lineTo(0, radius * 1.1)
    ctx.lineTo(-radius * 1.1, 0)
    ctx.closePath()
  } else {
    ctx.rect(-radius, -radius, radius * 2, radius * 2)
  }
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 9
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = '#07110f'
  ctx.lineWidth = Math.max(1.2, radius * 0.13)
  ctx.stroke()
  ctx.fillStyle = '#07110f'
  ctx.font = `700 ${Math.max(8, radius * 1.18)}px "Avenir Next Condensed", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 0, 0.5)
  ctx.restore()
}

function parseKey(key: string): Point {
  const separator = key.indexOf(',')
  return { x: Number(key.slice(0, separator)), y: Number(key.slice(separator + 1)) }
}

function interpolateGridLine(start: Point, end: Point): Point[] {
  const points: Point[] = []
  let x = start.x
  let y = start.y
  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)
  const stepX = start.x < end.x ? 1 : -1
  const stepY = start.y < end.y ? 1 : -1
  let error = dx - dy

  while (true) {
    points.push({ x, y })
    if (x === end.x && y === end.y) break
    const twiceError = error * 2
    if (twiceError > -dy) {
      error -= dy
      x += stepX
    }
    if (twiceError < dx) {
      error += dx
      y += stepY
    }
  }
  return points
}

export function isRoutePoint(scenario: Scenario, point: Point) {
  return (
    samePoint(scenario.start, point) ||
    samePoint(scenario.end, point) ||
    scenario.waypoints.some((waypoint) => samePoint(waypoint, point))
  )
}
