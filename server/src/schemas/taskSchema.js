import { z } from 'zod';

const createTaskSchema = z.object({
    title: z.string()
        .trim()
        .min(1, 'O título é obrigatório.')
        .max(255, 'O título deve ter no máximo 255 caracteres.'),

    description: z.string()
        .nullable()
        .optional(),

    status: z.enum([
        'pending',
        'in-progress',
        'completed',
        'cancelled',
        'paused'
    ]).default('pending'),

    user_id: z.number()
        .int('O ID do usuário deve ser um número inteiro.')
        .positive('O ID do usuário deve ser positivo.')
});

const updateTaskSchema = z.object({
    title: z.string()
        .trim()
        .min(1, 'O título é obrigatório.')
        .max(255, 'O título deve ter no máximo 255 caracteres.'),

    description: z.string()
        .nullable()
        .optional(),

    status: z.enum([
        'pending',
        'in-progress',
        'completed',
        'cancelled',
        'paused'
    ]).default('pending')
});

export {createTaskSchema, updateTaskSchema};