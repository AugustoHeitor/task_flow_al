import * as z from "zod";

const responseFormat = z.object({
    message: z.string()
        .describe("Mensagem que será exibida ao usuário no chat."),

    type: z.enum([
        "text",
        "task_list",
        "task_created",
        "task_updated",
        "task_deleted",
        "error",
        "out_of_scope"
    ]).describe("Tipo da resposta para orientar o frontend."),

    tasks: z.array(
        z.object({
            id: z.number()
                .int()
                .describe("ID numérico da tarefa."),
            title: z.string()
                .describe("Título da tarefa."),
            description: z.string()
                .describe("Descrição da tarefa. Use string vazia quando não houver."),
            status: z.string()
                .describe("Status da tarefa.")
        })
    ).describe("Tarefas confirmadas pelos resultados das ferramentas. Use uma lista vazia quando não houver tarefas.")
});

export default responseFormat;