
import { Router } from "express";
import * as z from "zod";
import pool from "../../database.js";
import graph from "../state.js";

// O uuid7 serve para gerar um identificador único, geralmente usado para identificar uma conversa (thread_id) ou uma execução (run_id).
import { uuid7 } from "langsmith";

const router = Router();

const chatSchema = z.object({
    message: z.string()
        .trim()
        .min(1, "A mensagem é obrigatória.")
        .max(5000, "A mensagem deve ter no máximo 5000 caracteres.")
});

router.post("/:userId", async (req, res) => {
    try {
        const userId = Number(req.params.userId);

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            return res.status(400).json({
                message: "ID do usuário inválido."
            });
        }

        const validation = chatSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                message: "Dados inválidos.",
                errors: validation.error.issues.map(issue => ({
                    field: issue.path.join("."),
                    message: issue.message
                }))
            });
        }

        const { message } = validation.data;

        const [users] = await pool.execute(
            "SELECT id FROM users WHERE id = ?",
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "Usuário não encontrado."
            });
        }

        const conversationId = `user_${userId}`;

        const config = {
            configurable: {
                thread_id: conversationId
            },
            context: {
                userId,
                language: "pt-BR"
            }
        };

        // Executa o StateGraph, que chama o agente internamente.
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

        if (structured) {
            return res.status(200).json({
                conversationId,
                message: structured.message,
                type: structured.type,
                tasks: structured.tasks
            });
        }

        const response = result.answer
            || result.messages?.at(-1)?.content;

        if (!response) {
            throw new Error(
                "O agente não retornou uma resposta."
            );
        }

        return res.status(200).json({
            conversationId,
            message: response,
            type: "text",
            tasks: []
        });

    } catch (error) {
        console.error(
            "Erro ao processar mensagem do chat:",
            error
        );

        return res.status(500).json({
            message: "Erro interno ao processar a mensagem."
        });
    }
});

export default router;
