import { tool } from "langchain";
import * as z from "zod";
import pool from "../database.js";
import { emitToUser } from "./sockets/io.js";

const taskStatus = z.enum([
    "pending",
    "in-progress",
    "completed",
    "cancelled",
    "paused"
]);

function validateUserId(userId) {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
        throw new Error("Usuário autenticado inválido.");
    }

    return userId;
}

async function findTask(taskId, userId) {
    const [rows] = await pool.execute(
        `SELECT id, title, description, status, created_at, user_id
         FROM tasks
         WHERE id = ? AND user_id = ?`,
        [taskId, userId]
    );

    return rows[0] ?? null;
}

const listTasks = tool(
    async (_, runtime) => {
        const userId = validateUserId(runtime.context?.userId);

        const [tasks] = await pool.execute(
            `SELECT id, title, description, status, created_at
             FROM tasks
             WHERE user_id = ?
             ORDER BY id DESC`,
            [userId]
        );

        return JSON.stringify({
            success: true,
            tasks
        });
    },
    {
        name: "list_tasks",
        description:
            "Lista as tarefas do usuário autenticado. Use para consultar tarefas, pendências e atividades cadastradas.",
        schema: z.object({})
    }
);

const getTask = tool(
    async ({ taskId }, runtime) => {
        const userId = validateUserId(runtime.context?.userId);

        const [tasks] = await pool.execute(
            `SELECT id, title, description, status, created_at
             FROM tasks
             WHERE id = ? AND user_id = ?`,
            [taskId, userId]
        );

        if (tasks.length === 0) {
            return JSON.stringify({
                success: false,
                message: "Tarefa não encontrada ou indisponível."
            });
        }

        return JSON.stringify({
            success: true,
            task: tasks[0]
        });
    },
    {
        name: "get_task",
        description:
            "Consulta os detalhes de uma tarefa específica pertencente ao usuário autenticado.",
        schema: z.object({
            taskId: z.number()
                .int()
                .min(1)
                .describe("ID da tarefa que será consultada.")
        })
    }
);

const createTask = tool(
    async ({ title, description, status }, runtime) => {
        const userId = validateUserId(runtime.context?.userId);

        const finalStatus = status ?? "pending";

        const [result] = await pool.execute(
            `INSERT INTO tasks
                (title, description, status, user_id)
             VALUES (?, ?, ?, ?)`,
            [
                title,
                description ?? null,
                finalStatus,
                userId
            ]
        );

        const task = await findTask(result.insertId, userId);

        if (!task) {
            throw new Error("A tarefa foi criada, mas não pôde ser consultada.");
        }

        emitToUser(userId, "task:created", task);

        return JSON.stringify({
            success: true,
            message: "Tarefa criada com sucesso.",
            task
        });
    },
    {
        name: "create_task",
        description:
            "Cria uma tarefa para o usuário autenticado. Utilize quando ele solicitar explicitamente a criação de uma tarefa.",
        schema: z.object({
            title: z.string()
                .trim()
                .min(1)
                .max(255)
                .describe("Título da tarefa."),

            description: z.string()
                .optional()
                .describe("Descrição da tarefa, se fornecida."),

            status: taskStatus
                .optional()
                .describe("Status inicial da tarefa. Se omitido, será pending.")
        })
    }
);

const updateTask = tool(
    async ({ taskId, title, description, status }, runtime) => {
        const userId = validateUserId(runtime.context?.userId);

        const existing = await findTask(taskId, userId);

        if (!existing) {
            return JSON.stringify({
                success: false,
                message: "Tarefa não encontrada ou indisponível."
            });
        }

        const fields = [];
        const values = [];

        if (title !== undefined) {
            fields.push("title = ?");
            values.push(title);
        }

        if (description !== undefined) {
            fields.push("description = ?");
            values.push(description === "" ? null : description);
        }

        if (status !== undefined) {
            fields.push("status = ?");
            values.push(status);
        }

        if (fields.length === 0) {
            return JSON.stringify({
                success: false,
                message: "Nenhum campo foi informado para atualização."
            });
        }

        values.push(taskId, userId);

        await pool.execute(
            `UPDATE tasks
             SET ${fields.join(", ")}
             WHERE id = ? AND user_id = ?`,
            values
        );

        const task = await findTask(taskId, userId);

        emitToUser(userId, "task:updated", task);

        return JSON.stringify({
            success: true,
            message: "Tarefa atualizada com sucesso.",
            task
        });
    },
    {
        name: "update_task",
        description:
            "Atualiza o título, a descrição ou o status de uma tarefa do usuário autenticado. Informe o ID da tarefa e somente os campos que devem ser alterados. Para apagar a descrição, informe uma string vazia.",
        schema: z.object({
            taskId: z.number()
                .int()
                .min(1)
                .describe("ID da tarefa que será atualizada."),

            title: z.string()
                .trim()
                .min(1, "O título não pode ficar vazio.")
                .max(255, "O título deve ter no máximo 255 caracteres.")
                .optional()
                .describe("Novo título da tarefa, se precisar alterá-lo."),

            description: z.string()
                .trim()
                .optional()
                .describe("Nova descrição da tarefa. Use uma string vazia para apagar a descrição."),

            status: taskStatus
                .optional()
                .describe("Novo status da tarefa.")
        })
    }
);


function getUserNamespace(runtime) {
    const userId = runtime.context?.userId;

    if (!Number.isSafeInteger(userId) || userId <= 0) {
        throw new Error("Usuário autenticado inválido.");
    }

    return ["taskflow", String(userId), "memories"];
}

const saveMemory = tool(
    async ({ key, information }, runtime) => {
        const namespace = getUserNamespace(runtime);
        const store = runtime.store;

        console.log("[save_memory] Iniciando:", {
            namespace,
            key,
            information,
            hasStore: Boolean(store)
        });

        if (!store) {
            throw new Error("Armazenamento de memória indisponível.");
        }

        await store.put(namespace, key, {
            information,
            updatedAt: new Date().toISOString()
        });

        const saved = await store.get(namespace, key);

        console.log("[save_memory] Verificação:", saved);

        return JSON.stringify({
            success: true,
            message: "Memória salva e verificada.",
            key,
            verified: Boolean(saved?.value)
        });
    },
    {
        name: "save_memory",
        description:
            "Salva informações relevantes explicitamente fornecidas pelo usuário para uso em conversas futuras. Use esta ferramenta quando o usuário compartilhar informações pessoais que queira preservar. Não afirme que salvou sem executar a ferramenta.",
        schema: z.object({
            key: z.string().min(1),
            information: z.string().min(1)
        })
    }
);

const searchMemories = tool(
    async (_, runtime) => {
        const namespace = getUserNamespace(runtime);
        const store = runtime.store;

        console.log("[search_memories] Consultando:", {
            namespace,
            hasStore: Boolean(store)
        });

        if (!store) {
            throw new Error("Armazenamento de memória indisponível.");
        }

        const memories = await store.search(namespace, {
            limit: 50
        });

        console.log(
            "[search_memories] Resultado:",
            JSON.stringify(memories, null, 2)
        );

        return JSON.stringify({
            success: true,
            memories: memories.map(item => ({
                key: item.key,
                ...item.value
            }))
        });
    },
    {
        name: "search_memories",
        description:
            "Pesquisa as informações previamente salvas na memória de longo prazo deste usuário. Use antes de responder perguntas sobre fatos, preferências ou histórias de conversas anteriores.",
        schema: z.object({})
    }
);

export {
    listTasks,
    getTask,
    createTask,
    updateTask,
    searchMemories,
    saveMemory
};


