import type { AlgorithmId, AlgorithmMeta, SearchRunner } from './pathfinding'

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
