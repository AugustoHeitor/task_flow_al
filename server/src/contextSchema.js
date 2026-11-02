import * as z from "zod";

const contextSchema = z.object({
    userId: z.number().int().positive()
});

export default contextSchema;