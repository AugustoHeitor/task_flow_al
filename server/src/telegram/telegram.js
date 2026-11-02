import { Bot, GrammyError } from "grammy";
import { uuid7 } from "langsmith";
import pool from "../../database.js";
import { askAgent } from "./agent.js";

const MAX_INPUT_LENGTH = 5000;
const CHUNK_SIZE = 3500; 

const STATUS_LABELS = {
    pending: "Pendente",
    "in-progress": "Em andamento",
    completed: "Concluída",
    cancelled: "Cancelada",
    paused: "Pausada"
};

const BULLET_PATTERN = /^\s*[•\-*]\s+/;
const ORDERED_PATTERN = /^\s*\d+[.)]\s+/;

const conversations = new Map();

function getConversationId(telegramId, userId) {
    const current = conversations.get(telegramId);

    if (current && current.userId === userId) {
        return current.conversationId;
    }

    const conversationId = `user_${userId}`;
    conversations.set(telegramId, { userId, conversationId });

    return conversationId;
}

function getUserName(user) {
    return [user.first_name, user.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
}

async function findUserByTelegramId(telegramId) {
    const [rows] = await pool.execute(
        `SELECT id, first_name, last_name
         FROM users
         WHERE id_telegram = ?`,
        [telegramId]
    );

    return rows[0] ?? null;
}

const USER_NOT_FOUND_MESSAGE =
    "Desculpe, não consegui te identificar. " +
    "Para mais informações, entre em contato com o suporte do TaskFlow.";

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function toTelegramHtml(text) {
    return escapeHtml(text)
        .replace(/^\s*#{1,6}\s+(.*)$/gm, "<b>$1</b>")
        .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
        .replace(/`([^`\n]+)`/g, "<code>$1</code>");
}

function splitText(text, max = CHUNK_SIZE) {
    const chunks = [];
    let rest = text.trim();

    while (rest.length > max) {
        let cut = rest.lastIndexOf("\n", max);

        if (cut < max / 2) {
            cut = max;
        }

        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }

    if (rest) {
        chunks.push(rest);
    }

    return chunks.filter(Boolean);
}

async function sendText(ctx, text) {
    for (const chunk of splitText(text)) {
        try {
            await ctx.reply(toTelegramHtml(chunk), {
                parse_mode: "HTML"
            });
        } catch (error) {

            if (
                error instanceof GrammyError &&
                error.error_code === 400
            ) {
                await ctx.reply(chunk);
            } else {
                throw error;
            }
        }
    }
}

function stripTaskListing(text) {
    const lines = String(text ?? "").split("\n");

    const firstItem = lines.findIndex(
        line =>
            BULLET_PATTERN.test(line) ||
            ORDERED_PATTERN.test(line)
    );

    if (firstItem === -1) {
        return text;
    }

    return lines.slice(0, firstItem).join("\n").trim();
}

function formatTasks(tasks) {
    return tasks
        .map(task => {
            const status =
                STATUS_LABELS[task.status] ?? task.status ?? "";

            const head =
                `#${task.id} — ${task.title || "Sem título"}` +
                (status ? ` (${status})` : "");

            return task.description
                ? `${head}\n${task.description}`
                : head;
        })
        .join("\n\n");
}

function buildReply({ message, tasks }) {
    const parts = [];

    const text = tasks.length > 0
        ? stripTaskListing(message)
        : message;

    if (text) {
        parts.push(text);
    }

    if (tasks.length > 0) {
        parts.push(formatTasks(tasks));
    }

    return parts.join("\n\n");
}

export function startTelegramBot() {

    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        console.warn(
            "TELEGRAM_BOT_TOKEN não definido. Bot do Telegram desativado."
        );
        return null;
    }

    const bot = new Bot(token);

    bot.use(async (ctx, next) => {
        if (ctx.chat?.type !== "private" || !ctx.from) {
            return;
        }

        await next();
    });

    bot.command("start", async ctx => {
        const user = await findUserByTelegramId(ctx.from.id);

        if (!user) {
            return ctx.reply(USER_NOT_FOUND_MESSAGE);
        }

        const name = getUserName(user);

        return ctx.reply(
            `Olá${name ? `, ${name}` : ""}! 😊 Como posso te ajudar hoje?\n\n` +
            "Você pode me pedir para criar tarefas, consultar suas tarefas pendentes ou organizar suas atividades."
        );
    });

    bot.on("message:text", async ctx => {
        const text = ctx.message.text.trim();

        if (text.startsWith("/")) {
            return ctx.reply(
                "Comando desconhecido. Use /start para ver as opções."
            );
        }

        if (!text) {
            return;
        }

        if (text.length > MAX_INPUT_LENGTH) {
            return ctx.reply(
                `A mensagem deve ter no máximo ${MAX_INPUT_LENGTH} caracteres.`
            );
        }

        const sendTyping = () =>
            ctx.replyWithChatAction("typing").catch(() => {});

        sendTyping();
        const typing = setInterval(sendTyping, 4000);

        try {
            
            const user = await findUserByTelegramId(ctx.from.id);

            if (!user) {
                return await ctx.reply(USER_NOT_FOUND_MESSAGE);
            }

            const response = await askAgent({
                userId: user.id,
                message: text,
                conversationId: getConversationId(ctx.from.id, user.id)
            });

            await sendText(ctx, buildReply(response));
        } catch (error) {
            console.error("Erro ao processar mensagem do Telegram:", error);

            await ctx.reply(
                "Não foi possível processar sua mensagem agora. " +
                "Tente novamente em instantes."
            ).catch(() => {});
        } finally {
            clearInterval(typing);
        }
    });

    bot.catch(error => {
        console.error("Erro no bot do Telegram:", error.error);
    });

    bot.start({
        onStart: info => {
            console.log(`Bot do Telegram ativo: @${info.username}`);

            bot.api
                .setMyCommands([
                    { command: "start", description: "Começar a conversar" },
                    { command: "id", description: "Ver meu ID do Telegram" },
                    { command: "novo", description: "Reiniciar a conversa" }
                ])
                .catch(() => {});
        }
    }).catch(error => {
        console.error("Não foi possível iniciar o bot do Telegram:", error);
    });

    return bot;
}