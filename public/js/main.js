import { initUsers } from "./users.js";
import { initTasks } from "./tasks.js";
import { initChat } from "./chat.js";

async function start() {
    try {
        const tasks = initTasks();

        if (!tasks) {
            throw new Error("Não foi possível inicializar as tarefas.");
        }

        const chat = initChat({
            onTaskCreated: tasks.addTaskRealtime
        });

        if (!chat) {
            throw new Error("Não foi possível inicializar o chat.");
        }

        const users = initUsers({
            onChange: async user => {
                if (user) {
                    const userId = Number(user.id);

                    await tasks.setUser(userId);
                    await chat.setUser(userId);

                    console.log("Usuário selecionado:", userId);
                } else {
                    tasks.clear();
                    chat.clear();
                }
            }
        });

        await users.load();
    } catch (error) {
        console.error("Erro ao inicializar a aplicação:", error);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
        once: true
    });
} else {
    start();
}