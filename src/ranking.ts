import type { AlgorithmId, AlgorithmMeta, SearchRunner } from './pathfinding'

interface MetricResult {
  status: SearchRunner['status']
  value: number | null
}

export function appendFinishedAlgorithms(
  finishOrder: AlgorithmId[],
  runners: SearchRunner[],
): AlgorithmId[] {
  const seen = new Set(finishOrder)
  const newlyFinished = runners
    .filter((runner) => runner.status !== 'running' && !seen.has(runner.id))
    .map((runner) => runner.id)

  return newlyFinished.length > 0 ? [...finishOrder, ...newlyFinished] : finishOrder
}

export function orderAlgorithmsByFinish(
  algorithms: AlgorithmMeta[],
  finishOrder: AlgorithmId[],
): AlgorithmMeta[] {
  const algorithmsById = new Map(algorithms.map((algorithm) => [algorithm.id, algorithm]))
  const rankedIds = new Set(finishOrder)
  const ranked = finishOrder
    .map((id) => algorithmsById.get(id))
    .filter((algorithm): algorithm is AlgorithmMeta => Boolean(algorithm))
  const stillRunning = algorithms.filter((algorithm) => !rankedIds.has(algorithm.id))
  return [...ranked, ...stillRunning]
}

export function orderMetricResultsBestFirst<T>(
  items: T[],
  getResult: (item: T) => MetricResult,
): T[] {
  return items
    .map((item, index) => ({ item, index, result: getResult(item) }))
    .sort((left, right) => {
      const leftSucceeded = left.result.status === 'complete'
      const rightSucceeded = right.result.status === 'complete'
      if (leftSucceeded !== rightSucceeded) return leftSucceeded ? -1 : 1

      if (left.result.value === null && right.result.value !== null) return 1
      if (left.result.value !== null && right.result.value === null) return -1
      if (left.result.value !== null && right.result.value !== null) {
        const valueDifference = left.result.value - right.result.value
        if (valueDifference !== 0) return valueDifference
      }

      return left.index - right.index
    })
    .map(({ item }) => item)
}
