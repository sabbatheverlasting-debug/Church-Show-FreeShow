import { app, shell } from "electron"
import fs from "fs"
import path from "path"
import { getDataFolderPath } from "../utils/files"
let quiz: any
let starting: Promise<void> | null = null
function root() { return path.join(app.getAppPath(), app.isPackaged ? "build/public/church-quiz" : "public/church-quiz") }
export async function churchQuiz(data: { action: "start" | "questions" }) {
    if (data.action === "questions") return { questions: JSON.parse(fs.readFileSync(path.join(root(), "data/starter-questions.json"), "utf8")) }
    if (!quiz) {
        const folder = getDataFolderPath("imports", "Church Show quiz")
        fs.mkdirSync(folder, { recursive: true })
        process.env.CHURCH_SHOW_QUIZ_DATA_DIR = folder
        quiz = require(path.join(root(), "server.js"))
        app.on("before-quit", () => quiz?.server.close())
    }
    if (!quiz.server.listening) {
        if (!starting) starting = new Promise<void>((resolve, reject) => {
            quiz.server.once("error", reject)
            quiz.server.listen(5515, "0.0.0.0", resolve)
        }).finally(() => { starting = null })
        await starting
    }
    const url = "http://127.0.0.1:5515/"
    await shell.openExternal(url)
    return { url }
}
