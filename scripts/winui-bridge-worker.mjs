import { stdin, stdout, stderr } from 'node:process'
import { handleWorkspaceBridgeCommand } from '../app-services/host/workspace-bridge-service.js'

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = ''

    stdin.setEncoding('utf8')
    stdin.on('data', (chunk) => {
      raw += chunk
    })
    stdin.on('end', () => resolve(raw))
    stdin.on('error', reject)
  })
}

async function main() {
  try {
    const raw = await readStdin()
    const request = raw.trim() ? JSON.parse(raw) : {}
    const emitEvent = (event, payload) => {
      stdout.write(`${JSON.stringify({ type: 'event', event, payload })}\n`)
    }

    const result = await handleWorkspaceBridgeCommand({
      ...request,
      emitEvent,
    })
    stdout.write(`${JSON.stringify({ type: 'result', ok: true, result })}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    stderr.write(`${message}\n`)
    stdout.write(
      `${JSON.stringify({
        type: 'result',
        ok: false,
        error: {
          code: 'worker_failure',
          message,
        },
      })}\n`,
    )
    process.exitCode = 1
  }
}

void main()
