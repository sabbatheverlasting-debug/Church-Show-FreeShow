const { spawn } = require("node:child_process")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "church-startup-"))
const executable = path.resolve("dist/mac/Church Show Pro 2.app/Contents/MacOS/Church Show Pro 2")
const child = spawn(executable, [], { env: { ...process.env, CHURCH_SHOW_STARTUP_SMOKE: "1", FS_MOCK_STORE_PATH: temporary }, stdio: ["ignore", "pipe", "pipe"] })
let output = "", passed = false, finished = false
const timeout = setTimeout(() => finish(false, "Packaged app did not reach its main window within 60 seconds"), 60000)
function finish(success, reason) {
    if (finished) return
    finished = true
    clearTimeout(timeout)
    console.log(reason)
    child.kill("SIGTERM")
    setTimeout(() => { child.kill("SIGKILL"); fs.rmSync(temporary, { recursive: true, force: true }); process.exit(success ? 0 : 1) }, 1500)
}
function receive(chunk) {
    const text = chunk.toString()
    process.stdout.write(text)
    output = (output + text).slice(-100000)
    if (/Uncaught Exception|TypeError:.*not a function|Error launching app/i.test(output)) return finish(false, "Packaged app raised a startup exception")
    if (!passed && output.includes("CHURCH_SHOW_MAIN_WINDOW_READY")) {
        passed = true
        setTimeout(() => finish(true, "Packaged Mac app reached the main window and remained running"), 5000)
    }
}
child.stdout.on("data", receive)
child.stderr.on("data", receive)
child.on("error", (error) => finish(false, error.message))
child.on("exit", (code) => { if (!finished) finish(false, `App exited before startup validation (code ${code})`) })
