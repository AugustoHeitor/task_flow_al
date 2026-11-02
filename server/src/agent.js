// Permite criar um agente de inteligência artificial capaz de interpretar mensagens, utilizar ferramentas e executar etapas para resolver uma tarefa.

// Em vez de apenas receber uma pergunta e gerar uma resposta, o agente pode decidir qual ferramenta utilizar, quando utilizá-la e como usar o resultado para responder ao usuário.

// toolStrategy é uma estratégia do LangChain que permite ao agente produzir uma resposta estruturada usando uma chamada de ferramenta, em vez de depender do formato de saída estruturada nativo do modelo.

import { createAgent, toolStrategy } from "langchain";

// Essa linha carrega as variáveis de ambiente definidas no arquivo .env
import "dotenv/config";

import systemPrompt from "./systemPrompt.js";
import responseFormat from "./responseFormat.js"
import { listTasks, getTask, createTask, updateTask, saveMemory, searchMemories } from "./tools.js"
import contextSchema from "./contextSchema.js";
import middlewares from "./middlewares.js";
import { store, checkpointer } from "./memory.js"; 

/*

model: Define qual modelo de IA será utilizado.

tools: Disponibiliza as ferramentas que o agente pode chamar.

systemPrompt: Define as instruções e a personalidade do agente.

responseFormat: Define a estrutura esperada para a resposta final.

middleware: Adiciona comportamentos e extensões.

checkpointer: Salva o estado da execução associado a uma conversa (thread)

store: Armazena informações de longo prazo que podem ser reutilizadas em diferentes conversas, como preferências e informações relevantes sobre o usuário.

contextSchema: Define a estrutura dos dados de contexto.

name: utilize um identificador para o agente. 

*/

await checkpointer.setup();
await store.setup();

const agent = createAgent(
    { 
        model: process.env.MODEL_NAME,
        systemPrompt: systemPrompt,
        responseFormat: toolStrategy(responseFormat),
        tools: [listTasks, getTask, createTask, updateTask, saveMemory, searchMemories],
        contextSchema: contextSchema,
        middleware: middlewares,
        checkpointer,
        store,

    }
);

export default agent;