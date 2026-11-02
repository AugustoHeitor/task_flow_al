const SUGGESTIONS = [
    "Tarefas pendentes",
    "+ Criar tarefa",
    "Editar tarefa"
];

const SVG_NS = "http://www.w3.org/2000/svg";

const ICONS = {
    close: ["M18 6 6 18", "m6 6 12 12"],
    send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"]
};

const STATUS_LABELS = {
    pending: "Pendente",
    "in-progress": "Em andamento",
    completed: "Concluída",
    cancelled: "Cancelada",
    paused: "Pausada"
};

const BULLET_PATTERN = /^\s*[•\-*]\s+(.*)$/;
const ORDERED_PATTERN = /^\s*\d+[.)]\s+(.*)$/;
const HEADING_PATTERN = /^\s*#{1,6}\s+(.*)$/;
const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;

function extractJsonObject(value) {
    if (typeof value !== "string") {
        return null;
    }

    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");

    if (start === -1 || end <= start) {
        return null;
    }

    try {
        const parsed = JSON.parse(value.slice(start, end + 1));

        return parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
            ? parsed
            : null;
    } catch {
        return null;
    }
}

function messageToText(message) {
    if (message == null) {
        return "";
    }

    if (typeof message === "string") {
        return message;
    }

    if (Array.isArray(message)) {
        return message
            .map(item => {
                if (typeof item === "string") {
                    return item;
                }

                if (item?.type === "text") {
                    return item.text ?? "";
                }

                return "";
            })
            .filter(Boolean)
            .join("\n");
    }

    if (typeof message === "object") {
        if (typeof message.content === "string") {
            return message.content;
        }

        if (Array.isArray(message.content)) {
            return messageToText(message.content);
        }
    }

    return String(message);
}

function stripTaskListing(text) {
    const lines = String(text ?? "")
        .replace(/\r\n/g, "\n")
        .split("\n");

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

function normalizeReply(result) {
    let data =
        result?.structuredResponse ??
        result?.response ??
        result?.data ??
        result;

    for (let i = 0; i < 3; i++) {
        let candidate = null;

        if (typeof data === "string") {
            candidate = extractJsonObject(data);
        } else if (typeof data?.message === "string") {
            candidate = extractJsonObject(data.message);
        } else if (
            data?.message &&
            typeof data.message === "object" &&
            !Array.isArray(data.message)
        ) {
            candidate = data.message;
        }

        if (candidate && "message" in candidate) {
            data = candidate;
        } else {
            break;
        }
    }

    if (typeof data === "string") {
        data = { message: data };
    }

    let tasks = Array.isArray(data?.tasks)
        ? data.tasks
        : [];

    if (data?.task && typeof data.task === "object") {
        const alreadyIncluded = tasks.some(
            task => String(task.id) === String(data.task.id)
        );

        if (!alreadyIncluded) {
            tasks = [...tasks, data.task];
        }
    }

    let message = messageToText(data?.message);

    if (tasks.length > 0) {
        message = stripTaskListing(message);
    }

    return {
        message,
        type: typeof data?.type === "string"
            ? data.type
            : "text",
        tasks
    };
}

function appendInline(parent, text) {
    let lastIndex = 0;
    let match;

    INLINE_PATTERN.lastIndex = 0;

    while ((match = INLINE_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parent.append(
                document.createTextNode(
                    text.slice(lastIndex, match.index)
                )
            );
        }

        const token = match[0];
        let element;

        if (token.startsWith("**")) {
            element = document.createElement("strong");
            element.textContent = token.slice(2, -2);
        } else if (token.startsWith("`")) {
            element = document.createElement("code");
            element.textContent = token.slice(1, -1);
        } else {
            element = document.createElement("em");
            element.textContent = token.slice(1, -1);
        }

        parent.append(element);
        lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
        parent.append(
            document.createTextNode(text.slice(lastIndex))
        );
    }
}

function renderRichText(container, text) {
    const lines = String(text ?? "")
        .replace(/\r\n/g, "\n")
        .split("\n");

    let list = null;
    let listTag = null;

    function closeList() {
        list = null;
        listTag = null;
    }

    function addListItem(tag, content) {
        if (listTag !== tag) {
            list = document.createElement(tag);
            list.classList.add("chat-list");
            listTag = tag;
            container.append(list);
        }

        const item = document.createElement("li");
        appendInline(item, content.trim());
        list.append(item);
    }

    lines.forEach(line => {
        if (!line.trim()) {
            closeList();
            return;
        }

        const bullet = line.match(BULLET_PATTERN);

        if (bullet) {
            addListItem("ul", bullet[1]);
            return;
        }

        const ordered = line.match(ORDERED_PATTERN);

        if (ordered) {
            addListItem("ol", ordered[1]);
            return;
        }

        closeList();

        const heading = line.match(HEADING_PATTERN);
        const paragraph = document.createElement("p");

        if (heading) {
            paragraph.classList.add("chat-heading");
            appendInline(paragraph, heading[1].trim());
        } else {
            paragraph.classList.add("chat-paragraph");
            appendInline(paragraph, line.trim());
        }

        container.append(paragraph);
    });
}

export function initChat({ onTaskCreated } = {}) {
    const btnChat = document.querySelector("#btn-chat, .btn-chat");

    if (!btnChat) {
        console.error("Botão do chat (#btn-chat) não encontrado.");
        return null;
    }

    if (typeof window.io !== "function") {
        console.error(
            "Socket.IO não foi carregado. " +
            "Adicione /socket.io/socket.io.js antes do módulo do chat."
        );
        return null;
    }

    const socket = window.io();

    let panel = null;
    let messages = null;
    let input = null;
    let btnSend = null;

    let currentUserId = null;
    let isOpen = false;
    let isReplying = false;
    let requestId = 0;

    function showMessage(message) {
        window.alert(message);
    }

    function createIcon(paths, size = 20) {
        const svg = document.createElementNS(SVG_NS, "svg");

        svg.setAttribute("width", size);
        svg.setAttribute("height", size);
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");

        paths.forEach(d => {
            const path = document.createElementNS(SVG_NS, "path");
            path.setAttribute("d", d);
            svg.append(path);
        });

        return svg;
    }

    function createBotAvatar(small = false) {
        const avatar = document.createElement("span");
        avatar.classList.add("chat-avatar");

        if (small) {
            avatar.classList.add("chat-avatar-small");
        }

        const img = document.createElement("img");
        img.src = "./imgs/robot-chat.svg";
        img.width = 22;
        img.alt = "Assistente de IA";

        avatar.append(img);

        return avatar;
    }

    function setSendEnabled(enabled) {
        if (btnSend) {
            btnSend.disabled = !enabled;
        }

        if (input) {
            input.disabled = !enabled;
        }

        if (panel) {
            panel.setAttribute("aria-busy", String(!enabled));
        }
    }

    function scrollToBottom() {
        if (!messages) {
            return;
        }

        messages.scrollTo({
            top: messages.scrollHeight,
            behavior: "smooth"
        });
    }

    function createTaskCard(task) {
        const card = document.createElement("div");
        card.classList.add("chat-task");

        const header = document.createElement("div");
        header.classList.add("chat-task-header");

        const id = document.createElement("span");
        id.classList.add("chat-task-id");
        id.textContent = `#${task?.id ?? "-"}`;

        const title = document.createElement("strong");
        title.classList.add("chat-task-title");
        title.textContent = task?.title || "Sem título";

        const status = document.createElement("span");
        status.classList.add("chat-task-status");
        status.dataset.status = task?.status ?? "";
        status.textContent =
            STATUS_LABELS[task?.status] ?? task?.status ?? "";

        header.append(id, title, status);
        card.append(header);

        if (task?.description) {
            const description = document.createElement("p");
            description.classList.add("chat-task-description");
            description.textContent = task.description;
            card.append(description);
        }

        return card;
    }

    function createTaskList(tasks) {
        const list = document.createElement("div");
        list.classList.add("chat-tasks");

        tasks.forEach(task => {
            list.append(createTaskCard(task));
        });

        return list;
    }

    function addMessage(author, text, options = {}) {
        if (!messages) {
            return null;
        }

        const { tasks = [], type = "text" } = options;

        const message = document.createElement("div");
        message.classList.add(
            "chat-message",
            `chat-message-${author}`
        );

        const bubble = document.createElement("div");
        bubble.classList.add("chat-bubble");

        if (type === "error") {
            bubble.classList.add("chat-bubble-error");
        }

        if (author === "bot") {
            renderRichText(bubble, text);

            if (tasks.length > 0) {
                bubble.append(createTaskList(tasks));
            }
        } else {
            String(text ?? "").split("\n").forEach((line, index) => {
                if (index > 0) {
                    bubble.append(document.createElement("br"));
                }

                bubble.append(document.createTextNode(line));
            });
        }

        if (author === "bot") {
            message.append(createBotAvatar(true));
        }

        message.append(bubble);
        messages.append(message);

        scrollToBottom();

        return message;
    }

    function addTypingIndicator() {
        const message = document.createElement("div");
        message.classList.add(
            "chat-message",
            "chat-message-bot"
        );

        const bubble = document.createElement("div");
        bubble.classList.add("chat-bubble", "chat-typing");

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement("span");
            dot.classList.add("chat-typing-dot");
            bubble.append(dot);
        }

        message.append(createBotAvatar(true), bubble);
        messages.append(message);

        scrollToBottom();

        return message;
    }

    function createHeader() {
        const header = document.createElement("div");
        header.classList.add("chat-header");

        const info = document.createElement("div");
        info.classList.add("chat-header-info");

        const texts = document.createElement("div");
        texts.classList.add("chat-header-texts");

        const title = document.createElement("h3");
        title.textContent = "Assistente de IA do TaskFlow";

        const subtitle = document.createElement("p");
        subtitle.textContent = "Automação Inteligente de Tarefas";

        texts.append(title, subtitle);
        info.append(createBotAvatar(), texts);

        const btnClose = document.createElement("button");
        btnClose.type = "button";
        btnClose.classList.add("btn-chat-close");
        btnClose.setAttribute("aria-label", "Fechar chat");
        btnClose.append(createIcon(ICONS.close, 22));
        btnClose.addEventListener("click", closeChat);

        header.append(info, btnClose);

        return header;
    }

    function createSuggestions() {
        const container = document.createElement("div");
        container.classList.add("chat-suggestions");

        const label = document.createElement("span");
        label.classList.add("chat-suggestions-label");
        label.textContent = "SUGESTÕES:";

        container.append(label);

        SUGGESTIONS.forEach(text => {
            const chip = document.createElement("button");

            chip.type = "button";
            chip.classList.add("chat-suggestion");
            chip.textContent = text;

            chip.addEventListener("click", () => {
                sendMessage(text);
            });

            container.append(chip);
        });

        return container;
    }

    function createForm() {
        const form = document.createElement("form");
        form.classList.add("chat-form");

        input = document.createElement("input");
        input.type = "text";
        input.classList.add("chat-input");
        input.placeholder =
            "Pergunte à IA ou digite um comando de tarefa...";
        input.autocomplete = "off";
        input.maxLength = 5000;
        input.setAttribute(
            "aria-label",
            "Mensagem para o assistente"
        );

        btnSend = document.createElement("button");
        btnSend.type = "submit";
        btnSend.classList.add("btn-chat-send");
        btnSend.setAttribute("aria-label", "Enviar mensagem");
        btnSend.append(createIcon(ICONS.send, 20));

        form.append(input, btnSend);

        form.addEventListener("submit", event => {
            event.preventDefault();

            const text = input.value.trim();

            if (text) {
                sendMessage(text);
            }
        });

        return form;
    }

    function buildPanel() {
        panel = document.createElement("aside");
        panel.classList.add("chat-panel");
        panel.setAttribute("role", "dialog");
        panel.setAttribute(
            "aria-label",
            "Assistente de IA do TaskFlow"
        );
        panel.setAttribute("aria-modal", "false");

        messages = document.createElement("div");
        messages.classList.add("chat-messages");
        messages.setAttribute("role", "log");
        messages.setAttribute("aria-live", "polite");
        messages.setAttribute(
            "aria-label",
            "Mensagens da conversa"
        );

        panel.append(
            createHeader(),
            messages,
            createSuggestions(),
            createForm()
        );

        document.body.append(panel);

        if (currentUserId === null) {
            addMessage(
                "bot",
                "Olá! Selecione um usuário para começar a conversar comigo."
            );
        } else {
            addMessage(
                "bot",
                "Olá! Sou o assistente de IA do TaskFlow. " +
                "Posso ajudar você a consultar, criar e atualizar suas tarefas."
            );
        }

        setSendEnabled(currentUserId !== null && !isReplying);
    }

    async function sendMessage(text) {
        if (isReplying) {
            return;
        }

        if (currentUserId === null) {
            showMessage(
                "Selecione um usuário antes de conversar com o assistente."
            );
            return;
        }

        const messageText = String(text ?? "").trim();

        if (!messageText) {
            return;
        }

        if (messageText.length > 5000) {
            showMessage(
                "A mensagem deve ter no máximo 5000 caracteres."
            );
            return;
        }

        if (!socket.connected) {
            addMessage(
                "bot",
                "Não há conexão com o servidor. " +
                "Verifique sua conexão e tente novamente.",
                { type: "error" }
            );
            return;
        }

        const userId = currentUserId;
        const currentRequestId = ++requestId;

        isReplying = true;
        setSendEnabled(false);

        input.value = "";
        addMessage("user", messageText);

        const typing = addTypingIndicator();

        try {
            const result = await new Promise((resolve, reject) => {
                socket.timeout(60000).emit(
                    "chat:message",
                    {
                        userId: Number(userId),
                        message: messageText
                    },
                    (timeoutError, response) => {
                        if (timeoutError) {
                            reject(
                                new Error(
                                    "O servidor demorou muito para responder."
                                )
                            );
                            return;
                        }

                        if (!response || response.ok !== true) {
                            reject(
                                new Error(
                                    response?.message ||
                                    "Não foi possível processar sua mensagem."
                                )
                            );
                            return;
                        }

                        resolve(response);
                    }
                );
            });

            if (
                currentRequestId !== requestId ||
                Number(userId) !== Number(currentUserId)
            ) {
                return;
            }

            const reply = normalizeReply(result);

            if (!reply.message && reply.tasks.length === 0) {
                throw new Error(
                    "O servidor não retornou uma resposta válida."
                );
            }

            addMessage(
                "bot",
                reply.message || "Aqui estão as tarefas encontradas:",
                {
                    tasks: reply.tasks,
                    type: reply.type
                }
            );
        } catch (error) {
            if (
                currentRequestId !== requestId ||
                Number(userId) !== Number(currentUserId)
            ) {
                return;
            }

            console.error(
                "Erro ao enviar mensagem pelo Socket.IO:",
                error
            );

            addMessage(
                "bot",
                `Não foi possível obter uma resposta: ${error.message}`,
                { type: "error" }
            );
        } finally {
            typing.remove();

            if (currentRequestId === requestId) {
                isReplying = false;
                setSendEnabled(currentUserId !== null);

                if (isOpen && currentUserId !== null && input) {
                    input.focus({ preventScroll: true });
                }
            }
        }
    }

    function handleEscape(event) {
        if (event.key === "Escape") {
            closeChat();
        }
    }

    function openChat() {
        if (isOpen) {
            return;
        }

        if (!panel) {
            buildPanel();
        }

        isOpen = true;

        btnChat.setAttribute("aria-expanded", "true");
        document.addEventListener("keydown", handleEscape);

        requestAnimationFrame(() => {
            if (!panel || !isOpen) {
                return;
            }

            panel.classList.add("active");

            if (currentUserId !== null && !isReplying && input) {
                input.focus({ preventScroll: true });
            }
        });
    }

    function closeChat() {
        if (!isOpen) {
            return;
        }

        isOpen = false;

        panel?.classList.remove("active");
        btnChat.setAttribute("aria-expanded", "false");

        document.removeEventListener("keydown", handleEscape);
        btnChat.focus();
    }

    function toggleChat() {
        if (isOpen) {
            closeChat();
        } else {
            openChat();
        }
    }

    function joinUserRoom() {
        if (currentUserId !== null && socket.connected) {
            socket.emit("user:join", { userId: currentUserId });
        }
    }

    function handleTaskEvent(task) {
        if (!task || typeof onTaskCreated !== "function") {
            return;
        }

        const taskUserId = task.user_id ?? task.userId;

        if (
            taskUserId != null &&
            Number(taskUserId) !== Number(currentUserId)
        ) {
            return;
        }

        onTaskCreated({
            ...task,
            user_id: taskUserId ?? currentUserId
        });
    }

    socket.on("task:created", handleTaskEvent);
    socket.on("task:updated", handleTaskEvent);

    socket.on("connect", () => {
        console.log("Chat conectado via Socket.IO:", socket.id);
        joinUserRoom();
    });

    socket.on("disconnect", reason => {
        console.warn("Chat desconectado:", reason);
    });

    socket.on("connect_error", error => {
        console.error("Erro na conexão Socket.IO:", error.message);
    });

    btnChat.setAttribute("aria-expanded", "false");
    btnChat.addEventListener("click", toggleChat);

    return {
        async setUser(userId) {
            const normalizedUserId =
                userId == null || userId === ""
                    ? null
                    : Number(userId);

            if (
                normalizedUserId !== null &&
                (
                    !Number.isSafeInteger(normalizedUserId) ||
                    normalizedUserId <= 0
                )
            ) {
                throw new Error("ID do usuário inválido.");
            }

            requestId++;
            isReplying = false;
            currentUserId = normalizedUserId;

            if (currentUserId === null) {
                socket.emit("user:leave");
            } else {
                joinUserRoom();
            }

            if (panel && messages) {
                messages.replaceChildren();

                if (currentUserId === null) {
                    addMessage(
                        "bot",
                        "Selecione um usuário para começar a conversar."
                    );
                } else {
                    addMessage(
                        "bot",
                        "Olá! Sou o assistente de IA do TaskFlow. " +
                        "Como posso ajudar com suas tarefas?"
                    );
                }

                if (input) {
                    input.value = "";
                }

                setSendEnabled(currentUserId !== null);
            }
        },

        clear() {
            requestId++;
            isReplying = false;
            currentUserId = null;

            socket.emit("user:leave");

            if (messages) {
                messages.replaceChildren();

                addMessage(
                    "bot",
                    "Selecione um usuário para começar a conversar."
                );
            }

            if (input) {
                input.value = "";
            }

            setSendEnabled(false);
        },

        open: openChat,
        close: closeChat,
        toggle: toggleChat
    };
}