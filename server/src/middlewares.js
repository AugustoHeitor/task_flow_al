/* Serve para controlar o que acontece antes, durante e depois das chamadas do modelo de IA e das ferramentas (tools). Ele permite adicionar funcionalidades ao agente sem precisar reescrever toda a lógica principal. */

import { humanInTheLoopMiddleware, todoListMiddleware, modelRetryMiddleware, modelFallbackMiddleware, createMiddleware, summarizationMiddleware } from "langchain";

import { RemoveMessage } from "@langchain/core/messages";
import { REMOVE_ALL_MESSAGES } from "@langchain/langgraph";

/* 
RemoveMessage: representa uma instrução para remover uma mensagem específica do histórico, identificada pelo seu id.

REMOVE_ALL_MESSAGES: é uma constante especial que, quando usada no id de um RemoveMessage, indica que todas as mensagens anteriores devem ser removidas do estado do histórico.
*/

import "dotenv/config";

/*

summarizationMiddleware: Resume mensagens antigas quando a conversa fica grande, preservando parte do contexto recente.

modelCallLimitMiddleware: Define limites de chamadas ao modelo, por execução ou por conversa.

toolCallLimitMiddleware: Limita quantas vezes as ferramentas podem ser executadas.	

humanInTheLoopMiddleware: Pausa o agente para uma pessoa aprovar, editar ou rejeitar determinadas chamadas de ferramentas.	

piiMiddleware: Detecta dados pessoais, como e-mails e telefones, e pode mascará-los, ocultá-los, bloqueá-los ou aplicar outras estratégias configuradas.

todoListMiddleware: Adiciona uma ferramenta para o agente planejar e acompanhar uma lista de tarefas.

llmToolSelectorMiddleware: Utiliza um modelo para selecionar as ferramentas relevantes antes da chamada ao modelo principal.

toolRetryMiddleware: Tenta executar novamente uma ferramenta quando ocorre uma falha, com intervalos progressivos entre as tentativas.

modelRetryMiddleware: Repete chamadas ao modelo quando ocorrem falhas elegíveis, conforme a configuração.

modelFallbackMiddleware: Tenta utilizar modelos alternativos quando o modelo principal falha.

toolEmulatorMiddleware: Simula a execução de ferramentas usando um LLM, para cenários de teste.

contextEditingMiddleware: Gerencia o contexto removendo resultados antigos de ferramentas quando necessário, mantendo os resultados recentes definidos na configuração.

FilesystemMiddleware: Oferece ferramentas de sistema de arquivos, como ler, escrever e editar arquivos, e pode auxiliar na gestão de contexto e memória.

createMiddleware(): Usado para criar os seus próprios middlewares

*/

/*
 * MIDDLEWARES E HOOKS NO LANGCHAIN
 *
 * Os middlewares permitem executar lógicas personalizadas em diferentes
 * etapas do ciclo de execução de um agente.
 *
 * HOOKS PRINCIPAIS:
 *
 * 1. beforeAgent
 *    Executado uma vez quando o agente inicia.
 *    Exemplo: carregar dados iniciais do usuário.
 *
 * 2. beforeModel
 *    Executado antes de cada chamada ao modelo.
 *    Exemplo: validar entradas ou ajustar mensagens.
 *
 * 3. wrapModelCall
 *    Envolve a chamada ao modelo, permitindo controlar sua execução.
 *    Exemplo: registrar chamadas, implementar retry ou trocar o modelo.
 *
 * 4. afterModel
 *    Executado depois de cada resposta do modelo.
 *    Exemplo: verificar a resposta antes de executar ferramentas (tools).
 *
 * 5. wrapToolCall
 *    Envolve a execução de cada ferramenta (tool).
 *    Exemplo: validar permissões, tratar erros e registrar operações.
 *
 * 6. afterAgent
 *    Executado uma vez quando o agente termina.
 *    Exemplo: salvar resultados e registrar o fim da execução.
 *
 * RESUMO:
 * - before: executa antes de uma etapa.
 * - after: executa depois de uma etapa.
 * - wrap: permite envolver e controlar a execução de uma etapa.
 */


/*


piiMiddleware("phone_number", {
    detector: /\+?\d[\d\s().-]{7,}\d/g, - define como o piiMiddleware identifica uma informação dentro de um texto.
    strategy: "mask", - significa a estratégia que será aplicada quando o detector encontrar uma informação pessoal.
    applyToInput: true, - Significa que o detector verifica os dados de entrada, ou seja, as mensagens recebidas do usuário antes de serem processadas pelo modelo.
    applyToOutput: true, - Significa que o middleware verifica as respostas produzidas pelo modelo antes de elas serem devolvidas ao usuário.
}),

strategy
redact	Substitui o valor inteiro por um marcador	
mask	Oculta parte do valor	
hash	Substitui por um hash determinístico Um identificador calculado a partir do valor
block	Bloqueia o processamento quando detecta o dado A execução gera um erro

*/


const middlewares = [
    summarizationMiddleware({

        model: process.env.MODEL_NAME,
        trigger: {
            tokens: 4000,
            messages: 10
        },
        keep: {
            messages: 10
        }

    }),
    humanInTheLoopMiddleware({
        interruptOn: {
            createTask: true,
            updateTask: true,
            listTasks: false,
            getTask: false,
        },
    }),

    todoListMiddleware(),

    modelRetryMiddleware({
        maxRetries: 3,
        initialDelayMs: 1000,
        backoffFactor: 2
    }),

    modelFallbackMiddleware(
        process.env.MODEL_FALLBACK
    ),


];

export default middlewares;