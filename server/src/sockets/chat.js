import * as z from "zod";
import pool from "../../database.js";
import graph from "../state.js";
import { uuid7 } from "langsmith";

const userSchema = z.object({
    userId: z.number()
        .int()
        .positive()
});

const chatSchema = userSchema.extend({
    message: z.string()
        .trim()
        .min(1, "A mensagem é obrigatória.")
        .max(5000, "A mensagem deve ter no máximo 5000 caracteres.")
});

async function userExists(userId) {
    const [users] = await pool.execute(
        "SELECT id FROM users WHERE id = ?",
        [userId]
    );

    return users.length > 0;
}

function joinUserRoom(socket, userId) {
    if (socket.data.userId === userId) {
        return;
    }

    if (socket.data.userId != null) {
        socket.leave(`user:${socket.data.userId}`);
    }

    socket.data.userId = userId;
    socket.data.conversationId = `user_${userId}`;
    socket.join(`user:${userId}`);
}

function leaveUserRoom(socket) {
    if (socket.data.userId != null) {
        socket.leave(`user:${socket.data.userId}`);
    }

    socket.data.userId = null;
    socket.data.conversationId = null;
}

export default function registerChatSocket(io) {
    io.on("connection", (socket) => {
        console.log("Chat conectado:", socket.id);

        socket.on("user:join", async (payload, acknowledge) => {
            const reply = typeof acknowledge === "function"
                ? acknowledge
                : () => {};

            try {
                const validation = userSchema.safeParse(payload);

                if (!validation.success) {
                    return reply({
                        ok: false,
                        message: "Dados inválidos."
                    });
                }

                const { userId } = validation.data;

                if (!(await userExists(userId))) {
                    return reply({
                        ok: false,
                        message: "Usuário não encontrado."
                    });
                }

                joinUserRoom(socket, userId);

                reply({ ok: true });
            } catch (error) {
                console.error("Erro ao entrar na sala do usuário:", error);

                reply({
                    ok: false,
                    message: "Erro interno."
                });
            }
        });

        socket.on("user:leave", () => {
            leaveUserRoom(socket);
        });

        socket.on("chat:message", async (payload, acknowledge) => {
  
            if (typeof acknowledge !== "function") {
                return;
            }

            try {
                const validation = chatSchema.safeParse(payload);

                if (!validation.success) {
                    return acknowledge({
                        ok: false,
                        message: "Dados inválidos.",
                        errors: validation.error.issues.map(issue => ({
                            field: issue.path.join("."),
                            message: issue.message
                        }))
                    });
                }

                const { userId, message } = validation.data;

                if (!(await userExists(userId))) {
                    return acknowledge({
                        ok: false,
                        message: "Usuário não encontrado."
                    });
                }

                joinUserRoom(socket, userId);

                const conversationId = socket.data.conversationId;

                const config = {
                    configurable: {
                        thread_id: conversationId
                    },
                    context: {
                        userId,
                        language: "pt-BR"
                    }
                };

                const result = await graph.invoke(
                    {
                        messages: [
                            {
                                role: "user",
                                content: message
                            }
                        ]
                    },
                    config
                );

                const structured = result.structuredResponse;

                const response = structured
                    ? {
                        message: structured.message,
                        type: structured.type,
                        tasks: structured.tasks ?? []
                    }
                    : {
                        message: result.answer
                            || result.messages?.at(-1)?.content,
                        type: "text",
                        tasks: []
                    };

                if (!response.message && response.tasks.length === 0) {
                    throw new Error("O agente não retornou uma resposta.");
                }

                acknowledge({
                    ok: true,
                    conversationId,
                    ...response
                });

            } catch (error) {
                console.error("Erro no chat WebSocket:", error);

                acknowledge({
                    ok: false,
                    message: "Erro interno ao processar a mensagem."
                });
            }
        });

        socket.on("disconnect", (reason) => {
            console.log("Chat desconectado:", socket.id, reason);
        });
    });
}