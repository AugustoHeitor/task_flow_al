
import {
    StateGraph,
    StateSchema,
    MessagesValue,
    START,
    END
} from "@langchain/langgraph";

import * as z from "zod";
import agent from "./agent.js";

const FlowState = new StateSchema({
    messages: MessagesValue,
    answer: z.string().default("")
});

const runAgent = async (state, runtime) => {
    const result = await agent.invoke(
        {
            messages: state.messages
        },
        {
            configurable: runtime.configurable,
            context: runtime.context
        }
    );

    const response =
        result.structuredResponse?.message ??
        result.messages?.at(-1)?.content ??
        "Não foi possível gerar uma resposta.";

    return {
        messages: result.messages,
        answer: typeof response === "string"
            ? response
            : JSON.stringify(response)
    };
};

const graph = new StateGraph(FlowState)
    .addNode("agent", runAgent)
    .addEdge(START, "agent")
    .addEdge("agent", END)
    .compile();

export default graph;
