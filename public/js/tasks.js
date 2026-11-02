
const API_URL = "/api/tasks";

const STATUS_LABELS = {
    pending: "Pendente",
    "in-progress": "Em andamento",
    completed: "Concluída",
    cancelled: "Cancelada",
    paused: "Pausada"
};

export function initTasks() {
    const btnCreateTask = document.querySelector(".btn-create-task");

    const columns = {
        pending: document.querySelector("#column-pending .column-body"),
        "in-progress": document.querySelector("#column-in-progress .column-body"),
        completed: document.querySelector("#column-completed .column-body"),
        cancelled: document.querySelector("#column-cancelled .column-body"),
        paused: document.querySelector("#column-paused .column-body")
    };

    Object.entries(columns).forEach(([status, column]) => {
        if (!column) {
            console.error(`Não foi encontrada a coluna do status "${status}".`);
        }
    });

    let currentUserId = null;
    let tasks = [];
    let loadRequestId = 0;

    async function readResponse(response) {
        const text = await response.text();

        if (!text) {
            return {};
        }

        try {
            return JSON.parse(text);
        } catch {
            return { message: text };
        }
    }

    function showMessage(message) {
        window.alert(message);
    }

    function formatDate(value) {
        if (!value) {
            return "Data indisponível";
        }

        const normalizedValue =
            typeof value === "string" &&
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)
                ? value.replace(" ", "T")
                : value;

        const date = new Date(normalizedValue);

        if (Number.isNaN(date.getTime())) {
            return "Data indisponível";
        }

        return date.toLocaleDateString("pt-BR");
    }

    function getEmptyCounts() {
        return {
            total: 0,
            pending: 0,
            "in-progress": 0,
            completed: 0,
            cancelled: 0,
            paused: 0
        };
    }

    function updateTaskCounters(counts) {
        const counterElements = {
            total: document.querySelector(".total"),
            pending: document.querySelector(".total-pending"),
            "in-progress": document.querySelector(".total-in-progress"),
            completed: document.querySelector(".total-completed"),
            cancelled: document.querySelector(".total-cancelled"),
            paused: document.querySelector(".total-paused")
        };

        Object.entries(counterElements).forEach(([status, element]) => {
            if (element) {
                element.textContent = counts[status] ?? 0;
            }
        });
    }

    function updateBoardCounters() {
        const counts = getEmptyCounts();

        counts.total = tasks.length;

        tasks.forEach(task => {
            if (
                Object.hasOwn(counts, task.status) &&
                task.status !== "total"
            ) {
                counts[task.status]++;
            }
        });

        updateTaskCounters(counts);
    }

    function clearBoard() {
        Object.values(columns).forEach(column => {
            if (column) {
                column.replaceChildren();
            }
        });

        updateTaskCounters(getEmptyCounts());
    }

    function setCreateButtonEnabled(enabled) {
        if (btnCreateTask) {
            btnCreateTask.disabled = !enabled;
        }
    }

    async function getTasks() {
        if (currentUserId === null) {
            tasks = [];
            clearBoard();
            return;
        }

        const requestId = ++loadRequestId;
        const userId = currentUserId;

        try {
            const response = await fetch(`${API_URL}/${userId}`);
            const result = await readResponse(response);

            if (
                requestId !== loadRequestId ||
                Number(currentUserId) !== Number(userId)
            ) {
                return;
            }

            if (!response.ok) {
                throw new Error(
                    result.message || "Não foi possível carregar as tarefas."
                );
            }

            if (!Array.isArray(result)) {
                throw new Error("A API não retornou uma lista de tarefas.");
            }

            tasks = result;

            clearBoard();

            tasks.forEach(task => {
                const column = columns[task.status];

                if (!column) {
                    console.warn(
                        `Status desconhecido para a tarefa ${task.id}:`,
                        task.status
                    );
                    return;
                }

                const card = createCardTask(task);

                card.dataset.taskId = String(task.id);

                column.append(card);
            });

            updateBoardCounters();
        } catch (error) {
            if (requestId !== loadRequestId) {
                return;
            }

            console.error("Erro ao buscar tarefas:", error);
            showMessage(error.message);
        }
    }

    async function getTask(taskId) {
        if (currentUserId === null) {
            showMessage("Selecione um usuário antes de buscar uma tarefa.");
            return null;
        }

        try {
            const response = await fetch(
                `${API_URL}/${currentUserId}/${taskId}`
            );

            const result = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    result.message || "Não foi possível buscar a tarefa."
                );
            }

            const task = result.task ?? result;

            if (!task || task.id == null) {
                throw new Error("A API não retornou uma tarefa válida.");
            }

            return task;
        } catch (error) {
            console.error("Erro ao buscar tarefa:", error);
            showMessage(error.message);
            return null;
        }
    }

    async function createTask(taskData) {
        if (currentUserId === null) {
            showMessage("Selecione um usuário antes de criar uma tarefa.");
            return false;
        }

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ...taskData,
                    user_id: currentUserId
                })
            });

            const result = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    result.message || "Não foi possível criar a tarefa."
                );
            }

            await getTasks();

            return true;
        } catch (error) {
            console.error("Erro ao criar tarefa:", error);
            showMessage(error.message);
            return false;
        }
    }

    async function updateTask(taskId, taskData) {
        if (currentUserId === null) {
            showMessage("Selecione um usuário antes de atualizar uma tarefa.");
            return false;
        }

        try {
            const response = await fetch(
                `${API_URL}/${currentUserId}/${taskId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(taskData)
                }
            );

            const result = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    result.message || "Não foi possível atualizar a tarefa."
                );
            }

            await getTasks();

            return true;
        } catch (error) {
            console.error("Erro ao atualizar tarefa:", error);
            showMessage(error.message);
            return false;
        }
    }

    async function deleteTask(taskId) {
        if (currentUserId === null) {
            showMessage("Selecione um usuário antes de excluir uma tarefa.");
            return;
        }

        const confirmed = window.confirm(
            "Tem certeza de que deseja excluir esta tarefa?"
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/${currentUserId}/${taskId}`,
                {
                    method: "DELETE"
                }
            );

            const result = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    result.message || "Não foi possível excluir a tarefa."
                );
            }

            await getTasks();
        } catch (error) {
            console.error("Erro ao excluir tarefa:", error);
            showMessage(error.message);
        }
    }

    /**
     * Adiciona ou atualiza uma tarefa recebida pelo Socket.IO.
     * A tarefa deve ter sido salva no banco pelo backend antes do evento.
     */
    function addTaskRealtime(task) {
        if (currentUserId === null) {
            return false;
        }

        if (!task || task.id == null || !task.title) {
            console.warn("Tarefa recebida em formato inválido:", task);
            return false;
        }

        const taskUserId = task.user_id ?? task.userId;

        if (
            taskUserId != null &&
            Number(taskUserId) !== Number(currentUserId)
        ) {
            return false;
        }

        const normalizedTask = {
            ...task,
            status: task.status ?? "pending"
        };

        const destinationColumn = columns[normalizedTask.status];

        if (!destinationColumn) {
            console.warn(
                `Status inválido para a tarefa ${normalizedTask.id}:`,
                normalizedTask.status
            );
            return false;
        }

        const taskIndex = tasks.findIndex(
            item => String(item.id) === String(normalizedTask.id)
        );

        if (taskIndex !== -1) {
            tasks[taskIndex] = normalizedTask;
        } else {
            tasks.push(normalizedTask);
        }

        document
            .querySelectorAll(".card-task")
            .forEach(card => {
                if (
                    card.dataset.taskId === String(normalizedTask.id)
                ) {
                    card.remove();
                }
            });

        const card = createCardTask(normalizedTask);

        card.dataset.taskId = String(normalizedTask.id);
        card.classList.add("task-arriving");

        destinationColumn.prepend(card);

        updateBoardCounters();

        requestAnimationFrame(() => {
            if (card.isConnected) {
                card.classList.add("task-arriving-active");
            }
        });

        const removeAnimationClasses = () => {
            card.classList.remove(
                "task-arriving",
                "task-arriving-active"
            );
        };

        card.addEventListener("animationend", removeAnimationClasses, {
            once: true
        });

        window.setTimeout(removeAnimationClasses, 1000);

        return true;
    }

    function createCardTask(task) {
        const card = document.createElement("div");
        card.classList.add("card-task");

        const cardBody = document.createElement("div");
        cardBody.classList.add("card-task-body");

        const cardHeader = document.createElement("div");

        const title = document.createElement("h4");
        title.textContent = task.title;

        const containerButtons = document.createElement("div");
        containerButtons.classList.add("container-buttons");

        const btnEdit = document.createElement("button");
        btnEdit.type = "button";
        btnEdit.classList.add("btn-task-edit");
        btnEdit.setAttribute("aria-label", "Editar tarefa");
        btnEdit.title = "Editar tarefa";

        const editIcon = document.createElement("img");
        editIcon.src = "./imgs/pencil.svg";
        editIcon.alt = "Editar";

        btnEdit.append(editIcon);

        const btnDelete = document.createElement("button");
        btnDelete.type = "button";
        btnDelete.classList.add("btn-task-delete");
        btnDelete.setAttribute("aria-label", "Excluir tarefa");
        btnDelete.title = "Excluir tarefa";

        const deleteIcon = document.createElement("img");
        deleteIcon.src = "./imgs/trash.svg";
        deleteIcon.alt = "Excluir";

        btnDelete.append(deleteIcon);

        containerButtons.append(btnEdit, btnDelete);
        cardHeader.append(title, containerButtons);

        const description = document.createElement("p");
        description.textContent = task.description || "";

        cardBody.append(cardHeader, description);

        const cardFooter = document.createElement("div");
        cardFooter.classList.add("card-task-footer");

        const createdAt = document.createElement("span");
        createdAt.classList.add("task-created-at");
        createdAt.textContent = formatDate(task.created_at);

        const calendarIcon = document.createElement("img");
        calendarIcon.src = "./imgs/calendar.svg";
        calendarIcon.alt = "Data de criação";

        cardFooter.append(createdAt, calendarIcon);

        card.append(cardBody, cardFooter);

        btnEdit.addEventListener("click", async () => {
            const taskData = await getTask(task.id);

            if (taskData) {
                createModalTask(taskData);
            }
        });

        btnDelete.addEventListener("click", () => {
            deleteTask(task.id);
        });

        return card;
    }

    function createModalTask(task = null) {
        const isEditing = task !== null;

        document.querySelector(".modal-screen")?.remove();

        const modalScreen = document.createElement("div");
        modalScreen.classList.add("modal-screen");

        const form = document.createElement("form");
        form.classList.add("modal", "form");

        const modalHeader = document.createElement("div");
        modalHeader.classList.add("modal-header");

        const modalTitle = document.createElement("h4");
        modalTitle.textContent = isEditing
            ? "Editar Tarefa"
            : "Criar Nova Tarefa";

        const btnClose = document.createElement("button");
        btnClose.type = "button";
        btnClose.classList.add("btn-close-modal");
        btnClose.setAttribute("aria-label", "Fechar modal");

        const closeIcon = document.createElement("img");
        closeIcon.src = "./imgs/xmark.svg";
        closeIcon.alt = "Fechar";

        btnClose.append(closeIcon);
        modalHeader.append(modalTitle, btnClose);

        const modalBody = document.createElement("div");
        modalBody.classList.add("modal-body");

        function createField(labelText, name, type, value = "") {
            const container = document.createElement("div");
            container.classList.add("container-label");

            const label = document.createElement("label");
            label.textContent = labelText;
            label.htmlFor = `task-${name}`;

            let field;

            if (type === "textarea") {
                field = document.createElement("textarea");
            } else if (type === "select") {
                field = document.createElement("select");
            } else {
                field = document.createElement("input");
                field.type = type;
            }

            field.id = `task-${name}`;
            field.name = name;

            if (type === "select") {
                Object.entries(STATUS_LABELS).forEach(
                    ([status, statusLabel]) => {
                        const option = document.createElement("option");
                        option.value = status;
                        option.textContent = statusLabel;
                        field.append(option);
                    }
                );
            }

            field.value = value ?? "";

            container.append(label, field);

            return { container, field };
        }

        const titleField = createField(
            "Título",
            "title",
            "text",
            task?.title
        );

        titleField.field.required = true;
        titleField.field.maxLength = 255;
        titleField.field.placeholder = "Digite o título da tarefa";

        const descriptionField = createField(
            "Descrição",
            "description",
            "textarea",
            task?.description
        );

        descriptionField.field.placeholder = "Descreva sua tarefa";

        const statusField = createField(
            "Status",
            "status",
            "select",
            task?.status || "pending"
        );

        modalBody.append(
            titleField.container,
            descriptionField.container,
            statusField.container
        );

        const modalFooter = document.createElement("div");
        modalFooter.classList.add("modal-footer");

        const btnCancel = document.createElement("button");
        btnCancel.type = "button";
        btnCancel.classList.add("btn-cancel-modal");
        btnCancel.textContent = "Cancelar";

        const btnSubmit = document.createElement("button");
        btnSubmit.type = "submit";
        btnSubmit.classList.add("btn-submit-modal");
        btnSubmit.textContent = isEditing
            ? "Salvar Alterações"
            : "Criar Tarefa";

        modalFooter.append(btnCancel, btnSubmit);

        form.append(modalHeader, modalBody, modalFooter);
        modalScreen.append(form);
        document.body.append(modalScreen);

        let isClosing = false;
        let closeTimeout = null;

        function removeModal() {
            if (closeTimeout !== null) {
                window.clearTimeout(closeTimeout);
                closeTimeout = null;
            }

            modalScreen.remove();
            document.removeEventListener("keydown", handleEscape);
        }

        function closeModal() {
            if (isClosing || !modalScreen.isConnected) {
                return;
            }

            isClosing = true;
            modalScreen.classList.remove("active");
            document.removeEventListener("keydown", handleEscape);

            closeTimeout = window.setTimeout(removeModal, 300);
        }

        function handleEscape(event) {
            if (event.key === "Escape") {
                closeModal();
            }
        }

        modalScreen.addEventListener("transitionend", event => {
            if (
                isClosing &&
                event.target === modalScreen &&
                event.propertyName === "opacity"
            ) {
                removeModal();
            }
        });

        btnClose.addEventListener("click", closeModal);
        btnCancel.addEventListener("click", closeModal);
        document.addEventListener("keydown", handleEscape);

        modalScreen.addEventListener("click", event => {
            if (event.target === modalScreen) {
                closeModal();
            }
        });

        form.addEventListener("submit", async event => {
            event.preventDefault();

            if (isClosing) {
                return;
            }

            const taskData = {
                title: titleField.field.value.trim(),
                description: descriptionField.field.value.trim(),
                status: statusField.field.value
            };

            if (!taskData.title) {
                titleField.field.focus();
                return;
            }

            btnSubmit.disabled = true;
            btnCancel.disabled = true;
            btnClose.disabled = true;

            btnSubmit.textContent = isEditing
                ? "Salvando..."
                : "Criando...";

            const success = isEditing
                ? await updateTask(task.id, taskData)
                : await createTask(taskData);

            if (success) {
                closeModal();
            } else if (modalScreen.isConnected && !isClosing) {
                btnSubmit.disabled = false;
                btnCancel.disabled = false;
                btnClose.disabled = false;

                btnSubmit.textContent = isEditing
                    ? "Salvar Alterações"
                    : "Criar Tarefa";
            }
        });

        requestAnimationFrame(() => {
            if (modalScreen.isConnected) {
                modalScreen.classList.add("active");
                titleField.field.focus();
            }
        });
    }

    if (btnCreateTask) {
        btnCreateTask.addEventListener("click", () => {
            createModalTask();
        });
    }

    setCreateButtonEnabled(false);
    clearBoard();

    return {
        async setUser(userId) {
            document.querySelector(".modal-screen")?.remove();

            currentUserId = userId ?? null;
            loadRequestId++;

            if (currentUserId === null) {
                tasks = [];
                setCreateButtonEnabled(false);
                clearBoard();
                return;
            }

            setCreateButtonEnabled(true);

            await getTasks();
        },

        clear() {
            loadRequestId++;
            currentUserId = null;
            tasks = [];

            setCreateButtonEnabled(false);
            clearBoard();
        },

        reload: getTasks,

        addTaskRealtime
    };
}
