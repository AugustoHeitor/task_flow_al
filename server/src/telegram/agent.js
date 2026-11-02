import graph from "../state.js";

function contentToText(content) {
    if (content == null) {
        return "";
    }

    if (typeof content === "string") {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map(item => {
                if (typeof item === "string") {
                    return item;
                }

                return item?.type === "text" ? item.text ?? "" : "";
            })
            .filter(Boolean)
            .join("\n");
    }

    if (typeof content === "object" && "content" in content) {
        return contentToText(content.content);
    }

    return "";
}

function unwrapJsonMessage(text) {
    const trimmed = text.trim();

    if (!trimmed.startsWith("{")) {
        return text;
    }

    try {
        const parsed = JSON.parse(trimmed);

        if (typeof parsed?.message === "string") {
            return parsed.message;
        }
    } catch {

    }

    return text;
}

export async function askAgent({ userId, message, conversationId }) {
    const result = await graph.invoke(
        {
            messages: [
                {
                    role: "user",
                    content: message
                }
            ]
        },
        {
            configurable: {
                thread_id: conversationId
            },
            context: {
                userId,
                language: "pt-BR"
            }
        }
    );

    const structured = result.structuredResponse;

    const response = structured
        ? {
            message: contentToText(structured.message),
            type: structured.type ?? "text",
            tasks: Array.isArray(structured.tasks)
                ? structured.tasks
                : []
        }
        : {
            message: contentToText(
                result.answer ?? result.messages?.at(-1)?.content
            ),
            type: "text",
            tasks: []
        };

    response.message = unwrapJsonMessage(response.message);

    if (!response.message && response.tasks.length === 0) {
        throw new Error("O agente não retornou uma resposta.");
    }

    return response;
}