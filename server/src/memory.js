/*

MemorySaver - Salva o estado de uma conversa específica, incluindo o histórico de mensagens mantido pelo agente e o progresso da execução.

InMemoryStore - Armazena informações definidas pela aplicação que podem ser consultadas em diferentes conversas.

ambos são armazenamentos em memória do processo. Em geral, os dados são perdidos quando a aplicação reinicia. Para persistência em produção, você pode usar implementações conectadas a um banco de dados.

existe esse risco. Se você usar MemorySaver e InMemoryStore sem controlar o crescimento dos dados, eles podem consumir cada vez mais RAM até prejudicar ou derrubar sua aplicação.

A RAM não apaga automaticamente os registros antigos só porque está ficando cheia. Você precisa implementar limites, limpeza ou usar armazenamento persistente.

MemorySaver e InMemoryStore não possuem cobrança própria por uso,
mas consomem RAM do servidor. Para persistir dados após reinicializações,
utilize um armazenamento persistente, como um banco de dados.

Para controlar o crescimento da memória no seu TaskFlow AI, eu faria três coisas:
1. Limitar o histórico enviado ao Gemini, mantendo as mensagens mais recentes.
2. Excluir checkpoints de conversas antigas ou definir um prazo de retenção.
3. Usar armazenamento persistente quando for colocar a aplicação em produção.

*/

import { MemorySaver, InMemoryStore } from "@langchain/langgraph";

/*
PostgresSaver: Salva checkpoints e o estado das conversas.	Histórico de execução de um agente, permitindo retomar uma conversa.

PostgresStore: Salva e recupera informações de longo prazo.	Preferências do usuário, informações aprendidas e dados que podem ser reutilizados em outras conversas.

*/

import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";
import pg from "pg";

import "dotenv/config";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL não foi encontrada no arquivo .env");
}

// Pool de conexão para salvar o histórico e os checkpoints
const pool = new pg.Pool({
    connectionString
});

// Memória de curto prazo: checkpoints das conversas
const checkpointer = new PostgresSaver(pool);

// Armazenamento de longo prazo: memórias persistentes
const store = PostgresStore.fromConnString(connectionString);

export { checkpointer, store};

/*
const checkpointer = new MemorySaver();
const store = new InMemoryStore();
*/