
const API_URL = "/api/users";

export function initUsers({ onChange } = {}) {
    const header = document.querySelector(
        "body > header > div > div.container-buttons"
    );

    if (!header) {
        throw new Error("Header não encontrado.");
    }

    let users = [];
    let selectedUserId = null;
    let isLoaded = false;

    function getUserName(user) {
        const fullName = [user.first_name, user.last_name]
            .filter(Boolean)
            .join(" ")
            .trim();

        return fullName || `Usuário ${user.id}`;
    }

    function getInitials(user) {
        const first = user.first_name?.trim().charAt(0) || "";
        const last = user.last_name?.trim().charAt(0) || "";

        return (first + last) || getUserName(user).charAt(0);
    }

    function createAvatar(user) {
        const avatar = document.createElement("span");
        avatar.classList.add("card-user-avatar");
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = user ? getInitials(user) : "?";

        return avatar;
    }

    function createArrow() {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");

        svg.classList.add("card-user-arrow");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", "m6 9 6 6 6-6");
        svg.append(path);

        return svg;
    }

    const containerUsers = document.createElement("div");
    containerUsers.classList.add("container-users");

    const selectedUser = document.createElement("button");
    selectedUser.type = "button";
    selectedUser.classList.add("card-user", "card-user-selected");
    selectedUser.setAttribute("aria-haspopup", "listbox");
    selectedUser.setAttribute("aria-expanded", "false");
    selectedUser.disabled = true;

    let selectedUserAvatar = createAvatar(null);

    const selectedUserName = document.createElement("span");
    selectedUserName.classList.add("card-user-name");
    selectedUserName.textContent = "Carregando...";

    selectedUser.append(
        selectedUserAvatar,
        selectedUserName,
        createArrow()
    );

    const usersList = document.createElement("div");
    usersList.classList.add("users-list");
    usersList.setAttribute("role", "listbox");
    usersList.hidden = true;

    containerUsers.append(selectedUser, usersList);

    const headerContent = header.querySelector(":scope > div");

    if (headerContent) {
        headerContent.append(containerUsers);
    } else {
        header.append(containerUsers);
    }

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

    function notifyChange(user) {
        if (typeof onChange === "function") {
            onChange(user);
        }
    }

    async function load() {
        selectedUser.disabled = true;
        selectedUserName.textContent = "Carregando...";

        try {
            const response = await fetch(API_URL);
            const result = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    result.message || "Não foi possível carregar os usuários."
                );
            }

            if (!Array.isArray(result)) {
                throw new Error("A API não retornou uma lista de usuários.");
            }

            users = result.filter(user =>
                user &&
                user.id != null &&
                Number.isSafeInteger(Number(user.id)) &&
                Number(user.id) > 0
            );

            usersList.replaceChildren();

            if (users.length === 0) {
                selectedUserId = null;
                selectedUserName.textContent = "Nenhum usuário";
                selectedUser.disabled = true;
                isLoaded = true;

                notifyChange(null);

                return null;
            }

            users.forEach(user => {
                usersList.append(createCardUser(user));
            });

            selectedUser.disabled = false;

            const initialUser =
                users.find(
                    user => Number(user.id) === selectedUserId
                ) || users[0];

            applySelection(initialUser);
            isLoaded = true;

            notifyChange(initialUser);

            return initialUser;
        } catch (error) {
            console.error("Erro ao buscar usuários:", error);

            selectedUserId = null;
            selectedUserName.textContent = "Erro ao carregar";
            selectedUser.disabled = true;
            isLoaded = false;

            notifyChange(null);

            return null;
        }
    }

    function createCardUser(user) {
        const cardUser = document.createElement("button");

        cardUser.type = "button";
        cardUser.classList.add("card-user");
        cardUser.setAttribute("role", "option");
        cardUser.dataset.userId = String(user.id);

        const userName = document.createElement("span");
        userName.classList.add("card-user-name");
        userName.textContent = getUserName(user);

        cardUser.append(createAvatar(user), userName);

        cardUser.addEventListener("click", () => {
            const changed = Number(user.id) !== selectedUserId;

            applySelection(user);
            closeUsersList();
            selectedUser.focus();

            if (changed) {
                notifyChange(user);
            }
        });

        return cardUser;
    }

    function applySelection(user) {
        if (!user || user.id == null) {
            return;
        }

        const userId = Number(user.id);

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            console.error("ID de usuário inválido:", user.id);
            return;
        }

        selectedUserId = userId;

        selectedUser.dataset.userId = String(userId);
        selectedUserName.textContent = getUserName(user);

        const newAvatar = createAvatar(user);
        selectedUserAvatar.replaceWith(newAvatar);
        selectedUserAvatar = newAvatar;

        usersList.querySelectorAll(".card-user").forEach(card => {
            const isSelected =
                Number(card.dataset.userId) === selectedUserId;

            card.classList.toggle("active", isSelected);
            card.setAttribute("aria-selected", String(isSelected));
        });
    }

    function closeUsersList() {
        usersList.hidden = true;
        selectedUser.classList.remove("active");
        selectedUser.setAttribute("aria-expanded", "false");
    }

    function toggleUsersList() {
        if (!isLoaded || selectedUser.disabled) {
            return;
        }

        const isOpening = usersList.hidden;

        usersList.hidden = !isOpening;
        selectedUser.classList.toggle("active", isOpening);
        selectedUser.setAttribute("aria-expanded", String(isOpening));
    }

    selectedUser.addEventListener("click", toggleUsersList);

    document.addEventListener("click", event => {
        if (!containerUsers.contains(event.target)) {
            closeUsersList();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !usersList.hidden) {
            closeUsersList();
            selectedUser.focus();
        }
    });

    return {
        load,

        getSelectedUser() {
            return users.find(
                user => Number(user.id) === selectedUserId
            ) || null;
        },

        getSelectedUserId() {
            return selectedUserId;
        }
    };
}
