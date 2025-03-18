import { logger } from '../logger.js'

export const serviceState = {
  UP: 'up',
  DOWN: 'down',
  ERROR: 'error',
} as const
const stateSet = new Set([...Object.values(serviceState)])
type serviceStateType = typeof serviceState
export type SERVICE_STATE = serviceStateType['UP' | 'DOWN' | 'ERROR']

const delayedResolve = <T>(delayMs: number, result: T): Promise<T> =>
  new Promise((resolve) => setTimeout(resolve, delayMs, result))

export type Status = {
  status: SERVICE_STATE
  detail: Record<string, unknown> | null
}

type GetStatus = () => Promise<Status>

type StatusHandler = {
  get status(): SERVICE_STATE
  get detail(): Record<string, unknown> | null
  close: () => Promise<void>
}

const mkStatusGenerator = async function* ({
  getStatus,
  serviceTimeoutMs,
}: {
  getStatus: GetStatus
  serviceTimeoutMs: number
}): AsyncGenerator<Status, Status, undefined> {
  while (true) {
    try {
      const newStatus: Status = await Promise.race([
        getStatus(),
        delayedResolve(serviceTimeoutMs, {
          status: serviceState.DOWN,
          detail: {
            message: 'Timeout fetching status',
          },
        }),
      ])

      if (stateSet.has(newStatus.status)) {
        yield {
          status: newStatus.status,
          detail: newStatus.detail === undefined ? null : newStatus.detail,
        }
        continue
      }
      throw new Error('Status is not a valid value')
    } catch (err) {
      logger.debug('Status generator error: %s', err instanceof Error ? err.message : 'unknown')
      yield {
        status: serviceState.ERROR,
        detail: null,
      }
    }
  }
}

export const startStatusHandler = async ({
  pollingPeriodMs,
  serviceTimeoutMs,
  getStatus,
}: {
  pollingPeriodMs: number
  serviceTimeoutMs: number
  getStatus: GetStatus
}): Promise<StatusHandler> => {
  let status: Status | null = null
  const statusGenerator = mkStatusGenerator({ getStatus, serviceTimeoutMs })
  status = (await statusGenerator.next()).value

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  const statusLoop = async function () {
    await delay(pollingPeriodMs)
    for await (const newStatus of statusGenerator) {
      status = newStatus
      await delay(pollingPeriodMs)
    }
  }
  statusLoop()

  return {
    get status() {
      return status?.status || serviceState.ERROR
    },
    get detail() {
      return status?.detail || null
    },
    close: async () => {
      await statusGenerator.return({
        status: 'error',
        detail: null,
      })
    },
  }
}

export const buildCombinedHandler = async (handlerMap: Map<string, StatusHandler>) => {
  const getStatus = () =>
    [...handlerMap].reduce((accStatus: SERVICE_STATE, [, h]) => {
      const handlerStatus = h.status
      if (accStatus === serviceState.UP) {
        return handlerStatus
      }
      if (accStatus === serviceState.DOWN) {
        return accStatus
      }
      if (handlerStatus === serviceState.DOWN) {
        return handlerStatus
      }
      return accStatus
    }, serviceState.UP)

  return {
    get status() {
      return getStatus()
    },
    get detail() {
      return Object.fromEntries([...handlerMap].map(([k, h]) => [k, { status: h.status, detail: h.detail }]))
    },
    close: () => {
      for (const handler of handlerMap.values()) {
        handler.close()
      }
    },
  }
}
